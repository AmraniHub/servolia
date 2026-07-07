"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Send, Phone, Mail, MessageSquare, StickyNote } from "lucide-react";

const TYPES = [
  { key: "note",    label: "Note",    icon: StickyNote, color: "#52525B" },
  { key: "call",    label: "Call",    icon: Phone,      color: "#36671E" },
  { key: "email",   label: "Email",   icon: Mail,       color: "#2563EB" },
  { key: "message", label: "Message", icon: MessageSquare, color: "#8B5CF6" },
];

export default function LeadActions({ leadId }: { leadId: string }) {
  const router = useRouter();
  const [type, setType] = useState("note");
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    setSaving(true);
    await fetch(`/api/admin/leads/${leadId}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, description: text }),
    });
    setText("");
    setSaving(false);
    router.refresh();
  };

  const handleDelete = async () => {
    if (!confirm("Delete this lead? This cannot be undone.")) return;
    await fetch(`/api/admin/leads/${leadId}`, { method: "DELETE" });
    router.push("/admin/leads");
  };

  return (
    <div className="space-y-3">
      <form onSubmit={handleAdd} className="bg-white border border-[#E8E6E0] rounded-2xl p-4">
        <p className="text-xs font-black text-[#71717A] uppercase tracking-widest mb-3">Add to timeline</p>
        <div className="flex gap-1.5 mb-3 flex-wrap">
          {TYPES.map(t => {
            const Icon = t.icon;
            const active = type === t.key;
            return (
              <button key={t.key} type="button" onClick={() => setType(t.key)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  active ? "bg-[#EEF5EA] text-[#36671E]" : "text-[#71717A] hover:bg-[#F5F4EF]"
                }`}>
                <Icon className="w-3.5 h-3.5" />{t.label}
              </button>
            );
          })}
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          placeholder={`Log a ${type}…`}
          className="w-full px-3 py-2 rounded-lg border border-[#E8E6E0] text-sm text-[#18181B] focus:outline-none focus:border-[#36671E] resize-none"
        />
        <button type="submit" disabled={!text.trim() || saving}
          className="mt-2 w-full py-2 rounded-lg bg-[#36671E] text-[#FAFAF7] font-semibold text-sm hover:bg-[#295115] transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5">
          {saving ? "Saving…" : <><Send className="w-3.5 h-3.5" /> Add to timeline</>}
        </button>
      </form>

      <button onClick={handleDelete}
        className="w-full py-2.5 rounded-xl border border-[#FEE2E2] bg-white text-[#DC2626] font-semibold text-sm hover:bg-[#FEE2E2] transition-colors flex items-center justify-center gap-1.5">
        <Trash2 className="w-3.5 h-3.5" /> Delete lead
      </button>
    </div>
  );
}
