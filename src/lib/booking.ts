/**
 * Discovery-call slot generation — Europe/Paris business hours, DST-safe.
 *
 * We generate 30-minute slots Mon–Fri, 09:00–18:00 Paris time, for the next
 * ~10 business days, excluding past times, a minimum lead time, and any slots
 * already booked. No external calendar dependency.
 */

export const SLOT_MINUTES = 30;
const WORK_DAYS = [1, 2, 3, 4, 5]; // Mon–Fri
const START_HOUR = 9;
const END_HOUR = 18; // last slot starts 17:30
const HORIZON_DAYS = 18; // calendar days to scan
const MAX_SLOTS = 60;
const MIN_LEAD_MS = 2 * 60 * 60 * 1000; // 2h notice

/** Milliseconds that Europe/Paris is ahead of UTC at a given instant. */
function parisOffsetMs(date: Date): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Paris",
    hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  const p: Record<string, string> = {};
  for (const part of dtf.formatToParts(date)) p[part.type] = part.value;
  const asUTC = Date.UTC(
    Number(p.year), Number(p.month) - 1, Number(p.day),
    Number(p.hour), Number(p.minute), Number(p.second),
  );
  return asUTC - date.getTime();
}

/** Convert a Paris wall-clock time to the corresponding UTC instant. */
function parisWallToUtc(y: number, mo: number, d: number, hh: number, mm: number): Date {
  const naive = Date.UTC(y, mo, d, hh, mm);
  const off = parisOffsetMs(new Date(naive));
  return new Date(naive - off);
}

/** Paris calendar parts for an instant (to walk days in Paris time). */
function parisParts(date: Date): { y: number; mo: number; d: number; dow: number } {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Paris", weekday: "short",
    year: "numeric", month: "2-digit", day: "2-digit",
  });
  const p: Record<string, string> = {};
  for (const part of dtf.formatToParts(date)) p[part.type] = part.value;
  const dowMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return { y: Number(p.year), mo: Number(p.month) - 1, d: Number(p.day), dow: dowMap[p.weekday] ?? 0 };
}

export interface Slot {
  iso: string;     // UTC ISO — the value posted back
  label: string;   // "14:30"
  dayKey: string;  // "2026-07-14"
  dayLabel: string; // "Mon 14 Jul"
}

/** Generate available slots, excluding the provided already-booked ISO strings. */
export function generateSlots(bookedIso: string[] = [], lang: "en" | "fr" = "fr"): Slot[] {
  const booked = new Set(bookedIso.map((s) => new Date(s).toISOString()));
  const now = Date.now();
  const slots: Slot[] = [];

  const dayFmt = new Intl.DateTimeFormat(lang === "fr" ? "fr-FR" : "en-GB", {
    timeZone: "Europe/Paris", weekday: "short", day: "numeric", month: "short",
  });

  for (let dayOffset = 0; dayOffset < HORIZON_DAYS && slots.length < MAX_SLOTS; dayOffset++) {
    const dayInstant = new Date(now + dayOffset * 24 * 60 * 60 * 1000);
    const { y, mo, d, dow } = parisParts(dayInstant);
    if (!WORK_DAYS.includes(dow)) continue;

    for (let hh = START_HOUR; hh < END_HOUR && slots.length < MAX_SLOTS; hh++) {
      for (let mm = 0; mm < 60; mm += SLOT_MINUTES) {
        const utc = parisWallToUtc(y, mo, d, hh, mm);
        if (utc.getTime() < now + MIN_LEAD_MS) continue;
        const iso = utc.toISOString();
        if (booked.has(iso)) continue;

        const dayLabel = dayFmt.format(utc).replace(/\./g, "");
        slots.push({
          iso,
          label: `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`,
          dayKey: `${y}-${String(mo + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
          dayLabel: dayLabel.charAt(0).toUpperCase() + dayLabel.slice(1),
        });
      }
    }
  }
  return slots;
}

/** Human label for a booked slot, e.g. "Mon 14 Jul, 14:30 (Paris)". */
export function formatSlot(iso: string, lang: "en" | "fr" = "fr"): string {
  const fmt = new Intl.DateTimeFormat(lang === "fr" ? "fr-FR" : "en-GB", {
    timeZone: "Europe/Paris",
    weekday: "short", day: "numeric", month: "short",
    hour: "2-digit", minute: "2-digit",
  });
  return `${fmt.format(new Date(iso))} (Paris)`;
}

/** Guard: is this ISO a real, still-available business slot? */
export function isValidSlot(iso: string): boolean {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return false;
  if (d.getTime() < Date.now()) return false;
  const { dow } = parisParts(d);
  if (!WORK_DAYS.includes(dow)) return false;
  // Must align to a :00 or :30 within work hours (checked loosely in Paris)
  const label = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
  const [h, m] = label.split(":").map(Number);
  return h >= START_HOUR && h < END_HOUR && (m === 0 || m === 30);
}
