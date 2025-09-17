"use client";
import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

type Annonce = {
  id?: number;
  ville: string;
  description: string;
  texte: string;
  mise_a_prix: string;
  photo: string;
  date_visite: string;
  date_vente: string;
  adresse: string;
  latitude?: string;
  longitude?: string;
  heading?: number; // optionnel, orientation en degrés
  pitch?: number;   // optionnel, inclinaison en degrés
  fov?: number;     // optionnel, champ de vision en degrés
  AdditionalText?: string;
  Court?: string;
  SousLot?: string; // valeurs multiples jointes par " | "
  Trusts?: string;  // valeurs multiples jointes par " | "
  Number?: string;  // numéro d'annonce
  lien?: string;    // lien source vers Licitor
  FirstSousLot?: string; // premier sous-lot extrait côté scraper
};

function formatPrix(prix: string | number) {
  const n = typeof prix === "number" ? prix : parseInt(prix.toString().replace(/[^\d]/g, ""));
  if (isNaN(n)) return prix as any;
  return n.toLocaleString("fr-FR", { minimumFractionDigits: 0 }) + " €";
}

function removeAccents(str: string) {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

// Normalise une chaîne de visite en "DD/MM/YYYY à HH:MM"
function formatVisite(raw?: string): string {
  if (!raw) return "";
  const s = raw.replace(/\s+/g, " ").trim();
  // 1) Date numérique: 13/09/2025 ou 13-09-2025 ou 13 09 2025
  const mNum = s.match(/\b(\d{1,2})[\/\-.\s](\d{1,2})[\/\-.\s](\d{2,4})\b/);
  // 2) Date texte: 13 septembre 2025
  const norm = (t: string) => t.toLowerCase().replace(/[éèêë]/g, 'e').replace(/[àâä]/g, 'a').replace(/[îï]/g, 'i').replace(/[ôö]/g, 'o').replace(/[ûü]/g, 'u').replace(/ç/g, 'c');
  const displayMonth: Record<string, string> = { janvier:'janvier', fevrier:'février', mars:'mars', avril:'avril', mai:'mai', juin:'juin', juillet:'juillet', aout:'août', septembre:'septembre', octobre:'octobre', novembre:'novembre', decembre:'décembre' };
  const mTxt = s.match(/\b(\d{1,2})\s+(janvier|février|fevrier|mars|avril|mai|juin|juillet|août|aout|septembre|octobre|novembre|décembre|decembre)\s+(\d{4})\b/i);

  let dateLabel = ""; // label lisible: 24 septembre 2025
  let dateStr = "";   // format numérique: 24/09/2025
  if (mNum) {
    const d = mNum[1].padStart(2, '0');
    const mo = mNum[2].padStart(2, '0');
    let y = mNum[3];
    if (y.length === 2) y = (Number(y) > 50 ? '19' : '20') + y;
    dateStr = `${d}/${mo}/${y}`;
    dateLabel = dateStr; // fallback lisible
  } else if (mTxt) {
    const d = mTxt[1];
    const monthKey = norm(mTxt[2]);
    const y = mTxt[3];
    const disp = displayMonth[monthKey];
    if (disp) {
      dateLabel = `${parseInt(d,10)} ${disp} ${y}`;
    }
  }

  // 3) Heure(s) – privilégier des formes explicites "à HHhMM" ou "de HHhMM"
  const timeFromPatterns = (): string => {
    const patterns = [
      /(?:\b(?:à|de)\s*)(\d{1,2})\s*h\s*(\d{0,2})/i,
      /(?:\b(?:à|de)\s*)(\d{1,2}):(\d{2})/i,
      /(\d{1,2})\s*h\s*(\d{0,2})/i,
      /(\d{1,2}):(\d{2})/i,
    ];
    for (const re of patterns) {
      re.lastIndex = 0;
      const m = re.exec(s);
      if (m) {
        const h = parseInt(m[1], 10);
        if (h >= 0 && h <= 23) {
          const mm = (m[2] || '00').toString().padStart(2, '0');
          const hh = h.toString().padStart(2, '0');
          return `${hh}:${mm}`;
        }
      }
    }
    return "";
  };
  const timeStr = timeFromPatterns();

  if (dateLabel && timeStr) return `${dateLabel} à ${timeStr}`;
  if (dateLabel) return dateLabel;
  if (dateStr && timeStr) return `${dateStr} à ${timeStr}`;
  if (dateStr) return dateStr;
  if (timeStr) return timeStr;
  return s;
}

// Retourne les N premières lignes non vides d'un texte
function firstLines(text?: string, count = 6): string {
  if (!text) return "";
  const lines = text
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l.length > 0);
  return lines.slice(0, count).join('\n');
}

