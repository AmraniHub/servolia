"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Build, Client } from "@/lib/supabase";
import { toCsv } from "@/lib/csv";
import AutoRefresh from "@/components/AutoRefresh";
import { ADDONS } from "@/lib/pricing";
import {
  LogOut, Send, MessageSquare, Clock, CreditCard, CheckCircle2, Users, CalendarCheck,
  Megaphone, ExternalLink, Sun, Moon, LayoutDashboard, KeyRound, Loader2, ShieldCheck, Trash2,
  Image as ImageIcon, X, Globe, BarChart3, Search, Download, HelpCircle, FileText, Sparkles, ArrowRight, Languages,
} from "lucide-react";

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = "image/jpeg,image/png,image/webp,image/gif";

type Lang = "en" | "fr";

const T = {
  en: {
    signOut: "Sign out", toggleTheme: "Toggle theme", toggleLang: "Switch to French",
    greeting: (n: string) => `Welcome back, ${n} 👋`,
    tabs: { overview: "Overview", leads: "My leads", reports: "Reports", messages: "Messages", account: "Account" },
    // subscription
    planSuffix: "plan", perMo: "/mo",
    subManageDesc: "Update payment method, download invoices, or change your plan.",
    billingTitle: "Billing & invoices", billingDesc: "Manage payment methods and download your invoices.",
    manageSub: "Manage subscription", opening: "Opening…",
    billingErr: "Could not open the billing portal.", connErr: "Connection error — please try again.",
    statusActive: "active", statusPaused: "paused",
    // stats
    stEnquiries: "Enquiries this month", stBookings: "Booking requests", stContacts: "Contacts captured",
    // build statuses
    stIntake: "Awaiting your intake", stBuilding: "In progress", stReview: "Ready for your review", stDelivered: "Delivered", stLive: "Live",
    paid: (a: string) => `€${a} paid`, dueOnDelivery: (a: string) => `€${a} due on delivery`,
    targetDelivery: (d: string) => `Target delivery: ${d}`, liveSince: (d: string) => `Live since ${d}`,
    needsScopeMsg: "Please review and confirm your project scope — what's included, the price, and the delivery deadline in writing.",
    confirmScope: "Confirm your scope",
    needsIntakeMsg: "One last step before we start building — tell us about your business, branding, and services. Takes about 8 minutes.",
    completeIntake: "Complete your intake form",
    viewLiveSite: "View my live site", previewSite: "Preview my site",
    // add-ons
    addonsTitle: "Add-ons", addonsDesc: "Extra managed modules. Enable the one-click ones instantly, or message us for the rest.",
    enable: "Enable", askUs: "Ask us", perYr: "yr", perMailbox: "mailbox", perMoShort: "mo",
    // leads
    yourLeads: "Your leads", yourLeadsSub: "— every enquiry your assistant handled", exportCsv: "Export", search: "Search…",
    fAll: "All time", fMonth: "30 days", fWeek: "7 days",
    noLeads: "No enquiries captured yet — they'll appear here as they arrive.", noMatch: "No leads match your search.",
    booking: "Booking", enquiry: "Enquiry", fromAds: " · from your ads", conversation: "(conversation)",
    // reports
    monthlyReports: "Monthly reports", reportsSub: "— the same numbers we email you on the 1st",
    loading: "Loading…", noReports: "No reports yet — your first one lands after your first full month live.",
    emailed: (d: string) => `Emailed ${d}`,
    rEnq: "Enquiries", rBook: "Bookings", rAfter: "After-hours", rAds: "From ads", pipelineValue: "Estimated pipeline value:",
    // messages
    messageUs: "Message us", messageUsSub: "— we usually reply within a few hours", delete: "Delete",
    confirmDelete: "Delete this conversation? It'll disappear from your view — Servolia can still see and restore it if needed.",
    noMessages: "No messages yet — say hello 👋", imageReady: "Image ready — add a caption or just send.", typeMsg: "Type a message…",
    onlyImages: "Only JPEG, PNG, WEBP, or GIF images.", imgTooBig: "Image must be under 4MB.", uploadFailed: "Upload failed",
    // account
    yourAccount: "Your account", accountDesc: "This is your login and where we send your reports and receipts.",
    emailAddress: "Email address", changeEmailNote: "To change your email, message us from the Messages tab — we'll move your account over.",
    changePassword: "Change password", setPassword: "Set a password",
    changePwDesc: "Update the password you use to log in.", setPwDesc: "Optional — set a password so you can log in without the email link every time.",
    currentPw: "Current password", newPw: "New password", confirmPw: "Confirm new password", pwHint: "At least 8 characters",
    pwTooShort: "Password must be at least 8 characters.", pwMismatch: "Passwords don't match.",
    pwUpdated: "Password updated ✅", pwSet: "Password set ✅ — you can now log in with it.", pwSaveErr: "Could not save.",
    saving: "Saving…", updatePw: "Update password", setPwBtn: "Set password",
    resources: "Resources", resourcesDesc: "Quick answers before you message us.",
    resHow: "How the process works", resTerms: "Your delivery guarantee & terms", resPrivacy: "Privacy policy",
  },
  fr: {
    signOut: "Déconnexion", toggleTheme: "Changer le thème", toggleLang: "Passer en anglais",
    greeting: (n: string) => `Bon retour, ${n} 👋`,
    tabs: { overview: "Aperçu", leads: "Mes leads", reports: "Rapports", messages: "Messages", account: "Compte" },
    planSuffix: "forfait", perMo: "/mois",
    subManageDesc: "Modifiez le moyen de paiement, téléchargez vos factures ou changez de forfait.",
    billingTitle: "Facturation & factures", billingDesc: "Gérez vos moyens de paiement et téléchargez vos factures.",
    manageSub: "Gérer l'abonnement", opening: "Ouverture…",
    billingErr: "Impossible d'ouvrir le portail de facturation.", connErr: "Erreur de connexion — réessayez.",
    statusActive: "actif", statusPaused: "en pause",
    stEnquiries: "Demandes ce mois-ci", stBookings: "Demandes de RDV", stContacts: "Coordonnées captées",
    stIntake: "En attente de vos infos", stBuilding: "En cours", stReview: "Prêt pour votre relecture", stDelivered: "Livré", stLive: "En ligne",
    paid: (a: string) => `${a} € payés`, dueOnDelivery: (a: string) => `${a} € à la livraison`,
    targetDelivery: (d: string) => `Livraison prévue : ${d}`, liveSince: (d: string) => `En ligne depuis le ${d}`,
    needsScopeMsg: "Merci de relire et de confirmer le périmètre de votre projet — ce qui est inclus, le prix et le délai de livraison, par écrit.",
    confirmScope: "Confirmer le périmètre",
    needsIntakeMsg: "Une dernière étape avant de commencer — parlez-nous de votre activité, votre identité et vos services. Environ 8 minutes.",
    completeIntake: "Compléter le formulaire",
    viewLiveSite: "Voir mon site en ligne", previewSite: "Prévisualiser mon site",
    addonsTitle: "Modules", addonsDesc: "Modules gérés en plus. Activez les modules en un clic, ou écrivez-nous pour les autres.",
    enable: "Activer", askUs: "Nous demander", perYr: "an", perMailbox: "boîte", perMoShort: "mois",
    yourLeads: "Vos leads", yourLeadsSub: "— chaque demande traitée par votre assistant", exportCsv: "Exporter", search: "Rechercher…",
    fAll: "Tout", fMonth: "30 jours", fWeek: "7 jours",
    noLeads: "Aucune demande captée pour l'instant — elles apparaîtront ici dès leur arrivée.", noMatch: "Aucun lead ne correspond à votre recherche.",
    booking: "RDV", enquiry: "Demande", fromAds: " · via vos pubs", conversation: "(conversation)",
    monthlyReports: "Rapports mensuels", reportsSub: "— les mêmes chiffres que nous vous envoyons le 1er",
    loading: "Chargement…", noReports: "Pas encore de rapport — le premier arrive après votre premier mois complet en ligne.",
    emailed: (d: string) => `Envoyé le ${d}`,
    rEnq: "Demandes", rBook: "RDV", rAfter: "Hors horaires", rAds: "Via pubs", pipelineValue: "Valeur estimée du pipeline :",
    messageUs: "Écrivez-nous", messageUsSub: "— nous répondons généralement en quelques heures", delete: "Supprimer",
    confirmDelete: "Supprimer cette conversation ? Elle disparaîtra de votre vue — Servolia peut toujours la voir et la restaurer si besoin.",
    noMessages: "Aucun message — dites bonjour 👋", imageReady: "Image prête — ajoutez une légende ou envoyez.", typeMsg: "Écrivez un message…",
    onlyImages: "Uniquement des images JPEG, PNG, WEBP ou GIF.", imgTooBig: "L'image doit faire moins de 4 Mo.", uploadFailed: "Échec de l'envoi",
    yourAccount: "Votre compte", accountDesc: "C'est votre identifiant et l'adresse où nous envoyons vos rapports et reçus.",
    emailAddress: "Adresse email", changeEmailNote: "Pour changer d'email, écrivez-nous depuis l'onglet Messages — nous transférerons votre compte.",
    changePassword: "Changer le mot de passe", setPassword: "Définir un mot de passe",
    changePwDesc: "Mettez à jour le mot de passe que vous utilisez pour vous connecter.", setPwDesc: "Optionnel — définissez un mot de passe pour vous connecter sans le lien email à chaque fois.",
    currentPw: "Mot de passe actuel", newPw: "Nouveau mot de passe", confirmPw: "Confirmer le mot de passe", pwHint: "Au moins 8 caractères",
    pwTooShort: "Le mot de passe doit faire au moins 8 caractères.", pwMismatch: "Les mots de passe ne correspondent pas.",
    pwUpdated: "Mot de passe mis à jour ✅", pwSet: "Mot de passe défini ✅ — vous pouvez maintenant l'utiliser.", pwSaveErr: "Impossible d'enregistrer.",
    saving: "Enregistrement…", updatePw: "Mettre à jour", setPwBtn: "Définir le mot de passe",
    resources: "Ressources", resourcesDesc: "Des réponses rapides avant de nous écrire.",
    resHow: "Comment se déroule le processus", resTerms: "Votre garantie de livraison & CGV", resPrivacy: "Politique de confidentialité",
  },
};
type Dict = typeof T["en"];

