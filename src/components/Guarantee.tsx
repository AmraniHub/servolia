import { ShieldCheck, RefreshCw, CalendarCheck } from "lucide-react";

/**
 * Risk-reversal — the "perceived likelihood" lever of the value equation.
 *
 * Every claim here must match src/app/legal/refund and the CGV exactly. The
 * deposit is non-refundable once work has begun, so we do NOT promise a
 * no-questions setup refund; we promise the two things the policy genuinely
 * grants (10%/day for lateness, full refund if we never deliver) plus a
 * performance floor the system itself controls. No medical claims, and no
 * track-record claims until there are real delivered clients to point at.
 */

const COPY = {
  en: {
    badge: "Our guarantee",
    h: "You risk nothing. We only win when you do.",
    sub: "The deadline, the price, and the scope are committed in writing before you pay a cent.",
    cards: [
      { icon: CalendarCheck, title: "Live in 7 days — or you're paid back", body: "Your delivery date is committed in writing. If we miss it through our own fault, you get 10% of the project price back for every day we're late." },
      { icon: ShieldCheck, title: "It answers every enquiry — guaranteed", body: "If your assistant isn't capturing enquiries 24/7 in month one, we keep fixing it free until it does." },
      { icon: RefreshCw, title: "We don't deliver, you don't pay", body: "If we can't deliver the scope we agreed, you get a full refund of your deposit. The scope is signed off before any work starts." },
    ],
  },
  fr: {
    badge: "Notre garantie",
    h: "Vous ne risquez rien. On ne gagne que si vous gagnez.",
    sub: "Le délai, le prix et le périmètre sont engagés par écrit avant le moindre paiement.",
    cards: [
      { icon: CalendarCheck, title: "En ligne en 7 jours — ou vous êtes remboursé", body: "Votre date de livraison est engagée par écrit. Si nous la manquons de notre fait, vous récupérez 10 % du prix par jour de retard." },
      { icon: ShieldCheck, title: "Chaque demande répondue — garanti", body: "Si votre assistant ne capte pas vos demandes 24h/24 le premier mois, nous corrigeons gratuitement jusqu'à ce que ce soit le cas." },
      { icon: RefreshCw, title: "Pas livré, pas payé", body: "Si nous ne pouvons pas livrer le périmètre convenu, votre acompte est intégralement remboursé. Le périmètre est validé avant tout début de travaux." },
    ],
  },
};

export default function Guarantee({ lang = "en" }: { lang?: "en" | "fr" }) {
  const t = COPY[lang];
  return (
    <section className="py-16 lg:py-24 bg-[#0A1F14] relative overflow-hidden">
      <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-[#36671E] opacity-20 blur-3xl pointer-events-none" />
      <div className="relative max-w-5xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-12">
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-[#ABDF90] text-xs font-black uppercase tracking-widest mb-5">
            <ShieldCheck className="w-3.5 h-3.5" /> {t.badge}
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-[#FAFAF7] max-w-3xl mx-auto leading-[1.1]">{t.h}</h2>
          <p className="text-[#ABDF90]/80 text-lg max-w-2xl mx-auto mt-5 leading-relaxed">{t.sub}</p>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          {t.cards.map((c) => (
            <div key={c.title} className="rounded-2xl bg-white/[0.04] border border-white/10 p-6 hover:bg-white/[0.07] transition-colors">
              <div className="w-11 h-11 rounded-xl bg-[#BEF264] flex items-center justify-center mb-4">
                <c.icon className="w-5 h-5 text-[#0A1F14]" />
              </div>
              <h3 className="text-[#FAFAF7] font-black text-base mb-2">{c.title}</h3>
              <p className="text-[#FAFAF7]/70 text-sm leading-relaxed">{c.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
