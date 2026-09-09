/**
 * Pages that belong to a CLIENT rather than to Servolia's marketing.
 *
 * Their payment page, service page, billing return, terms and the upgrade
 * flow. Servolia's own analytics do not run here, and consequently neither
 * does the cookie banner.
 *
 * WHY, IN TWO PARTS
 *
 * Honesty first. The banner writes a consent flag that nothing in the codebase
 * reads: GA4, the Meta Pixel and the Google Ads tag load either way, so
 * "Decline" only hides the banner. Suppressing that banner while the trackers
 * still ran would have made a cosmetic problem into a dishonest one.
 *
 * And there is no reason to track here. These pages are reached by a signed
 * link sent to one named client -- they are not an acquisition surface, and
 * purchases are already reported to Meta server-side from the Stripe webhook,
 * which is more reliable than a browser pixel. So the tracking buys nothing
 * and costs a client being followed around their own invoice.
 *
 * Servolia's marketing pages are untouched: ad measurement there is unchanged.
 */
export function isClientSurface(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return (
    pathname === "/chatbot" ||
    pathname === "/hosting" ||
    pathname.startsWith("/hosting/")
  );
}
