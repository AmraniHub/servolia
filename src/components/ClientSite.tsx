import ChatWidget from "@/components/ChatWidget";
import BookingForm from "@/components/BookingForm";
import { MapPin, Phone, Mail, Clock, CheckCircle, ArrowRight, Calendar, Check } from "lucide-react";
import type { ClientSiteConfig, ClientExpertiseBlock, ClientHighlight } from "@/lib/clientSites";

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
  en: { book: "Book now", home: "Home", about: "About", expertise: "Expertise", services: "Services", advice: "Advice", contactShort: "Contact", why: "Why choose us", faq: "Questions", callUs: "Call us", emailUs: "Email us", visit: "Visit us", hours: "Hours", bookCta: "Book your appointment", bookSub: "Fill in the form and the practice will get back to you fast — or reach us directly.", orReach: "Or reach us directly", chat: "Chat with us", team: "Meet the team", teamEyebrow: "The people behind your care", backHome: "Home", processTitle: "How it works", processEyebrow: "Your journey", solutionsTitle: "Treatment options", solutionsEyebrow: "What we treat", valuesTitle: "Our commitments", valuesEyebrow: "Why patients trust us", adviceTitle: "Advice & aftercare", adviceEyebrow: "We're with you", learnMore: "Learn more", ourExpertise: "Our expertise", expertiseEyebrow: "Our know-how" },
  fr: { book: "Réserver", home: "Accueil", about: "Cabinet", expertise: "Expertise", services: "Services", advice: "Conseils", contactShort: "Contact", why: "Pourquoi nous choisir", faq: "Questions", callUs: "Appelez-nous", emailUs: "Écrivez-nous", visit: "Nous trouver", hours: "Horaires", bookCta: "Réservez votre rendez-vous", bookSub: "Remplissez le formulaire et le cabinet vous recontacte rapidement — ou contactez-nous directement.", orReach: "Ou contactez-nous directement", chat: "Discuter", team: "Notre équipe", teamEyebrow: "Les visages de votre prise en charge", backHome: "Accueil", processTitle: "Comment ça se passe", processEyebrow: "Votre parcours", solutionsTitle: "Nos solutions", solutionsEyebrow: "Ce que nous traitons", valuesTitle: "Nos engagements", valuesEyebrow: "Pourquoi nous faire confiance", adviceTitle: "Conseils & suivi", adviceEyebrow: "On vous accompagne", learnMore: "En savoir plus", ourExpertise: "Notre expertise", expertiseEyebrow: "Notre savoir-faire" },
};
type Dict = typeof T["en"];

