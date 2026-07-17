"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Copy, Check, Send, Link as LinkIcon, MessageCircle, Loader2 } from "lucide-react";
import { BUILD_PLANS, CARE_PLANS } from "@/lib/pricing";
import { generateScopeDocument } from "@/lib/scopeDocument";
import { waLink } from "@/lib/whatsapp";

/**
 * Primary flow: generate a client-facing acceptance link (servolia.com/scope/[token])
 * where the client types their name, checks "I agree," and accepts — recorded as a
 * simple electronic signature, then handed straight to Stripe checkout. No Google
 * Docs, no manual eSignature clicks.
 *
 * Secondary flow ("Copy plain text" below): still available for pasting into a
 * Google Doc if you want an archival copy in Drive — Workspace's own eSignature
 * feature has no public API, so that path stays fully manual either way.
 */
export default function ScopeDocumentPanel({
  leadId, businessName, contactName, email, phone, suggestedPlan,
}: { leadId: string; businessName: string; contactName?: string | null; email?: string | null; phone?: string | null; suggestedPlan?: string | null }) {
  const router = useRouter();
  const initialPlan = (Object.keys(BUILD_PLANS).find((k) => suggestedPlan?.toLowerCase().includes(k)) ?? "growth") as keyof typeof BUILD_PLANS;
  const [planKey, setPlanKey] = useState<keyof typeof BUILD_PLANS>(initialPlan);
  const [careKey, setCareKey] = useState<keyof typeof CARE_PLANS | "">("");

  const [linkUrl, setLinkUrl] = useState<string | null>(null);
  const [creatingLink, setCreatingLink] = useState(false);
  const [linkError, setLinkError] = useState("");
  const [linkCopied, setLinkCopied] = useState(false);

  const [doc, setDoc] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [marking, setMarking] = useState(false);
  const [marked, setMarked] = useState(false);
  const [markError, setMarkError] = useState("");

  async function createLink() {
    if (creatingLink) return;
    setCreatingLink(true);
    setLinkError("");
    try {
      const res = await fetch(`/api/admin/leads/${leadId}/scope-link`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessName, contactName, email, planKey, carePlanKey: careKey || null }),
      });
      const data = await res.json();
      if (!res.ok) { setLinkError(data.error ?? "Failed to create link"); return; }
      setLinkUrl(data.url);
      router.refresh();
    } catch {
      setLinkError("Failed to create link");
    } finally { setCreatingLink(false); }
  }

  async function copyLink() {
    if (!linkUrl) return;
    await navigator.clipboard.writeText(linkUrl);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  }

  const waShareLink = linkUrl ? waLink(phone, `Hi${contactName ? " " + contactName : ""} 👋 Here's your Servolia scope document — please review and accept when ready: ${linkUrl}`) : null;

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

      {/* Primary: client-facing acceptance link */}
      <button onClick={createLink} disabled={creatingLink}
        className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-[#36671E] text-white font-semibold text-sm hover:bg-[#295115] transition-colors disabled:opacity-50 mb-2">
        {creatingLink ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Creating…</> : <><LinkIcon className="w-3.5 h-3.5" /> {linkUrl ? "Create another link" : "Create acceptance link"}</>}
      </button>
      {linkError && <p className="text-xs text-red-600 mb-2">{linkError}</p>}

      {linkUrl && (
        <div className="mb-3 p-3 rounded-lg bg-[#EEF5EA] border border-[#36671E]/20">
          <p className="text-xs font-mono text-[#18181B] break-all mb-2">{linkUrl}</p>
          <div className="grid gap-2" style={{ gridTemplateColumns: waShareLink ? "1fr 1fr" : "1fr" }}>
            <button onClick={copyLink}
              className="flex items-center justify-center gap-1.5 py-2 rounded-lg border border-[#36671E]/30 bg-white text-sm font-semibold text-[#36671E] hover:bg-[#DCFCE7] transition-colors">
              {linkCopied ? <><Check className="w-3.5 h-3.5" /> Copied</> : <><Copy className="w-3.5 h-3.5" /> Copy link</>}
            </button>
            {waShareLink && (
              <a href={waShareLink} target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 py-2 rounded-lg bg-[#25D366] text-white text-sm font-semibold hover:bg-[#1EBE57] transition-colors">
                <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
              </a>
            )}
          </div>
          <p className="text-[11px] text-[#71717A] mt-2 leading-relaxed">
            Client reviews, types their name, and accepts on this page — recorded automatically, then handed straight to the deposit checkout. Shows up on this lead's timeline once accepted.
          </p>
        </div>
      )}

      {/* Secondary: plain text for a manual Google Docs / Drive archival copy */}
      <details className="mt-1">
        <summary className="text-xs font-semibold text-[#71717A] cursor-pointer hover:text-[#18181B] transition-colors">
          Or copy as plain text for Google Docs
        </summary>
        <button onClick={generate}
          className="w-full py-2 rounded-lg bg-[#F5F4EF] text-[#52525B] font-semibold text-sm hover:bg-[#EDEBE4] transition-colors mt-2 mb-2">
          {doc ? "Regenerate" : "Generate plain-text scope"}
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
      </details>
    </div>
  );
}
