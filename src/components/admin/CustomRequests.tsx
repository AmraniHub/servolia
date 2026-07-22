"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, Copy, Check, Loader2, ExternalLink, Wrench } from "lucide-react";

interface CustomRequest {
  id: string;
  created_at: string;
  title: string;
  description: string | null;
  amount_eur: number;
  status: "quoted" | "paid" | "done";
  payment_url: string | null;
}

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  quoted: { label: "QUOTED", color: "#92400E", bg: "#FEF3C7" },
  paid:   { label: "PAID",   color: "#166534", bg: "#DCFCE7" },
  done:   { label: "DONE",   color: "#1D4ED8", bg: "#DBEAFE" },
};

export default function CustomRequests({ buildId }: { buildId: string }) {
  const [items, setItems] = useState<CustomRequest[]>([]);
  const [missingTable, setMissingTable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/custom-requests?buildId=${buildId}`);
      const d = await res.json();
      setItems(d.requests ?? []);
      setMissingTable(!!d.missingTable);
    } finally { setLoading(false); }
  }, [buildId]);

  useEffect(() => { load(); }, [load]);

  async function create() {
    if (!title.trim() || busy) return;
    setBusy(true); setError("");
    try {
      const res = await fetch("/api/admin/custom-requests", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ buildId, title, description, amountEur: Number(amount) || 0 }),
      });
      const d = await res.json();
      if (!res.ok) { setError(d.error ?? "Could not save."); return; }
      setTitle(""); setDescription(""); setAmount(""); setOpen(false);
      await load();
    } catch { setError("Connection error."); }
    finally { setBusy(false); }
  }

  async function setStatus(id: string, status: string) {
    await fetch("/api/admin/custom-requests", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    load();
  }

  function copy(url: string, id: string) {
    navigator.clipboard.writeText(url);
    setCopied(id);
    setTimeout(() => setCopied(null), 1800);
  }

  const inp = "w-full px-3.5 py-2.5 rounded-xl border border-[#E8E6E0] text-sm text-[#18181B] placeholder:text-[#A1A1AA] focus:outline-none focus:border-[#36671E]";

  return (
    <div className="bg-white border border-[#E8E6E0] rounded-2xl p-6">
      <div className="flex items-center justify-between gap-3 mb-1">
        <h2 className="text-sm font-black text-[#18181B] uppercase tracking-widest flex items-center gap-2">
          <Wrench className="w-4 h-4 text-[#36671E]" /> Custom requests
        </h2>
        <button onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#36671E] text-[#FAFAF7] text-xs font-bold hover:bg-[#295115] transition-colors">
          <Plus className="w-3.5 h-3.5" /> Add
        </button>
      </div>
      <p className="text-xs text-[#71717A] mb-4">Extra work this client asked for, outside their plan — recorded and billed separately.</p>

      {missingTable && (
        <div className="mb-4 p-3 rounded-xl bg-[#FEF3C7] border border-[#D97706]/30 text-xs text-[#92400E]">
          The <code className="font-mono">custom_requests</code> table doesn&apos;t exist yet. Run the block at the end of{" "}
          <code className="font-mono">supabase/schema.sql</code> in the Supabase SQL editor.
        </div>
      )}

      {open && (
        <div className="mb-5 p-4 rounded-xl bg-[#FAFAF7] border border-[#E8E6E0] space-y-3">
          <input value={title} onChange={(e) => setTitle(e.target.value)} className={inp}
            placeholder="What they asked for (e.g. second language on the site)" />
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className={`${inp} resize-none`}
            placeholder="Details, in their words…" />
          <div className="flex items-center gap-3">
            <div className="relative w-40">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-[#71717A]">€</span>
              <input value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ""))}
                inputMode="numeric" placeholder="0" className={`${inp} pl-7`} />
            </div>
            <button onClick={create} disabled={busy || !title.trim()}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#36671E] text-[#FAFAF7] text-sm font-bold hover:bg-[#295115] transition-colors disabled:opacity-50">
              {busy ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : "Save + create payment link"}
            </button>
          </div>
          {error && <p className="text-xs text-[#B91C1C]">{error}</p>}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-[#A1A1AA] py-4">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-[#A1A1AA] py-4">No custom requests yet.</p>
      ) : (
        <div className="space-y-2.5">
          {items.map((r) => {
            const st = STATUS_META[r.status] ?? STATUS_META.quoted;
            return (
              <div key={r.id} className="p-4 rounded-xl border border-[#E8E6E0] bg-[#FAFAF7]">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-full" style={{ background: st.bg, color: st.color }}>{st.label}</span>
                      <p className="text-sm font-bold text-[#18181B]">{r.title}</p>
                    </div>
                    {r.description && <p className="text-xs text-[#71717A] mt-1.5 leading-relaxed whitespace-pre-wrap">{r.description}</p>}
                  </div>
                  <p className="text-sm font-black text-[#18181B] whitespace-nowrap">€{Number(r.amount_eur).toLocaleString()}</p>
                </div>
                <div className="flex items-center gap-2 mt-3 flex-wrap">
                  {r.payment_url && (
                    <>
                      <button onClick={() => copy(r.payment_url!, r.id)}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[#E8E6E0] bg-white text-xs font-bold text-[#18181B] hover:border-[#36671E] transition-colors">
                        {copied === r.id ? <><Check className="w-3 h-3 text-[#36671E]" /> Copied</> : <><Copy className="w-3 h-3" /> Copy payment link</>}
                      </button>
                      <a href={r.payment_url} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[#E8E6E0] bg-white text-xs font-bold text-[#18181B] hover:border-[#36671E] transition-colors">
                        <ExternalLink className="w-3 h-3" /> Open
                      </a>
                    </>
                  )}
                  {r.status !== "done" && (
                    <button onClick={() => setStatus(r.id, "done")}
                      className="px-2.5 py-1.5 rounded-lg border border-[#E8E6E0] bg-white text-xs font-bold text-[#71717A] hover:text-[#18181B] transition-colors">
                      Mark done
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