export type ClientSitePage = "home" | "cabinet" | "expertise" | "services" | "conseils";

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
function HeroCtas({ c, t, accentDark }: { c: ClientSiteConfig; t: Dict; accentDark: string }) {
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

/** Background photo(s) for a hero/banner. 1 image = static; 2 = gentle CSS
 *  crossfade slider (top image fades to reveal the base, then back). */
function PhotoStack({ images, overlay }: { images: string[]; overlay: string }) {
  const imgs = images.filter(Boolean).slice(0, 2);
  return (
    <div className="absolute inset-0">
      {imgs.map((src, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={i} src={src} alt="" className={`absolute inset-0 w-full h-full object-cover ${i === 1 ? "svl-slide-top" : ""}`} />
      ))}
      <div className="absolute inset-0" style={{ background: overlay }} />
    </div>
  );
}

/** Consistent section header (eyebrow + title + optional subtitle). */
function SectionHead({ eyebrow, title, subtitle, accent }: { eyebrow?: string; title: string; subtitle?: string; accent: string }) {
  return (
    <div className="text-center max-w-2xl mx-auto mb-12 lg:mb-14">
      {eyebrow && <p className="text-xs font-black uppercase tracking-[0.22em] mb-3" style={{ color: accent }}>{eyebrow}</p>}
      <h2 className="text-3xl sm:text-4xl font-black tracking-tight leading-tight">{title}</h2>
      {subtitle && <p className="text-[#52525B] mt-4 leading-relaxed">{subtitle}</p>}
    </div>
  );
}

/** Alternating image/text feature row — used for homepage highlights and Expertise blocks. */
function FeatureRow({ block, reverse, accent, accentDark, t }: { block: ClientExpertiseBlock | ClientHighlight; reverse: boolean; accent: string; accentDark: string; t: Dict }) {
  const eyebrow = "eyebrow" in block ? block.eyebrow : undefined;
  const bullets = "bullets" in block ? block.bullets : undefined;
  const ctaLabel = "ctaLabel" in block ? block.ctaLabel : undefined;
  return (
    <div className="grid lg:grid-cols-2 gap-8 lg:gap-14 items-center">
      <div className={`relative rounded-[32px] overflow-hidden aspect-[4/3] shadow-sm ${reverse ? "lg:order-2" : ""}`}>
        {block.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={block.imageUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${accentDark}, ${accent})` }} />
        )}
      </div>
      <div className={reverse ? "lg:order-1" : ""}>
        {eyebrow && <p className="text-xs font-black uppercase tracking-[0.22em] mb-3" style={{ color: accent }}>{eyebrow}</p>}
        <h3 className="text-2xl sm:text-3xl font-black tracking-tight leading-tight">{block.title}</h3>
        <p className="text-[#52525B] mt-4 leading-relaxed">{block.body}</p>
        {bullets && bullets.length > 0 && (
          <ul className="mt-5 space-y-2.5">
            {bullets.map((b, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm text-[#3F3F46]">
                <Check className="w-4 h-4 mt-0.5 shrink-0" style={{ color: accent }} /> <span>{b}</span>
              </li>
            ))}
          </ul>
        )}
        <a href="#book" className="inline-flex items-center gap-2 mt-7 px-6 py-3 rounded-full font-bold text-sm text-white hover:opacity-90 transition-opacity" style={{ background: accent }}>
          {ctaLabel ?? t.book} <ArrowRight className="w-4 h-4" />
        </a>
      </div>
    </div>
  );
}

export default function ClientSite({ config, page = "home" }: { config: ClientSiteConfig; page?: ClientSitePage }) {
  const c = config;
  const accent = c.accent || "#36671E";
  const accentDark = shade(accent, -28);
  const t = T[c.language === "fr" ? "fr" : "en"];
  const initials = c.businessName.split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();

  const demoCta = c.demoContactUrl || "https://servolia.com/contact";
  const demoText = c.language === "fr"
    ? { tag: "DÉMO", line: `Ceci est un aperçu créé pour ${c.businessName}. Essayez le chat en bas à droite — c'est votre réceptionniste IA.`, cta: "Je veux ce système →", dash: "Voir le tableau de bord →" }
    : { tag: "DEMO", line: `This is a preview built for ${c.businessName}. Try the chat, bottom-right — it's your AI receptionist.`, cta: "I want this system →", dash: "See the dashboard →" };

  const isMulti = !!c.multiPage;
  const isHome = page === "home";
  // On a single-page site every section renders on the one page; on a multi-page
  // site each section is placed on the page(s) listed here.
  const on = (...pages: ClientSitePage[]) => (isMulti ? pages.includes(page) : true);

  const hasTeam = !!c.team && c.team.length > 0;
  const hasValues = !!c.values && c.values.length > 0;
  const hasExpertise = !!c.expertise && c.expertise.length > 0;
  const hasSolutions = !!c.solutions && c.solutions.length > 0;
  const hasProcess = !!c.process && c.process.length > 0;
  const hasAdvice = !!c.advice && c.advice.length > 0;
  const hasStats = !!c.stats && c.stats.length > 0;
  const hasHighlights = !!c.highlights && c.highlights.length > 0;

  const basePath = `/sites/${c.slug}`;
  const nav = [
    { key: "home", label: t.home, anchor: "#top", route: basePath, show: true },
    { key: "cabinet", label: t.about, anchor: "#about", route: `${basePath}/cabinet`, show: !!c.about || hasTeam || hasValues },
    { key: "expertise", label: t.expertise, anchor: "#expertise", route: `${basePath}/expertise`, show: hasExpertise || hasSolutions },
    { key: "conseils", label: t.advice, anchor: "#conseils", route: `${basePath}/conseils`, show: hasAdvice || c.whyUs.length > 0 || c.faqs.length > 0 },
    { key: "contact", label: t.contactShort, anchor: "#book", route: "#book", show: true },
  ].filter((n) => n.show);
  const navHref = (n: { key: string; anchor: string; route: string }) =>
    n.key === "contact" ? "#book" : isMulti ? n.route : n.anchor;

  const pageTitle = page === "cabinet" ? t.about : page === "expertise" ? t.expertise : page === "services" ? t.services : page === "conseils" ? t.advice : "";

  // Hero photos (slider takes precedence over the single heroImageUrl).
  const heroImgs = c.heroImages && c.heroImages.length ? c.heroImages : c.heroImageUrl ? [c.heroImageUrl] : [];
  // Sub-page banner photos, if any, for the current page.
  const bannerImgs = isHome ? [] : c.pageBanners?.[page] ?? [];
  const heroOverlay = `linear-gradient(180deg, ${accentDark}66, ${accentDark}CC)`;
  const bannerOverlay = `linear-gradient(135deg, ${accentDark}E0, ${accent}A6)`;

  return (
    <div id="top" className="min-h-screen bg-white text-[#18181B] flex flex-col">
      {/* Prospect demo banner — the conversion hook while they play with the site */}
      {c.isDemo && (
        <div className="text-white text-sm" style={{ background: accentDark }}>
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex items-center justify-center gap-3 flex-wrap text-center">
            <span className="text-[10px] font-black tracking-widest px-2 py-0.5 rounded bg-white/20">{demoText.tag}</span>
            <span className="text-white/90">{demoText.line}</span>
            <a href={demoCta} className="font-black underline underline-offset-2 hover:opacity-80 whitespace-nowrap">{demoText.cta}</a>
            <a href={`${basePath}/dashboard`} className="font-bold text-white/80 underline underline-offset-2 hover:text-white whitespace-nowrap">{demoText.dash}</a>
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
          <a href={isMulti ? basePath : "#top"} className="flex items-center gap-2.5 min-w-0">
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
          </a>
          {c.expandedHeader && (
            <nav className="hidden md:flex items-center gap-6 shrink-0">
              {nav.filter((n) => n.key !== "contact").map((n) => (
                <a key={n.key} href={navHref(n)} className={`text-sm font-semibold transition-opacity hover:opacity-70 ${n.key === page ? "" : "text-[#3F3F46]"}`} style={n.key === page ? { color: accent } : undefined}>
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

      {/* Page-title banner for sub-pages of a multi-page site */}
      {!isHome && (
        <section className="relative overflow-hidden" style={{ background: `linear-gradient(135deg, ${accentDark}, ${accent})` }}>
          {bannerImgs.length > 0 ? (
            <PhotoStack images={bannerImgs} overlay={bannerOverlay} />
          ) : (
            <div className="absolute inset-0 opacity-25" style={{ background: "radial-gradient(600px 240px at 75% 0%, rgba(255,255,255,0.3), transparent)" }} />
          )}
          <div className={`relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center ${bannerImgs.length > 0 ? "py-20 lg:py-28" : "py-14 lg:py-20"}`}>
            <a href={isMulti ? basePath : "#top"} className="text-white/80 text-xs font-semibold hover:text-white transition-colors">← {t.backHome}</a>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight mt-2 [text-shadow:0_2px_16px_rgba(0,0,0,0.25)]">{pageTitle}</h1>
            {page === "expertise" && c.expertiseIntro && (
              <p className="text-white/90 max-w-2xl mx-auto mt-5 leading-relaxed">{c.expertiseIntro}</p>
            )}
          </div>
        </section>
      )}

      {/* Hero — photo-driven variant when the client has a real hero photo, otherwise the flat gradient */}
      {isHome && (heroImgs.length > 0 ? (
        <section className="relative overflow-hidden rounded-b-[40px] sm:mx-4 sm:mt-4 sm:rounded-[40px]">
          <PhotoStack images={heroImgs} overlay={heroOverlay} />
          <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-28 text-center">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white leading-[1.05] tracking-tight max-w-3xl mx-auto [text-shadow:0_2px_16px_rgba(0,0,0,0.25)]">
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
      ))}

      {/* Stats / trust band */}
      {hasStats && on("home", "cabinet") && (
        <section className="bg-[#FAFAF9] border-y border-[#ECECEC]">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-2 lg:grid-cols-4">
            {c.stats!.map((s, i) => (
              <div key={i} className="py-8 lg:py-10 text-center border-[#ECECEC] [&:nth-child(odd)]:border-r lg:[&]:border-r lg:[&:last-child]:border-r-0 [&:nth-child(n+3)]:border-t lg:[&:nth-child(n+3)]:border-t-0">
                <div className="text-3xl lg:text-4xl font-black tracking-tight" style={{ color: accentDark }}>{s.value}</div>
                <div className="text-xs text-[#71717A] mt-1.5 px-2">{s.label}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Homepage feature rows (highlights) — alternating image/text */}
      {hasHighlights && on("home") && (
        <section id="expertise" className="py-16 lg:py-24 bg-white">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16 lg:space-y-24">
            {c.highlights!.map((h, i) => (
              <FeatureRow key={i} block={h} reverse={i % 2 === 1} accent={accent} accentDark={accentDark} t={t} />
            ))}
          </div>
        </section>
      )}

      {/* Expertise page — in-depth alternating blocks */}
      {hasExpertise && on("expertise") && (
        <section className="py-16 lg:py-24 bg-white">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16 lg:space-y-24">
            {c.expertise!.map((b, i) => (
              <FeatureRow key={i} block={b} reverse={i % 2 === 1} accent={accent} accentDark={accentDark} t={t} />
            ))}
          </div>
        </section>
      )}

      {/* Process / consultation timeline */}
      {hasProcess && on("home", "expertise") && (
        <section className="py-16 lg:py-24 bg-[#FAFAF9]">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <SectionHead eyebrow={t.processEyebrow} title={t.processTitle} accent={accent} />
            <div className="grid md:grid-cols-3 gap-5 lg:gap-6">
              {c.process!.map((p, i) => (
                <div key={i} className="relative bg-white rounded-[24px] p-7 border border-[#ECECEC]">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center font-black text-white text-sm" style={{ background: accent }}>{i + 1}</div>
                    {p.meta && <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: `${accent}14`, color: accentDark }}>{p.meta}</span>}
                  </div>
                  <h3 className="font-black text-lg">{p.title}</h3>
                  <p className="text-sm text-[#71717A] leading-relaxed mt-2">{p.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Solutions grid (Expertise page) */}
      {hasSolutions && on("expertise") && (
        <section className="py-16 lg:py-24 bg-white">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <SectionHead eyebrow={t.solutionsEyebrow} title={t.solutionsTitle} accent={accent} />
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {c.solutions!.map((s, i) => (
                <div key={i} className="bg-[#FAFAF9] rounded-2xl p-6 border border-[#ECECEC]">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4" style={{ background: `${accent}14` }}>
                    <CheckCircle className="w-5 h-5" style={{ color: accent }} />
                  </div>
                  <h3 className="text-base font-black">{s.title}</h3>
                  {s.body && <p className="text-sm text-[#71717A] leading-relaxed mt-2">{s.body}</p>}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* About */}
      {c.about && on("home", "cabinet") && (
        <section id="about" className="py-16 lg:py-20 bg-white">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <p className="text-lg leading-relaxed text-[#3F3F46]">{c.about}</p>
          </div>
        </section>
      )}

      {/* Values / commitments (Cabinet page) */}
      {hasValues && on("cabinet") && (
        <section className="py-16 lg:py-24 bg-[#FAFAF9]">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <SectionHead eyebrow={t.valuesEyebrow} title={t.valuesTitle} accent={accent} />
            <div className="grid sm:grid-cols-2 gap-5">
              {c.values!.map((v, i) => (
                <div key={i} className="flex items-start gap-4 bg-white rounded-2xl p-6 border border-[#ECECEC]">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${accent}14` }}>
                    <Check className="w-5 h-5" style={{ color: accent }} />
                  </div>
                  <div>
                    <h3 className="font-black text-base">{v.title}</h3>
                    <p className="text-sm text-[#71717A] leading-relaxed mt-1.5">{v.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Team — humanizes the business. Photos only ever of real people; otherwise a clean monogram avatar. */}
      {hasTeam && on("cabinet") && (
        <section className="py-16 lg:py-24 bg-white">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <SectionHead eyebrow={t.teamEyebrow} title={t.team} accent={accent} />
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {c.team!.map((member, i) => (
                <div key={i} className="bg-[#FAFAF9] rounded-[24px] overflow-hidden border border-[#ECECEC] text-center">
                  {member.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={member.photoUrl} alt={member.name} className="w-full aspect-[4/3] object-cover" />
                  ) : (
                    <div className="w-full aspect-[4/3] flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${accent}22, ${accent}0D)` }}>
                      <div className="w-20 h-20 rounded-full flex items-center justify-center text-2xl font-black text-white" style={{ background: accent }}>
                        {member.name.replace(/^Dr\.?\s*/i, "").split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase()}
                      </div>
                    </div>
                  )}
                  <div className="p-5">
                    <h3 className="font-black text-base">{member.name}</h3>
                    <p className="text-xs font-bold uppercase tracking-widest mt-0.5" style={{ color: accent }}>{member.role}</p>
                    {member.bio && <p className="text-sm text-[#71717A] leading-relaxed mt-2.5">{member.bio}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Services */}
      {c.services.length > 0 && on("home", "services") && (
        <section id="services" className="py-16 lg:py-24 bg-[#FAFAF9]">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <SectionHead title={t.services} accent={accent} />
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

      {/* Advice / aftercare cards (Conseils page) */}
      {hasAdvice && on("conseils") && (
        <section id="conseils" className="py-16 lg:py-24 bg-white">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <SectionHead eyebrow={t.adviceEyebrow} title={t.adviceTitle} accent={accent} />
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {c.advice!.map((a, i) => (
                <div key={i} className="flex flex-col bg-white rounded-[20px] border border-[#ECECEC] p-6 hover:shadow-lg transition-shadow">
                  <h3 className="font-black text-base leading-snug">{a.title}</h3>
                  <p className="text-sm text-[#71717A] leading-relaxed mt-2 flex-1">{a.body}</p>
                  <a href="#book" className="inline-flex items-center gap-1.5 mt-4 text-sm font-bold hover:opacity-70 transition-opacity" style={{ color: accent }}>
                    {t.learnMore} <ArrowRight className="w-3.5 h-3.5" />
                  </a>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Why us */}
      {c.whyUs.length > 0 && on("home", "conseils") && (
        <section id="why" className="py-16 lg:py-24 bg-[#FAFAF9]">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <SectionHead title={t.why} accent={accent} />
            <div className="grid sm:grid-cols-2 gap-4">
              {c.whyUs.map((w, i) => (
                <div key={i} className="flex items-start gap-3 bg-white rounded-xl p-4 border border-[#ECECEC]">
                  <CheckCircle className="w-5 h-5 mt-0.5 shrink-0" style={{ color: accent }} />
                  <span className="text-sm font-medium text-[#18181B]">{w}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* FAQ */}
      {c.faqs.length > 0 && on("home", "conseils") && (
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

      {/* Book / Contact — on every page (the conversion point) */}
      <section id="book" className="py-20 lg:py-24" style={{ background: `linear-gradient(135deg, ${accentDark}, ${accent})` }}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-black text-white mb-3">{t.bookCta}</h2>
          <p className="text-white/75 mb-8 max-w-xl mx-auto">{t.bookSub}</p>

          {/* Booking form — the primary conversion action. On demo sites it looks
              and feels real but never submits anywhere. */}
          <BookingForm slug={c.slug} services={c.services} accent={accent} accentDark={accentDark} language={c.language === "fr" ? "fr" : "en"} demo={!!c.isDemo} />

          <p className="text-white/70 text-sm font-semibold mt-10 mb-4">{t.orReach}</p>
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

      {/* Footer */}
      <footer className="mt-auto border-t border-[#ECECEC] bg-white">
        {c.expandedHeader && (nav.length > 0 || (c.socialLinks && c.socialLinks.length > 0)) && (
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-[#ECECEC]">
            <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
              {nav.map((n) => (
                <a key={n.key} href={navHref(n)} className="text-sm font-semibold text-[#3F3F46] hover:opacity-70 transition-opacity">
                  {n.label}
                </a>
              ))}
            </nav>
            {c.socialLinks && c.socialLinks.length > 0 && (
              <div className="flex items-center gap-4">
                {c.socialLinks.map((s, i) => (
                  <a key={i} href={s.url} target="_blank" rel="noopener noreferrer" className="hover:opacity-70" aria-label={s.platform} style={{ color: accent }}>
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
