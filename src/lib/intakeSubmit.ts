/**
 * Sending the paid-client intake (src/components/OnboardingForm.tsx) and
 * turning the answer into the words the buyer sees.
 *
 * Kept out of the component so it can be tested with Node alone (tests/
 * intake-email.test.mjs). Found 2026-09-25: the server answered a paying
 * buyer's intake with 400 "Invalid email" and the form said "check your
 * connection" -- a wrong diagnosis that sent them to fix their Wi-Fi. Now:
 *
 *   - the server's own `message` (written for the buyer, in their language)
 *     is shown when it sends one;
 *   - any other refusal says so and names the address that fixes it;
 *   - "connection" is said ONLY when the request never got an answer.
 */

export type IntakeLang = "en" | "fr";

export type IntakeOutcome =
  | { ok: true }
  | { ok: false; kind: "server" | "network"; message: string };

export const INTAKE_FAIL = {
  server: {
    en: "We couldn't take your answers just now. Email hello@servolia.com and we'll sort it out — nothing is lost: your answers are still in the form.",
    fr: "Nous n'avons pas pu enregistrer vos réponses pour l'instant. Écrivez à hello@servolia.com et nous réglons cela — rien n'est perdu : vos réponses sont toujours dans le formulaire.",
  },
  network: {
    en: "Your answers could not be sent — check your connection and try again. Nothing is lost: they are still in the form.",
    fr: "Vos réponses n'ont pas pu être envoyées — vérifiez votre connexion et réessayez. Rien n'est perdu : elles sont toujours dans le formulaire.",
  },
} as const;

type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; body: string }) => Promise<{ ok: boolean; json(): Promise<unknown> }>;

export async function submitIntake(
  body: Record<string, unknown>,
  lang: IntakeLang,
  fetchImpl: FetchLike = fetch as unknown as FetchLike,
): Promise<IntakeOutcome> {
  let res: Awaited<ReturnType<FetchLike>>;
  try {
    res = await fetchImpl("/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    return { ok: false, kind: "network", message: INTAKE_FAIL.network[lang] };
  }
  if (res.ok) return { ok: true };
  // The server answered: whatever went wrong, it was not the connection.
  const data = await res.json().catch(() => null) as { message?: unknown } | null;
  const said = typeof data?.message === "string" && data.message.trim() ? data.message.trim() : null;
  return { ok: false, kind: "server", message: said ?? INTAKE_FAIL.server[lang] };
}

/** A plausible address -- the same shape the server's gate accepts. */
export function looksLikeEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}
