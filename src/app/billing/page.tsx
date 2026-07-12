"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { CreditCard, ArrowRight, FileText, RefreshCw, Shield, CheckCircle2 } from "lucide-react";

/**
 * Billing entry point. The actual portal opens through the logged-in session
 * (/api/billing-portal reads the email from the session cookie) — visitors who
 * aren't logged in are sent through the magic-link login first.
 */
function BillingContent() {
  const params = useSearchParams();
  const subscribed = params.get("subscribed") === "1";

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Auto-open shortly after a fresh subscription checkout for a smooth flow.
  useEffect(() => {
    if (subscribed) openPortal();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function openPortal() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/billing-portal", { method: "POST" });
      const data = await res.json();
      if (res.status === 401) {
        window.location.href = "/portal/login";
        return;
      }
      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
      } else {
        window.location.href = data.url;
      }
    } catch {
      setError("Connection error. Please try again.");
    }
    setLoading(false);
  }

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-[#FAFAF7]">
        <section className="pt-28 pb-20 lg:pt-36">
          <div className="max-w-lg mx-auto px-4 sm:px-6">
            <div className="text-center mb-10">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#36671E] to-[#295115] flex items-center justify-center mx-auto mb-5 shadow-lg shadow-[#36671E]/15">
                <CreditCard className="w-7 h-7 text-[#FAFAF7]" />
              </div>
              <h1 className="text-3xl font-black text-[#18181B] mb-3">Client Billing</h1>
              <p className="text-[#52525B] text-sm leading-relaxed">
                Manage your subscription, download invoices, and update your payment method.
              </p>
            </div>

            {subscribed && (
              <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-[#EEF5EA] border border-[#36671E]/20 text-[#36671E] text-sm font-semibold mb-6">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> Subscription active — welcome aboard!
              </div>
            )}

            <div className="bg-[#F5F4EF] border border-[#D4D2CC] rounded-2xl p-8 text-center">
              <h2 className="text-[#18181B] font-black mb-1">Open your billing portal</h2>
              <p className="text-[#71717A] text-sm mb-6">
                You&apos;ll sign in with your email first — no password needed. Then manage everything securely via Stripe.
              </p>

              {error && (
                <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm mb-4 text-left">
                  {error}
                </div>
              )}

              <button
                onClick={openPortal}
                disabled={loading}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-[#36671E] to-[#295115] text-[#FAFAF7] font-black text-sm hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? (<><RefreshCw className="w-4 h-4 animate-spin" /> Opening…</>) : (<>Manage my subscription <ArrowRight className="w-4 h-4" /></>)}
              </button>
            </div>

            <div className="mt-6 grid grid-cols-3 gap-3">
              {[
                { icon: <RefreshCw className="w-4 h-4" />, label: "Change or cancel plan" },
                { icon: <FileText className="w-4 h-4" />, label: "Download invoices" },
                { icon: <Shield className="w-4 h-4" />, label: "Secured by Stripe" },
              ].map((item, i) => (
                <div key={i} className="flex flex-col items-center gap-2 p-4 rounded-xl bg-white border border-[#E8E6E0] text-center">
                  <div className="text-[#36671E]">{item.icon}</div>
                  <p className="text-xs text-[#71717A] font-medium">{item.label}</p>
                </div>
              ))}
            </div>

            <p className="text-center text-xs text-[#A1A1AA] mt-6">
              Questions about billing?{" "}
              <a href="mailto:hello@servolia.com" className="text-[#36671E] hover:underline">hello@servolia.com</a>
            </p>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}

export default function BillingPage() {
  return (
    <Suspense fallback={null}>
      <BillingContent />
    </Suspense>
  );
}
