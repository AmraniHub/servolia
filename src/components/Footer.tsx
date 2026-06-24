import Link from "next/link";
import { Zap, Mail, MapPin } from "lucide-react";

const services = [
  { label: "AI Website", href: "/#services" },
  { label: "AI Receptionist", href: "/#services" },
  { label: "Landing Page + Ads", href: "/#services" },
  { label: "Business Dashboard", href: "/#services" },
];

const niches = [
  { label: "Dental Clinics", href: "/dentists" },
  { label: "Aesthetic Clinics", href: "/clinics" },
  { label: "Real Estate", href: "/real-estate" },
  { label: "Home Services", href: "/home-services" },
];

const legal = [
  { label: "Privacy Policy", href: "/legal/privacy" },
  { label: "Terms & CGV", href: "/legal/cgv" },
  { label: "Cookie Policy", href: "/legal/privacy#cookies" },
];

export default function Footer() {
  return (
    <footer className="bg-[#080E1C] border-t border-white/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 mb-12">
          {/* Brand */}
          <div className="lg:col-span-1">
            <Link href="/" className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#4F7EF7] to-[#818CF8] flex items-center justify-center">
                <Zap className="w-4 h-4 text-white fill-white" />
              </div>
              <span className="text-xl font-black tracking-tight text-white">
                Serv<span className="gradient-text">olia</span>
              </span>
            </Link>
            <p className="text-[#94A3B8] text-sm leading-relaxed mb-5">
              AI websites and lead systems for service businesses in Europe and
              the US. Fixed price. 7-day delivery.
            </p>
            <div className="flex flex-col gap-2">
              <a
                href="mailto:hello@servolia.com"
                className="flex items-center gap-2 text-[#94A3B8] hover:text-white text-sm transition-colors"
              >
                <Mail className="w-3.5 h-3.5" />
                hello@servolia.com
              </a>
              <div className="flex items-center gap-2 text-[#94A3B8] text-sm">
                <MapPin className="w-3.5 h-3.5" />
                France · Belgium · Switzerland · US
              </div>
            </div>
          </div>

          {/* Services */}
          <div>
            <h4 className="text-white font-bold text-sm mb-4">Services</h4>
            <ul className="flex flex-col gap-2.5">
              {services.map((s) => (
                <li key={s.label}>
                  <Link
                    href={s.href}
                    className="text-[#94A3B8] hover:text-white text-sm transition-colors"
                  >
                    {s.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Niches */}
          <div>
            <h4 className="text-white font-bold text-sm mb-4">Industries</h4>
            <ul className="flex flex-col gap-2.5">
              {niches.map((n) => (
                <li key={n.label}>
                  <Link
                    href={n.href}
                    className="text-[#94A3B8] hover:text-white text-sm transition-colors"
                  >
                    {n.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal + CTA */}
          <div>
            <h4 className="text-white font-bold text-sm mb-4">Legal</h4>
            <ul className="flex flex-col gap-2.5 mb-6">
              {legal.map((l) => (
                <li key={l.label}>
                  <Link
                    href={l.href}
                    className="text-[#94A3B8] hover:text-white text-sm transition-colors"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
            <div className="p-3 rounded-xl border border-[#4F7EF7]/20 bg-[#4F7EF7]/5">
              <p className="text-xs text-[#94A3B8] mb-2">Ready to get started?</p>
              <Link
                href="/contact"
                className="block text-center px-3 py-2 rounded-lg bg-gradient-to-r from-[#4F7EF7] to-[#818CF8] text-white text-xs font-bold hover:opacity-90 transition-opacity"
              >
                Get Free Audit →
              </Link>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-white/5 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-[#475569] text-xs">
            © {new Date().getFullYear()} Servolia. All rights reserved.
          </p>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-4 rounded bg-[#635bff] flex items-center justify-center">
                <span className="text-white text-[8px] font-black">S</span>
              </div>
              <span className="text-[#475569] text-xs">Stripe Secured</span>
            </div>
            <div className="w-px h-4 bg-white/10" />
            <span className="text-[#475569] text-xs">GDPR Compliant</span>
            <div className="w-px h-4 bg-white/10" />
            <span className="text-[#475569] text-xs">🇫🇷 🇧🇪 🇨🇭 🇺🇸</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
