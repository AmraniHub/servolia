import type { Metadata } from "next";

/* The home page is a client component and cannot export metadata, so its
   canonical + hreflang pair lives in this route-group layout ("(home)" adds
   nothing to the URL). It used to sit in the ROOT layout, where every page
   without its own alternates inherited "canonical: https://servolia.com". */
export const metadata: Metadata = {
  alternates: {
    canonical: "https://servolia.com",
    languages: {
      "en-US": "https://servolia.com",
      "fr-FR": "https://servolia.com/fr",
      "x-default": "https://servolia.com",
    },
  },
};

export default function HomeLayout({ children }: { children: React.ReactNode }) {
  return children;
}
