"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

/**
 * Mobile-only bottom bar that appears after the visitor scrolls past the hero.
 * Keeps the primary conversion action one thumb-tap away on a very long page.
 */
export default function StickyMobileCTA({
  label = "Book a Free Audit",
  sub = "Free · 24h delivery · No call required",
  href = "/free-audit",
}: {
  label?: string;
  sub?: string;
  href?: string;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      const nearBottom =
        window.innerHeight + window.scrollY > document.body.scrollHeight - 400;
      setVisible(window.scrollY > 700 && !nearBottom);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      className={`md:hidden fixed bottom-0 inset-x-0 z-40 px-4 pb-4 pt-2 bg-gradient-to-t from-[#FAFAF7] via-[#FAFAF7]/95 to-transparent transition-all duration-300 ${
        visible ? "translate-y-0 opacity-100" : "translate-y-full opacity-0 pointer-events-none"
      }`}
    >
      <Link
        href={href}
        className="flex items-center justify-between gap-3 w-full px-5 py-3.5 rounded-2xl bg-[#36671E] text-[#FAFAF7] shadow-elevated"
      >
        <span className="flex flex-col">
          <span className="font-black text-sm leading-tight">{label}</span>
          <span className="text-[11px] text-[#ABDF90] leading-tight">{sub}</span>
        </span>
        <ArrowRight className="w-5 h-5 shrink-0" />
      </Link>
    </div>
  );
}
