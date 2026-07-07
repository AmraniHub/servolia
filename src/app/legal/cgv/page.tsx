import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms & Conditions (CGV) — Servolia",
  description: "Servolia general terms and conditions of sale (CGV).",
};

export default function CGVPage() {
  return (
    <main className="flex flex-col bg-white">
      <Navbar />
      <section className="bg-[#FAFAF7] pt-28 pb-12">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-sm font-bold text-[#36671E] uppercase tracking-widest mb-3">Legal</p>
          <h1 className="text-4xl font-black text-[#18181B]">Terms & Conditions</h1>
          <p className="text-[#52525B] mt-2">Conditions Générales de Vente (CGV) — Last updated: June 2025</p>
        </div>
      </section>
      <section className="py-14 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="space-y-8 text-[#374151] text-sm leading-relaxed">
            <div>
              <h2 className="text-lg font-black text-[#080E1C] mb-3">1. Service provider</h2>
              <p>Servolia is a digital services studio providing web design, AI systems, and business automation services. Services are provided under written agreement confirmed by email. Contact: hello@servolia.com</p>
            </div>
            <div>
              <h2 className="text-lg font-black text-[#080E1C] mb-3">2. Orders and acceptance</h2>
              <p>An order is confirmed when: (a) the client has approved the written proposal sent by Servolia, and (b) the deposit payment has been received via Stripe. Work begins only after deposit confirmation.</p>
            </div>
            <div>
              <h2 className="text-lg font-black text-[#080E1C] mb-3">3. Pricing and payment</h2>
              <p>All prices are in EUR (or USD for US clients) and exclude VAT unless stated otherwise. Payment terms: 50% deposit upon order confirmation, 50% balance due on delivery day. Payments are processed securely via Stripe. Monthly retainers are billed automatically on the first of each month.</p>
            </div>
            <div>
              <h2 className="text-lg font-black text-[#080E1C] mb-3">4. Delivery</h2>
              <p>Servolia commits to delivering the agreed scope within the stated delivery window (3–7 business days depending on plan). The delivery window begins from the day the deposit is received and the client intake form is completed. If Servolia misses the agreed deadline through its own fault, the client is entitled to a 10% refund per day of delay, up to a maximum of 50%.</p>
            </div>
            <div>
              <h2 className="text-lg font-black text-[#080E1C] mb-3">5. Revisions</h2>
              <p>Each plan includes a defined number of revision rounds (Starter: 2 rounds, Growth: 3 rounds, Pro: unlimited first month). A revision round is defined as a consolidated list of changes submitted in one document. Additional revision rounds beyond the included amount are billed at €75/hour.</p>
            </div>
            <div>
              <h2 className="text-lg font-black text-[#080E1C] mb-3">6. Client responsibilities</h2>
              <p>The client is responsible for: providing accurate business information, reviewing and approving deliverables within 5 business days of delivery, and providing any specific content or images they wish to use. Delays caused by the client do not extend Servolia's delivery guarantee.</p>
            </div>
            <div>
              <h2 className="text-lg font-black text-[#080E1C] mb-3">7. Intellectual property</h2>
              <p>Upon receipt of full payment, the client receives full ownership of all website files, designs, and content created by Servolia. Servolia retains the right to display the project in its portfolio unless otherwise agreed in writing.</p>
            </div>
            <div>
              <h2 className="text-lg font-black text-[#080E1C] mb-3">8. Refunds</h2>
              <p>The 50% deposit is non-refundable after work has begun. If Servolia fails to deliver the agreed scope, the client is entitled to a full refund. Monthly retainer fees are refundable for the current month if cancellation is requested within 5 days of billing. No partial refunds after the 5-day window.</p>
            </div>
            <div>
              <h2 className="text-lg font-black text-[#080E1C] mb-3">9. Retainer cancellation</h2>
              <p>Monthly retainers can be cancelled at any time by emailing hello@servolia.com with 30 days notice. No penalty for cancellation. The client retains all assets built during the retainer period.</p>
            </div>
            <div>
              <h2 className="text-lg font-black text-[#080E1C] mb-3">10. Limitation of liability</h2>
              <p>Servolia is not liable for results (leads, revenue, bookings) as these depend on market conditions outside our control. We guarantee delivery of the agreed technical scope. Our maximum liability in all cases is limited to the amount paid by the client for the specific service in question.</p>
            </div>
            <div>
              <h2 className="text-lg font-black text-[#080E1C] mb-3">11. Governing law</h2>
              <p>These terms are governed by French law. Any disputes shall first be attempted through good-faith negotiation. If unresolved, disputes shall be submitted to the competent courts of France.</p>
            </div>
            <div>
              <h2 className="text-lg font-black text-[#080E1C] mb-3">12. Contact</h2>
              <p>For questions about these terms: <a href="mailto:hello@servolia.com" className="text-[#36671E]">hello@servolia.com</a></p>
            </div>
          </div>
        </div>
      </section>
      <Footer />
    </main>
  );
}
