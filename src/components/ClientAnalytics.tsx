import Script from "next/script";

/**
 * A client site's OWN analytics tags — never Servolia's.
 *
 * Servolia's GA4/Pixel are suppressed on /sites/* (see Analytics.tsx), so this
 * is the only third-party tracking a client site loads, and only when that
 * client actually supplied an ID at intake. Sites with no IDs load nothing and
 * still get full first-party numbers in the portal via PageTracker.
 */
export default function ClientAnalytics({
  ga4Id,
  metaPixelId,
}: {
  ga4Id?: string;
  metaPixelId?: string;
}) {
  if (!ga4Id && !metaPixelId) return null;

  return (
    <>
      {ga4Id && (
        <>
          <Script async src={`https://www.googletagmanager.com/gtag/js?id=${ga4Id}`} strategy="afterInteractive" />
          <Script id="client-ga4-init" strategy="afterInteractive">
            {`window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${ga4Id}', { anonymize_ip: true });`}
          </Script>
        </>
      )}
      {metaPixelId && (
        <Script id="client-meta-pixel" strategy="afterInteractive">
          {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
            fbq('init', '${metaPixelId}'); fbq('track', 'PageView');`}
        </Script>
      )}
    </>
  );
}
