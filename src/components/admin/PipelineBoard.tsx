"use client";

import { useState } from "react";
import Link from "next/link";
import { GripVertical, AlertTriangle } from "lucide-react";
import { computeLeadScore, scoreColors, scoreLabel } from "@/lib/scoring";

interface Lead {
  id: string;
  created_at: string;
  last_contacted_at?: string | null;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  business?: string | null;
  country?: string | null;
  niche?: string | null;
  source: string;
  stage: string;
  value_estimate: number;
}

const COLUMNS = [
  { key: "new",          label: "New",          color: "#2563EB" },
  { key: "audit_sent",   label: "Audit sent",   color: "#D97706" },
  { key: "qualified",    label: "Qualified",    color: "#8B5CF6" },
  { key: "deposit_paid", label: "Deposit paid", color: "#36671E" },
  { key: "live",         label: "Live",         color: "#059669" },
  { key: "lost",         label: "Lost",         color: "#991B1B" },
];

function ageHours(l: Lead): number {
  const ref = l.last_contacted_at ?? l.created_at;
  return (Date.now() - new Date(ref).getTime()) / 3_600_000;
}

export default function PipelineBoard({ initialLeads }: { initialLeads: Lead[] }) {
  const [leads, setLeads] = useState<Lead[]>(initialLeads);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<string | null>(null);

  const moveLead = async (id: string, newStage: string) => {
    const prev = leads.find(l => l.id === id);
    if (!prev || prev.stage === newStage) return;
    setLeads(ls => ls.map(l => l.id === id ? { ...l, stage: newStage } : l));
    try {
      await fetch(`/api/admin/leads/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: newStage }),
      });
    } catch {
      // revert on failure
      setLeads(ls => ls.map(l => l.id === id ? { ...l, stage: prev.stage } : l));
    }
  };

  const onDrop = (stage: string) => {
    if (dragId) moveLead(dragId, stage);
    setDragId(null);
    setOverCol(null);
  };

  return (
    <div className="flex gap-4 overflow-x-auto pb-4 -mx-1 px-1">
      {COLUMNS.map(col => {
        const colLeads = leads
          .filter(l => l.stage === col.key)
          .sort((a, b) => computeLeadScore(b) - computeLeadScore(a));
        const colValue = colLeads.reduce((s, l) => s + Number(l.value_estimate ?? 0), 0);
        const isOver = overCol === col.key;

        return (
          <div key={col.key}
            onDragOver={(e) => { e.preventDefault(); setOverCol(col.key); }}
            onDragLeave={() => setOverCol(c => c === col.key ? null : c)}
            onDrop={() => onDrop(col.key)}
            className={`flex-shrink-0 w-[260px] rounded-2xl transition-colors ${isOver ? "bg-[#EEF5EA]" : "bg-[#F5F4EF]"}`}>

            {/* Column header */}
            <div className="px-3 py-3 flex items-center gap-2 sticky top-0">
              <span className="w-2 h-2 rounded-full" style={{ background: col.color }} />
              <span className="text-sm font-black text-[#18181B]">{col.label}</span>
              <span className="text-xs font-bold text-[#71717A] bg-white rounded-full px-2 py-0.5">{colLeads.length}</span>
              {colValue > 0 && (
                <span className="ml-auto text-[11px] font-bold text-[#36671E]">€{colValue.toLocaleString()}</span>
              )}
            </div>

            {/* Cards */}
            <div className={`px-2 pb-3 space-y-2 min-h-[120px] rounded-b-2xl ${isOver ? "ring-2 ring-[#36671E]/30 ring-inset" : ""}`}>
              {colLeads.length === 0 ? (
                <p className="text-xs text-[#A1A1AA] text-center py-6">Drop leads here</p>
              ) : colLeads.map(l => {
                const score = computeLeadScore(l);
                const sc = scoreColors(score);
                const overdue = !["live", "lost", "deposit_paid"].includes(l.stage) && ageHours(l) > 48;
                return (
                  <div key={l.id}
                    draggable
                    onDragStart={() => setDragId(l.id)}
                    onDragEnd={() => { setDragId(null); setOverCol(null); }}
                    className={`group bg-white rounded-xl border border-[#E8E6E0] p-3 cursor-grab active:cursor-grabbing hover:border-[#36671E]/40 hover:shadow-soft transition-all ${dragId === l.id ? "opacity-50" : ""}`}>
                    <div className="flex items-start gap-1.5">
                      <GripVertical className="w-3.5 h-3.5 text-[#D4D2CC] mt-0.5 shrink-0 group-hover:text-[#A1A1AA]" />
                      <div className="min-w-0 flex-1">
                        <Link href={`/admin/leads/${l.id}`} className="block">
                          <p className="text-sm font-bold text-[#18181B] truncate hover:text-[#36671E]">{l.business || l.name || "Unnamed"}</p>
                          <p className="text-[11px] text-[#71717A] truncate">{l.niche ?? "—"} · {l.country ?? "?"}</p>
                        </Link>
                        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                          <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full border ${sc.bg} ${sc.text} ${sc.border}`}>
                            {score} · {scoreLabel(score)}
                          </span>
                          {l.value_estimate > 0 && (
                            <span className="text-[10px] font-bold text-[#18181B]">€{Number(l.value_estimate).toLocaleString()}</span>
                          )}
                          {overdue && (
                            <span title="No contact in 48h+" className="flex items-center gap-0.5 text-[9px] font-black px-1.5 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200">
                              <AlertTriangle className="w-2.5 h-2.5" /> SLA
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
