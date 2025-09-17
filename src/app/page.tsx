"use client";
// Formate un prix en ajoutant des espaces tous les milliers
function formatPrix(prix: string | number) {
  const n = typeof prix === "number" ? prix : parseInt(prix.toString().replace(/[^\d]/g, ""));
  if (isNaN(n)) return prix;
  return n.toLocaleString("fr-FR", { minimumFractionDigits: 0 }) + " €";
}
import React, { useState, useEffect } from "react";
import Link from "next/link";

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
  heading?: number;
  pitch?: number;
  fov?: number;
  FirstSousLot?: string;
};

// Formatteur "Visite" pour la page d'accueil: retour "jour date à HH:MM"
function formatVisiteHome(raw?: string): string {
  if (!raw) return "";
  const s = raw.replace(/\s+/g, " ").trim();

  // Mois français (variantes incluses)
  const moisTxt = [
    ["janvier"],
    ["février", "fevrier"],
    ["mars"],
    ["avril"],
    ["mai"],
    ["juin"],
    ["juillet"],
    ["août", "aout"],
    ["septembre"],
    ["octobre"],
    ["novembre"],
    ["décembre", "decembre"],
  ];

  let day: number | null = null;
  let monthIdx: number | null = null; // 0-based
  let year: number | null = null;

  // 1) JJ/MM/AAAA ou JJ-MM-AAAA
  const m = s.match(/(\d{1,2})[\/.\- ](\d{1,2})[\/.\- ](\d{2,4})/);
  if (m) {
    day = parseInt(m[1], 10);
    const mnum = parseInt(m[2], 10);
    year = parseInt(m[3], 10);
    if (year < 100) year += 2000;
    if (!isNaN(day) && !isNaN(mnum) && !isNaN(year)) monthIdx = Math.min(Math.max(mnum - 1, 0), 11);
  }

  // 2) JJ mois AAAA (texte)
  if (day === null || monthIdx === null || year === null) {
    const mt = s.match(/(\d{1,2})\s+([a-zéûôîàèùç]+)\s+(\d{4})/i);
    if (mt) {
      day = parseInt(mt[1], 10);
      const mon = mt[2].toLowerCase();
      year = parseInt(mt[3], 10);
      for (let i = 0; i < moisTxt.length; i++) {
        if (moisTxt[i].some((v) => mon.startsWith(v.slice(0, 3)))) { monthIdx = i; break; }
      }
    }
  }

  if (day === null || monthIdx === null || year === null) return raw;

  // Heure: chercher patterns usuels ("à 14h30", "de 14h", "14:30")
  let hh: number | null = null;
  let mm: number = 0;
  const timePatterns = [
    /(à|de)\s*(\d{1,2})\s*h\s*(\d{2})/i,
    /(à|de)\s*(\d{1,2})\s*h(?!\d)/i,
    /\b(\d{1,2}):(\d{2})\b/,
    /\b(\d{1,2})h(\d{2})\b/i,
  ];
  for (const re of timePatterns) {
    const mt = s.match(re);
    if (mt) {
      const h = parseInt(mt[2] || mt[1], 10);
      const mmin = parseInt((mt[3] ?? "0"), 10);
      if (!isNaN(h) && h >= 0 && h < 24) { hh = h; mm = isNaN(mmin) ? 0 : mmin; }
      break;
    }
  }

  const d = new Date(year, monthIdx, day, hh ?? 0, mm ?? 0);
  const jours = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
  const moisAff = ["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"];
  const dow = jours[d.getDay()];
  const datePart = `${dow} ${day} ${moisAff[monthIdx]} ${year}`;
  const timePart = hh !== null ? ` à ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}` : "";
  return datePart + timePart;
}

