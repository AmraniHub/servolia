/**
 * The onboarding form's "your answers are saved as you go", made true.
 *
 * Answers live in the buyer's own browser only, never on our server, until
 * they submit. A buyer who arrived from a payment gets localStorage keyed by
 * their Stripe session, so a reload, a closed tab or a return the next day
 * finds their answers, and a second purchase on the same browser starts
 * clean. The plain /onboarding page has no session to key on, so it uses
 * sessionStorage: it survives a reload, and a shared computer does not show
 * one visitor's phone number and address to the next.
 *
 * Storage can be missing or throw (private windows, blocked site data), so
 * every access is guarded and the form simply works without it.
 */

export const DRAFT_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

type Area = Pick<Storage, "getItem" | "setItem" | "removeItem">;
export type Draft<F> = { form: F; step: number };

export function draftKey(sessionId: string | null, plan: string): string {
  return `servolia-intake:${sessionId || "open"}:${plan}`;
}

export function draftArea(sessionId: string | null): Area | null {
  try {
    if (typeof window === "undefined") return null;
    return sessionId ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

/**
 * The saved draft, merged over `blank`: only fields `blank` has, only string
 * values. Anything stale, malformed or from an older form shape is ignored.
 */
export function readDraft<F extends Record<string, string>>(
  area: Area | null, key: string, blank: F, steps: number, now = Date.now(),
): Draft<F> | null {
  if (!area) return null;
  try {
    const raw = area.getItem(key);
    if (!raw) return null;
    const saved = JSON.parse(raw) as { form?: unknown; step?: unknown; at?: unknown };
    if (!saved || typeof saved !== "object" || !saved.form || typeof saved.form !== "object") return null;
    if (typeof saved.at !== "number" || now - saved.at > DRAFT_MAX_AGE_MS) {
      area.removeItem(key);
      return null;
    }
    const form = { ...blank };
    let any = false;
    for (const k of Object.keys(blank) as (keyof F)[]) {
      const v = (saved.form as Record<string, unknown>)[k as string];
      if (typeof v === "string") { form[k] = v as F[keyof F]; any = true; }
    }
    if (!any) return null;
    const step = Number.isInteger(saved.step) ? Math.min(Math.max(saved.step as number, 0), steps - 1) : 0;
    return { form, step };
  } catch {
    return null;
  }
}

export function writeDraft<F>(area: Area | null, key: string, draft: Draft<F>, now = Date.now()): void {
  if (!area) return;
  try {
    area.setItem(key, JSON.stringify({ form: draft.form, step: draft.step, at: now }));
  } catch { /* full or blocked: the form still works, it just won't remember */ }
}

export function clearDraft(area: Area | null, key: string): void {
  try { area?.removeItem(key); } catch { /* nothing to clear */ }
}
