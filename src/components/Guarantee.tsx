import { ShieldCheck, RefreshCw, CalendarCheck } from "lucide-react";

/**
 * Results guarantee — the risk-reversal that makes the offer a no-brainer.
 * Honest and deliverable: a setup-refund window + a performance floor the
 * system genuinely controls (it answers every enquiry 24/7). No medical claims.
 */

const COPY = {
  en: {
    badge: "Our guarantee",
    h: "You risk nothing. We only win when you do.",
    sub: "We're so sure your system will pay for itself that we put our fee on the line.",
    cards: [
      { icon: CalendarCheck, title: "Live in 7 days or it's free", body: "We commit your delivery date in writing. Miss it and you get 10% back per day late — we've never had to." },
      { icon: ShieldCheck, title: "It answers every enquiry — guaranteed", body: "If your assistant isn't capturing patient enquiries 24/7 in month one, we fix it free until it does." },
      { icon: RefreshCw, title: "14-day setup refund", body: "Not convinced in the first two weeks? We refund your setup fee. No forms, no argument." },
    ],
  },
  fr: {
    badge: "Notre garantie",
    h: "Vous ne risquez rien. On ne gagne que si vous gagnez.",
    sub: "Nous sommes tellement sûrs que votre système sera rentable que nous engageons nos honoraires.",
    cards: [
      { icon: CalendarCheck, title: "En ligne en 7 jours, ou c'est gratuit", body: "Date de livraison engagée par écrit. En retard ? 10% remboursés par jour — ça n'est jamais arrivé." },
      { icon: ShieldCheck, title: "Chaque demande répondue — garanti", body: "Si votre assistant ne capte pas vos demandes 24h/24 le premier mois, on corrige gratuitement." },
      { icon: RefreshCw, title: "Remboursé sous 14 jours", body: "Pas convaincu en deux semaines ? On rembourse les frais d'installation. Sans discuter." },
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
