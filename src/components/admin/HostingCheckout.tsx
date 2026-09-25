"use client";

import { useState } from "react";
import { Link2, Copy, Check, AlertTriangle } from "lucide-react";
import { CLIENT_PRODUCTS, HOSTING_TIERS, usd } from "@/lib/hosting";

/**
 * Generates a hosting checkout link from the admin panel.
 *
 * The link is produced server-side, so STRIPE_SECRET_KEY stays in Vercel and
 * never has to be copied onto a laptop to send a client an invoice.
 *
 * Free days + "domain you already own" (src/lib/ownedDomain.ts): the client
 * pays the domain's first year today and the hosting after the free days.
 * The server checks the domain is in our Vercel team and on the project.
 */
export default function HostingCheckout() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    url: string; mode: string; amountUsd: number; period: string;
    plan?: string; trialDays?: number; domain?: string | null; todayUsd?: number;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  // Read once, not on every render: only the free-days preview date uses it.
  const [openedAt] = useState(() => Date.now());

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
    plan: "hosting",
    trialDays: "",
    ownedDomain: "",
    domainUsd: "",
  });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  /* What the client will be charged, shown BEFORE the link exists. Same
     numbers the server uses (CLIENT_PRODUCTS); the server re-validates. */
  const plan = CLIENT_PRODUCTS[form.plan] ?? CLIENT_PRODUCTS.hosting;
  const planUsd = form.period === "annual" ? plan.annualUsd : plan.monthlyUsd;
  const per = form.period === "annual" ? "year" : "month";
  const days = /^\d+$/.test(form.trialDays.trim()) ? Number(form.trialDays.trim()) : 0;
  const domainUsd = Number(form.domainUsd) || 0;
  const hasDomain = form.ownedDomain.trim() !== "";
  const todayUsd = (hasDomain ? domainUsd : 0) + (days > 0 ? 0 : planUsd);
  const startsOn = new Date(openedAt + days * 86_400_000).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

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
            <label className={label}>Plan</label>
            <select className={field} value={form.plan} onChange={set("plan")}>
              {HOSTING_TIERS.map((k) => (
                <option key={k} value={k}>{CLIENT_PRODUCTS[k].name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={label}>Billing</label>
            <select className={field} value={form.period} onChange={set("period")}>
              <option value="annual">Annual — ${usd(plan.annualUsd)}/yr</option>
              <option value="monthly">Monthly — ${usd(plan.monthlyUsd)}/mo</option>
            </select>
          </div>
          <div>
            <label className={label}>Free days first</label>
            <input className={field} inputMode="numeric" value={form.trialDays} onChange={set("trialDays")} placeholder="0 — none (max 30)" />
          </div>
          <div>
            <label className={label}>Domain you already own</label>
            <input className={field} value={form.ownedDomain} onChange={set("ownedDomain")} placeholder="example.com — on our Vercel team" />
          </div>
          {hasDomain ? (
            <div>
              <label className={label}>Domain first year (USD)</label>
              <input className={field} inputMode="decimal" value={form.domainUsd} onChange={set("domainUsd")} placeholder="27.90 — must end in .90" />
            </div>
          ) : null}
        </div>

        <div className="text-sm text-[#18181B] bg-[#FAFAF7] border border-[#E8E6E0] rounded-lg p-3 mb-4">
          <div>
            <strong>Client pays today: ${usd(todayUsd)}</strong>
            {hasDomain ? ` — domain ${form.ownedDomain.trim()}, first year` : ""}
            {days > 0 ? "" : `${hasDomain ? " + " : " — "}${plan.name}, first ${per}`}
          </div>
          <div className="text-[#71717A]">
            {days > 0
              ? `Then ${plan.name} $${usd(planUsd)}/${per}, charged automatically from about ${startsOn} (Stripe fixes the exact date).`
              : `Then ${plan.name} $${usd(planUsd)}/${per}, renewing automatically.`}
          </div>
          {hasDomain ? (
            <div className="text-[#71717A]">
              Nothing is bought: the link is refused unless the domain is in our Vercel team and attached to the Vercel project above.
            </div>
          ) : null}
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
              {result.todayUsd !== undefined && (result.trialDays || result.domain)
                ? `Today $${usd(result.todayUsd)}${result.domain ? ` (domain ${result.domain})` : ""} · then ${result.plan ?? "hosting"} $${usd(result.amountUsd)} / ${result.period === "annual" ? "year" : "month"} after ${result.trialDays} free days`
                : `$${result.amountUsd} / ${result.period === "annual" ? "year" : "month"}`}
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
