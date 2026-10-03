import type { Metadata } from "next";

/* The page is a client component; its canonical + hreflang pair lives here. */
export const metadata: Metadata = {
  alternates: {
    canonical: "https://servolia.com/contact",
    languages: {
      "en-US": "https://servolia.com/contact",
      "fr-FR": "https://servolia.com/fr/contact",
      "x-default": "https://servolia.com/contact",
    },
  },
};

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return children;
}
