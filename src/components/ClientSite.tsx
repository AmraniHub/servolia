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
  en: { book: "Book now", home: "Home", about: "About", services: "Services", why: "Why choose us", contact: "Get in touch", faq: "Questions", callUs: "Call us", emailUs: "Email us", visit: "Visit us", hours: "Hours", bookCta: "Book your appointment", bookSub: "Message our assistant or reach us directly — we respond fast.", chat: "Chat with us", team: "Meet the team" },
  fr: { book: "Réserver", home: "Accueil", about: "Cabinet", services: "Services", why: "Pourquoi nous choisir", contact: "Nous contacter", faq: "Questions", callUs: "Appelez-nous", emailUs: "Écrivez-nous", visit: "Nous trouver", hours: "Horaires", bookCta: "Réservez votre rendez-vous", bookSub: "Écrivez à notre assistant ou contactez-nous directement — réponse rapide.", chat: "Discuter", team: "Notre équipe" },
};

/** Generic, widely-used minimalist glyphs for linking out to a client's own social profiles. */
function SocialIcon({ platform }: { platform: string }) {
  const common = { width: 15, height: 15, viewBox: "0 0 24 24", fill: "currentColor" } as const;
  switch (platform) {
    case "facebook":
      return <svg {...common}><path d="M13.5 21v-7.8h2.6l.4-3h-3V8.3c0-.87.24-1.46 1.5-1.46h1.6V4.14C15.9 4.1 15 4 13.9 4c-2.24 0-3.77 1.37-3.77 3.88v2.32H7.5v3h2.63V21h3.37z"/></svg>;
    case "instagram":
      return <svg {...common}><path d="M12 4.6c2.4 0 2.7 0 3.6.05 2.4.11 3.5 1.24 3.66 3.66.05.9.06 1.16.06 3.7s0 2.8-.06 3.7c-.11 2.4-1.24 3.55-3.66 3.66-.9.05-1.16.06-3.6.06s-2.7 0-3.6-.06c-2.43-.11-3.55-1.26-3.66-3.66-.05-.9-.06-1.16-.06-3.7s0-2.8.06-3.7c.11-2.42 1.24-3.55 3.66-3.66.9-.05 1.16-.05 3.6-.05zM12 3c-2.48 0-2.8.01-3.77.06-3.25.15-5.03 1.93-5.18 5.18C3 9.2 3 9.52 3 12s.01 2.8.06 3.77c.15 3.25 1.93 5.03 5.18 5.18C9.2 21 9.52 21 12 21s2.8-.01 3.77-.06c3.25-.15 5.03-1.93 5.18-5.18C21 14.8 21 14.48 21 12s-.01-2.8-.06-3.77c-.15-3.25-1.93-5.03-5.18-5.18C14.8 3 14.48 3 12 3zm0 4.6a4.4 4.4 0 1 0 0 8.8 4.4 4.4 0 0 0 0-8.8zm0 7.26a2.87 2.87 0 1 1 0-5.73 2.87 2.87 0 0 1 0 5.73zm4.6-7.44a1.03 1.03 0 1 1-2.05 0 1.03 1.03 0 0 1 2.05 0z"/></svg>;
    case "linkedin":
      return <svg {...common}><path d="M6.94 8.5H4.06V20h2.88V8.5zM5.5 4a1.67 1.67 0 1 0 0 3.34A1.67 1.67 0 0 0 5.5 4zM20 13.34c0-3.16-1.69-4.63-3.94-4.63a3.4 3.4 0 0 0-3.09 1.7h-.04V8.5H10.2c.04.86 0 11.5 0 11.5h2.88v-6.42c0-.34.02-.68.12-.93.27-.68.9-1.38 1.94-1.38 1.37 0 1.92 1.04 1.92 2.57V20H20v-6.66z"/></svg>;
    case "x":
      return <svg {...common}><path d="M17.75 3h3.02l-6.6 7.54L22 21h-6.08l-4.76-6.23L5.7 21H2.67l7.06-8.07L2 3h6.24l4.3 5.7L17.75 3zm-1.06 16.2h1.67L7.4 4.7H5.6l11.09 14.5z"/></svg>;
    default:
      return <svg {...common}><circle cx="12" cy="12" r="9" /></svg>;
  }
}

