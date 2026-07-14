"use client";

import { useEffect, useState } from "react";
import { X, Mail, ArrowRight, Download } from "lucide-react";

const KEY = "servolia-exit-popup-shown";

export default function ExitIntentPopup() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem(KEY)) return;

    let triggered = false;

    const onMouseLeave = (e: MouseEvent) => {
      if (triggered) return;
      if (e.clientY <= 8) {
        triggered = true;
        setOpen(true);
        localStorage.setItem(KEY, "1");
      }
    };

    // Fallback for mobile: trigger after 45 sec on page
    const mobileTimer = setTimeout(() => {
      if (triggered) return;
      if (window.innerWidth < 768) {
        triggered = true;
        setOpen(true);
        localStorage.setItem(KEY, "1");
      }
    }, 45000);

    document.addEventListener("mouseleave", onMouseLeave);
    return () => {
      document.removeEventListener("mouseleave", onMouseLeave);
      clearTimeout(mobileTimer);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("loading");
    try {
      const response = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, source: "exit-popup", language: "en", consent: true }),
      });
      if (!response.ok) throw new Error("Subscription failed");
      setStatus("done");
    } catch {
      setStatus("error");
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#18181B]/40 backdrop-blur-sm p-4 animate-fade-in-up"
         onClick={() => setOpen(false)}>
      <div className="bg-[#FAFAF7] rounded-2xl max-w-md w-full p-6 sm:p-8 shadow-elevated relative"
           onClick={(e) => e.stopPropagation()}>
        <button onClick={() => setOpen(false)}
          className="absolute top-3 right-3 p-2 rounded-lg hover:bg-[#F0EFEA] transition-colors"
          aria-label="Close">
          <X className="w-4 h-4 text-[#71717A]" />
        </button>

        {status !== "done" ? (
          <>
            <div className="w-12 h-12 rounded-xl bg-[#36671E] flex items-center justify-center mb-4">
              <Download className="w-6 h-6 text-[#FAFAF7]" />
            </div>
            <h2 className="text-xl font-black text-[#18181B] mb-2 leading-tight">
              Before you go — grab the free playbook
            </h2>
            <p className="text-sm text-[#52525B] leading-relaxed mb-5">
              <strong>&ldquo;The AI Client Acquisition Playbook&rdquo;</strong> — 14 pages on how dental clinics, aesthetic practices and real-estate agents are using AI in 2026 to double bookings. Free, no spam.
            </p>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A1A1AA]" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@business.com"
                  className="w-full pl-9 pr-3 py-3 rounded-xl bg-white border border-[#E8E6E0] text-sm text-[#18181B] focus:outline-none focus:border-[#36671E]"
                />
              </div>
              <button type="submit" disabled={status === "loading" || !email}
                className="w-full py-3 rounded-xl bg-[#36671E] text-[#FAFAF7] font-bold text-sm hover:bg-[#295115] transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                {status === "loading" ? "Sending…" : <>Send me the playbook <ArrowRight className="w-4 h-4" /></>}
              </button>
            </form>
            <p className="text-[11px] text-[#A1A1AA] mt-3 text-center">
              {status === "error" ? "We couldn’t save your email. Please try again." : "We never share your email. Unsubscribe anytime."}
            </p>
          </>
        ) : (
          <div className="text-center py-4">
            <div className="w-14 h-14 rounded-full bg-[#EEF5EA] flex items-center justify-center mx-auto mb-4">
              <Download className="w-7 h-7 text-[#36671E]" />
            </div>
            <h2 className="text-xl font-black text-[#18181B] mb-2">Sent.</h2>
            <p className="text-sm text-[#52525B] mb-5">
              Check your inbox in the next minute. If you don&apos;t see it, check spam.
            </p>
            <button onClick={() => setOpen(false)}
              className="px-5 py-2 rounded-lg bg-[#FAFAF7] border border-[#E8E6E0] text-sm font-semibold text-[#18181B] hover:bg-white">
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
