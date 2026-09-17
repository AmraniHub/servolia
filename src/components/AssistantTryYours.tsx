"use client";

import { useState } from "react";
import { ArrowRight, Globe } from "lucide-react";
import AssistantDemo from "./AssistantDemo";

/**
 * "Type your domain, watch YOUR assistant" — the interactive heart of
 * /assistant.
 *
 * The page opens on the fixed fictitious example, so there is something
 * worth watching before anyone types. A domain swaps it for that business:
 * the probe reads their homepage for the name, the colour and the
 * languages, and the same film replays wearing them. The EXEMPLE badge and
 * the invented lead stay — it is still an example, now it is THEIR example.
 *
 * The probe can fail (site down, blocks robots, never existed): that is a
 * quieter success, not an error. The demo still carries a name derived
 * from the domain, because "we could not read your site" must never render
 * as "this product does not work".
 */

interface Brand {
  domain: string;
  name: string;
  accent: string;
  languages: ("ar" | "fr" | "en")[];
  niche: string | null;
  fallback: boolean;
}

const T = {
  en: {
    label: "See it on your own business",
    placeholder: "yourdomain.com",
    go: "Show me",
    working: "Reading your site…",
    invalid: "That does not look like a domain — try yourdomain.com",
    failed: "Could not reach that site — showing your name on the example instead.",
    showing: (d: string) => `Example for ${d}`,
    cta: (d: string) => `Get it for ${d}`,
    ctaGeneric: "Get the assistant — $12/month",
    price: "$12/month or $120/year · installed for you · cancel anytime",
    tryLive: "Prefer to talk to one? Try a live assistant",
  },
  fr: {
    label: "Voyez-le sur votre propre entreprise",
    placeholder: "votredomaine.com",
    go: "Voir",
    working: "Lecture de votre site…",
    invalid: "Cela ne ressemble pas à un domaine — essayez votredomaine.com",
    failed: "Site injoignable — l'exemple porte votre nom quand même.",
    showing: (d: string) => `Exemple pour ${d}`,
    cta: (d: string) => `L'activer pour ${d}`,
    ctaGeneric: "Activer l'assistant — 12 $/mois",
    price: "12 $/mois ou 120 $/an · installé pour vous · résiliable à tout moment",
    tryLive: "Vous préférez lui parler ? Essayez un assistant en direct",
  },
} as const;

export default function AssistantTryYours({ lang = "en" }: { lang?: "en" | "fr" }) {
  const t = T[lang];
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [brand, setBrand] = useState<Brand | null>(null);

  async function probe() {
    const typed = input.trim();
    if (!typed) return;
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch(`/api/assistant-preview?domain=${encodeURIComponent(typed)}`);
      if (res.status === 400) { setNote(t.invalid); return; }
      const data = (await res.json()) as Brand & { ok: boolean };
      if (!data.ok) { setNote(t.invalid); return; }
      setBrand(data);
      if (data.fallback) setNote(t.failed);
    } catch {
      setNote(t.invalid);
    } finally {
      setBusy(false);
    }
  }

  const payHref = brand
    ? `/hosting?plan=chatbot&site=${encodeURIComponent(brand.domain)}${lang === "fr" ? "&lang=fr" : ""}`
    : `/hosting?plan=chatbot${lang === "fr" ? "&lang=fr" : ""}`;

  return (
    <div className="max-w-[560px] mx-auto">
      {/* The one input. Everything below reacts to it. */}
      <label htmlFor="try-domain" className="block text-[11px] font-black uppercase tracking-[0.18em] text-[#36671E] mb-2 text-center">
        {t.label}
      </label>
      <div className="flex gap-2 mb-2">
        <div className="relative flex-1">
          <Globe className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A1A1AA]" />
          <input
            id="try-domain"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") probe(); }}
            placeholder={t.placeholder}
            inputMode="url"
            autoCapitalize="none"
            spellCheck={false}
            className="w-full h-12 pl-10 pr-3.5 text-[15px] border border-[#E8E6E0] rounded-xl bg-white outline-none focus:border-[#36671E] focus:ring-2 focus:ring-[#36671E]/15"
          />
        </div>
        <button
          type="button"
          onClick={probe}
          disabled={busy || !input.trim()}
          className="h-12 px-5 rounded-xl bg-[#18181B] text-white font-bold hover:bg-[#27272A] disabled:opacity-50 transition"
        >
          {busy ? t.working : t.go}
        </button>
      </div>
      <p className={`text-[12.5px] text-center min-h-[18px] mb-6 ${note ? "text-[#92700E]" : "text-transparent"}`} data-testid="try-note">
        {note ?? "·"}
      </p>

      {brand ? (
        <p className="text-center text-[13px] font-bold text-[#36671E] mb-3" data-testid="try-showing">
          {t.showing(brand.domain)}
        </p>
      ) : null}

      <AssistantDemo
        key={brand?.domain ?? "example"}
        lang={lang}
        niche={brand?.niche ?? undefined}
        languages={brand?.languages}
        accent={brand?.accent}
        business={brand ? { name: brand.name, domain: brand.domain } : undefined}
      />

      <div className="mt-8 text-center">
        <a
          href={payHref}
          data-testid="try-cta"
          className="inline-flex items-center gap-2 h-12 px-7 rounded-xl bg-gradient-to-r from-[#36671E] to-[#295115] text-[#FAFAF7] font-bold hover:opacity-90 transition"
        >
          {brand ? t.cta(brand.domain) : t.ctaGeneric} <ArrowRight className="w-4 h-4" />
        </a>
        <p className="mt-3 text-[13px] text-[#8A8A80]">{t.price}</p>
        <p className="mt-5 text-[13px]">
          <a href="/hosting/assistant/try?site=demo-study-abroad" className="text-[#36671E] font-semibold hover:underline">
            {t.tryLive} →
          </a>
        </p>
      </div>
    </div>
  );
}
