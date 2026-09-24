"use client";

import { useEffect, useState } from "react";

/**
 * A small "TEST MODE" pill, shown only in the founder's browser while test
 * mode is on (src/lib/testMode.ts). The companion cookie `sv_test_ui` only
 * says "worth asking": the pill then asks GET /api/admin/test-mode, which
 * runs the SAME check as a purchase (the signed httpOnly `sv_test`, bound to
 * a live admin session). A stale or copied hint cookie shows nothing.
 * Rendered from the root layout, so every thank-you page says plainly that
 * what was just bought was a test.
 */
export default function TestModeNote() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (!/(?:^|;\s*)sv_test_ui=1(?:;|$)/.test(document.cookie)) return;
    let alive = true;
    fetch("/api/admin/test-mode", { credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : null))
      .then((s: { on?: boolean } | null) => { if (alive) setOn(s?.on === true); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);
  if (!on) return null;
  return (
    <div
      role="status"
      className="fixed bottom-3 left-3 z-[9999] px-3 py-1.5 rounded-full bg-[#92400E] text-white text-xs font-black tracking-widest shadow-lg pointer-events-none"
    >
      TEST MODE — Stripe test purchases only
    </div>
  );
}
