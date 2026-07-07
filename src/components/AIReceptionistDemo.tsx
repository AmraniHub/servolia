"use client";

import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { Bot, Send, Sparkles, RotateCcw } from "lucide-react";

type Msg = { role: "user" | "ai"; text: string };

/** Preset visitor questions → realistic AI receptionist answers, per language. */
const SCRIPTS: Record<"en" | "fr", { q: string; a: string }[]> = {
  en: [
    { q: "Do you take new patients for implants?", a: "Yes — we're welcoming new implant patients this month. A consultation includes a 3D scan and a fixed quote. I can hold Thursday 14:30 or Friday 10:00. Which suits you best?" },
    { q: "How much does a consultation cost?", a: "The first implant consultation is €90, fully deducted from your treatment if you go ahead. Would you like me to book it and send a confirmation by email?" },
    { q: "Are you open on weekends?", a: "We're open Saturday 9:00–13:00 for consultations. I have two Saturday slots left this week — shall I reserve one and add it to your calendar?" },
    { q: "Can I get a quote for a full smile makeover?", a: "Absolutely. A smile-makeover quote is built after a quick consult so it's accurate to your case. Most range €4,500–€12,000 with 0% financing available. Want me to book the consult?" },
  ],
  fr: [
    { q: "Acceptez-vous de nouveaux patients pour des implants ?", a: "Oui — nous accueillons de nouveaux patients pour les implants ce mois-ci. La consultation comprend un scan 3D et un devis fixe. Je peux retenir jeudi 14h30 ou vendredi 10h00. Que préférez-vous ?" },
    { q: "Combien coûte une consultation ?", a: "La première consultation implant est à 90 €, entièrement déduite de votre traitement si vous poursuivez. Souhaitez-vous que je la réserve et envoie une confirmation par e-mail ?" },
    { q: "Êtes-vous ouverts le week-end ?", a: "Nous sommes ouverts le samedi de 9h à 13h pour les consultations. Il me reste deux créneaux samedi cette semaine — voulez-vous que j'en réserve un et l'ajoute à votre agenda ?" },
    { q: "Puis-je avoir un devis pour une réfection complète du sourire ?", a: "Bien sûr. Un devis est établi après une courte consultation pour être précis. La plupart se situent entre 4 500 € et 12 000 €, avec un financement 0%. Voulez-vous que je réserve la consultation ?" },
  ],
};

const LABELS = {
  en: {
    title: "AI Receptionist", status: "online · demo", reset: "Reset",
    intro: "Hi 👋 I'm the Servolia AI receptionist for a dental clinic. Ask me anything a real patient would — try one below.",
    done: "That's the demo 🎉 The real one runs 24/7, books appointments, and saves every lead to your CRM.",
    placeholder: "Tap a question above to try it…",
  },
  fr: {
    title: "Réceptionniste IA", status: "en ligne · démo", reset: "Réinitialiser",
    intro: "Bonjour 👋 Je suis la réceptionniste IA Servolia d'un cabinet dentaire. Posez-moi une vraie question de patient — essayez ci-dessous.",
    done: "C'est la démo 🎉 La vraie tourne 24h/24, réserve les rendez-vous et enregistre chaque lead dans votre CRM.",
    placeholder: "Touchez une question ci-dessus pour essayer…",
  },
};

export default function AIReceptionistDemo({ lang = "en" }: { lang?: "en" | "fr" }) {
  const SCRIPT = SCRIPTS[lang];
  const L = LABELS[lang];
  const [messages, setMessages] = useState<Msg[]>([{ role: "ai", text: L.intro }]);
  const [typing, setTyping] = useState(false);
  const [asked, setAsked] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, typing]);

  const ask = (item: { q: string; a: string }) => {
    if (typing) return;
    setMessages((m) => [...m, { role: "user", text: item.q }]);
    setAsked((a) => [...a, item.q]);
    setTyping(true);
    window.setTimeout(() => {
      setTyping(false);
      setMessages((m) => [...m, { role: "ai", text: item.a }]);
    }, 1100);
  };

  const reset = () => {
    setMessages([{ role: "ai", text: L.intro }]);
    setAsked([]);
    setTyping(false);
  };

  const remaining = SCRIPT.filter((s) => !asked.includes(s.q));

  return (
    <div className="relative rounded-2xl border border-[#E8E6E0] bg-white shadow-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-[#091C20]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#0CA6E9] flex items-center justify-center">
            <Bot className="w-4 h-4 text-[#091C20]" />
          </div>
          <div>
            <p className="text-[#FAFAF7] text-sm font-bold leading-none">{L.title}</p>
            <p className="text-[#0CA6E9] text-[11px] font-semibold mt-1 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#0CA6E9] animate-pulse-dot" /> {L.status}
            </p>
          </div>
        </div>
        <button
          onClick={reset}
          className="flex items-center gap-1 text-[#FAFAF7]/50 hover:text-[#FAFAF7] text-[11px] font-semibold transition-colors"
        >
          <RotateCcw className="w-3 h-3" /> {L.reset}
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="h-[300px] overflow-y-auto px-4 py-4 space-y-3 bg-[#FAFAF7]">
        {messages.map((m, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className={`max-w-[82%] px-3.5 py-2.5 text-sm leading-snug ${
              m.role === "user"
                ? "ml-auto rounded-2xl rounded-br-sm bg-[#36671E] text-[#FAFAF7]"
                : "mr-auto rounded-2xl rounded-bl-sm bg-white border border-[#E8E6E0] text-[#18181B]"
            }`}
          >
            {m.text}
          </motion.div>
        ))}

        {typing && (
          <div className="mr-auto rounded-2xl rounded-bl-sm bg-white border border-[#E8E6E0] px-4 py-3 flex items-center gap-1">
            {[0, 1, 2].map((d) => (
              <span
                key={d}
                className="w-1.5 h-1.5 rounded-full bg-[#0CA6E9]"
                style={{ animation: `bounce 1.2s ${d * 0.15}s infinite ease-in-out` }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Suggested questions */}
      <div className="px-4 py-3 border-t border-[#E8E6E0] bg-white">
        {remaining.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {remaining.map((s) => (
              <button
                key={s.q}
                onClick={() => ask(s)}
                disabled={typing}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[#E8E6E0] bg-[#FAFAF7] text-[#36671E] text-xs font-semibold hover:border-[#36671E] hover:bg-[#EEF5EA] transition-all disabled:opacity-40"
              >
                <Sparkles className="w-3 h-3" /> {s.q}
              </button>
            ))}
          </div>
        ) : (
          <p className="text-center text-xs text-[#71717A]">{L.done}</p>
        )}
      </div>

      {/* Fake input bar */}
      <div className="flex items-center gap-2 px-4 py-3 border-t border-[#E8E6E0] bg-white">
        <div className="flex-1 px-3.5 py-2.5 rounded-full bg-[#FAFAF7] border border-[#E8E6E0] text-[#A1A1AA] text-sm">
          {L.placeholder}
        </div>
        <div className="w-9 h-9 rounded-full bg-[#36671E] flex items-center justify-center shrink-0">
          <Send className="w-4 h-4 text-[#FAFAF7]" />
        </div>
      </div>

      <style jsx>{`
        @keyframes bounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.5; }
          30% { transform: translateY(-5px); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
