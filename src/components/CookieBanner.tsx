"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem("servolia-cookie-consent")) setVisible(true);
    } catch {}
  }, []);

  const accept = () => {
    try { localStorage.setItem("servolia-cookie-consent", "accepted"); } catch {}
    setVisible(false);
  };

  const decline = () => {
    try { localStorage.setItem("servolia-cookie-consent", "declined"); } catch {}
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[100] bg-[#FAFAF7]/95 backdrop-blur-md border-t border-[#D4D2CC] px-4 py-4 shadow-2xl">
      <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center gap-4 justify-between">
        <p className="text-sm text-[#52525B] text-center sm:text-left max-w-2xl">
          We use essential cookies for analytics and to improve your experience.{" "}
          <Link href="/legal/privacy" className="underline hover:text-[#18181B] transition-colors">
            Privacy policy
          </Link>
          .
        </p>
        <div className="flex gap-3 shrink-0">
          <button
            onClick={decline}
            className="px-4 py-2 rounded-lg border border-[#D4D2CC] text-[#52525B] text-sm font-medium hover:text-[#18181B] hover:border-white/30 transition-all"
          >
            Decline
          </button>
          <button
            onClick={accept}
            className="px-5 py-2 rounded-lg bg-gradient-to-r from-[#36671E] to-[#295115] text-[#FAFAF7] text-sm font-bold hover:opacity-90 transition-opacity"
          >
            Accept cookies
          </button>
        </div>
      </div>
    </div>
  );
}
