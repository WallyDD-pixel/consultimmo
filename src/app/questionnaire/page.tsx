"use client";
import React, { useState } from "react";
import Link from "next/link";

type Step = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export default function Questionnaire() {
  const [step, setStep] = useState<Step>(0);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    dejaAchete: "",
  dejaVisite: "",
  nom: "",
    avocat: "",
    budget: "",
    email: "",
    phone: "",
  });

  const next = () => setStep(s => (Math.min(6, (s + 1)) as Step));
  const prev = () => setStep(s => (Math.max(0, (s - 1)) as Step));

  const canNext = () => {
    if (step === 0) return form.dejaAchete === "oui" || form.dejaAchete === "non";
    if (step === 1) return form.dejaVisite === "oui" || form.dejaVisite === "non";
    if (step === 2) return form.nom.trim().length >= 2;
    if (step === 3) return form.avocat === "oui" || form.avocat === "non";
    if (step === 4) return /^\d{2,9}$/.test(form.budget.replace(/\s/g, ""));
    if (step === 5) {
      const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email);
      const phoneOk = /\+?[0-9 .-]{6,}/.test(form.phone);
      return emailOk && phoneOk;
    }
    return true;
  };

  const submit = async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          budget: Number(form.budget.replace(/\s/g, "")) || 0,
          createdAt: new Date().toISOString(),
          source: "questionnaire",
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setDone(true);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Une erreur est survenue.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const Stepper = () => (
    <div className="flex items-center justify-center gap-2 text-sm text-gray-600">
      {[0,1,2,3,4,5,6].map((i) => (
        <span key={i} className={`w-8 h-2 rounded-full ${i <= step ? 'bg-orange-500' : 'bg-gray-200'}`} />
      ))}
    </div>
  );

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col">
      <nav className="sticky top-0 left-0 w-full z-30 bg-white/80 backdrop-blur border-b border-blue-100 px-4 py-3 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 text-blue-900">
          <img src="/logo.svg" alt="Logo" className="h-8 w-8" />
          <span className="font-extrabold">ConsultImmo</span>
        </Link>
        <Link href="/" className="text-blue-900 font-semibold">Retour</Link>
      </nav>

      <section className="w-full max-w-2xl mx-auto px-4 py-8 md:py-12">
  <div className="bg-white rounded-2xl shadow-xl border border-blue-100 p-6 md:p-8 animate-fade-in">
          <h1 className="text-2xl md:text-3xl font-extrabold text-blue-900 mb-2">Nous contacter</h1>
          <p className="text-gray-600 mb-6">Quelques questions rapides pour mieux vous accompagner.</p>
          <Stepper />

          {!done ? (
            <div className="mt-6 animate-fade-in">
              {step === 0 && (
                <div className="space-y-4">
                  <div className="text-lg font-semibold text-blue-900">Avez-vous déjà acheté aux enchères ?</div>
                  <div className="flex gap-3">
                    <button onClick={() => setForm(f => ({...f, dejaAchete: 'oui'}))} className={`px-4 py-2 rounded-full border ${form.dejaAchete==='oui'?'bg-blue-600 text-white border-blue-600':'bg-white text-blue-900 border-blue-200'}`}>Oui</button>
                    <button onClick={() => setForm(f => ({...f, dejaAchete: 'non'}))} className={`px-4 py-2 rounded-full border ${form.dejaAchete==='non'?'bg-blue-600 text-white border-blue-600':'bg-white text-blue-900 border-blue-200'}`}>Non</button>
                  </div>
                </div>
              )}

              {step === 1 && (
                <div className="space-y-4">
                  <div className="text-lg font-semibold text-blue-900">Avez-vous déjà participé à la visite du bien ?</div>
                  <div className="flex gap-3">
                    <button onClick={() => setForm(f => ({...f, dejaVisite: 'oui'}))} className={`px-4 py-2 rounded-full border ${form.dejaVisite==='oui'?'bg-blue-600 text-white border-blue-600':'bg-white text-blue-900 border-blue-200'}`}>Oui</button>
                    <button onClick={() => setForm(f => ({...f, dejaVisite: 'non'}))} className={`px-4 py-2 rounded-full border ${form.dejaVisite==='non'?'bg-blue-600 text-white border-blue-600':'bg-white text-blue-900 border-blue-200'}`}>Non</button>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-4">
                  <div className="text-lg font-semibold text-blue-900">Votre nom</div>
                  <input type="text" value={form.nom} onChange={(e)=>setForm(f=>({...f, nom: e.target.value}))} className="w-full border border-blue-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white text-blue-900 placeholder-blue-400" placeholder="Dupont" />
                </div>
              )}

              {step === 3 && (
                <div className="space-y-4">
                  <div className="text-lg font-semibold text-blue-900">Avez-vous déjà un avocat attitré ?</div>
                  <div className="flex gap-3">
                    <button onClick={() => setForm(f => ({...f, avocat: 'oui'}))} className={`px-4 py-2 rounded-full border ${form.avocat==='oui'?'bg-blue-600 text-white border-blue-600':'bg-white text-blue-900 border-blue-200'}`}>Oui</button>
                    <button onClick={() => setForm(f => ({...f, avocat: 'non'}))} className={`px-4 py-2 rounded-full border ${form.avocat==='non'?'bg-blue-600 text-white border-blue-600':'bg-white text-blue-900 border-blue-200'}`}>Non</button>
                  </div>
                </div>
              )}

              {step === 4 && (
                <div className="space-y-4">
                  <div className="text-lg font-semibold text-blue-900">Quel est votre budget maximum ?</div>
                  <p className="text-gray-600 text-sm">Par exemple, le montant accordé par votre banque ou votre budget disponible.</p>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      inputMode="numeric"
                      placeholder="Ex: 250000"
                      value={form.budget}
                      onChange={(e) => setForm(f => ({...f, budget: e.target.value}))}
                      className="flex-1 border border-blue-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white text-blue-900 placeholder-blue-400"
                    />
                    <span className="text-gray-600">€</span>
                  </div>
                </div>
              )}

              {step === 5 && (
                <div className="space-y-4">
                  <div className="text-lg font-semibold text-blue-900">Vos coordonnées</div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Email</label>
                      <input type="email" value={form.email} onChange={(e)=>setForm(f=>({...f, email: e.target.value}))} className="w-full border border-blue-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white text-blue-900 placeholder-blue-400" placeholder="vous@exemple.com" />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Téléphone</label>
                      <input type="tel" value={form.phone} onChange={(e)=>setForm(f=>({...f, phone: e.target.value}))} className="w-full border border-blue-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white text-blue-900 placeholder-blue-400" placeholder="06 12 34 56 78" />
                    </div>
                  </div>
                </div>
              )}

      {step === 6 && (
                <div className="space-y-4">
                  <div className="text-lg font-semibold text-blue-900">Récapitulatif</div>
                  <ul className="text-gray-700 space-y-2">
                    <li>Déjà acheté aux enchères: <b>{form.dejaAchete || '—'}</b></li>
        <li>Participé à une visite: <b>{form.dejaVisite || '—'}</b></li>
        <li>Nom: <b>{form.nom || '—'}</b></li>
                    <li>Avocat attitré: <b>{form.avocat || '—'}</b></li>
                    <li>Budget max: <b>{form.budget ? Number(form.budget).toLocaleString('fr-FR') + ' €' : '—'}</b></li>
                    <li>Email: <b>{form.email || '—'}</b></li>
                    <li>Téléphone: <b>{form.phone || '—'}</b></li>
                  </ul>
                </div>
              )}

              {error && <div className="mt-4 text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-xl p-3">{error}</div>}

              <div className="mt-6 flex items-center justify-between">
                <button onClick={prev} disabled={step===0 || loading} className="px-4 py-2 rounded-full border border-blue-200 text-blue-900 bg-white disabled:opacity-50">Précédent</button>
                {step < 6 ? (
                  <button onClick={next} disabled={!canNext() || loading} className="px-5 py-2.5 rounded-full bg-gradient-to-r from-orange-500 to-yellow-400 text-white font-bold disabled:opacity-50">Suivant</button>
                ) : (
                  <button onClick={submit} disabled={!canNext() || loading} className="px-5 py-2.5 rounded-full bg-gradient-to-r from-orange-500 to-yellow-400 text-white font-bold disabled:opacity-50">
                    {loading ? 'Envoi…' : 'Demander à être contacté'}
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="mt-6 text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-100 text-emerald-600">
                <svg className="w-10 h-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
              </div>
              <h2 className="mt-4 text-2xl font-extrabold text-blue-900">Merci !</h2>
              <p className="text-gray-700 mt-2">Un conseiller vous contactera très vite.</p>
              <Link href="/" className="inline-block mt-6 px-5 py-2.5 rounded-full border border-blue-200 text-blue-900 bg-white">Retour à l’accueil</Link>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
