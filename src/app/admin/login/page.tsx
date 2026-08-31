"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, ArrowRight, ShieldCheck, KeyRound } from "lucide-react";
import AdminInstallButton from "@/components/admin/AdminInstallButton";

/**
 * Two-screen sign-in: password, then — only if 2FA is on — the code.
 *
 * The code field used to sit under the password permanently, labelled
 * "(if enabled)", which asked for something usually unnecessary and gave no
 * signal about which factor failed. Now the second screen only appears when the
 * server says it is needed, and it accepts a recovery code in the same box.
 */
export default function AdminLogin() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [ticket, setTicket] = useState<string | null>(null);
  const [useRecovery, setUseRecovery] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function post(body: Record<string, unknown>) {
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return { res, data: await res.json().catch(() => ({})) };
  }

  const submitPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const { res, data } = await post({ password });
      if (!res.ok) {
        setError(data.error ?? "Invalid password");
        setLoading(false);
        return;
      }
      if (data.totpRequired) {
        setTicket(data.ticket);
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

  const submitCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const { res, data } = await post({ ticket, code: code.trim() });
      if (!res.ok) {
        setError(data.error ?? "Invalid code");
        setCode("");
        setLoading(false);
        // Ticket expired → back to the password screen rather than a dead form.
        if (res.status === 401 && /start again/i.test(data.error ?? "")) {
          setTicket(null);
          setPassword("");
        }
        return;
      }
      router.push("/admin");
      router.refresh();
    } catch {
      setError("Connection error");
      setLoading(false);
    }
  };

  const errorBox = error && (
    <div className="px-4 py-3 rounded-xl bg-[#FEE2E2] border border-[#DC2626]/20 text-[#DC2626] text-sm">
      {error}
    </div>
  );

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-[#FAFAF7]">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center mb-8">
          <span className="text-xl font-black tracking-tight text-[#18181B]">
            Servolia <span className="text-[#36671E]">CRM</span>
          </span>
        </div>

        <div className="bg-white border border-[#E8E6E0] rounded-2xl p-8 shadow-card">
          {!ticket ? (
            <>
              <div className="flex items-center gap-2 mb-1">
                <Lock className="w-4 h-4 text-[#36671E]" />
                <h1 className="text-lg font-black text-[#18181B]">Admin sign-in</h1>
              </div>
              <p className="text-sm text-[#71717A] mb-6">Restricted area. Authorized personnel only.</p>

              <form onSubmit={submitPassword} className="space-y-4">
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

                {errorBox}

                <button
                  type="submit"
                  disabled={loading || !password}
                  className="w-full py-3 rounded-xl bg-[#36671E] text-[#FAFAF7] font-semibold text-sm hover:bg-[#295115] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? "Checking…" : <>Continue <ArrowRight className="w-4 h-4" /></>}
                </button>
              </form>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 mb-1">
                <ShieldCheck className="w-4 h-4 text-[#36671E]" />
                <h1 className="text-lg font-black text-[#18181B]">Two-factor</h1>
              </div>
              <p className="text-sm text-[#71717A] mb-6">
                {useRecovery
                  ? "Enter one of your recovery codes. Each works once."
                  : "Enter the 6-digit code from your authenticator app."}
              </p>

              <form onSubmit={submitCode} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-[#52525B] uppercase tracking-widest mb-2">
                    {useRecovery ? "Recovery code" : "Authenticator code"}
                  </label>
                  <input
                    type="text"
                    required
                    autoFocus
                    key={useRecovery ? "recovery" : "totp"}
                    inputMode={useRecovery ? "text" : "numeric"}
                    autoComplete="one-time-code"
                    maxLength={useRecovery ? 11 : 6}
                    value={code}
                    onChange={(e) =>
                      setCode(useRecovery ? e.target.value.toUpperCase() : e.target.value.replace(/\D/g, ""))
                    }
                    placeholder={useRecovery ? "XXXXX-XXXXX" : "123456"}
                    className="w-full px-4 py-3 rounded-xl bg-[#FAFAF7] border border-[#E8E6E0] text-[#18181B] tracking-[0.3em] font-mono focus:outline-none focus:border-[#36671E] focus:ring-2 focus:ring-[#36671E]/10 text-sm transition-all"
                  />
                </div>

                {errorBox}

                <button
                  type="submit"
                  disabled={loading || code.length < (useRecovery ? 10 : 6)}
                  className="w-full py-3 rounded-xl bg-[#36671E] text-[#FAFAF7] font-semibold text-sm hover:bg-[#295115] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? "Verifying…" : <>Sign in <ArrowRight className="w-4 h-4" /></>}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setUseRecovery((v) => !v);
                    setCode("");
                    setError("");
                  }}
                  className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold text-[#71717A] hover:text-[#36671E] transition-colors"
                >
                  <KeyRound className="w-3 h-3" />
                  {useRecovery ? "Use my authenticator instead" : "Lost your phone? Use a recovery code"}
                </button>
              </form>
            </>
          )}
        </div>

        {/* Install lives on the LOGIN page because it is the only admin page a
            fresh device can reach. It also registers the service worker, which
            Chrome requires before it will offer the install at all. Installing
            gets you the app shell; you still sign in with password + 2FA. */}
        <div className="mt-6 flex justify-center">
          <AdminInstallButton />
        </div>

        <p className="text-center text-xs text-[#A1A1AA] mt-4">
          Forgot password? Reset it via your Vercel environment variables (ADMIN_PASSWORD).
        </p>
      </div>
    </div>
  );
}
