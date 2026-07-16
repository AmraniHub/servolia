"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Build, Client } from "@/lib/supabase";
import AutoRefresh from "@/components/AutoRefresh";
import {
  LogOut, Send, MessageSquare, Clock, CreditCard, CheckCircle2, Users, CalendarCheck,
  Megaphone, ExternalLink, Sun, Moon, LayoutDashboard, KeyRound, Loader2, ShieldCheck, Trash2,
  Image as ImageIcon, X,
} from "lucide-react";

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = "image/jpeg,image/png,image/webp,image/gif";

interface Message { id: string; sender: "client" | "admin"; body: string; created_at: string; attachment_url?: string | null; attachment_type?: string | null }
interface PortalLead { created_at: string; qualified: boolean; contact: string | null; excerpt: string; fromAds: boolean }
interface PortalStats { monthEnquiries: number; monthBookings: number; monthContacts: number }

const STATUS_LABEL: Record<Build["status"], { label: string; color: string; bg: string }> = {
  intake:   { label: "Awaiting your intake", color: "#92400E", bg: "#FEF3C7" },
  building: { label: "In progress",           color: "#1D4ED8", bg: "#DBEAFE" },
  review:   { label: "Ready for your review", color: "#5B21B6", bg: "#EDE9FE" },
  delivered:{ label: "Delivered",             color: "#0369A1", bg: "#E0F2FE" },
  live:     { label: "Live",                  color: "#166534", bg: "#DCFCE7" },
};

