import type { Metadata } from "next";
import FrenchNav from "@/components/FrenchNav";
import FrenchFooter from "@/components/FrenchFooter";
import OnboardingForm from "@/components/OnboardingForm";

// Page post-paiement — accessible depuis Stripe / l'espace client uniquement.
export const metadata: Metadata = {
  title: "Brief client — Servolia",
  robots: { index: false, follow: false },
};

export default function DemarragePage() {
  return (
    <>
      <FrenchNav enHref="/onboarding" />
      <OnboardingForm lang="fr" />
      <FrenchFooter />
    </>
  );
}
