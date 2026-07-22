"use client";

import { useEffect, useState } from "react";
import { Send, Loader2, AlertTriangle, CheckCircle2, Users, Mail } from "lucide-react";

type Audience = "subscribers" | "leads";

export default function BroadcastComposer() {
  const [counts, setCounts] = useState<{ subscribers: number; leads: number } | null>(null);
  const [cap, setCap] = useState(300);
  const [audience, setAudience] = useState<Audience>("subscribers");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [testTo, setTestTo] = useState("");
  const [busy, setBusy] = useState<"test" | "send" | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState<string>("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/broadcast").then((r) => r.json()).then((d) => {
      setCounts(d.counts ?? null);
      if (d.cap) setCap(d.cap);
    }).catch(() => {});
  }, []);

  const recipients = counts ? counts[audience] : 0;

  async function post(payload: Record<string, unknown>, mode: "test" | "send") {
    setBusy(mode); setError(""); setResult("");
    try {
      const res = await fetch("/api/admin/broadcast", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const d = await res.json();
      if (!res.ok) { setError(d.error ?? "Send failed."); return; }
      if (mode === "test") {
        setResult(d.ok ? `Test sent to ${testTo}. Check it looks right before sending for real.` : "Test failed to send — check RESEND_API_KEY.");
      } else {
        setResult(
          `Sent to ${d.sent} recipient${d.sent === 1 ? "" : "s"}.` +
          (d.failed ? ` ${d.failed} failed.` : "") +
          (d.skipped ? ` ${d.skipped} skipped (unsubscribed).` : "") +
          (d.remaining ? ` ${d.remaining} left over the ${cap} cap — send again to continue.` : "")
        );
        setConfirming(false);
      }
    } catch { setError("Connection error."); }
    finally { setBusy(null); }
  }

  const canSend = subject.trim() && body.trim();
  const inp = "w-full px-3.5 py-2.5 rounded-xl border border-[#E8E6E0] text-sm text-[#18181B] placeholder:text-[#A1A1AA] focus:outline-none focus:border-[#36671E]";

  return (
    <div className="space-y-5">
      {/* Audience */}
      <div className="bg-white border border-[#E8E6E0] rounded-2xl p-6">
        <p className="text-xs font-black text-[#71717A] uppercase tracking-widest mb-3">Who receives it</p>
        <div className="grid sm:grid-cols-2 gap-3">
          {([
            { key: "subscribers", label: "Newsletter subscribers", note: "Opted in via the site — safest list.", icon: Mail },
            { key: "leads", label: "Leads with an email", note: "People who contacted you. Use sparingly.", icon: Users },
          ] as const).map((a) => (
            <button key={a.key} onClick={() => setAudience(a.key)}
              className={`text-left p-4 rounded-xl border-2 transition-colors ${
                audience === a.key ? "border-[#36671E] bg-[#EEF5EA]" : "border-[#E8E6E0] bg-[#FAFAF7] hover:border-[#D4D2CC]"
              }`}>
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="flex items-center gap-2 text-sm font-black text-[#18181B]">
                  <a.icon className="w-4 h-4 text-[#36671E]" /> {a.label}
                </span>
                <span className="text-sm font-black text-[#36671E]">{counts ? counts[a.key] : "—"}</span>
              </div>
              <p className="text-xs text-[#71717A]">{a.note}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Compose */}
      <div className="bg-white border border-[#E8E6E0] rounded-2xl p-6 space-y-4">
        <div>
          <label className="block text-xs font-black text-[#71717A] uppercase tracking-widest mb-2">Subject</label>
          <input value={subject} onChange={(e) => setSubject(e.target.value)} className={inp}
            placeholder="A short, specific subject line" />
        </div>
        <div>
          <label className="block text-xs font-black text-[#71717A] uppercase tracking-widest mb-2">
            Body <span className="font-normal normal-case text-[#A1A1AA]">— HTML allowed (&lt;p&gt;, &lt;a&gt;, &lt;strong&gt;)</span>
          </label>
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={10} className={`${inp} resize-y font-mono text-xs leading-relaxed`}
            placeholder={"<p>Bonjour,</p>\n<p>…</p>\n<p><a href=\"https://servolia.com/fr/audit\">Recevoir mon audit gratuit</a></p>"} />
          <p className="text-xs text-[#A1A1AA] mt-2">An unsubscribe footer is added automatically to every email.</p>
        </div>
      </div>

      {/* Test first */}
      <div className="bg-white border border-[#E8E6E0] rounded-2xl p-6">
        <p className="text-xs font-black text-[#71717A] uppercase tracking-widest mb-3">Send yourself a test first</p>
        <div className="flex flex-wrap gap-3">
          <input value={testTo} onChange={(e) => setTestTo(e.target.value)} type="email"
            placeholder="you@servolia.com" className={`${inp} flex-1 min-w-[220px]`} />
          <button onClick={() => post({ test: true, testTo, subject, bodyHtml: body }, "test")}
            disabled={!canSend || !testTo.trim() || busy !== null}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-[#E8E6E0] text-sm font-bold text-[#18181B] hover:border-[#36671E] hover:text-[#36671E] transition-colors disabled:opacity-50">
            {busy === "test" ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending…</> : "Send test"}
          </button>
        </div>
      </div>

      {/* Send for real */}
      <div className="bg-white border-2 border-[#D97706]/30 rounded-2xl p-6">
        {!confirming ? (
          <button onClick={() => setConfirming(true)} disabled={!canSend || recipients === 0}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-[#36671E] text-[#FAFAF7] font-black text-sm hover:bg-[#295115] transition-colors disabled:opacity-50">
            <Send className="w-4 h-4" /> Send to {recipients} {audience === "leads" ? "leads" : "subscribers"}
          </button>
        ) : (
          <div className="space-y-3">
            <div className="flex items-start gap-3 p-4 rounded-xl bg-[#FEF3C7] border border-[#D97706]/30">
              <AlertTriangle className="w-5 h-5 text-[#92400E] shrink-0 mt-0.5" />
              <p className="text-sm text-[#92400E] leading-relaxed">
                This sends a real email to <strong>{Math.min(recipients, cap)}</strong> people and can&apos;t be undone.
                {recipients > cap && <> Only the first {cap} go out this time.</>}
              </p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => post({ audience, subject, bodyHtml: body }, "send")} disabled={busy !== null}
                className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl bg-[#B91C1C] text-white font-black text-sm hover:bg-[#991B1B] transition-colors disabled:opacity-50">
                {busy === "send" ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending…</> : "Yes, send it now"}
              </button>
              <button onClick={() => setConfirming(false)} disabled={busy !== null}
                className="px-5 py-3.5 rounded-xl border border-[#E8E6E0] text-sm font-bold text-[#71717A] hover:text-[#18181B] transition-colors">
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {result && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-[#EEF5EA] border border-[#36671E]/25">
          <CheckCircle2 className="w-5 h-5 text-[#36671E] shrink-0 mt-0.5" />
          <p className="text-sm text-[#18181B]">{result}</p>
        </div>
      )}
      {error && (
        <div className="p-4 rounded-xl bg-[#FEE2E2] border border-[#B91C1C]/25 text-sm text-[#991B1B]">{error}</div>
      )}
    </div>
  );
}
