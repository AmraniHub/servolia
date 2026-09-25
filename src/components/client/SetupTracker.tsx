"use client";

import { useState } from "react";
import { Check, Clock, ArrowRight, Circle, Copy, RefreshCw } from "lucide-react";
import { TRACKER_COPY, type Checklist, type ChecklistStep } from "@/lib/hostingSetup";

/**
 * THE SETUP CHECKLIST ON THE CLIENT'S OWN PAGE.
 *
 * What happens between paying and being hosted, step by step, each one either
 * measured (DNS, certificate, the site answering) or ticked by a person — and
 * labelled which, so "We're doing this" is never dressed up as a check that
 * passed. The step in front of them carries its action: the form to send, or
 * the exact DNS records with a copy button each.
 *
 * "Check again" re-runs the live checks (rate-limited server-side). Once every
 * step is done the whole card folds to one line.
 */

const fmt = (iso: string | null, lang: "en" | "fr", withTime = false) =>
  iso
    ? new Date(iso).toLocaleString(lang === "fr" ? "fr-FR" : "en-GB", {
        day: "numeric", month: "short", timeZone: "UTC",
        ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
      }) + (withTime ? " UTC" : "")
    : null;

function CopyButton({ value, label, done }: { value: string; label: string; done: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard?.writeText(value).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }).catch(() => {});
      }}
      className="inline-flex items-center gap-1 h-7 px-2 rounded-md border border-[#E2E6DD] bg-white text-[11.5px] font-bold text-[#36671E] hover:bg-[#F7FBF4] shrink-0"
      aria-label={`${label} ${value}`}
    >
      <Copy className="w-3 h-3" /> {copied ? done : label}
    </button>
  );
}

function StepIcon({ state }: { state: ChecklistStep["state"] }) {
  if (state === "done") {
    return <span className="w-6 h-6 rounded-full bg-[#36671E] flex items-center justify-center shrink-0"><Check className="w-3.5 h-3.5 text-white" /></span>;
  }
  if (state === "doing") {
    return <span className="w-6 h-6 rounded-full bg-[#FEF7E7] border border-[#F5E3B3] flex items-center justify-center shrink-0"><Clock className="w-3.5 h-3.5 text-[#92700E]" /></span>;
  }
  if (state === "action") {
    return <span className="w-6 h-6 rounded-full bg-[#F3F9EE] border border-[#36671E] flex items-center justify-center shrink-0"><ArrowRight className="w-3.5 h-3.5 text-[#36671E]" /></span>;
  }
  return <span className="w-6 h-6 rounded-full border border-[#E2E6DD] flex items-center justify-center shrink-0"><Circle className="w-2 h-2 text-[#D4D4CC]" /></span>;
}

