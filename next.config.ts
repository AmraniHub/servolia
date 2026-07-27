import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
    ];
  },
};

export default nextConfig;
