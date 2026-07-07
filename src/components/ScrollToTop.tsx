"use client";

import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";

export default function ScrollToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 400);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!visible) return null;

  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label="Scroll to top"
      className="fixed bottom-6 left-6 z-50 w-10 h-10 rounded-full bg-[#36671E] text-[#FAFAF7] flex items-center justify-center shadow-elevated hover:bg-[#295115] hover:scale-110 transition-all duration-200"
    >
      <ArrowUp className="w-4 h-4" />
    </button>
  );
}
