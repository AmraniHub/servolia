"use client";

import { useState } from "react";
import Link from "next/link";
import type { Notice } from "@/lib/clientNotices";

/**
 * The bell in the header.
 *
 * It only appears when there is something to say. A bell that is always there
 * and always empty trains a client to ignore it, and then the one notice that
 * mattered — a failed payment, a site that stopped answering — is ignored too.
 *
 * Dismissing is per notice and permanent for that client. A derived notice
 * comes back if the underlying thing changes, which is the behaviour you want:
 * "your payment failed" dismissed in March should reappear in June if it fails
 * again, and should not nag in between.
 */

const T = {
  en: { label: "Notifications", none: "Nothing new.", dismiss: "Dismiss", close: "Close" },
  fr: { label: "Notifications", none: "Rien de nouveau.", dismiss: "Masquer", close: "Fermer" },
};

export default function NoticeBell({
  notices,
  lang,
  token,
}: {
  notices: Notice[];
  lang: "en" | "fr";
  token: string;
}) {
  const t = T[lang];
  const [open, setOpen] = useState(false);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const live = notices.filter((n) => !hidden.has(n.id));

  if (!notices.length) return null;

  async function dismiss(id: string) {
    setHidden((prev) => new Set(prev).add(id));
    try {
      await fetch("/api/client-area?do=dismiss-notice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ t: token, id }),
      });
    } catch {
      /* The panel already hid it; a failed write means it returns next visit,
         which is the safe direction to fail in. */
    }
  }

  const tone: Record<Notice["tone"], string> = {
    good: "border-[#CBE3BC] bg-[#F7FBF4]",
    warn: "border-[#F5C6C6] bg-[#FDECEC]",
    info: "border-[#E8E6E0] bg-white",
  };

  return (
    <div className="relative shrink-0">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={t.label}
        aria-expanded={open}
        className="relative flex items-center justify-center w-9 h-9 rounded-xl hover:bg-[#F4F2EC] transition-colors"
      >
        <svg viewBox="0 0 24 24" className="w-[18px] h-[18px] text-[#3F3F46]" fill="none" stroke="currentColor"
          strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M18 8a6 6 0 10-12 0c0 7-3 8-3 8h18s-3-1-3-8M13.7 21a2 2 0 01-3.4 0" />
        </svg>
        {live.length ? (
          <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-[#B91C1C] text-white text-[10px] font-black leading-4 text-center">
            {live.length}
          </span>
        ) : null}
      </button>

      {open ? (
        <>
          {/* A full-screen click target behind the panel, so tapping anywhere
              closes it on a phone where there is no "outside" to click. */}
          <button className="fixed inset-0 z-30 cursor-default" aria-label={t.close} onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-[min(22rem,calc(100vw-2.5rem))] z-40 rounded-2xl border border-[#E8E6E0] bg-white shadow-[0_8px_30px_rgba(0,0,0,0.12)] overflow-hidden">
            <p className="px-4 py-3 text-[10px] font-black text-[#8A8A80] uppercase tracking-widest border-b border-[#F0EFEA]">
              {t.label}
            </p>
            {live.length === 0 ? (
              <p className="px-4 py-5 text-[14px] text-[#71717A]">{t.none}</p>
            ) : (
              <ul className="max-h-[70vh] overflow-y-auto divide-y divide-[#F0EFEA]">
                {live.map((n) => (
                  <li key={n.id} className={`px-4 py-4 border-l-[3px] ${tone[n.tone]}`}>
                    <p className="text-[14px] font-bold text-[#18181B] leading-snug">{n.title}</p>
                    <p className="mt-1 text-[13px] text-[#52525B] leading-relaxed">{n.body}</p>
                    <div className="mt-2.5 flex items-center gap-4">
                      {n.href && n.cta ? (
                        <Link href={n.href} className="text-[13px] font-bold text-[#36671E] hover:underline">
                          {n.cta} →
                        </Link>
                      ) : null}
                      <button onClick={() => dismiss(n.id)} className="text-[12.5px] text-[#8A8A80] hover:underline">
                        {t.dismiss}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
