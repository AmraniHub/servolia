"use client";

import ChatWidget, { type OwnChatCopy } from "@/components/ChatWidget";

/** Copy for Servolia's OWN widget — the one on servolia.com and /fr.
 *  It is deliberately not a generic "how can I help": a visitor talking to it
 *  is testing the exact product we sell, and the opening line says so. The
 *  chips are the three objections that actually block a booking, not a
 *  business-type menu — answering "what does it cost" beats classifying
 *  yourself before you have asked anything. */
const OWN_COPY: Record<"en" | "fr", OwnChatCopy> = {
  en: {
    greeting:
      "Hi — I'm the same AI receptionist Servolia installs for its clients. This site is running it live, so you're testing the real thing. Ask me what we build, what it costs, or how quickly you'd be live.",
    quickReplies: ["What does it cost?", "How fast would I be live?", "I already have a website"],
    placeholder: "Ask about pricing, timing, anything…",
    subtitle: "Replies instantly · a human reads every conversation",
  },
  fr: {
    greeting:
      "Bonjour — je suis la même réceptionniste IA que Servolia installe chez ses clients. Ce site la fait tourner en direct : vous testez donc le produit réel. Demandez-moi ce que nous construisons, combien ça coûte, ou en combien de temps vous seriez en ligne.",
    quickReplies: ["Combien ça coûte ?", "En combien de temps je suis en ligne ?", "J'ai déjà un site"],
    placeholder: "Tarifs, délais, questions…",
    subtitle: "Réponse immédiate · un humain lit chaque conversation",
  },
};

/**
 * Servolia's OWN chat — Solia, on servolia.com's marketing pages. Its words
 * live here, not in ChatWidget, so the neutral widget a practice's site loads
 * at her own domain carries none of them (C2 review, 2026-09-22).
 */
export default function ServoliaChat({ lang = "en" }: { lang?: "en" | "fr" }) {
  return (
    <ChatWidget
      brandName="Solia by Servolia"
      botName="Solia"
      lang={lang}
      ownCopy={OWN_COPY[lang === "fr" ? "fr" : "en"]}
      fallbackEmail="hello@servolia.com"
      poweredBy
      poweredByLabel="Servolia AI"
    />
  );
}
