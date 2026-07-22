import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import AuditForm from "@/components/AuditForm";
import ValueStack from "@/components/ValueStack";

export const metadata: Metadata = {
  title: "Free Audit",
  description:
    "Get a free 24h audit of your website, booking flow, and online client acquisition. No commitment, no pitch call — just a personalised report of what's costing you clients.",
  alternates: {
    canonical: "https://servolia.com/free-audit",
    languages: {
      "en-US": "https://servolia.com/free-audit",
      "fr-FR": "https://servolia.com/fr/audit",
      "x-default": "https://servolia.com/free-audit",
    },
  },
};

export default function FreeAuditPage() {
  return (
    <>
      <Navbar />
      <main>
        <AuditForm lang="en" />
      </main>
      <ValueStack />
      <Footer />
    </>
  );
}
