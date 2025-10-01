import os
import re
import sys
from urllib.parse import urlparse, urlparse as _urlparse, parse_qs


import requests
from bs4 import BeautifulSoup
import pandas as pd
import json
import time
import importlib
# Import optionnel de 'keyboard' (utilisé pour interrompre le scraping avec la barre d'espace en local)
keyboard = None
try:
    keyboard = importlib.import_module('keyboard')
except Exception:
    # Pas bloquant en prod / VPS
    keyboard = None

base_url = "https://www.licitor.com/ventes-aux-encheres-immobilieres/paris-et-ile-de-france/prochaines-ventes.html?p={page}"
headers = {"User-Agent": "Mozilla/5.0 (compatible; Scraper/1.0)"}

# Limite de pages: par défaut 50, surchargeable par variable d'environnement MAX_PAGE ou argument --pages N
def _get_max_page() -> int:
    # Argument CLI --pages N
    for i, arg in enumerate(sys.argv):
        if arg == "--pages" and i + 1 < len(sys.argv):
            try:
                return max(1, int(sys.argv[i + 1]))
            except ValueError:
                pass
    # Variable d'environnement
    env_val = os.getenv("MAX_PAGE")
    if env_val:
        try:
            return max(1, int(env_val))
        except ValueError:
            pass
    return 50

max_page = _get_max_page()

def _format_coord(val):
    try:
        return f"{float(val):.6f}"
    except Exception:
        return ""

def extract_coords(detail_soup: BeautifulSoup) -> tuple[str, str]:
    """Tente d'extraire (latitude, longitude) depuis différentes sources de la page détail.
    Retourne des chaînes formatées ou ("", "") si introuvable.
    Stratégies:
      - iframe/a Google Maps (q=lat,lng ou @lat,lng)
      - OpenStreetMap (mlat/mlon ou ?lat=&lon=)
      - JSON-LD geo { latitude, longitude }
      - Scripts init (Leaflet: setView([lat,lng]), Google: new google.maps.LatLng(lat,lng))
      - data-* attributes (data-lat, data-lng)
    """
    lat = lng = ""
    html = detail_soup.decode()

    # 1) JSON-LD geo
    m = re.search(r'"geo"\s*:\s*\{[^}]*?"latitude"\s*:\s*([\-\d\.]+)[^}]*?"longitude"\s*:\s*([\-\d\.]+)', html, re.I | re.S)
    if m:
        return _format_coord(m.group(1)), _format_coord(m.group(2))

    # 2) Google Maps / OSM liens/iframes
    for tag in detail_soup.find_all(["iframe", "a" ]):
        src = tag.get("src") or tag.get("href")
        if not src:
            continue
        lower = src.lower()
        if any(k in lower for k in ["google.com/maps", "maps.google.", "openstreetmap.org", "osm.org"]):
            # @lat,lng pattern
            m = re.search(r'@\s*(-?\d{1,3}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)', src)
            if m:
                return _format_coord(m.group(1)), _format_coord(m.group(2))
            # q=lat,lng pattern
            pr = _urlparse(src)
            qs = parse_qs(pr.query)
            for key in ("q", "ll", "center"):
                if key in qs:
                    val = qs[key][0]
                    m2 = re.search(r'(-?\d{1,3}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)', val)
                    if m2:
                        return _format_coord(m2.group(1)), _format_coord(m2.group(2))
            # OSM: mlat/mlon or lat/lon
            for la_key, lo_key in (("mlat", "mlon"), ("lat", "lon"), ("lat", "lng")):
                if la_key in qs and lo_key in qs:
                    return _format_coord(qs[la_key][0]), _format_coord(qs[lo_key][0])

    # 3) Leaflet setView([lat, lng])
    m = re.search(r'setView\(\s*\[\s*(-?\d{1,3}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)\s*\]', html)
    if m:
        return _format_coord(m.group(1)), _format_coord(m.group(2))

    # 4) google.maps.LatLng(lat, lng)
    m = re.search(r'LatLng\(\s*(-?\d{1,3}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)\s*\)', html)
    if m:
        return _format_coord(m.group(1)), _format_coord(m.group(2))

    # 5) data-* attributes on any tag
    for tag in detail_soup.find_all(True):
        dlat = tag.get("data-lat") or tag.get("data-latitude")
        dlng = tag.get("data-lng") or tag.get("data-longitude") or tag.get("data-lon")
        if dlat and dlng:
            return _format_coord(dlat), _format_coord(dlng)

    return lat, lng

