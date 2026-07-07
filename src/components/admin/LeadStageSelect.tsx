"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const STAGES = [
  { key: "new",          label: "New",          bg: "#DBEAFE", fg: "#1D4ED8" },
  { key: "audit_sent",   label: "Audit sent",   bg: "#FEF3C7", fg: "#92400E" },
  { key: "qualified",    label: "Qualified",    bg: "#EDE9FE", fg: "#5B21B6" },
  { key: "deposit_paid", label: "Deposit paid", bg: "#EEF5EA", fg: "#36671E" },
  { key: "live",         label: "Live",         bg: "#D1FAE5", fg: "#065F46" },
  { key: "lost",         label: "Lost",         bg: "#FEE2E2", fg: "#991B1B" },
];

export default function LeadStageSelect({ leadId, initialStage }: { leadId: string; initialStage: string }) {
  const router = useRouter();
  const [stage, setStage] = useState(initialStage);
  const [saving, setSaving] = useState(false);

  const handleChange = async (newStage: string) => {
    setStage(newStage);
    setSaving(true);
    await fetch(`/api/admin/leads/${leadId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage: newStage }),
    });
    setSaving(false);
    router.refresh();
  };

  const current = STAGES.find(s => s.key === stage) ?? STAGES[0];

  return (
    <select
      value={stage}
      onChange={(e) => handleChange(e.target.value)}
      disabled={saving}
      className="text-xs font-bold px-3 py-1.5 rounded-full whitespace-nowrap cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#36671E]/30 border-0 appearance-none disabled:opacity-50"
      style={{ background: current.bg, color: current.fg }}
    >
      {STAGES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
    </select>
  );
}
