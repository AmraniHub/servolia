import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import AuditForm from "@/components/AuditForm";
import ValueStack from "@/components/ValueStack";
import AuditScorecard from "@/components/AuditScorecard";

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
        {/* Instant, self-serve score first — a visitor gets real value before
            being asked for anything. The form below is the human follow-up
            for anyone who wants the deeper written teardown. */}
        <section className="pt-28 pb-12 bg-[#FAFAF7]">
          <div className="px-4 sm:px-6 lg:px-8">
            <AuditScorecard lang="en" />
          </div>
        </section>
        <section className="py-4 bg-[#FAFAF7]">
          <p className="max-w-3xl mx-auto px-4 text-center text-sm text-[#71717A]">
            Want the deeper teardown — your Google listing, your competitors in the same city, and
            what we&apos;d change first? Leave your details below and we&apos;ll send it in writing.
            We never book a sales call.
          </p>
        </section>
        <AuditForm lang="en" />
      </main>
      <ValueStack />
      <Footer />
    </>
  );
}
