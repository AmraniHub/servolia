"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Smartphone, X, Download } from "lucide-react";
import { useInstallState } from "@/components/InstallApp";

/**
 * The "add this to your phone" nudge, shown inside the client portal.
 *
 * The portal is the only place this belongs. Someone reading the pricing page
 * has not bought anything and does not want an app; a client checking whether
 * a patient enquiry came in is exactly who benefits from a home-screen icon
 * and a full-screen view without browser chrome.
 *
 * RULES IT FOLLOWS, because an install nag is the easiest thing to make
 * hateful:
 *   - never shown to someone already inside the installed app
 *   - dismissal is remembered permanently, not per session
 *   - it waits until the second visit, so it is never the first thing a new
 *     client sees on a portal they just logged into for the first time
 *   - one line, inline, no modal and no overlay
 *
 * localStorage is wrapped: it throws outright in some privacy modes, and a
 * crashed portal would be a very expensive way to offer an app icon.
 */

const DISMISS_KEY = "servolia.install.dismissed";
const VISITS_KEY = "servolia.portal.visits";
const SHOW_FROM_VISIT = 2;

function readStore(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
function writeStore(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* private mode — the nudge simply reappears next time */
  }
}

const COPY = {
  en: {
    title: "Add Servolia to your phone",
    body: "One tap to your enquiries, without opening a browser.",
    cta: "Install",
    how: "How?",
    dismiss: "Dismiss",
  },
  fr: {
    title: "Ajoutez Servolia à votre téléphone",
    body: "Vos demandes en un geste, sans ouvrir de navigateur.",
    cta: "Installer",
    how: "Comment ?",
    dismiss: "Masquer",
  },
};

export default function InstallSuggestion({ lang = "fr" }: { lang?: "en" | "fr" }) {
  const t = COPY[lang === "fr" ? "fr" : "en"];
  const { platform, install, busy } = useInstallState();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (readStore(DISMISS_KEY)) return;

    // Count visits before offering. A brand-new client should see their
    // enquiries first, not a request to install something.
    const visits = Number(readStore(VISITS_KEY) ?? "0") + 1;
    writeStore(VISITS_KEY, String(visits));
    if (visits >= SHOW_FROM_VISIT) setShow(true);
  }, []);

  // "installed" means they are reading this inside the app already.
  if (!show || platform === "installed") return null;

  const dismiss = () => {
    writeStore(DISMISS_KEY, "1");
    setShow(false);
  };

  return (
    <div className="flex items-start gap-3 rounded-xl border border-[#D6E2CF] bg-[#EEF5EA] px-4 py-3 mb-5">
      <Smartphone className="w-4 h-4 text-[#36671E] mt-0.5 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-black text-[#18181B]">{t.title}</p>
        <p className="text-xs text-[#3F3F46] mt-0.5">{t.body}</p>
        <div className="flex items-center gap-3 mt-2">
          {platform === "installable" ? (
            <button
              type="button"
              onClick={install}
              disabled={busy}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#36671E] text-[#FAFAF7] text-xs font-bold hover:bg-[#295115] transition-colors disabled:opacity-60"
            >
              <Download className="w-3.5 h-3.5" /> {t.cta}
            </button>
          ) : (
            // No install API on this platform (iOS, or criteria not met yet) —
            // send them to the page that explains the manual route instead of
            // showing a button that would do nothing.
            <Link
              href={lang === "fr" ? "/fr/application" : "/install"}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#36671E] text-[#FAFAF7] text-xs font-bold hover:bg-[#295115] transition-colors"
            >
              <Download className="w-3.5 h-3.5" /> {t.how}
            </Link>
          )}
          <button
            type="button"
            onClick={dismiss}
            className="text-xs font-semibold text-[#71717A] hover:text-[#18181B] transition-colors"
          >
            {t.dismiss}
          </button>
        </div>
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label={t.dismiss}
        className="text-[#A1A1AA] hover:text-[#18181B] transition-colors shrink-0"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
