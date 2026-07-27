"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Target, Upload, Wand2, MessageCircle, AtSign, ExternalLink,
  Copy, Check, ChevronRight, Trash2, PhoneCall, Mail, Plus, X, Send, Loader2, MapPin,
} from "lucide-react";
import { waLink } from "@/lib/whatsapp";

/**
 * Outbound prospecting board — cold dental clinics through the mystery-shop
 * funnel. One-click demo generation, WhatsApp/call links, touch logging, and
 * stage advancement. The founder's daily driver for P6 (founder-led sales).
 */

interface Prospect {
  id: string;
  business: string; owner_name: string | null; city: string | null; niche: string | null;
  phone: string | null; email: string | null; instagram: string | null; website: string | null;
  status: string; demo_slug: string | null; mystery_shop_notes: string | null;
  touch_count: number; last_touch_at: string | null; notes: string | null;
}

const STAGES: { key: string; label: string; color: string }[] = [
  { key: "to_contact", label: "To contact", color: "#71717A" },
  { key: "mystery_shopped", label: "Mystery-shopped", color: "#B45309" },
  { key: "demo_sent", label: "Demo sent", color: "#7C3AED" },
  { key: "followup_1", label: "Follow-up 1", color: "#2563EB" },
  { key: "followup_2", label: "Follow-up 2", color: "#2563EB" },
  { key: "replied", label: "Replied", color: "#0891B2" },
  { key: "call_booked", label: "Call booked", color: "#CA8A04" },
  { key: "won", label: "Won", color: "#166534" },
  { key: "lost", label: "Lost", color: "#B91C1C" },
];
const stageOf = (k: string) => STAGES.find((s) => s.key === k) ?? STAGES[0];