export default function SetupTracker({
  initial,
  token,
  lang,
  sample = false,
}: {
  initial: Checklist;
  token: string;
  lang: "en" | "fr";
  sample?: boolean;
}) {
  const t = TRACKER_COPY[lang];
  const [list, setList] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function recheck() {
    if (sample) return;
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch("/api/hosting-setup/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, lang }),
      });
      if (res.status === 429) { setNote(t.tooSoon); return; }
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) { setNote(t.failed); return; }
      setList(data.checklist as Checklist);
    } catch {
      setNote(t.failed);
    } finally {
      setBusy(false);
    }
  }

  if (list.complete) {
    const finished = list.steps.map((s) => s.doneAt).filter(Boolean).sort().pop() ?? null;
    return (
      <div className="mb-6 rounded-2xl border border-[#CBE3BC] bg-[#F7FBF4] px-6 py-4 flex items-center gap-3" data-testid="setup-tracker-complete">
        <span className="w-6 h-6 rounded-full bg-[#36671E] flex items-center justify-center shrink-0"><Check className="w-3.5 h-3.5 text-white" /></span>
        <p className="text-[14px] text-[#3F3F46]">
          <strong className="text-[#18181B]">{t.headingDone}.</strong>{" "}
          {finished ? t.completeLine(fmt(finished, lang) ?? "") : null}
        </p>
      </div>
    );
  }

  const pct = Math.round((list.done / Math.max(1, list.total)) * 100);
  const badge = (s: ChecklistStep) =>
    s.state === "done" ? { text: t.done, cls: "text-[#36671E] bg-[#F3F9EE] border-[#CBE3BC]" }
      : s.state === "doing" ? { text: t.doing, cls: "text-[#92700E] bg-[#FEF7E7] border-[#F5E3B3]" }
      : s.state === "action" ? { text: t.yourStep, cls: "text-white bg-[#36671E] border-[#36671E]" }
      : { text: t.waiting, cls: "text-[#8A8A80] bg-[#F4F4F0] border-[#E8E6E0]" };

  return (
    <div className="mb-6 rounded-2xl border border-[#E8E6E0] bg-white overflow-hidden" data-testid="setup-tracker">
      <div className="px-6 sm:px-7 pt-6 pb-5 border-b border-[#F0EFEA]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-black text-[#8A8A80] uppercase tracking-widest mb-1">{t.heading}</p>
            <p className="text-[20px] font-black text-[#18181B] tabular-nums">{t.progress(list.done, list.total)}</p>
          </div>
          <button
            type="button"
            onClick={recheck}
            disabled={busy || sample}
            className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg border border-[#CBE3BC] bg-[#F7FBF4] text-[13px] font-bold text-[#36671E] hover:bg-[#F3F9EE] disabled:opacity-50 shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${busy ? "animate-spin" : ""}`} /> {busy ? t.checking : t.checkAgain}
          </button>
        </div>
        <div className="mt-4 h-2 rounded-full bg-[#F0EFEA] overflow-hidden" role="progressbar" aria-valuenow={list.done} aria-valuemin={0} aria-valuemax={list.total}>
          <div className="h-full bg-[#36671E] rounded-full transition-all" style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-2 text-[12px] text-[#8A8A80]">
          {list.checkedAt ? t.checkedAt(fmt(list.checkedAt, lang, true) ?? "") : null}
          {note ? <span className="ml-2 text-[#B45309]">{note}</span> : null}
        </p>
      </div>

      <ol className="divide-y divide-[#F0EFEA]">
        {list.steps.map((s) => {
          const b = badge(s);
          const current = s.id === list.current;
          return (
            <li key={s.id} className={`px-6 sm:px-7 py-4 flex gap-3.5 ${current ? "bg-[#FCFCF9]" : ""}`}>
              <StepIcon state={s.state} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <p className={`text-[15px] font-bold ${s.state === "waiting" ? "text-[#8A8A80]" : "text-[#18181B]"}`}>{s.title}</p>
                  <span className={`text-[10.5px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${b.cls}`}>{b.text}</span>
                </div>
                {s.detail ? <p className="mt-1 text-[13.5px] text-[#52525B] leading-relaxed">{s.detail}</p> : null}
                {s.state === "doing" && (s.startedAt || s.promise) ? (
                  <p className="mt-1 text-[12.5px] text-[#8A8A80] leading-relaxed">
                    {s.startedAt ? t.started(fmt(s.startedAt, lang) ?? "") : null}
                    {s.startedAt && s.promise ? " · " : null}
                    {s.promise}
                  </p>
                ) : null}
                {s.state === "done" && s.doneAt ? (
                  <p className="mt-0.5 text-[12px] text-[#A8A8A0]">{fmt(s.doneAt, lang)}</p>
                ) : null}
                {s.cta ? (
                  <a href={s.cta.href} className="inline-flex items-center gap-1.5 mt-2.5 h-9 px-4 rounded-lg bg-[#36671E] text-white text-[13px] font-bold hover:opacity-90">
                    {s.cta.label} <ArrowRight className="w-3.5 h-3.5" />
                  </a>
                ) : null}

                {current && s.id === "dns" && list.records.length ? (
                  <div className="mt-3 rounded-xl border border-[#E8E6E0] overflow-hidden" data-testid="setup-records">
                    <p className="px-4 py-2.5 text-[11px] font-black text-[#8A8A80] uppercase tracking-widest bg-[#FAFAF7] border-b border-[#F0EFEA]">{t.recordsTitle}</p>
                    <ul className="divide-y divide-[#F0EFEA]">
                      {list.records.map((r) => (
                        <li key={`${r.type}-${r.name}`} className="px-4 py-3 text-[13px]">
                          <div className="grid grid-cols-[auto_auto_1fr] gap-x-4 gap-y-1 items-center">
                            <span className="text-[#8A8A80] text-[11px] font-bold uppercase">{t.type}</span>
                            <span className="text-[#8A8A80] text-[11px] font-bold uppercase">{t.name}</span>
                            <span className="text-[#8A8A80] text-[11px] font-bold uppercase">{t.value}</span>
                            <span className="font-mono font-bold text-[#18181B]">{r.type}</span>
                            <span className="flex items-center gap-2"><span className="font-mono font-bold text-[#18181B]">{r.name}</span><CopyButton value={r.name} label={t.copy} done={t.copied} /></span>
                            <span className="flex items-center gap-2 min-w-0"><span className="font-mono font-bold text-[#18181B] break-all">{r.value}</span><CopyButton value={r.value} label={t.copy} done={t.copied} /></span>
                          </div>
                          <p className={`mt-1.5 text-[12px] ${r.ok ? "text-[#36671E]" : "text-[#8A8A80]"}`}>
                            {t.answersNow}: <span className="font-mono">{r.found.length ? r.found.join(", ") : t.answersNothing}</span>
                            {r.ok ? ` · ${t.answersOk}` : ""}
                          </p>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {current && s.id === "dns" && list.recordsBy === "none" ? (
                  <p className="mt-2 text-[12.5px] text-[#8A8A80]">{t.recordsNone}</p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