export default function Home() {
  const [minPrix, setMinPrix] = useState("");
function isVisiteFuture(dateStr?: string): boolean {
  if (!dateStr) return true;
  // Recherche une date au format JJ/MM/AAAA ou JJ mois AAAA ou JJ-MM-AAAA
  const m = dateStr.match(/(\d{1,2})[\/\-. ](\d{1,2}|[a-zéû]+)[\/\-. ](\d{2,4})/i);
  let d: Date | null = null;
  if (m) {
  const day = parseInt(m[1], 10);
    let month = m[2];
  const year = parseInt(m[3], 10);
    if (isNaN(year)) return true;
    if (isNaN(day)) return true;
    if (month.match(/\d+/)) {
      month = ("0" + month).slice(-2);
      d = new Date(`${year}-${month}-${("0"+day).slice(-2)}`);
    } else {
      // Mois texte
      const mois = ["janvier","février","fevrier","mars","avril","mai","juin","juillet","août","aout","septembre","octobre","novembre","décembre","decembre"];
      const idx = mois.findIndex(mo => mo.startsWith(month.toLowerCase().slice(0,3)));
      if (idx >= 0) {
        const mNum = (idx % 12) + 1;
        d = new Date(`${year}-${("0"+mNum).slice(-2)}-${("0"+day).slice(-2)}`);
      }
    }
  }
  if (!d) return true;
  d.setHours(23,59,59,999);
  return d.getTime() >= Date.now();
}

  const [maxPrix, setMaxPrix] = useState("");
  const [page, setPage] = useState(1);
  const perPage = 7;

  const [annonces, setAnnonces] = useState<Annonce[]>([]);
  const [search, setSearch] = useState("");
  const [ville, setVille] = useState("");
  // Checkbox de sélection retirée
  const [menuOpen, setMenuOpen] = useState(false);
  const [favorites, setFavorites] = useState<number[]>([]);
  const [showFavsOnly, setShowFavsOnly] = useState(false);

  useEffect(() => {
    fetch("/licitor_samples.json")
      .then(res => res.json())
      .then((data: Annonce[]) => {
        const withIds = data.map((a, idx) => ({ ...a, id: idx }));
        setAnnonces(withIds);
      });
  }, []);

  // Charger favoris de la session (cookie via API)
  useEffect(() => {
    fetch('/api/favorites', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => { if (Array.isArray(d?.favorites)) setFavorites(d.favorites); })
      .catch(() => {});
  }, []);

  // Réinitialiser pagination quand les filtres changent
  useEffect(() => {
    setPage(1);
  }, [search, ville, minPrix, maxPrix, showFavsOnly]);

  const toggleFav = async (id?: number) => {
    if (id === undefined) return;
    try {
      const res = await fetch('/api/favorites', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, action: 'toggle' }) });
      const data = await res.json();
      if (Array.isArray(data?.favorites)) setFavorites(data.favorites);
    } catch {}
  };

  const villes = Array.from(new Set(annonces.map(a => a.ville))).filter(Boolean);
  const filtered = annonces.filter(a =>
    (ville ? a.ville === ville : true) &&
    (search ? removeAccents(a.ville.toLowerCase()).includes(removeAccents(search.toLowerCase())) : true) &&
    (minPrix ? parseInt(a.mise_a_prix.replace(/[^\d]/g, "")) >= parseInt(minPrix) : true) &&
    (maxPrix ? parseInt(a.mise_a_prix.replace(/[^\d]/g, "")) <= parseInt(maxPrix) : true) &&
    (showFavsOnly ? favorites.includes(a.id ?? -1) : true) &&
    isVisiteFuture(a.date_visite)
  );

  const totalPages = Math.ceil(filtered.length / perPage);
  const paginated = filtered.slice((page - 1) * perPage, page * perPage);


  return (
    <main className="min-h-dvh bg-white flex flex-col font-sans">
      {/* HEADER */}
  <nav className="fixed top-0 left-0 w-full z-30 relative" style={{background:'#30345d'}}>
    <img src="/Design-sans-titre-39-1080x675.png" alt="Immeuble moderne" className="absolute inset-0 w-full h-full object-cover opacity-40 pointer-events-none" style={{zIndex:0}} />
    <div className="absolute inset-0" style={{background:'#30345de6',zIndex:1}} />
  <div className="flex items-center justify-between px-6 md:px-12 py-2 shadow-2xl text-white relative z-10">
      <div className="flex items-center gap-4">
  <img src="/logo.svg" alt="Logo Immo-enchères" className="h-16 w-auto object-contain drop-shadow" />
      </div>
      <div className="hidden md:flex gap-8 items-center text-base font-semibold">
        <a href="#enchere" className="hover:text-orange-400 transition">Enchères</a>
        <a href="#avantages" className="hover:text-orange-400 transition">Pourquoi nous ?</a>
        <a href="#contact" className="hover:text-orange-400 transition">Contact</a>
      </div>
      {/* Bouton burger mobile */}
      <button
        type="button"
        aria-label="Ouvrir le menu"
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen(v => !v)}
        className="md:hidden inline-flex items-center justify-center w-11 h-11 rounded-full border border-white/30 bg-white/10 hover:bg-white/20 transition"
      >
        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      </button>
    </div>
    {/* Menu mobile déroulant */}
    {menuOpen && (
      <div className="md:hidden absolute left-0 right-0 top-full bg-white text-blue-900 shadow-xl border-t border-blue-100 z-[60]">
        <a href="#enchere" onClick={() => setMenuOpen(false)} className="block px-6 py-4 border-b border-blue-50 hover:bg-blue-50">Enchères</a>
        <a href="#avantages" onClick={() => setMenuOpen(false)} className="block px-6 py-4 border-b border-blue-50 hover:bg-blue-50">Pourquoi nous ?</a>
        <a href="#contact" onClick={() => setMenuOpen(false)} className="block px-6 py-4 hover:bg-blue-50">Contact</a>
      </div>
    )}
  </nav>
  {/* Spacer sous la navbar pour éviter recouvrement du menu */}
  {menuOpen && <div className="h-40 md:hidden" />}

  {/* HERO */}
  <section className="w-full flex flex-col items-center justify-center pt-36 pb-20 bg-white relative overflow-hidden min-h-[480px]">
  <img src="/Design-sans-titre-39-1080x675.png" alt="Immeuble moderne" className="absolute inset-0 w-full h-full object-cover opacity-70 pointer-events-none" style={{zIndex:0}} />
  <div className="absolute inset-0" style={{background:'#30345dcc',zIndex:1}} />
  <div className="max-w-2xl w-full mx-auto text-center p-8 relative z-10">
  <h1 className="text-5xl md:text-6xl font-extrabold text-white mb-4 tracking-tight">Immo-enchères</h1>
  <h2 className="text-2xl md:text-3xl font-semibold text-white mb-6">Votre premier achat immobilier aux enchères, accompagné par des experts</h2>
  <p className="text-lg md:text-xl text-white mb-4">Accompagnement complet, sécurité, transparence. <span className="font-bold text-orange-500">Rémunération uniquement au succès !</span></p>
    </div>
  </section>

  {/* AVANTAGES */}
  <section className="w-full max-w-6xl mx-auto px-4 md:px-8 mb-20 animate-fade-in">
    <div className="h-8 md:h-12"></div>
  <h2 className="text-4xl font-extrabold text-[#30345d] mb-8 text-center tracking-tight">Un accompagnement sur mesure, selon vos besoins</h2>
    <p className="text-lg text-gray-600 mb-12 text-center">Que vous soyez primo-investisseur ou expérimenté, nous vous offrons un panel de services adaptés pour sécuriser votre investissement</p>
    <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
      <li className="bg-white rounded-2xl shadow-lg p-8 flex flex-col items-center text-center border border-gray-100 hover:shadow-2xl transition">
        <span className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#30345d]/10 mb-4">
          <svg className="w-8 h-8 text-[#30345d]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path strokeLinecap="round" strokeLinejoin="round" d="M11 7v4l3 3"/></svg>
        </span>
        <span className="font-extrabold text-[#30345d] text-lg mb-2">Analyse complète des biens</span>
        <span className="text-[#30345d]">Évaluation juridique, technique et estimation de la valeur réelle du bien. Nous décryptons le cahier des charges et identifions tous les risques potentiels.</span>
      </li>
      <li className="bg-white rounded-2xl shadow-lg p-8 flex flex-col items-center text-center border border-gray-100 hover:shadow-2xl transition">
        <span className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-orange-100 mb-4">
          <svg className="w-8 h-8 text-orange-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/></svg>
        </span>
  <span className="font-extrabold text-orange-500 text-lg mb-2">Stratégie d&rsquo;enchères personnalisée</span>
        <span className="text-gray-700">Simulation détaillée et stratégie personnalisée basée sur votre budget, le marché actuel et notre expertise des enchères immobilières.</span>
      </li>
      <li className="bg-white rounded-2xl shadow-lg p-8 flex flex-col items-center text-center border border-gray-100 hover:shadow-2xl transition">
        <span className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#30345d]/10 mb-4">
          <svg className="w-8 h-8 text-[#30345d]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17 8a5 5 0 00-10 0v8a5 5 0 0010 0V8z"/><path strokeLinecap="round" strokeLinejoin="round" d="M12 12v4"/></svg>
        </span>
        <span className="font-extrabold text-[#30345d] text-lg mb-2">Accompagnement complet</span>
        <span className="text-[#30345d]">Du premier contact jusqu'au suivi post-achat : fiscalité, travaux, valorisation. Une équipe dédiée à vos côtés à chaque étape.</span>
      </li>
      <li className="bg-white rounded-2xl shadow-lg p-8 flex flex-col items-center text-center border border-gray-100 hover:shadow-2xl transition">
        <span className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#30345d]/10 mb-4">
          <svg className="w-8 h-8 text-[#30345d]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 19V7a2 2 0 012-2h8a2 2 0 012 2v12"/><path strokeLinecap="round" strokeLinejoin="round" d="M9 21h6"/></svg>
        </span>
        <span className="font-extrabold text-[#30345d] text-lg mb-2">Représentation aux enchères</span>
        <span className="text-[#30345d]">Représentation sur place ou à distance par nos experts. Nous défendons vos intérêts et gérons les enchères avec stratégie et sang-froid.</span>
      </li>
    </ul>
  </section>
  

      {/* SECTION ENCHERES EN COURS */}
  <section id="enchere" className="w-full flex flex-col items-center justify-center px-2 md:px-6 mb-20 bg-secondary rounded-3xl">
        <h3 className="text-3xl font-bold text-blue-900 mb-10 text-center">Enchères en cours</h3>
  <div className="flex flex-col md:flex-row gap-4 mb-10 flex-wrap justify-center items-center w-full max-w-2xl mx-auto animate-fade-in">
          <input
            type="text"
            placeholder="Recherche..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="border border-blue-100 bg-white text-blue-900 placeholder-blue-400 px-4 py-2 rounded-full shadow focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg w-full md:w-72"
          />
          <select value={ville} onChange={e => setVille(e.target.value)} className="border border-blue-100 bg-white text-blue-900 px-4 py-2 rounded-full shadow text-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-full md:w-72">
            <option value="">Toutes les villes</option>
            {villes.map(v => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
          <input
            type="number"
            placeholder="Prix min (€)"
            value={minPrix}
            onChange={e => setMinPrix(e.target.value)}
            className="border border-blue-100 bg-white text-blue-900 placeholder-blue-400 px-4 py-2 rounded-full shadow focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg w-full md:w-36"
            min="0"
          />
          <input
            type="number"
            placeholder="Prix max (€)"
            value={maxPrix}
            onChange={e => setMaxPrix(e.target.value)}
            className="border border-blue-100 bg-white text-blue-900 placeholder-blue-400 px-4 py-2 rounded-full shadow focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg w-full md:w-36"
            min="0"
          />
          <button
            type="button"
            onClick={() => setShowFavsOnly(v => !v)}
            aria-pressed={showFavsOnly}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-full font-bold shadow border transition-colors text-lg w-full md:w-auto justify-center ${showFavsOnly ? 'bg-rose-500 text-white border-rose-500' : 'bg-white text-rose-600 border-rose-200'}`}
            title="Afficher uniquement mes favoris"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill={showFavsOnly ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 10-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 000-7.78z"/></svg>
            Mes favoris
          </button>
        </div>
        {filtered.length === 0 && <p className="mt-4 text-gray-500 text-center">Aucune enchère trouvée.</p>}
  <div className="flex flex-col items-center justify-center gap-6 md:gap-10 w-full max-w-4xl mx-auto px-2 md:px-0 bg-secondary/80 rounded-3xl">
    {paginated.map((a, i) => {
    const globalIndex = (page - 1) * perPage + i;
      const isNew = a.date_vente && new Date(a.date_vente) > new Date();
      return (
        <div
  key={a.id ?? globalIndex}
  className="flex flex-col md:flex-row items-stretch bg-white md:bg-secondary/30 backdrop-blur-2xl border border-blue-100 shadow-card hover:shadow-lg hover:scale-[1.02] md:hover:scale-[1.03] transition-all duration-300 rounded-3xl overflow-hidden relative group w-full max-w-4xl mx-auto animate-fade-in focus-within:ring-2 focus-within:ring-blue-500"
  style={{ animationDelay: `${i * 80}ms` }}
>
          <div className="w-full h-48 md:w-56 md:h-auto flex-shrink-0 bg-gradient-to-br from-secondary/60 via-white/40 to-orange-100/40 flex items-center justify-center relative transition-all duration-300 rounded-t-3xl md:rounded-l-3xl md:rounded-tr-none overflow-hidden">
            {a.photo ? (
              <img src={a.photo.replace(/\\/g, "/")} alt="photo" className="w-full h-full object-cover group-hover:brightness-110 group-hover:scale-105 transition-transform duration-300 rounded-t-3xl md:rounded-none md:rounded-l-3xl shadow-lg" />
            ) : ( (() => {
                const lat = Number(a.latitude);
                const lon = Number(a.longitude);
                const hasCoords = !isNaN(lat) && !isNaN(lon);
                const heading = a.heading ?? 0;
                const pitch = a.pitch ?? 0;
                const fov = a.fov ?? 80;
                if (hasCoords) {
                  const latStr = lat.toFixed(6);
                  const lonStr = lon.toFixed(6);
                  const src = `/api/streetview?location=${latStr},${lonStr}&heading=${heading}&pitch=${pitch}&fov=${fov}&size=640x360`;
                  return (
                    <img src={src} alt={`Street View ${a.ville}`} className="w-full h-full object-cover group-hover:brightness-110 group-hover:scale-105 transition-transform duration-300 rounded-t-3xl md:rounded-none md:rounded-l-3xl shadow-lg" />
                  );
                }
                return <span className="text-gray-400 text-lg font-medium">Pas de photo</span>;
              })() )}
            <span className="absolute top-4 left-4 bg-accent-500 text-white font-bold px-4 py-2 rounded shadow text-base drop-shadow-lg">Enchère</span>
            <button
              onClick={() => toggleFav(a.id)}
              aria-label={favorites.includes(a.id ?? -1) ? 'Retirer des favoris' : 'Ajouter aux favoris'}
              className={`absolute top-4 right-4 inline-flex items-center justify-center w-9 h-9 rounded-full border ${favorites.includes(a.id ?? -1) ? 'bg-rose-500 text-white border-rose-500' : 'bg-white/90 text-rose-600 border-rose-200'} shadow`}
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill={favorites.includes(a.id ?? -1) ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 10-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 000-7.78z"/></svg>
            </button>
            {isNew && (
              <span className="absolute top-4 right-4 bg-blue-600 text-white font-bold px-3 py-1 rounded-full shadow text-xs animate-pulse">Nouveau</span>
            )}
            <span className="absolute bottom-0 left-0 w-full h-8 bg-gradient-to-t from-secondary/60 to-transparent pointer-events-none" />
          </div>
          <div className="flex-1 px-4 py-4 md:px-8 md:py-6 flex flex-col justify-between items-start">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6 mb-2 w-full">
              <span className="text-2xl font-extrabold text-blue-900 flex items-center gap-2">
                <svg className="w-6 h-6 text-orange-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M9 21h6M12 17v4M12 3v7" /></svg>
                {a.ville}
              </span>
              <span className="text-xl font-bold text-orange-600 bg-orange-100 px-4 py-2 rounded shadow flex items-center gap-2 w-fit">
                <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 1.343-3 3s1.343 3 3 3 3-1.343 3-3-1.343-3-3-3zm0 10c-4.418 0-8-3.582-8-8s3.582-8 8-8 8 3.582 8 8-3.582 8-8 8z" /></svg>
                {formatPrix(a.mise_a_prix)}
              </span>
            </div>
            <div className="font-semibold text-[#30345d] text-lg leading-tight mb-1 line-clamp-2">{a.description}</div>
            <div className="text-gray-700 text-base whitespace-pre-line leading-snug mb-1 line-clamp-3">{a.FirstSousLot || a.texte}</div>
            <div className="text-gray-700 text-base mb-1"><b>Adresse :</b> {a.adresse}</div>
            <div className="flex gap-6 text-sm text-gray-600 mt-2">
              {a.date_visite && (
                <span>
                  <svg className="w-4 h-4 inline mr-1 text-blue-900" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                  <b>Visite :</b> {formatVisiteHome(a.date_visite)}
                </span>
              )}
              {a.date_vente && <span><svg className="w-4 h-4 inline mr-1 text-orange-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a5 5 0 00-10 0v2a2 2 0 00-2 2v7a2 2 0 002 2h10a2 2 0 002-2v-7a2 2 0 00-2-2z" /></svg> <b>Vente :</b> {a.date_vente}</span>}
            </div>
            <div className="flex items-center gap-3 w-full justify-end md:justify-end mt-4 md:mt-6 relative z-10">
              {a.id !== undefined ? (
                <Link href={`/annonce/${a.id}`} className="w-full md:w-auto bg-gradient-to-r from-orange-500 via-yellow-400 to-orange-400 text-white font-bold px-6 md:px-7 py-3 rounded-full shadow-lg hover:scale-105 hover:shadow-xl transition text-lg border-2 border-orange-300 text-center">
                  Voir
                </Link>
              ) : (
                <a href="#enchere" className="w-full md:w-auto bg-gradient-to-r from-orange-500 via-yellow-400 to-orange-400 text-white font-bold px-6 md:px-7 py-3 rounded-full shadow-lg hover:scale-105 hover:shadow-xl transition text-lg border-2 border-orange-300 text-center">Voir</a>
              )}
            </div>
          </div>
        </div>
      );
    })}
  </div>
  {/* Pagination */}
  {totalPages > 1 && (
    <div className="flex justify-center items-center gap-4 mt-8">
      <button
  className="px-5 py-2 rounded-full bg-blue-100 text-blue-900 font-bold shadow disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
        onClick={() => setPage(p => Math.max(1, p - 1))}
        disabled={page === 1}
      >Précédent</button>
  <span className="font-semibold text-blue-900">Page {page} / {totalPages}</span>
      <button
  className="px-5 py-2 rounded-full bg-blue-100 text-blue-900 font-bold shadow disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
        disabled={page === totalPages}
      >Suivant</button>
    </div>
  )}
  {/* Bloc récapitulatif de sélection retiré */}
      </section>

      {/* SERVICES + HOW IT WORKS (clair) */}
      <section id="avantages" className="w-full py-14 md:py-16">
        <div className="max-w-6xl mx-auto px-4 md:px-8 grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Services inclus */}
      <div className="bg-white rounded-2xl border border-blue-100 shadow-xl p-6 md:p-8 animate-fade-in">
            <h3 className="text-2xl md:text-3xl font-extrabold tracking-tight text-blue-900 mb-6">Services Inclus</h3>
            <ul className="space-y-4 md:space-y-5">
              {[
                "Analyse juridique complète du dossier",
                "Estimation détaillée du bien",
                "Stratégie d'enchères personnalisée",
                "Présence à vos côtés le jour J",
                "Accompagnement post-vente",
                "Conseils fiscaux et patrimoniaux",
              ].map((item, idx) => (
        <li key={idx} className="flex items-start gap-3 animate-fade-in" style={{ animationDelay: `${idx * 90}ms` }}>
                  <span className="mt-0.5 inline-flex items-center justify-center w-7 h-7 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </span>
                  <span className="text-base md:text-lg text-gray-800">{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Comment ça marche */}
      <div className="bg-white rounded-2xl border border-blue-100 shadow-xl p-6 md:p-8 animate-fade-in">
            <h3 className="text-2xl md:text-3xl font-extrabold tracking-tight text-blue-900 mb-6">Comment ça marche&nbsp;?</h3>
            <ol className="space-y-5">
        <li className="flex items-start gap-4 animate-fade-in" style={{ animationDelay: '0ms' }}>
                <span className="mt-0.5 inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-50 text-blue-700 font-bold border border-blue-200">1</span>
                <div>
                  <div className="text-lg font-semibold text-blue-900">Consultation gratuite</div>
                  <p className="text-gray-600 text-sm md:text-base">Nous analysons votre projet sans engagement</p>
                </div>
              </li>
        <li className="flex items-start gap-4 animate-fade-in" style={{ animationDelay: '100ms' }}>
                <span className="mt-0.5 inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-50 text-blue-700 font-bold border border-blue-200">2</span>
                <div>
                  <div className="text-lg font-semibold text-blue-900">Accompagnement complet</div>
                  <p className="text-gray-600 text-sm md:text-base">Nous vous guidons jusqu&rsquo;à la vente aux enchères</p>
                </div>
              </li>
        <li className="flex items-start gap-4 animate-fade-in" style={{ animationDelay: '200ms' }}>
                <span className="mt-0.5 inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-50 text-blue-700 font-bold border border-blue-200">3</span>
                <div>
                  <div className="text-lg font-semibold text-blue-900">Paiement au succès</div>
                  <p className="text-gray-600 text-sm md:text-base">Vous ne payez que si vous remportez l&rsquo;enchère</p>
                </div>
              </li>
            </ol>
          </div>
        </div>
      </section>

      

      {/* FOOTER */}
      <footer id="contact" className="w-full mt-auto bg-gradient-to-br from-blue-900 via-blue-900 to-blue-800 text-white">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="h-px w-full bg-white/10 mb-6" />
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-3 mb-2 md:mb-0">
              <img src="/logo.svg" alt="Logo" className="h-20 w-auto object-contain drop-shadow" />
            </div>
            <div className="flex gap-6 text-sm text-white/90">
              <a href="#enchere" className="hover:text-yellow-400 transition-colors">Enchères</a>
              <a href="#avantages" className="hover:text-yellow-400 transition-colors">Pourquoi nous ?</a>
              <a href="mailto:contact@immo-encheres.fr" className="hover:text-yellow-400 transition-colors">contact@immo-encheres.fr</a>
            </div>
            <div className="text-sm text-white/70">© {new Date().getFullYear()} Immo-enchères. Tous droits réservés.</div>
          </div>
        </div>
      </footer>
    </main>
  );
}

function removeAccents(str: string) {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}
// La fonction parseCSV n'est plus utilisée, on charge directement le JSON

