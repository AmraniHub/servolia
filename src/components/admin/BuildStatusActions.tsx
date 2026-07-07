"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const STATUSES = [
  { key: "intake",    label: "Intake",    color: "#71717A" },
  { key: "building",  label: "Building",  color: "#D97706" },
  { key: "review",    label: "In review", color: "#8B5CF6" },
  { key: "delivered", label: "Delivered", color: "#2563EB" },
  { key: "live",      label: "Live",      color: "#059669" },
];

export default function BuildStatusActions({ buildId, currentStatus }: { buildId: string; currentStatus: string }) {
  const router = useRouter();
  const [status, setStatus] = useState(currentStatus);
  const [saving, setSaving] = useState(false);

  const update = async (newStatus: string) => {
    setStatus(newStatus);
    setSaving(true);
    await fetch(`/api/admin/builds/${buildId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    setSaving(false);
    router.refresh();
  };

  return (
    <div className="flex gap-1.5 flex-wrap">
      {STATUSES.map(s => {
        const active = status === s.key;
        return (
          <button key={s.key} onClick={() => update(s.key)} disabled={saving}
            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors disabled:opacity-50 ${
              active ? "text-[#FAFAF7]" : "bg-white border border-[#E8E6E0] text-[#52525B] hover:bg-[#F5F4EF]"
            }`}
            style={active ? { background: s.color } : {}}>
            {s.label}
          </button>
        );
      })}
    </div>
  );
}
