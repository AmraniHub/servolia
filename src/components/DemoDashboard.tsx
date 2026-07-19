"use client";

import { useMemo, useState } from "react";
import type { ClientSiteConfig } from "@/lib/clientSites";
import {
  LayoutDashboard, Users, BarChart3, ArrowLeft, ArrowRight, Globe, CheckCircle,
  Moon, CalendarCheck, MessageSquare, Megaphone, Download, Sparkles, Bot, CreditCard,
} from "lucide-react";

/** Slightly darken a hex color. */
function shade(hex: string, amt = -28): string {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  const clamp = (v: number) => Math.max(0, Math.min(255, v));
  const r = clamp((n >> 16) + amt), g = clamp(((n >> 8) & 0xff) + amt), b = clamp((n & 0xff) + amt);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

const T = {
  fr: {
    demo: "DÉMO", back: "Retour au site", dashTitle: "Tableau de bord",
    intro: "Voici le back-office que vous recevez avec votre système. Chaque lead capté par votre assistant IA, vos réservations et un rapport mensuel de résultats — au même endroit.",
    system: "Votre système complet", want: "Je veux ce système",
    pillars: [
      { icon: Globe, t: "Site web IA", d: "Un site multi-pages, rapide et pensé pour convertir." },
      { icon: Bot, t: "Réceptionniste IA", d: "Répond et capte les coordonnées 24h/24, 7j/7." },
      { icon: CalendarCheck, t: "Réservations", d: "Chaque demande de RDV captée et centralisée." },
      { icon: BarChart3, t: "CRM & rapports", d: "Vos leads, vos résultats, votre ROI en un coup d'œil." },
    ],
    tabs: { overview: "Vue d'ensemble", leads: "Mes leads", reports: "Rapports" },
    kpis: { enquiries: "Demandes ce mois-ci", bookings: "Demandes de RDV", afterHours: "Captés hors horaires", response: "Temps de réponse moyen" },
    siteLive: "Votre site est en ligne", siteLiveSub: "Assistant IA actif · leads captés en temps réel",
    viewSite: "Voir le site", recent: "Activité récente",
    leadsTitle: "Vos leads", leadsSub: "chaque échange géré par votre assistant", export: "Exporter (CSV)",
    booking: "RDV", enquiry: "Demande", afterHoursTag: "hors horaires", fromAds: "via pub",
    reportsTitle: "Rapports mensuels", reportsSub: "les mêmes chiffres que nous vous envoyons le 1er du mois",
    emailed: "Envoyé le", rEnq: "Demandes", rBook: "Réservations", rAfter: "Hors horaires", rAds: "Via pubs",
    pipelineNote: "Valeur du pipeline : configurez votre valeur moyenne par patient pour estimer votre ROI.",
    afterHoursInsight: "leads captés en dehors de vos horaires d'ouverture — autant de patients qui vous auraient sûrement échappé.",
  },
  en: {
    demo: "DEMO", back: "Back to site", dashTitle: "Dashboard",
    intro: "This is the back-office you get with your system. Every lead your AI assistant captured, your bookings, and a monthly results report — all in one place.",
    system: "Your complete system", want: "I want this system",
    pillars: [
      { icon: Globe, t: "AI website", d: "A fast, multi-page site built to convert." },
      { icon: Bot, t: "AI receptionist", d: "Answers and captures contacts 24/7." },
      { icon: CalendarCheck, t: "Bookings", d: "Every appointment request captured in one place." },
      { icon: BarChart3, t: "CRM & reports", d: "Your leads, your results, your ROI at a glance." },
    ],
    tabs: { overview: "Overview", leads: "My leads", reports: "Reports" },
    kpis: { enquiries: "Enquiries this month", bookings: "Booking requests", afterHours: "Captured after-hours", response: "Avg. response time" },
    siteLive: "Your site is live", siteLiveSub: "AI assistant active · leads captured in real time",
    viewSite: "View site", recent: "Recent activity",
    leadsTitle: "Your leads", leadsSub: "every conversation your assistant handled", export: "Export (CSV)",
    booking: "Booking", enquiry: "Enquiry", afterHoursTag: "after-hours", fromAds: "from ads",
    reportsTitle: "Monthly reports", reportsSub: "the same numbers we email you on the 1st",
    emailed: "Emailed", rEnq: "Enquiries", rBook: "Bookings", rAfter: "After-hours", rAds: "From ads",
    pipelineNote: "Pipeline value: set your average value per patient to estimate your ROI.",
    afterHoursInsight: "leads captured outside your opening hours — patients who would likely have slipped away.",
  },
};

interface DemoLead {
  type: "booking" | "enquiry";
  name: string; contact: string; excerpt: string; when: string;
  afterHours?: boolean; fromAds?: boolean;
}

const FR_LEADS: DemoLead[] = [
  { type: "booking", name: "Sophie D.", contact: "06 12 ·· ·· 47", excerpt: "Je voudrais un rendez-vous pour un implant, quelles sont vos disponibilités ?", when: "Aujourd'hui · 22:47", afterHours: true },
  { type: "enquiry", name: "Marc L.", contact: "marc.l····@gmail.com", excerpt: "Est-ce que vous prenez de nouveaux patients ?", when: "Aujourd'hui · 20:12", afterHours: true, fromAds: true },
  { type: "booking", name: "Amélie R.", contact: "07 88 ·· ·· 03", excerpt: "J'ai perdu une dent, je souhaiterais une consultation pour un implant.", when: "Aujourd'hui · 09:34", fromAds: true },
  { type: "enquiry", name: "Patient anonyme", contact: "—", excerpt: "J'ai très peur du dentiste — l'anesthésie générale est-elle possible ?", when: "Hier · 13:20" },
  { type: "booking", name: "Karim B.", contact: "06 44 ·· ·· 91", excerpt: "Mon dentiste m'a recommandé un implant, je voudrais une consultation.", when: "Hier · 21:05", afterHours: true },
  { type: "enquiry", name: "Nathalie P.", contact: "nathalie····@orange.fr", excerpt: "Combien de temps faut-il prévoir pour une mâchoire complète ?", when: "Hier · 18:41", afterHours: true, fromAds: true },
  { type: "booking", name: "Julien M.", contact: "06 71 ·· ·· 22", excerpt: "Reprise d'un ancien implant — avez-vous des créneaux cette semaine ?", when: "Lun. · 07:58", afterHours: true },
  { type: "enquiry", name: "Claire F.", contact: "07 61 ·· ·· 14", excerpt: "Acceptez-vous la prise en charge par ma mutuelle ?", when: "Lun. · 11:48" },
  { type: "booking", name: "Idriss T.", contact: "06 33 ·· ·· 58", excerpt: "Je voudrais un devis et un rendez-vous pour deux implants.", when: "Dim. · 16:30", afterHours: true, fromAds: true },
  { type: "enquiry", name: "Hélène V.", contact: "helene····@free.fr", excerpt: "Faut-il un comblement osseux avant la pose ? Combien de séances ?", when: "Dim. · 10:12", afterHours: true },
];

const EN_LEADS: DemoLead[] = [
  { type: "booking", name: "Sophie D.", contact: "07·· ··· 447", excerpt: "I'd like an appointment for an implant — what's your availability?", when: "Today · 10:47pm", afterHours: true },
  { type: "enquiry", name: "Marc L.", contact: "marc.l····@gmail.com", excerpt: "Are you taking on new patients?", when: "Today · 8:12pm", afterHours: true, fromAds: true },
  { type: "booking", name: "Amelia R.", contact: "07·· ··· 003", excerpt: "I lost a tooth, I'd like a consultation about an implant.", when: "Today · 9:34am", fromAds: true },
  { type: "enquiry", name: "Anonymous", contact: "—", excerpt: "I'm terrified of the dentist — is general anaesthetic possible?", when: "Yesterday · 1:20pm" },
  { type: "booking", name: "Karim B.", contact: "07·· ··· 191", excerpt: "My dentist recommended an implant, I'd like a consultation.", when: "Yesterday · 9:05pm", afterHours: true },
  { type: "enquiry", name: "Nathalie P.", contact: "nathalie····@outlook.com", excerpt: "How long does a full-arch treatment take?", when: "Yesterday · 6:41pm", afterHours: true, fromAds: true },
  { type: "booking", name: "Julian M.", contact: "07·· ··· 222", excerpt: "Redo of an old implant — any slots this week?", when: "Mon · 7:58am", afterHours: true },
  { type: "enquiry", name: "Claire F.", contact: "07·· ··· 114", excerpt: "Do you accept my insurance?", when: "Mon · 11:48am" },
  { type: "booking", name: "Idris T.", contact: "07·· ··· 058", excerpt: "I'd like a quote and an appointment for two implants.", when: "Sun · 4:30pm", afterHours: true, fromAds: true },
  { type: "enquiry", name: "Helen V.", contact: "helen····@icloud.com", excerpt: "Do I need a bone graft first? How many sessions?", when: "Sun · 10:12am", afterHours: true },
];

export default function DemoDashboard({ config }: { config: ClientSiteConfig }) {
  const c = config;
  const accent = c.accent || "#0E7490";
  const accentDark = shade(accent, -28);
  const lang = c.language === "fr" ? "fr" : "en";
  const t = T[lang];
  const initials = c.businessName.split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  const [tab, setTab] = useState<"overview" | "leads" | "reports">("overview");
  const leads = lang === "fr" ? FR_LEADS : EN_LEADS;
  const demoCta = c.demoContactUrl || "https://servolia.com/contact";
  const basePath = `/sites/${c.slug}`;

  const stats = useMemo(() => {
    const bookings = leads.filter((l) => l.type === "booking").length;
    const afterHours = leads.filter((l) => l.afterHours).length;
    return { enquiries: 34, bookings: 18, afterHours: 12, bookingsShown: bookings, afterHoursShown: afterHours };
  }, [leads]);

  const reports = lang === "fr"
    ? [
        { period: "Juillet 2026", emailed: "1 août 2026", enquiries: 34, bookings: 18, afterHours: 12, ads: 9 },
        { period: "Juin 2026", emailed: "1 juil. 2026", enquiries: 29, bookings: 15, afterHours: 10, ads: 7 },
      ]
    : [
        { period: "July 2026", emailed: "1 Aug 2026", enquiries: 34, bookings: 18, afterHours: 12, ads: 9 },
        { period: "June 2026", emailed: "1 Jul 2026", enquiries: 29, bookings: 15, afterHours: 10, ads: 7 },
      ];

  const Tag = ({ children, color, bg }: { children: React.ReactNode; color: string; bg: string }) => (
    <span className="text-[10px] font-black px-2 py-0.5 rounded-full whitespace-nowrap" style={{ color, background: bg }}>{children}</span>
  );

  return (
    <div className="min-h-screen bg-[#FAFAF9] text-[#18181B]">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-[#ECECEC]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <a href={basePath} className="flex items-center gap-1.5 text-sm font-semibold text-[#52525B] hover:text-[#18181B] transition-colors shrink-0">
              <ArrowLeft className="w-4 h-4" /> <span className="hidden sm:inline">{t.back}</span>
            </a>
            <span className="hidden sm:block w-px h-6 bg-[#ECECEC]" />
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-black text-xs shrink-0" style={{ background: accent }}>{initials}</div>
            <div className="min-w-0">
              <span className="font-black tracking-tight text-sm block truncate">{c.businessName}</span>
              <span className="text-[11px] text-[#71717A] block leading-tight">{t.dashTitle}</span>
            </div>
          </div>
          <a href={demoCta} className="px-3.5 py-2 rounded-lg text-white text-sm font-bold hover:opacity-90 transition-opacity shrink-0 flex items-center gap-1.5" style={{ background: accent }}>
            {t.want} <ArrowRight className="w-3.5 h-3.5" />
          </a>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
        {/* Intro + system pillars */}
        <div className="rounded-[24px] border border-[#ECECEC] bg-white p-6 lg:p-8 mb-6" style={{ boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[10px] font-black tracking-widest px-2 py-0.5 rounded text-white" style={{ background: accentDark }}>{t.demo}</span>
            <span className="text-xs font-black uppercase tracking-[0.18em]" style={{ color: accent }}>{t.system}</span>
          </div>
          <p className="text-[#3F3F46] leading-relaxed max-w-3xl">{t.intro}</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-6">
            {t.pillars.map((p, i) => (
              <div key={i} className="rounded-2xl border border-[#ECECEC] bg-[#FAFAF9] p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${accent}14` }}>
                    <p.icon className="w-4 h-4" style={{ color: accent }} />
                  </div>
                  <CheckCircle className="w-4 h-4 ml-auto" style={{ color: accent }} />
                </div>
                <h3 className="font-black text-sm">{p.t}</h3>
                <p className="text-xs text-[#71717A] leading-relaxed mt-1">{p.d}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 rounded-xl bg-white border border-[#ECECEC] mb-6 w-full sm:w-fit overflow-x-auto">
          {([
            { key: "overview", label: t.tabs.overview, icon: LayoutDashboard },
            { key: "leads", label: t.tabs.leads, icon: Users },
            { key: "reports", label: t.tabs.reports, icon: BarChart3 },
          ] as const).map((it) => (
            <button key={it.key} onClick={() => setTab(it.key)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-colors ${tab === it.key ? "text-white" : "text-[#52525B] hover:text-[#18181B]"}`}
              style={tab === it.key ? { background: accent } : undefined}>
              <it.icon className="w-4 h-4" /> {it.label}
            </button>
          ))}
        </div>

        {/* OVERVIEW */}
        {tab === "overview" && (
          <div className="space-y-4">
            {/* Site live status */}
            <div className="rounded-2xl border border-[#ECECEC] bg-white p-5 flex flex-wrap items-center gap-4" style={{ boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${accent}14` }}>
                <Globe className="w-5 h-5" style={{ color: accent }} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-black text-sm flex items-center gap-2">{t.siteLive}
                  <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full" style={{ background: "#DCFCE7", color: "#166534" }}>
                    <span className="w-1.5 h-1.5 rounded-full bg-[#16A34A] animate-pulse-dot" /> LIVE
                  </span>
                </p>
                <p className="text-xs text-[#71717A] mt-0.5">{t.siteLiveSub}</p>
              </div>
              <a href={basePath} className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-[#ECECEC] text-sm font-bold hover:bg-[#FAFAF9] transition-colors shrink-0">
                <Globe className="w-3.5 h-3.5" style={{ color: accent }} /> {t.viewSite}
              </a>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { icon: MessageSquare, label: t.kpis.enquiries, value: stats.enquiries },
                { icon: CalendarCheck, label: t.kpis.bookings, value: stats.bookings, accent: true },
                { icon: Moon, label: t.kpis.afterHours, value: stats.afterHours },
                { icon: Sparkles, label: t.kpis.response, value: "< 30s" },
              ].map((s) => (
                <div key={s.label} className="rounded-2xl border border-[#ECECEC] p-4" style={{ background: s.accent ? `${accent}0F` : "#fff", boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}>
                  <s.icon className="w-4 h-4 mb-2" style={{ color: s.accent ? accent : "#A1A1AA" }} />
                  <p className="text-2xl font-black" style={{ color: s.accent ? accentDark : "#18181B" }}>{s.value}</p>
                  <p className="text-[11px] text-[#71717A] mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>

            {/* After-hours insight */}
            <div className="rounded-2xl border p-5 flex items-start gap-3" style={{ borderColor: `${accent}33`, background: `${accent}0A` }}>
              <Moon className="w-5 h-5 mt-0.5 shrink-0" style={{ color: accent }} />
              <p className="text-sm text-[#3F3F46] leading-relaxed">
                <span className="font-black" style={{ color: accentDark }}>{stats.afterHours} {t.kpis.afterHours.toLowerCase()}</span> — {t.afterHoursInsight}
              </p>
            </div>

            {/* Recent activity */}
            <div className="rounded-2xl border border-[#ECECEC] bg-white overflow-hidden" style={{ boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}>
              <div className="px-5 py-4 border-b border-[#ECECEC] flex items-center gap-2 bg-[#FAFAF9]">
                <Users className="w-4 h-4" style={{ color: accent }} />
                <h2 className="font-black text-sm">{t.recent}</h2>
              </div>
              <div className="divide-y divide-[#F1F1F1]">
                {leads.slice(0, 4).map((l, i) => <LeadRow key={i} l={l} t={t} accent={accent} accentDark={accentDark} Tag={Tag} />)}
              </div>
            </div>
          </div>
        )}

        {/* LEADS */}
        {tab === "leads" && (
          <div className="rounded-2xl border border-[#ECECEC] bg-white overflow-hidden" style={{ boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}>
            <div className="px-5 py-4 border-b border-[#ECECEC] flex items-center gap-2 bg-[#FAFAF9]">
              <Users className="w-4 h-4" style={{ color: accent }} />
              <h2 className="font-black text-sm">{t.leadsTitle}</h2>
              <span className="hidden sm:inline text-xs text-[#A1A1AA]">— {t.leadsSub}</span>
              <span className="ml-auto flex items-center gap-1.5 text-xs text-[#A1A1AA]"><Download className="w-3.5 h-3.5" /> <span className="hidden sm:inline">{t.export}</span></span>
            </div>
            <div className="divide-y divide-[#F1F1F1]">
              {leads.map((l, i) => <LeadRow key={i} l={l} t={t} accent={accent} accentDark={accentDark} Tag={Tag} />)}
            </div>
          </div>
        )}

        {/* REPORTS */}
        {tab === "reports" && (
          <div className="rounded-2xl border border-[#ECECEC] bg-white overflow-hidden" style={{ boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}>
            <div className="px-5 py-4 border-b border-[#ECECEC] flex items-center gap-2 bg-[#FAFAF9]">
              <BarChart3 className="w-4 h-4" style={{ color: accent }} />
              <h2 className="font-black text-sm">{t.reportsTitle}</h2>
              <span className="hidden sm:inline text-xs text-[#A1A1AA]">— {t.reportsSub}</span>
            </div>
            <div className="divide-y divide-[#F1F1F1]">
              {reports.map((r) => (
                <div key={r.period} className="px-5 py-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-black text-sm">{r.period}</h3>
                    <span className="text-[10px] text-[#A1A1AA]">{t.emailed} {r.emailed}</span>
                  </div>
                  <div className="grid grid-cols-2 min-[420px]:grid-cols-4 gap-2">
                    {[
                      { label: t.rEnq, value: r.enquiries },
                      { label: t.rBook, value: r.bookings, accent: true },
                      { label: t.rAfter, value: r.afterHours },
                      { label: t.rAds, value: r.ads },
                    ].map((s) => (
                      <div key={s.label} className="rounded-xl p-3" style={{ background: s.accent ? `${accent}0F` : "#FAFAF9" }}>
                        <p className="text-lg font-black" style={{ color: s.accent ? accentDark : "#18181B" }}>{s.value}</p>
                        <p className="text-[10px] text-[#71717A] mt-0.5">{s.label}</p>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-[#71717A] mt-3 flex items-start gap-1.5">
                    <CreditCard className="w-3.5 h-3.5 mt-0.5 shrink-0 text-[#A1A1AA]" /> {t.pipelineNote}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function LeadRow({ l, t, accent, accentDark, Tag }: {
  l: DemoLead; t: typeof T["fr"]; accent: string; accentDark: string;
  Tag: (p: { children: React.ReactNode; color: string; bg: string }) => React.ReactElement;
}) {
  return (
    <div className="px-4 sm:px-5 py-3.5 flex items-start gap-3">
      <span className="mt-0.5 shrink-0">
        {l.type === "booking"
          ? <Tag color="#166534" bg="#DCFCE7">{t.booking}</Tag>
          : <Tag color="#52525B" bg="#F4F4F5">{t.enquiry}</Tag>}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-bold">{l.name}</span>
          <span className="text-xs text-[#A1A1AA]">{l.contact}</span>
        </div>
        <p className="text-sm text-[#3F3F46] mt-0.5 leading-snug">{l.excerpt}</p>
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          <span className="text-[11px] text-[#A1A1AA]">{l.when}</span>
          {l.afterHours && <Tag color={accentDark} bg={`${accent}14`}>🌙 {t.afterHoursTag}</Tag>}
          {l.fromAds && <Tag color="#9A3412" bg="#FFEDD5">{t.fromAds}</Tag>}
        </div>
      </div>
    </div>
  );
}