function formatDate(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

type Tab = "overview" | "leads" | "messages" | "account";

export default function PortalDashboard({
  email, builds, subscription,
}: { email: string; builds: Build[]; subscription?: Client | null }) {
  const router = useRouter();
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [tab, setTab] = useState<Tab>("overview");

  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMsgs, setLoadingMsgs] = useState(true);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [leads, setLeads] = useState<PortalLead[]>([]);
  const [stats, setStats] = useState<PortalStats | null>(null);

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
    setTheme((t) => {
      const next = t === "light" ? "dark" : "light";
      localStorage.setItem("servolia_portal_theme", next);
      return next;
    });
  };

  useEffect(() => {
    fetch("/api/portal/messages").then((r) => r.json()).then((d) => setMessages(d.messages ?? [])).finally(() => setLoadingMsgs(false));
    fetch("/api/portal/leads").then((r) => r.json()).then((d) => { setLeads(d.leads ?? []); setStats(d.stats ?? null); }).catch(() => {});
  }, []);

  // Live updates: while on the Messages tab, poll for new replies without a refresh.
  useEffect(() => {
    if (tab !== "messages") return;
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
    }, 4000);
    return () => clearInterval(id);
  }, [tab]);

  useEffect(() => { if (tab === "messages") bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, tab]);

  function pickImage(file: File) {
    setImageError("");
    if (!ACCEPTED_IMAGE_TYPES.split(",").includes(file.type)) { setImageError("Only JPEG, PNG, WEBP, or GIF images."); return; }
    if (file.size > MAX_IMAGE_BYTES) { setImageError("Image must be under 4MB."); return; }
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
        if (!up.ok) { setImageError(upData.error ?? "Upload failed"); setSending(false); return; }
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
    if (!confirm("Delete this conversation? It'll disappear from your view — Servolia can still see and restore it if needed.")) return;
    setDeletingChat(true);
    try {
      const res = await fetch("/api/portal/messages", { method: "DELETE" });
      if (res.ok) setMessages([]);
    } finally { setDeletingChat(false); }
  }

  async function openBillingPortal() {
    if (billingBusy) return;
    setBillingBusy(true); setBillingError("");
    try {
      const res = await fetch("/api/billing-portal", { method: "POST" });
      const data = await res.json();
      if (res.ok) { window.location.href = data.url; return; }
      setBillingError(data.error ?? "Could not open the billing portal.");
    } catch { setBillingError("Connection error — please try again."); }
    setBillingBusy(false);
  }

  async function handleLogout() {
    await fetch("/api/portal/logout", { method: "POST" });
    router.push("/portal/login"); router.refresh();
  }

  const firstName = email.split("@")[0];
  const unreadFromAdmin = 0; // reserved for future badge

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
            <button onClick={toggleTheme} aria-label="Toggle theme"
              className="w-9 h-9 rounded-lg border border-[var(--p-border)] flex items-center justify-center text-[var(--p-muted)] hover:text-[var(--p-text)] hover:bg-[var(--p-raised)] transition-colors">
              {theme === "light" ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            </button>
            <button onClick={handleLogout} aria-label="Sign out"
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-2 rounded-lg border border-[var(--p-border)] text-[var(--p-muted)] text-sm font-semibold hover:bg-[var(--p-raised)] hover:text-[var(--p-text)] transition-colors">
              <LogOut className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-5 sm:py-8">
        {/* Greeting */}
        <div className="mb-6">
          <h1 className="text-xl sm:text-2xl font-black text-[var(--p-text)] break-words">Welcome back, {firstName} 👋</h1>
          <p className="text-sm text-[var(--p-muted)] break-all">{email}</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 rounded-xl bg-[var(--p-raised)] border border-[var(--p-border)] mb-6 w-full sm:w-fit overflow-x-auto">
          {([
            { key: "overview", label: "Overview", icon: LayoutDashboard },
            { key: "leads", label: "My leads", icon: Users },
            { key: "messages", label: "Messages", icon: MessageSquare },
            { key: "account", label: "Account", icon: KeyRound },
          ] as const).map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-colors ${
                tab === t.key ? "bg-[var(--p-accent)] text-[var(--p-accent-fg)]" : "text-[var(--p-muted)] hover:text-[var(--p-text)]"
              }`}>
              <t.icon className="w-4 h-4" /> {t.label}
              {t.key === "messages" && unreadFromAdmin > 0 && <span className="ml-1 w-2 h-2 rounded-full bg-[var(--p-accent)]" />}
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
                      {subscription.plan} plan · €{Number(subscription.monthly_amount).toLocaleString()}/mo
                      <span className={`ml-2 text-[10px] font-black px-2 py-0.5 rounded-full align-middle ${
                        subscription.status === "active" ? "bg-[#DCFCE7] text-[#166534]" :
                        subscription.status === "paused" ? "bg-[#FEF3C7] text-[#92400E]" : "bg-[#FEE2E2] text-[#B91C1C]"
                      }`}>{subscription.status}</span>
                    </p>
                    <p className="text-xs text-[var(--p-muted)] mt-0.5">Update payment method, download invoices, or change your plan.</p>
                  </>
                ) : (
                  <>
                    <p className="font-black text-[var(--p-text)] text-sm">Billing & invoices</p>
                    <p className="text-xs text-[var(--p-muted)] mt-0.5">Manage payment methods and download your invoices.</p>
                  </>
                )}
                {billingError && <p className="text-xs text-[#EF4444] mt-1">{billingError}</p>}
              </div>
              <button onClick={openBillingPortal} disabled={billingBusy}
                className="flex w-full sm:w-auto items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-[var(--p-accent)] text-[var(--p-accent-fg)] text-sm font-bold hover:bg-[var(--p-accent-hover)] transition-colors disabled:opacity-50 flex-shrink-0">
                {billingBusy ? "Opening…" : "Manage subscription"} <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* This-month stats */}
            {stats && (
              <div className="grid grid-cols-1 min-[420px]:grid-cols-3 gap-3">
                {[
                  { icon: Users, label: "Enquiries this month", value: stats.monthEnquiries },
                  { icon: CalendarCheck, label: "Booking requests", value: stats.monthBookings, accent: true },
                  { icon: Megaphone, label: "Contacts captured", value: stats.monthContacts },
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
                  const st = STATUS_LABEL[b.status] ?? STATUS_LABEL.intake;
                  return (
                    <div key={b.id} className="rounded-2xl border border-[var(--p-border)] bg-[var(--p-surface)] p-5" style={{ boxShadow: "var(--p-shadow)" }}>
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <h3 className="font-black text-[var(--p-text)]">{b.plan_name ?? b.plan}</h3>
                        <span className="text-[10px] font-black px-2.5 py-1 rounded-full whitespace-nowrap" style={{ background: st.bg, color: st.color }}>{st.label}</span>
                      </div>
                      <div className="space-y-2 text-sm text-[var(--p-muted)]">
                        <div className="flex items-center gap-2">
                          <CreditCard className="w-3.5 h-3.5 text-[var(--p-faint)]" />
                          €{Number(b.deposit_paid).toLocaleString()} paid
                          {b.balance_due > 0 && <span className="text-[var(--p-faint)]">· €{Number(b.balance_due).toLocaleString()} due on delivery</span>}
                        </div>
                        {b.deadline && <div className="flex items-center gap-2"><Clock className="w-3.5 h-3.5 text-[var(--p-faint)]" /> Target delivery: {formatDate(b.deadline)}</div>}
                        {b.live_at && <div className="flex items-center gap-2 text-[#22C55E]"><CheckCircle2 className="w-3.5 h-3.5" /> Live since {formatDate(b.live_at)}</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── LEADS ── */}
        {tab === "leads" && (
          <div className="rounded-2xl border border-[var(--p-border)] bg-[var(--p-surface)] overflow-hidden" style={{ boxShadow: "var(--p-shadow)" }}>
            <div className="px-5 py-4 border-b border-[var(--p-border)] flex items-center gap-2 bg-[var(--p-raised)]">
              <Users className="w-4 h-4 text-[var(--p-accent)]" />
              <h2 className="font-black text-[var(--p-text)] text-sm">Your leads</h2>
              <span className="hidden sm:inline text-xs text-[var(--p-faint)]">— every enquiry your assistant handled</span>
            </div>
            {leads.length === 0 ? (
              <p className="text-sm text-[var(--p-faint)] text-center py-12">No enquiries captured yet — they&apos;ll appear here as they arrive.</p>
            ) : (
              <div className="max-h-[540px] overflow-y-auto divide-y divide-[var(--p-border)]">
                {leads.map((l, i) => (
                  <div key={i} className="px-4 sm:px-5 py-3 flex items-start gap-3">
                    <span className={`mt-1 text-[10px] font-black px-2 py-0.5 rounded-full whitespace-nowrap ${l.qualified ? "bg-[#DCFCE7] text-[#166534]" : "bg-[var(--p-raised)] text-[var(--p-muted)]"}`}>
                      {l.qualified ? "Booking" : "Enquiry"}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-[var(--p-text)] truncate">{l.excerpt || "(conversation)"}</p>
                      <p className="text-[11px] text-[var(--p-faint)] mt-0.5">
                        {formatDate(l.created_at)}{l.contact ? ` · ${l.contact}` : ""}{l.fromAds ? " · from your ads" : ""}
                      </p>
                    </div>
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
              <h2 className="font-black text-[var(--p-text)] text-sm">Message us</h2>
              <span className="hidden sm:inline text-xs text-[var(--p-faint)]">— we usually reply within a few hours</span>
              {messages.length > 0 && (
                <button onClick={deleteChat} disabled={deletingChat} title="Delete conversation"
                  className="ml-auto flex items-center gap-1.5 text-xs text-[var(--p-faint)] hover:text-red-500 transition-colors disabled:opacity-40">
                  <Trash2 className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Delete</span>
                </button>
              )}
            </div>
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 flex flex-col gap-3">
              {loadingMsgs ? (
                <p className="text-sm text-[var(--p-faint)] text-center mt-8">Loading…</p>
              ) : messages.length === 0 ? (
                <p className="text-sm text-[var(--p-faint)] text-center mt-8">No messages yet — say hello 👋</p>
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
                        {new Date(m.created_at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
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
                  <span className="text-xs text-[var(--p-faint)]">Image ready — add a caption or just send.</span>
                </div>
              )}
              <div className="p-3 flex gap-2">
                <button onClick={() => fileInputRef.current?.click()} title="Attach an image"
                  className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 border border-[var(--p-border)] text-[var(--p-faint)] hover:bg-[var(--p-raised)] transition-colors">
                  <ImageIcon className="w-4 h-4" />
                </button>
                <input ref={fileInputRef} type="file" accept={ACCEPTED_IMAGE_TYPES} className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) pickImage(f); }} />
                <input value={input} onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                  placeholder="Type a message…"
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
        {tab === "account" && <AccountTab email={email} onLogout={handleLogout} />}
      </div>
    </div>
  );
}

/* ───────────────────────── Account tab ───────────────────────── */

function AccountTab({ email, onLogout }: { email: string; onLogout: () => void }) {
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
    if (next.length < 8) { setMsg({ ok: false, text: "Password must be at least 8 characters." }); return; }
    if (next !== confirm) { setMsg({ ok: false, text: "Passwords don't match." }); return; }
    setBusy(true);
    try {
      const res = await fetch("/api/portal/set-password", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      const data = await res.json();
      if (res.ok) {
        setMsg({ ok: true, text: hasPassword ? "Password updated ✅" : "Password set ✅ — you can now log in with it." });
        setCurrent(""); setNext(""); setConfirm(""); setHasPassword(true);
      } else setMsg({ ok: false, text: data.error ?? "Could not save." });
    } finally { setBusy(false); }
  }

  const card = "rounded-2xl border border-[var(--p-border)] bg-[var(--p-surface)] p-6";
  const inp = "w-full bg-[var(--p-bg)] border border-[var(--p-border)] rounded-xl px-3.5 py-2.5 text-sm text-[var(--p-text)] placeholder-[var(--p-faint)] focus:outline-none focus:border-[var(--p-accent)]";
  const label = "block text-xs font-bold text-[var(--p-muted)] uppercase tracking-widest mb-1.5";

  return (
    <div className="space-y-4 max-w-xl">
      {/* Email / account */}
      <div className={card} style={{ boxShadow: "var(--p-shadow)" }}>
        <h2 className="font-black text-[var(--p-text)] text-sm mb-1 flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-[var(--p-accent)]" /> Your account</h2>
        <p className="text-xs text-[var(--p-muted)] mb-4">This is your login and where we send your reports and receipts.</p>
        <label className={label}>Email address</label>
        <input value={email} readOnly className={`${inp} opacity-70 cursor-not-allowed`} />
        <p className="text-[11px] text-[var(--p-faint)] mt-2">To change your email, message us from the Messages tab — we&apos;ll move your account over.</p>
      </div>

      {/* Password */}
      <div className={card} style={{ boxShadow: "var(--p-shadow)" }}>
        <h2 className="font-black text-[var(--p-text)] text-sm mb-1 flex items-center gap-2"><KeyRound className="w-4 h-4 text-[var(--p-accent)]" /> {hasPassword ? "Change password" : "Set a password"}</h2>
        <p className="text-xs text-[var(--p-muted)] mb-4">
          {hasPassword
            ? "Update the password you use to log in."
            : "Optional — set a password so you can log in without the email link every time."}
        </p>
        <div className="space-y-3">
          {hasPassword && (
            <div>
              <label className={label}>Current password</label>
              <input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} className={inp} autoComplete="current-password" />
            </div>
          )}
          <div>
            <label className={label}>New password</label>
            <input type="password" value={next} onChange={(e) => setNext(e.target.value)} className={inp} placeholder="At least 8 characters" autoComplete="new-password" />
          </div>
          <div>
            <label className={label}>Confirm new password</label>
            <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={inp} autoComplete="new-password" />
          </div>
        </div>
        {msg && <p className={`text-sm mt-3 ${msg.ok ? "text-[#22C55E]" : "text-[#EF4444]"}`}>{msg.text}</p>}
        <button onClick={submit} disabled={busy || !next}
          className="mt-4 flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--p-accent)] text-[var(--p-accent-fg)] text-sm font-bold hover:bg-[var(--p-accent-hover)] transition-colors disabled:opacity-40">
          {busy ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : hasPassword ? "Update password" : "Set password"}
        </button>
      </div>

      {/* Sign out */}
      <button onClick={onLogout} className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[var(--p-border)] text-[var(--p-muted)] text-sm font-bold hover:bg-[var(--p-raised)] hover:text-[var(--p-text)] transition-colors">
        <LogOut className="w-4 h-4" /> Sign out
      </button>
    </div>
  );
}
