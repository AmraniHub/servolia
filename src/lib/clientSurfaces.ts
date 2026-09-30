/**
 * Pages that belong to a CLIENT rather than to Servolia's marketing.
 *
 * Their payment page, service page, billing return, terms and the upgrade
 * flow. Servolia's own analytics do not run here, and consequently neither
 * does the cookie banner.
 *
 * WHY, IN TWO PARTS
 *
 * Honesty first. GA4, the Meta Pixel and the Google Ads tag load for every
 * visitor on Servolia's own pages (founder decision 2026-09-30), and the
 * banner is a notice saying so, not a consent choice. Hiding that notice
 * while the trackers still ran would have made the site less honest, so here
 * both go together.
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
