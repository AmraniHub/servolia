/* eslint-disable @next/next/no-img-element */

/**
 * Servolia brand symbol — the flowing "S" mark, cropped from the official
 * logo artwork (public/logo.png is the full wordmark; this is the icon-only
 * crop). Single source of truth for the icon; mirrored in public/logo-icon.png
 * for platforms that can't render React (favicon, apple-icon, opengraph-image).
 */
export default function Logomark({ className = "w-4 h-4" }: { className?: string }) {
  return <img src="/logo-icon.png" alt="" className={`${className} object-contain rounded-[22%]`} />;
}
