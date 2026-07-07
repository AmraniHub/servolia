import { ImageResponse } from "next/og";
import { iconMarkDataUri } from "@/lib/logoAsset";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: 180, height: 180, display: "flex" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={iconMarkDataUri()} width={180} height={180} alt="" />
      </div>
    ),
    { ...size }
  );
}
