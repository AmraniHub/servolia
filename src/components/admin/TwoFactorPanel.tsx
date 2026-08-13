"use client";

import { useEffect, useState } from "react";
import { ShieldCheck, ShieldAlert, Copy, Check, Smartphone, KeyRound, Loader2 } from "lucide-react";

/**
 * Two-factor enrolment, in the dashboard instead of in Vercel.
 *
 * Two phases on purpose: `setup` parks a PENDING secret and enforces nothing,
 * `confirm` needs a live code from the app before 2FA actually switches on. So
 * a key typed in wrong is caught here, while you are still logged in — not at
 * the next login, from a phone, with no way back in.
 *
 * No QR library: authenticator apps all take a manually-typed key, and on a
 * phone the otpauth link opens the app directly. Not worth a dependency.
 */

type Status = {
  enabled: boolean;
  source: "db" | "none";
  confirmedAt: string | null;
  recoveryRemaining: number;
  pending: boolean;
  /** ADMIN_TOTP_SECRET still sitting in the environment, though nothing reads it. */
  legacyEnvVar: boolean;
  storageMissing: boolean;
  storageIssue: "no-supabase" | "no-table" | null;
  storageError: string | null;
};

export default function TwoFactorPanel() {
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [enrol, setEnrol] = useState<{ secret: string; otpauth: string } | null>(null);
  const [confirmCode, setConfirmCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [manageCode, setManageCode] = useState("");
  const [mode, setMode] = useState<"idle" | "disable" | "regenerate">("idle");
  const [copied, setCopied] = useState("");

  async function load() {
    try {
      const res = await fetch("/api/admin/2fa");
      const data = await res.json();
      if (res.ok) setStatus(data);
      else setError(data.error ?? "Could not read 2FA status");
    } catch {
      setError("Could not read 2FA status");
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function call(action: string, code?: string) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/admin/2fa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, code }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed");
        return null;
      }
      return data;
    } catch {
      setError("Connection error");
      return null;
    } finally {
      setBusy(false);
    }
  }

  function copy(text: string, label: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(label);
      setTimeout(() => setCopied(""), 1800);
    });
  }

  const grouped = enrol ? enrol.secret.replace(/(.{4})/g, "$1 ").trim() : "";

  // ── The one moment the recovery codes exist in plaintext ──────────────────
  if (recoveryCodes) {
    return (
      <Card tone="good" title="Two-factor is ON — save these recovery codes" icon={<ShieldCheck className="w-5 h-5 text-[#36671E]" />}>
        <p className="text-sm text-[#3F3F46] mb-3">
          <strong>If you lose the phone, these are the only way back in.</strong> Each works once. Keep them where you
          keep passwords — not in this dashboard. They are shown now and never again.
        </p>
        <div className="grid grid-cols-2 gap-x-6 gap-y-1 font-mono text-sm font-bold text-[#18181B] bg-[#FAFAF7] border border-[#E8E6E0] rounded-xl p-4 mb-3 select-all">
          {recoveryCodes.map((c) => (
            <span key={c}>{c}</span>
          ))}
        </div>
        <div className="flex gap-2">
          <SmallButton onClick={() => copy(recoveryCodes.join("\n"), "rec")}>
            {copied === "rec" ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            Copy all eight
          </SmallButton>
          <SmallButton
            primary
            onClick={() => {
              setRecoveryCodes(null);
              setEnrol(null);
              setConfirmCode("");
              setManageCode("");
              setMode("idle");
              load();
            }}
          >
            I&apos;ve saved them
          </SmallButton>
        </div>
      </Card>
    );
  }

  // ── Enrolment in progress ────────────────────────────────────────────────
  if (enrol) {
    return (
      <Card tone="neutral" title="Turn on two-factor" icon={<Smartphone className="w-5 h-5 text-[#36671E]" />}>
        <p className="text-sm text-[#3F3F46] mb-2">
          <strong>Step 1.</strong> In your authenticator app choose <em>Add account → Enter key manually</em> and type
          this key — or open the link below on the phone that has the app.
        </p>
        <div className="font-mono text-base font-extrabold tracking-wider bg-[#FAFAF7] border border-[#E8E6E0] rounded-xl px-4 py-3 my-3 select-all break-all text-[#18181B]">
          {grouped}
        </div>
        <div className="flex flex-wrap gap-2 mb-4">
          <SmallButton onClick={() => copy(enrol.secret, "key")}>
            {copied === "key" ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            Copy key
          </SmallButton>
          <a
            href={enrol.otpauth}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E8E6E0] bg-white text-xs font-bold text-[#3F3F46] hover:border-[#36671E] transition-colors"
          >
            <Smartphone className="w-3.5 h-3.5" /> Open in authenticator
          </a>
        </div>

        <p className="text-sm text-[#3F3F46] mb-2">
          <strong>Step 2.</strong> Enter the 6-digit code the app now shows, to prove the key landed. Nothing is enforced
          until it matches.
        </p>
        <div className="flex flex-wrap gap-2 items-center">
          <input
            value={confirmCode}
            onChange={(e) => setConfirmCode(e.target.value.replace(/\D/g, ""))}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="123456"
            className="w-32 px-3 py-2 rounded-lg bg-[#FAFAF7] border border-[#E8E6E0] font-mono tracking-[0.2em] text-sm text-[#18181B] focus:outline-none focus:border-[#36671E]"
          />
          <SmallButton
            primary
            disabled={busy || confirmCode.length < 6}
            onClick={async () => {
              const data = await call("confirm", confirmCode);
              if (data?.recoveryCodes) setRecoveryCodes(data.recoveryCodes);
            }}
          >
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null} Verify and turn on
          </SmallButton>
          <SmallButton
            disabled={busy}
            onClick={async () => {
              await call("cancel");
              setEnrol(null);
              setConfirmCode("");
              load();
            }}
          >
            Cancel
          </SmallButton>
        </div>
        {error && <ErrorLine>{error}</ErrorLine>}
      </Card>
    );
  }

  if (!status) {
    return (
      <Card tone="neutral" title="Two-factor" icon={<ShieldCheck className="w-5 h-5 text-[#A1A1AA]" />}>
        <p className="text-sm text-[#71717A]">Checking…</p>
      </Card>
    );
  }

  // ── ON ───────────────────────────────────────────────────────────────────
  if (status.enabled) {
    return (
      <Card tone="good" title="Two-factor is on" icon={<ShieldCheck className="w-5 h-5 text-[#36671E]" />}>
        <p className="text-sm text-[#3F3F46] mb-3">
          Sign-in asks for your password, then a 6-digit code. A code that has already been used is refused even inside
          its own 30-second window. <strong>{status.recoveryRemaining}</strong> recovery code
          {status.recoveryRemaining === 1 ? "" : "s"} left.
        </p>

        {status.legacyEnvVar && <LegacyEnvVarNag twoFactorOn />}

        {mode === "idle" ? (
          <div className="flex flex-wrap gap-2">
            <SmallButton onClick={() => setMode("regenerate")}>
              <KeyRound className="w-3.5 h-3.5" /> New recovery codes
            </SmallButton>
            <SmallButton onClick={() => setMode("disable")}>Turn off</SmallButton>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2 items-center">
            <input
              value={manageCode}
              onChange={(e) => setManageCode(e.target.value.toUpperCase())}
              placeholder="Code or recovery code"
              className="w-52 px-3 py-2 rounded-lg bg-[#FAFAF7] border border-[#E8E6E0] font-mono text-sm text-[#18181B] focus:outline-none focus:border-[#36671E]"
            />
            <SmallButton
              primary
              disabled={busy || !manageCode.trim()}
              onClick={async () => {
                const data = await call(mode, manageCode.trim());
                if (!data) return;
                setManageCode("");
                setMode("idle");
                if (data.recoveryCodes) setRecoveryCodes(data.recoveryCodes);
                else load();
              }}
            >
              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
              {mode === "disable" ? "Confirm turn off" : "Generate"}
            </SmallButton>
            <SmallButton
              onClick={() => {
                setMode("idle");
                setManageCode("");
                setError("");
              }}
            >
              Cancel
            </SmallButton>
          </div>
        )}
        {error && <ErrorLine>{error}</ErrorLine>}
      </Card>
    );
  }

  // ── OFF ──────────────────────────────────────────────────────────────────
  return (
    <Card tone="warn" title="Two-factor is off" icon={<ShieldAlert className="w-5 h-5 text-[#B45309]" />}>
      <p className="text-sm text-[#3F3F46] mb-3">
        Your password is the only thing between the internet and this dashboard — every lead, every client, every
        message. Turning it on takes two minutes and a free authenticator app.
      </p>
      {/* Worth flagging hardest HERE: a leftover secret can read as protection
          that no longer exists. 2FA is genuinely off despite the env var. */}
      {status.legacyEnvVar && <LegacyEnvVarNag twoFactorOn={false} />}
      {status.storageMissing && <MigrationHint issue={status.storageIssue} error={status.storageError} />}
      <SmallButton
        primary
        disabled={busy || status.storageMissing}
        onClick={async () => {
          const data = await call("setup");
          if (data?.secret) setEnrol({ secret: data.secret, otpauth: data.otpauth });
        }}
      >
        {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null} Turn on two-factor
      </SmallButton>
      {error && <ErrorLine>{error}</ErrorLine>}
    </Card>
  );
}

