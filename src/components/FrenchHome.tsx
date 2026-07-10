"use client";

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import HeroProduct from "@/components/HeroProduct";
import AIReceptionistDemo from "@/components/AIReceptionistDemo";
import ROICalculator from "@/components/ROICalculator";
import StickyMobileCTA from "@/components/StickyMobileCTA";
import FrenchNav from "@/components/FrenchNav";
import FrenchFooter from "@/components/FrenchFooter";
import {
  Bot, BarChart3, Globe, CheckCircle, ArrowRight,
  Shield, Clock, TrendingUp, MessageSquare,
  Users, Building2, Sparkles, ChevronDown, Zap, XCircle,
  BadgeCheck, Lock, Calendar, LayoutDashboard, FileText, Phone,
} from "lucide-react";

/* ─── animation helpers (mirror of the EN homepage) ─────────────────────── */
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

function useCounter(target: number, duration = 1800, start = false) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!start) return;
    let t0: number;
    const raf = (ts: number) => {
      if (!t0) t0 = ts;
      const p = Math.min((ts - t0) / duration, 1);
      setCount(Math.floor((1 - Math.pow(1 - p, 3)) * target));
      if (p < 1) requestAnimationFrame(raf);
    };
    requestAnimationFrame(raf);
  }, [target, duration, start]);
  return count;
}

function useInView(threshold = 0.3) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) setInView(true); },
      { threshold }
    );
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, inView };
}

