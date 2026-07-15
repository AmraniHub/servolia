"use client";

import { useState } from "react";

/**
 * An <img> that never leaves permanent blank space. If the source fails to
 * load (slow/cold Pollinations generation, network hiccup, dead URL), it
 * falls back to a soft branded panel instead of a broken/empty box.
 */
export default function CoverImage({
  src,
  alt = "",
  className = "",
  fallbackClassName = "",
}: {
  src?: string | null;
  alt?: string;
  className?: string;
  fallbackClassName?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        className={`bg-gradient-to-br from-[#EEF5EA] to-[#D6E2CF] ${fallbackClassName || className}`}
        aria-hidden="true"
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      loading="lazy"
      className={className}
      onError={() => setFailed(true)}
    />
  );
}
