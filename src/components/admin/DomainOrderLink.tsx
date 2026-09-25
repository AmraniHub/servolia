"use client";

import { useState } from "react";
import { Globe, Copy, Check, AlertTriangle } from "lucide-react";

/**
 * A payment link for a domain on its own — for a client with no Servolia
 * plan (src/lib/domainOrders.ts). The price is quoted by the server when the
 * link is made; the form never sends one.
 */
export default function DomainOrderLink() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ url: string; yearlyUsd: number; expiresAt: string; mode: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [form, setForm] = useState({ domain: "", email: "", name: "", project: "", lang: "en" });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/admin/domain-order", {
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
        className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-white border border-[#E8E6E0] text-[#18181B] text-sm font-bold hover:bg-[#FAFAF7]"
      >
        <Globe className="w-4 h-4" />
        New domain link
      </button>
    );
  }

  return (
    <div className="bg-white border border-[#E8E6E0] rounded-2xl p-5 mb-6 w-full">
      <form onSubmit={submit}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
          <div><label className={label}>Domain *</label><input className={field} value={form.domain} onChange={set("domain")} placeholder="example.com" required /></div>
          <div><label className={label}>Client email *</label><input className={field} type="email" value={form.email} onChange={set("email")} required /></div>
          <div><label className={label}>Client name</label><input className={field} value={form.name} onChange={set("name")} /></div>
          <div><label className={label}>Vercel project</label><input className={field} value={form.project} onChange={set("project")} placeholder="attached when bought" /></div>
          <div>
            <label className={label}>Language</label>
            <select className={field} value={form.lang} onChange={set("lang")}>
              <option value="en">English</option>
              <option value="fr">Français</option>
            </select>
          </div>
        </div>

        <p className="text-xs text-[#A1A1AA] mb-4">
          Priced live from Vercel (never under $27.90/yr). The client pays with their own card, the name is
          bought the moment they pay, and they get a Servolia email. Renews yearly on the same card; a price
          rise is emailed 30 days before. .fr, .be, .eu and .lu cannot be bought here.
        </p>

        <div className="flex items-center gap-2">
          <button
            type="submit"
            disabled={busy}
            className="h-9 px-4 rounded-lg bg-[#18181B] text-white text-sm font-bold hover:bg-[#27272A] disabled:opacity-50"
          >
            {busy ? "Pricing…" : "Create link"}
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
            <span className="text-sm font-bold text-[#18181B]">${result.yearlyUsd.toFixed(2)} / year</span>
            <span
              className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                result.mode === "live" ? "bg-[#D1FAE5] text-[#065F46]" : "bg-[#FEF3C7] text-[#92400E]"
              }`}
            >
              {result.mode.toUpperCase()} MODE
            </span>
            <span className="text-xs text-[#71717A]">expires {new Date(result.expiresAt).toLocaleString()}</span>
          </div>
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
