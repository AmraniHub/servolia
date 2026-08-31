"use client";

import Link from "next/link";
import { Download, Check, Smartphone } from "lucide-react";
import { useInstallState } from "@/components/InstallApp";

/**
 * Install the ADMIN as its own app, from the admin login page.
 *
 * Deliberately compact and quiet: this is a login screen, and the job is to
 * sign in. The button is an affordance for the one person who needs it, not a
 * call to action.
 *
 * It also does the work that makes the install possible at all — mounting
 * useInstallState registers the service worker, and without a registered
 * worker Chrome never fires beforeinstallprompt on these pages. A fresh phone
 * opening /admin/login is the only route into the admin, so this is where it
 * has to happen.
 *
 * The manifest served here is admin.webmanifest (set in the admin layout), so
 * what installs is "Servolia Admin" opening at /admin — a separate icon from
 * the client app, not a shortcut buried inside it.
 */
export default function AdminInstallButton() {
  const { platform, install, busy, justInstalled } = useInstallState();

  if (justInstalled || platform === "installed") {
    return (
      <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#36671E]">
        <Check className="w-3.5 h-3.5" /> Installed on this device
      </p>
    );
  }

  if (platform === "installable") {
    return (
      <button
        type="button"
        onClick={install}
        disabled={busy}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E8E6E0] bg-white text-xs font-bold text-[#3F3F46] hover:border-[#36671E] hover:text-[#36671E] transition-colors disabled:opacity-60"
      >
        <Download className="w-3.5 h-3.5" />
        {busy ? "Opening…" : "Install admin as an app"}
      </button>
    );
  }

  // iOS has no install API — Safari's Share → Add to Home Screen is the only
  // route, so point at the page that explains it rather than show a dead button.
  return (
    <Link
      href="/install"
      className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#A1A1AA] hover:text-[#36671E] transition-colors"
    >
      <Smartphone className="w-3.5 h-3.5" /> Add to your home screen
    </Link>
  );
}
