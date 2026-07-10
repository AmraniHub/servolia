"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, ArrowRight } from "lucide-react";

export default function AdminLogin() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Invalid password");
        setLoading(false);
        return;
      }
      router.push("/admin");
      router.refresh();
    } catch {
      setError("Connection error");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-[#FAFAF7]">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center mb-8">
          <span className="text-xl font-black tracking-tight text-[#18181B]">
            Servolia <span className="text-[#36671E]">CRM</span>
          </span>
        </div>

        <div className="bg-white border border-[#E8E6E0] rounded-2xl p-8 shadow-card">
          <div className="flex items-center gap-2 mb-1">
            <Lock className="w-4 h-4 text-[#36671E]" />
            <h1 className="text-lg font-black text-[#18181B]">Admin sign-in</h1>
          </div>
          <p className="text-sm text-[#71717A] mb-6">Restricted area. Authorized personnel only.</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-[#52525B] uppercase tracking-widest mb-2">
                Password
              </label>
              <input
                type="password"
                required
                autoFocus
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-3 rounded-xl bg-[#FAFAF7] border border-[#E8E6E0] text-[#18181B] focus:outline-none focus:border-[#36671E] focus:ring-2 focus:ring-[#36671E]/10 text-sm transition-all"
              />
            </div>

            {error && (
              <div className="px-4 py-3 rounded-xl bg-[#FEE2E2] border border-[#DC2626]/20 text-[#DC2626] text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !password}
              className="w-full py-3 rounded-xl bg-[#36671E] text-[#FAFAF7] font-semibold text-sm hover:bg-[#295115] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? "Signing in…" : <>Sign in <ArrowRight className="w-4 h-4" /></>}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-[#A1A1AA] mt-6">
          Forgot password? Reset it via your Vercel environment variables (ADMIN_PASSWORD).
        </p>
      </div>
    </div>
  );
}
