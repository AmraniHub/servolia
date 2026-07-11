"use client";

import { useState } from "react";
import FrenchNav from "@/components/FrenchNav";
import FrenchFooter from "@/components/FrenchFooter";
import { Mail, Clock, Shield, CheckCircle, ArrowRight, Zap } from "lucide-react";

const plans = ["Pas encore sûr — audit d'abord", "Système Site Web (290 €)", "Système Réservation (590 €)", "Système Client (990 €)", "Sur mesure / Option"];
const industries = ["Cabinet dentaire", "Clinique esthétique / Med spa", "Immobilier", "Services à domicile (CVC, toiture…)", "Restaurant / Alimentation", "Juridique / Comptabilité", "Autre"];

export default function FrenchContactPage() {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", business: "", industry: "", plan: "", website: "", problem: "" });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(false);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, type: "contact", language: "French" }),
      });
      if (!res.ok) throw new Error("contact API failed");
      setSubmitted(true);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const inputCls = "w-full px-3.5 py-2.5 rounded-lg border border-[#E8E6E0] text-sm text-[#080E1C] focus:outline-none focus:border-[#36671E] focus:ring-2 focus:ring-[#36671E]/20 transition-all";

  return (
    <main className="flex flex-col bg-white">
      <FrenchNav enHref="/contact" />

      <section className="bg-[#FAFAF7] pt-28 pb-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-sm font-bold text-[#36671E] uppercase tracking-widest mb-3">Démarrer</p>
          <h1 className="text-4xl sm:text-5xl font-black text-[#18181B] mb-4">
            Recevez votre{" "}
            <span className="gradient-text">audit gratuit</span>
          </h1>
          <p className="text-[#52525B] text-lg max-w-2xl mx-auto">
            Parlez-nous de votre activité. Nous analysons votre présence en ligne et vous envoyons un rapport montrant exactement ce qui vous coûte des clients — sous 24 heures.
          </p>
        </div>
      </section>

      <section className="py-16 lg:py-20 bg-[#FAFAF7]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
            {/* Sidebar */}
            <div className="lg:col-span-1">
              <div className="sticky top-24">
                <h2 className="text-xl font-black text-[#080E1C] mb-5">La suite des événements</h2>
                <div className="flex flex-col gap-5">
                  {[
                    { icon: <Mail className="w-4 h-4 text-[#36671E]" />, title: "Vous envoyez ce formulaire", desc: "5 minutes. Aucun paiement requis." },
                    { icon: <Clock className="w-4 h-4 text-[#36671E]" />, title: "Nous auditons votre activité", desc: "Sous 24 heures, nous envoyons un audit montrant vos points faibles et nos recommandations." },
                    { icon: <Zap className="w-4 h-4 text-[#059669]" />, title: "Appel optionnel de 15 min", desc: "Si vous le souhaitez, nous parcourons l'audit ensemble lors d'un court appel." },
                    { icon: <CheckCircle className="w-4 h-4 text-[#059669]" />, title: "Nous construisons votre système", desc: "Si vous êtes prêt, nous proposons une formule à prix fixe. Acompte via Stripe. Construction immédiate." },
                  ].map((s, i) => (
                    <div key={i} className="flex gap-3">
                      <div className="w-8 h-8 rounded-lg bg-white border border-[#E8E6E0] flex items-center justify-center flex-shrink-0 shadow-sm">{s.icon}</div>
                      <div>
                        <p className="font-bold text-[#080E1C] text-sm">{s.title}</p>
                        <p className="text-[#71717A] text-xs mt-0.5 leading-relaxed">{s.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-8 p-4 rounded-xl bg-white border border-[#E8E6E0]">
                  <div className="flex items-center gap-2 mb-3">
                    <Shield className="w-4 h-4 text-[#059669]" />
                    <span className="text-sm font-bold text-[#080E1C]">Nos garanties</span>
                  </div>
                  <ul className="flex flex-col gap-2">
                    {["Traitement conforme RGPD", "Pas de spam. Jamais.", "Audit gratuit, sans engagement", "Prix fixe avant de commencer", "Garantie de livraison en 7 jours"].map((g, i) => (
                      <li key={i} className="flex items-center gap-2 text-xs text-[#71717A]">
                        <CheckCircle className="w-3.5 h-3.5 text-[#059669] flex-shrink-0" />{g}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-4 p-4 rounded-xl border border-[#36671E]/20 bg-[#EEF5EA]/40">
                  <p className="text-sm font-bold text-[#36671E] mb-1">Vous préférez l&apos;email ?</p>
                  <a href="mailto:hello@servolia.com" className="text-sm text-[#52525B] hover:text-[#36671E] transition-colors">
                    hello@servolia.com
                  </a>
                </div>
              </div>
            </div>

            {/* Form */}
            <div className="lg:col-span-2">
              {submitted ? (
                <div className="bg-white rounded-2xl border border-[#059669]/30 p-10 text-center shadow-sm">
                  <div className="w-16 h-16 rounded-full bg-[#EEF5EA] flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="w-8 h-8 text-[#36671E]" />
                  </div>
                  <h2 className="text-2xl font-black text-[#080E1C] mb-3">Demande bien reçue !</h2>
                  <p className="text-[#71717A] mb-6 leading-relaxed">
                    Votre audit gratuit est en préparation. Vous recevrez un rapport détaillé à <strong>{form.email}</strong> sous 24 heures.
                  </p>
                  <div className="p-4 rounded-xl bg-[#FAFAF7] border border-[#E8E6E0] text-sm text-[#71717A]">
                    <p className="font-semibold text-[#080E1C] mb-1">À quoi vous attendre :</p>
                    <ul className="flex flex-col gap-1 text-left">
                      <li className="flex items-center gap-2"><CheckCircle className="w-3.5 h-3.5 text-[#059669]" /> Audit envoyé sous 24h</li>
                      <li className="flex items-center gap-2"><CheckCircle className="w-3.5 h-3.5 text-[#059669]" /> Aucune pression, aucun spam</li>
                      <li className="flex items-center gap-2"><CheckCircle className="w-3.5 h-3.5 text-[#059669]" /> Répondez pour planifier un appel gratuit si vous le souhaitez</li>
                    </ul>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-[#E8E6E0] p-8 shadow-sm">
                  <h2 className="text-xl font-black text-[#080E1C] mb-6">Parlez-nous de votre activité</h2>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-5">
                    <div>
                      <label className="block text-xs font-bold text-[#374151] mb-1.5">Votre nom *</label>
                      <input name="name" required value={form.name} onChange={handleChange} className={inputCls} placeholder="Votre nom complet" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-[#374151] mb-1.5">Adresse email *</label>
                      <input name="email" type="email" required value={form.email} onChange={handleChange} className={inputCls} placeholder="vous@votreclinique.fr" />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-5">
                    <div>
                      <label className="block text-xs font-bold text-[#374151] mb-1.5">Nom de l&apos;entreprise *</label>
                      <input name="business" required value={form.business} onChange={handleChange} className={inputCls} placeholder="Cabinet Dentaire Martin" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-[#374151] mb-1.5">Secteur *</label>
                      <select name="industry" required value={form.industry} onChange={handleChange} className={`${inputCls} bg-white`}>
                        <option value="">Choisir un secteur</option>
                        {industries.map((ind) => <option key={ind} value={ind}>{ind}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="mb-5">
                    <label className="block text-xs font-bold text-[#374151] mb-1.5">URL de votre site actuel (si vous en avez un)</label>
                    <input name="website" value={form.website} onChange={handleChange} className={inputCls} placeholder="https://votresite.fr (ou laissez vide)" />
                  </div>

                  <div className="mb-5">
                    <label className="block text-xs font-bold text-[#374151] mb-1.5">Intéressé par</label>
                    <select name="plan" value={form.plan} onChange={handleChange} className={`${inputCls} bg-white`}>
                      <option value="">Choisir une formule</option>
                      {plans.map((p) => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>

                  <div className="mb-6">
                    <label className="block text-xs font-bold text-[#374151] mb-1.5">Quel est votre plus grand défi en ce moment ? *</label>
                    <textarea name="problem" required value={form.problem} onChange={handleChange} rows={4}
                      className={`${inputCls} resize-none`}
                      placeholder="ex. Pas de réservation en ligne, les clients ne nous trouvent pas sur Google, notre site fait daté..." />
                  </div>

                  {error && (
                    <div className="mb-4 p-4 rounded-xl bg-[#FEE2E2] border border-[#DC2626]/30 text-sm text-[#991B1B]">
                      Une erreur est survenue lors de l&apos;envoi. Réessayez, ou écrivez-nous à{" "}
                      <a href="mailto:hello@servolia.com" className="font-bold underline">hello@servolia.com</a>.
                    </div>
                  )}
                  <button type="submit" disabled={loading}
                    className="w-full py-4 rounded-xl bg-gradient-to-r from-[#36671E] to-[#295115] text-[#FAFAF7] font-black text-base hover:opacity-90 transition-opacity flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed">
                    {loading ? "Envoi…" : (<>Envoyer ma demande d&apos;audit gratuit <ArrowRight className="w-4 h-4" /></>)}
                  </button>

                  <p className="text-center text-xs text-[#52525B] mt-3">
                    En envoyant, vous acceptez notre <a href="/legal/privacy" className="underline hover:text-[#36671E]">politique de confidentialité</a>. Pas de spam. Désinscription à tout moment.
                  </p>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>

      <FrenchFooter />
    </main>
  );
}
