"use client";

import { useState } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { CreditCard, ArrowRight, FileText, RefreshCw, Shield } from "lucide-react";

export default function BillingPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/billing-portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
      } else {
        window.location.href = data.url;
      }
    } catch {
      setError("Connection error. Please try again.");
    }
    setLoading(false);
  };

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-[#FAFAF7]">
        <section className="pt-28 pb-20 lg:pt-36">
          <div className="max-w-lg mx-auto px-4 sm:px-6">

            {/* Header */}
            <div className="text-center mb-10">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#36671E] to-[#295115] flex items-center justify-center mx-auto mb-5 shadow-lg shadow-[#36671E]/15">
                <CreditCard className="w-7 h-7 text-[#FAFAF7]" />
              </div>
              <h1 className="text-3xl font-black text-[#18181B] mb-3">Client Billing</h1>
              <p className="text-[#52525B] text-sm leading-relaxed">
                Manage your subscription, download invoices, and update your payment method.
              </p>
            </div>

            {/* Portal access form */}
            <div className="bg-[#F5F4EF] border border-[#D4D2CC] rounded-2xl p-8">
              <h2 className="text-[#18181B] font-black mb-1">Access your portal</h2>
              <p className="text-[#71717A] text-sm mb-6">Enter the email address you used when you paid your deposit.</p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-[#52525B] uppercase tracking-widest mb-2">Email address</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@yourbusiness.com"
                    className="w-full px-4 py-3 rounded-xl bg-[#F5F4EF] border border-[#D4D2CC] text-[#18181B] placeholder:text-[#A1A1AA] focus:outline-none focus:border-[#36671E]/60 focus:ring-1 focus:ring-[#36671E]/30 text-sm transition-all"
                  />
                </div>

                {error && (
                  <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 rounded-xl bg-gradient-to-r from-[#36671E] to-[#295115] text-[#FAFAF7] font-black text-sm hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <><RefreshCw className="w-4 h-4 animate-spin" /> Opening portal…</>
                  ) : (
                    <>Open my billing portal <ArrowRight className="w-4 h-4" /></>
                  )}
                </button>
              </form>
            </div>

            {/* What you can do */}
            <div className="mt-6 grid grid-cols-3 gap-3">
              {[
                { icon: <FileText className="w-4 h-4" />, label: "Download invoices" },
                { icon: <CreditCard className="w-4 h-4" />, label: "Update payment" },
                { icon: <Shield className="w-4 h-4" />, label: "Manage plan" },
              ].map((item, i) => (
                <div key={i} className="flex flex-col items-center gap-2 p-4 rounded-xl bg-[#FAFAF7] border border-[#E8E6E0] text-center">
                  <div className="text-[#36671E]">{item.icon}</div>
                  <p className="text-xs text-[#71717A] font-medium">{item.label}</p>
                </div>
              ))}
            </div>

            <p className="text-center text-xs text-[#A1A1AA] mt-6">
              Need help?{" "}
              <a href="mailto:hello@servolia.com" className="text-[#36671E] hover:underline">
                hello@servolia.com
              </a>
            </p>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
