"use client";

import { useState, useEffect, useCallback } from "react";
import { Star, Plus, Trash2, Eye, EyeOff, ExternalLink, X } from "lucide-react";

/**
 * Case-study admin — turn a client's monthly report into public proof.
 * Add real numbers, toggle published, and it appears at the top of /case-studies.
 */

interface Metric { label: string; value: string }
interface CaseStudy {
  id: string; slug: string; published: boolean; business: string; niche: string | null;
  city: string | null; headline: string; summary: string | null; challenge: string | null;
  solution: string | null; metrics: Metric[]; quote: string | null; quoteAuthor: string | null; plan: string | null;
}

const empty = {
  business: "", city: "", niche: "dental", plan: "", headline: "", summary: "",
  challenge: "", solution: "", quote: "", quoteAuthor: "",
  metrics: [{ label: "", value: "" }, { label: "", value: "" }] as Metric[],
  published: true,
};

export default function CaseStudiesManager() {
  const [studies, setStudies] = useState<CaseStudy[]>([]);
  const [form, setForm] = useState({ ...empty });
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/case-studies");
    if (res.ok) setStudies((await res.json()).caseStudies ?? []);
  }, []);
  useEffect(() => { load(); }, [load]);

  const set = (k: string, v: unknown) => setForm((f) => ({ ...f, [k]: v }));
  const setMetric = (i: number, k: keyof Metric, v: string) =>
    setForm((f) => ({ ...f, metrics: f.metrics.map((m, j) => (j === i ? { ...m, [k]: v } : m)) }));

  async function create() {
    if (!form.business.trim() || !form.headline.trim() || busy) return;
    setBusy(true); setError("");
    try {
      const res = await fetch("/api/admin/case-studies", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, metrics: form.metrics.filter((m) => m.label && m.value) }),
      });
      const data = await res.json();
      if (res.ok) { setForm({ ...empty }); setShowForm(false); load(); }
      else setError(data.error ?? "Failed");
    } finally { setBusy(false); }
  }

  async function togglePublished(c: CaseStudy) {
    await fetch("/api/admin/case-studies", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: c.id, published: !c.published }),
    });
    load();
  }

  async function remove(id: string) {
    if (!confirm("Delete this case study?")) return;
    await fetch(`/api/admin/case-studies?id=${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-black text-[#18181B] flex items-center gap-2">
            <Star className="w-5 h-5 text-[#36671E]" /> Case studies
          </h1>
          <p className="text-sm text-[#71717A]">Real client results. Published ones show at the top of /case-studies.</p>
        </div>
        <div className="flex gap-2">
          <a href="/case-studies" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#E8E6E0] text-sm font-bold text-[#52525B] hover:bg-[#F5F4EF]">
            <ExternalLink className="w-4 h-4" /> View page
          </a>
          <button onClick={() => setShowForm((s) => !s)} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#36671E] text-white text-sm font-bold hover:bg-[#295115]">
            {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />} {showForm ? "Close" : "New case study"}
          </button>
        </div>
      </div>

      {showForm && (
        <div className="bg-white border border-[#E8E6E0] rounded-2xl p-5 mb-6 space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <Inp label="Business *" v={form.business} on={(v) => set("business", v)} ph="Cabinet Dentaire Lumière" />
            <Inp label="City" v={form.city} on={(v) => set("city", v)} ph="Lyon" />
            <Inp label="Niche" v={form.niche} on={(v) => set("niche", v)} ph="dental" />
            <Inp label="Plan" v={form.plan} on={(v) => set("plan", v)} ph="Booking System · €99/mo" />
          </div>
          <Inp label="Headline *" v={form.headline} on={(v) => set("headline", v)} ph="How Cabinet Lumière booked 38 extra consultations in 60 days" />
          <Inp label="Summary" v={form.summary} on={(v) => set("summary", v)} ph="One line under the headline" />
          <Txt label="The challenge" v={form.challenge} on={(v) => set("challenge", v)} ph="What was broken before Servolia" />
          <Txt label="What we did" v={form.solution} on={(v) => set("solution", v)} ph="The system we installed" />

          <div>
            <p className="text-xs font-bold text-[#52525B] uppercase tracking-widest mb-1.5">Metrics (the numbers)</p>
            <div className="space-y-2">
              {form.metrics.map((m, i) => (
                <div key={i} className="flex gap-2">
                  <input value={m.value} onChange={(e) => setMetric(i, "value", e.target.value)} placeholder="+38/mo" className={`${inpCls} w-32`} />
                  <input value={m.label} onChange={(e) => setMetric(i, "label", e.target.value)} placeholder="Booked consultations" className={`${inpCls} flex-1`} />
                </div>
              ))}
            </div>
            <button onClick={() => set("metrics", [...form.metrics, { label: "", value: "" }])} className="text-xs font-bold text-[#36671E] mt-2">+ add metric</button>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <Txt label="Quote" v={form.quote} on={(v) => set("quote", v)} ph="They finally stopped losing patients after hours." />
            <Inp label="Quote author" v={form.quoteAuthor} on={(v) => set("quoteAuthor", v)} ph="Dr. Marie Dupont, Owner" />
          </div>

          <label className="flex items-center gap-2 text-sm font-bold text-[#18181B]">
            <input type="checkbox" checked={form.published} onChange={(e) => set("published", e.target.checked)} /> Publish immediately
          </label>

          {error && <p className="text-sm text-[#B91C1C]">{error}</p>}
          <button onClick={create} disabled={!form.business.trim() || !form.headline.trim() || busy} className="px-5 py-2.5 rounded-xl bg-[#36671E] text-white text-sm font-bold disabled:opacity-40 hover:bg-[#295115]">
            {busy ? "Saving…" : "Save case study"}
          </button>
        </div>
      )}

      <div className="bg-white border border-[#E8E6E0] rounded-2xl overflow-hidden">
        {studies.length === 0 ? (
          <p className="text-sm text-[#A1A1AA] text-center py-10">
            No case studies yet. Add your first client&apos;s numbers — the /case-studies page shows honest illustrative scenarios until then.
          </p>
        ) : (
          <div className="divide-y divide-[#F5F4EF]">
            {studies.map((c) => (
              <div key={c.id} className="px-5 py-3 flex items-center gap-3">
                <span className={`text-[10px] font-black px-2 py-1 rounded-full ${c.published ? "bg-[#DCFCE7] text-[#166534]" : "bg-[#F5F4EF] text-[#71717A]"}`}>
                  {c.published ? "Live" : "Draft"}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-[#18181B] truncate">{c.business}</p>
                  <p className="text-[11px] text-[#A1A1AA] truncate">{c.headline}</p>
                </div>
                <button onClick={() => togglePublished(c)} className="p-1.5 rounded-lg text-[#52525B] hover:bg-[#F5F4EF]" title={c.published ? "Unpublish" : "Publish"}>
                  {c.published ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </button>
                <button onClick={() => remove(c.id)} className="p-1.5 rounded-lg text-[#A1A1AA] hover:text-[#B91C1C] hover:bg-[#FEE2E2]">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const inpCls = "bg-[#FAFAF7] border border-[#E8E6E0] rounded-xl px-3 py-2 text-sm text-[#18181B] placeholder-[#A1A1AA] focus:outline-none focus:border-[#36671E]";

function Inp({ label, v, on, ph }: { label: string; v: string; on: (v: string) => void; ph?: string }) {
  return (
    <div>
      <label className="block text-xs font-bold text-[#52525B] uppercase tracking-widest mb-1.5">{label}</label>
      <input value={v} onChange={(e) => on(e.target.value)} placeholder={ph} className={`${inpCls} w-full`} />
    </div>
  );
}
function Txt({ label, v, on, ph }: { label: string; v: string; on: (v: string) => void; ph?: string }) {
  return (
    <div>
      <label className="block text-xs font-bold text-[#52525B] uppercase tracking-widest mb-1.5">{label}</label>
      <textarea value={v} onChange={(e) => on(e.target.value)} placeholder={ph} rows={2} className={`${inpCls} w-full resize-y`} />
    </div>
  );
}
