"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Search, Download, Plus, AlertTriangle, Kanban } from "lucide-react";
import { computeLeadScore, scoreColors, scoreLabel } from "@/lib/scoring";

interface Lead {
  id: string;
  created_at: string;
  last_contacted_at?: string | null;
  name?: string;
  email?: string;
  phone?: string;
  website?: string;
  business?: string;
  country?: string;
  niche?: string;
  source: string;
  stage: string;
  value_estimate: number;
}

/** Returns hours since last contact (or since creation if never contacted). */
function ageHours(l: Lead): number {
  const ref = l.last_contacted_at ?? l.created_at;
  return (Date.now() - new Date(ref).getTime()) / 3_600_000;
}
function slaStatus(l: Lead): "fresh" | "warn" | "overdue" {
  if (["live", "lost", "deposit_paid"].includes(l.stage)) return "fresh";
  const h = ageHours(l);
  if (h > 48) return "overdue";
  if (h > 24) return "warn";
  return "fresh";
}

const STAGES = [
  { key: "all",          label: "All" },
  { key: "new",          label: "New" },
  { key: "audit_sent",   label: "Audit sent" },
  { key: "qualified",    label: "Qualified" },
  { key: "deposit_paid", label: "Deposit paid" },
  { key: "live",         label: "Live" },
  { key: "lost",         label: "Lost" },
];

