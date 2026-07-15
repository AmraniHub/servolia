/** Shared CSV building — used by every /api/admin/export/* route. */

function csvCell(value: unknown): string {
  if (value == null) return "";
  const str = String(value).replace(/"/g, '""');
  return /[,"\n]/.test(str) ? `"${str}"` : str;
}

/** Turns an array of objects into a CSV string using the given column order. */
export function toCsv(headers: string[], rows: Record<string, unknown>[]): string {
  const lines = rows.map((r) => headers.map((h) => csvCell(r[h])).join(","));
  return [headers.join(","), ...lines].join("\n");
}

/** Standard CSV download response, filename auto-dated. */
export function csvResponse(name: string, csv: string) {
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="servolia-${name}-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
