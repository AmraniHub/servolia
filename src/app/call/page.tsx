import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import BookingWidget from "@/components/BookingWidget";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Book a call — Servolia",
  description: "Book a free 30-minute discovery call. We'll show you exactly how many patient enquiries your clinic is losing — and how to recover them.",
  alternates: { canonical: "https://servolia.com/call" },
};

export default function CallPage() {
  return (
    <main className="min-h-screen bg-[#FAFAF7]">
      <Navbar />
      <BookingWidget />
      <Footer />
    </main>
  );
}