def _get_text(el):
    return el.get_text(" ", strip=True) if el else ""

def extract_full_text(detail_soup: BeautifulSoup) -> str:
    """Récupère le texte descriptif complet depuis la page détail.
    Essaie plusieurs sélecteurs, agrège plusieurs blocs si nécessaire, puis choisit le plus long.
    """
    selectors = [
        ".Text", ".Description", ".Resume", ".AdText", ".MainText",
        ".ContentText", ".texte", ".description", ".Designation", ".Consistance"
    ]
    candidates: list[str] = []
    for sel in selectors:
        els = detail_soup.select(sel)
        for el in els:
            t = el.get_text("\n", strip=True)
            if t:
                candidates.append(t)
    # Fallback: concaténer les <p> les plus longs
    if not candidates:
        ps = [p.get_text("\n", strip=True) for p in detail_soup.find_all("p")]
        ps = [p for p in ps if p and len(p) > 50]
        if ps:
            candidates.append("\n\n".join(ps))
    if not candidates:
        return ""
    # Garder la version la plus longue (probablement la description complète)
    full = max(candidates, key=len)
    # Nettoyage léger
    full = re.sub(r"\s+\n", "\n", full)
    full = re.sub(r"\n{3,}", "\n\n", full)
    return full.strip()

def extract_additional_fields(detail_soup: BeautifulSoup, detail_url: str) -> dict:
    """Extrait AdditionalText, Court, SousLot (liste), Trusts, Number et lien.
    Fallbacks: recherche par classes connues puis recherche textuelle/regex.
    """
    html = detail_soup.decode()
    # Number depuis l'URL (fin .../123456.html)
    m = re.search(r"/(\d+)\.html(?:$|\?)", detail_url)
    number = m.group(1) if m else ""

    # AdditionalText
    additional = _get_text(detail_soup.select_one(".AdditionalText"))
    if not additional:
        # parfois du texte additionnel sous .Additional, .Complement, .Compl, ou bloc principal
        for sel in [".Additional", ".Complement", ".Compl", ".ComplementText", ".TextAdd"]:
            additional = _get_text(detail_soup.select_one(sel))
            if additional:
                break

    # Court (Tribunal)
    court = _get_text(detail_soup.select_one(".Court"))
    if not court:
        # chercher un libellé contenant Tribunal et prendre le parent proche
        found = detail_soup.find(string=lambda t: t and "Tribunal" in t)
        if found and found.parent:
            court = _get_text(found.parent)

    # Sous-lots (plusieurs)
    sous_lots = []
    for el in detail_soup.select(".SousLot, .SubLot, .Lot, .Lots .Lot"):
        txt = _get_text(el)
        if txt:
            sous_lots.append(txt)
    if not sous_lots:
        # regex sur le texte
        for m in re.finditer(r"Sous\s*-?lot\s*:?\s*([^\n\r<]+)", html, re.I):
            sous_lots.append(m.group(1).strip())
    first_sous_lot = sous_lots[0] if sous_lots else ""
    sous_lot = " | ".join(dict.fromkeys([s for s in sous_lots if s]))  # unique et joint

    # Trusts (avocats/régisseur/société)
    trusts = []
    for el in detail_soup.select(".Trusts, .Trust, .Avocat, .Avocats, .Lawyer, .Lawyers, .Cabinet, .Regisseur, .Regisseurs"):
        txt = _get_text(el)
        if txt:
            trusts.append(txt)
    # heuristique si vide: lignes contenant "Maître" ou "Ferrari"
    if not trusts:
        for s in detail_soup.find_all(string=lambda t: t and ("Maître" in t or "Ferrari" in t)):
            val = _get_text(s.parent)
            if val:
                trusts.append(val)
    trusts_text = " | ".join(dict.fromkeys([t for t in trusts if t]))

    return {
        "AdditionalText": additional,
        "Court": court,
        "SousLot": sous_lot,
    "FirstSousLot": first_sous_lot,
        "Trusts": trusts_text,
        "Number": number,
        "lien": detail_url,
    }

