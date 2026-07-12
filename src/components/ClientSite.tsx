import ChatWidget from "@/components/ChatWidget";
import { MapPin, Phone, Mail, Clock, CheckCircle, ArrowRight, Calendar } from "lucide-react";
import type { ClientSiteConfig } from "@/lib/clientSites";

/** Slightly darken a hex color for gradients/hovers. */
function shade(hex: string, amt = -18): string {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  const clamp = (v: number) => Math.max(0, Math.min(255, v));
  const r = clamp((n >> 16) + amt);
  const g = clamp(((n >> 8) & 0xff) + amt);
  const b = clamp((n & 0xff) + amt);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

const T = {
  en: { book: "Book now", services: "Services", why: "Why choose us", contact: "Get in touch", faq: "Questions", callUs: "Call us", emailUs: "Email us", visit: "Visit us", hours: "Hours", bookCta: "Book your appointment", bookSub: "Message our assistant or reach us directly — we respond fast.", chat: "Chat with us" },
  fr: { book: "Réserver", services: "Services", why: "Pourquoi nous choisir", contact: "Nous contacter", faq: "Questions", callUs: "Appelez-nous", emailUs: "Écrivez-nous", visit: "Nous trouver", hours: "Horaires", bookCta: "Réservez votre rendez-vous", bookSub: "Écrivez à notre assistant ou contactez-nous directement — réponse rapide.", chat: "Discuter" },
};

export default function ClientSite({ config }: { config: ClientSiteConfig }) {
  const c = config;
  const accent = c.accent || "#36671E";
  const accentDark = shade(accent, -28);
  const t = T[c.language === "fr" ? "fr" : "en"];
  const initials = c.businessName.split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();

  const demoCta = c.demoContactUrl || "https://servolia.com/contact";
  const demoText = c.language === "fr"
    ? { tag: "DÉMO", line: `Ceci est un aperçu créé pour ${c.businessName}. Essayez le chat en bas à droite — c'est votre réceptionniste IA.`, cta: "Je veux ce système →" }
    : { tag: "DEMO", line: `This is a preview built for ${c.businessName}. Try the chat, bottom-right — it's your AI receptionist.`, cta: "I want this system →" };

  return (
    <div className="min-h-screen bg-white text-[#18181B] flex flex-col">
      {/* Prospect demo banner — the conversion hook while they play with the site */}
      {c.isDemo && (
        <div className="text-white text-sm" style={{ background: accentDark }}>
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex items-center justify-center gap-3 flex-wrap text-center">
            <span className="text-[10px] font-black tracking-widest px-2 py-0.5 rounded bg-white/20">{demoText.tag}</span>
            <span className="text-white/90">{demoText.line}</span>
            <a href={demoCta} className="font-black underline underline-offset-2 hover:opacity-80 whitespace-nowrap">{demoText.cta}</a>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-[#ECECEC]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            {c.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={c.logoUrl} alt={c.businessName} className="h-8 w-auto object-contain" />
            ) : (
              <div className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-black text-sm" style={{ background: accent }}>
                {initials}
              </div>
            )}
            <span className="font-black tracking-tight text-lg">{c.businessName}</span>
          </div>
          <a href="#book" className="px-4 py-2 rounded-lg text-white text-sm font-semibold transition-opacity hover:opacity-90" style={{ background: accent }}>
            {t.book}
          </a>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden" style={{ background: `linear-gradient(135deg, ${accentDark}, ${accent})` }}>
        <div className="absolute inset-0 opacity-30" style={{ background: "radial-gradient(600px 300px at 70% 0%, rgba(255,255,255,0.25), transparent)" }} />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-28 text-center">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white leading-[1.05] tracking-tight max-w-3xl mx-auto">
            {c.heroHeadline}
          </h1>
          <p className="text-white/80 text-lg max-w-2xl mx-auto mt-6 leading-relaxed">{c.heroSub}</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-9">
            <a href="#book" className="group px-8 py-4 rounded-xl bg-white font-black text-base flex items-center gap-2 hover:bg-white/90 transition-colors" style={{ color: accentDark }}>
              {t.book} <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </a>
            {c.phone && (
              <a href={`tel:${c.phone.replace(/\s+/g, "")}`} className="px-7 py-4 rounded-xl border border-white/30 text-white font-semibold text-base hover:bg-white/10 transition-colors flex items-center gap-2">
                <Phone className="w-4 h-4" /> {c.phone}
              </a>
            )}
          </div>
        </div>
      </section>

      {/* About */}
      {c.about && (
        <section className="py-16 lg:py-20 bg-white">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <p className="text-lg leading-relaxed text-[#3F3F46]">{c.about}</p>
          </div>
        </section>
      )}

      {/* Services */}
      {c.services.length > 0 && (
        <section id="services" className="py-16 lg:py-20 bg-[#FAFAF9]">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl sm:text-4xl font-black text-center mb-12">{t.services}</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {c.services.map((s, i) => (
                <div key={i} className="bg-white rounded-2xl p-6 border border-[#ECECEC] hover:shadow-lg transition-shadow">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <h3 className="text-base font-black">{s.name}</h3>
                    {s.price && (
                      <span className="text-xs font-bold px-2.5 py-1 rounded-full whitespace-nowrap" style={{ background: `${accent}14`, color: accentDark }}>
                        {s.price}
                      </span>
                    )}
                  </div>
                  {s.description && <p className="text-sm text-[#71717A] leading-relaxed">{s.description}</p>}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Why us */}
      {c.whyUs.length > 0 && (
        <section className="py-16 lg:py-20 bg-white">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl sm:text-4xl font-black text-center mb-12">{t.why}</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              {c.whyUs.map((w, i) => (
                <div key={i} className="flex items-start gap-3 bg-[#FAFAF9] rounded-xl p-4 border border-[#ECECEC]">
                  <CheckCircle className="w-5 h-5 mt-0.5 shrink-0" style={{ color: accent }} />
                  <span className="text-sm font-medium text-[#18181B]">{w}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Book / Contact */}
      <section id="book" className="py-20 lg:py-24" style={{ background: `linear-gradient(135deg, ${accentDark}, ${accent})` }}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-black text-white mb-3">{t.bookCta}</h2>
          <p className="text-white/75 mb-10 max-w-xl mx-auto">{t.bookSub}</p>
          <div className="grid sm:grid-cols-3 gap-4 text-left">
            {c.phone && (
              <a href={`tel:${c.phone.replace(/\s+/g, "")}`} className="bg-white/10 hover:bg-white/15 transition-colors rounded-2xl p-5 border border-white/15">
                <Phone className="w-5 h-5 text-white mb-3" />
                <p className="text-white/60 text-xs font-bold uppercase tracking-widest mb-1">{t.callUs}</p>
                <p className="text-white font-semibold text-sm">{c.phone}</p>
              </a>
            )}
            {c.email && (
              <a href={`mailto:${c.email}`} className="bg-white/10 hover:bg-white/15 transition-colors rounded-2xl p-5 border border-white/15">
                <Mail className="w-5 h-5 text-white mb-3" />
                <p className="text-white/60 text-xs font-bold uppercase tracking-widest mb-1">{t.emailUs}</p>
                <p className="text-white font-semibold text-sm break-all">{c.email}</p>
              </a>
            )}
            {(c.address || c.hours) && (
              <div className="bg-white/10 rounded-2xl p-5 border border-white/15">
                {c.address ? <MapPin className="w-5 h-5 text-white mb-3" /> : <Clock className="w-5 h-5 text-white mb-3" />}
                <p className="text-white/60 text-xs font-bold uppercase tracking-widest mb-1">{c.address ? t.visit : t.hours}</p>
                {c.address && <p className="text-white font-semibold text-sm">{c.address}</p>}
                {c.hours && <p className="text-white/80 text-xs mt-1 flex items-center gap-1"><Clock className="w-3 h-3" /> {c.hours}</p>}
              </div>
            )}
          </div>
          {c.bookingUrl && (
            <a href={c.bookingUrl} className="inline-flex items-center gap-2 mt-8 px-8 py-4 rounded-xl bg-white font-black text-base hover:bg-white/90 transition-colors" style={{ color: accentDark }}>
              <Calendar className="w-4 h-4" /> {t.book}
            </a>
          )}
        </div>
      </section>

      {/* FAQ */}
      {c.faqs.length > 0 && (
        <section className="py-16 lg:py-20 bg-white">
          <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl font-black text-center mb-10">{t.faq}</h2>
            <div className="space-y-3">
              {c.faqs.map((f, i) => (
                <details key={i} className="group bg-[#FAFAF9] border border-[#ECECEC] rounded-xl overflow-hidden">
                  <summary className="flex items-center justify-between px-6 py-4 cursor-pointer list-none">
                    <span className="font-bold text-sm">{f.q}</span>
                    <span className="text-[#71717A] transition-transform group-open:rotate-45 text-xl leading-none">+</span>
                  </summary>
                  <div className="px-6 pb-5 text-[#71717A] text-sm leading-relaxed border-t border-[#EFEFEF] pt-4">{f.a}</div>
                </details>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="mt-auto border-t border-[#ECECEC] bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <span className="font-black">{c.businessName}</span>
          <p className="text-[#A1A1AA] text-xs">
            © {new Date().getFullYear()} {c.businessName}. {c.city ? `${c.city}. ` : ""}
            <span className="opacity-70">Built with Servolia</span>
          </p>
        </div>
      </footer>

      {/* The client's own AI receptionist */}
      <ChatWidget
        siteSlug={c.slug}
        brandName={`${c.businessName}`}
        botName={c.businessName}
        accent={accent}
        greeting={c.aiGreeting}
        poweredBy={false}
      />
    </div>
  );
}
