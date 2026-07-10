"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";

const links = [
  { label: "Solutions", href: "/solutions" },
  { label: "How it works", href: "/how-it-works" },
  { label: "Case Studies", href: "/case-studies" },
  { label: "Pricing", href: "/pricing" },
  { label: "Insights", href: "/blog" },
  { label: "About", href: "/about" },
];

export default function Navbar({ heroDark = false }: { heroDark?: boolean }) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!heroDark) return; // no dark hero under the nav — chrome never needs to change
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, [heroDark]);

  // True once the nav should render its light-page chrome (dark text, cream bg):
  // always true on pages that don't open on a dark hero, otherwise only after scrolling past it.
  const light = !heroDark || scrolled;

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        light
          ? "bg-[#FAFAF7]/85 backdrop-blur-xl border-b border-[#E8E6E0]"
          : "bg-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 lg:h-18">
          {/* Wordmark — text only, no icon. Color flips for readability over
              a dark hero (heroDark, unscrolled) vs a light page (default/scrolled). */}
          <Link href="/" className="flex items-center group">
            <span className={`text-xl font-black tracking-tight transition-colors ${
              light ? "text-[#18181B]" : "text-[#FAFAF7]"
            }`}>
              Serv<span className={light ? "gradient-text" : "text-[#BEF264]"}>olia</span>
            </span>
          </Link>

          {/* Desktop links */}
          <div className="hidden md:flex items-center gap-7">
            {links.map((l) => (
              <Link
                key={l.label}
                href={l.href}
                className={`text-sm font-medium transition-colors ${
                  light ? "text-[#52525B] hover:text-[#18181B]" : "text-[#FAFAF7]/70 hover:text-[#FAFAF7]"
                }`}
              >
                {l.label}
              </Link>
            ))}
          </div>

          {/* Desktop CTA */}
          <div className="hidden md:flex items-center gap-3">
            <Link
              href="/fr"
              className={`text-xs font-bold transition-colors border rounded-lg px-2.5 py-1.5 ${
                light
                  ? "text-[#52525B] hover:text-[#36671E] border-[#E8E6E0]"
                  : "text-[#FAFAF7]/80 hover:text-[#FAFAF7] border-[#FAFAF7]/20"
              }`}
              aria-label="Version française"
            >
              FR
            </Link>
            <Link
              href="/contact"
              className={`text-sm font-medium transition-colors ${
                light ? "text-[#52525B] hover:text-[#18181B]" : "text-[#FAFAF7]/70 hover:text-[#FAFAF7]"
              }`}
            >
              Contact
            </Link>
            <Link
              href="/free-audit"
              className="px-4 py-2 rounded-lg bg-[#36671E] text-[#FAFAF7] text-sm font-semibold hover:bg-[#295115] transition-colors shadow-soft"
            >
              Book Free Audit →
            </Link>
          </div>

          {/* Mobile toggle */}
          <button
            className={`md:hidden p-2 transition-colors ${light ? "text-[#18181B]" : "text-[#FAFAF7]"}`}
            onClick={() => setOpen(!open)}
            aria-label="Toggle menu"
          >
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden bg-[#FAFAF7]/95 backdrop-blur-xl border-t border-[#E8E6E0] px-4 py-4 flex flex-col gap-3">
          {links.map((l) => (
            <Link
              key={l.label}
              href={l.href}
              onClick={() => setOpen(false)}
              className="text-sm font-medium text-[#52525B] hover:text-[#18181B] transition-colors py-2"
            >
              {l.label}
            </Link>
          ))}
          <Link
            href="/free-audit"
            onClick={() => setOpen(false)}
            className="mt-2 px-4 py-3 rounded-lg bg-[#36671E] text-[#FAFAF7] text-sm font-semibold text-center"
          >
            Book Free Audit →
          </Link>
        </div>
      )}
    </nav>
  );
}
