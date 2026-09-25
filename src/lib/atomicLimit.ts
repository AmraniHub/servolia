import { supabaseAdmin } from "@/lib/supabase";

/**
 * AN ATOMIC RATE LIMIT, FOR ENDPOINTS THAT SEND EMAIL.
 *
 * security.ts rateLimited() reads the counter, then writes it back: thirty
 * requests arriving together all read "0" and all pass. For a limiter in
 * front of an email that is the whole failure — the flood it exists to stop.
 *
 * This one is a single statement in Postgres, `servolia_rate_hit` (defined in
 * supabase/2026-09-25-hosting-setup.sql): insert-or-increment and return the
 * new count, so every request gets its own number and exactly `max` pass.
 *
 * IT FAILS CLOSED. No database, the function not created yet, any error: the
 * answer is "unavailable" and the caller refuses. A limiter that allows
 * everything when it cannot count is not a limiter.
 */
export type LimitVerdict = "ok" | "limited" | "unavailable";

type RpcDb = { rpc(fn: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: unknown }> };

export async function atomicLimit(key: string, max: number, windowSec: number, db: RpcDb | null = supabaseAdmin()): Promise<LimitVerdict> {
  if (!db) return "unavailable";
  try {
    const { data, error } = await db.rpc("servolia_rate_hit", { p_key: key, p_window_seconds: windowSec });
    const n = typeof data === "number" ? data : Number(data);
    if (error || !Number.isFinite(n)) return "unavailable";
    return n > max ? "limited" : "ok";
  } catch {
    return "unavailable";
  }
}