def scrape_detail(detail_url):
    adresse = ""
    photo = ""
    date_visite = ""
    date_vente = ""
    latitude = ""
    longitude = ""
    full_texte = ""
    try:
        detail_r = requests.get(detail_url, headers=headers, timeout=15)
        detail_r.raise_for_status()
        detail_soup = BeautifulSoup(detail_r.text, "html.parser")
        # Adresse
        adr = detail_soup.select_one(".Street")
        adresse = adr.get_text(strip=True) if adr else ""
        # Photo principale
        img = detail_soup.select_one(".MainPhoto img")
        photo_url = img["src"] if img and img.has_attr("src") else ""
        if photo_url:
            try:
                # Nom du fichier à partir de l'URL
                parsed = urlparse(photo_url)
                filename = os.path.basename(parsed.path)
                pictures_dir = os.path.join(os.path.dirname(__file__), "Pictures")
                os.makedirs(pictures_dir, exist_ok=True)
                local_path = os.path.join(pictures_dir, filename)
                # Télécharger l'image si elle n'existe pas déjà
                if not os.path.exists(local_path):
                    img_data = requests.get(photo_url, headers=headers, timeout=15).content
                    with open(local_path, "wb") as f:
                        f.write(img_data)
                photo = local_path
            except Exception as e:
                print(f"Erreur téléchargement photo {photo_url} : {e}")
                photo = photo_url
        # Date de visite
        visit = detail_soup.find(string=lambda t: t and "Visite" in t)
        date_visite = visit.strip() if visit else ""
        # Date de la vente aux enchères (champ 'Date')
        date_tag = detail_soup.select_one(".Date")
        date_vente = date_tag.get_text(strip=True) if date_tag else ""
        # Coordonnées depuis la carte
        latitude, longitude = extract_coords(detail_soup)
        # Texte complet (description)
        full_texte = extract_full_text(detail_soup)
        # Champs additionnels
        extras = extract_additional_fields(detail_soup, detail_url)
    except Exception as e:
        print(f"Erreur page détail {detail_url} : {e}")
        extras = {"AdditionalText": "", "Court": "", "SousLot": "", "Trusts": "", "Number": "", "lien": detail_url}
    return adresse, photo, date_visite, date_vente, latitude, longitude, full_texte, extras

print("Démarrage du scraping séquentiel...")
items = []
for page in range(1, max_page + 1):
    if keyboard and keyboard.is_pressed('space'):
        print("Scraping interrompu par l'utilisateur (barre d'espace).")
        break
    url = base_url.format(page=page)
    print(f"Scraping page {page} : {url}")
    try:
        r = requests.get(url, headers=headers, timeout=15)
        r.raise_for_status()
    except Exception as e:
        print(f"Erreur lors de la récupération de la page {page} : {e}")
        continue
    soup = BeautifulSoup(r.text, "html.parser")
    cards = soup.select("ul.AdResults > li")
    for card in cards:
        ville = card.select_one(".City")
        description = card.select_one(".Name")
    texte_el = card.select_one(".Text")
    mise_a_prix = card.select_one(".PriceNumber")
    adresse = ""
    photo = ""
    date_visite = ""
    date_vente = ""
    link = card.select_one("a.Ad")
    if link and link.has_attr("href"):
        detail_url = "https://www.licitor.com" + link["href"]
        adresse, photo, date_visite, date_vente, latitude, longitude, full_texte, extras = scrape_detail(detail_url)
    else:
        latitude = ""
        longitude = ""
        full_texte = ""
        extras = {"AdditionalText": "", "Court": "", "SousLot": "", "Trusts": "", "Number": "", "lien": ""}
    items.append({
        "ville": ville.get_text(strip=True) if ville else "",
        "description": description.get_text(strip=True) if description else "",
        "texte": full_texte or (texte_el.get_text(strip=True) if texte_el else ""),
        "mise_a_prix": mise_a_prix.get_text(strip=True) if mise_a_prix else "",
        "adresse": adresse,
        "photo": photo,
        "date_visite": date_visite,
        "date_vente": date_vente,
        "latitude": latitude,
        "longitude": longitude,
        # Champs additionnels
        "AdditionalText": extras.get("AdditionalText", ""),
        "Court": extras.get("Court", ""),
        "SousLot": extras.get("SousLot", ""),
            "FirstSousLot": extras.get("FirstSousLot", ""),
        "Trusts": extras.get("Trusts", ""),
        "Number": extras.get("Number", ""),
        "lien": extras.get("lien", detail_url if link and link.has_attr("href") else ""),
    })
    print(f"Page {page} traitée, {len(cards)} annonces trouvées.")
    time.sleep(1)  # pause pour ne pas surcharger le serveur