/**
 * ADMIN_TOTP_SECRET is retired — no code path reads it any more. But a stale
 * secret left in Vercel invites someone to "restore" it during a future
 * outage, quietly reinstating a second key with no replay guard and no
 * recovery codes. So the panel keeps asking until it is actually gone.
 */
function LegacyEnvVarNag({ twoFactorOn }: { twoFactorOn: boolean }) {
  return (
    <div className="text-xs text-[#B45309] bg-[#FEF3C7] border border-[#D97706]/30 rounded-lg px-3 py-2.5 mb-3">
      <p>
        <strong>ADMIN_TOTP_SECRET is still set in this environment.</strong>{" "}
        {twoFactorOn
          ? "Nothing reads it any more — your 2FA runs entirely from the database."
          : "Nothing reads it any more, so it is NOT protecting this login — two-factor really is off."}{" "}
        Delete it in Vercel (Settings → Environment Variables) and redeploy, so a stale second key can&apos;t be
        revived later. This notice disappears once it&apos;s gone.
      </p>
    </div>
  );
}

/**
 * Shown wherever enrolment is blocked. The two causes need opposite advice:
 * running SQL fixes nothing when there are no Supabase credentials at all, and
 * adding credentials fixes nothing when the table is genuinely absent.
 */
function MigrationHint({ issue, error }: { issue: Status["storageIssue"]; error: string | null }) {
  return (
    <div className="text-xs text-[#B45309] mb-3">
      {issue === "no-supabase" ? (
        <p>
          Supabase isn&apos;t connected in this environment, so there&apos;s nowhere to store the secret. On localhost
          that&apos;s expected — enrol on the deployed site instead. In production, set{" "}
          <code className="font-mono">NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
          <code className="font-mono">SUPABASE_SERVICE_ROLE_KEY</code> in Vercel.
        </p>
      ) : (
        <p>
          Supabase is connected, but the <code className="font-mono">admin_2fa</code> table isn&apos;t there. Run section
          8 of <code className="font-mono">supabase/pending-migration.sql</code>, then{" "}
          <code className="font-mono">notify pgrst, &apos;reload schema&apos;;</code> if it still doesn&apos;t appear.
        </p>
      )}
      {error && <p className="mt-1 font-mono text-[10px] text-[#A1A1AA] break-all">{error}</p>}
    </div>
  );
}

function Card({
  tone,
  title,
  icon,
  children,
}: {
  tone: "good" | "warn" | "neutral";
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  const border =
    tone === "good" ? "border-[#36671E]/25 bg-[#F0F7EC]" : tone === "warn" ? "border-[#B45309]/25 bg-[#FEF3C7]" : "border-[#E8E6E0] bg-white";
  return (
    <div className={`rounded-xl border p-5 ${border}`}>
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <h3 className="text-sm font-black text-[#18181B]">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function SmallButton({
  children,
  onClick,
  disabled,
  primary,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors disabled:opacity-50 ${
        primary
          ? "bg-[#36671E] text-[#FAFAF7] hover:bg-[#295115]"
          : "border border-[#E8E6E0] bg-white text-[#3F3F46] hover:border-[#36671E]"
      }`}
    >
      {children}
    </button>
  );
}

function ErrorLine({ children }: { children: React.ReactNode }) {
  return <p className="mt-3 text-xs font-semibold text-[#DC2626]">{children}</p>;
}
