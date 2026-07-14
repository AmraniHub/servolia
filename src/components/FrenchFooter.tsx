import Link from "next/link";
import { Mail } from "lucide-react";
import EmailSignup from "./EmailSignup";

const systemes = [
  { label: "Toutes les solutions", href: "/fr/solutions" },
  { label: "Tarifs", href: "/fr/tarifs" },
  { label: "Comment ça marche", href: "/fr/comment-ca-marche" },
  { label: "Cas clients", href: "/fr/cas-clients" },
];

const entreprise = [
  { label: "À propos", href: "/fr/a-propos" },
  { label: "Audit gratuit", href: "/fr/audit" },
  { label: "Contact", href: "/fr/contact" },
  { label: "Cabinets dentaires", href: "/fr/dentistes" },
];

const legal = [
  { label: "Confidentialité", href: "/legal/privacy" },
  { label: "CGV", href: "/legal/cgv" },
  { label: "Conditions d'utilisation", href: "/legal/terms" },
  { label: "Remboursement", href: "/legal/refund" },
];

export default function FrenchFooter() {
  return (
    <footer className="bg-[#FAFAF7] border-t border-[#E8E6E0]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10 mb-10">
          <div className="col-span-2 md:col-span-1">
            <Link href="/fr" className="flex items-center mb-4">
              <span className="text-xl font-black tracking-tight text-[#18181B]">
                Serv<span className="gradient-text">olia</span>
              </span>
            </Link>
            <p className="text-[#52525B] text-sm leading-relaxed mb-4">
              Systèmes d&apos;acquisition client par IA pour les entreprises de services — France, Belgique, Suisse.
            </p>
            <a href="mailto:hello@servolia.com" className="flex items-center gap-2 text-sm text-[#52525B] hover:text-[#36671E] transition-colors">
              <Mail className="w-4 h-4" /> hello@servolia.com
            </a>
            <div className="mt-5">
              <EmailSignup source="footer" language="fr" />
            </div>
          </div>

          <div>
            <p className="text-xs font-black text-[#18181B] uppercase tracking-widest mb-4">Systèmes</p>
            <ul className="space-y-2.5">
              {systemes.map((l) => (
                <li key={l.href}><Link href={l.href} className="text-sm text-[#52525B] hover:text-[#36671E] transition-colors">{l.label}</Link></li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-xs font-black text-[#18181B] uppercase tracking-widest mb-4">Entreprise</p>
            <ul className="space-y-2.5">
              {entreprise.map((l) => (
                <li key={l.href}><Link href={l.href} className="text-sm text-[#52525B] hover:text-[#36671E] transition-colors">{l.label}</Link></li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-xs font-black text-[#18181B] uppercase tracking-widest mb-4">Légal</p>
            <ul className="space-y-2.5">
              {legal.map((l) => (
                <li key={l.href}><Link href={l.href} className="text-sm text-[#52525B] hover:text-[#36671E] transition-colors">{l.label}</Link></li>
              ))}
            </ul>
          </div>
        </div>

        <div className="pt-8 border-t border-[#E8E6E0] flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-[#A1A1AA]">© {new Date().getFullYear()} Servolia. Tous droits réservés.</p>
          <Link href="/" className="text-xs font-bold text-[#52525B] hover:text-[#36671E] transition-colors">
            English version →
          </Link>
        </div>
      </div>
    </footer>
  );
}
