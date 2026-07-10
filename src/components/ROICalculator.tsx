"use client";

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { TrendingUp, ArrowRight } from "lucide-react";
import Link from "next/link";

/**
 * ROICalculator — models the potential upside of capturing missed enquiries.
 * Assumptions are shown transparently so the output stays honest, not hype.
 */

// Transparent, conservative model assumptions
const AI_RECOVERY = 0.6;  // share of currently-missed enquiries the AI recovers
const CLOSE_RATE = 0.3;   // share of recovered enquiries that become paying clients
const SYSTEM_PRICE = 990; // AI Booking System, €

function fmt(n: number) {
  return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

const COPY = {
  en: {
    badge: "ROI Estimator",
    enquiries: "Monthly enquiries", enquiriesHint: "Calls, form fills & DMs you get per month",
    value: "Average value per new client", valueHint: "Revenue from one new patient / client",
    missed: "Enquiries you currently miss", missedHint: "After-hours, busy line, slow follow-up",
    assume: (r: number, c: number) => `Model assumes the AI recovers ${r}% of currently-missed enquiries and ${c}% of those become paying clients. Conservative estimate for illustration — your numbers will vary.`,
    potential: "Modeled potential", perMonth: "extra revenue per month",
    extraClients: "Extra clients / mo", extraYear: "Extra revenue / yr",
    payback: (d: number) => <>The €990 Booking System would pay for itself in <span className="font-black text-[#ABDF90]">~{d} days</span>.</>,
    adjust: "Adjust the sliders to model your potential upside.",
    cta: "Get my real numbers — free audit",
  },
  fr: {
    badge: "Estimateur de ROI",
    enquiries: "Demandes par mois", enquiriesHint: "Appels, formulaires et messages reçus chaque mois",
    value: "Valeur moyenne par nouveau client", valueHint: "Chiffre d'affaires d'un nouveau patient / client",
    missed: "Demandes que vous manquez", missedHint: "Hors horaires, ligne occupée, relance lente",
    assume: (r: number, c: number) => `Le modèle suppose que l'IA récupère ${r}% des demandes actuellement manquées et que ${c}% deviennent des clients payants. Estimation prudente à titre indicatif — vos chiffres varieront.`,
    potential: "Potentiel estimé", perMonth: "de revenus supplémentaires par mois",
    extraClients: "Clients en plus / mois", extraYear: "Revenus en plus / an",
    payback: (d: number) => <>Le Système de Réservation à 990 € serait rentabilisé en <span className="font-black text-[#ABDF90]">~{d} jours</span>.</>,
    adjust: "Déplacez les curseurs pour estimer votre potentiel.",
    cta: "Obtenir mes vrais chiffres — audit gratuit",
  },
};

export default function ROICalculator({ lang = "en" }: { lang?: "en" | "fr" }) {
  const t = COPY[lang];
  const [enquiries, setEnquiries] = useState(80);   // monthly enquiries (calls + forms + DMs)
  const [value, setValue] = useState(800);          // avg revenue per new client (€)
  const [missed, setMissed] = useState(35);         // % currently missed / not followed up

  const { extraClients, extraMonthly, extraYearly, paybackDays } = useMemo(() => {
    const recovered = enquiries * (missed / 100) * AI_RECOVERY;
    const extraClients = recovered * CLOSE_RATE;
    const extraMonthly = extraClients * value;
    const extraYearly = extraMonthly * 12;
    const paybackDays = extraMonthly > 0 ? Math.max(1, Math.round((SYSTEM_PRICE / extraMonthly) * 30)) : 0;
    return { extraClients, extraMonthly, extraYearly, paybackDays };
  }, [enquiries, value, missed]);

  return (
    <div className="grid lg:grid-cols-2 rounded-3xl border border-[#E8E6E0] bg-white shadow-card overflow-hidden">
      {/* Inputs */}
      <div className="p-7 lg:p-9">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#EEF5EA] text-[#36671E] text-xs font-black uppercase tracking-widest mb-6">
          <TrendingUp className="w-3.5 h-3.5" /> {t.badge}
        </div>

        <Slider
          label={t.enquiries}
          hint={t.enquiriesHint}
          value={enquiries}
          min={10}
          max={400}
          step={5}
          onChange={setEnquiries}
          display={fmt(enquiries)}
        />
        <Slider
          label={t.value}
          hint={t.valueHint}
          value={value}
          min={100}
          max={8000}
          step={50}
          onChange={setValue}
          display={`€${fmt(value)}`}
        />
        <Slider
          label={t.missed}
          hint={t.missedHint}
          value={missed}
          min={5}
          max={70}
          step={1}
          onChange={setMissed}
          display={`${missed}%`}
        />

        <p className="text-[11px] text-[#A1A1AA] leading-relaxed mt-6 border-t border-[#F5F4EF] pt-4">
          {t.assume(Math.round(AI_RECOVERY * 100), Math.round(CLOSE_RATE * 100))}
        </p>
      </div>

      {/* Output */}
      <div className="relative p-7 lg:p-9 bg-[#0A1F14] flex flex-col justify-center overflow-hidden">
        <div className="absolute -top-10 -right-10 w-64 h-64 bg-[#36671E] opacity-50 rounded-full blur-3xl pointer-events-none" />
        <div className="relative">
          <p className="text-[#ABDF90] text-xs font-black uppercase tracking-widest mb-2">{t.potential}</p>

          <motion.div
            key={extraMonthly}
            initial={{ opacity: 0.4, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <p className="text-5xl lg:text-6xl font-black text-[#FAFAF7] tabular-nums leading-none">
              €{fmt(extraMonthly)}
            </p>
            <p className="text-[#ABDF90]/80 text-sm font-semibold mt-2">{t.perMonth}</p>
          </motion.div>

          <div className="grid grid-cols-2 gap-3 mt-7">
            <Stat label={t.extraClients} value={`+${extraClients.toFixed(1)}`} />
            <Stat label={t.extraYear} value={`€${fmt(extraYearly)}`} />
          </div>

          <div className="mt-5 px-4 py-3 rounded-xl bg-[#FAFAF7]/[0.06] border border-[#FAFAF7]/10">
            <p className="text-[#FAFAF7]/80 text-sm">
              {extraMonthly > 0 ? t.payback(paybackDays) : t.adjust}
            </p>
          </div>

          <Link href={lang === "fr" ? "/fr#audit" : "/free-audit"}
            className="mt-6 inline-flex items-center justify-center gap-2 w-full py-3.5 rounded-xl bg-[#BEF264] text-[#0A1F14] font-black text-sm hover:bg-[#D9F99D] transition-colors">
            {t.cta} <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}

function Slider({
  label, hint, value, min, max, step, onChange, display,
}: {
  label: string; hint: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void; display: string;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="mb-6">
      <div className="flex items-baseline justify-between mb-1">
        <label className="text-sm font-bold text-[#18181B]">{label}</label>
        <span className="text-lg font-black text-[#36671E] tabular-nums">{display}</span>
      </div>
      <p className="text-[11px] text-[#A1A1AA] mb-2.5">{hint}</p>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-2 rounded-full appearance-none cursor-pointer accent-[#36671E]"
        style={{ background: `linear-gradient(to right, #36671E ${pct}%, #E8E6E0 ${pct}%)` }}
      />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-4 py-3 rounded-xl bg-[#FAFAF7]/[0.06] border border-[#FAFAF7]/10">
      <p className="text-2xl font-black text-[#FAFAF7] tabular-nums leading-none">{value}</p>
      <p className="text-[#ABDF90]/70 text-[11px] font-semibold mt-1.5">{label}</p>
    </div>
  );
}
