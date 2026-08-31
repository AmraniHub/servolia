"use client";

import { useEffect, useState, useCallback } from "react";
import { Download, Share, PlusSquare, Check, MoreVertical } from "lucide-react";

/**
 * Install-as-app, told honestly per platform.
 *
 * Three facts shape this component:
 *
 *  1. Chrome/Edge/Android fire `beforeinstallprompt`, which can only be
 *     replayed from a real user gesture — so the event is captured and the
 *     button calls prompt() on click. There is no way to trigger it on load.
 *  2. iOS Safari NEVER fires it. Apple has no install API at all; the only
 *     route is Share → Add to Home Screen. Showing an install BUTTON on iOS
 *     would be a button that cannot work, so iOS gets instructions instead.
 *  3. Once installed, the page runs in display-mode: standalone. Nagging
 *     someone to install an app they are already inside is the fastest way
 *     to look broken, so that case renders nothing.
 *
 * Registering the service worker lives here too, because without one Chrome
 * never fires the event and the button would never appear.
 */

type Platform = "installable" | "ios" | "installed" | "other";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const COPY = {
  en: {
    installed: "Servolia is installed on this device.",
    button: "Install the app",
    installing: "Opening…",
    iosTitle: "Add Servolia to your Home Screen",
    iosSteps: ["Tap the Share button in Safari", "Choose “Add to Home Screen”", "Tap “Add” — done"],
    otherTitle: "Install from your browser menu",
    otherSteps: ["Open your browser menu", "Choose “Install app” or “Add to Home Screen”"],
    done: "Installed — check your home screen",
  },
  fr: {
    installed: "Servolia est installé sur cet appareil.",
    button: "Installer l’application",
    installing: "Ouverture…",
    iosTitle: "Ajouter Servolia à votre écran d’accueil",
    iosSteps: ["Touchez le bouton Partager dans Safari", "Choisissez « Sur l’écran d’accueil »", "Touchez « Ajouter » — c’est fait"],
    otherTitle: "Installer depuis le menu du navigateur",
    otherSteps: ["Ouvrez le menu de votre navigateur", "Choisissez « Installer l’application »"],
    done: "Installé — regardez votre écran d’accueil",
  },
};

export function useInstallState(): {
  platform: Platform;
  install: () => Promise<void>;
  busy: boolean;
  justInstalled: boolean;
} {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [platform, setPlatform] = useState<Platform>("other");
  const [busy, setBusy] = useState(false);
  const [justInstalled, setJustInstalled] = useState(false);

  useEffect(() => {
    // Already running as an installed app — say nothing.
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      // iOS marks installed apps with a non-standard navigator flag.
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (standalone) {
      setPlatform("installed");
      return;
    }

    const ua = window.navigator.userAgent;
    const isIOS = /iPad|iPhone|iPod/.test(ua);
    if (isIOS) setPlatform("ios");

    const onPrompt = (e: Event) => {
      // Chrome shows its own mini-infobar unless this is prevented; we want the
      // prompt to appear where the user asked for it, not over the content.
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setPlatform("installable");
    };
    const onInstalled = () => {
      setJustInstalled(true);
      setDeferred(null);
    };

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);

    // No worker, no install prompt — Chrome requires one with a fetch handler.
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* Install simply stays unavailable; nothing else depends on it. */
      });
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const install = useCallback(async () => {
    if (!deferred) return;
    setBusy(true);
    try {
      await deferred.prompt();
      await deferred.userChoice;
      // The event is single-use: Chrome will fire a fresh one if it still applies.
      setDeferred(null);
    } finally {
      setBusy(false);
    }
  }, [deferred]);

  return { platform, install, busy, justInstalled };
}

/** Full block for the install page. */
export default function InstallApp({ lang = "fr" }: { lang?: "en" | "fr" }) {
  const t = COPY[lang === "fr" ? "fr" : "en"];
  const { platform, install, busy, justInstalled } = useInstallState();

  if (justInstalled) {
    return (
      <p className="inline-flex items-center gap-2 text-sm font-bold text-[#36671E]">
        <Check className="w-4 h-4" /> {t.done}
      </p>
    );
  }

  if (platform === "installed") {
    return (
      <p className="inline-flex items-center gap-2 text-sm font-bold text-[#36671E]">
        <Check className="w-4 h-4" /> {t.installed}
      </p>
    );
  }

  if (platform === "installable") {
    return (
      <button
        type="button"
        onClick={install}
        disabled={busy}
        className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#36671E] text-[#FAFAF7] font-bold text-sm hover:bg-[#295115] transition-colors disabled:opacity-60"
      >
        <Download className="w-4 h-4" />
        {busy ? t.installing : t.button}
      </button>
    );
  }

  // iOS and everything else: instructions, because there is no API to call.
  const isIos = platform === "ios";
  const steps = isIos ? t.iosSteps : t.otherSteps;
  const Icon = isIos ? Share : MoreVertical;

  return (
    <div className="rounded-xl border border-[#E8E6E0] bg-white p-5 text-left max-w-sm">
      <p className="flex items-center gap-2 text-sm font-black text-[#18181B] mb-3">
        <Icon className="w-4 h-4 text-[#36671E]" />
        {isIos ? t.iosTitle : t.otherTitle}
      </p>
      <ol className="space-y-2">
        {steps.map((s, i) => (
          <li key={i} className="flex gap-2.5 text-sm text-[#3F3F46]">
            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[#EEF5EA] text-[#36671E] text-[11px] font-black flex items-center justify-center">
              {i + 1}
            </span>
            <span>{s}</span>
          </li>
        ))}
      </ol>
      {isIos && (
        <p className="flex items-center gap-1.5 text-[11px] text-[#A1A1AA] mt-3">
          <PlusSquare className="w-3 h-3" /> Safari uniquement — Chrome sur iPhone ne peut pas installer d’app.
        </p>
      )}
    </div>
  );
}
