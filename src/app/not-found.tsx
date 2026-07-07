import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { ArrowRight } from "lucide-react";

export default function NotFound() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-[#FAFAF7] flex flex-col items-center justify-center px-4 text-center">
        <p className="text-[#36671E] font-bold text-sm uppercase tracking-widest mb-4">404 — Not Found</p>
        <h1 className="text-5xl sm:text-6xl font-black text-[#18181B] mb-4">Page not found.</h1>
        <p className="text-[#52525B] text-lg max-w-md mb-10">
          The page you&apos;re looking for doesn&apos;t exist or has moved.
        </p>
        <div className="flex flex-col sm:flex-row gap-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-[#36671E] to-[#295115] text-[#FAFAF7] font-bold hover:opacity-90 transition-opacity"
          >
            Back to home <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/contact"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-[#A1A1AA] text-[#18181B] font-semibold hover:bg-[#F5F4EF] transition-colors"
          >
            Contact us
          </Link>
        </div>
      </main>
      <Footer />
    </>
  );
}
