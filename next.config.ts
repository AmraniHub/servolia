import type { NextConfig } from "next";
import path from "node:path";

/**
 * WHY THE TURBOPACK ROOT IS PINNED.
 *
 * Turbopack infers the workspace root from the outermost lockfile it can find,
 * and this machine has a stray `package.json` + `package-lock.json` sitting in
 * the home directory from May. So it chose `C:\Users\Elamr`, resolved the app
 * from there, and `next dev` answered 404 to EVERY route — including pages
 * nobody had touched, which is what made it look like a code fault rather than
 * a resolution one. Production was unaffected throughout, because Vercel builds
 * with the repository as the root.
 *
 * Pinning it here fixes it for anyone who clones this, rather than depending on
 * one machine's home directory being tidy.
 */
const nextConfig: NextConfig = {
  turbopack: {
    root: path.join(__dirname),
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // Force HTTPS for a year incl. subdomains (site is HTTPS-only on Vercel).
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
          // Never sniff content types.
          { key: "X-Content-Type-Options", value: "nosniff" },
          // No embedding in third-party iframes (clickjacking) — same-origin ok.
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          // Don't leak full URLs cross-origin (referrers can contain tokens).
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // We use none of these — deny by default.
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
        ],
      },
    ];
  },
  async redirects() {
    return [
      // Real estate and legal are explicitly excluded from the strategy
      // (docs/PRINCIPLES.md P2) — no niche template backs either (see
      // src/lib/niches/), so their dedicated funnel pages were retired.
      // Prospects from both still self-identify via the contact/audit forms;
      // they're just no longer actively marketed to.
      { source: "/niches/real-estate", destination: "/contact", permanent: true },
      { source: "/niches/lawyers", destination: "/contact", permanent: true },
      // Servolia sells without sales calls — the whole funnel is async by
      // design (scored audit → personalised demo → self-serve checkout).
      // "No call required" is a feature for a clinician who cannot take one,
      // not a limitation. The old booking pages redirect to the audit, which
      // is what a discovery call used to produce anyway.
      { source: "/call", destination: "/free-audit", permanent: true },
      { source: "/fr/appel", destination: "/fr/audit", permanent: true },
    ];
  },
};

export default nextConfig;
