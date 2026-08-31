"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import InstallSuggestion from "@/components/InstallSuggestion";
import Link from "next/link";
import type { Build, Client } from "@/lib/supabase";
import { toCsv } from "@/lib/csv";
import AutoRefresh from "@/components/AutoRefresh";
import { ADDONS, PLAN_ORDER, resolvePlan } from "@/lib/pricing";
import { countryName } from "@/lib/traffic";
import {
  LogOut, Send, MessageSquare, Clock, CreditCard, CheckCircle2, Users, CalendarCheck,
  Megaphone, ExternalLink, Sun, Moon, LayoutDashboard, KeyRound, Loader2, ShieldCheck, Trash2,
  Image as ImageIcon, X, Globe, BarChart3, Search, Download, HelpCircle, FileText, Sparkles, ArrowRight, Languages, UserCircle,
  Eye, Monitor, Link2, TrendingUp, AlertTriangle, Zap, Phone,
} from "lucide-react";
import type { PaymentAlert } from "@/lib/clientBilling";
import { T, locale, formatDate, formatPeriod, type Lang, type Dict } from "@/components/portal/portalDict";
import ZeroMissPanel from "@/components/portal/ZeroMissPanel";
import PortalChatDock from "@/components/portal/PortalChatDock";
import type { ComplianceReport } from "@/lib/zeroMiss";
import DomainPanel from "@/components/portal/DomainPanel";
import type { DomainRow } from "@/lib/domains";
import { PStat, PPanel, PBars, PChart } from "@/components/portal/TrafficWidgets";

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = "image/jpeg,image/png,image/webp,image/gif";



interface Message { id: string; sender: "client" | "admin"; body: string; created_at: string; attachment_url?: string | null; attachment_type?: string | null }
interface PortalLead { id?: string; created_at: string; qualified: boolean; contact: string | null; excerpt: string; fromAds: boolean; status?: string; note?: string }

/** Client-side pipeline stages (mirrors LEAD_STATUSES in /api/portal/leads). */
const LEAD_STAGES = ["new", "contacted", "booked", "won", "lost"] as const;
const STAGE_COLORS: Record<string, { color: string; bg: string }> = {
  new:       { color: "var(--p-neutral-fg)", bg: "var(--p-neutral-bg)" },
  contacted: { color: "var(--p-info-fg)",    bg: "var(--p-info-bg)" },
  booked:    { color: "var(--p-purple-fg)",  bg: "var(--p-purple-bg)" },
  won:       { color: "var(--p-ok-fg)",      bg: "var(--p-ok-bg)" },
  lost:      { color: "var(--p-bad-fg)",     bg: "var(--p-bad-bg)" },
};
interface PortalStats { monthEnquiries: number; monthBookings: number; monthContacts: number }
interface PortalLifetime { enquiries: number; bookings: number; afterHours: number; since: string | null }
interface ReportMetrics { enquiries: number; bookings: number; afterHours: number; fromAds: number; estValue: number; perClient: number }
interface PortalReport { period: string; metrics: ReportMetrics; sent_at: string | null }

function statusMeta(status: Build["status"], t: Dict): { label: string; color: string; bg: string } {
  switch (status) {
    case "building":  return { label: t.stBuilding,  color: "var(--p-info-fg)",   bg: "var(--p-info-bg)" };
    case "review":    return { label: t.stReview,    color: "var(--p-purple-fg)", bg: "var(--p-purple-bg)" };
    case "delivered": return { label: t.stDelivered, color: "var(--p-info-fg)",   bg: "var(--p-info-bg)" };
    case "live":      return { label: t.stLive,      color: "var(--p-ok-fg)",     bg: "var(--p-ok-bg)" };
    default:          return { label: t.stIntake,    color: "var(--p-warn-fg)",   bg: "var(--p-warn-bg)" };
  }
}


type Tab = "overview" | "leads" | "traffic" | "reports" | "messages" | "account";

/** Mirrors TrafficSummary in src/lib/traffic.ts — only the fields the portal renders. */
interface PortalTraffic {
  views: number; visitors: number; visits: number; bounceRate: number; viewsPerVisit: number;
  days: { label: string; views: number; visitors: number }[];
  topPages: [string, number][];
  referrers: [string, number][];
  countries: [string, number][];
  devices: [string, number][];
}