interface Message { id: string; sender: "client" | "admin"; body: string; created_at: string; attachment_url?: string | null; attachment_type?: string | null }
interface PortalLead { created_at: string; qualified: boolean; contact: string | null; excerpt: string; fromAds: boolean }
interface PortalStats { monthEnquiries: number; monthBookings: number; monthContacts: number }
interface ReportMetrics { enquiries: number; bookings: number; afterHours: number; fromAds: number; estValue: number; perClient: number }
interface PortalReport { period: string; metrics: ReportMetrics; sent_at: string | null }

function statusMeta(status: Build["status"], t: Dict): { label: string; color: string; bg: string } {
  switch (status) {
    case "building":  return { label: t.stBuilding,  color: "#1D4ED8", bg: "#DBEAFE" };
    case "review":    return { label: t.stReview,    color: "#5B21B6", bg: "#EDE9FE" };
    case "delivered": return { label: t.stDelivered, color: "#0369A1", bg: "#E0F2FE" };
    case "live":      return { label: t.stLive,      color: "#166534", bg: "#DCFCE7" };
    default:          return { label: t.stIntake,    color: "#92400E", bg: "#FEF3C7" };
  }
}

const locale = (lang: Lang) => (lang === "fr" ? "fr-FR" : "en-GB");
function formatDate(iso: string | null | undefined, lang: Lang) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(locale(lang), { day: "numeric", month: "short", year: "numeric" });
}
function formatPeriod(period: string, lang: Lang) {
  const [y, m] = period.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString(locale(lang), { month: "long", year: "numeric" });
}

