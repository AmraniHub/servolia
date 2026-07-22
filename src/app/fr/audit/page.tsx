import type { Metadata } from "next";
import Link from "next/link";
import AuditForm from "@/components/AuditForm";
import ValueStack from "@/components/ValueStack";

export const metadata: Metadata = {
  title: "Audit gratuit — Servolia",
  description:
    "Recevez sous 24h un audit gratuit de votre site, de votre parcours de réservation et de votre acquisition de clients. Sans engagement, sans appel commercial.",
  alternates: {
    canonical: "https://servolia.com/fr/audit",
    languages: {
      "en-US": "https://servolia.com/free-audit",
      "fr-FR": "https://servolia.com/fr/audit",
      "x-default": "https://servolia.com/free-audit",
    },
  },
};

export default function FrenchAuditPage() {
  return (
    <main className="bg-[#FAFAF7] min-h-screen">
      {/* Minimal French header — lead page, keep distractions low */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#FAFAF7]/85 backdrop-blur-xl border-b border-[#E8E6E0]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <Link href="/fr" className="flex items-center">
            <span className="text-xl font-black tracking-tight text-[#18181B]">
              Serv<span className="gradient-text">olia</span>
            </span>
          </Link>
          <Link href="/fr" className="text-sm font-medium text-[#52525B] hover:text-[#18181B] transition-colors">
            ← Retour à l&apos;accueil
          </Link>
        </div>
      </nav>

      <AuditForm lang="fr" />

      <ValueStack lang="fr" />
      <footer className="bg-[#FAFAF7] border-t border-[#E8E6E0] py-8 text-center text-xs text-[#71717A]">
        © {new Date().getFullYear()} Servolia ·{" "}
        <a href="mailto:hello@servolia.com" className="hover:text-[#36671E]">hello@servolia.com</a> ·{" "}
        <Link href="/legal/privacy" className="hover:text-[#36671E]">Confidentialité</Link>
      </footer>
    </main>
  );
}
