import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";

export const metadata: Metadata = {
  title: "Thank you",
  robots: { index: false, follow: false },
};

export default function HostingThanks() {
  return (
    <main className="min-h-screen bg-[#FAFAFA] px-5 py-24">
      <div className="max-w-md mx-auto text-center">
        <CheckCircle2 className="w-14 h-14 text-[#16A34A] mx-auto mb-5" />
        <h1 className="text-2xl font-black text-[#18181B] mb-3">You&apos;re all set</h1>
        <p className="text-[#52525B] leading-relaxed mb-8">
          Your hosting is active and your receipt is on its way by email. Nothing
          else to do — your site keeps running exactly as it is.
        </p>
        <Link
          href="/"
          className="inline-flex items-center justify-center h-11 px-6 rounded-xl bg-[#18181B] text-white font-bold hover:bg-[#27272A]"
        >
          Back to Servolia
        </Link>
      </div>
    </main>
  );
}
