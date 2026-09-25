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

  /* An EXISTING order: mark one finished by hand as bought, or stop its
     renewal. Stop is two clicks (no confirm(): the in-app browser answers
     every confirm with "no", silently). */
  const [existing, setExisting] = useState("");
  // Only needed when several Stripe customers hold the same name (the server says so).
  const [existingCustomer, setExistingCustomer] = useState("");
  const [manageBusy, setManageBusy] = useState(false);
  const [manageMsg, setManageMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [armStop, setArmStop] = useState(false);

  async function manage(action: "mark-bought" | "stop") {
    if (action === "stop" && !armStop) { setArmStop(true); return; }
    setArmStop(false);
    setManageBusy(true);
    setManageMsg(null);
    try {
      const res = await fetch("/api/admin/domain-order/manage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, domain: existing, ...(existingCustomer.trim() ? { customer: existingCustomer.trim() } : {}) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setManageMsg({
        ok: !(data.problems?.length),
        text: action === "mark-bought"
          ? `Marked bought, renews ${data.record?.renewsOn}. ${data.attach === "done" ? "Attached to its project. " : data.attach === "failed" ? `NOT attached (${data.attachDetail}). ` : ""}${data.emailed ? `Client emailed (${data.email}).` : "Client NOT emailed — tell them yourself."}`
          : `Stopped. ${[
              ...(data.voided ?? []), ...(data.problems ?? []),
              ...(data.keptUntil ? [`Vercel auto-renew stays ON until ${data.keptUntil}: that year is already paid for. The daily sweep switches it off after.`] : []),
            ].join("; ") || "Renewal switched off at Vercel."}`,
      });
    } catch (err) {
      setManageMsg({ ok: false, text: err instanceof Error ? err.message : "Failed" });
    } finally {
      setManageBusy(false);
    }
  }

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
          rise is emailed at least 30 days before we charge the card. Endings: .com .org .net .co .uk .io (not .fr / .ma: registry eligibility rules; Vercel still has the last word).
          The Vercel project must exist in the team.
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

      <div className="mt-5 pt-4 border-t border-[#E8E6E0]">
        <label className={label}>Existing order</label>
        <div className="flex flex-wrap items-center gap-2">
          <input className={`${field} max-w-xs`} value={existing} onChange={(e) => { setExisting(e.target.value); setArmStop(false); }} placeholder="domain of an order already paid" />
          <input className={`${field} max-w-[11rem]`} value={existingCustomer} onChange={(e) => { setExistingCustomer(e.target.value); setArmStop(false); }} placeholder="cus_… (if asked)" />
          <button type="button" disabled={manageBusy || !existing} onClick={() => manage("mark-bought")}
            className="h-9 px-3 rounded-lg bg-white border border-[#E8E6E0] text-sm font-semibold hover:bg-[#FAFAF7] disabled:opacity-50">
            Mark bought
          </button>
          <button type="button" disabled={manageBusy || !existing} onClick={() => manage("stop")}
            className={`h-9 px-3 rounded-lg border text-sm font-semibold disabled:opacity-50 ${armStop ? "bg-[#991B1B] border-[#991B1B] text-white" : "bg-white border-[#E8E6E0] text-[#991B1B] hover:bg-[#FEE2E2]"}`}>
            {armStop ? "Click again to stop renewing" : "Stop renewing"}
          </button>
        </div>
        <p className="text-xs text-[#A1A1AA] mt-2">
          Mark bought: after finishing a purchase by hand — refuses unless Vercel shows we BOUGHT the name (after the
          order) and the payment was not refunded; sets the renewal a year after purchase, attaches it and emails the
          client. Stop renewing (bought orders only): voids its renewal invoice and switches Vercel&apos;s auto-renew
          off — unless the next year is already paid, then it stays on until that date.
        </p>
        {manageMsg ? (
          <p className={`mt-2 text-sm rounded-lg p-3 ${manageMsg.ok ? "bg-[#D1FAE5] text-[#065F46]" : "bg-[#FEE2E2] text-[#991B1B]"}`}>{manageMsg.text}</p>
        ) : null}
      </div>
    </div>
  );
}