/** Shared CTA row for both hero variants (photo and flat-gradient). */
function HeroCtas({ c, t, accentDark }: { c: ClientSiteConfig; t: typeof T["en"]; accentDark: string }) {
  return (
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
  );
}

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

  const navItems = [
    { key: "home", label: t.home, href: "#" },
    { key: "about", label: t.about, href: "#about", show: !!c.about },
    { key: "services", label: t.services, href: "#services", show: c.services.length > 0 },
    { key: "why", label: t.why, href: "#why", show: c.whyUs.length > 0 },
    { key: "faq", label: t.faq, href: "#faq", show: c.faqs.length > 0 },
  ].filter((n) => n.show !== false);

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

      {/* Top info bar — address, phone, socials. Opt-in via expandedHeader so existing sites are untouched. */}
      {c.expandedHeader && (c.address || c.phone || (c.socialLinks && c.socialLinks.length > 0)) && (
        <div className="text-white text-xs" style={{ background: accentDark }}>
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-9 flex items-center justify-between gap-4">
            <div className="flex items-center gap-4 min-w-0 overflow-hidden">
              {c.address && <span className="hidden sm:flex items-center gap-1.5 truncate"><MapPin className="w-3 h-3 shrink-0" /> {c.address}</span>}
              {c.phone && <a href={`tel:${c.phone.replace(/\s+/g, "")}`} className="flex items-center gap-1.5 hover:opacity-80 shrink-0"><Phone className="w-3 h-3" /> {c.phone}</a>}
            </div>
            {c.socialLinks && c.socialLinks.length > 0 && (
              <div className="flex items-center gap-3 shrink-0">
                {c.socialLinks.map((s, i) => (
                  <a key={i} href={s.url} target="_blank" rel="noopener noreferrer" className="hover:opacity-80" aria-label={s.platform}>
                    <SocialIcon platform={s.platform} />
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-[#ECECEC]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 min-w-0">
            {c.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={c.logoUrl} alt={c.businessName} className="h-8 w-auto object-contain shrink-0" />
            ) : (
              <div className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-black text-sm shrink-0" style={{ background: accent }}>
                {initials}
              </div>
            )}
            <div className="min-w-0">
              <span className="font-black tracking-tight text-lg block truncate">{c.businessName}</span>
              {c.expandedHeader && c.tagline && <span className="text-[11px] text-[#71717A] block truncate leading-tight">{c.tagline}</span>}
            </div>
          </div>
          {c.expandedHeader && (
            <nav className="hidden md:flex items-center gap-6 shrink-0">
              {navItems.map((n) => (
                <a key={n.key} href={n.href} className="text-sm font-semibold text-[#3F3F46] hover:opacity-70 transition-opacity">
                  {n.label}
                </a>
              ))}
            </nav>
          )}
          <a href="#book" className="px-4 py-2 rounded-lg text-white text-sm font-semibold transition-opacity hover:opacity-90 shrink-0" style={{ background: accent }}>
            {t.book}
          </a>
        </div>
      </header>

      {/* Hero — photo-driven variant when the client has a real hero photo, otherwise the flat gradient */}
      {c.heroImageUrl ? (
        <section className="relative overflow-hidden rounded-b-[40px] sm:mx-4 sm:mt-4 sm:rounded-[40px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={c.heroImageUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
          <div className="absolute inset-0" style={{ background: `linear-gradient(180deg, ${accentDark}66, ${accentDark}CC)` }} />
          <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-28 text-center">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white leading-[1.05] tracking-tight max-w-3xl mx-auto">
              {c.heroHeadline}
            </h1>
            <p className="text-white/85 text-lg max-w-2xl mx-auto mt-6 leading-relaxed">{c.heroSub}</p>
            <HeroCtas c={c} t={t} accentDark={accentDark} />
          </div>
        </section>
      ) : (
        <section className="relative overflow-hidden" style={{ background: `linear-gradient(135deg, ${accentDark}, ${accent})` }}>
          <div className="absolute inset-0 opacity-30" style={{ background: "radial-gradient(600px 300px at 70% 0%, rgba(255,255,255,0.25), transparent)" }} />
          <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-28 text-center">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white leading-[1.05] tracking-tight max-w-3xl mx-auto">
              {c.heroHeadline}
            </h1>
            <p className="text-white/80 text-lg max-w-2xl mx-auto mt-6 leading-relaxed">{c.heroSub}</p>
            <HeroCtas c={c} t={t} accentDark={accentDark} />
          </div>
        </section>
      )}

      {/* Highlights — full-bleed photo "story cards", one per differentiator. Purely additive. */}
      {c.highlights && c.highlights.length > 0 && (
        <section className="py-10 lg:py-14 bg-white">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
            {c.highlights.map((h, i) => (
              <div key={i} className="relative overflow-hidden rounded-[40px] min-h-[280px] flex items-end">
                {h.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={h.imageUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
                ) : (
                  <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${accentDark}, ${accent})` }} />
                )}
                <div className="absolute inset-0" style={{ background: "linear-gradient(0deg, rgba(0,0,0,0.55), rgba(0,0,0,0.1) 60%)" }} />
                <div className="relative p-7 sm:p-9">
                  <h3 className="text-xl sm:text-2xl font-black text-white leading-tight max-w-md">{h.title}</h3>
                  <p className="text-white/85 text-sm mt-2 max-w-md leading-relaxed">{h.body}</p>
                  <a href="#book" className="inline-flex mt-5 px-5 py-2.5 rounded-full bg-white font-bold text-sm hover:bg-white/90 transition-colors" style={{ color: accentDark }}>
                    {h.ctaLabel ?? t.book}
                  </a>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Team — humanizes the business. Purely additive; only ever real photos of real people. */}
      {c.team && c.team.length > 0 && (
        <section className="py-16 lg:py-20 bg-[#FAFAF9]">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl sm:text-4xl font-black text-center mb-12">{t.team}</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {c.team.map((member, i) => (
                <div key={i} className="bg-white rounded-[28px] overflow-hidden border border-[#ECECEC]">
                  {member.photoUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={member.photoUrl} alt={member.name} className="w-full aspect-[4/3] object-cover" />
                  )}
                  <div className="p-5">
                    <h3 className="font-black text-base">{member.name}</h3>
                    <p className="text-xs font-bold uppercase tracking-widest mt-0.5" style={{ color: accent }}>{member.role}</p>
                    {member.bio && <p className="text-sm text-[#71717A] leading-relaxed mt-2">{member.bio}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* About */}
      {c.about && (
        <section id="about" className="py-16 lg:py-20 bg-white">
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
        <section id="why" className="py-16 lg:py-20 bg-white">
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
        <section id="faq" className="py-16 lg:py-20 bg-white">
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
        {c.expandedHeader && (navItems.length > 0 || (c.socialLinks && c.socialLinks.length > 0)) && (
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-[#ECECEC]">
            <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
              {navItems.map((n) => (
                <a key={n.key} href={n.href} className="text-sm font-semibold text-[#3F3F46] hover:opacity-70 transition-opacity">
                  {n.label}
                </a>
              ))}
            </nav>
            {c.socialLinks && c.socialLinks.length > 0 && (
              <div className="flex items-center gap-4">
                {c.socialLinks.map((s, i) => (
                  <a key={i} href={s.url} target="_blank" rel="noopener noreferrer" className="text-[#3F3F46] hover:opacity-70" aria-label={s.platform} style={{ color: accent }}>
                    <SocialIcon platform={s.platform} />
                  </a>
                ))}
              </div>
            )}
          </div>
        )}
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
