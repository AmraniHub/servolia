import { supabaseAdmin } from "@/lib/supabase";

/**
 * DELIVERY CAPACITY — real scarcity, never invented.
 *
 * Servolia is one person committing in writing to a 7-day delivery with a
 * 10%/day late penalty. That makes weekly capacity a hard, honest constraint,
 * not a marketing device: taking a fourth build in a week is how the delivery
 * guarantee gets breached and refunded.
 *
 * HONESTY RULE — load-bearing, not style. Everything shown to a visitor here
 * must be derived from real rows in `builds`. If the database is unreachable
 * we show the CAP ("we take 3 installations a week") and no live count, never
 * a fabricated "only 1 slot left!". A false scarcity claim on a page that also
 * carries a money-back delivery guarantee is both a lie and a liability.
 *
 * The number that persuades is the cap itself — a studio that admits it can
 * only take three clients a week is making a credible quality claim. Depletion
 * is a bonus when it's true.
 */

/** Installations Servolia can start in one week without risking the guarantee. */
export const WEEKLY_INSTALL_CAPACITY = 3;

/** Build statuses that occupy a delivery slot (delivered/live have shipped). */
const IN_FLIGHT: string[] = ["intake", "building", "review"];

export interface CapacityState {
  /** Weekly cap — always known, even with no database. */
  capacity: number;
  /** Builds currently occupying a slot, or null when unknown. */
  inFlight: number | null;
  /** Slots left this week, or null when unknown. */
  slotsLeft: number | null;
  /** True when the week is full — the strongest and rarest honest signal. */
  full: boolean;
}

/**
 * Live delivery capacity. Never throws and never invents: on any failure the
 * caller gets the cap with `inFlight: null`, and the UI degrades to stating
 * the cap alone.
 */
export async function getCapacity(): Promise<CapacityState> {
  const base: CapacityState = {
    capacity: WEEKLY_INSTALL_CAPACITY,
    inFlight: null,
    slotsLeft: null,
    full: false,
  };

  try {
    const db = supabaseAdmin();
    if (!db) return base;

    const { count, error } = await db
      .from("builds")
      .select("id", { count: "exact", head: true })
      .in("status", IN_FLIGHT);

    if (error || count == null) return base;

    const slotsLeft = Math.max(0, WEEKLY_INSTALL_CAPACITY - count);
    return {
      capacity: WEEKLY_INSTALL_CAPACITY,
      inFlight: count,
      slotsLeft,
      full: slotsLeft === 0,
    };
  } catch {
    return base;
  }
}
