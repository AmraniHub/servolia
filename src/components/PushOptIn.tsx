"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell, BellOff, Check, Loader2, X } from "lucide-react";

/**
 * Opt-in to "a patient just enquired" on this device.
 *
 * THE PERMISSION PROMPT IS ONE-SHOT. If a client taps Block, the browser will
 * never ask again and there is no API to recover it — they would have to dig
 * into site settings, which nobody does. So the browser prompt is fired only
 * from an explicit click on OUR button, after they have been told what it is
 * for. Asking on page load is how you burn the permission for good on the one
 * visit where they were busy.
 *
 * It also only appears once there is something worth being notified about
 * (`hasActivity`), so a client whose site is not live yet is not asked to
 * enable alerts for enquiries that cannot arrive.
 *
 * iOS note: Safari grants push only inside an INSTALLED PWA. On a normal iOS
 * browser tab the API is simply absent, so this renders nothing rather than a
 * button that would fail — the install page is the route there.
 */

const DISMISS_KEY = "servolia.push.dismissed";

const COPY = {
  en: {
    title: "Get told the moment a patient writes in",
    body: "A notification on this device, even when the app is closed. No email to dig through.",
    enable: "Turn on notifications",
    working: "Waiting for your browser…",
    on: "Notifications are on for this device",
    off: "Turn off",
    blocked: "Notifications are blocked in your browser settings for this site.",
    later: "Not now",
    failed: "Could not enable notifications. Try again, or check your browser settings.",
  },
  fr: {
    title: "Soyez prévenu dès qu’un patient écrit",
    body: "Une notification sur cet appareil, même application fermée. Aucun email à fouiller.",
    enable: "Activer les notifications",
    working: "En attente de votre navigateur…",
    on: "Notifications activées sur cet appareil",
    off: "Désactiver",
    blocked: "Les notifications sont bloquées pour ce site dans les réglages de votre navigateur.",
    later: "Plus tard",
    failed: "Impossible d’activer les notifications. Réessayez ou vérifiez les réglages du navigateur.",
  },
};

/** VAPID public keys travel as base64url; PushManager wants raw bytes. */
function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(b64);
  // Allocate the ArrayBuffer explicitly: since TS 5.7 `new Uint8Array(n)`
  // widens to ArrayBufferLike, which does not satisfy BufferSource.
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

type State = "checking" | "hidden" | "offer" | "working" | "on" | "blocked" | "failed";

export default function PushOptIn({
  lang = "fr",
  hasActivity = true,
}: {
  lang?: "en" | "fr";
  /** Only ask once there is something to be notified about. */
  hasActivity?: boolean;
}) {
  const t = COPY[lang === "fr" ? "fr" : "en"];
  const [state, setState] = useState<State>("checking");
  const [publicKey, setPublicKey] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      // Absent entirely on iOS outside an installed PWA, and on old browsers.
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        return setState("hidden");
      }
      try {
        if (window.localStorage.getItem(DISMISS_KEY)) return setState("hidden");
      } catch {
        /* private mode — just carry on */
      }

      // Already subscribed on this device?
      const reg = await navigator.serviceWorker.ready.catch(() => null);
      const existing = await reg?.pushManager.getSubscription().catch(() => null);
      if (cancelled) return;
      if (existing) return setState("on");

      if (Notification.permission === "denied") return setState("blocked");
      if (!hasActivity) return setState("hidden");

      const res = await fetch("/api/portal/push").catch(() => null);
      const json = res?.ok ? await res.json().catch(() => null) : null;
      if (cancelled) return;
      if (!json?.available || !json.publicKey) return setState("hidden");

      setPublicKey(json.publicKey);
      setState("offer");
    })();

    return () => {
      cancelled = true;
    };
  }, [hasActivity]);

  const enable = useCallback(async () => {
    if (!publicKey) return;
    setState("working");
    try {
      // Fired from this click, never on load — see the note at the top.
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        return setState(permission === "denied" ? "blocked" : "offer");
      }

      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      const res = await fetch("/api/portal/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: sub.toJSON() }),
      });
      if (!res.ok) throw new Error("save failed");
      setState("on");
    } catch {
      setState("failed");
    }
  }, [publicKey]);

  const disable = useCallback(async () => {
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/portal/push", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        }).catch(() => {});
        await sub.unsubscribe().catch(() => {});
      }
    } finally {
      setState("offer");
    }
  }, []);

  const dismiss = () => {
    try {
      window.localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
    setState("hidden");
  };

  if (state === "checking" || state === "hidden") return null;

  if (state === "on") {
    return (
      <div className="flex items-center gap-2 text-xs text-[var(--p-muted)] mb-5">
        <Check className="w-3.5 h-3.5 text-[var(--p-accent)]" />
        <span>{t.on}</span>
        <button onClick={disable} className="underline hover:text-[var(--p-text)] transition-colors">
          {t.off}
        </button>
      </div>
    );
  }

  if (state === "blocked") {
    return (
      <p className="flex items-center gap-2 text-xs text-[var(--p-muted)] mb-5">
        <BellOff className="w-3.5 h-3.5" /> {t.blocked}
      </p>
    );
  }

  return (
    <div className="flex items-start gap-3 rounded-xl border border-[var(--p-border)] bg-[var(--p-raised)] px-4 py-3 mb-5">
      <Bell className="w-4 h-4 text-[var(--p-accent)] mt-0.5 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-black text-[var(--p-text)]">{t.title}</p>
        <p className="text-xs text-[var(--p-muted)] mt-0.5">{t.body}</p>
        {state === "failed" && <p className="text-xs text-[#B91C1C] mt-1">{t.failed}</p>}
        <div className="flex items-center gap-3 mt-2">
          <button
            type="button"
            onClick={enable}
            disabled={state === "working"}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--p-accent)] text-white text-xs font-bold disabled:opacity-60"
          >
            {state === "working" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Bell className="w-3.5 h-3.5" />}
            {state === "working" ? t.working : t.enable}
          </button>
          <button
            type="button"
            onClick={dismiss}
            className="text-xs font-semibold text-[var(--p-muted)] hover:text-[var(--p-text)] transition-colors"
          >
            {t.later}
          </button>
        </div>
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label={t.later}
        className="text-[var(--p-faint)] hover:text-[var(--p-text)] transition-colors shrink-0"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
