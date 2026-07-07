import Script from "next/script";

/**
 * Site-wide analytics: GA4 + Meta Pixel.
 * IDs default to the live Servolia properties, and can be overridden per-env
 * via NEXT_PUBLIC_GA4_ID / NEXT_PUBLIC_META_PIXEL_ID (e.g. a staging property).
 */

const DEFAULT_GA4 = "G-L64925WGDH";          // Servolia GA4 (Measurement ID)
const DEFAULT_PIXEL = "1394909005810177";     // Servolia Meta Pixel / dataset id

export default function Analytics() {
  const ga = process.env.NEXT_PUBLIC_GA4_ID || DEFAULT_GA4;
  const pixel = process.env.NEXT_PUBLIC_META_PIXEL_ID || DEFAULT_PIXEL;
  if (!ga && !pixel) return null;

  return (
    <>
      {ga && (
        <>
          <Script async src={`https://www.googletagmanager.com/gtag/js?id=${ga}`} strategy="afterInteractive" />
          <Script id="ga4-init" strategy="afterInteractive">
            {`window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${ga}', { anonymize_ip: true });`}
          </Script>
        </>
      )}
      {pixel && (
        <>
          <Script id="meta-pixel" strategy="afterInteractive">
            {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
              fbq('init', '${pixel}'); fbq('track', 'PageView');`}
          </Script>
          <noscript>
            <img height="1" width="1" style={{ display: "none" }}
              src={`https://www.facebook.com/tr?id=${pixel}&ev=PageView&noscript=1`} alt="" />
          </noscript>
        </>
      )}
    </>
  );
}

/**
 * Tracking helper — call from client components on conversion events.
 * Usage: trackConversion("LeadFormSubmit", { value: 990, currency: "EUR" });
 */
export function trackConversion(eventName: string, params?: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  const w = window as unknown as {
    gtag?: (...args: unknown[]) => void;
    fbq?: (...args: unknown[]) => void;
  };
  try {
    w.gtag?.("event", eventName, params);
    w.fbq?.("track", eventName === "purchase" ? "Purchase" : eventName === "LeadFormSubmit" ? "Lead" : "CustomEvent", params);
  } catch {}
}
