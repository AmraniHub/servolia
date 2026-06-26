import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { ArrowRight } from "lucide-react";

export default function NotFound() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-[#080E1C] flex flex-col items-center justify-center px-4 text-center">
        <p className="text-[#95BF47] font-bold text-sm uppercase tracking-widest mb-4">404 — Not Found</p>
        <h1 className="text-5xl sm:text-6xl font-black text-white mb-4">Page not found.</h1>
        <p className="text-[#94A3B8] text-lg max-w-md mb-10">
          The page you&apos;re looking for doesn&apos;t exist or has moved.
        </p>
        <div className="flex flex-col sm:flex-row gap-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-[#95BF47] to-[#6BA52A] text-[#0B1800] font-bold hover:opacity-90 transition-opacity"
          >
            Back to home <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/contact"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-white/20 text-white font-semibold hover:bg-white/5 transition-colors"
          >
            Contact us
          </Link>
        </div>
      </main>
      <Footer />
    </>
  );
}