def _load_existing(public_path: str, local_path: str) -> list[dict]:
    # Préfère le JSON public si présent, sinon local; sinon []
    for p in (public_path, local_path):
        try:
            if os.path.exists(p):
                with open(p, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    if isinstance(data, list):
                        return data
        except Exception:
            continue
    return []

def _key_for(item: dict) -> str:
    # Clé de déduplication: Number prioritaire, sinon lien, sinon fallback sur trio (ville|adresse|mise_a_prix)
    num = (item.get("Number") or "").strip()
    if num:
        return f"NUM:{num}"
    lien = (item.get("lien") or "").strip()
    if lien:
        return f"URL:{lien}"
    ville = (item.get("ville") or "").strip().lower()
    adr = (item.get("adresse") or "").strip().lower()
    prix = (item.get("mise_a_prix") or "").strip()
    return f"FALL:{ville}|{adr}|{prix}"

def _merge_items(existing: list[dict], new_items: list[dict]) -> list[dict]:
    merged: dict[str, dict] = {}
    # D'abord, indexer l'existant
    for it in existing:
        merged[_key_for(it)] = it
    # Puis intégrer les nouveaux: remplacer si clé déjà présente, en privilégiant champs non vides
    for it in new_items:
        k = _key_for(it)
        if k in merged:
            base = merged[k]
            # Fusion champ à champ: on remplit les vides de base avec les valeurs nouvelles non vides
            out = base.copy()
            for key, val in it.items():
                if not out.get(key) and val:
                    out[key] = val
                # Si le nouveau texte est plus long (description), on prend le plus informatif
                if key in ("texte", "AdditionalText"):
                    if isinstance(val, str) and len(val) > len(out.get(key, "")):
                        out[key] = val
            merged[k] = out
        else:
            merged[k] = it
    return list(merged.values())

if not items:
    print("Aucune annonce n'a été récupérée. Vérifiez la connexion internet, le site ou les sélecteurs.")
else:
    here = os.path.dirname(__file__)
    public_json = os.path.normpath(os.path.join(here, "..", "public", "licitor_samples.json"))
    local_json = os.path.join(here, "licitor_samples.json")

    # Charger l'existant pour éviter les doublons, puis fusionner
    existing = _load_existing(public_json, local_json)
    merged_items = _merge_items(existing, items)

    df = pd.DataFrame(merged_items)
    # CSV local (dans le dossier python)
    df.to_csv("licitor_samples.csv", index=False)
    # JSON dans le dossier public du projet pour usage direct par le front
    try:
        os.makedirs(os.path.dirname(public_json), exist_ok=True)
        with open(public_json, "w", encoding="utf-8") as f:
            json.dump(merged_items, f, ensure_ascii=False, indent=2)
        print(f"Écrit: {public_json}")
    except Exception as e:
        print(f"Erreur écriture JSON public: {e}")
    # Écrire également le JSON à côté du script (dossier python)
    try:
        with open(local_json, "w", encoding="utf-8") as f:
            json.dump(merged_items, f, ensure_ascii=False, indent=2)
        print(f"Écrit: {local_json}")
    except Exception as e:
        print(f"Erreur écriture JSON local: {e}")
