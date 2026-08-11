"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Globe, Bot, CalendarCheck, BarChart3, ExternalLink, Send, Star } from "lucide-react";

/**
 * The system, shown rather than described. Four slides — site, AI receptionist,
 * booking, dashboard — each with a small mock of the real UI (no stock photos
 * pretending to be product, no invented testimonials or metrics).
 *
 * Auto-advances, pauses on hover/focus, stops entirely for users who prefer
 * reduced motion, and is fully keyboard + screen-reader navigable.
 */

const DEMO_URL = "/sites/demo-metay";

const T = {
  en: {
    eyebrow: "The system",
    title: "Four parts. One machine.",
    sub: "Everything below is live — open the demo and use it yourself.",
    demo: "Open the live demo",
    prev: "Previous slide", next: "Next slide", goTo: (n: number) => `Go to slide ${n}`,
    slides: [
      { t: "A site built to convert", b: "Multi-page, fast, and written around what patients actually ask — not a digital brochure." },
      { t: "An AI receptionist, 24/7", b: "Answers questions and takes contact details at 22:00 on a Sunday, in your clinic's own voice." },
      { t: "Bookings that don't get lost", b: "Every request captured in one place, with the reason for the visit and the preferred time." },
      { t: "Proof, every month", b: "Leads, booking requests, and how many arrived outside opening hours." },
    ],
  },
  fr: {
    eyebrow: "Le système",
    title: "Quatre parties. Une seule machine.",
    sub: "Tout ce qui suit est en ligne — ouvrez la démo et testez-la vous-même.",
    demo: "Ouvrir la démo",
    prev: "Diapositive précédente", next: "Diapositive suivante", goTo: (n: number) => `Aller à la diapositive ${n}`,
    slides: [
      { t: "Un site pensé pour convertir", b: "Multi-pages, rapide, et écrit autour des vraies questions des patients — pas une brochure numérique." },
      { t: "Une réceptionniste IA, 24h/24", b: "Elle répond et prend les coordonnées à 22h un dimanche, avec la voix de votre cabinet." },
      { t: "Des réservations qui ne se perdent pas", b: "Chaque demande centralisée, avec le motif de la visite et le créneau souhaité." },
      { t: "La preuve, chaque mois", b: "Demandes, rendez-vous, et combien sont arrivés en dehors des horaires d'ouverture." },
    ],
  },
};

const ICONS = [Globe, Bot, CalendarCheck, BarChart3];
const AUTOPLAY_MS = 6000;

