import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import OnboardingForm from "@/components/OnboardingForm";

// Post-payment page — reached only from Stripe success / the portal, never from search.
export const metadata: Metadata = {
  title: "Client intake — Servolia",
  robots: { index: false, follow: false },
};

export default function OnboardingPage() {
  return (
    <>
      <Navbar />
      <OnboardingForm lang="en" />
      <Footer />
    </>
  );
}
