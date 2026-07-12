"use client";

import { useState, useEffect, useCallback } from "react";
import { Wand2, Copy, ExternalLink, Check, Sparkles } from "lucide-react";

/**
 * Prospect demo generator — the pre-sale closing tool.
 * Fill a clinic's name + services, generate a live demo of THEIR AI receptionist,
 * copy the link, and send it in outreach. No payment required.
 */

interface Demo {
  slug: string;
  businessName: string;
  niche: string | null;
  language: "en" | "fr";
}

const NICHES = ["dental", "aesthetic", "med-spa", "hair-transplant", "real-estate", "home-services", "law-firm"];

export default function DemoGenerator() {
  const [form, setForm] = useState({
    businessName: "",
    city: "",
    niche: "dental",
    services: "",
    phone: "",
    lang: "fr",
    demoContactUrl: "",
  });
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ url: string; ai: boolean } | null>(null);
  const [error, setError] = useState("");
  const [demos, setDemos] = useState<Demo[]>([]);
  const [copied, setCopied] = useState<string | null>(null);

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const loadDemos = useCallback(async () => {
    const res = await fetch("/api/admin/demo");
    if (res.ok) setDemos((await res.json()).demos ?? []);
  }, []);

  useEffect(() => { loadDemos(); }, [loadDemos]);

  async function generate() {
    if (!form.businessName.trim() || busy) return;
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch("/api/admin/demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (res.ok) {
        setResult({ url: data.url, ai: data.ai });
        loadDemos();
      } else {
        setError(data.error ?? "Generation failed");
      }
    } catch {
      setError("Connection error");
    }
    setBusy(false);
  }

  function copy(url: string) {
    navigator.clipboard.writeText(url);
    setCopied(url);
    setTimeout(() => setCopied(null), 1500);
  }

  const origin = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <div className="p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-xl font-black text-[#18181B] flex items-center gap-2">
          <Wand2 className="w-5 h-5 text-[#36671E]" /> Prospect demo generator
        </h1>
        <p className="text-sm text-[#71717A]">
          Build a live demo of a clinic&apos;s own AI receptionist in 60 seconds. Send the link in outreach — let them meet their receptionist before they pay.
        </p>
      </div>

      {/* Form */}
      <div className="bg-white border border-[#E8E6E0] rounded-2xl p-5 mb-6">
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Clinic name *" value={form.businessName} onChange={(v) => set("businessName", v)} placeholder="Cabinet Dentaire Dupont" />
          <Field label="City" value={form.city} onChange={(v) => set("city", v)} placeholder="Lyon" />
          <div>
            <Label>Niche</Label>
            <select value={form.niche} onChange={(e) => set("niche", e.target.value)} className={selectCls}>
              {NICHES.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div>
            <Label>Language</Label>
            <select value={form.lang} onChange={(e) => set("lang", e.target.value)} className={selectCls}>
              <option value="fr">Français</option>
              <option value="en">English</option>
            </select>
          </div>
          <Field label="Phone (optional)" value={form.phone} onChange={(v) => set("phone", v)} placeholder="+33 4 00 00 00 00" />
          <Field label="Book-a-call link (optional)" value={form.demoContactUrl} onChange={(v) => set("demoContactUrl", v)} placeholder="https://servolia.com/contact" />
        </div>
        <div className="mt-4">
          <Label>Services — one per line or comma-separated</Label>
          <textarea
            value={form.services}
            onChange={(e) => set("services", e.target.value)}
            rows={4}
            placeholder={"Détartrage & contrôle\nBlanchiment dentaire\nImplants dentaires\nInvisalign"}
            className="w-full bg-[#FAFAF7] border border-[#E8E6E0] rounded-xl px-3 py-2.5 text-sm text-[#18181B] placeholder-[#A1A1AA] focus:outline-none focus:border-[#36671E] resize-y"
          />
        </div>

        <div className="flex items-center gap-3 mt-4">
          <button
            onClick={generate}
            disabled={!form.businessName.trim() || busy}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#36671E] text-[#FAFAF7] text-sm font-bold disabled:opacity-40 hover:bg-[#295115] transition-colors"
          >
            <Sparkles className="w-4 h-4" /> {busy ? "Generating…" : "Generate demo"}
          </button>
          {error && <span className="text-sm text-[#B91C1C]">{error}</span>}
        </div>

        {result && (
          <div className="mt-4 p-4 rounded-xl bg-[#EEF5EA] border border-[#36671E]/20">
            <p className="text-sm font-bold text-[#166534] mb-2">
              ✅ Demo live{result.ai ? " (AI-written copy)" : " (draft copy — AI unavailable)"}
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              <code className="text-sm bg-white px-3 py-1.5 rounded-lg border border-[#E8E6E0] text-[#18181B] break-all">{result.url}</code>
              <button onClick={() => copy(result.url)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white border border-[#E8E6E0] text-sm font-bold text-[#36671E] hover:bg-[#F5F4EF]">
                {copied === result.url ? <><Check className="w-3.5 h-3.5" /> Copied</> : <><Copy className="w-3.5 h-3.5" /> Copy</>}
              </button>
              <a href={result.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#36671E] text-white text-sm font-bold hover:bg-[#295115]">
                <ExternalLink className="w-3.5 h-3.5" /> Open
              </a>
            </div>
          </div>
        )}
      </div>

      {/* Existing demos */}
      <div className="bg-white border border-[#E8E6E0] rounded-2xl overflow-hidden">
        <div className="px-5 py-3 border-b border-[#E8E6E0] bg-[#FAFAF7]">
          <h2 className="font-black text-[#18181B] text-sm">Your demos ({demos.length})</h2>
        </div>
        {demos.length === 0 ? (
          <p className="text-sm text-[#A1A1AA] text-center py-8">No demos yet — generate your first above.</p>
        ) : (
          <div className="divide-y divide-[#F5F4EF]">
            {demos.map((d) => {
              const url = `${origin}/sites/${d.slug}`;
              return (
                <div key={d.slug} className="px-5 py-3 flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-[#18181B] truncate">{d.businessName}</p>
                    <p className="text-[11px] text-[#A1A1AA]">/sites/{d.slug} · {d.niche} · {d.language}</p>
                  </div>
                  <button onClick={() => copy(url)} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[#E8E6E0] text-xs font-bold text-[#36671E] hover:bg-[#F5F4EF]">
                    {copied === url ? <><Check className="w-3.5 h-3.5" /> Copied</> : <><Copy className="w-3.5 h-3.5" /> Copy</>}
                  </button>
                  <a href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#36671E] text-white text-xs font-bold hover:bg-[#295115]">
                    <ExternalLink className="w-3.5 h-3.5" /> Open
                  </a>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

const selectCls = "w-full bg-[#FAFAF7] border border-[#E8E6E0] rounded-xl px-3 py-2.5 text-sm font-semibold text-[#18181B] focus:outline-none focus:border-[#36671E]";

function Label({ children }: { children: React.ReactNode }) {
  return <label className="block text-xs font-bold text-[#52525B] uppercase tracking-widest mb-1.5">{children}</label>;
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <Label>{label}</Label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-[#FAFAF7] border border-[#E8E6E0] rounded-xl px-3 py-2.5 text-sm text-[#18181B] placeholder-[#A1A1AA] focus:outline-none focus:border-[#36671E]"
      />
    </div>
  );
}