type Tab = "overview" | "leads" | "reports" | "messages" | "account";

export default function PortalDashboard({
  email, builds, subscription, siteSlugs, scopesByLeadId,
}: { email: string; builds: Build[]; subscription?: Client | null; siteSlugs?: Record<string, string>; scopesByLeadId?: Record<string, { token: string; accepted: boolean }> }) {
  const router = useRouter();
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [lang, setLang] = useState<Lang>("en");
  const t = T[lang];
  const [tab, setTab] = useState<Tab>("overview");

  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMsgs, setLoadingMsgs] = useState(true);
  const [messagesLoaded, setMessagesLoaded] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [leads, setLeads] = useState<PortalLead[]>([]);
  const [stats, setStats] = useState<PortalStats | null>(null);
  const [leadSearch, setLeadSearch] = useState("");
  const [leadFilter, setLeadFilter] = useState<"all" | "week" | "month">("all");

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
    fetch("/api/portal/leads").then((r) => r.json()).then((d) => { setLeads(d.leads ?? []); setStats(d.stats ?? null); }).catch(() => {});
  }, []);

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

  const firstName = email.split("@")[0];
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

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-5 sm:py-8">
        {/* Greeting */}
        <div className="mb-6">
          <h1 className="text-xl sm:text-2xl font-black text-[var(--p-text)] break-words">{t.greeting(firstName)}</h1>
          <p className="text-sm text-[var(--p-muted)] break-all">{email}</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 rounded-xl bg-[var(--p-raised)] border border-[var(--p-border)] mb-6 w-full sm:w-fit overflow-x-auto">
          {([
            { key: "overview", label: t.tabs.overview, icon: LayoutDashboard },
            { key: "leads", label: t.tabs.leads, icon: Users },
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
                        subscription.status === "active" ? "bg-[#DCFCE7] text-[#166534]" :
                        subscription.status === "paused" ? "bg-[#FEF3C7] text-[#92400E]" : "bg-[#FEE2E2] text-[#B91C1C]"
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
                {billingError && <p className="text-xs text-[#EF4444] mt-1">{billingError}</p>}
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
                        {b.live_at && <div className="flex items-center gap-2 text-[#22C55E]"><CheckCircle2 className="w-3.5 h-3.5" /> {t.liveSince(formatDate(b.live_at, lang))}</div>}
                      </div>
                      {needsScope && (
                        <>
                          <p className="text-xs text-[#92400E] mt-3 leading-relaxed">{t.needsScopeMsg}</p>
                          <a href={`/scope/${scope.token}`}
                            className="mt-3 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border-2 border-[#D97706] text-[#92400E] text-sm font-black hover:bg-[#FEF3C7] transition-colors">
                            <FileText className="w-3.5 h-3.5" /> {t.confirmScope}
                          </a>
                        </>
                      )}
                      {needsIntake && (
                        <>
                          <p className="text-xs text-[#92400E] mt-3 leading-relaxed">{t.needsIntakeMsg}</p>
                          <a href={`/onboarding?plan=${b.plan}${b.checkout_session_id ? `&session_id=${b.checkout_session_id}` : ""}`}
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
                {filteredLeads.map((l, i) => (
                  <div key={i} className="px-4 sm:px-5 py-3 flex items-start gap-3">
                    <span className={`mt-1 text-[10px] font-black px-2 py-0.5 rounded-full whitespace-nowrap ${l.qualified ? "bg-[#DCFCE7] text-[#166534]" : "bg-[var(--p-raised)] text-[var(--p-muted)]"}`}>
                      {l.qualified ? t.booking : t.enquiry}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-[var(--p-text)] truncate">{l.excerpt || t.conversation}</p>
                      <p className="text-[11px] text-[var(--p-faint)] mt-0.5">
                        {formatDate(l.created_at, lang)}{l.contact ? ` · ${l.contact}` : ""}{l.fromAds ? t.fromAds : ""}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── REPORTS ── */}
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
        {msg && <p className={`text-sm mt-3 ${msg.ok ? "text-[#22C55E]" : "text-[#EF4444]"}`}>{msg.text}</p>}
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