export default function ShowcaseSlider({ lang = "en" }: { lang?: "en" | "fr" }) {
  const t = T[lang === "fr" ? "fr" : "en"];
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const reduced = useRef(false);

  useEffect(() => {
    reduced.current = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  }, []);

  const go = useCallback((n: number) => setI((n + t.slides.length) % t.slides.length), [t.slides.length]);

  useEffect(() => {
    if (paused || reduced.current) return;
    const id = setInterval(() => setI((v) => (v + 1) % t.slides.length), AUTOPLAY_MS);
    return () => clearInterval(id);
  }, [paused, t.slides.length]);

  return (
    <section className="py-16 lg:py-24 bg-[#FAFAF7]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-10">
          <p className="text-sm font-bold text-[#36671E] uppercase tracking-widest mb-3">{t.eyebrow}</p>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-[#18181B] mb-3">{t.title}</h2>
          <p className="text-[#71717A] text-sm max-w-lg mx-auto">{t.sub}</p>
        </div>

        <div
          className="relative"
          role="group"
          aria-roledescription="carousel"
          aria-label={t.title}
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onFocusCapture={() => setPaused(true)}
          onBlurCapture={() => setPaused(false)}
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft") { e.preventDefault(); go(i - 1); }
            if (e.key === "ArrowRight") { e.preventDefault(); go(i + 1); }
          }}
        >
          <div className="rounded-3xl border border-[#E8E6E0] bg-white overflow-hidden shadow-sm">
            <div className="grid lg:grid-cols-2 gap-0 items-center">
              {/* Visual */}
              <div className="p-6 sm:p-10 bg-gradient-to-br from-[#EEF5EA] to-[#FAFAF7] min-h-[300px] flex items-center justify-center">
                <Mock index={i} lang={lang === "fr" ? "fr" : "en"} />
              </div>

              {/* Copy */}
              <div className="p-6 sm:p-10">
                <div className="flex items-center gap-2 mb-4">
                  {ICONS.map((Icon, n) => (
                    <span key={n}
                      className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${
                        n === i ? "bg-[#36671E] text-[#FAFAF7]" : "bg-[#F5F4EF] text-[#A1A1AA]"
                      }`}>
                      <Icon className="w-4 h-4" />
                    </span>
                  ))}
                </div>
                <div aria-live="polite">
                  <h3 className="text-xl sm:text-2xl font-black text-[#18181B] mb-3">{t.slides[i].t}</h3>
                  <p className="text-[#52525B] leading-relaxed">{t.slides[i].b}</p>
                </div>
                <a href={DEMO_URL} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 mt-7 px-6 py-3 rounded-xl bg-[#36671E] text-[#FAFAF7] font-bold text-sm hover:bg-[#295115] transition-colors">
                  {t.demo} <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center justify-center gap-3 mt-6">
            <button onClick={() => go(i - 1)} aria-label={t.prev}
              className="w-10 h-10 rounded-full border border-[#E8E6E0] bg-white flex items-center justify-center text-[#52525B] hover:border-[#36671E] hover:text-[#36671E] transition-colors">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2">
              {t.slides.map((_, n) => (
                <button key={n} onClick={() => go(n)} aria-label={t.goTo(n + 1)} aria-current={n === i}
                  className={`h-2 rounded-full transition-all ${n === i ? "w-6 bg-[#36671E]" : "w-2 bg-[#D4D2CC] hover:bg-[#A1A1AA]"}`} />
              ))}
            </div>
            <button onClick={() => go(i + 1)} aria-label={t.next}
              className="w-10 h-10 rounded-full border border-[#E8E6E0] bg-white flex items-center justify-center text-[#52525B] hover:border-[#36671E] hover:text-[#36671E] transition-colors">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── Mocks that mirror the live demo ──────────────────────────────────────
 * Realistic content instead of gray bars: each frame is a miniature of the
 * actual demo the button opens (Cabinet Nicolas Metay, Lyon), so a visitor
 * recognises the product before clicking through. Frames remain aria-hidden
 * decoration; the dashboard carries an explicit "example" chip so its
 * numbers can never be read as a live client's metrics. */

const MOCK = {
  en: {
    url: "cabinet-metay.fr",
    site: {
      name: "Cabinet Nicolas Metay",
      tag: "Dental surgeon — Lyon 6e",
      cta: "Book an appointment",
      services: ["Check-ups", "Implants", "Emergencies"],
      rating: "4.9 · Google reviews",
    },
    chat: {
      who: "AI receptionist — online",
      when: "Sun · 10:04 pm",
      p1: "Good evening, I’ve had a bad toothache since tonight… are you open tomorrow?",
      ai: "Good evening! Yes — we open at 8:30. For acute pain we keep emergency slots. May I take your details for a call-back at opening?",
      p2: "Yes please — Claire, 06 12 34…",
      input: "Write your message…",
    },
    booking: {
      title: "New booking request",
      badge: "Sun 10:07 pm",
      f1: "Reason for visit", v1: "Tooth pain — right molar",
      f2: "Preferred time", slotA: "Tuesday morning", slotB: "Wednesday",
      contact: "Claire B. · 06 12 34 •• ••",
      sent: "Request sent ✓",
    },
    dash: {
      chip: "Example",
      stats: [["Enquiries", "34"], ["Bookings", "21"], ["After-hours", "41%"]],
      rows: [["Website visits", "w-4/5"], ["AI conversations", "w-3/5"], ["Booking requests", "w-2/5"]],
      caption: "Last 30 days",
    },
  },
  fr: {
    url: "cabinet-metay.fr",
    site: {
      name: "Cabinet Nicolas Metay",
      tag: "Chirurgien-dentiste — Lyon 6e",
      cta: "Prendre rendez-vous",
      services: ["Détartrage", "Implants", "Urgences"],
      rating: "4,9 · Avis Google",
    },
    chat: {
      who: "Réceptionniste IA — en ligne",
      when: "dim. · 22:04",
      p1: "Bonsoir, j’ai une rage de dents depuis ce soir… vous êtes ouverts demain ?",
      ai: "Bonsoir ! Oui — le cabinet ouvre à 8h30. Pour une douleur aiguë, nous gardons des créneaux d’urgence. Puis-je prendre vos coordonnées pour un rappel dès l’ouverture ?",
      p2: "Oui merci — Claire, 06 12 34…",
      input: "Écrivez votre message…",
    },
    booking: {
      title: "Nouvelle demande de RDV",
      badge: "dim. 22:07",
      f1: "Motif de la visite", v1: "Douleur — molaire droite",
      f2: "Créneau souhaité", slotA: "Mardi matin", slotB: "Mercredi",
      contact: "Claire B. · 06 12 34 •• ••",
      sent: "Demande envoyée ✓",
    },
    dash: {
      chip: "Exemple",
      stats: [["Demandes", "34"], ["RDV", "21"], ["Hors horaires", "41%"]],
      rows: [["Visites du site", "w-4/5"], ["Conversations IA", "w-3/5"], ["Demandes de RDV", "w-2/5"]],
      caption: "30 derniers jours",
    },
  },
} as const;

function Mock({ index, lang }: { index: number; lang: "en" | "fr" }) {
  const m = MOCK[lang];
  const frame = "w-full max-w-sm rounded-2xl bg-white border border-[#E8E6E0] shadow-lg overflow-hidden";
  const bar = (
    <div className="flex items-center gap-1.5 px-3 py-2.5 border-b border-[#F5F4EF] bg-[#FAFAF7]">
      <span className="w-2 h-2 rounded-full bg-[#E8E6E0]" />
      <span className="w-2 h-2 rounded-full bg-[#E8E6E0]" />
      <span className="w-2 h-2 rounded-full bg-[#E8E6E0]" />
      <span className="ml-2 flex-1 h-5 rounded-md bg-white border border-[#E8E6E0] px-2 flex items-center text-[9px] text-[#A1A1AA] font-medium truncate">
        {m.url}
      </span>
    </div>
  );

  /* Slide 1 — the site: the demo's hero, services, and review proof */
  if (index === 0) {
    return (
      <div className={frame} aria-hidden="true">
        {bar}
        <div className="bg-gradient-to-br from-[#36671E] to-[#295115] p-4">
          <p className="text-white font-black text-sm leading-tight">{m.site.name}</p>
          <p className="text-white/70 text-[10px] mt-0.5">{m.site.tag}</p>
          <span className="inline-block mt-2.5 px-3 py-1.5 rounded-lg bg-white text-[#36671E] text-[10px] font-bold">
            {m.site.cta}
          </span>
        </div>
        <div className="p-3.5 space-y-2.5">
          <div className="grid grid-cols-3 gap-1.5">
            {m.site.services.map((s) => (
              <div key={s} className="rounded-lg bg-[#F5F4EF] px-1 py-2 text-center text-[9px] font-semibold text-[#3F3F46]">
                {s}
              </div>
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="flex text-[#F59E0B]">
              {[0, 1, 2, 3, 4].map((n) => <Star key={n} className="w-3 h-3 fill-current" />)}
            </span>
            <span className="text-[9px] text-[#71717A] font-medium">{m.site.rating}</span>
          </div>
        </div>
      </div>
    );
  }

  /* Slide 2 — the AI receptionist: a real after-hours exchange */
  if (index === 1) {
    return (
      <div className={frame} aria-hidden="true">
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-[#F5F4EF] bg-[#FAFAF7]">
          <span className="flex items-center gap-1.5 text-[10px] font-bold text-[#18181B]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#059669]" />
            {m.chat.who}
          </span>
          <span className="text-[9px] text-[#A1A1AA] font-medium">{m.chat.when}</span>
        </div>
        <div className="p-3.5 space-y-2">
          <div className="flex justify-end">
            <p className="max-w-[85%] rounded-2xl rounded-br-sm bg-[#F5F4EF] px-2.5 py-1.5 text-[10px] leading-snug text-[#3F3F46]">{m.chat.p1}</p>
          </div>
          <div className="flex justify-start">
            <p className="max-w-[88%] rounded-2xl rounded-bl-sm bg-[#36671E] px-2.5 py-1.5 text-[10px] leading-snug text-white">{m.chat.ai}</p>
          </div>
          <div className="flex justify-end">
            <p className="max-w-[85%] rounded-2xl rounded-br-sm bg-[#F5F4EF] px-2.5 py-1.5 text-[10px] leading-snug text-[#3F3F46]">{m.chat.p2}</p>
          </div>
          <div className="flex items-center gap-1.5 pt-1">
            <div className="flex-1 h-8 rounded-xl bg-[#FAFAF7] border border-[#E8E6E0] px-2.5 flex items-center text-[9px] text-[#A1A1AA]">{m.chat.input}</div>
            <span className="w-8 h-8 rounded-xl bg-[#36671E] flex items-center justify-center">
              <Send className="w-3.5 h-3.5 text-white" />
            </span>
          </div>
        </div>
      </div>
    );
  }

  /* Slide 3 — the booking: a captured request, filled in */
  if (index === 2) {
    return (
      <div className={frame} aria-hidden="true">
        {bar}
        <div className="p-3.5 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-black text-[#18181B]">{m.booking.title}</p>
            <span className="px-1.5 py-0.5 rounded-md bg-[#EEF5EA] text-[8px] font-bold text-[#36671E] whitespace-nowrap">{m.booking.badge}</span>
          </div>
          <div className="space-y-1">
            <p className="text-[9px] font-semibold text-[#A1A1AA] uppercase tracking-wide">{m.booking.f1}</p>
            <div className="h-8 rounded-xl bg-[#FAFAF7] border border-[#E8E6E0] px-2.5 flex items-center text-[10px] font-medium text-[#18181B]">{m.booking.v1}</div>
          </div>
          <div className="space-y-1">
            <p className="text-[9px] font-semibold text-[#A1A1AA] uppercase tracking-wide">{m.booking.f2}</p>
            <div className="grid grid-cols-2 gap-1.5">
              <div className="h-8 rounded-xl bg-[#EEF5EA] border border-[#36671E]/40 flex items-center justify-center text-[10px] font-bold text-[#36671E]">{m.booking.slotA}</div>
              <div className="h-8 rounded-xl bg-[#FAFAF7] border border-[#E8E6E0] flex items-center justify-center text-[10px] text-[#71717A]">{m.booking.slotB}</div>
            </div>
          </div>
          <p className="text-[10px] text-[#52525B] font-medium">{m.booking.contact}</p>
          <div className="h-9 rounded-xl bg-[#36671E] flex items-center justify-center text-[11px] font-bold text-white">{m.booking.sent}</div>
        </div>
      </div>
    );
  }

  /* Slide 4 — the dashboard: labeled example numbers, after-hours highlighted */
  return (
    <div className={frame} aria-hidden="true">
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-[#F5F4EF] bg-[#FAFAF7]">
        <span className="text-[10px] font-bold text-[#18181B]">{m.dash.caption}</span>
        <span className="px-1.5 py-0.5 rounded-md bg-[#F5F4EF] text-[8px] font-bold text-[#A1A1AA] uppercase tracking-wide">{m.dash.chip}</span>
      </div>
      <div className="p-3.5 space-y-3">
        <div className="grid grid-cols-3 gap-1.5">
          {m.dash.stats.map(([label, value], n) => (
            <div key={label} className={`rounded-xl p-2 ${n === 2 ? "bg-[#EEF5EA] border border-[#36671E]/25" : "bg-[#FAFAF7] border border-[#E8E6E0]"}`}>
              <p className={`text-sm font-black ${n === 2 ? "text-[#36671E]" : "text-[#18181B]"}`}>{value}</p>
              <p className="text-[8px] font-semibold text-[#71717A] mt-0.5 leading-tight">{label}</p>
            </div>
          ))}
        </div>
        <div className="space-y-2">
          {m.dash.rows.map(([label, width]) => (
            <div key={label} className="space-y-0.5">
              <p className="text-[9px] font-medium text-[#52525B]">{label}</p>
              <div className="h-1.5 rounded-full bg-[#F5F4EF]">
                <div className={`h-1.5 rounded-full bg-[#36671E]/70 ${width}`} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
