/**
 * Date helpers shared by the deadline calendar and delivery progress.
 * Lives on its own so those two modules can use it without importing each
 * other (they'd form a cycle).
 *
 * DATE-KEY RULE: never build a day key with `date.toISOString().slice(0,10)`.
 * toISOString() converts to UTC, so a Date at LOCAL midnight anywhere east of
 * UTC rolls back to the previous day and every calendar event renders one cell
 * early — in Paris a 6 Aug deadline shows on the 5th. Always use localDateKey().
 */

/** YYYY-MM-DD from a Date's LOCAL components. See the date-key rule above. */
export function localDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Local midnight for a stored timestamp/date string. */
export function toLocalDay(v: string | Date): Date {
  const d = v instanceof Date ? new Date(v) : new Date(v);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Whole days from today (negative = overdue). */
export function daysUntil(v: string | Date): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((toLocalDay(v).getTime() - today.getTime()) / 86_400_000);
}

export function relativeDays(v: string | Date): string {
  const d = daysUntil(v);
  if (d === 0) return "today";
  if (d === 1) return "tomorrow";
  if (d === -1) return "yesterday";
  return d > 0 ? `in ${d}d` : `${-d}d late`;
}

/** Monday-first month grid (France). Nulls pad the leading/trailing week. */
export function monthGrid(year: number, month: number): (Date | null)[] {
  const first = new Date(year, month, 1);
  const startDow = (first.getDay() + 6) % 7; // Monday = 0
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7) cells.push(null);
  return cells;
}

/**
 * The delivery guarantee, priced. CGV: 10% of the project price per day of
 * delay, capped at 50%.
 */
export function refundRiskEur(totalPrice: number, daysLate: number): number {
  if (daysLate <= 0) return 0;
  return Math.round(Math.min(0.5, 0.1 * daysLate) * Number(totalPrice || 0));
}
