"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Mail, ArrowRight, RefreshCw, CheckCircle2, MessageSquare, FileText, Clock } from "lucide-react";

function LoginForm() {
  const params = useSearchParams();
  const urlError = params.get("error");

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(
    urlError === "expired" ? "That login link expired — request a new one below." :
    urlError === "missing" ? "That login link was invalid — request a new one below." : ""
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/portal/request-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Something went wrong. Please try again.");
      } else {
        setSent(true);
      }
    } catch {
      setError("Connection error. Please try again.");
    }
    setLoading(false);
  };

  return (
    <main className="min-h-screen bg-[#FAFAF7]">
      <Navbar />
      <section className="pt-28 pb-20 lg:pt-36">
        <div className="max-w-lg mx-auto px-4 sm:px-6">
          <div className="text-center mb-10">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#36671E] to-[#295115] flex items-center justify-center mx-auto mb-5 shadow-lg shadow-[#36671E]/15">
              <MessageSquare className="w-7 h-7 text-[#FAFAF7]" />
            </div>
            <h1 className="text-3xl font-black text-[#18181B] mb-3">Your Servolia account</h1>
            <p className="text-[#52525B] text-sm leading-relaxed">
              Track your project and message us directly — no password needed.
            </p>
          </div>

          <div className="bg-[#F5F4EF] border border-[#D4D2CC] rounded-2xl p-8">
            {sent ? (
              <div className="text-center py-4">
                <CheckCircle2 className="w-10 h-10 text-[#36671E] mx-auto mb-4" />
                <h2 className="text-[#18181B] font-black mb-2">Check your email</h2>
                <p className="text-[#71717A] text-sm leading-relaxed">
                  We sent a login link to <strong className="text-[#18181B]">{email}</strong>. Click it to open your account — it expires in 15 minutes.
                </p>
              </div>
            ) : (
              <>
                <h2 className="text-[#18181B] font-black mb-1">Log in</h2>
                <p className="text-[#71717A] text-sm mb-6">Enter your email and we&apos;ll send you a one-click login link.</p>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-[#52525B] uppercase tracking-widest mb-2">Email address</label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-[#A1A1AA] absolute left-4 top-1/2 -translate-y-1/2" />
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@yourbusiness.com"
                        className="w-full pl-11 pr-4 py-3 rounded-xl bg-white border border-[#D4D2CC] text-[#18181B] placeholder:text-[#A1A1AA] focus:outline-none focus:border-[#36671E]/60 focus:ring-1 focus:ring-[#36671E]/30 text-sm transition-all"
                      />
                    </div>
                  </div>

                  {error && (
                    <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm">
                      {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3.5 rounded-xl bg-gradient-to-r from-[#36671E] to-[#295115] text-[#FAFAF7] font-black text-sm hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {loading ? (<><RefreshCw className="w-4 h-4 animate-spin" /> Sending…</>) : (<>Send me a login link <ArrowRight className="w-4 h-4" /></>)}
                  </button>
                </form>
              </>
            )}
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3">
            {[
              { icon: <FileText className="w-4 h-4" />, label: "Track your project" },
              { icon: <Clock className="w-4 h-4" />, label: "Message us directly" },
            ].map((item, i) => (
              <div key={i} className="flex flex-col items-center gap-2 p-4 rounded-xl bg-white border border-[#E8E6E0] text-center">
                <div className="text-[#36671E]">{item.icon}</div>
                <p className="text-xs text-[#71717A] font-medium">{item.label}</p>
              </div>
            ))}
          </div>

          <p className="text-center text-xs text-[#A1A1AA] mt-6">
            Need help right now?{" "}
            <a href="mailto:hello@servolia.com" className="text-[#36671E] hover:underline">hello@servolia.com</a>
          </p>
        </div>
      </section>
      <Footer />
    </main>
  );
}

export default function PortalLoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
