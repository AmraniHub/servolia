"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Globe, Bot, CalendarCheck, BarChart3, ExternalLink } from "lucide-react";

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
                <Mock index={i} />
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

/* ── Small mocks of the real product ─────────────────────────────────────── */
function Mock({ index }: { index: number }) {
  const frame = "w-full max-w-sm rounded-2xl bg-white border border-[#E8E6E0] shadow-lg overflow-hidden";
  const bar = (
    <div className="flex items-center gap-1.5 px-3 py-2.5 border-b border-[#F5F4EF] bg-[#FAFAF7]">
      <span className="w-2 h-2 rounded-full bg-[#E8E6E0]" />
      <span className="w-2 h-2 rounded-full bg-[#E8E6E0]" />
      <span className="w-2 h-2 rounded-full bg-[#E8E6E0]" />
    </div>
  );

  if (index === 0) {
    return (
      <div className={frame} aria-hidden="true">
        {bar}
        <div className="h-20 bg-gradient-to-br from-[#36671E] to-[#295115] p-4 flex flex-col justify-end">
          <div className="h-2.5 w-2/3 rounded bg-white/80" />
          <div className="h-1.5 w-1/2 rounded bg-white/40 mt-1.5" />
        </div>
        <div className="p-4 space-y-2">
          <div className="grid grid-cols-3 gap-2">
            {[0, 1, 2].map((n) => <div key={n} className="h-10 rounded-lg bg-[#F5F4EF]" />)}
          </div>
          <div className="h-1.5 w-full rounded bg-[#F5F4EF]" />
          <div className="h-1.5 w-4/5 rounded bg-[#F5F4EF]" />
        </div>
      </div>
    );
  }

  if (index === 1) {
    return (
      <div className={frame} aria-hidden="true">
        {bar}
        <div className="p-4 space-y-2.5">
          <div className="flex justify-start">
            <div className="max-w-[80%] rounded-2xl rounded-bl-sm bg-[#F5F4EF] px-3 py-2 space-y-1.5">
              <div className="h-1.5 w-32 rounded bg-[#D4D2CC]" />
              <div className="h-1.5 w-24 rounded bg-[#D4D2CC]" />
            </div>
          </div>
          <div className="flex justify-end">
            <div className="max-w-[75%] rounded-2xl rounded-br-sm bg-[#36671E] px-3 py-2 space-y-1.5">
              <div className="h-1.5 w-24 rounded bg-white/70" />
            </div>
          </div>
          <div className="flex justify-start">
            <div className="max-w-[80%] rounded-2xl rounded-bl-sm bg-[#F5F4EF] px-3 py-2 space-y-1.5">
              <div className="h-1.5 w-28 rounded bg-[#D4D2CC]" />
              <div className="h-1.5 w-20 rounded bg-[#D4D2CC]" />
            </div>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <div className="flex-1 h-8 rounded-xl bg-[#FAFAF7] border border-[#E8E6E0]" />
            <div className="w-8 h-8 rounded-xl bg-[#36671E]" />
          </div>
        </div>
      </div>
    );
  }

  if (index === 2) {
    return (
      <div className={frame} aria-hidden="true">
        {bar}
        <div className="p-4 space-y-3">
          {[0, 1].map((n) => (
            <div key={n} className="space-y-1.5">
              <div className="h-1.5 w-16 rounded bg-[#D4D2CC]" />
              <div className="h-8 rounded-xl bg-[#FAFAF7] border border-[#E8E6E0]" />
            </div>
          ))}
          <div className="grid grid-cols-2 gap-2">
            <div className="h-8 rounded-xl bg-[#EEF5EA] border border-[#36671E]/30" />
            <div className="h-8 rounded-xl bg-[#FAFAF7] border border-[#E8E6E0]" />
          </div>
          <div className="h-9 rounded-xl bg-[#36671E]" />
        </div>
      </div>
    );
  }

  return (
    <div className={frame} aria-hidden="true">
      {bar}
      <div className="p-4 space-y-3">
        <div className="grid grid-cols-3 gap-2">
          {[{ w: "w-8" }, { w: "w-6" }, { w: "w-7" }].map((s, n) => (
            <div key={n} className={`rounded-xl p-2.5 ${n === 1 ? "bg-[#EEF5EA] border border-[#36671E]/25" : "bg-[#FAFAF7] border border-[#E8E6E0]"}`}>
              <div className={`h-3 ${s.w} rounded ${n === 1 ? "bg-[#36671E]" : "bg-[#D4D2CC]"}`} />
              <div className="h-1 w-full rounded bg-[#E8E6E0] mt-1.5" />
            </div>
          ))}
        </div>
        {[0, 1, 2].map((n) => (
          <div key={n} className="flex items-center gap-2">
            <div className="w-10 h-4 rounded-full bg-[#EEF5EA]" />
            <div className="flex-1 h-1.5 rounded bg-[#F5F4EF]" />
          </div>
        ))}
      </div>
    </div>
  );
}
