"use client";

import { Download, Smartphone } from "lucide-react";
import { useInstallState } from "@/components/InstallApp";

/**
 * "Install" as a permanent control in the portal header.
 *
 * The suggestion banner below the greeting is deliberately dismissible for
 * good — an install nag that keeps returning is hateful. But that left a
 * client who dismissed it once with no way back, and no way to install on a
 * SECOND device later. This is the durable route: quiet, always there, next
 * to the language and theme controls where the other preferences live.
 *
 * Renders nothing once installed, so the app never asks you to install itself.
 *
 * Styled with the portal's CSS variables rather than fixed colours, so it
 * follows the client's light/dark choice like every other control up there.
 */
export default function PortalInstallButton({ lang = "fr" }: { lang?: "en" | "fr" }) {
  const { platform, install, busy, justInstalled } = useInstallState();

  if (platform === "installed" || justInstalled) return null;

  const fr = lang === "fr";
  const canPrompt = platform === "installable";
  const label = canPrompt
    ? fr ? "Installer l’application" : "Install the app"
    : fr ? "Ajouter à l’écran d’accueil" : "Add to home screen";
  const Icon = canPrompt ? Download : Smartphone;

  const handle = () => {
    if (canPrompt) void install();
    // iOS has no install API — the page carries the manual steps instead.
    else window.location.href = fr ? "/fr/application" : "/install";
  };

  return (
    <button
      onClick={handle}
      disabled={busy}
      aria-label={label}
      title={label}
      className="w-9 h-9 rounded-lg border border-[var(--p-border)] flex items-center justify-center text-[var(--p-muted)] hover:text-[var(--p-accent)] hover:bg-[var(--p-raised)] transition-colors disabled:opacity-50"
    >
      <Icon className="w-4 h-4" />
    </button>
  );
}
