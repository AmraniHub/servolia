import Link from "next/link";
import { Mail, MapPin } from "lucide-react";
import Logomark from "@/components/Logomark";

const services = [
  { label: "AI Websites", href: "/solutions/ai-websites" },
  { label: "AI Receptionist", href: "/solutions/ai-receptionist" },
  { label: "Booking Systems", href: "/solutions/booking-systems" },
  { label: "CRM Dashboards", href: "/solutions/crm-dashboards" },
  { label: "All Solutions", href: "/solutions" },
];

const niches = [
  { label: "Dental Clinics", href: "/dentists" },
  { label: "Aesthetic Clinics", href: "/niches/aesthetic-clinics" },
  { label: "Real Estate Agents", href: "/niches/real-estate" },
  { label: "Home Services", href: "/niches/home-services" },
  { label: "Law Firms", href: "/niches/lawyers" },
  { label: "Accountants", href: "/niches/accountants" },
  { label: "Consultants", href: "/niches/consultants" },
];

const company = [
  { label: "How it Works", href: "/how-it-works" },
  { label: "Case Studies", href: "/case-studies" },
  { label: "Insights", href: "/blog" },
  { label: "Pricing", href: "/pricing" },
  { label: "Free Audit", href: "/free-audit" },
  { label: "Client Portal", href: "/portal" },
  { label: "Client Billing", href: "/billing" },
];

const legal = [
  { label: "Privacy Policy", href: "/legal/privacy" },
  { label: "Terms of Use", href: "/legal/terms" },
  { label: "Return & Refund", href: "/legal/refund" },
  { label: "Cookie Policy", href: "/legal/privacy#cookies" },
];

export default function Footer() {
  return (
    <footer className="bg-[#FAFAF7] border-t border-[#E8E6E0]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10 mb-12">
          {/* Brand */}
          <div className="lg:col-span-1">
            <Link href="/" className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#36671E] to-[#295115] flex items-center justify-center">
                <Logomark className="w-4 h-4 text-[#BEF264]" />
              </div>
              <span className="text-xl font-black tracking-tight text-[#18181B]">
                Serv<span className="gradient-text">olia</span>
              </span>
            </Link>
            <p className="text-[#52525B] text-sm leading-relaxed mb-5">
              AI websites and lead systems for service businesses in Europe and
              the US. Fixed price. 7-day delivery.
            </p>
            <div className="flex flex-col gap-2">
              <a
                href="mailto:hello@servolia.com"
                className="flex items-center gap-2 text-[#52525B] hover:text-[#18181B] text-sm transition-colors"
              >
                <Mail className="w-3.5 h-3.5" />
                hello@servolia.com
              </a>
              <div className="flex items-center gap-2 text-[#52525B] text-sm">
                <MapPin className="w-3.5 h-3.5" />
                France · Belgium · Switzerland · US
              </div>
            </div>
          </div>

          {/* Services */}
          <div>
            <h4 className="text-[#18181B] font-bold text-sm mb-4">Services</h4>
            <ul className="flex flex-col gap-2.5">
              {services.map((s) => (
                <li key={s.label}>
                  <Link
                    href={s.href}
                    className="text-[#52525B] hover:text-[#18181B] text-sm transition-colors"
                  >
                    {s.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="text-[#18181B] font-bold text-sm mb-4">Company</h4>
            <ul className="flex flex-col gap-2.5">
              {company.map((c) => (
                <li key={c.label}>
                  <Link href={c.href} className="text-[#52525B] hover:text-[#18181B] text-sm transition-colors">
                    {c.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Niches */}
          <div>
            <h4 className="text-[#18181B] font-bold text-sm mb-4">Industries</h4>
            <ul className="flex flex-col gap-2.5">
              {niches.map((n) => (
                <li key={n.label}>
                  <Link
                    href={n.href}
                    className="text-[#52525B] hover:text-[#18181B] text-sm transition-colors"
                  >
                    {n.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal + CTA */}
          <div>
            <h4 className="text-[#18181B] font-bold text-sm mb-4">Legal</h4>
            <ul className="flex flex-col gap-2.5 mb-6">
              {legal.map((l) => (
                <li key={l.label}>
                  <Link
                    href={l.href}
                    className="text-[#52525B] hover:text-[#18181B] text-sm transition-colors"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
            <div className="p-3 rounded-xl border border-[#36671E]/20 bg-[#EEF5EA]/40">
              <p className="text-xs text-[#52525B] mb-2">Ready to get started?</p>
              <Link
                href="/free-audit"
                className="block text-center px-3 py-2 rounded-lg bg-gradient-to-r from-[#36671E] to-[#295115] text-[#FAFAF7] text-xs font-bold hover:opacity-90 transition-opacity"
              >
                Get Free Audit →
              </Link>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-[#E8E6E0] pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-[#A1A1AA] text-xs">
            © {new Date().getFullYear()} Servolia LLC. All rights reserved.
          </p>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-4 rounded bg-[#635bff] flex items-center justify-center">
                <span className="text-[#18181B] text-[8px] font-black">S</span>
              </div>
              <span className="text-[#A1A1AA] text-xs">Stripe Secured</span>
            </div>
            <div className="w-px h-4 bg-[#F0EFEA]" />
            <span className="text-[#A1A1AA] text-xs">GDPR Compliant</span>
            <div className="w-px h-4 bg-[#F0EFEA]" />
            <span className="text-[#A1A1AA] text-xs">🇫🇷 🇧🇪 🇨🇭 🇺🇸</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
