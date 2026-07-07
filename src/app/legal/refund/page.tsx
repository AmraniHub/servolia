import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Return & Refund Policy — Servolia",
  description: "Servolia's refund policy — including our 10% per day late-delivery guarantee.",
};

export default function RefundPolicyPage() {
  return (
    <main className="flex flex-col bg-white">
      <Navbar />
      <section className="bg-[#FAFAF7] pt-28 pb-12">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-sm font-bold text-[#36671E] uppercase tracking-widest mb-3">Legal</p>
          <h1 className="text-4xl font-black text-[#18181B]">Return & Refund Policy</h1>
          <p className="text-[#52525B] mt-2">Servolia LLC — Last updated: July 2026</p>
        </div>
      </section>
      <section className="py-14 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="space-y-8 text-[#374151] text-sm leading-relaxed">
            <div>
              <h2 className="text-lg font-black text-[#080E1C] mb-3">1. Our commitment</h2>
              <p>Servolia LLC delivers digital services (websites, AI receptionists, booking systems, CRM dashboards) under a fixed scope, fixed price, and fixed delivery window. Because each project is custom-built, refunds are handled differently than for physical goods — this policy explains exactly when and how a refund applies.</p>
            </div>
            <div>
              <h2 className="text-lg font-black text-[#080E1C] mb-3">2. Late-delivery guarantee</h2>
              <p>If we miss the agreed delivery deadline through our own fault, you are entitled to a refund of <strong>10% of the project price per day of delay</strong>, up to a maximum of 50% of the total price. The delivery window begins once your deposit is received and your intake form is completed.</p>
            </div>
            <div>
              <h2 className="text-lg font-black text-[#080E1C] mb-3">3. Deposit refunds</h2>
              <p>The 50% deposit is <strong>non-refundable once work has begun</strong> — this reflects the design and development time already committed to your project. If Servolia is unable to deliver the agreed scope at all, you are entitled to a <strong>full refund</strong> of your deposit.</p>
            </div>
            <div>
              <h2 className="text-lg font-black text-[#080E1C] mb-3">4. Final payment</h2>
              <p>The remaining 50% balance is due on delivery day, after you&apos;ve reviewed and approved the deliverable. You are not charged the balance for work you haven&apos;t approved.</p>
            </div>
            <div>
              <h2 className="text-lg font-black text-[#080E1C] mb-3">5. Monthly care plans &amp; retainers</h2>
              <p>Monthly plans (hosting, support, updates) are billed automatically each month. If you cancel within <strong>5 days</strong> of that month&apos;s billing date, the charge for that month is refunded in full. After the 5-day window, that month&apos;s fee is non-refundable, but you may still cancel at any time to stop future billing — no penalty, 30 days notice by email.</p>
            </div>
            <div>
              <h2 className="text-lg font-black text-[#080E1C] mb-3">6. What&apos;s not covered</h2>
              <p>Refunds do not apply to: delays caused by the client (late feedback, missing content, unresponsive intake), custom work already approved and delivered, or dissatisfaction with business results (leads, bookings, revenue) that depend on factors outside our control.</p>
            </div>
            <div>
              <h2 className="text-lg font-black text-[#080E1C] mb-3">7. How to request a refund</h2>
              <p>Email <a href="mailto:hello@servolia.com" className="text-[#36671E]">hello@servolia.com</a> with your order details and the reason for your request. We respond within 2 business days and process approved refunds to your original payment method via Stripe within 5–10 business days.</p>
            </div>
            <div>
              <h2 className="text-lg font-black text-[#080E1C] mb-3">8. Full terms</h2>
              <p>This policy summarizes the refund terms included in our full <Link href="/legal/cgv" className="text-[#36671E] underline">Terms &amp; Conditions of Sale (CGV)</Link>, which governs all paid engagements.</p>
            </div>
            <div>
              <h2 className="text-lg font-black text-[#080E1C] mb-3">9. Contact</h2>
              <p>Questions about a refund: <a href="mailto:hello@servolia.com" className="text-[#36671E]">hello@servolia.com</a></p>
            </div>
          </div>
        </div>
      </section>
      <Footer />
    </main>
  );
}
