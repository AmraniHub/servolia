import { ImageResponse } from "next/og";
import { iconMarkDataUri } from "@/lib/logoAsset";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 32,
          height: 32,
          display: "flex",
          borderRadius: 7,
          overflow: "hidden",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={iconMarkDataUri()} width={32} height={32} alt="" />
      </div>
    ),
    { ...size }
  );
}