/* ─── page ──────────────────────────────────────────────────────────────── */
export default function FrenchHome() {
  const { ref: statsRef, inView: statsInView } = useInView(0.3);
  const [faqOpen, setFaqOpen] = useState<number | null>(null);

  const faqs = [
    { q: "En combien de temps livrez-vous vraiment ?", a: "3 à 7 jours ouvrés selon la formule. Le délai démarre dès la réception de votre formulaire et de l'acompte. Notre contrat garantit 10 % de remboursement par jour de retard — nous n'avons jamais manqué une échéance." },
    { q: "Dois-je rédiger mon propre contenu ?", a: "Non. Vous remplissez un formulaire de 10 minutes. Nous rédigeons tout — titres, textes, descriptions de services, pages RGPD. Vous validez avant toute mise en ligne." },
    { q: "Puis-je payer en plusieurs fois ?", a: "Oui — 50 % d'acompte via Stripe pour démarrer, 50 % à la livraison. Les abonnements mensuels sont prélevés automatiquement et résiliables à tout moment avec 30 jours de préavis." },
    { q: "Travaillez-vous en français ?", a: "Oui. Nous servons des clients en France, Belgique, Suisse, Monaco et aux États-Unis. Toute la communication, les textes et les pages légales peuvent être en français ou en anglais — au choix." },
    { q: "Et si j'ai déjà un site web ?", a: "Nous pouvons le reconstruire, ou ajouter des composants précis (chatbot IA, réservation, tracking) à votre site existant. Nous recommandons la bonne option dans votre audit gratuit." },
    { q: "Qu'est-ce qui vous différencie de Fiverr ou d'une agence locale ?", a: "Une agence locale facture 3 000 à 10 000 € et prend 6 à 12 semaines. Fiverr vous donne un freelance aléatoire sans garantie. Nous livrons un système IA à prix fixe en 7 jours, avec une garantie de livraison écrite et un accompagnement mensuel." },
  ];

  const systems = [
    {
      num: "01", icon: <Globe className="w-5 h-5" />,
      title: "Système Site Web IA", price: "Dès 490 €", delivery: "3 jours",
      desc: "Un site professionnel conçu pour convertir les visiteurs en demandes — mobile-first, conforme RGPD, en ligne en 72 heures.",
      features: ["5–10 pages orientées conversion", "Boutons réservation & contact", "Google Analytics 4", "Pages RGPD incluses"],
      accent: false,
    },
    {
      num: "02", icon: <Bot className="w-5 h-5" />,
      title: "Système de Réservation IA", price: "990 €", delivery: "5 jours",
      desc: "Réceptionniste IA + site + suivi complet. Prend les rendez-vous, capture les leads, répond aux questions 24h/24.",
      features: ["Tout le Système Site Web", "Chatbot réceptionniste IA", "Capture de leads + synchro CRM", "Pixel Meta + GA4"],
      accent: true,
    },
    {
      num: "03", icon: <BarChart3 className="w-5 h-5" />,
      title: "Système Landing Pub", price: "490 € + 200 €/mois", delivery: "4 jours",
      desc: "Page d'atterrissage à haute conversion avec tracking Meta + GA4 complet. Sachez exactement quelle pub génère du chiffre.",
      features: ["Page orientée conversion", "Pixel Meta + CAPI", "Suivi d'événements GA4", "Alertes leads instantanées"],
      accent: false,
    },
    {
      num: "04", icon: <Building2 className="w-5 h-5" />,
      title: "Système Client", price: "Dès 1 900 €", delivery: "7 jours",
      desc: "Système IA complet — site, chatbot, tableau de bord, pipeline de leads, automatisations et rapports mensuels.",
      features: ["Tout le Système Réservation", "Tableau de bord de gestion", "Pipeline de leads + historique", "Rapport analytique mensuel"],
      accent: false,
    },
  ];

  const carePlans = [
    { name: "Care", price: "69 €", sub: "/mois", desc: "Maintenance, modifications & disponibilité.", features: ["Surveillance de disponibilité", "Modifications de contenu (1h/mois)", "Mises à jour de sécurité", "Support par email"], popular: false },
    { name: "Growth", price: "149 €", sub: "/mois", desc: "Analytique, mises à jour du chatbot, améliorations mensuelles.", features: ["Tout Care", "Réentraînement du chatbot", "Rapport analytique mensuel", "2h d'améliorations/mois"], popular: true },
    { name: "Scale", price: "299 €", sub: "/mois", desc: "Optimisation et stratégie mensuelles complètes.", features: ["Tout Growth", "Améliorations A/B testées", "Évolutions CRM & workflows", "Appel stratégique mensuel"], popular: false },
  ];

  return (
    <main className="flex flex-col bg-[#FAFAF7]">
      {/* NAV (French, shared) */}
      <FrenchNav heroDark enHref="/" />

      {/* ══════════════════════════════════════════════════════════════
          HERO — dark forest with grain texture
      ══════════════════════════════════════════════════════════════ */}
      <section className="relative min-h-[92vh] flex items-center justify-center overflow-hidden bg-[#0A1F14] pt-20">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[600px] bg-[#36671E] opacity-60 rounded-full blur-[120px]" />
          <div className="absolute inset-0 grain opacity-30" />
        </div>

        <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[#BEF264]/40 bg-[#BEF264]/10 text-[#ABDF90] text-sm font-semibold mb-8"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#BEF264] animate-pulse-dot" />
            Systèmes d&apos;acquisition client par IA · France, Belgique & Suisse
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 32 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
            className="text-5xl sm:text-6xl lg:text-7xl xl:text-8xl font-black text-[#FAFAF7] leading-[1.02] tracking-tight mb-7"
          >
            Transformez votre site en{" "}
            <span className="bg-gradient-to-r from-[#BEF264] via-[#ABDF90] to-[#BEF264] bg-clip-text text-transparent">
              machine à clients 24h/24.
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.65, delay: 0.25 }}
            className="text-[#ABDF90]/80 text-lg sm:text-xl max-w-2xl mx-auto mb-3 leading-relaxed"
          >
            Servolia crée des sites IA, des systèmes de réservation et des tunnels de leads pour <a href="/fr/dentistes" className="underline decoration-[#BEF264]/50 underline-offset-2 hover:decoration-[#BEF264]">cabinets dentaires</a>, cliniques, agents immobiliers et entreprises de services en Europe.
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
            <Link href="/fr/audit" className="group px-8 py-4 rounded-xl bg-[#BEF264] text-[#0A1F14] font-black text-base hover:bg-[#D9F99D] transition-colors shadow-lg shadow-[#BEF264]/20 flex items-center gap-2">
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
            <div className="flex items-center gap-1.5 text-[#FAFAF7]/70"><Clock className="w-4 h-4 text-[#BEF264]" /><span className="font-medium">Livré en 7 jours, ou 10 % remboursés par jour de retard</span></div>
            <div className="flex items-center gap-1.5 text-[#FAFAF7]/70"><Lock className="w-4 h-4 text-[#BEF264]" /><span className="font-medium">Prix fixe, défini par écrit</span></div>
            <div className="flex items-center gap-1.5 text-[#FAFAF7]/70"><BadgeCheck className="w-4 h-4 text-[#BEF264]" /><span className="font-medium">Aucun paiement avant validation du périmètre</span></div>
          </motion.div>

          <div className="mt-16"><HeroProduct /></div>
        </div>
        <div className="absolute bottom-0 inset-x-0 h-24 bg-gradient-to-t from-[#FAFAF7] to-transparent pointer-events-none" />
      </section>

      {/* ══════════════════════════════════════════════════════════════
          TRUST BAR
      ══════════════════════════════════════════════════════════════ */}
      <section className="bg-white border-y border-[#E8E6E0] py-5">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center justify-center gap-8 lg:gap-12">
            {[
              { icon: <Shield className="w-4 h-4 text-[#059669]" />, text: "Conforme RGPD" },
              { icon: <div className="w-4 h-4 rounded bg-[#635bff] flex items-center justify-center"><span className="text-white text-[7px] font-black">S</span></div>, text: "Sécurisé par Stripe" },
              { icon: <Clock className="w-4 h-4 text-[#36671E]" />, text: "Garantie 7 jours" },
              { icon: <Globe className="w-4 h-4 text-[#36671E]" />, text: "Français & Anglais" },
              { icon: <Lock className="w-4 h-4 text-[#059669]" />, text: "Prix fixe par écrit" },
              { icon: <Users className="w-4 h-4 text-[#D97706]" />, text: "Livraison par le fondateur" },
            ].map((t, i) => (
              <div key={i} className="flex items-center gap-2 text-[#52525B] text-sm font-medium">{t.icon}<span>{t.text}</span></div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════
          TRY THE AI — interactive demo
      ══════════════════════════════════════════════════════════════ */}
      <section id="demo-ia" className="py-20 lg:py-28 bg-[#FAFAF7] scroll-mt-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <FadeUp>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#EEF5EA] text-[#36671E] text-xs font-black uppercase tracking-widest mb-5">
                <Bot className="w-3.5 h-3.5" /> Démo en direct
              </div>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-[#18181B] mb-5 leading-tight">
                Essayez la réceptionniste IA{" "}
                <span className="bg-gradient-to-r from-[#36671E] to-[#6B8439] bg-clip-text text-transparent">qui parlera à vos clients.</span>
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
              <Link href="/fr/audit" className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl bg-[#36671E] text-[#FAFAF7] font-bold text-sm hover:bg-[#295115] transition-colors">
                L&apos;installer sur votre site <ArrowRight className="w-4 h-4" />
              </Link>
            </FadeUp>
            <FadeUp delay={0.15}><AIReceptionistDemo lang="fr" /></FadeUp>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════
          JOURNEY FLOW
      ══════════════════════════════════════════════════════════════ */}
      <section className="py-20 lg:py-28 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeUp className="text-center mb-14">
            <p className="text-xs font-black text-[#36671E] uppercase tracking-widest mb-3">Comment le système fonctionne</p>
            <h2 className="text-3xl sm:text-4xl font-black text-[#18181B] mb-3">
              Servolia connecte{" "}
              <span className="bg-gradient-to-r from-[#36671E] to-[#6B8439] bg-clip-text text-transparent">
                tout le parcours client.
              </span>
            </h2>
            <p className="text-[#71717A] max-w-xl mx-auto text-sm">
              De la première visite au rendez-vous réservé et au rapport mensuel — tout est automatisé.
            </p>
          </FadeUp>

          <div className="relative grid grid-cols-2 lg:grid-cols-6 gap-3 lg:gap-0">
            <div className="hidden lg:block absolute top-9 left-[8.33%] right-[8.33%] h-px"
              style={{ background: "linear-gradient(to right, transparent, #E8E6E0 10%, #E8E6E0 90%, transparent)" }} />
            {[
              { icon: <Users className="w-5 h-5" />, label: "Visiteur", sub: "Arrive sur votre site", bg: "bg-[#F5F4EF]", fg: "text-[#52525B]" },
              { icon: <Globe className="w-5 h-5" />, label: "Site IA", sub: "Inspire confiance immédiatement", bg: "bg-[#EEF5EA]", fg: "text-[#36671E]" },
              { icon: <Bot className="w-5 h-5" />, label: "Réceptionniste IA", sub: "Répond 24h/24", bg: "bg-[#36671E]", fg: "text-[#FAFAF7]" },
              { icon: <Calendar className="w-5 h-5" />, label: "Réservation", sub: "Capturée automatiquement", bg: "bg-[#EEF5EA]", fg: "text-[#36671E]" },
              { icon: <LayoutDashboard className="w-5 h-5" />, label: "CRM", sub: "Lead suivi & géré", bg: "bg-[#EEF5EA]", fg: "text-[#36671E]" },
              { icon: <FileText className="w-5 h-5" />, label: "Rapport mensuel", sub: "ROI optimisé", bg: "bg-[#6B8439]", fg: "text-[#FAFAF7]" },
            ].map((step, i) => (
              <FadeUp key={i} delay={i * 0.07} className="flex flex-col items-center text-center px-2">
                <div className={`relative z-10 w-[72px] h-[72px] rounded-2xl ${step.bg} ${step.fg} flex items-center justify-center mb-3 shadow-soft`}>
                  {step.icon}
                </div>
                <p className="text-xs font-black text-[#18181B] mb-0.5 leading-tight">{step.label}</p>
                <p className="text-[10px] text-[#A1A1AA] leading-tight max-w-[80px]">{step.sub}</p>
              </FadeUp>
            ))}
          </div>

          <FadeUp delay={0.4} className="text-center mt-12">
            <Link href="/fr/contact" className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl bg-[#36671E] text-[#FAFAF7] font-bold text-sm hover:bg-[#295115] transition-colors">
              Obtenir un système comme ça pour votre activité <ArrowRight className="w-4 h-4" />
            </Link>
          </FadeUp>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════
          PROBLEM / SOLUTION
      ══════════════════════════════════════════════════════════════ */}
      <section className="py-20 lg:py-28 bg-[#FAFAF7]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeUp className="text-center mb-14">
            <p className="text-xs font-black text-[#DC2626] uppercase tracking-widest mb-3">Le problème</p>
            <h2 className="text-3xl sm:text-4xl font-black text-[#18181B] mb-3">
              La plupart des entreprises de services{" "}
              <span className="bg-gradient-to-r from-[#EF4444] to-[#F97316] bg-clip-text text-transparent">perdent des clients chaque jour.</span>
            </h2>
            <p className="text-[#71717A] max-w-xl mx-auto">Sans système, vous comptez sur la chance. Avec Servolia, votre site travaille pour vous 24h/24.</p>
          </FadeUp>

          <div className="grid lg:grid-cols-2 gap-5">
            <FadeUp delay={0.1}>
              <div className="bg-white rounded-2xl p-7 border border-red-100 h-full">
                <div className="flex items-center gap-2 mb-6">
                  <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center"><XCircle className="w-4 h-4 text-red-500" /></div>
                  <p className="text-xs font-black text-red-500 uppercase tracking-widest">Sans système</p>
                </div>
                <ul className="space-y-4">
                  {[
                    ["Un client appelle à 20h. Pas de réponse.", "Il réserve chez votre concurrent."],
                    ["Votre site reçoit des visiteurs.", "Zéro lead capturé. Zéro relance."],
                    ["Vous dépensez 500 €/mois en pub.", "Aucune idée de quelle pub fonctionne."],
                    ["Des prospects intéressés vous contactent.", "Jamais relancés. Perdus pour toujours."],
                    ["Vous faites tout manuellement.", "10h+ par semaine de travail administratif."],
                  ].map(([a, b], i) => (
                    <li key={i} className="flex items-start gap-3 text-sm">
                      <div className="w-4 h-4 rounded-full bg-red-100 flex items-center justify-center mt-0.5 shrink-0"><div className="w-1.5 h-1.5 rounded-full bg-red-400" /></div>
                      <span className="text-[#52525B]"><span className="text-[#18181B] font-semibold">{a}</span> {b}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </FadeUp>

            <FadeUp delay={0.2}>
              <div className="bg-white rounded-2xl p-7 border border-[#D6E2CF] h-full">
                <div className="flex items-center gap-2 mb-6">
                  <div className="w-8 h-8 rounded-lg bg-[#EEF5EA] flex items-center justify-center"><CheckCircle className="w-4 h-4 text-[#36671E]" /></div>
                  <p className="text-xs font-black text-[#36671E] uppercase tracking-widest">Avec Servolia actif</p>
                </div>
                <ul className="space-y-4">
                  {[
                    ["Un client écrit à 2h du matin.", "L'IA répond immédiatement. Rendez-vous pris."],
                    ["Un visiteur arrive sur votre page.", "Lead capturé, email envoyé en quelques secondes."],
                    ["Vous lancez des pubs Meta.", "Suivi complet : source, coût, ROI par campagne."],
                    ["Le prospect ne réserve pas tout de suite.", "Relance automatique envoyée à 48h."],
                    ["Votre système tourne tout seul.", "Vous vous concentrez sur votre métier — pas sur la chasse aux clients."],
                  ].map(([a, b], i) => (
                    <li key={i} className="flex items-start gap-3 text-sm">
                      <div className="w-4 h-4 rounded-full bg-[#EEF5EA] flex items-center justify-center mt-0.5 shrink-0"><div className="w-1.5 h-1.5 rounded-full bg-[#36671E]" /></div>
                      <span className="text-[#52525B]"><span className="text-[#18181B] font-semibold">{a}</span> {b}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </FadeUp>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════
          HOW IT WORKS — large numbered steps
      ══════════════════════════════════════════════════════════════ */}
      <section id="comment-ca-marche" className="py-20 lg:py-28 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeUp className="text-center mb-16">
            <p className="text-xs font-black text-[#36671E] uppercase tracking-widest mb-3">Le processus</p>
            <h2 className="text-3xl sm:text-4xl font-black text-[#18181B] mb-4">
              Audit → Construction → Résultats.{" "}
              <span className="bg-gradient-to-r from-[#36671E] to-[#6B8439] bg-clip-text text-transparent">
                En 7 jours.
              </span>
            </h2>
          </FadeUp>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              { num: "01", icon: <MessageSquare className="w-5 h-5" />, title: "Audit gratuit de votre activité", desc: "Remplissez notre formulaire de 5 questions. Nous envoyons un audit sous 24h montrant exactement ce qui vous coûte des clients et quoi corriger. Sans paiement, sans appel commercial." },
              { num: "02", icon: <Zap className="w-5 h-5" />, title: "Nous construisons tout", desc: "Périmètre fixe, prix fixe, date fixe — par écrit avant que vous ne payiez un centime. Nous construisons avec notre checklist en 22 étapes et envoyons des vidéos de suivi à chaque étape clé." },
              { num: "03", icon: <TrendingUp className="w-5 h-5" />, title: "Les clients commencent à réserver", desc: "Le système est en ligne. La réceptionniste IA répond aux demandes. Vous recevez un rapport mensuel : leads capturés, rendez-vous pris, sources de trafic, taux de conversion." },
            ].map((s, i) => (
              <FadeUp key={i} delay={i * 0.12}>
                <div className="relative bg-[#FAFAF7] rounded-2xl p-7 border border-[#E8E6E0] hover:border-[#36671E]/30 hover:shadow-card transition-all duration-300 h-full overflow-hidden">
                  <span className="absolute -right-3 -top-4 text-[96px] font-black text-[#E8E6E0] leading-none select-none pointer-events-none">
                    {s.num}
                  </span>
                  <div className="relative">
                    <div className="w-11 h-11 rounded-xl bg-[#36671E] flex items-center justify-center text-[#FAFAF7] mb-5 shadow-lg shadow-[#36671E]/20">
                      {s.icon}
                    </div>
                    <h3 className="text-lg font-black text-[#18181B] mb-3">{s.title}</h3>
                    <p className="text-[#71717A] text-sm leading-relaxed">{s.desc}</p>
                  </div>
                </div>
              </FadeUp>
            ))}
          </div>

          <FadeUp delay={0.4} className="mt-10 text-center">
            <Link href="/fr/comment-ca-marche" className="inline-flex items-center gap-2 text-[#36671E] font-bold text-sm hover:underline">
              Voir le processus complet en 11 étapes <ArrowRight className="w-4 h-4" />
            </Link>
          </FadeUp>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════
          NICHES
      ══════════════════════════════════════════════════════════════ */}
      <section id="secteurs" className="py-20 lg:py-28 bg-[#FAFAF7]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeUp className="text-center mb-12">
            <p className="text-xs font-black text-[#36671E] uppercase tracking-widest mb-3">Pour qui nous construisons</p>
            <h2 className="text-3xl sm:text-4xl font-black text-[#18181B] mb-4">
              Conçu pour les entreprises de services,<br className="hidden sm:block" /> pas pour les startups tech.
            </h2>
            <p className="text-[#52525B] max-w-xl mx-auto text-sm">
              Nous sommes spécialisés dans les métiers où chaque appel manqué ou site lent coûte un vrai client.
            </p>
          </FadeUp>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { emoji: "🦷", title: "Cabinets dentaires & implants", pain: "Les réservations du soir partent chez les confrères", avg: "1,5k–5k € par patient", href: "/fr/dentistes" },
              { emoji: "💉", title: "Cliniques esthétiques & med spas", pain: "Des DMs Instagram qui convertissent à 5 %", avg: "500–3k € par visite", href: "/fr/contact" },
              { emoji: "🏠", title: "Immobilier de prestige", pain: "10 min de délai de réponse = mandat perdu", avg: "10k–100k € de commission", href: "/fr/contact" },
              { emoji: "🌬️", title: "CVC & services à domicile", pain: "L'accueil téléphonique seul coûte 10h/semaine", avg: "3k–30k $ par chantier", href: "/fr/contact" },
              { emoji: "🔬", title: "Chirurgie esthétique", pain: "Consultations réservées 6 semaines à l'avance", avg: "5k–25k $ par intervention", href: "/fr/contact" },
              { emoji: "🐾", title: "Vétérinaires spécialisés", pain: "Des références bloquées au téléphone", avg: "1k–10k $ par cas", href: "/fr/contact" },
              { emoji: "⚖️", title: "Cabinets d'avocats", pain: "Des leads qualifiés jamais relancés", avg: "5k–50k € par dossier", href: "/fr/contact" },
              { emoji: "💎", title: "Cliniques PMA & fertilité", pain: "Les patients internationaux ne peuvent pas réserver", avg: "8k–20k € par cycle", href: "/fr/contact" },
            ].map((n, i) => (
              <FadeUp key={n.title} delay={i * 0.05}>
                <Link href={n.href}
                  className="group flex flex-col p-5 rounded-2xl border border-[#E8E6E0] bg-white hover:border-[#36671E]/40 hover:shadow-card transition-all duration-200 h-full">
                  <span className="text-3xl mb-3 block">{n.emoji}</span>
                  <h3 className="text-sm font-black text-[#18181B] mb-1.5 leading-tight">{n.title}</h3>
                  <p className="text-[11px] text-[#71717A] leading-relaxed mb-3 flex-1">{n.pain}</p>
                  <p className="text-[10px] font-bold text-[#36671E] tracking-wide">{n.avg}</p>
                  <div className="mt-2 flex items-center gap-1 text-[11px] text-[#36671E] font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                    Voir comment <ArrowRight className="w-3 h-3" />
                  </div>
                </Link>
              </FadeUp>
            ))}
          </div>

          <FadeUp delay={0.5} className="text-center mt-10">
            <p className="text-sm text-[#71717A]">Votre secteur n&apos;est pas listé ?{" "}
              <Link href="/fr/contact" className="font-bold text-[#36671E] hover:underline">Parlons-en →</Link>
            </p>
          </FadeUp>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════
          SYSTEMS / SERVICES
      ══════════════════════════════════════════════════════════════ */}
      <section id="systemes" className="py-20 lg:py-28 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeUp className="text-center mb-14">
            <p className="text-xs font-black text-[#36671E] uppercase tracking-widest mb-3">Nos systèmes</p>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-[#18181B] mb-4">
              Nous ne vendons pas des sites.{" "}
              <span className="bg-gradient-to-r from-[#36671E] to-[#6B8439] bg-clip-text text-transparent">
                Nous vendons des systèmes clients IA.
              </span>
            </h2>
            <p className="text-[#71717A] max-w-xl mx-auto text-sm">Quatre systèmes. Un objectif — plus de clients payants, moins de travail manuel.</p>
          </FadeUp>

          <div className="grid md:grid-cols-2 gap-5">
            {systems.map((s, i) => (
              <FadeUp key={i} delay={i * 0.1}>
                <div className={`relative rounded-2xl p-7 border-2 transition-all duration-300 hover:shadow-xl h-full flex flex-col ${
                  s.accent ? "bg-[#FAFAF7] border-[#36671E]/40" : "bg-white border-[#E8E6E0] hover:border-[#36671E]/20"
                }`}>
                  {s.accent && (
                    <span className="absolute -top-3.5 right-6 px-3 py-1 rounded-full bg-[#36671E] text-[#FAFAF7] text-[10px] font-black uppercase tracking-widest">
                      OFFRE PRINCIPALE
                    </span>
                  )}
                  <div className="flex items-center gap-3 mb-5">
                    <div className="w-10 h-10 rounded-xl bg-[#36671E] flex items-center justify-center text-[#FAFAF7]">
                      {s.icon}
                    </div>
                    <span className="text-xs font-black text-[#A1A1AA] tracking-widest">{s.num}</span>
                  </div>
                  <h3 className="text-xl font-black text-[#18181B] mb-2">{s.title}</h3>
                  <p className="text-[#71717A] text-sm leading-relaxed mb-5 flex-1">{s.desc}</p>
                  <div className="flex flex-wrap gap-2 mb-5">
                    {s.features.map((f, j) => (
                      <span key={j} className="px-2.5 py-1 rounded-full bg-[#EEF5EA] text-[#36671E] text-xs font-semibold">{f}</span>
                    ))}
                  </div>
                  <div className="flex items-center justify-between pt-5 border-t border-[#E8E6E0]">
                    <div>
                      <span className="text-2xl font-black text-[#18181B]">{s.price}</span>
                      <span className="text-xs text-[#71717A] ml-2">· livré en {s.delivery}</span>
                    </div>
                    <Link href="/fr/tarifs" className="text-sm font-bold text-[#36671E] flex items-center gap-1 hover:gap-2 transition-all">
                      Détails <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              </FadeUp>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════
          VALUE STACK
      ══════════════════════════════════════════════════════════════ */}
      <section className="py-20 lg:py-28 bg-[#FAFAF7]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeUp className="text-center mb-10">
            <p className="text-xs font-black text-[#36671E] uppercase tracking-widest mb-3">Système de Réservation IA — Ce que vous recevez</p>
            <h2 className="text-3xl sm:text-4xl font-black text-[#18181B] mb-3">
              Tout est inclus.{" "}
              <span className="bg-gradient-to-r from-[#36671E] to-[#6B8439] bg-clip-text text-transparent">
                Un seul prix fixe.
              </span>
            </h2>
            <p className="text-[#71717A] max-w-xl mx-auto text-sm">
              Embaucher séparément — agence web, consultant IA, spécialiste tracking — coûterait plus de 6 000 € et prendrait 3 mois.
            </p>
          </FadeUp>

          <FadeUp delay={0.1}>
            <div className="bg-white rounded-2xl border border-[#E8E6E0] overflow-hidden shadow-card">
              <div className="px-6 py-4 border-b border-[#E8E6E0] flex items-center justify-between bg-[#FAFAF7]">
                <span className="text-sm font-black text-[#18181B]">Inclus dans le Système de Réservation IA</span>
                <span className="text-xs text-[#A1A1AA]">Valeur marché</span>
              </div>
              {[
                { item: "Site de conversion 10 pages", value: "2 500 €" },
                { item: "Chatbot réceptionniste IA (24h/24)", value: "1 500 €" },
                { item: "Parcours de prise de rendez-vous", value: "800 €" },
                { item: "Tracking Pixel Meta + CAPI", value: "600 €" },
                { item: "Configuration Google Analytics 4", value: "300 €" },
                { item: "CRM de leads (synchro Google Sheets)", value: "400 €" },
                { item: "Pages RGPD / Confidentialité / CGV", value: "350 €" },
                { item: "Audit gratuit de votre activité", value: "200 €" },
              ].map((v, i) => (
                <div key={i} className="flex items-center justify-between px-6 py-3.5 border-b border-[#F5F4EF] last:border-0">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="w-4 h-4 text-[#36671E] shrink-0" />
                    <span className="text-sm text-[#18181B]">{v.item}</span>
                  </div>
                  <span className="text-sm text-[#A1A1AA] line-through">{v.value}</span>
                </div>
              ))}
              <div className="px-6 py-5 bg-[#EEF5EA] flex items-center justify-between">
                <div>
                  <p className="text-xs text-[#71717A] mb-0.5">Valeur marché</p>
                  <p className="text-xl font-black text-[#18181B] line-through opacity-40">6 650 €</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-[#36671E] font-bold mb-0.5">Votre prix</p>
                  <p className="text-4xl font-black text-[#36671E]">990 €</p>
                </div>
              </div>
            </div>
          </FadeUp>

          <FadeUp delay={0.2} className="mt-6 text-center">
            <Link href="/fr/audit"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-[#36671E] text-[#FAFAF7] font-black text-base hover:bg-[#295115] transition-colors shadow-lg shadow-[#36671E]/20">
              Réclamer cette offre — audit gratuit d&apos;abord <ArrowRight className="w-4 h-4" />
            </Link>
            <p className="text-[#A1A1AA] text-xs mt-3">Aucun paiement avant validation du périmètre · Sécurisé par Stripe</p>
          </FadeUp>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════
          STATS — dark forest section, high contrast
      ══════════════════════════════════════════════════════════════ */}
      <section ref={statsRef} className="py-20 lg:py-28 bg-[#0A1F14] relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-[#36671E] opacity-50 rounded-full blur-[100px]" />
          <div className="absolute inset-0 grain opacity-30" />
        </div>
        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <FadeUp className="mb-14">
            <h2 className="text-3xl sm:text-4xl font-black text-[#FAFAF7] mb-3">
              La promesse,{" "}
              <span className="bg-gradient-to-r from-[#BEF264] to-[#ABDF90] bg-clip-text text-transparent">en chiffres</span>
            </h2>
            <p className="text-[#ABDF90]/70 text-sm max-w-md mx-auto">Chacun de ces chiffres est écrit dans votre contrat avant que vous ne payiez.</p>
          </FadeUp>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 lg:gap-10">
            {[
              { value: 7, suffix: " jours", label: "Du démarrage au système en ligne" },
              { value: 50, suffix: " %", label: "D'acompte pour démarrer, le reste à la livraison" },
              { value: 10, suffix: " %", label: "Remboursés pour chaque jour de retard" },
              { value: 100, suffix: " %", label: "Code & fichiers à vous au paiement" },
            ].map((s, i) => {
              const c = useCounter(s.value, 1800, statsInView);
              return (
                <FadeUp key={i} delay={i * 0.1}>
                  <div className="text-center p-6 rounded-2xl border border-[#FAFAF7]/10 bg-[#FAFAF7]/4">
                    <div className="text-5xl lg:text-6xl font-black text-[#FAFAF7] mb-2 tabular-nums">
                      {c}{s.suffix}
                    </div>
                    <div className="text-sm text-[#BEF264] font-semibold">{s.label}</div>
                  </div>
                </FadeUp>
              );
            })}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════
          CASE STUDIES
      ══════════════════════════════════════════════════════════════ */}
      <section className="py-20 lg:py-28 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeUp className="text-center mb-12">
            <p className="text-xs font-black text-[#36671E] uppercase tracking-widest mb-3">Ce qu&apos;il est conçu pour faire</p>
            <h2 className="text-3xl sm:text-4xl font-black text-[#18181B] mb-3">
              Ce qu&apos;un système Servolia est conçu pour livrer.
            </h2>
            <p className="text-[#71717A] max-w-lg mx-auto text-sm">Objectifs illustratifs basés sur des références typiques du secteur. Les résultats réels varient.</p>
          </FadeUp>

          <div className="grid md:grid-cols-3 gap-5 mb-10">
            {[
              { badge: "Cabinet dentaire", headline: "+400 %", metric: "réservations en ligne", sub: "De quelques réservations/mois à 15+", detail: "Demandes hors horaires gérées automatiquement", color: "bg-[#36671E]" },
              { badge: "Clinique esthétique", headline: "×4", metric: "réservations par semaine", sub: "L'IA qualifie et réserve pendant que vous travaillez", detail: "La majorité des demandes gérées par l'IA", color: "bg-[#295115]" },
              { badge: "Services à domicile", headline: "10h", metric: "gagnées par semaine", sub: "Fini le ping-pong téléphonique et les messageries", detail: "Chaque lead capturé et scoré dans le CRM", color: "bg-[#6B8439]" },
            ].map((c, i) => (
              <FadeUp key={i} delay={i * 0.1}>
                <div className="bg-[#FAFAF7] rounded-2xl border border-[#E8E6E0] p-7 hover:shadow-card transition-shadow h-full flex flex-col">
                  <span className={`inline-flex self-start text-[10px] font-black px-2.5 py-1 rounded-full ${c.color} text-[#FAFAF7] mb-5 uppercase tracking-widest`}>
                    {c.badge}
                  </span>
                  <div className="mb-4">
                    <span className="text-5xl font-black text-[#18181B]">{c.headline}</span>
                    <span className="text-lg font-bold text-[#36671E] ml-2">{c.metric}</span>
                  </div>
                  <p className="text-sm text-[#52525B] mb-3">{c.sub}</p>
                  <p className="text-xs font-semibold text-[#36671E] border-t border-[#E8E6E0] pt-3 mt-auto">{c.detail}</p>
                </div>
              </FadeUp>
            ))}
          </div>

          <FadeUp delay={0.3} className="text-center">
            <Link href="/fr/cas-clients" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-[#E8E6E0] text-[#18181B] font-bold text-sm hover:bg-[#FAFAF7] transition-colors">
              Lire les scénarios complets <ArrowRight className="w-4 h-4" />
            </Link>
          </FadeUp>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════
          EXAMPLE RESULTS
      ══════════════════════════════════════════════════════════════ */}
      <section className="py-20 lg:py-28 bg-[#FAFAF7]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeUp className="text-center mb-12">
            <p className="text-xs font-black text-[#36671E] uppercase tracking-widest mb-3">Exemples de résultats</p>
            <h2 className="text-3xl sm:text-4xl font-black text-[#18181B] mb-3">Ce qu&apos;un système Servolia peut livrer.</h2>
            <p className="text-xs text-[#71717A] max-w-2xl mx-auto">
              Résultats illustratifs basés sur des références typiques du secteur. Les résultats individuels varient. Voir les{" "}
              <Link href="/fr/cas-clients" className="text-[#36671E] underline">exemples de déploiements</Link>.
            </p>
          </FadeUp>
          <div className="grid md:grid-cols-3 gap-5">
            {[
              { name: "Scénario cabinet dentaire", role: "Cabinet moyen · Europe de l'Ouest", text: "Après l'installation du Système de Réservation IA, un cabinet type passe de quelques réservations en ligne par mois à 15+ dès les premières semaines — le chatbot gère automatiquement toutes les demandes hors horaires.", result: "+400 % de réservations" },
              { name: "Scénario immobilier", role: "Agent indépendant · Grande ville", text: "Un agent type passe de la qualification manuelle de chaque demande à des leads pré-qualifiés reçus sur son téléphone — système entièrement en ligne en 5 jours.", result: "Leads qualifiés en automatique" },
              { name: "Scénario services à domicile", role: "Entreprise CVC · Marché américain", text: "Le chatbot IA qualifie les demandes 24h/24 — les entreprises de services gagnent typiquement 10h+ par semaine d'administratif téléphonique et récupèrent les réservations qui partaient en messagerie vocale.", result: "10 h/semaine gagnées" },
            ].map((t, i) => (
              <FadeUp key={i} delay={i * 0.1}>
                <div className="bg-white rounded-2xl p-7 border border-[#E8E6E0] hover:shadow-card transition-all duration-300 h-full flex flex-col">
                  <div className="flex items-center justify-between mb-5">
                    <span className="text-[10px] font-black text-[#71717A] bg-[#F5F4EF] px-2.5 py-1 rounded-full uppercase tracking-widest">Scénario</span>
                    <span className="text-[10px] font-black text-[#36671E] bg-[#EEF5EA] px-2.5 py-1 rounded-full">{t.result}</span>
                  </div>
                  <p className="text-[#52525B] text-sm leading-relaxed flex-1 mb-5">{t.text}</p>
                  <div className="border-t border-[#F5F4EF] pt-4">
                    <p className="font-bold text-[#18181B] text-sm">{t.name}</p>
                    <p className="text-[#A1A1AA] text-xs mt-0.5">{t.role}</p>
                  </div>
                </div>
              </FadeUp>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════
          CARE PLANS
      ══════════════════════════════════════════════════════════════ */}
      <section className="py-20 lg:py-28 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeUp className="text-center mb-12">
            <p className="text-xs font-black text-[#36671E] uppercase tracking-widest mb-3">Forfaits mensuels</p>
            <h2 className="text-3xl sm:text-4xl font-black text-[#18181B] mb-4">
              Un système qui{" "}
              <span className="bg-gradient-to-r from-[#36671E] to-[#6B8439] bg-clip-text text-transparent">
                s&apos;améliore chaque mois.
              </span>
            </h2>
            <p className="text-[#71717A] max-w-xl mx-auto text-sm">Pas juste une construction unique. Gestion, optimisation et amélioration — résiliable à tout moment.</p>
          </FadeUp>

          <div className="grid md:grid-cols-3 gap-5">
            {carePlans.map((p, i) => (
              <FadeUp key={i} delay={i * 0.1}>
                <div className={`relative rounded-2xl p-7 border-2 flex flex-col h-full ${
                  p.popular ? "border-[#36671E] bg-[#FAFAF7]" : "border-[#E8E6E0] bg-white"
                }`}>
                  {p.popular && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-[#36671E] text-[#FAFAF7] text-[10px] font-black whitespace-nowrap">
                      LE PLUS CHOISI
                    </div>
                  )}
                  <div className="mb-5">
                    <h3 className="text-lg font-black text-[#18181B] mb-1">{p.name}</h3>
                    <div className="flex items-baseline gap-0.5 mb-2">
                      <span className="text-4xl font-black text-[#18181B]">{p.price}</span>
                      <span className="text-[#71717A] text-sm">{p.sub}</span>
                    </div>
                    <p className="text-[#71717A] text-sm">{p.desc}</p>
                  </div>
                  <ul className="space-y-2.5 mb-7 flex-1">
                    {p.features.map((f, j) => (
                      <li key={j} className="flex items-center gap-2.5 text-sm text-[#18181B]">
                        <CheckCircle className="w-4 h-4 text-[#36671E] shrink-0" />{f}
                      </li>
                    ))}
                  </ul>
                  <Link href="/fr/tarifs" className={`block text-center py-3 rounded-xl font-bold text-sm transition-all ${
                    p.popular
                      ? "bg-[#36671E] text-[#FAFAF7] hover:bg-[#295115]"
                      : "border border-[#E8E6E0] text-[#18181B] hover:border-[#36671E] hover:text-[#36671E]"
                  }`}>
                    Commencer →
                  </Link>
                </div>
              </FadeUp>
            ))}
          </div>
          <FadeUp delay={0.3}>
            <p className="text-center text-[#A1A1AA] text-xs mt-6">
              Tous les forfaits sont résiliables à tout moment avec 30 jours de préavis · Facturation mensuelle via Stripe
            </p>
          </FadeUp>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════
          GUARANTEE
      ══════════════════════════════════════════════════════════════ */}
      <section className="py-16 bg-[#FAFAF7]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeUp>
            <div className="rounded-2xl border border-[#D6E2CF] bg-white p-10 text-center shadow-soft">
              <div className="w-14 h-14 rounded-2xl bg-[#36671E] flex items-center justify-center mx-auto mb-6 shadow-lg shadow-[#36671E]/20">
                <Shield className="w-7 h-7 text-[#FAFAF7]" />
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-[#18181B] mb-3">La garantie de livraison Servolia</h2>
              <p className="text-[#52525B] text-sm leading-relaxed mb-8 max-w-xl mx-auto">
                Si nous manquons la date de livraison convenue par notre propre faute, vous récupérez{" "}
                <strong className="text-[#18181B]">10 % de votre paiement pour chaque jour de retard</strong>{" "}
                — automatiquement, sans discussion. Nous n&apos;avons jamais eu à le payer.
              </p>
              <div className="grid sm:grid-cols-3 gap-4">
                {[
                  { icon: <Clock className="w-5 h-5 text-[#36671E]" />, title: "Livraison en 7 jours", desc: "Engagée par écrit avant tout paiement" },
                  { icon: <BadgeCheck className="w-5 h-5 text-[#36671E]" />, title: "Prix fixe", desc: "Pas de dérive de périmètre. Pas de factures surprises." },
                  { icon: <Lock className="w-5 h-5 text-[#36671E]" />, title: "Propriété totale", desc: "Tous les fichiers transférés au paiement final" },
                ].map((g, i) => (
                  <div key={i} className="bg-[#FAFAF7] rounded-xl p-4 border border-[#E8E6E0] text-left">
                    <div className="mb-2">{g.icon}</div>
                    <p className="font-bold text-[#18181B] text-sm mb-0.5">{g.title}</p>
                    <p className="text-xs text-[#71717A]">{g.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </FadeUp>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════
          ROI CALCULATOR
      ══════════════════════════════════════════════════════════════ */}
      <section className="py-20 lg:py-28 bg-[#FAFAF7]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeUp className="text-center mb-12">
            <p className="text-xs font-black text-[#36671E] uppercase tracking-widest mb-3">Combien ça vaut ?</p>
            <h2 className="text-3xl sm:text-4xl font-black text-[#18181B] mb-3">
              Voyez ce que les demandes manquées{" "}
              <span className="bg-gradient-to-r from-[#36671E] to-[#6B8439] bg-clip-text text-transparent">
                vous coûtent.
              </span>
            </h2>
            <p className="text-[#71717A] max-w-lg mx-auto text-sm">
              Déplacez les curseurs pour estimer les revenus qu&apos;un système IA 24h/24 pourrait récupérer pour votre activité.
            </p>
          </FadeUp>
          <FadeUp delay={0.1}>
            <ROICalculator lang="fr" />
          </FadeUp>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════
          PRICING PREVIEW
      ══════════════════════════════════════════════════════════════ */}
      <section className="py-20 lg:py-28 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeUp className="text-center mb-14">
            <p className="text-xs font-black text-[#36671E] uppercase tracking-widest mb-3">Tarifs</p>
            <h2 className="text-3xl sm:text-4xl font-black text-[#18181B] mb-4">
              Choisissez le système dont votre activité a besoin.
            </h2>
            <p className="text-[#71717A] max-w-lg mx-auto text-sm">Prix fixe, périmètre clair, livré vite.</p>
          </FadeUp>

          <div className="grid md:grid-cols-3 gap-5">
            {[
              { name: "Système Site Web", price: "490 €", delivery: "3 jours", desc: "Pour les entreprises qui ont besoin d'une présence en ligne fiable", features: ["Site 5 pages", "Formulaire de contact", "Google Analytics", "Conforme RGPD", "Optimisé mobile"], popular: false },
              { name: "Système Réservation", price: "990 €", delivery: "5 jours", desc: "Pour les entreprises qui veulent leads et rendez-vous en automatique", features: ["Site 10 pages", "Chatbot IA", "Parcours de réservation", "Synchro CRM", "Pixel Meta + GA4", "Conforme RGPD"], popular: true },
              { name: "Système Client", price: "1 900 €", delivery: "7 jours", desc: "Pour les entreprises qui veulent suivi complet et gestion clients", features: ["Tout le Système Réservation", "Tableau de bord", "Pipeline de leads", "Notifications automatiques", "Rapport mensuel"], popular: false },
            ].map((p, i) => (
              <FadeUp key={i} delay={i * 0.1}>
                <div className={`relative bg-white rounded-2xl border-2 p-7 h-full flex flex-col ${p.popular ? "border-[#36671E] shadow-xl shadow-[#36671E]/10" : "border-[#E8E6E0]"}`}>
                  {p.popular && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-[#36671E] text-[#FAFAF7] text-[10px] font-black whitespace-nowrap">
                      OFFRE PRINCIPALE
                    </div>
                  )}
                  <div className="mb-5">
                    <h3 className="text-lg font-black text-[#18181B] mb-0.5">{p.name}</h3>
                    <p className="text-xs text-[#71717A] mb-4">{p.desc}</p>
                    <div className="text-4xl font-black text-[#18181B] mb-2">{p.price}</div>
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-[#36671E]" />
                      <span className="text-xs font-semibold text-[#36671E]">Livré en {p.delivery}</span>
                    </div>
                  </div>
                  <ul className="space-y-2 mb-7 flex-1">
                    {p.features.map((f, j) => (
                      <li key={j} className="flex items-center gap-2 text-sm text-[#52525B]">
                        <CheckCircle className="w-4 h-4 text-[#36671E] shrink-0" />{f}
                      </li>
                    ))}
                  </ul>
                  <Link href="/fr/tarifs" className={`block text-center py-3 rounded-xl font-bold text-sm transition-all ${
                    p.popular
                      ? "bg-[#36671E] text-[#FAFAF7] hover:bg-[#295115]"
                      : "border border-[#E8E6E0] text-[#18181B] hover:border-[#36671E] hover:text-[#36671E]"
                  }`}>
                    Commencer →
                  </Link>
                </div>
              </FadeUp>
            ))}
          </div>

          <FadeUp delay={0.3} className="text-center mt-8">
            <p className="text-[#71717A] text-sm mb-2">Prix HT · Acompte de 50 % · Solde à la livraison</p>
            <Link href="/fr/tarifs" className="inline-flex items-center gap-1.5 text-[#36671E] font-bold text-sm hover:underline">
              Tous les détails des tarifs <ArrowRight className="w-4 h-4" />
            </Link>
          </FadeUp>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════
          FAQ
      ══════════════════════════════════════════════════════════════ */}
      <section className="py-20 bg-[#FAFAF7]">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeUp className="text-center mb-12">
            <p className="text-xs font-black text-[#36671E] uppercase tracking-widest mb-3">FAQ</p>
            <h2 className="text-3xl font-black text-[#18181B]">Les questions qu&apos;on nous pose souvent</h2>
          </FadeUp>
          <div className="space-y-3">
            {faqs.map((f, i) => (
              <FadeUp key={i} delay={i * 0.05}>
                <div className="bg-white border border-[#E8E6E0] rounded-xl overflow-hidden">
                  <button
                    onClick={() => setFaqOpen(faqOpen === i ? null : i)}
                    className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-[#FAFAF7] transition-colors"
                  >
                    <span className="font-bold text-[#18181B] text-sm">{f.q}</span>
                    <ChevronDown className={`w-4 h-4 text-[#71717A] shrink-0 transition-transform duration-200 ${faqOpen === i ? "rotate-180" : ""}`} />
                  </button>
                  <motion.div
                    initial={false}
                    animate={{ height: faqOpen === i ? "auto" : 0, opacity: faqOpen === i ? 1 : 0 }}
                    transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                    className="overflow-hidden"
                  >
                    <div className="px-6 pb-5 text-[#71717A] text-sm leading-relaxed border-t border-[#F5F4EF] pt-4">{f.a}</div>
                  </motion.div>
                </div>
              </FadeUp>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════
          FINAL CTA — dark forest
      ══════════════════════════════════════════════════════════════ */}
      <section className="py-24 lg:py-32 bg-[#0A1F14] relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-[#36671E] opacity-60 rounded-full blur-[100px]" />
          <div className="absolute inset-0 grain opacity-30" />
        </div>

        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <FadeUp>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[#BEF264]/30 bg-[#BEF264]/10 text-[#ABDF90] text-sm font-semibold mb-8">
              <Sparkles className="w-3.5 h-3.5" />
              Livré en 7 jours · Prix fixe · Sans surprise
            </div>
            <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black text-[#FAFAF7] mb-6 leading-[1.05]">
              Arrêtez de perdre des clients au profit d&apos;entreprises{" "}
              <span className="bg-gradient-to-r from-[#BEF264] to-[#ABDF90] bg-clip-text text-transparent">
                mieux équipées.
              </span>
            </h2>
            <p className="text-[#FAFAF7]/60 text-lg mb-4 max-w-xl mx-auto leading-relaxed">
              Vos concurrents utilisent déjà l&apos;IA pour répondre aux demandes, prendre les rendez-vous et relancer automatiquement.
            </p>
            <p className="text-[#ABDF90] font-semibold mb-10 text-sm">
              L&apos;audit gratuit prend 5 minutes. Le système prend 7 jours. Les résultats durent des années.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-10">
              <Link href="/fr/audit"
                className="group px-9 py-4 rounded-xl bg-[#BEF264] text-[#0A1F14] font-black text-lg hover:bg-[#D9F99D] transition-colors shadow-lg shadow-[#BEF264]/20 flex items-center gap-2">
                Obtenir mon audit gratuit
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
              <a href="mailto:hello@servolia.com"
                className="flex items-center gap-2 text-[#FAFAF7]/60 hover:text-[#FAFAF7] text-sm font-semibold transition-colors">
                <Phone className="w-4 h-4" /> hello@servolia.com
              </a>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-[#FAFAF7]/40">
              <span className="flex items-center gap-1.5"><Shield className="w-3.5 h-3.5 text-[#BEF264]" /> Conforme RGPD</span>
              <span className="flex items-center gap-1.5"><BadgeCheck className="w-3.5 h-3.5 text-[#BEF264]" /> Prix fixe par écrit</span>
              <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-[#BEF264]" /> 7 jours ou 10 % remboursés/jour</span>
            </div>
          </FadeUp>
        </div>
      </section>

      {/* FOOTER (French, shared) */}
      <StickyMobileCTA label="Réservez votre audit gratuit" sub="Gratuit · Livré en 24h · Sans appel" href="/fr/audit" />
      <FrenchFooter />
    </main>
  );
}
