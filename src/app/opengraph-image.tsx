import { ImageResponse } from "next/og";
import { iconMarkDataUri } from "@/lib/logoAsset";

export const alt = "Servolia — AI Client Acquisition Systems for Service Businesses";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OG() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#0A1F14",
          padding: "72px",
          fontFamily: "sans-serif",
          position: "relative",
        }}
      >
        {/* glow */}
        <div
          style={{
            position: "absolute",
            top: -120,
            left: 300,
            width: 700,
            height: 500,
            background: "#36671E",
            filter: "blur(120px)",
            borderRadius: "9999px",
            opacity: 0.7,
          }}
        />

        {/* logo row */}
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div style={{ width: 56, height: 56, borderRadius: 14, display: "flex", overflow: "hidden" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={iconMarkDataUri()} width={56} height={56} alt="" />
          </div>
          <div style={{ color: "#FAFAF7", fontSize: 34, fontWeight: 800, letterSpacing: -1 }}>
            Servolia
          </div>
        </div>

        {/* headline */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              color: "#FAFAF7",
              fontSize: 68,
              fontWeight: 900,
              lineHeight: 1.05,
              letterSpacing: -2,
              maxWidth: 980,
            }}
          >
            Turn your website into a 24/7 client acquisition system.
          </div>
          <div style={{ color: "#ABDF90", fontSize: 30, fontWeight: 600, marginTop: 28 }}>
            AI websites · receptionists · booking · CRM — fixed price, 7-day delivery
          </div>
        </div>

        {/* footer row */}
        <div style={{ display: "flex", alignItems: "center", gap: 28, color: "#FAFAF7", opacity: 0.75, fontSize: 24 }}>
          <span>servolia.com</span>
          <span style={{ color: "#BEF264" }}>·</span>
          <span>Europe &amp; US</span>
        </div>
      </div>
    ),
    { ...size }
  );
}
