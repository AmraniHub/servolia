"use client";

import { useState } from "react";
import { Link2, Copy, Check, AlertTriangle } from "lucide-react";

/**
 * Generates a hosting checkout link from the admin panel.
 *
 * The link is produced server-side, so STRIPE_SECRET_KEY stays in Vercel and
 * never has to be copied onto a laptop to send a client an invoice.
 */
export default function HostingCheckout() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ url: string; mode: string; amountUsd: number; period: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const [form, setForm] = useState({
    business: "",
    email: "",
    contactName: "",
    siteUrl: "",
    repo: "",
    branch: "main",
    siteRoot: "",
    vercelProject: "",
    period: "annual",
  });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/admin/hosting/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked — the link is on screen to copy by hand */
    }
  }

  const field = "w-full h-9 px-2.5 text-sm border border-[#E8E6E0] rounded-lg bg-[#FAFAF7] focus:outline-none focus:border-[#2563EB]";
  const label = "block text-[10px] font-black text-[#71717A] uppercase tracking-widest mb-1";

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-[#18181B] text-white text-sm font-bold hover:bg-[#27272A]"
      >
        <Link2 className="w-4 h-4" />
        New hosting link
      </button>
    );
  }

  return (
    <div className="bg-white border border-[#E8E6E0] rounded-2xl p-5 mb-6">
      <form onSubmit={submit}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
          <div><label className={label}>Business *</label><input className={field} value={form.business} onChange={set("business")} required /></div>
          <div><label className={label}>Billing email *</label><input className={field} type="email" value={form.email} onChange={set("email")} required /></div>
          <div><label className={label}>Contact name</label><input className={field} value={form.contactName} onChange={set("contactName")} /></div>
          <div><label className={label}>Site URL</label><input className={field} value={form.siteUrl} onChange={set("siteUrl")} placeholder="https://…" /></div>
          <div><label className={label}>Repo</label><input className={field} value={form.repo} onChange={set("repo")} placeholder="AmraniHub/…" /></div>
          <div><label className={label}>Branch</label><input className={field} value={form.branch} onChange={set("branch")} /></div>
          <div>
            <label className={label}>Site root</label>
            <input className={field} value={form.siteRoot} onChange={set("siteRoot")} placeholder="web — blank = repo root" />
          </div>
          <div><label className={label}>Vercel project</label><input className={field} value={form.vercelProject} onChange={set("vercelProject")} /></div>
          <div>
            <label className={label}>Billing</label>
            <select className={field} value={form.period} onChange={set("period")}>
              <option value="annual">Annual — $96/yr</option>
              <option value="monthly">Monthly — $8/mo</option>
            </select>
          </div>
        </div>

        <p className="text-xs text-[#A1A1AA] mb-4">
          Site root matters: a repo that deploys from a subfolder needs it, or the
          suspension gate later writes files where the site never serves them.
        </p>

        <div className="flex items-center gap-2">
          <button
            type="submit"
            disabled={busy}
            className="h-9 px-4 rounded-lg bg-[#18181B] text-white text-sm font-bold hover:bg-[#27272A] disabled:opacity-50"
          >
            {busy ? "Creating…" : "Create link"}
          </button>
          <button type="button" onClick={() => setOpen(false)} className="h-9 px-4 rounded-lg text-sm font-semibold text-[#71717A] hover:bg-[#FAFAF7]">
            Cancel
          </button>
        </div>
      </form>

      {error ? (
        <div className="mt-4 flex items-start gap-2 text-sm text-[#991B1B] bg-[#FEE2E2] rounded-lg p-3">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      {result ? (
        <div className="mt-4 border border-[#E8E6E0] rounded-xl p-4 bg-[#FAFAF7]">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm font-bold text-[#18181B]">
              ${result.amountUsd} / {result.period === "annual" ? "year" : "month"}
            </span>
            <span
              className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                result.mode === "live" ? "bg-[#D1FAE5] text-[#065F46]" : "bg-[#FEF3C7] text-[#92400E]"
              }`}
            >
              {result.mode.toUpperCase()} MODE
            </span>
          </div>
          {result.mode !== "live" ? (
            <p className="text-xs text-[#92400E] mb-2">
              Test mode — this link will not actually charge. Do not send it to a client.
            </p>
          ) : null}
          <div className="flex items-center gap-2">
            <input readOnly value={result.url} className="flex-1 h-9 px-2.5 text-xs font-mono border border-[#E8E6E0] rounded-lg bg-white" />
            <button onClick={copy} className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-white border border-[#E8E6E0] text-sm font-semibold hover:bg-[#FAFAF7]">
              {copied ? <Check className="w-4 h-4 text-[#065F46]" /> : <Copy className="w-4 h-4" />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
