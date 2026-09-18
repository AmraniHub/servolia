"use client";

import { useState } from "react";

/**
 * "Send me a copy of my website."
 *
 * A request rather than an instant download, on purpose. What a client wants
 * when they ask this is not a zip of a git repository — it is reassurance that
 * the site is theirs and they could leave with it. A person putting the files
 * together can send something they can actually use, and can ask what they
 * need it for, which is usually the more useful conversation.
 *
 * The button does not pretend afterwards. It says a person will send it and
 * by when, because a confirmation that promises nothing specific is how a
 * client ends up asking three times.
 */

const T = {
  en: {
    ask: "Email me a copy of my website",
    sending: "Asking…",
    done: "Asked. We will email your files to the address on your account within one working day.",
    failed: "That did not go through. Reply to any email from us and we will send them.",
  },
  fr: {
    ask: "Envoyez-moi une copie de mon site",
    sending: "Envoi…",
    done: "C'est noté. Nous envoyons vos fichiers à l'adresse de votre compte sous un jour ouvré.",
    failed: "Cela n'a pas abouti. Répondez à l'un de nos emails et nous vous les envoyons.",
  },
};

export default function RequestCopy(
  { token, lang, sample = false }: { token: string; lang: "en" | "fr"; sample?: boolean },
) {
  const t = T[lang];
  const [state, setState] = useState<"idle" | "busy" | "done" | "failed">("idle");

  if (state === "done") {
    return <p className="mt-4 text-[13.5px] text-[#36671E] leading-relaxed">{t.done}</p>;
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
            setState((await r.json()).ok ? "done" : "failed");
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
