"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import HeroProduct from "@/components/HeroProduct";
import AIReceptionistDemo from "@/components/AIReceptionistDemo";
import ROICalculator from "@/components/ROICalculator";
import {
  Bot, CheckCircle, ArrowRight, Shield, Clock, Globe, Lock,
  XCircle, ChevronDown, BadgeCheck,
} from "lucide-react";
import Logomark from "@/components/Logomark";

function FadeUp({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1], delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

const NAV = [
  { label: "Solutions", href: "/solutions" },
  { label: "Tarifs", href: "/pricing" },
  { label: "Cas clients", href: "/case-studies" },
  { label: "Blog", href: "/blog" },
];

const SYSTEMS = [
  { name: "Système Site Web", price: "Dès 490 €", delay: "3 jours", desc: "Un site professionnel conçu pour convertir vos visiteurs en demandes — mobile-first, conforme RGPD, en ligne en 72 h.", accent: false },
  { name: "Système Réservation", price: "990 €", delay: "5 jours", desc: "Réceptionniste IA + site + suivi complet. Prend les rendez-vous, capture les leads, répond aux questions 24h/24.", accent: true },
  { name: "Système Client", price: "Dès 1 900 €", delay: "7 jours", desc: "Système IA complet — site, chatbot, tableau de bord, pipeline de leads, automatisations et rapports mensuels.", accent: false },
];

const FAQS = [
  { q: "En combien de temps livrez-vous vraiment ?", a: "3 à 7 jours ouvrés selon la formule. Le délai démarre dès la réception de votre formulaire et de l'acompte. Notre contrat garantit 10 % de remboursement par jour de retard." },
  { q: "Dois-je rédiger mon propre contenu ?", a: "Non. Vous remplissez un formulaire de 10 minutes. Nous rédigeons tout — titres, textes, descriptions de services, pages RGPD. Vous validez avant la mise en ligne." },
  { q: "Puis-je payer en plusieurs fois ?", a: "Oui — 50 % d'acompte via Stripe pour démarrer, 50 % à la livraison. Les abonnements mensuels sont sans engagement, résiliables à tout moment avec 30 jours de préavis." },
  { q: "Travaillez-vous en français ?", a: "Oui. Nous servons des clients en France, Belgique, Suisse, Monaco et aux États-Unis. Toute la communication, les textes et les pages légales peuvent être en français." },
];

export default function FrenchHome() {
  const [faqOpen, setFaqOpen] = useState<number | null>(null);

  return (
    <main className="flex flex-col bg-[#FAFAF7]">
      {/* NAV (French) */}
      <nav className="fixed top-0 inset-x-0 z-50 bg-[#FAFAF7]/85 backdrop-blur-xl border-b border-[#E8E6E0]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16 lg:h-18">
          <Link href="/fr" className="flex items-center gap-2 group">
            <div className="w-8 h-8 rounded-lg bg-[#36671E] flex items-center justify-center group-hover:bg-[#295115] transition-colors">
              <Logomark className="w-4 h-4 text-[#0CA6E9]" />
            </div>
            <span className="text-xl font-black tracking-tight text-[#18181B]">Serv<span className="gradient-text">olia</span></span>
          </Link>
          <div className="hidden md:flex items-center gap-7">
            {NAV.map((l) => (
              <Link key={l.label} href={l.href} className="text-sm font-medium text-[#52525B] hover:text-[#18181B] transition-colors">{l.label}</Link>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <Link href="/" className="text-xs font-bold text-[#52525B] hover:text-[#36671E] transition-colors border border-[#E8E6E0] rounded-lg px-2.5 py-1.5">EN</Link>
            <Link href="/free-audit" className="px-4 py-2 rounded-lg bg-[#36671E] text-[#FAFAF7] text-sm font-semibold hover:bg-[#295115] transition-colors shadow-soft">Audit gratuit →</Link>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section className="relative min-h-[92vh] flex items-center justify-center overflow-hidden bg-[#091C20] pt-20">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[600px] bg-[#36671E] opacity-60 rounded-full blur-[120px]" />
          <div className="absolute inset-0 grain opacity-30" />
        </div>
        <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[#0CA6E9]/40 bg-[#0CA6E9]/10 text-[#ABDF90] text-sm font-semibold mb-8"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#0CA6E9] animate-pulse-dot" />
            Systèmes d&apos;acquisition client par IA · France, Belgique & Suisse
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 32 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
            className="text-5xl sm:text-6xl lg:text-7xl xl:text-8xl font-black text-[#FAFAF7] leading-[1.02] tracking-tight mb-7"
          >
            Transformez votre site en{" "}
            <span className="bg-gradient-to-r from-[#0CA6E9] via-[#ABDF90] to-[#0CA6E9] bg-clip-text text-transparent">
              machine à clients 24h/24.
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.65, delay: 0.25 }}
            className="text-[#ABDF90]/80 text-lg sm:text-xl max-w-2xl mx-auto mb-3 leading-relaxed"
          >
            Servolia crée des sites IA, des systèmes de réservation et des tunnels de leads pour dentistes, cliniques, agents immobiliers et entreprises de services en Europe.
          </motion.p>
          <motion.p
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.35 }}
            className="text-[#FAFAF7]/50 text-sm font-medium mb-10 tracking-wide"
          >
            Périmètre fixe · Prix fixe · Livré en 7 jours
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.45 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12"
          >
            <Link href="/free-audit" className="group px-8 py-4 rounded-xl bg-[#0CA6E9] text-[#091C20] font-black text-base hover:bg-[#ABDF90] transition-colors shadow-lg shadow-[#0CA6E9]/20 flex items-center gap-2">
              Réserver un audit gratuit <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
            <a href="#demo-ia" className="px-7 py-4 rounded-xl border border-[#FAFAF7]/20 text-[#FAFAF7] font-semibold text-base hover:bg-[#FAFAF7]/8 transition-colors flex items-center gap-2">
              <Bot className="w-4 h-4 opacity-60" /> Voir la démo
            </a>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5, delay: 0.6 }}
            className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm"
          >
            <div className="flex items-center gap-1.5 text-[#FAFAF7]/70"><Clock className="w-4 h-4 text-[#0CA6E9]" /><span className="font-medium">Livré en 7 jours, ou 10 % remboursé par jour de retard</span></div>
            <div className="flex items-center gap-1.5 text-[#FAFAF7]/70"><Lock className="w-4 h-4 text-[#0CA6E9]" /><span className="font-medium">Prix fixe, défini par écrit</span></div>
          </motion.div>

          <div className="mt-16"><HeroProduct /></div>
        </div>
        <div className="absolute bottom-0 inset-x-0 h-24 bg-gradient-to-t from-[#FAFAF7] to-transparent pointer-events-none" />
      </section>

      {/* TRUST BAR */}
      <section className="bg-white border-y border-[#E8E6E0] py-5">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center justify-center gap-8 lg:gap-12">
            {[
              { icon: <Shield className="w-4 h-4 text-[#059669]" />, text: "Conforme RGPD" },
              { icon: <Clock className="w-4 h-4 text-[#36671E]" />, text: "Garantie 7 jours" },
              { icon: <Globe className="w-4 h-4 text-[#36671E]" />, text: "Français & Anglais" },
              { icon: <Lock className="w-4 h-4 text-[#059669]" />, text: "Prix fixe par écrit" },
              { icon: <BadgeCheck className="w-4 h-4 text-[#36671E]" />, text: "Livraison garantie" },
            ].map((t, i) => (
              <div key={i} className="flex items-center gap-2 text-[#52525B] text-sm font-medium">{t.icon}<span>{t.text}</span></div>
            ))}
          </div>
        </div>
      </section>

      {/* AI DEMO (French) */}
      <section id="demo-ia" className="py-20 lg:py-28 bg-[#FAFAF7] scroll-mt-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <FadeUp>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#EEF5EA] text-[#36671E] text-xs font-black uppercase tracking-widest mb-5">
                <Bot className="w-3.5 h-3.5" /> Démo en direct
              </div>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-[#18181B] mb-5 leading-tight">
                Essayez la réceptionniste IA{" "}
                <span className="bg-gradient-to-r from-[#36671E] to-[#0CA6E9] bg-clip-text text-transparent">qui parlera à vos clients.</span>
              </h2>
              <p className="text-[#52525B] text-base leading-relaxed mb-6">
                C&apos;est la même IA qui répond à vos visiteurs 24h/24 — les qualifie, répond dans leur langue, prend le rendez-vous et enregistre le lead dans votre CRM. Plus d&apos;appels manqués. Plus de messageries à 20h. Plus de clients perdus.
              </p>
              <ul className="space-y-3 mb-8">
                {[
                  "Répond instantanément, jour et nuit, en français ou anglais",
                  "Prend les rendez-vous directement dans votre agenda",
                  "Chaque conversation enregistrée comme lead scoré dans le CRM",
                  "Entraînée sur vos services, prix et conditions",
                ].map((f, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-[#18181B]"><CheckCircle className="w-4 h-4 text-[#36671E] mt-0.5 shrink-0" /> {f}</li>
                ))}
              </ul>
              <Link href="/free-audit" className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl bg-[#36671E] text-[#FAFAF7] font-bold text-sm hover:bg-[#295115] transition-colors">
                L&apos;installer sur votre site <ArrowRight className="w-4 h-4" />
              </Link>
            </FadeUp>
            <FadeUp delay={0.15}><AIReceptionistDemo lang="fr" /></FadeUp>
          </div>
        </div>
      </section>

      {/* PROBLEM / SOLUTION */}
      <section className="py-20 lg:py-28 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeUp className="text-center mb-14">
            <p className="text-xs font-black text-[#DC2626] uppercase tracking-widest mb-3">Le problème</p>
            <h2 className="text-3xl sm:text-4xl font-black text-[#18181B] mb-3">
              La plupart des entreprises de services{" "}
              <span className="bg-gradient-to-r from-[#EF4444] to-[#F97316] bg-clip-text text-transparent">perdent des clients chaque jour.</span>
            </h2>
          </FadeUp>
          <div className="grid lg:grid-cols-2 gap-5">
            <FadeUp delay={0.1}>
              <div className="bg-[#FAFAF7] rounded-2xl p-7 border border-red-100 h-full">
                <div className="flex items-center gap-2 mb-6">
                  <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center"><XCircle className="w-4 h-4 text-red-500" /></div>
                  <p className="text-xs font-black text-red-500 uppercase tracking-widest">Sans système</p>
                </div>
                <ul className="space-y-4">
                  {[
                    "Un client appelle à 20h. Pas de réponse. Il réserve chez le concurrent.",
                    "Votre site reçoit des visiteurs. Zéro lead capturé, zéro relance.",
                    "Vous dépensez 500 €/mois en pub. Aucune idée de ce qui marche.",
                    "Des prospects vous contactent. Jamais relancés. Perdus.",
                  ].map((t, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm text-[#52525B]">
                      <div className="w-4 h-4 rounded-full bg-red-100 flex items-center justify-center mt-0.5 shrink-0"><div className="w-1.5 h-1.5 rounded-full bg-red-400" /></div>{t}
                    </li>
                  ))}
                </ul>
              </div>
            </FadeUp>
            <FadeUp delay={0.2}>
              <div className="bg-[#FAFAF7] rounded-2xl p-7 border border-[#D6E2CF] h-full">
                <div className="flex items-center gap-2 mb-6">
                  <div className="w-8 h-8 rounded-lg bg-[#EEF5EA] flex items-center justify-center"><CheckCircle className="w-4 h-4 text-[#36671E]" /></div>
                  <p className="text-xs font-black text-[#36671E] uppercase tracking-widest">Avec Servolia</p>
                </div>
                <ul className="space-y-4">
                  {[
                    "Un client écrit à 2h du matin. L'IA répond. Rendez-vous pris.",
                    "Un visiteur arrive. Lead capturé, e-mail envoyé en quelques secondes.",
                    "Vous lancez des pubs. Suivi complet : source, coût, ROI par campagne.",
                    "Le prospect ne réserve pas tout de suite. Relance automatique à 48h.",
                  ].map((t, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm text-[#52525B]">
                      <div className="w-4 h-4 rounded-full bg-[#EEF5EA] flex items-center justify-center mt-0.5 shrink-0"><div className="w-1.5 h-1.5 rounded-full bg-[#36671E]" /></div>{t}
                    </li>
                  ))}
                </ul>
              </div>
            </FadeUp>
          </div>
        </div>
      </section>

      {/* SYSTEMS */}
      <section className="py-20 lg:py-28 bg-[#FAFAF7]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeUp className="text-center mb-14">
            <p className="text-xs font-black text-[#36671E] uppercase tracking-widest mb-3">Nos systèmes</p>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-[#18181B] mb-4">
              Nous ne vendons pas des sites.{" "}
              <span className="bg-gradient-to-r from-[#36671E] to-[#0CA6E9] bg-clip-text text-transparent">Nous vendons des systèmes clients IA.</span>
            </h2>
          </FadeUp>
          <div className="grid md:grid-cols-3 gap-5">
            {SYSTEMS.map((s, i) => (
              <FadeUp key={i} delay={i * 0.1}>
                <div className={`relative rounded-2xl p-7 border-2 h-full flex flex-col ${s.accent ? "bg-white border-[#36671E]/40" : "bg-white border-[#E8E6E0]"}`}>
                  {s.accent && <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-[#36671E] text-[#FAFAF7] text-[10px] font-black uppercase tracking-widest whitespace-nowrap">Le plus choisi</span>}
                  <h3 className="text-xl font-black text-[#18181B] mb-2">{s.name}</h3>
                  <p className="text-[#71717A] text-sm leading-relaxed mb-5 flex-1">{s.desc}</p>
                  <div className="flex items-center justify-between pt-5 border-t border-[#E8E6E0]">
                    <div><span className="text-2xl font-black text-[#18181B]">{s.price}</span><span className="text-xs text-[#71717A] ml-2">· {s.delay}</span></div>
                  </div>
                </div>
              </FadeUp>
            ))}
          </div>
          <FadeUp delay={0.3} className="text-center mt-10">
            <Link href="/pricing" className="inline-flex items-center gap-1.5 text-[#36671E] font-bold text-sm hover:underline">Voir tous les tarifs <ArrowRight className="w-4 h-4" /></Link>
          </FadeUp>
        </div>
      </section>

      {/* ROI CALCULATOR (French) */}
      <section className="py-20 lg:py-28 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeUp className="text-center mb-12">
            <p className="text-xs font-black text-[#36671E] uppercase tracking-widest mb-3">Combien ça vaut ?</p>
            <h2 className="text-3xl sm:text-4xl font-black text-[#18181B] mb-3">
              Voyez ce que les demandes manquées{" "}
              <span className="bg-gradient-to-r from-[#36671E] to-[#0CA6E9] bg-clip-text text-transparent">vous coûtent.</span>
            </h2>
            <p className="text-[#71717A] max-w-lg mx-auto text-sm">Déplacez les curseurs pour estimer les revenus qu&apos;un système IA 24h/24 pourrait récupérer.</p>
          </FadeUp>
          <FadeUp delay={0.1}><ROICalculator lang="fr" /></FadeUp>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 bg-[#FAFAF7]">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeUp className="text-center mb-12">
            <p className="text-xs font-black text-[#36671E] uppercase tracking-widest mb-3">FAQ</p>
            <h2 className="text-3xl font-black text-[#18181B]">Questions fréquentes</h2>
          </FadeUp>
          <div className="space-y-3">
            {FAQS.map((f, i) => (
              <FadeUp key={i} delay={i * 0.05}>
                <div className="bg-white border border-[#E8E6E0] rounded-xl overflow-hidden">
                  <button onClick={() => setFaqOpen(faqOpen === i ? null : i)} className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-[#FAFAF7] transition-colors">
                    <span className="font-bold text-[#18181B] text-sm">{f.q}</span>
                    <ChevronDown className={`w-4 h-4 text-[#71717A] shrink-0 transition-transform duration-200 ${faqOpen === i ? "rotate-180" : ""}`} />
                  </button>
                  <motion.div initial={false} animate={{ height: faqOpen === i ? "auto" : 0, opacity: faqOpen === i ? 1 : 0 }} transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }} className="overflow-hidden">
                    <div className="px-6 pb-5 text-[#71717A] text-sm leading-relaxed border-t border-[#F5F4EF] pt-4">{f.a}</div>
                  </motion.div>
                </div>
              </FadeUp>
            ))}
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section id="audit" className="py-24 lg:py-32 bg-[#091C20] relative overflow-hidden scroll-mt-20">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-[#36671E] opacity-60 rounded-full blur-[100px]" />
          <div className="absolute inset-0 grain opacity-30" />
        </div>
        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <FadeUp>
            <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black text-[#FAFAF7] mb-6 leading-[1.05]">
              Arrêtez de perdre des clients{" "}
              <span className="bg-gradient-to-r from-[#0CA6E9] to-[#ABDF90] bg-clip-text text-transparent">au profit de mieux équipés.</span>
            </h2>
            <p className="text-[#FAFAF7]/60 text-lg mb-10 max-w-xl mx-auto leading-relaxed">
              L&apos;audit gratuit prend 5 minutes. Le système prend 7 jours. Les résultats durent des années.
            </p>
            <Link href="/free-audit" className="group inline-flex items-center gap-2 px-9 py-4 rounded-xl bg-[#0CA6E9] text-[#091C20] font-black text-lg hover:bg-[#ABDF90] transition-colors shadow-lg shadow-[#0CA6E9]/20">
              Obtenir mon audit gratuit <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
            <p className="text-[#FAFAF7]/40 text-xs mt-5">Livré sous 24h · Sans appel · Prix fixe par écrit</p>
          </FadeUp>
        </div>
      </section>

      {/* FOOTER (French, simplified) */}
      <footer className="bg-[#FAFAF7] border-t border-[#E8E6E0] py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#36671E] flex items-center justify-center"><Logomark className="w-4 h-4 text-[#0CA6E9]" /></div>
            <span className="text-lg font-black tracking-tight text-[#18181B]">Serv<span className="gradient-text">olia</span></span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm">
            {NAV.map((l) => <Link key={l.label} href={l.href} className="text-[#52525B] hover:text-[#18181B] transition-colors">{l.label}</Link>)}
            <Link href="/legal/privacy" className="text-[#52525B] hover:text-[#18181B] transition-colors">Confidentialité</Link>
            <Link href="/" className="text-[#36671E] font-bold">English →</Link>
          </div>
          <p className="text-[#A1A1AA] text-xs">© {new Date().getFullYear()} Servolia</p>
        </div>
      </footer>
    </main>
  );
}
