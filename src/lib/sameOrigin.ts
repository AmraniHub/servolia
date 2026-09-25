/**
 * IS THIS STATE-CHANGING REQUEST FROM OUR OWN PAGE?
 *
 * The admin session cookie is SameSite=lax, which already keeps it off a
 * POST from another SITE. It does not keep it off a POST from another page on
 * the same site (a subdomain, a client page we serve), and a route that makes
 * a live payment link deserves the second check. Browsers set both signals
 * themselves; no page script can forge either:
 *   - `Sec-Fetch-Site`: anything but "same-origin" (or "none", a typed URL)
 *     is refused;
 *   - `Origin`: when present, its host must be the host serving the request.
 * A request with neither (curl, an old browser) falls back to the admin
 * cookie alone, exactly as every other admin route works today.
 */
export function sameOriginRequest(headers: { get(name: string): string | null }): boolean {
  const site = (headers.get("sec-fetch-site") ?? "").toLowerCase();
  if (site && site !== "same-origin" && site !== "none") return false;
  const origin = headers.get("origin");
  if (!origin) return true;
  let from = "";
  try { from = new URL(origin).host.toLowerCase(); } catch { return false; }
  const self = (headers.get("x-forwarded-host") ?? headers.get("host") ?? "").split(",")[0].trim().toLowerCase();
  return Boolean(self) && from === self;
}