export default function AnnonceDetail() {
  const [annonce, setAnnonce] = useState<Annonce | null>(null);
  const [loading, setLoading] = useState(true);
  const [computedHeading, setComputedHeading] = useState<number | null>(null);
  const [computedLat, setComputedLat] = useState<number | null>(null);
  const [computedLon, setComputedLon] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [isFav, setIsFav] = useState<boolean>(false);
  const routeParams = useParams<{ id: string | string[] }>();
  const paramId = Array.isArray(routeParams.id) ? routeParams.id[0] : routeParams.id;

  // Ref du carrousel (doit être déclarée avant tout return conditionnel)
  const carouselRef = useRef<HTMLDivElement | null>(null);
  const scrollByPage = (dir: -1 | 1) => {
    const el = carouselRef.current;
    if (!el) return;
    const amount = el.clientWidth; // défile d’un "écran" complet
    el.scrollBy({ left: dir * amount, behavior: 'smooth' });
  };
  const scrollLeft = () => scrollByPage(-1);
  const scrollRight = () => scrollByPage(1);

  useEffect(() => {
    fetch("/licitor_samples.json")
      .then(res => res.json())
      .then((data: Annonce[]) => {
        const withIds = data.map((a, idx) => ({ ...a, id: idx }));
    const found = withIds.find(a => String(a.id) === String(paramId));
        setAnnonce(found ?? null);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [paramId]);

  // Charger l'état favori depuis la session (cookie)
  useEffect(() => {
    if (!paramId) return;
    fetch('/api/favorites', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => {
        const idNum = Number(paramId);
        if (Array.isArray(d?.favorites)) setIsFav(d.favorites.includes(idNum));
      })
      .catch(() => {});
  }, [paramId]);

  const toggleFav = async () => {
    const idNum = Number(paramId);
    try {
      const res = await fetch('/api/favorites', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: idNum, action: 'toggle' }) });
      const data = await res.json();
      if (typeof data?.isFavorite === 'boolean') setIsFav(data.isFavorite);
    } catch {}
  };

  // Helpers de calcul géo
  function toRad(d: number) { return (d * Math.PI) / 180; }
  function bearingDeg(lat1: number, lon1: number, lat2: number, lon2: number) {
    const y = Math.sin(toRad(lon2 - lon1)) * Math.cos(toRad(lat2));
    const x = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) - Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(toRad(lon2 - lon1));
    const brng = Math.atan2(y, x) * 180 / Math.PI; // -180..+180
    return (brng + 360) % 360; // 0..360
  }
  function dist2(lat1: number, lon1: number, lat2: number, lon2: number) {
    // distance approximative au carré (projection simple) suffisante pour comparer
    const kx = Math.cos(toRad((lat1 + lat2) / 2));
    const dx = (lon2 - lon1) * kx;
    const dy = (lat2 - lat1);
    return dx * dx + dy * dy;
  }

  // Estimation du heading + point de vue (coordonnées sur la route la plus proche) via Overpass API
  useEffect(() => {
    const lat = Number(annonce?.latitude);
    const lon = Number(annonce?.longitude);
    if (!annonce || isNaN(lat) || isNaN(lon)) return;
    if (annonce.heading !== undefined) { setComputedHeading(annonce.heading); }

    const controller = new AbortController();
    const radius = 60; // mètres approx.
    const q = `[out:json];way(around:${radius},${lat},${lon})["highway"];(._;>;);out body;`;
    const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(q)}`;
    const timeout = setTimeout(() => controller.abort(), 8000);
    fetch(url, { signal: controller.signal })
      .then(r => r.json())
      .then((data) => {
        const elements = data?.elements || [];
        const nodes = new Map<number, {lat: number, lon: number}>();
        for (const el of elements) {
          if (el.type === 'node') nodes.set(el.id, { lat: el.lat, lon: el.lon });
        }
        let best = { d2: Number.POSITIVE_INFINITY, a: 0, vlat: lat, vlon: lon };
        for (const el of elements) {
          if (el.type !== 'way' || !Array.isArray(el.nodes)) continue;
          for (let i = 0; i < el.nodes.length - 1; i++) {
            const n1 = nodes.get(el.nodes[i]);
            const n2 = nodes.get(el.nodes[i+1]);
            if (!n1 || !n2) continue;
            // distance du point au segment -> approx: distance au milieu du segment
            const midLat = (n1.lat + n2.lat) / 2;
            const midLon = (n1.lon + n2.lon) / 2;
            const d2val = dist2(lat, lon, midLat, midLon);
            if (d2val < best.d2) {
              best = { d2: d2val, a: bearingDeg(n1.lat, n1.lon, n2.lat, n2.lon), vlat: midLat, vlon: midLon };
            }
          }
        }
        if (isFinite(best.a)) setComputedHeading(Math.round(best.a));
        if (isFinite(best.vlat) && isFinite(best.vlon)) { setComputedLat(best.vlat); setComputedLon(best.vlon); }
      })
      .catch(() => {})
      .finally(() => clearTimeout(timeout));
    return () => { clearTimeout(timeout); controller.abort(); };
  }, [annonce?.latitude, annonce?.longitude, annonce?.heading]);

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50">
        <span className="text-blue-900 font-semibold">Chargement…</span>
      </main>
    );
  }

  if (!annonce) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-6 text-center">
        <h1 className="text-2xl font-bold text-blue-900 mb-2">Annonce introuvable</h1>
        <Link href="/" className="text-orange-600 underline">Retour à l’accueil</Link>
      </main>
    );
  }

  const hasCoords = annonce && annonce.latitude && annonce.longitude && !isNaN(Number(annonce.latitude)) && !isNaN(Number(annonce.longitude));
  const baseLat = computedLat ?? (hasCoords ? Number(annonce!.latitude) : NaN);
  const baseLon = computedLon ?? (hasCoords ? Number(annonce!.longitude) : NaN);
  const latStr = hasCoords && !isNaN(baseLat) ? baseLat.toFixed(6) : "";
  const lngStr = hasCoords && !isNaN(baseLon) ? baseLon.toFixed(6) : "";
  const heading = (annonce?.heading ?? (computedHeading ?? 0));
  const pitch = (annonce?.pitch ?? 0);
  const fov = (annonce?.fov ?? 80);
  const streetViewEmbed = hasCoords
    ? `https://www.google.com/maps?q=&layer=c&cbll=${latStr},${lngStr}&cbp=0,${heading},${pitch},0,${fov}&hl=fr&ll=${latStr},${lngStr}&z=18&output=embed`
    : "";
  const streetViewLink = hasCoords
    ? `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${latStr},${lngStr}&heading=${heading}&pitch=${pitch}&fov=${fov}`
    : "";
  const gmapsLink = hasCoords
    ? `https://www.google.com/maps?q=${latStr},${lngStr}&z=16`
    : "";

  // Prépare quelques angles pour la galerie Street View statique
  const thumbAngles = [heading, (heading + 30) % 360, (heading + 60) % 360, (heading + 90) % 360, (heading + 120) % 360, (heading + 150) % 360];
  const streetThumb = (h: number, size = "320x200") => `/api/streetview?location=${latStr},${lngStr}&heading=${h}&pitch=${pitch}&fov=80&size=${size}`;
  // Slides du carrousel principal (photo d'annonce + Street View statique)
  const slides: { src: string; href?: string; alt: string }[] = (() => {
    const arr: { src: string; href?: string; alt: string }[] = [];
    if (annonce?.photo) arr.push({ src: annonce.photo.replace(/\\/g, "/"), alt: `Photo de ${annonce.ville}` });
    if (hasCoords) {
      const angles = thumbAngles.slice(0, annonce?.photo ? 4 : 6);
      angles.forEach((h, i) => arr.push({ src: streetThumb(h, "960x540"), href: streetViewLink, alt: `Street View ${i + 1}` }));
    }
    return arr;
  })();

  const trustItems = annonce.Trusts ? annonce.Trusts.split('|').map(s => s.trim()).filter(Boolean) : [];
  const sousLots = annonce.SousLot ? annonce.SousLot.split('|').map(s => s.trim()).filter(Boolean) : [];
  // Extraction et dé-duplication de la mention "Consignation pour enchérir"
  let consignationText: string | null = null;
  const cleanedSousLots = sousLots.map((s) => {
    const re = /Consignation\s+pour\s+ench[ée]rir[^\n]*/gi;
    const match = s.match(re);
    if (match && !consignationText) {
      consignationText = match[0].replace(/\s{2,}/g, ' ').trim();
    }
    const out = s.replace(re, ' ')
                 .replace(/\s{2,}/g, ' ')
                 .replace(/\s+([,;:.])/g, '$1')
                 .trim();
    return out;
  });

  return (
  <main className="min-h-screen flex flex-col bg-white pb-16">
      {/* Navbar style page d'accueil */}
      <nav className="fixed top-0 left-0 w-full z-30" style={{background:'#30345d'}}>
        <img src="/Design-sans-titre-39-1080x675.png" alt="Immeuble moderne" className="absolute inset-0 w-full h-full object-cover opacity-40 pointer-events-none" style={{zIndex:0}} />
        <div className="absolute inset-0" style={{background:'#30345de6',zIndex:1}} />
        <div className="relative z-10 flex items-center justify-between px-6 md:px-12 py-2 text-white">
          <Link href="/" className="flex items-center gap-3">
            <img src="/Consult-Immo_5.png" alt="Logo" className="h-16 w-auto object-contain drop-shadow" />
          </Link>
          <div className="flex items-center gap-3">
            <button onClick={toggleFav} aria-label={isFav ? 'Retirer des favoris' : 'Ajouter aux favoris'} className={`inline-flex items-center justify-center w-10 h-10 rounded-full border ${isFav ? 'bg-rose-500 text-white border-rose-500' : 'bg-white/80 text-rose-600 border-rose-200'} shadow`}> 
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill={isFav ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 10-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 000-7.78z"/></svg>
            </button>
          </div>
        </div>
      </nav>

  {/* Suppression du grand hero demandé */}
  <div className="pt-24" />

      {/* Contenu principal */}
      <section className="w-full max-w-6xl mx-auto mt-6 px-4 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Colonne principale */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          {/* Galerie principale (juste au‑dessus des faits clés) */}
          <div className="relative rounded-2xl overflow-hidden shadow-xl border border-blue-100 bg-white animate-fade-in">
            {slides.length > 0 ? (
              <>
                <div ref={carouselRef} className="flex overflow-x-auto snap-x snap-mandatory scroll-smooth">
                  {slides.map((s, i) => (
                    s.href ? (
                      <a key={i} href={s.href} target="_blank" rel="noopener noreferrer" className="snap-center shrink-0 w-full rounded-xl overflow-hidden border border-blue-100 shadow" style={{ scrollSnapStop: 'always' }}>
                        <img src={s.src} alt={s.alt} className="w-full aspect-video object-cover" />
                      </a>
                    ) : (
                      <div key={i} className="snap-center shrink-0 w-full rounded-xl overflow-hidden border border-blue-100 shadow" style={{ scrollSnapStop: 'always' }}>
                        <img src={s.src} alt={s.alt} className="w-full aspect-video object-cover" />
                      </div>
                    )
                  ))}
                </div>
                {slides.length > 1 && (
                  <>
                    <button aria-label="Précédent" onClick={scrollLeft} className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-white/90 border border-blue-100 shadow p-2 text-blue-900 hover:bg-white">
                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/></svg>
                    </button>
                    <button aria-label="Suivant" onClick={scrollRight} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/90 border border-blue-100 shadow p-2 text-blue-900 hover:bg-white">
                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
                    </button>
                  </>
                )}
              </>
            ) : (
              <div className="aspect-video flex items-center justify-center text-gray-400">Pas de photo</div>
            )}
          </div>

          {/* (Supprimé) Ancienne galerie d'aperçu pour éviter le doublon */}

          {/* Faits clés */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-fade-in">
            <div className="bg-white rounded-xl shadow border border-blue-100 p-4">
              <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                <svg className="w-4 h-4 text-orange-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 1.343-3 3s1.343 3 3 3 3-1.343 3-3-1.343-3-3-3zm0 10c-4.418 0-8-3.582-8-8s3.582-8 8-8 8 3.582 8 8-3.582 8-8 8z"/></svg>
                Mise à prix
              </div>
              <div className="text-xl font-bold text-blue-900">{formatPrix(annonce.mise_a_prix)}</div>
            </div>
            <div className="bg-white rounded-xl shadow border border-blue-100 p-4">
              <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                <svg className="w-4 h-4 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                Visite
              </div>
              <div className="text-base font-semibold text-blue-900">{formatVisite(annonce.date_visite) || "—"}</div>
            </div>
            <div className="bg-white rounded-xl shadow border border-blue-100 p-4">
              <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                <svg className="w-4 h-4 text-rose-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a5 5 0 00-10 0v2a2 2 0 00-2 2v7a2 2 0 002 2h10a2 2 0 002-2v-7a2 2 0 00-2-2z"/></svg>
                Vente
              </div>
              <div className="text-base font-semibold text-blue-900">{annonce.date_vente || "—"}</div>
            </div>
          </div>

          {/* Description */}
          <div className="bg-white rounded-2xl shadow-xl border border-blue-100 p-6 animate-fade-in">
            <h2 className="text-xl font-bold text-blue-900 mb-3">Description</h2>
            <p className="text-gray-700 whitespace-pre-line leading-relaxed">{firstLines(annonce.texte, 6)}</p>
          </div>

          {(annonce.Number || annonce.Court || annonce.SousLot) && (
            <div className="bg-white rounded-2xl shadow-xl border border-blue-100 p-6 animate-fade-in">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-blue-900">Informations complémentaires</h2>
                {annonce.Number && (
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(annonce.Number || "");
                      setCopied(true);
                      setTimeout(() => setCopied(false), 1500);
                    }}
                    className="inline-flex items-center gap-2 text-sm text-blue-700 hover:text-orange-600"
                    title="Copier la référence"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
                    {copied ? "Copié !" : `Réf #${annonce.Number}`}
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {annonce.Court && (
                  <div className="rounded-xl border border-blue-100 p-4">
                    <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">Tribunal</div>
                    <div className="text-blue-900 font-semibold whitespace-pre-line">{annonce.Court}</div>
                  </div>
                )}
                {annonce.FirstSousLot && (
                  <div className="rounded-xl border border-blue-100 p-4">
                    <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">Sous-lot principal</div>
                    <div className="text-blue-900 whitespace-pre-line">{annonce.FirstSousLot}</div>
                  </div>
                )}
                {/* Bloc Parties / Avocats supprimé selon la demande */}
                {cleanedSousLots.length > 0 && (
                  <div className="rounded-xl border border-blue-100 p-4 md:col-span-2">
                    <div className="text-xs uppercase tracking-wide text-gray-500 mb-3">Sous-lots</div>
                    <ol className="space-y-3">
                      {cleanedSousLots.map((s, i) => (
                        <li key={i} className="relative rounded-2xl border border-blue-100 bg-blue-50/60 p-4 pl-12 text-blue-900">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center justify-center w-7 h-7 rounded-full bg-white border border-blue-200 text-[12px] font-semibold text-blue-700">{i+1}</span>
                          <p className="leading-relaxed">{s}</p>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}

                {consignationText && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 md:col-span-2">
                    <div className="text-xs uppercase tracking-wide text-amber-700 mb-1">Consignation pour enchérir</div>
                    <div className="text-amber-900">{consignationText}</div>
                  </div>
                )}
              </div>

              {/* Informations additionnelles supprimées comme demandé */}
              {/* Lien source Licitor supprimé selon la demande */}
            </div>
          )}

          {/* Localisation + Carte */}
          <div className="bg-white rounded-2xl shadow-xl border border-blue-100 p-6 animate-fade-in">
            <h2 className="text-xl font-bold text-blue-900 mb-2">Localisation</h2>
            <p className="text-gray-700"><b>Adresse :</b> {annonce.adresse}</p>
            {hasCoords && (
              <>
                <div className="mt-3 flex flex-wrap gap-3 items-center">
                  <a href={streetViewLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-blue-700 hover:text-orange-600 font-semibold">
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 2C8 2 5 5 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-4-3-7-7-7zm0 9.5a2.5 2.5 0 110-5 2.5 2.5 0 010 5z"/></svg>
                    Ouvrir dans Google Street View
                  </a>
                  <a href={gmapsLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-blue-700 hover:text-orange-600 font-semibold">
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 2C8 2 5 5 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-4-3-7-7-7zm0 9.5a2.5 2.5 0 110-5 2.5 2.5 0 010 5z"/></svg>
                    Voir sur Google Maps
                  </a>
                </div>
                <div className="mt-4">
                  <iframe
                    title="Google Maps"
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    src={`https://www.google.com/maps?q=${latStr},${lngStr}&z=15&hl=fr&output=embed`}
                    className="w-full h-[420px] rounded-xl border border-blue-100 shadow"
                    allowFullScreen
                  />
                  <div className="mt-3">
                    <a
                      href={`https://www.google.com/maps?q=${latStr},${lngStr}&z=16`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-blue-700 hover:text-orange-600 font-semibold"
                    >
                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 2C8 2 5 5 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-4-3-7-7-7zm0 9.5a2.5 2.5 0 110-5 2.5 2.5 0 010 5z"/></svg>
                      Ouvrir dans Google Maps
                    </a>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Aside sticky contact */}
        <aside className="lg:col-span-1">
          <div className="sticky top-24 bg-white rounded-2xl shadow-xl border border-blue-100 p-6 flex flex-col gap-4">
            <h3 className="text-lg font-bold text-blue-900">Intéressé par ce bien ?</h3>
            {annonce.Number && <div className="text-sm text-gray-600">Réf. annonce <b>#{annonce.Number}</b></div>}
            <ul className="text-sm text-gray-700 space-y-2">
              <li className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-emerald-400"/> Analyse du dossier</li>
              <li className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-emerald-400"/> Stratégie d’enchères personnalisée</li>
              <li className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-emerald-400"/> Accompagnement jusqu’à la vente</li>
            </ul>
            <div className="flex items-center gap-3">
              <button onClick={toggleFav} aria-label={isFav ? 'Retirer des favoris' : 'Ajouter aux favoris'} className={`inline-flex items-center justify-center w-10 h-10 rounded-full border ${isFav ? 'bg-rose-500 text-white border-rose-500' : 'bg-white text-rose-600 border-rose-200'} shadow`}> 
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill={isFav ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 10-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 000-7.78z"/></svg>
              </button>
              <a href="/questionnaire" className="bg-gradient-to-r from-orange-500 to-yellow-400 text-white font-bold px-6 py-3 rounded-full shadow text-center hover:scale-[1.01] transition">Nous contacter</a>
            </div>
            <div className="text-xs text-gray-500">Réponse sous 24h, sans engagement.</div>
          </div>
        </aside>
      </section>

      <footer id="contact" className="w-full mt-auto bg-gradient-to-br from-blue-900 via-blue-900 to-blue-800 text-white">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="h-px w-full bg-white/10 mb-6" />
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-3 mb-2 md:mb-0">
              <img src="/Consult-Immo_5.png" alt="Logo Immo-enchères" className="h-8 w-auto" />
              <span className="font-bold text-lg tracking-tight">Immo-enchères</span>
            </div>
            <div className="flex gap-6 text-sm text-white/90">
              <Link href="/" className="hover:text-yellow-400 transition-colors">Accueil</Link>
              <Link href="/#enchere" className="hover:text-yellow-400 transition-colors">Enchères</Link>
            </div>
            <div className="text-sm text-white/70">© {new Date().getFullYear()} Immo-enchères</div>
          </div>
        </div>
      </footer>
    </main>
  );
}
