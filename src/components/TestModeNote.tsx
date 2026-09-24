"use client";

import { useSyncExternalStore } from "react";

/**
 * A small "TEST MODE" pill, shown only in the founder's browser while test
 * mode is on (src/lib/testMode.ts). It reads the non-httpOnly companion
 * cookie `sv_test_ui`, which carries no authority — the purchase itself is
 * decided by the signed httpOnly `sv_test`. Rendered from the root layout, so
 * every thank-you page (onboarding, /fr/demarrage, /hosting/thanks, the
 * portal) says plainly that what was just bought was a test.
 */
const noSubscribe = () => () => {};
const readCookie = () => /(?:^|;\s*)sv_test_ui=1(?:;|$)/.test(document.cookie);
const onServer = () => false;

export default function TestModeNote() {
  // Server (and first hydration pass): off. Then the browser's own cookie.
  const on = useSyncExternalStore(noSubscribe, readCookie, onServer);
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
