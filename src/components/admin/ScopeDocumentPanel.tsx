"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Copy, Check, Send } from "lucide-react";
import { BUILD_PLANS, CARE_PLANS } from "@/lib/pricing";
import { generateScopeDocument } from "@/lib/scopeDocument";

/**
 * Generates the scope document (see src/lib/scopeDocument.ts for why this is
 * plain text, not a live Google Docs integration). Paste the result into a
 * Google Doc and use Workspace's own "Request signature" action there —
 * there's no public API for that specific feature to hook into.
 */
export default function ScopeDocumentPanel({
  leadId, businessName, contactName, email, suggestedPlan,
}: { leadId: string; businessName: string; contactName?: string | null; email?: string | null; suggestedPlan?: string | null }) {
  const router = useRouter();
  const initialPlan = (Object.keys(BUILD_PLANS).find((k) => suggestedPlan?.toLowerCase().includes(k)) ?? "growth") as keyof typeof BUILD_PLANS;
  const [planKey, setPlanKey] = useState<keyof typeof BUILD_PLANS>(initialPlan);
  const [careKey, setCareKey] = useState<keyof typeof CARE_PLANS | "">("");
  const [doc, setDoc] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [marking, setMarking] = useState(false);
  const [marked, setMarked] = useState(false);
  const [markError, setMarkError] = useState("");

  function generate() {
    setDoc(generateScopeDocument({
      businessName, contactName, email, planKey,
      carePlanKey: careKey || null,
    }));
    setCopied(false);
  }

  async function copy() {
    if (!doc) return;
    await navigator.clipboard.writeText(doc);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function markSent() {
    if (marking || !doc) return;
    setMarking(true);
    setMarkError("");
    try {
      const res = await fetch(`/api/admin/leads/${leadId}/notes`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "email",
          description: `📄 Scope document sent — ${BUILD_PLANS[planKey].name} (€${BUILD_PLANS[planKey].totalEur})${careKey ? ` + ${CARE_PLANS[careKey].name} care plan` : ""}`,
        }),
      });
      if (!res.ok) { setMarkError("Failed to log — try again"); return; }
      setMarked(true);
      router.refresh();
    } catch {
      setMarkError("Failed to log — try again");
    } finally { setMarking(false); }
  }

  return (
    <div className="bg-white border border-[#E8E6E0] rounded-2xl p-4">
      <p className="text-xs font-black text-[#71717A] uppercase tracking-widest mb-3 flex items-center gap-1.5">
        <FileText className="w-3.5 h-3.5" /> Scope document
      </p>

      <div className="grid grid-cols-2 gap-2 mb-3">
        <select value={planKey} onChange={(e) => setPlanKey(e.target.value as keyof typeof BUILD_PLANS)}
          className="text-sm px-2.5 py-2 rounded-lg border border-[#E8E6E0] focus:outline-none focus:border-[#36671E]">
          {Object.values(BUILD_PLANS).map((p) => (
            <option key={p.key} value={p.key}>{p.name} — €{p.totalEur}</option>
          ))}
        </select>
        <select value={careKey} onChange={(e) => setCareKey(e.target.value as keyof typeof CARE_PLANS | "")}
          className="text-sm px-2.5 py-2 rounded-lg border border-[#E8E6E0] focus:outline-none focus:border-[#36671E]">
          <option value="">No care plan</option>
          {Object.values(CARE_PLANS).map((c) => (
            <option key={c.key} value={c.key}>{c.name} — €{c.monthlyEur}/mo</option>
          ))}
        </select>
      </div>

      <button onClick={generate}
        className="w-full py-2 rounded-lg bg-[#EEF5EA] text-[#36671E] font-semibold text-sm hover:bg-[#DCFCE7] transition-colors mb-3">
        {doc ? "Regenerate" : "Generate scope document"}
      </button>

      {doc && (
        <>
          <textarea readOnly value={doc} rows={10}
            className="w-full text-xs font-mono px-3 py-2 rounded-lg border border-[#E8E6E0] bg-[#FAFAF7] text-[#18181B] resize-none mb-2" />
          <div className="grid grid-cols-2 gap-2">
            <button onClick={copy}
              className="flex items-center justify-center gap-1.5 py-2 rounded-lg border border-[#E8E6E0] text-sm font-semibold text-[#52525B] hover:bg-[#F5F4EF] transition-colors">
              {copied ? <><Check className="w-3.5 h-3.5 text-[#36671E]" /> Copied</> : <><Copy className="w-3.5 h-3.5" /> Copy</>}
            </button>
            <button onClick={markSent} disabled={marking || marked}
              className="flex items-center justify-center gap-1.5 py-2 rounded-lg bg-[#36671E] text-white text-sm font-semibold hover:bg-[#295115] transition-colors disabled:opacity-50">
              {marked ? <><Check className="w-3.5 h-3.5" /> Logged</> : <><Send className="w-3.5 h-3.5" /> Mark sent</>}
            </button>
          </div>
          {markError && <p className="text-xs text-red-600 mt-2">{markError}</p>}
          <p className="text-[11px] text-[#A1A1AA] mt-2 leading-relaxed">
            Paste into a Google Doc, then use Workspace's <span className="font-semibold">Request signature</span> action on the doc — no direct API for that feature, so this step is manual.
          </p>
        </>
      )}
    </div>
  );
}