export default function PortalDashboard({
  email, builds, subscription, siteSlugs, scopesByLeadId, paymentAlert, zeroMiss, domain,
}: { email: string; builds: Build[]; subscription?: Client | null; siteSlugs?: Record<string, string>; scopesByLeadId?: Record<string, { token: string; accepted: boolean }>; paymentAlert?: PaymentAlert | null; zeroMiss?: ComplianceReport | null; domain?: DomainRow | null }) {
  const router = useRouter();
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [lang, setLang] = useState<Lang>("en");
  const t = T[lang];
  const [tab, setTab] = useState<Tab>("overview");

  const [messages, setMessages] = useState<Message[]>([]);
  // One-time confirmation after an add-on checkout redirects back with
  // ?addon=…&enabled=1 — cleared from the URL so refresh doesn't repeat it.
  const [addonJustEnabled, setAddonJustEnabled] = useState<string | null>(null);
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get("enabled") === "1" && p.get("addon")) {
      setAddonJustEnabled(p.get("addon"));
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);
  const [loadingMsgs, setLoadingMsgs] = useState(true);
  const [messagesLoaded, setMessagesLoaded] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [leads, setLeads] = useState<PortalLead[]>([]);
  const [stats, setStats] = useState<PortalStats | null>(null);
  const [lifetime, setLifetime] = useState<PortalLifetime | null>(null);
  const [leadSearch, setLeadSearch] = useState("");
  const [leadFilter, setLeadFilter] = useState<"all" | "week" | "month">("all");
  const [openLeadId, setOpenLeadId] = useState<string | null>(null);
  const [leadNoteDraft, setLeadNoteDraft] = useState("");
  const [leadNoteBusy, setLeadNoteBusy] = useState(false);
  const [leadNoteSaved, setLeadNoteSaved] = useState(false);

  const [traffic, setTraffic] = useState<PortalTraffic | null>(null);
  const [trafficEnquiries, setTrafficEnquiries] = useState(0);
  const [trafficDays, setTrafficDays] = useState(30);
  const [loadingTraffic, setLoadingTraffic] = useState(false);
  const [trafficLoaded, setTrafficLoaded] = useState(false);

  const [reports, setReports] = useState<PortalReport[]>([]);
  const [reportsLoaded, setReportsLoaded] = useState(false);
  const [loadingReports, setLoadingReports] = useState(true);

  const [billingBusy, setBillingBusy] = useState(false);
  const [billingError, setBillingError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const [pendingImage, setPendingImage] = useState<File | null>(null);
  const [pendingPreview, setPendingPreview] = useState<string | null>(null);
  const [imageError, setImageError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Theme init: saved preference → system → light.
  useEffect(() => {
    const saved = localStorage.getItem("servolia_portal_theme");
    if (saved === "dark" || saved === "light") setTheme(saved);
    else if (window.matchMedia?.("(prefers-color-scheme: dark)").matches) setTheme("dark");
  }, []);
  const toggleTheme = () => {
    setTheme((v) => {
      const next = v === "light" ? "dark" : "light";
      localStorage.setItem("servolia_portal_theme", next);
      return next;
    });
  };

  // Language init: saved preference → browser language → English.
  useEffect(() => {
    const saved = localStorage.getItem("servolia_portal_lang");
    if (saved === "fr" || saved === "en") setLang(saved);
    else if (navigator.language?.toLowerCase().startsWith("fr")) setLang("fr");
  }, []);
  const toggleLang = () => {
    setLang((v) => {
      const next: Lang = v === "en" ? "fr" : "en";
      localStorage.setItem("servolia_portal_lang", next);
      return next;
    });
  };

  useEffect(() => {
    fetch("/api/portal/leads").then((r) => r.json()).then((d) => {
      setLeads(d.leads ?? []); setStats(d.stats ?? null); setLifetime(d.lifetime ?? null);
    }).catch(() => {});
  }, []);

  // Loads when the tab is first opened, and again whenever the range changes.
  useEffect(() => {
    if (tab !== "traffic") return;
    if (trafficLoaded && traffic?.days.length === trafficDays) return;
    setLoadingTraffic(true);
    fetch(`/api/portal/traffic?days=${trafficDays}`)
      .then((r) => r.json())
      .then((d) => {
        setTraffic(d.traffic ?? null);
        setTrafficEnquiries(d.enquiries ?? 0);
        setTrafficLoaded(true);
      })
      .catch(() => {})
      .finally(() => setLoadingTraffic(false));
  }, [tab, trafficDays, trafficLoaded, traffic?.days.length]);

  useEffect(() => {
    if (tab !== "reports" || reportsLoaded) return;
    setLoadingReports(true);
    fetch("/api/portal/reports").then((r) => r.json()).then((d) => {
      setReports(d.reports ?? []); setReportsLoaded(true);
    }).finally(() => setLoadingReports(false));
  }, [tab, reportsLoaded]);

  const filteredLeads = useMemo(() => {
    const now = Date.now();
    const cutoff = leadFilter === "week" ? now - 7 * 86400000 : leadFilter === "month" ? now - 30 * 86400000 : 0;
    const q = leadSearch.trim().toLowerCase();
    return leads.filter((l) => {
      if (cutoff && new Date(l.created_at).getTime() < cutoff) return false;
      if (q && !l.excerpt.toLowerCase().includes(q) && !(l.contact ?? "").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [leads, leadSearch, leadFilter]);

  // Pipeline actions — optimistic updates, scoped server-side to this client's sites.
  async function updateLeadStatus(id: string, status: string) {
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, status } : l)));
    await fetch("/api/portal/leads", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    }).catch(() => {});
  }
  async function saveLeadNote(id: string) {
    if (leadNoteBusy) return;
    setLeadNoteBusy(true);
    try {
      const res = await fetch("/api/portal/leads", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, note: leadNoteDraft }),
      });
      if (res.ok) {
        setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, note: leadNoteDraft } : l)));
        setLeadNoteSaved(true);
        setTimeout(() => setLeadNoteSaved(false), 1500);
      }
    } finally { setLeadNoteBusy(false); }
  }
  // Load the existing note into the draft when a lead row is expanded.
  useEffect(() => {
    if (!openLeadId) return;
    setLeadNoteDraft(leads.find((l) => l.id === openLeadId)?.note ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openLeadId]);

  function exportLeadsCsv() {
    const headers = ["date", "type", "contact", "excerpt", "from_ads"];
    const rows = filteredLeads.map((l) => ({
      date: l.created_at, type: l.qualified ? "booking" : "enquiry", contact: l.contact ?? "", excerpt: l.excerpt, from_ads: l.fromAds ? "yes" : "no",
    }));
    const csv = toCsv(headers, rows);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `servolia-leads-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Read-only unread badge — polls regardless of which tab is open, never marks anything read.
  useEffect(() => {
    const poll = async () => {
      const res = await fetch("/api/portal/messages/unread-count");
      if (res.ok) setUnreadCount((await res.json()).count ?? 0);
    };
    poll();
    const id = setInterval(poll, 10000);
    return () => clearInterval(id);
  }, []);

  // Load the full thread the first time the Messages tab is opened, then poll for new replies.
  useEffect(() => {
    if (tab !== "messages") return;
    if (!messagesLoaded) {
      setLoadingMsgs(true);
      fetch("/api/portal/messages").then((r) => r.json()).then((d) => {
        setMessages(d.messages ?? []); setMessagesLoaded(true); setUnreadCount(0);
      }).finally(() => setLoadingMsgs(false));
    }
    const id = setInterval(async () => {
      const res = await fetch("/api/portal/messages");
      if (!res.ok) return;
      const d = await res.json();
      const fresh: Message[] = d.messages ?? [];
      setMessages((prev) => {
        if (fresh.length <= prev.length) return prev;
        const seen = new Set(prev.map((m) => m.id));
        const merged = [...prev];
        for (const m of fresh) if (!seen.has(m.id)) merged.push(m);
        return merged;
      });
      setUnreadCount(0);
    }, 4000);
    return () => clearInterval(id);
  }, [tab, messagesLoaded]);

  useEffect(() => { if (tab === "messages") bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, tab]);

  function pickImage(file: File) {
    setImageError("");
    if (!ACCEPTED_IMAGE_TYPES.split(",").includes(file.type)) { setImageError(t.onlyImages); return; }
    if (file.size > MAX_IMAGE_BYTES) { setImageError(t.imgTooBig); return; }
    setPendingImage(file);
    setPendingPreview(URL.createObjectURL(file));
  }
  function clearPendingImage() {
    if (pendingPreview) URL.revokeObjectURL(pendingPreview);
    setPendingImage(null); setPendingPreview(null); setImageError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function sendMessage() {
    const text = input.trim();
    if ((!text && !pendingImage) || sending) return;
    setSending(true);
    try {
      let attachmentUrl: string | undefined;
      let attachmentType: string | undefined;
      if (pendingImage) {
        const form = new FormData();
        form.append("file", pendingImage);
        const up = await fetch("/api/portal/messages/upload", { method: "POST", body: form });
        const upData = await up.json();
        if (!up.ok) { setImageError(upData.error ?? t.uploadFailed); setSending(false); return; }
        attachmentUrl = upData.url; attachmentType = upData.type;
      }
      setInput(""); clearPendingImage();
      const res = await fetch("/api/portal/messages", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: text, attachmentUrl, attachmentType }),
      });
      const data = await res.json();
      if (data.message) setMessages((prev) => [...prev, data.message]);
    } finally { setSending(false); }
  }

  const [deletingChat, setDeletingChat] = useState(false);
  async function deleteChat() {
    if (deletingChat) return;
    if (!confirm(t.confirmDelete)) return;
    setDeletingChat(true);
    try {
      const res = await fetch("/api/portal/messages", { method: "DELETE" });
      if (res.ok) setMessages([]);
    } finally { setDeletingChat(false); }
  }

  const [addonBusy, setAddonBusy] = useState<string | null>(null);
  async function enableAddon(key: string) {
    if (addonBusy) return;
    setAddonBusy(key);
    try {
      const res = await fetch("/api/checkout-addon", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ addon: key, email }),
      });
      const data = await res.json();
      if (data.url) { window.location.href = data.url; return; }
    } catch { /* fall through */ }
    setAddonBusy(null);
  }

  async function openBillingPortal() {
    if (billingBusy) return;
    setBillingBusy(true); setBillingError("");
    try {
      const res = await fetch("/api/billing-portal", { method: "POST" });
      const data = await res.json();
      if (res.ok) { window.location.href = data.url; return; }
      setBillingError(data.error ?? t.billingErr);
    } catch { setBillingError(t.connErr); }
    setBillingBusy(false);
  }

  async function handleLogout() {
    await fetch("/api/portal/logout", { method: "POST" });
    router.push("/portal/login"); router.refresh();
  }

  // Branded greeting: their saved name → their business name → email prefix.
  const [profileName, setProfileName] = useState<string | null>(null);
  useEffect(() => {
    fetch("/api/portal/profile").then((r) => r.json()).then((d) => {
      const n = (d.profile?.display_name ?? "").trim();
      if (n) setProfileName(n.split(/\s+/)[0]);
    }).catch(() => {});
  }, []);
  const businessName = builds.find((b) => b.business && b.business !== "Pending intake" && b.business !== "Unknown")?.business ?? null;
  const firstName = profileName ?? businessName ?? email.split("@")[0];

  // The client's primary live site (first build with a slug) — powers the tool hub.
  const primarySlug = builds.map((b) => siteSlugs?.[b.id]).find(Boolean) ?? null;
  const siteUrl = primarySlug ? `https://servolia.com/sites/${primarySlug}` : null;

  const [copied2, setCopied2] = useState<string | null>(null);
  function copyText(text: string, key: string) {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied2(key); setTimeout(() => setCopied2(null), 1600);
  }

  // Plan-aware upgrade card. Driven by the SUBSCRIPTION tier, not the build
  // plan — under the current model every build is the same €490 installation,
  // so the build plan carries no signal. resolvePlan() also maps the retired
  // care/care_growth/care_scale keys, so long-standing clients rank correctly.
  const currentTier = resolvePlan(subscription?.plan);
  const tierRank = currentTier
    ? PLAN_ORDER.indexOf(currentTier.key as (typeof PLAN_ORDER)[number])
    : -1;
  const upsell = tierRank < 0
    ? { h: t.upNoPlanH, b: t.upNoPlanB, cta: t.upNoPlanCta, prefill: t.upNoPlanPrefill }
    : tierRank === 0
    ? { h: t.upEssentielH, b: t.upEssentielB, cta: t.upEssentielCta, prefill: t.upEssentielPrefill }
    : tierRank === 1
    ? { h: t.upCroissanceH, b: t.upCroissanceB, cta: t.upCroissanceCta, prefill: t.upCroissancePrefill }
    : null; // Performance — nothing left to sell them
  function askUpgrade(prefill: string) {
    setInput(prefill);
    setTab("messages");
  }
  const subStatusLabel = (s?: string) => s === "active" ? t.statusActive : s === "paused" ? t.statusPaused : (s ?? "");

  return (
    <div data-portal-theme={theme} className="min-h-screen bg-[var(--p-bg)] text-[var(--p-text)] transition-colors">
      <AutoRefresh intervalMs={30000} />
      {/* Top bar */}
      <header className="sticky top-0 z-30 bg-[var(--p-surface)] border-b border-[var(--p-border)]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          <Link href="/" className="text-lg font-black tracking-tight text-[var(--p-text)]">
            Serv<span className="text-[var(--p-accent)]">olia</span>
          </Link>
          <div className="flex items-center gap-2">
            <button onClick={toggleLang} aria-label={t.toggleLang} title={t.toggleLang}
              className="h-9 px-2.5 rounded-lg border border-[var(--p-border)] flex items-center gap-1.5 text-[var(--p-muted)] text-xs font-black hover:text-[var(--p-text)] hover:bg-[var(--p-raised)] transition-colors">
              <Languages className="w-4 h-4" /> {lang === "en" ? "FR" : "EN"}
            </button>
            <button onClick={toggleTheme} aria-label={t.toggleTheme}
              className="w-9 h-9 rounded-lg border border-[var(--p-border)] flex items-center justify-center text-[var(--p-muted)] hover:text-[var(--p-text)] hover:bg-[var(--p-raised)] transition-colors">
              {theme === "light" ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            </button>
            <button onClick={handleLogout} aria-label={t.signOut}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-2 rounded-lg border border-[var(--p-border)] text-[var(--p-muted)] text-sm font-semibold hover:bg-[var(--p-raised)] hover:text-[var(--p-text)] transition-colors">
              <LogOut className="w-3.5 h-3.5" /> <span className="hidden sm:inline">{t.signOut}</span>
            </button>
          </div>
        </div>
      </header>

      {paymentAlert && (
        <div className="border-b" style={{
          background: paymentAlert.level === "suspended" ? "#7F1D1D" : "#B91C1C",
          borderColor: paymentAlert.level === "suspended" ? "#450A0A" : "#7F1D1D",
        }}>
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center gap-3 text-white">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-black">{t.payTitle}</p>
              <p className="text-xs opacity-90 mt-0.5">
                {paymentAlert.level === "suspended"
                  ? t.paySuspendedBody
                  : t.payPastDueBody(paymentAlert.daysLeft ?? 0)}
              </p>
            </div>
            {paymentAlert.invoiceUrl ? (
              <a href={paymentAlert.invoiceUrl} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white text-[#B91C1C] text-xs font-black hover:bg-white/90 transition-colors">
                {t.payInvoicesBtn} <ExternalLink className="w-3 h-3" />
              </a>
            ) : (
              <button onClick={openBillingPortal} disabled={billingBusy}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white text-[#B91C1C] text-xs font-black hover:bg-white/90 transition-colors disabled:opacity-60">
                {billingBusy ? t.opening : t.payManageBtn} <ExternalLink className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      )}

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-5 sm:py-8">
        {/* Greeting */}
        <div className="mb-6">
          <h1 className="text-xl sm:text-2xl font-black text-[var(--p-text)] break-words">{t.greeting(firstName)}</h1>
          <p className="text-sm text-[var(--p-muted)] break-all">{email}</p>
        </div>

        {/* Offered AFTER the greeting, never above it: a client opening the
            portal came for their enquiries, not to install something. The
            component waits until the second visit and remembers a dismissal
            permanently, so it can be declined once and never seen again. */}
        <InstallSuggestion lang={lang} />

        {/* Add-on checkout lands back here with ?addon=…&enabled=1 — the person
            just paid; silence at that moment reads as "did it work?". */}
        {addonJustEnabled && (
          <div className="mb-6 flex items-start justify-between gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3">
            <p className="text-sm text-[var(--p-text)]">
              <span className="font-black">✓ </span>
              {lang === "fr"
                ? `Votre option « ${addonJustEnabled} » est activée — elle est déjà en service sur votre système.`
                : `Your “${addonJustEnabled}” add-on is active — it's already running on your system.`}
            </p>
            <button onClick={() => setAddonJustEnabled(null)} aria-label="Dismiss"
              className="text-[var(--p-muted)] hover:text-[var(--p-text)] text-sm font-bold shrink-0">✕</button>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 p-1 rounded-xl bg-[var(--p-raised)] border border-[var(--p-border)] mb-6 w-full sm:w-fit overflow-x-auto">
          {([
            { key: "overview", label: t.tabs.overview, icon: LayoutDashboard },
            { key: "leads", label: t.tabs.leads, icon: Users },
            { key: "traffic", label: t.tabs.traffic, icon: Eye },
            { key: "reports", label: t.tabs.reports, icon: BarChart3 },
            { key: "messages", label: t.tabs.messages, icon: MessageSquare },
            { key: "account", label: t.tabs.account, icon: KeyRound },
          ] as const).map((it) => (
            <button key={it.key} onClick={() => setTab(it.key)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-colors ${
                tab === it.key ? "bg-[var(--p-accent)] text-[var(--p-accent-fg)]" : "text-[var(--p-muted)] hover:text-[var(--p-text)]"
              }`}>
              <it.icon className="w-4 h-4" /> {it.label}
              {it.key === "messages" && unreadCount > 0 && (
                <span className={`ml-0.5 text-[10px] font-black px-1.5 py-0.5 rounded-full ${tab === "messages" ? "bg-[var(--p-accent-fg)]/20 text-[var(--p-accent-fg)]" : "bg-[var(--p-accent)] text-[var(--p-accent-fg)]"}`}>
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── OVERVIEW ── */}
        {tab === "overview" && (
          <div className="space-y-4">
            {/* Lifetime value — the retention number. First thing they see. */}
            {lifetime && lifetime.enquiries > 0 && (
              <div className="rounded-2xl border p-5 sm:p-6" style={{ borderColor: "var(--p-accent)", background: "var(--p-accent-soft)" }}>
                <div className="flex items-center gap-2 mb-4">
                  <Sparkles className="w-4 h-4 text-[var(--p-accent)]" />
                  <h3 className="font-black text-[var(--p-text)] text-sm">{t.ltTitle}</h3>
                  {lifetime.since && (
                    <span className="text-[11px] text-[var(--p-muted)] ml-auto">{t.ltSince(formatDate(lifetime.since, lang))}</span>
                  )}
                </div>
                <div className="grid grid-cols-1 min-[420px]:grid-cols-3 gap-4">
                  {[
                    { value: lifetime.enquiries, label: t.ltEnquiries },
                    { value: lifetime.bookings, label: t.ltBookings },
                    { value: lifetime.afterHours, label: t.ltAfterHours },
                  ].map((s) => (
                    <div key={s.label}>
                      <p className="text-3xl font-black text-[var(--p-accent)] leading-none">{s.value}</p>
                      <p className="text-[11px] text-[var(--p-muted)] mt-1.5 leading-snug">{s.label}</p>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-[var(--p-muted)] mt-4 leading-relaxed">{t.ltNote}</p>
              </div>
            )}

            {/* Tool hub — the daily-use quick actions */}
            {siteUrl && (
              <div className="rounded-2xl border border-[var(--p-border)] bg-[var(--p-surface)] p-4 sm:p-5" style={{ boxShadow: "var(--p-shadow)" }}>
                <div className="flex items-center gap-2 mb-3">
                  <Zap className="w-4 h-4 text-[var(--p-accent)]" />
                  <h3 className="font-black text-[var(--p-text)] text-sm">{t.quickTitle}</h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  <a href={siteUrl} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[var(--p-accent)] text-[var(--p-accent-fg)] text-xs font-black hover:bg-[var(--p-accent-hover)] transition-colors">
                    <Globe className="w-3.5 h-3.5" /> {t.quickView}
                  </a>
                  <button onClick={() => copyText(siteUrl, "link")}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[var(--p-border)] text-[var(--p-text)] text-xs font-bold hover:bg-[var(--p-raised)] transition-colors">
                    <Link2 className="w-3.5 h-3.5 text-[var(--p-accent)]" /> {copied2 === "link" ? t.quickCopied : t.quickCopy}
                  </button>
                  <a href={`https://wa.me/?text=${encodeURIComponent(t.quickShareMsg(siteUrl))}`} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[var(--p-border)] text-[var(--p-text)] text-xs font-bold hover:bg-[var(--p-raised)] transition-colors">
                    <MessageSquare className="w-3.5 h-3.5 text-[#25D366]" /> {t.quickShare}
                  </a>
                  <button onClick={() => copyText(`${businessName ?? firstName}\n${siteUrl}`, "sig")}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[var(--p-border)] text-[var(--p-text)] text-xs font-bold hover:bg-[var(--p-raised)] transition-colors">
                    <FileText className="w-3.5 h-3.5 text-[var(--p-accent)]" /> {copied2 === "sig" ? t.quickSigCopied : t.quickSig}
                  </button>
                  <button onClick={() => setTab("messages")}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[var(--p-border)] text-[var(--p-text)] text-xs font-bold hover:bg-[var(--p-raised)] transition-colors">
                    <Send className="w-3.5 h-3.5 text-[var(--p-accent)]" /> {t.quickMsg}
                  </button>
                </div>
              </div>
            )}

            {/* Plan-aware upgrade — the next step for THEIR tier, founder-led close */}
            {upsell && (
              <div className="rounded-2xl border-2 p-5" style={{ borderColor: "var(--p-accent)", background: "var(--p-surface)", boxShadow: "var(--p-shadow)" }}>
                <p className="text-[10px] font-black uppercase tracking-widest text-[var(--p-accent)] mb-2">{t.upTitle}</p>
                <h3 className="font-black text-[var(--p-text)] text-base mb-1.5">{upsell.h}</h3>
                <p className="text-xs text-[var(--p-muted)] leading-relaxed mb-3">{upsell.b}</p>
                <button onClick={() => askUpgrade(upsell.prefill)}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[var(--p-accent)] text-[var(--p-accent-fg)] text-sm font-bold hover:bg-[var(--p-accent-hover)] transition-colors">
                  {upsell.cta} <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Response-time guarantee — CGV 4 bis requires the client can
                consult their own measured response times here. */}
            {zeroMiss && <ZeroMissPanel report={zeroMiss} lang={lang} />}

            {/* Your domain — CGV 7 bis made visible. */}
            {domain && <DomainPanel domain={domain} lang={lang} />}

            {/* Subscription */}
            <div className="rounded-2xl border border-[var(--p-border)] bg-[var(--p-surface)] p-4 sm:p-5 flex flex-wrap items-center gap-4" style={{ boxShadow: "var(--p-shadow)" }}>
              <div className="w-10 h-10 rounded-xl bg-[var(--p-accent-soft)] flex items-center justify-center flex-shrink-0">
                <CreditCard className="w-5 h-5 text-[var(--p-accent)]" />
              </div>
              <div className="min-w-0 flex-1">
                {subscription ? (
                  <>
                    <p className="font-black text-[var(--p-text)] text-sm capitalize">
                      {subscription.plan} {t.planSuffix} · €{Number(subscription.monthly_amount).toLocaleString()}{t.perMo}
                      <span className={`ml-2 text-[10px] font-black px-2 py-0.5 rounded-full align-middle ${
                        subscription.status === "active" ? "bg-[var(--p-ok-bg)] text-[var(--p-ok-fg)]" :
                        subscription.status === "paused" ? "bg-[var(--p-warn-bg)] text-[var(--p-warn-fg)]" : "bg-[var(--p-bad-bg)] text-[var(--p-bad-fg)]"
                      }`}>{subStatusLabel(subscription.status)}</span>
                    </p>
                    <p className="text-xs text-[var(--p-muted)] mt-0.5">{t.subManageDesc}</p>
                  </>
                ) : (
                  <>
                    <p className="font-black text-[var(--p-text)] text-sm">{t.billingTitle}</p>
                    <p className="text-xs text-[var(--p-muted)] mt-0.5">{t.billingDesc}</p>
                  </>
                )}
                {billingError && <p className="text-xs text-[var(--p-bad-fg)] mt-1">{billingError}</p>}
              </div>
              <button onClick={openBillingPortal} disabled={billingBusy}
                className="flex w-full sm:w-auto items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-[var(--p-accent)] text-[var(--p-accent-fg)] text-sm font-bold hover:bg-[var(--p-accent-hover)] transition-colors disabled:opacity-50 flex-shrink-0">
                {billingBusy ? t.opening : t.manageSub} <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* This-month stats */}
            {stats && (
              <div className="grid grid-cols-1 min-[420px]:grid-cols-3 gap-3">
                {[
                  { icon: Users, label: t.stEnquiries, value: stats.monthEnquiries },
                  { icon: CalendarCheck, label: t.stBookings, value: stats.monthBookings, accent: true },
                  { icon: Megaphone, label: t.stContacts, value: stats.monthContacts },
                ].map((s) => (
                  <div key={s.label} className="rounded-2xl border border-[var(--p-border)] p-4 flex min-[420px]:block items-center gap-3"
                    style={{ background: s.accent ? "var(--p-accent-soft)" : "var(--p-surface)", boxShadow: "var(--p-shadow)" }}>
                    <s.icon className={`w-4 h-4 min-[420px]:mb-2 ${s.accent ? "text-[var(--p-accent)]" : "text-[var(--p-faint)]"}`} />
                    <p className={`text-2xl font-black ${s.accent ? "text-[var(--p-accent)]" : "text-[var(--p-text)]"}`}>{s.value}</p>
                    <p className="text-[11px] text-[var(--p-muted)] min-[420px]:mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Build status */}
            {builds.length > 0 && (
              <div className="grid sm:grid-cols-2 gap-4">
                {builds.map((b) => {
                  const st = statusMeta(b.status, t);
                  const slug = siteSlugs?.[b.id];
                  const needsIntake = b.status === "intake";
                  const scope = b.lead_id ? scopesByLeadId?.[b.lead_id] : undefined;
                  const needsScope = scope && !scope.accepted;
                  return (
                    <div key={b.id} className={`rounded-2xl border p-5 ${needsScope || needsIntake ? "border-[#D97706]/40" : "border-[var(--p-border)]"} bg-[var(--p-surface)]`} style={{ boxShadow: "var(--p-shadow)" }}>
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <h3 className="font-black text-[var(--p-text)]">{b.plan_name ?? b.plan}</h3>
                        <span className="text-[10px] font-black px-2.5 py-1 rounded-full whitespace-nowrap" style={{ background: st.bg, color: st.color }}>{st.label}</span>
                      </div>
                      <div className="space-y-2 text-sm text-[var(--p-muted)]">
                        <div className="flex items-center gap-2">
                          <CreditCard className="w-3.5 h-3.5 text-[var(--p-faint)]" />
                          {t.paid(Number(b.deposit_paid).toLocaleString())}
                          {b.balance_due > 0 && <span className="text-[var(--p-faint)]">· {t.dueOnDelivery(Number(b.balance_due).toLocaleString())}</span>}
                        </div>
                        {b.deadline && <div className="flex items-center gap-2"><Clock className="w-3.5 h-3.5 text-[var(--p-faint)]" /> {t.targetDelivery(formatDate(b.deadline, lang))}</div>}
                        {b.live_at && <div className="flex items-center gap-2 text-[var(--p-ok-fg)]"><CheckCircle2 className="w-3.5 h-3.5" /> {t.liveSince(formatDate(b.live_at, lang))}</div>}
                      </div>
                      {needsScope && (
                        <>
                          <p className="text-xs text-[var(--p-warn-fg)] mt-3 leading-relaxed">{t.needsScopeMsg}</p>
                          <a href={`/scope/${scope.token}`}
                            className="mt-3 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border-2 border-[var(--p-warn-fg)]/50 text-[var(--p-warn-fg)] text-sm font-black hover:bg-[var(--p-warn-bg)] transition-colors">
                            <FileText className="w-3.5 h-3.5" /> {t.confirmScope}
                          </a>
                        </>
                      )}
                      {needsIntake && (
                        <>
                          <p className="text-xs text-[var(--p-warn-fg)] mt-3 leading-relaxed">{t.needsIntakeMsg}</p>
                          <a href={`${lang === "fr" ? "/fr/demarrage" : "/onboarding"}?plan=${b.plan}${b.checkout_session_id ? `&session_id=${b.checkout_session_id}` : ""}`}
                            className="mt-3 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-gradient-to-r from-[#F59E0B] to-[#D97706] text-white text-sm font-black hover:opacity-90 transition-opacity">
                            {t.completeIntake} <ArrowRight className="w-3.5 h-3.5" />
                          </a>
                        </>
                      )}
                      {slug && (
                        <a href={`/sites/${slug}`} target="_blank" rel="noopener noreferrer"
                          className="mt-4 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-[var(--p-border)] text-[var(--p-text)] text-sm font-bold hover:bg-[var(--p-raised)] transition-colors">
                          <Globe className="w-3.5 h-3.5 text-[var(--p-accent)]" /> {b.status === "live" ? t.viewLiveSite : t.previewSite} <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Add-ons */}
            <div className="rounded-2xl border border-[var(--p-border)] bg-[var(--p-surface)] p-4 sm:p-5" style={{ boxShadow: "var(--p-shadow)" }}>
              <div className="flex items-center gap-2 mb-1">
                <Sparkles className="w-4 h-4 text-[var(--p-accent)]" />
                <h3 className="font-black text-[var(--p-text)] text-sm">{t.addonsTitle}</h3>
              </div>
              <p className="text-xs text-[var(--p-muted)] mb-4">{t.addonsDesc}</p>
              <div className="grid grid-cols-1 min-[520px]:grid-cols-2 gap-2.5">
                {Object.values(ADDONS).map((a) => (
                  <div key={a.key} className="flex items-center justify-between gap-3 rounded-xl border border-[var(--p-border)] bg-[var(--p-raised)] px-3.5 py-2.5">
                    <div className="min-w-0">
                      <p className="text-sm text-[var(--p-text)] truncate">{lang === "fr" ? a.nameFr : a.name}</p>
                      <p className="text-xs font-black text-[var(--p-text)]">
                        €{a.priceEur}<span className="text-[var(--p-muted)] font-semibold">/{a.interval === "year" ? t.perYr : a.per === "mailbox" ? t.perMailbox : t.perMoShort}</span>
                      </p>
                    </div>
                    {a.selfServe ? (
                      <button onClick={() => enableAddon(a.key)} disabled={!!addonBusy}
                        className="shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[var(--p-accent)] text-[var(--p-accent-fg)] text-xs font-black hover:bg-[var(--p-accent-hover)] transition-colors disabled:opacity-50">
                        {addonBusy === a.key ? <Loader2 className="w-3 h-3 animate-spin" /> : <>{t.enable} <ArrowRight className="w-3 h-3" /></>}
                      </button>
                    ) : (
                      <button onClick={() => setTab("messages")}
                        className="shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[var(--p-border)] text-[var(--p-text)] text-xs font-bold hover:bg-[var(--p-bg)] transition-colors">
                        <MessageSquare className="w-3 h-3 text-[var(--p-accent)]" /> {t.askUs}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── LEADS ── */}
        {tab === "leads" && (
          <div className="rounded-2xl border border-[var(--p-border)] bg-[var(--p-surface)] overflow-hidden" style={{ boxShadow: "var(--p-shadow)" }}>
            <div className="px-5 py-4 border-b border-[var(--p-border)] bg-[var(--p-raised)]">
              <div className="flex items-center gap-2 mb-3">
                <Users className="w-4 h-4 text-[var(--p-accent)]" />
                <h2 className="font-black text-[var(--p-text)] text-sm">{t.yourLeads}</h2>
                <span className="hidden sm:inline text-xs text-[var(--p-faint)]">{t.yourLeadsSub}</span>
                {leads.length > 0 && (
                  <button onClick={exportLeadsCsv} title={t.exportCsv}
                    className="ml-auto flex items-center gap-1.5 text-xs text-[var(--p-faint)] hover:text-[var(--p-text)] transition-colors">
                    <Download className="w-3.5 h-3.5" /> <span className="hidden sm:inline">{t.exportCsv}</span>
                  </button>
                )}
              </div>
              {leads.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative flex-1 min-w-[160px]">
                    <Search className="w-3.5 h-3.5 text-[var(--p-faint)] absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input value={leadSearch} onChange={(e) => setLeadSearch(e.target.value)} placeholder={t.search}
                      className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-[var(--p-bg)] border border-[var(--p-border)] text-xs text-[var(--p-text)] placeholder-[var(--p-faint)] focus:outline-none focus:border-[var(--p-accent)]" />
                  </div>
                  <div className="flex gap-1">
                    {([["all", t.fAll], ["month", t.fMonth], ["week", t.fWeek]] as const).map(([k, label]) => (
                      <button key={k} onClick={() => setLeadFilter(k)}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${leadFilter === k ? "bg-[var(--p-accent)] text-[var(--p-accent-fg)]" : "text-[var(--p-muted)] hover:bg-[var(--p-bg)]"}`}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            {leads.length === 0 ? (
              <p className="text-sm text-[var(--p-faint)] text-center py-12">{t.noLeads}</p>
            ) : filteredLeads.length === 0 ? (
              <p className="text-sm text-[var(--p-faint)] text-center py-12">{t.noMatch}</p>
            ) : (
              <div className="max-h-[540px] overflow-y-auto divide-y divide-[var(--p-border)]">
                {filteredLeads.map((l, i) => {
                  const stage = STAGE_COLORS[l.status ?? "new"] ?? STAGE_COLORS.new;
                  const open = l.id != null && openLeadId === l.id;
                  return (
                    <div key={l.id ?? i} className="px-4 sm:px-5 py-3">
                      <div className="flex items-start gap-3">
                        <span className={`mt-1 text-[10px] font-black px-2 py-0.5 rounded-full whitespace-nowrap ${l.qualified ? "bg-[var(--p-ok-bg)] text-[var(--p-ok-fg)]" : "bg-[var(--p-raised)] text-[var(--p-muted)]"}`}>
                          {l.qualified ? t.booking : t.enquiry}
                        </span>
                        <div className="min-w-0 flex-1 cursor-pointer" onClick={() => l.id && setOpenLeadId(open ? null : l.id)}>
                          <p className="text-sm text-[var(--p-text)] truncate">{l.excerpt || t.conversation}</p>
                          <p className="text-[11px] text-[var(--p-faint)] mt-0.5">
                            {formatDate(l.created_at, lang)}{l.contact ? ` · ${l.contact}` : ""}{l.fromAds ? t.fromAds : ""}
                            {l.note ? " · 📝" : ""}
                          </p>
                        </div>
                        {/* One-tap reply: phone contacts get call + WhatsApp, emails get mailto */}
                        {l.contact && !l.contact.includes("@") && (
                          <>
                            <a href={`tel:${l.contact.replace(/[^\d+]/g, "")}`} onClick={(e) => e.stopPropagation()} title={l.contact}
                              className="shrink-0 p-1.5 rounded-lg border border-[var(--p-border)] text-[var(--p-muted)] hover:text-[var(--p-text)] hover:bg-[var(--p-raised)] transition-colors">
                              <Phone className="w-3.5 h-3.5" />
                            </a>
                            <a href={`https://wa.me/${l.contact.replace(/[^\d]/g, "")}`} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} title="WhatsApp"
                              className="shrink-0 p-1.5 rounded-lg border border-[var(--p-border)] text-[#25D366] hover:bg-[var(--p-raised)] transition-colors">
                              <MessageSquare className="w-3.5 h-3.5" />
                            </a>
                          </>
                        )}
                        {l.contact?.includes("@") && (
                          <a href={`mailto:${l.contact}`} onClick={(e) => e.stopPropagation()} title={l.contact}
                            className="shrink-0 p-1.5 rounded-lg border border-[var(--p-border)] text-[var(--p-muted)] hover:text-[var(--p-text)] hover:bg-[var(--p-raised)] transition-colors">
                            <Send className="w-3.5 h-3.5" />
                          </a>
                        )}
                        {l.id && (
                          <select
                            value={l.status ?? "new"}
                            onChange={(e) => updateLeadStatus(l.id!, e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            className="shrink-0 text-[11px] font-black rounded-lg px-2 py-1.5 border-0 cursor-pointer focus:outline-none"
                            style={{ background: stage.bg, color: stage.color }}
                          >
                            {LEAD_STAGES.map((s) => (
                              <option key={s} value={s}>{t.leadStage[s]}</option>
                            ))}
                          </select>
                        )}
                      </div>
                      {open && (
                        <div className="mt-2.5 ml-0 sm:ml-14 flex items-start gap-2">
                          <textarea
                            value={leadNoteDraft}
                            onChange={(e) => setLeadNoteDraft(e.target.value)}
                            placeholder={t.notePh}
                            rows={2}
                            className="flex-1 rounded-lg bg-[var(--p-bg)] border border-[var(--p-border)] px-3 py-2 text-xs text-[var(--p-text)] placeholder-[var(--p-faint)] focus:outline-none focus:border-[var(--p-accent)] resize-y"
                          />
                          <button onClick={() => saveLeadNote(l.id!)} disabled={leadNoteBusy}
                            className="shrink-0 px-3 py-2 rounded-lg bg-[var(--p-accent)] text-[var(--p-accent-fg)] text-[11px] font-black hover:bg-[var(--p-accent-hover)] transition-colors disabled:opacity-50">
                            {leadNoteSaved ? t.noteSaved : t.noteSave}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── REPORTS ── */}
        {tab === "traffic" && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-lg font-black text-[var(--p-text)]">{t.tf.title}</h2>
                <p className="text-xs text-[var(--p-muted)] mt-0.5">{t.tf.subtitle}</p>
              </div>
              <div className="flex gap-1 p-1 rounded-xl bg-[var(--p-raised)] border border-[var(--p-border)]">
                {[7, 30, 90].map((d) => (
                  <button key={d} onClick={() => { setTrafficDays(d); setTrafficLoaded(false); }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                      trafficDays === d ? "bg-[var(--p-accent)] text-[var(--p-accent-fg)]" : "text-[var(--p-muted)] hover:text-[var(--p-text)]"
                    }`}>
                    {d}d
                  </button>
                ))}
              </div>
            </div>

            {loadingTraffic && !traffic ? (
              <p className="text-sm text-[var(--p-faint)] text-center py-12">{t.tf.loading}</p>
            ) : !traffic || traffic.views === 0 ? (
              <div className="bg-[var(--p-card)] border border-[var(--p-border)] rounded-2xl p-8 text-center">
                <Eye className="w-8 h-8 text-[var(--p-faint)] mx-auto mb-3" />
                <p className="font-black text-[var(--p-text)] mb-1.5">{t.tf.empty}</p>
                <p className="text-sm text-[var(--p-muted)] max-w-sm mx-auto leading-relaxed">{t.tf.emptyBody}</p>
              </div>
            ) : (
              <>
                {/* Headline numbers */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <PStat icon={<Users className="w-4 h-4" />} label={t.tf.visitors} value={traffic.visitors} accent />
                  <PStat icon={<Eye className="w-4 h-4" />} label={t.tf.views} value={traffic.views} sub={`${traffic.viewsPerVisit} ${t.tf.perVisit}`} />
                  <PStat icon={<TrendingUp className="w-4 h-4" />} label={t.tf.visits} value={traffic.visits} sub={`${traffic.bounceRate}% ${t.tf.bounced}`} />
                  <PStat icon={<MessageSquare className="w-4 h-4" />} label={t.tf.enquiries} value={trafficEnquiries}
                    sub={traffic.visitors ? `${Math.round((trafficEnquiries / traffic.visitors) * 100)}% ${t.tf.ofVisitors}` : undefined} />
                </div>

                {/* Visitors per day */}
                <div className="bg-[var(--p-card)] border border-[var(--p-border)] rounded-2xl p-5">
                  <h3 className="text-sm font-black text-[var(--p-text)] mb-0.5">{t.tf.perDay}</h3>
                  <p className="text-xs text-[var(--p-faint)] mb-3">{t.tf.last(trafficDays)}</p>
                  <PChart days={traffic.days} />
                </div>

                <div className="grid lg:grid-cols-2 gap-4">
                  <PPanel icon={<FileText className="w-4 h-4" />} title={t.tf.topPages}>
                    <PBars rows={traffic.topPages} total={traffic.views} mono />
                  </PPanel>
                  <PPanel icon={<Link2 className="w-4 h-4" />} title={t.tf.sources}>
                    <PBars rows={traffic.referrers.map(([k, v]) => [k === "Direct" ? t.tf.direct : k, v] as [string, number])} total={traffic.views} accent />
                  </PPanel>
                  <PPanel icon={<Globe className="w-4 h-4" />} title={t.tf.countries}>
                    <PBars rows={traffic.countries.map(([code, n]) => [countryName(code), n] as [string, number])} total={traffic.views} />
                  </PPanel>
                  <PPanel icon={<Monitor className="w-4 h-4" />} title={t.tf.devices}>
                    <PBars rows={traffic.devices} total={traffic.views} accent />
                  </PPanel>
                </div>

                <p className="text-[11px] text-[var(--p-faint)] text-center flex items-center justify-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5" /> {t.tf.privacy}
                </p>
              </>
            )}
          </div>
        )}

        {tab === "reports" && (
          <div className="rounded-2xl border border-[var(--p-border)] bg-[var(--p-surface)] overflow-hidden" style={{ boxShadow: "var(--p-shadow)" }}>
            <div className="px-5 py-4 border-b border-[var(--p-border)] flex items-center gap-2 bg-[var(--p-raised)]">
              <BarChart3 className="w-4 h-4 text-[var(--p-accent)]" />
              <h2 className="font-black text-[var(--p-text)] text-sm">{t.monthlyReports}</h2>
              <span className="hidden sm:inline text-xs text-[var(--p-faint)]">{t.reportsSub}</span>
            </div>
            {loadingReports ? (
              <p className="text-sm text-[var(--p-faint)] text-center py-12">{t.loading}</p>
            ) : reports.length === 0 ? (
              <p className="text-sm text-[var(--p-faint)] text-center py-12">{t.noReports}</p>
            ) : (
              <div className="divide-y divide-[var(--p-border)]">
                {reports.map((r) => (
                  <div key={r.period} className="px-4 sm:px-5 py-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-black text-[var(--p-text)] text-sm">{formatPeriod(r.period, lang)}</h3>
                      {r.sent_at && <span className="text-[10px] text-[var(--p-faint)]">{t.emailed(formatDate(r.sent_at, lang))}</span>}
                    </div>
                    <div className="grid grid-cols-2 min-[420px]:grid-cols-4 gap-2">
                      {[
                        { label: t.rEnq, value: r.metrics.enquiries },
                        { label: t.rBook, value: r.metrics.bookings, accent: true },
                        { label: t.rAfter, value: r.metrics.afterHours },
                        { label: t.rAds, value: r.metrics.fromAds },
                      ].map((s) => (
                        <div key={s.label} className="rounded-xl p-3" style={{ background: s.accent ? "var(--p-accent-soft)" : "var(--p-raised)" }}>
                          <p className={`text-lg font-black ${s.accent ? "text-[var(--p-accent)]" : "text-[var(--p-text)]"}`}>{s.value}</p>
                          <p className="text-[10px] text-[var(--p-muted)] mt-0.5">{s.label}</p>
                        </div>
                      ))}
                    </div>
                    {r.metrics.estValue > 0 && (
                      <p className="text-xs text-[var(--p-muted)] mt-3">
                        {t.pipelineValue} <span className="font-black text-[var(--p-text)]">€{r.metrics.estValue.toLocaleString()}</span>
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── MESSAGES ── */}
        {tab === "messages" && (
          <div className="rounded-2xl border border-[var(--p-border)] bg-[var(--p-surface)] overflow-hidden flex flex-col" style={{ height: "560px", boxShadow: "var(--p-shadow)" }}>
            <div className="px-5 py-4 border-b border-[var(--p-border)] flex items-center gap-2 bg-[var(--p-raised)]">
              <MessageSquare className="w-4 h-4 text-[var(--p-accent)]" />
              <h2 className="font-black text-[var(--p-text)] text-sm">{t.messageUs}</h2>
              <span className="hidden sm:inline text-xs text-[var(--p-faint)]">{t.messageUsSub}</span>
              {messages.length > 0 && (
                <button onClick={deleteChat} disabled={deletingChat} title={t.delete}
                  className="ml-auto flex items-center gap-1.5 text-xs text-[var(--p-faint)] hover:text-red-500 transition-colors disabled:opacity-40">
                  <Trash2 className="w-3.5 h-3.5" /> <span className="hidden sm:inline">{t.delete}</span>
                </button>
              )}
            </div>
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 flex flex-col gap-3">
              {loadingMsgs ? (
                <p className="text-sm text-[var(--p-faint)] text-center mt-8">{t.loading}</p>
              ) : messages.length === 0 ? (
                <p className="text-sm text-[var(--p-faint)] text-center mt-8">{t.noMessages}</p>
              ) : (
                messages.map((m) => (
                  <div key={m.id} className={`flex ${m.sender === "client" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[85%] sm:max-w-[75%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                      m.sender === "client" ? "bg-[var(--p-accent)] text-[var(--p-accent-fg)] rounded-br-sm" : "bg-[var(--p-raised)] text-[var(--p-text)] rounded-bl-sm border border-[var(--p-border)]"
                    }`}>
                      {m.attachment_url && (
                        <a href={m.attachment_url} target="_blank" rel="noopener noreferrer" className="block mb-1.5 -mx-1 -mt-0.5">
                          <img src={m.attachment_url} alt="Attachment" className="rounded-lg max-h-56 max-w-full object-contain" />
                        </a>
                      )}
                      {m.body}
                      <div className={`text-[10px] mt-1 ${m.sender === "client" ? "opacity-60" : "text-[var(--p-faint)]"}`}>
                        {new Date(m.created_at).toLocaleString(locale(lang), { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </div>
                    </div>
                  </div>
                ))
              )}
              <div ref={bottomRef} />
            </div>
            <div className="border-t border-[var(--p-border)]">
              {imageError && <p className="text-xs text-red-500 px-3 pt-2">{imageError}</p>}
              {pendingPreview && (
                <div className="px-3 pt-2 flex items-center gap-2">
                  <div className="relative">
                    <img src={pendingPreview} alt="" className="h-14 w-14 object-cover rounded-lg border border-[var(--p-border)]" />
                    <button onClick={clearPendingImage} className="absolute -top-1.5 -right-1.5 w-4.5 h-4.5 rounded-full bg-[var(--p-text)] text-[var(--p-bg)] flex items-center justify-center">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                  <span className="text-xs text-[var(--p-faint)]">{t.imageReady}</span>
                </div>
              )}
              <div className="p-3 flex gap-2">
                <button onClick={() => fileInputRef.current?.click()} title="Image"
                  className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 border border-[var(--p-border)] text-[var(--p-faint)] hover:bg-[var(--p-raised)] transition-colors">
                  <ImageIcon className="w-4 h-4" />
                </button>
                <input ref={fileInputRef} type="file" accept={ACCEPTED_IMAGE_TYPES} className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) pickImage(f); }} />
                <input value={input} onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                  placeholder={t.typeMsg}
                  className="flex-1 bg-[var(--p-bg)] text-[var(--p-text)] placeholder-[var(--p-faint)] text-sm rounded-xl px-4 py-2.5 border border-[var(--p-border)] focus:outline-none focus:border-[var(--p-accent)] transition-colors" />
                <button onClick={sendMessage} disabled={(!input.trim() && !pendingImage) || sending}
                  className="w-10 h-10 rounded-xl bg-[var(--p-accent)] flex items-center justify-center disabled:opacity-40 hover:bg-[var(--p-accent-hover)] transition-colors flex-shrink-0">
                  <Send className="w-4 h-4 text-[var(--p-accent-fg)]" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── ACCOUNT ── */}
        {tab === "account" && <AccountTab email={email} onLogout={handleLogout} t={t} />}
      </div>

      {/* Messenger-style help dock — follows the client across every tab.
          Assistant (instant AI) and Abdelali (human) stay separate channels;
          the arrow button opens the full Messages tab for a long thread. */}
      <PortalChatDock
        lang={lang}
        unreadHuman={unreadCount}
        onOpenFullThread={() => setTab("messages")}
      />
    </div>
  );
}

/* ───────────────────────── Profile card ───────────────────────── */

function ProfileCard({ email, t }: { email: string; t: Dict }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [avatar, setAvatar] = useState("");
  const [optIn, setOptIn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saved, setSaved] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/portal/profile").then((r) => r.json()).then((d) => {
      const p = d.profile ?? {};
      setName(p.display_name ?? "");
      setPhone(p.phone ?? "");
      setAvatar(p.avatar_url ?? "");
      setOptIn(!!p.marketing_opt_in);
    }).catch(() => {});
  }, []);

  async function pickPhoto(file: File) {
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/portal/profile/avatar", { method: "POST", body: form });
      const d = await res.json();
      if (d.url) {
        setAvatar(d.url);
        // Persist immediately so the photo isn't lost if they navigate away.
        await fetch("/api/portal/profile", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ avatarUrl: d.url }),
        });
      }
    } finally { setUploading(false); }
  }

  async function save(next?: { marketingOptIn?: boolean }) {
    setBusy(true); setSaved(false);
    try {
      await fetch("/api/portal/profile", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: name, phone,
          marketingOptIn: next?.marketingOptIn ?? optIn,
        }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally { setBusy(false); }
  }

  const initials = (name || email).replace(/^Dr\.?\s*/i, "").split(/[\s@.]+/).slice(0, 2)
    .map((w) => w[0]).join("").toUpperCase();
  const inp = "w-full bg-[var(--p-bg)] border border-[var(--p-border)] rounded-xl px-3.5 py-2.5 text-sm text-[var(--p-text)] placeholder-[var(--p-faint)] focus:outline-none focus:border-[var(--p-accent)]";
  const label = "block text-xs font-bold text-[var(--p-muted)] uppercase tracking-widest mb-1.5";

  return (
    <div className="rounded-2xl border border-[var(--p-border)] bg-[var(--p-surface)] p-6" style={{ boxShadow: "var(--p-shadow)" }}>
      <h2 className="font-black text-[var(--p-text)] text-sm mb-1 flex items-center gap-2">
        <UserCircle className="w-4 h-4 text-[var(--p-accent)]" /> {t.profileTitle}
      </h2>
      <p className="text-xs text-[var(--p-muted)] mb-5">{t.profileDesc}</p>

      {/* Photo */}
      <div className="flex items-center gap-4 mb-5">
        {avatar ? (
          <img src={avatar} alt="" className="w-16 h-16 rounded-full object-cover border border-[var(--p-border)]" />
        ) : (
          <div className="w-16 h-16 rounded-full flex items-center justify-center text-lg font-black bg-[var(--p-accent)] text-[var(--p-accent-fg)]">
            {initials}
          </div>
        )}
        <div>
          <input ref={fileRef} type="file" accept={ACCEPTED_IMAGE_TYPES} className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) pickPhoto(f); }} />
          <button onClick={() => fileRef.current?.click()} disabled={uploading}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[var(--p-border)] text-[var(--p-text)] text-sm font-bold hover:bg-[var(--p-raised)] transition-colors disabled:opacity-50">
            {uploading ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> {t.uploading}</> : <><ImageIcon className="w-3.5 h-3.5" /> {t.changePhoto}</>}
          </button>
          <p className="text-[11px] text-[var(--p-faint)] mt-1.5">{t.photoHint}</p>
        </div>
      </div>

      {/* Name + phone */}
      <div className="space-y-3 mb-5">
        <div>
          <label className={label}>{t.displayName}</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t.displayNamePh} className={inp} />
        </div>
        <div>
          <label className={label}>{t.phoneLabel}</label>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={t.phonePh} className={inp} />
        </div>
      </div>

      {/* Marketing opt-in — explicit, reversible consent */}
      <div className="rounded-xl border border-[var(--p-border)] bg-[var(--p-raised)] p-4 mb-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-bold text-[var(--p-text)]">{t.marketingTitle}</p>
            <p className="text-xs text-[var(--p-muted)] mt-1 leading-relaxed">{t.marketingDesc}</p>
            <p className="text-xs font-bold mt-2" style={{ color: optIn ? "var(--p-accent)" : "var(--p-faint)" }}>
              {optIn ? t.marketingOn : t.marketingOff}
            </p>
          </div>
          <button
            role="switch" aria-checked={optIn} aria-label={t.marketingTitle}
            onClick={() => { const v = !optIn; setOptIn(v); save({ marketingOptIn: v }); }}
            className="shrink-0 w-12 h-7 rounded-full transition-colors relative"
            style={{ background: optIn ? "var(--p-accent)" : "var(--p-border)" }}>
            <span className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-all ${optIn ? "left-6" : "left-1"}`} />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button onClick={() => save()} disabled={busy}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--p-accent)] text-[var(--p-accent-fg)] text-sm font-bold hover:bg-[var(--p-accent-hover)] transition-colors disabled:opacity-40">
          {busy ? <><Loader2 className="w-4 h-4 animate-spin" /> {t.saving}</> : t.saveProfile}
        </button>
        {saved && <span className="text-sm text-[var(--p-ok-fg)]">{t.savedProfile}</span>}
      </div>
    </div>
  );
}

/* ───────────────────────── Account tab ───────────────────────── */

function AccountTab({ email, onLogout, t }: { email: string; onLogout: () => void; t: Dict }) {
  const [hasPassword, setHasPassword] = useState<boolean | null>(null);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/portal/set-password");
    if (res.ok) setHasPassword((await res.json()).hasPassword);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function submit() {
    setMsg(null);
    if (next.length < 8) { setMsg({ ok: false, text: t.pwTooShort }); return; }
    if (next !== confirm) { setMsg({ ok: false, text: t.pwMismatch }); return; }
    setBusy(true);
    try {
      const res = await fetch("/api/portal/set-password", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      const data = await res.json();
      if (res.ok) {
        setMsg({ ok: true, text: hasPassword ? t.pwUpdated : t.pwSet });
        setCurrent(""); setNext(""); setConfirm(""); setHasPassword(true);
      } else setMsg({ ok: false, text: data.error ?? t.pwSaveErr });
    } finally { setBusy(false); }
  }

  const card = "rounded-2xl border border-[var(--p-border)] bg-[var(--p-surface)] p-6";
  const inp = "w-full bg-[var(--p-bg)] border border-[var(--p-border)] rounded-xl px-3.5 py-2.5 text-sm text-[var(--p-text)] placeholder-[var(--p-faint)] focus:outline-none focus:border-[var(--p-accent)]";
  const label = "block text-xs font-bold text-[var(--p-muted)] uppercase tracking-widest mb-1.5";

  return (
    <div className="space-y-4 max-w-xl">
      <ProfileCard email={email} t={t} />

      {/* Email / account */}
      <div className={card} style={{ boxShadow: "var(--p-shadow)" }}>
        <h2 className="font-black text-[var(--p-text)] text-sm mb-1 flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-[var(--p-accent)]" /> {t.yourAccount}</h2>
        <p className="text-xs text-[var(--p-muted)] mb-4">{t.accountDesc}</p>
        <label className={label}>{t.emailAddress}</label>
        <input value={email} readOnly className={`${inp} opacity-70 cursor-not-allowed`} />
        <p className="text-[11px] text-[var(--p-faint)] mt-2">{t.changeEmailNote}</p>
      </div>

      {/* Password */}
      <div className={card} style={{ boxShadow: "var(--p-shadow)" }}>
        <h2 className="font-black text-[var(--p-text)] text-sm mb-1 flex items-center gap-2"><KeyRound className="w-4 h-4 text-[var(--p-accent)]" /> {hasPassword ? t.changePassword : t.setPassword}</h2>
        <p className="text-xs text-[var(--p-muted)] mb-4">{hasPassword ? t.changePwDesc : t.setPwDesc}</p>
        <div className="space-y-3">
          {hasPassword && (
            <div>
              <label className={label}>{t.currentPw}</label>
              <input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} className={inp} autoComplete="current-password" />
            </div>
          )}
          <div>
            <label className={label}>{t.newPw}</label>
            <input type="password" value={next} onChange={(e) => setNext(e.target.value)} className={inp} placeholder={t.pwHint} autoComplete="new-password" />
          </div>
          <div>
            <label className={label}>{t.confirmPw}</label>
            <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={inp} autoComplete="new-password" />
          </div>
        </div>
        {msg && <p className={`text-sm mt-3 ${msg.ok ? "text-[var(--p-ok-fg)]" : "text-[var(--p-bad-fg)]"}`}>{msg.text}</p>}
        <button onClick={submit} disabled={busy || !next}
          className="mt-4 flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--p-accent)] text-[var(--p-accent-fg)] text-sm font-bold hover:bg-[var(--p-accent-hover)] transition-colors disabled:opacity-40">
          {busy ? <><Loader2 className="w-4 h-4 animate-spin" /> {t.saving}</> : hasPassword ? t.updatePw : t.setPwBtn}
        </button>
      </div>

      {/* Resources */}
      <div className={card} style={{ boxShadow: "var(--p-shadow)" }}>
        <h2 className="font-black text-[var(--p-text)] text-sm mb-1 flex items-center gap-2"><HelpCircle className="w-4 h-4 text-[var(--p-accent)]" /> {t.resources}</h2>
        <p className="text-xs text-[var(--p-muted)] mb-4">{t.resourcesDesc}</p>
        <div className="space-y-1">
          {[
            { href: "/how-it-works", icon: Sparkles, label: t.resHow },
            { href: "/legal/cgv", icon: FileText, label: t.resTerms },
            { href: "/legal/privacy", icon: ShieldCheck, label: t.resPrivacy },
          ].map((r) => (
            <a key={r.href} href={r.href} target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl hover:bg-[var(--p-raised)] transition-colors group">
              <span className="flex items-center gap-2 text-sm text-[var(--p-text)]"><r.icon className="w-3.5 h-3.5 text-[var(--p-faint)]" /> {r.label}</span>
              <ExternalLink className="w-3.5 h-3.5 text-[var(--p-faint)] opacity-0 group-hover:opacity-100 transition-opacity" />
            </a>
          ))}
        </div>
      </div>

      {/* Sign out */}
      <button onClick={onLogout} className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[var(--p-border)] text-[var(--p-muted)] text-sm font-bold hover:bg-[var(--p-raised)] hover:text-[var(--p-text)] transition-colors">
        <LogOut className="w-4 h-4" /> {t.signOut}
      </button>
    </div>
  );
}
