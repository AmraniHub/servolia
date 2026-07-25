import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  async redirects() {
    return [
      // Real estate is explicitly excluded from the strategy (docs/PRINCIPLES.md
      // P2) — no niche template backs it (see src/lib/niches/), so the dedicated
      // funnel page was retired. Real-estate prospects still self-identify via
      // the contact/audit forms; they're just no longer actively marketed to.
      { source: "/niches/real-estate", destination: "/contact", permanent: true },
    ];
  },
};

export default nextConfig;
