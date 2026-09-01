"use client";

import { Download, Smartphone } from "lucide-react";
import { useInstallState } from "@/components/InstallApp";

/**
 * "Install app" as a permanent menu entry in the admin sidebar.
 *
 * The login page already offers this, but you only see that page when signed
 * OUT — so once you are working there was no way back to it. A menu entry is
 * the only version that is still there tomorrow.
 *
 * Renders nothing when the admin is already installed. An "install" item
 * inside the installed app is the kind of detail that makes software feel
 * unmaintained.
 *
 * On iOS there is no install API at all, so the entry links to the page that
 * explains Share → Add to Home Screen rather than offering a dead button.
 */
export default function AdminInstallMenuItem({
  compact = false,
  onNavigate,
}: {
  /** Icon-only, for the collapsed sidebar rail. */
  compact?: boolean;
  /** Lets the mobile drawer close itself after a tap. */
  onNavigate?: () => void;
}) {
  const { platform, install, busy, justInstalled } = useInstallState();

  if (platform === "installed" || justInstalled) return null;

  const canPrompt = platform === "installable";
  const label = canPrompt ? (busy ? "Opening…" : "Install app") : "Add to home screen";
  const Icon = canPrompt ? Download : Smartphone;

  const handle = () => {
    onNavigate?.();
    if (canPrompt) void install();
    // No install API here (iOS, or criteria not yet met) — the install page
    // carries the manual steps.
    else window.location.href = "/install";
  };

  if (compact) {
    return (
      <button
        onClick={handle}
        disabled={busy}
        title={label}
        aria-label={label}
        className="w-10 h-10 rounded-lg flex items-center justify-center text-[#71717A] hover:text-[#36671E] hover:bg-[#F5F4EF] transition-colors disabled:opacity-50"
      >
        <Icon className="w-4 h-4" />
      </button>
    );
  }

  return (
    <button
      onClick={handle}
      disabled={busy}
      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-[#71717A] hover:bg-[#F5F4EF] hover:text-[#36671E] transition-colors disabled:opacity-50"
    >
      <Icon className="w-4 h-4" />
      {label}
    </button>
  );
}
