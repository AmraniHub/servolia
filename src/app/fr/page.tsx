import type { Metadata } from "next";
import FrenchHome from "@/components/FrenchHome";

export const metadata: Metadata = {
  title: "Servolia — Systèmes d'acquisition client par IA pour entreprises de services",
  description:
    "Servolia crée des sites web IA, des réceptionnistes IA, des systèmes de réservation et des tunnels de leads pour les entreprises de services en Europe. Prix fixe. Livré en 7 jours.",
  alternates: {
    canonical: "https://servolia.com/fr",
    languages: {
      "en-US": "https://servolia.com",
      "fr-FR": "https://servolia.com/fr",
      "x-default": "https://servolia.com",
    },
  },
  openGraph: {
    title: "Servolia — Systèmes d'acquisition client par IA",
    description: "Sites IA, réceptionnistes IA et systèmes de réservation pour entreprises de services. Prix fixe, livré en 7 jours.",
    url: "https://servolia.com/fr",
    locale: "fr_FR",
    type: "website",
  },
};

export default function FrenchHomePage() {
  return <FrenchHome />;
}
