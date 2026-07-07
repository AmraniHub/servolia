/**
 * JSON-LD structured data — earns rich Google snippets:
 *   - Organization: shows logo + sitelinks
 *   - WebSite: enables sitelinks search box
 *   - Service: shows in Google's services directory
 *   - FAQPage: shows expandable FAQ in SERPs
 */

const BASE = "https://servolia.com";

export function OrgSchema() {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "Servolia",
          legalName: "Servolia LLC",
          url: BASE,
          logo: `${BASE}/logo-icon.png`,
          image: [`${BASE}/opengraph-image`, `${BASE}/logo.png`],
          description: "AI client acquisition systems for service businesses — dental clinics, aesthetic clinics, real estate agents, and home services. Fixed price, 7-day delivery.",
          areaServed: ["FR", "BE", "CH", "MC", "DE", "IT", "ES", "GB", "US", "CA"],
          email: "hello@servolia.com",
          contactPoint: {
            "@type": "ContactPoint",
            email: "hello@servolia.com",
            contactType: "sales",
            availableLanguage: ["English", "French"],
          },
          sameAs: [
            "https://www.linkedin.com/company/135674351/",
            "https://www.instagram.com/servolia_ai/",
            "https://web.facebook.com/ServoliaB2B/",
          ],
        }),
      }}
    />
  );
}

export function WebSiteSchema() {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "Servolia",
          url: BASE,
          potentialAction: {
            "@type": "SearchAction",
            target: `${BASE}/?q={search_term_string}`,
            "query-input": "required name=search_term_string",
          },
        }),
      }}
    />
  );
}

export function ServiceSchema({ name, description, price }: { name: string; description: string; price: string }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Service",
          serviceType: name,
          provider: { "@type": "Organization", name: "Servolia", url: BASE },
          description,
          offers: { "@type": "Offer", price, priceCurrency: "EUR" },
          areaServed: ["FR", "BE", "CH", "MC", "DE", "IT", "ES", "GB", "US"],
        }),
      }}
    />
  );
}

export function FaqSchema({ faqs }: { faqs: { q: string; a: string }[] }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: faqs.map(f => ({
            "@type": "Question",
            name: f.q,
            acceptedAnswer: { "@type": "Answer", text: f.a },
          })),
        }),
      }}
    />
  );
}

export function BreadcrumbSchema({ items }: { items: { name: string; url: string }[] }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: items.map((item, i) => ({
            "@type": "ListItem",
            position: i + 1,
            name: item.name,
            item: item.url.startsWith("http") ? item.url : `${BASE}${item.url}`,
          })),
        }),
      }}
    />
  );
}
