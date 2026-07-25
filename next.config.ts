import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
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
