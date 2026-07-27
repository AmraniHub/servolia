import type { Metadata } from "next";
import FrenchNav from "@/components/FrenchNav";
import FrenchFooter from "@/components/FrenchFooter";
import BookingWidget from "@/components/BookingWidget";
import ValueStack from "@/components/ValueStack";
import Guarantee from "@/components/Guarantee";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Réserver un appel — Servolia",
  description: "Réservez un appel découverte gratuit de 30 minutes. Nous vous montrons exactement combien de demandes votre cabinet perd — et comment les récupérer.",
  alternates: {
    canonical: "https://servolia.com/fr/appel",
    languages: {
      "en-US": "https://servolia.com/call",
      "fr-FR": "https://servolia.com/fr/appel",
      "x-default": "https://servolia.com/call",
    },
  },
};

export default function AppelPage() {
  return (
    <main className="min-h-screen bg-[#FAFAF7]">
      <FrenchNav enHref="/call" />
      <BookingWidget lang="fr" />
      <ValueStack lang="fr" />
      <Guarantee lang="fr" />
      <FrenchFooter />
    </main>
  );
}