export default function ProspectsManager() {
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [csv, setCsv] = useState("");
  const [importing, setImporting] = useState(false);
  const [notice, setNotice] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [showAddOne, setShowAddOne] = useState(false);
  const [showMaps, setShowMaps] = useState(false);
  const [mapsQuery, setMapsQuery] = useState("");
  const [mapsNiche, setMapsNiche] = useState("aesthetic");
  const [mapsBusy, setMapsBusy] = useState(false);
  const [addOne, setAddOne] = useState({ business: "", owner_name: "", city: "", phone: "", email: "", website: "", niche: "dental" });
  const [addOneBusy, setAddOneBusy] = useState(false);
  const [emailFor, setEmailFor] = useState<Prospect | null>(null);
  const [emailDraft, setEmailDraft] = useState<{ subject: string; body: string; previewUrl: string } | null>(null);
  const [emailBusy, setEmailBusy] = useState<"drafting" | "sending" | null>(null);
  const [emailNotice, setEmailNotice] = useState("");
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/prospects");
    if (res.ok) setProspects((await res.json()).prospects ?? []);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function importCsv() {
    if (!csv.trim() || importing) return;
    setImporting(true); setNotice("");
    try {
      const res = await fetch("/api/admin/prospects", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv, niche: "dental" }),
      });
      const data = await res.json();
      if (res.ok) { setNotice(`✅ Imported ${data.imported}`); setCsv(""); setShowImport(false); load(); }
      else setNotice(`⚠️ ${data.error}`);
    } finally { setImporting(false); }
  }

  async function patch(id: string, body: Record<string, unknown>) {
    await fetch("/api/admin/prospects", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...body }),
    });
    load();
  }

  async function generateDemo(p: Prospect) {
    setBusyId(p.id);
    try {
      const res = await fetch("/api/admin/demo", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessName: p.business, city: p.city ?? "", niche: p.niche ?? "dental", lang: "fr", services: "" }),
      });
      const data = await res.json();
      if (res.ok) await patch(p.id, { demo_slug: data.slug, status: "demo_sent", logTouch: true });
    } finally { setBusyId(null); }
  }

  function advance(p: Prospect) {
    const i = STAGES.findIndex((s) => s.key === p.status);
    const next = STAGES[Math.min(i + 1, STAGES.length - 3)]; // don't auto-jump to won/lost
    patch(p.id, { status: next.key, logTouch: true });
  }

  function copy(text: string, key: string) {
    navigator.clipboard.writeText(text);
    setCopied(key); setTimeout(() => setCopied(null), 1500);
  }

  async function importFromMaps() {
    if (!mapsQuery.trim() || mapsBusy) return;
    setMapsBusy(true); setNotice("");
    try {
      const res = await fetch("/api/admin/prospects/places-import", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: mapsQuery, niche: mapsNiche }),
      });
      const data = await res.json();
      if (res.ok) {
        setNotice(`✅ ${data.imported} imported${data.skipped ? `, ${data.skipped} skipped (dupes)` : ""}`);
        setMapsQuery(""); setShowMaps(false); load();
      } else setNotice(`⚠️ ${data.error}`);
    } finally { setMapsBusy(false); }
  }

  async function addOneProspect() {
    if (!addOne.business.trim() || addOneBusy) return;
    setAddOneBusy(true);
    try {
      const res = await fetch("/api/admin/prospects", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ one: {
          business: addOne.business.trim(),
          owner_name: addOne.owner_name.trim() || undefined,
          city: addOne.city.trim() || undefined,
          phone: addOne.phone.trim().replace(/[^\d+]/g, "") || undefined,
          email: addOne.email.trim() || undefined,
          website: addOne.website.trim() || undefined,
        }, niche: addOne.niche }),
      });
      if (res.ok) {
        setAddOne({ business: "", owner_name: "", city: "", phone: "", email: "", website: "", niche: addOne.niche });
        setShowAddOne(false);
        load();
      } else {
        const d = await res.json().catch(() => ({}));
        setNotice(`⚠️ ${d.error ?? "Add failed"}`);
      }
    } finally { setAddOneBusy(false); }
  }

  async function openEmailFor(p: Prospect) {
    setEmailFor(p); setEmailDraft(null); setEmailNotice(""); setEmailBusy("drafting");
    try {
      const res = await fetch("/api/admin/prospects/cold-email", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: p.id, mode: "draft" }),
      });
      const data = await res.json();
      if (res.ok) setEmailDraft({ subject: data.subject, body: data.body, previewUrl: data.previewUrl });
      else setEmailNotice(data.error ?? "Draft failed");
    } finally { setEmailBusy(null); }
  }

  async function sendEmail() {
    if (!emailFor || !emailDraft || emailBusy) return;
    setEmailBusy("sending"); setEmailNotice("");
    try {
      const res = await fetch("/api/admin/prospects/cold-email", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: emailFor.id, mode: "send", subject: emailDraft.subject, body: emailDraft.body }),
      });
      const data = await res.json();
      if (res.ok) {
        setEmailNotice("✅ Sent");
        setTimeout(() => { setEmailFor(null); setEmailDraft(null); setEmailNotice(""); load(); }, 900);
      } else {
        setEmailNotice(`⚠️ ${data.error ?? "Send failed"}`);
      }
    } finally { setEmailBusy(null); }
  }

  async function remove(id: string) {
    if (!confirm("Delete this prospect?")) return;
    await fetch(`/api/admin/prospects?id=${id}`, { method: "DELETE" });
    load();
  }

  const active = prospects.filter((p) => !["won", "lost"].includes(p.status));
  const byStage = (k: string) => prospects.filter((p) => p.status === k);

  // mystery-shop DM template (FR) to copy into Instagram/WhatsApp
  const shopMsg = (p: Prospect) =>
    `Bonjour, je cherche un rendez-vous${p.city ? ` à ${p.city}` : ""} — quels sont vos délais et le tarif d'une première consultation ?`;

  return (
    <div className="p-6 max-w-5xl">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-black text-[#18181B] flex items-center gap-2">
            <Target className="w-5 h-5 text-[#36671E]" /> Prospects
          </h1>
          <p className="text-sm text-[#71717A]">Cold clinics → mystery-shop → demo → call. {active.length} active.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => { setShowMaps((s) => !s); setShowAddOne(false); setShowImport(false); }} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#36671E] text-white text-sm font-bold hover:bg-[#295115]">
            <MapPin className="w-4 h-4" /> Google Maps
          </button>
          <button onClick={() => { setShowAddOne((s) => !s); setShowImport(false); setShowMaps(false); }} className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-[#E8E6E0] text-sm font-bold text-[#52525B] hover:bg-[#F5F4EF]">
            <Plus className="w-4 h-4" /> Add one
          </button>
          <button onClick={() => { setShowImport((s) => !s); setShowAddOne(false); setShowMaps(false); }} className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-[#E8E6E0] text-sm font-bold text-[#52525B] hover:bg-[#F5F4EF]">
            <Upload className="w-4 h-4" /> Import CSV
          </button>
        </div>
      </div>

      {showMaps && (
        <div className="bg-white border border-[#E8E6E0] rounded-2xl p-5 mb-5">
          <p className="text-xs text-[#71717A] mb-3">
            Type what you&apos;d type into Google Maps — up to 20 businesses come back with phone, website, rating and city. Duplicates are skipped automatically.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <input value={mapsQuery} onChange={(e) => setMapsQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && importFromMaps()}
              placeholder="clinique esthétique Lyon"
              className="flex-1 min-w-[220px] bg-[#FAFAF7] border border-[#E8E6E0] rounded-lg px-3 py-2 text-sm text-[#18181B] placeholder-[#A1A1AA] focus:outline-none focus:border-[#36671E]" />
            <select value={mapsNiche} onChange={(e) => setMapsNiche(e.target.value)}
              className="bg-[#FAFAF7] border border-[#E8E6E0] rounded-lg px-2.5 py-2 text-sm text-[#18181B] focus:outline-none focus:border-[#36671E]">
              <option value="aesthetic">Aesthetic / med-spa</option>
              <option value="dental">Dental</option>
              <option value="home-services">Home services</option>
            </select>
            <button onClick={importFromMaps} disabled={!mapsQuery.trim() || mapsBusy}
              className="px-4 py-2 rounded-lg bg-[#36671E] text-white text-sm font-bold disabled:opacity-40">
              {mapsBusy ? "Searching…" : "Import"}
            </button>
          </div>
          {notice && <p className="text-sm text-[#52525B] mt-3">{notice}</p>}
        </div>
      )}

      {showAddOne && (
        <div className="bg-white border border-[#E8E6E0] rounded-2xl p-5 mb-5">
          <div className="grid sm:grid-cols-2 gap-3">
            {([
              ["business", "Business name *", "Cabinet Dentaire Lumière"],
              ["owner_name", "Owner / dentist", "Dr Benali"],
              ["city", "City", "Lyon"],
              ["phone", "Phone", "+33 4 78 00 00 00"],
              ["email", "Email", "contact@lumiere.fr"],
              ["website", "Website", "lumiere-dentaire.fr"],
            ] as const).map(([k, label, ph]) => (
              <label key={k} className="flex flex-col gap-1">
                <span className="text-xs font-bold text-[#71717A]">{label}</span>
                <input value={addOne[k]} onChange={(e) => setAddOne((v) => ({ ...v, [k]: e.target.value }))} placeholder={ph}
                  className="bg-[#FAFAF7] border border-[#E8E6E0] rounded-lg px-3 py-2 text-sm text-[#18181B] placeholder-[#A1A1AA] focus:outline-none focus:border-[#36671E]" />
              </label>
            ))}
            <label className="flex flex-col gap-1">
              <span className="text-xs font-bold text-[#71717A]">Niche</span>
              <select value={addOne.niche} onChange={(e) => setAddOne((v) => ({ ...v, niche: e.target.value }))}
                className="bg-[#FAFAF7] border border-[#E8E6E0] rounded-lg px-3 py-2 text-sm text-[#18181B] focus:outline-none focus:border-[#36671E]">
                <option value="dental">Dental</option>
                <option value="aesthetic">Aesthetic / med-spa</option>
                <option value="home-services">Home services</option>
              </select>
            </label>
          </div>
          <div className="flex items-center gap-3 mt-4">
            <button onClick={addOneProspect} disabled={!addOne.business.trim() || addOneBusy}
              className="px-4 py-2 rounded-lg bg-[#36671E] text-white text-sm font-bold disabled:opacity-40">
              {addOneBusy ? "Adding…" : "Add prospect"}
            </button>
            <button onClick={() => setShowAddOne(false)} className="text-sm text-[#71717A] hover:text-[#18181B]">Cancel</button>
          </div>
        </div>
      )}

      {showImport && (
        <div className="bg-white border border-[#E8E6E0] rounded-2xl p-5 mb-5">
          <p className="text-xs text-[#71717A] mb-2">
            Columns: <code className="bg-[#F5F4EF] px-1.5 py-0.5 rounded">business, owner, city, phone, email, instagram, website</code> — header optional, business name required.
          </p>
          <textarea value={csv} onChange={(e) => setCsv(e.target.value)} rows={5}
            placeholder={"Cabinet Dentaire Lumière, Dr Benali, Lyon, +33478000000, contact@lumiere.fr, @cabinetlumiere, lumiere-dentaire.fr"}
            className="w-full bg-[#FAFAF7] border border-[#E8E6E0] rounded-xl px-3 py-2.5 text-sm font-mono text-[#18181B] placeholder-[#A1A1AA] focus:outline-none focus:border-[#36671E] resize-y" />
          <div className="flex items-center gap-3 mt-3">
            <button onClick={importCsv} disabled={!csv.trim() || importing} className="px-4 py-2 rounded-lg bg-[#36671E] text-white text-sm font-bold disabled:opacity-40">
              {importing ? "Importing…" : "Import"}
            </button>
            {notice && <span className="text-sm text-[#52525B]">{notice}</span>}
          </div>
        </div>
      )}

      {/* Stage counters */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-5">
        {STAGES.map((s) => {
          const n = byStage(s.key).length;
          return (
            <div key={s.key} className="flex-shrink-0 px-3 py-1.5 rounded-full bg-white border border-[#E8E6E0] text-xs font-bold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ background: s.color }} />
              {s.label} <span className="text-[#A1A1AA]">{n}</span>
            </div>
          );
        })}
      </div>

      {prospects.length === 0 ? (
        <p className="text-sm text-[#A1A1AA] text-center py-12 bg-white border border-[#E8E6E0] rounded-2xl">
          No prospects yet — import your target clinics above.
        </p>
      ) : (
        <div className="space-y-3">
          {prospects.map((p) => {
            const st = stageOf(p.status);
            const demoUrl = p.demo_slug ? `${origin}/sites/${p.demo_slug}` : null;
            const wa = p.phone ? waLink(p.phone, shopMsg(p)) : null;
            return (
              <div key={p.id} className="bg-white border border-[#E8E6E0] rounded-2xl p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-black text-[#18181B]">{p.business}</h3>
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-full text-white" style={{ background: st.color }}>{st.label}</span>
                      {p.touch_count > 0 && <span className="text-[10px] text-[#A1A1AA] font-bold">{p.touch_count} touch{p.touch_count > 1 ? "es" : ""}</span>}
                    </div>
                    <p className="text-xs text-[#71717A] mt-0.5">
                      {[p.owner_name, p.city, p.phone, p.email].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <button onClick={() => remove(p.id)} className="p-1.5 text-[#A1A1AA] hover:text-[#B91C1C] rounded-lg hover:bg-[#FEE2E2]" title="Delete">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Actions row */}
                <div className="flex items-center gap-1.5 mt-3 flex-wrap">
                  {wa && (
                    <a href={wa} target="_blank" rel="noopener noreferrer" onClick={() => p.status === "to_contact" && patch(p.id, { status: "mystery_shopped", logTouch: true })}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#25D366] text-white text-xs font-bold hover:opacity-90" title="Mystery-shop via WhatsApp">
                      <MessageCircle className="w-3.5 h-3.5" /> Shop
                    </a>
                  )}
                  {p.phone && (
                    <a href={`tel:${p.phone}`} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[#E8E6E0] text-xs font-bold text-[#52525B] hover:bg-[#F5F4EF]">
                      <PhoneCall className="w-3.5 h-3.5" /> Call
                    </a>
                  )}
                  {p.instagram && (
                    <a href={`https://instagram.com/${p.instagram.replace(/^@/, "")}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[#E8E6E0] text-xs font-bold text-[#52525B] hover:bg-[#F5F4EF]">
                      <AtSign className="w-3.5 h-3.5" /> IG
                    </a>
                  )}

                  {demoUrl ? (
                    <>
                      <button onClick={() => copy(demoUrl, p.id)} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[#36671E]/30 text-xs font-bold text-[#36671E] hover:bg-[#EEF5EA]">
                        {copied === p.id ? <><Check className="w-3.5 h-3.5" /> Copied</> : <><Copy className="w-3.5 h-3.5" /> Demo link</>}
                      </button>
                      <a href={demoUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#36671E] text-white text-xs font-bold hover:bg-[#295115]">
                        <ExternalLink className="w-3.5 h-3.5" /> Open
                      </a>
                      <button onClick={() => openEmailFor(p)} disabled={!p.email} title={p.email ? "AI-draft a cold email + send" : "Prospect has no email address"}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[#2563EB]/40 text-xs font-bold text-[#2563EB] hover:bg-[#EFF6FF] disabled:opacity-40 disabled:cursor-not-allowed">
                        <Mail className="w-3.5 h-3.5" /> Email
                      </button>
                    </>
                  ) : (
                    <button onClick={() => generateDemo(p)} disabled={busyId === p.id} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#36671E] text-white text-xs font-bold hover:bg-[#295115] disabled:opacity-40">
                      <Wand2 className="w-3.5 h-3.5" /> {busyId === p.id ? "Generating…" : "Generate demo"}
                    </button>
                  )}

                  {!["won", "lost"].includes(p.status) && (
                    <button onClick={() => advance(p)} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#18181B] text-white text-xs font-bold hover:opacity-90 ml-auto">
                      Advance <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <select
                    value={p.status}
                    onChange={(e) => patch(p.id, { status: e.target.value })}
                    className="text-xs font-bold border border-[#E8E6E0] rounded-lg px-2 py-1.5 bg-white text-[#52525B]"
                  >
                    {STAGES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                  </select>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {emailFor && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => !emailBusy && setEmailFor(null)}>
          <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl shadow-xl w-full max-w-xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="px-5 py-4 border-b border-[#E8E6E0] flex items-center gap-2">
              <Mail className="w-4 h-4 text-[#2563EB]" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-black text-[#18181B] truncate">Cold email · {emailFor.business}</p>
                <p className="text-xs text-[#71717A] truncate">To: {emailFor.email}</p>
              </div>
              <button onClick={() => !emailBusy && setEmailFor(null)} className="p-1.5 rounded-lg hover:bg-[#F5F4EF] text-[#71717A]">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 flex-1 overflow-y-auto space-y-3">
              {emailBusy === "drafting" ? (
                <div className="flex items-center gap-2 text-sm text-[#71717A] py-8 justify-center">
                  <Loader2 className="w-4 h-4 animate-spin" /> Claude is drafting…
                </div>
              ) : emailDraft ? (
                <>
                  <label className="flex flex-col gap-1">
                    <span className="text-xs font-bold text-[#71717A]">Subject</span>
                    <input value={emailDraft.subject} onChange={(e) => setEmailDraft((d) => d && { ...d, subject: e.target.value })}
                      className="bg-[#FAFAF7] border border-[#E8E6E0] rounded-lg px-3 py-2 text-sm text-[#18181B] focus:outline-none focus:border-[#36671E]" />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-xs font-bold text-[#71717A]">Body</span>
                    <textarea value={emailDraft.body} onChange={(e) => setEmailDraft((d) => d && { ...d, body: e.target.value })}
                      rows={12}
                      className="bg-[#FAFAF7] border border-[#E8E6E0] rounded-lg px-3 py-2 text-sm text-[#18181B] font-mono focus:outline-none focus:border-[#36671E] resize-y" />
                  </label>
                  <p className="text-[11px] text-[#A1A1AA]">Preview URL: <a href={emailDraft.previewUrl} target="_blank" rel="noopener noreferrer" className="text-[#36671E] underline">{emailDraft.previewUrl}</a></p>
                </>
              ) : (
                <p className="text-sm text-[#71717A]">{emailNotice || "No draft."}</p>
              )}
            </div>
            <div className="px-5 py-4 border-t border-[#E8E6E0] flex items-center gap-3">
              {emailNotice && <span className="text-xs text-[#52525B]">{emailNotice}</span>}
              <button onClick={sendEmail} disabled={!emailDraft || !!emailBusy}
                className="ml-auto flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#36671E] text-white text-sm font-bold hover:bg-[#295115] disabled:opacity-40">
                {emailBusy === "sending" ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Sending…</> : <><Send className="w-3.5 h-3.5" /> Send</>}
              </button>
              <button onClick={() => emailDraft && copy(`${emailDraft.subject}\n\n${emailDraft.body}`, `email-${emailFor.id}`)} disabled={!emailDraft}
                className="px-3 py-2 rounded-lg border border-[#E8E6E0] text-xs font-bold text-[#52525B] hover:bg-[#F5F4EF] disabled:opacity-40">
                {copied === `email-${emailFor.id}` ? <span className="flex items-center gap-1"><Check className="w-3.5 h-3.5" /> Copied</span> : <span className="flex items-center gap-1"><Copy className="w-3.5 h-3.5" /> Copy</span>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