function LeadsContent() {
  const params = useSearchParams();
  const initialStage = params.get("stage") ?? "all";
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [stage, setStage] = useState(initialStage);
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState("all");

  useEffect(() => {
    setLoading(true);
    const url = stage === "all" ? "/api/admin/leads" : `/api/admin/leads?stage=${stage}`;
    fetch(url).then(r => r.json()).then(d => {
      const sorted = (d.leads ?? []).sort((a: Lead, b: Lead) =>
        computeLeadScore(b) - computeLeadScore(a)
      );
      setLeads(sorted);
      setLoading(false);
    });
  }, [stage]);

  const sources = Array.from(new Set(leads.map(l => l.source).filter(Boolean)));

  const filtered = leads.filter(l => {
    if (sourceFilter !== "all" && l.source !== sourceFilter) return false;
    if (!search) return true;
    const s = search.toLowerCase();
    return (l.business?.toLowerCase().includes(s)) ||
           (l.email?.toLowerCase().includes(s)) ||
           (l.name?.toLowerCase().includes(s)) ||
           (l.niche?.toLowerCase().includes(s));
  });

  const updateStage = async (id: string, newStage: string) => {
    await fetch(`/api/admin/leads/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage: newStage }),
    });
    setLeads(prev => prev.map(l => l.id === id ? { ...l, stage: newStage } : l));
  };

  const totalValue = filtered.reduce((s, l) => s + Number(l.value_estimate ?? 0), 0);

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 lg:py-8 max-w-7xl mx-auto">
      <div className="flex items-end justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black text-[#18181B]">Leads</h1>
          <p className="text-sm text-[#71717A] mt-1">
            {filtered.length} {filtered.length === 1 ? "lead" : "leads"} · pipeline value €{totalValue.toLocaleString()}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/admin/pipeline"
            className="px-3 py-2.5 rounded-lg border border-[#E8E6E0] bg-white text-[#52525B] text-sm font-semibold hover:bg-[#F5F4EF] flex items-center gap-1.5">
            <Kanban className="w-4 h-4" /> Board
          </Link>
          <a href="/api/admin/export/leads" download
            className="px-3 py-2.5 rounded-lg border border-[#E8E6E0] bg-white text-[#52525B] text-sm font-semibold hover:bg-[#F5F4EF] flex items-center gap-1.5">
            <Download className="w-4 h-4" /> CSV
          </a>
          <Link href="/admin/leads/new"
            className="px-4 py-2.5 rounded-lg bg-[#36671E] text-[#FAFAF7] text-sm font-semibold hover:bg-[#295115] flex items-center gap-1.5">
            <Plus className="w-4 h-4" /> Add lead
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 mb-5 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A1A1AA]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search business, email, niche…"
            className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white border border-[#E8E6E0] text-sm text-[#18181B] focus:outline-none focus:border-[#36671E] transition-colors"
          />
        </div>
        {sources.length > 1 && (
          <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)}
            className="px-3 py-2.5 rounded-xl bg-white border border-[#E8E6E0] text-sm text-[#18181B] cursor-pointer focus:outline-none focus:border-[#36671E]">
            <option value="all">All sources</option>
            {sources.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        )}
        <div className="flex items-center gap-1 bg-white border border-[#E8E6E0] rounded-xl p-1 overflow-x-auto">
          {STAGES.map(s => (
            <button
              key={s.key}
              onClick={() => setStage(s.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                stage === s.key ? "bg-[#36671E] text-[#FAFAF7]" : "text-[#71717A] hover:text-[#18181B]"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-[#E8E6E0] rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[#FAFAF7] border-b border-[#E8E6E0]">
            <tr className="text-left text-[10px] font-black text-[#71717A] uppercase tracking-widest">
              <th className="px-4 py-3">Business</th>
              <th className="px-4 py-3 hidden md:table-cell">Niche</th>
              <th className="px-4 py-3 hidden lg:table-cell">Source</th>
              <th className="px-4 py-3">Stage</th>
              <th className="px-4 py-3 hidden md:table-cell">Value</th>
              <th className="px-4 py-3 hidden sm:table-cell">Score</th>
              <th className="px-4 py-3">Age</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-[#A1A1AA]">Loading…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-[#A1A1AA]">
                No leads yet. Submit the contact form, wait for the chatbot, or <Link href="/admin/leads/new" className="text-[#36671E] underline">add one manually</Link>.
              </td></tr>
            ) : filtered.map(l => {
              const sla = slaStatus(l);
              return (
              <tr key={l.id} className="border-b border-[#F5F4EF] last:border-0 hover:bg-[#FAFAF7] transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {sla === "overdue" && (
                      <span title="Overdue — no contact in 48h+" className="flex items-center gap-1 text-[10px] font-black px-1.5 py-0.5 rounded bg-red-50 text-red-700 border border-red-200">
                        <AlertTriangle className="w-3 h-3" /> SLA
                      </span>
                    )}
                    {sla === "warn" && (
                      <span title="Aging — last contact 24h+ ago" className="flex items-center gap-1 text-[10px] font-black px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                        <AlertTriangle className="w-3 h-3" />
                      </span>
                    )}
                    <Link href={`/admin/leads/${l.id}`} className="block min-w-0 flex-1">
                      <p className="font-semibold text-[#18181B] hover:text-[#36671E] transition-colors truncate">{l.business || l.name || "Unnamed"}</p>
                      <p className="text-xs text-[#71717A] truncate">{l.email ?? "no email"} · {l.country ?? "?"}</p>
                    </Link>
                  </div>
                </td>
                <td className="px-4 py-3 hidden md:table-cell text-[#52525B]">{l.niche ?? "—"}</td>
                <td className="px-4 py-3 hidden lg:table-cell text-[#71717A] text-xs">{l.source}</td>
                <td className="px-4 py-3">
                  <select
                    value={l.stage}
                    onChange={(e) => updateStage(l.id, e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    className="text-xs font-bold px-2 py-1 rounded-md border border-[#E8E6E0] bg-white cursor-pointer focus:outline-none focus:border-[#36671E]"
                    style={{ color: stageColor(l.stage) }}
                  >
                    {STAGES.filter(s => s.key !== "all").map(s => (
                      <option key={s.key} value={s.key}>{s.label}</option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-3 hidden md:table-cell text-[#18181B] font-semibold">
                  €{Number(l.value_estimate ?? 0).toLocaleString()}
                </td>
                <td className="px-4 py-3 hidden sm:table-cell">
                  <ScoreBadge score={computeLeadScore(l)} />
                </td>
                <td className="px-4 py-3 text-[#71717A] text-xs whitespace-nowrap">{ago(l.created_at)}</td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function LeadsPage() {
  return (
    <Suspense fallback={<div className="px-4 py-8 text-sm text-[#A1A1AA]">Loading…</div>}>
      <LeadsContent />
    </Suspense>
  );
}

function ago(ts: string): string {
  const diff = (Date.now() - new Date(ts).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return Math.floor(diff / 60) + "m";
  if (diff < 86400) return Math.floor(diff / 3600) + "h";
  if (diff < 86400 * 30) return Math.floor(diff / 86400) + "d";
  return new Date(ts).toLocaleDateString();
}

function stageColor(stage: string): string {
  const map: Record<string, string> = {
    new: "#1D4ED8", audit_sent: "#92400E", qualified: "#5B21B6",
    deposit_paid: "#36671E", live: "#065F46", lost: "#991B1B",
  };
  return map[stage] ?? "#71717A";
}

function ScoreBadge({ score }: { score: number }) {
  const c = scoreColors(score);
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full border ${c.bg} ${c.text} ${c.border}`}>
      {score} · {scoreLabel(score)}
    </span>
  );
}
