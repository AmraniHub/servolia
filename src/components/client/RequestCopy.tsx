"use client";

import { useState } from "react";

/**
 * "Send me a copy of my website" — ask, then download once it is approved.
 *
 * What a client wants when they ask this is rarely a zip file. It is
 * reassurance that the site is theirs and they could leave with it. So the
 * request goes to a person, who usually replies about something else entirely,
 * and the download appears here afterwards.
 *
 * The screen never says "declined". A refusal shown on a page with no
 * explanation is the worst possible version of a conversation he intended to
 * have himself, so a request he did not approve simply leaves the ask button
 * where it was.
 */

const T = {
  en: {
    ask: "Ask for a copy of my website",
    sending: "Asking…",
    waiting: "Asked. We will confirm shortly, and a download button will appear here.",
    cancel: "Cancel this request",
    download: "Download my website (.zip)",
    ready: "Your copy is ready. The link works for the next few days.",
    failed: "That did not go through. Reply to any email from us and we will send them.",
  },
  fr: {
    ask: "Demander une copie de mon site",
    sending: "Envoi…",
    waiting: "C'est noté. Nous confirmons rapidement, et un bouton de téléchargement apparaîtra ici.",
    cancel: "Annuler cette demande",
    download: "Télécharger mon site (.zip)",
    ready: "Votre copie est prête. Le lien reste valable quelques jours.",
    failed: "Cela n'a pas abouti. Répondez à l'un de nos emails et nous vous les envoyons.",
  },
};

export type CopyView = "none" | "waiting" | "ready";

export default function RequestCopy({
  token,
  lang,
  initial = "none",
  sample = false,
}: {
  token: string;
  lang: "en" | "fr";
  initial?: CopyView;
  sample?: boolean;
}) {
  const t = T[lang];
  const [state, setState] = useState<CopyView | "busy" | "failed">(initial);

  if (state === "ready") {
    return (
      <div className="mt-4">
        <a
          href={sample ? undefined : `/api/client-area?do=download&t=${encodeURIComponent(token)}`}
          className="inline-flex items-center h-10 px-4 rounded-lg bg-[#36671E] text-white text-[13.5px] font-bold"
        >
          {t.download}
        </a>
        <p className="mt-2 text-[13px] text-[#8A8A80] leading-relaxed">{t.ready}</p>
      </div>
    );
  }

  if (state === "waiting") {
    return (
      <div className="mt-4">
        <p className="text-[13.5px] text-[#36671E] leading-relaxed">{t.waiting}</p>
        {/* A way back. Without it a client who pressed the button once sees
            "we will confirm shortly" forever and has no route to the button. */}
        <button
          onClick={async () => {
            if (sample) return;
            setState("busy");
            try {
              const r = await fetch("/api/client-area?do=cancel-copy", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ t: token }),
              });
              setState((await r.json()).ok ? "none" : "waiting");
            } catch {
              setState("waiting");
            }
          }}
          className="mt-2 text-[13px] text-[#71717A] hover:underline"
        >
          {t.cancel}
        </button>
      </div>
    );
  }

  return (
    <div className="mt-4">
      <button
        onClick={async () => {
          if (sample) return;
          setState("busy");
          try {
            const r = await fetch("/api/client-area?do=request-copy", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ t: token }),
            });
            const d = await r.json();
            setState(d.ok ? (d.state === "ready" ? "ready" : "waiting") : "failed");
          } catch {
            setState("failed");
          }
        }}
        disabled={sample || state === "busy"}
        className="h-10 px-4 rounded-lg border border-[#CBE3BC] bg-[#F7FBF4] text-[13.5px] font-bold text-[#36671E] disabled:opacity-60"
      >
        {state === "busy" ? t.sending : t.ask}
      </button>
      {state === "failed" ? <p className="mt-2 text-[13px] text-[#B45309]">{t.failed}</p> : null}
    </div>
  );
}
