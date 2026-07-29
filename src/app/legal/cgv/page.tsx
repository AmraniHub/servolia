import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { SETUP_PLAN, PLANS } from "@/lib/pricing";
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
          <p className="text-[#52525B] mt-2">Conditions Générales de Vente (CGV) — Last updated: July 2026</p>
        </div>
      </section>
      <section className="py-14 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="space-y-8 text-[#3F3F46] text-sm leading-relaxed">
            <div>
              <h2 className="text-lg font-black text-[#18181B] mb-3">1. Service provider</h2>
              <p>Servolia is a digital services studio providing web design, AI systems, and business automation services. Services are provided under written agreement confirmed by email. Contact: hello@servolia.com</p>
            </div>
            <div>
              <h2 className="text-lg font-black text-[#18181B] mb-3">2. Orders and acceptance</h2>
              <p>An order is confirmed when: (a) the client has approved the written scope sent by Servolia, and (b) the €{SETUP_PLAN.totalEur} installation fee has been received via Stripe — or, for a client starting on an annual plan, the first annual payment. Work begins only after that payment is confirmed.</p>
            </div>
            <div>
              <h2 className="text-lg font-black text-[#18181B] mb-3">3. Pricing and payment</h2>
              <p>All prices are in EUR (or USD for US clients) and exclude VAT unless stated otherwise. Payment terms: a one-time installation fee of €{SETUP_PLAN.totalEur}, due to start the project and waived when the client prepays a year. The monthly plan is then billed automatically each month (€{PLANS.essentiel.monthlyEur} {PLANS.essentiel.name}, €{PLANS.croissance.monthlyEur} {PLANS.croissance.name}, €{PLANS.performance.monthlyEur} {PLANS.performance.name}, depending on the tier chosen), or paid annually at ten months&apos; price for twelve months. Payments are processed securely via Stripe. Nothing further is due on delivery day.</p>
            </div>
            <div>
              <h2 className="text-lg font-black text-[#18181B] mb-3">4. Delivery</h2>
              <p>Servolia commits to delivering the agreed scope within the stated delivery window ({SETUP_PLAN.delivery} from the start of work). The delivery window begins from the day the installation fee is received and the client intake form is completed. If Servolia misses the agreed deadline through its own fault, the client is entitled to a 10% refund per day of delay, up to a maximum of 50%. Delays caused by the client do not count toward this guarantee.</p>
            </div>
            <div>
              <h2 className="text-lg font-black text-[#18181B] mb-3">4 bis. Response-time guarantee (&quot;Zero-Miss&quot;)</h2>
              <p>From the day the site goes live, Servolia guarantees that <strong>every enquiry submitted to the AI receptionist on the client&apos;s Servolia-hosted site receives a reply within 60 seconds, 24 hours a day</strong>. Response times are measured from Servolia&apos;s own server-side timestamps, which the client can consult at any time in their client portal.</p>
              <p className="mt-3">If a single enquiry in a given calendar month goes unanswered beyond 60 seconds, the client&apos;s monthly plan fee for <strong>that month is refunded in full</strong>, on request or automatically where Servolia detects the miss first. The installation fee and any add-ons are not covered by this guarantee. The remedy is limited to that month&apos;s plan fee and does not extend to consequential loss.</p>
              <p className="mt-3">The guarantee does not apply where the failure results from: an outage of the client&apos;s own domain, DNS or hosting where the client has taken over management; suspension for non-payment; a change made by the client or a third party to the site or the AI receptionist&apos;s configuration; scheduled maintenance announced at least 48 hours in advance; or force majeure, including a failure of an upstream AI provider that persists despite Servolia&apos;s fallback systems.</p>
            </div>
            <div>
              <h2 className="text-lg font-black text-[#18181B] mb-3">5. Revisions</h2>
              <p>The installation includes <strong>one round of revisions</strong> before go-live. A revision round is defined as a consolidated list of changes submitted in one document. Additional revision rounds, and any change requested after the site is live, are billed at €50/hour or quoted as a fixed price beforehand.</p>
            </div>
            <div>
              <h2 className="text-lg font-black text-[#18181B] mb-3">6. Client responsibilities</h2>
              <p>The client is responsible for: providing accurate business information, reviewing and approving deliverables within 5 business days of delivery, and providing any specific content or images they wish to use. Delays caused by the client do not extend Servolia's delivery guarantee.</p>
            </div>
            <div>
              <h2 className="text-lg font-black text-[#18181B] mb-3">7. Intellectual property</h2>
              <p>Upon receipt of full payment, the client receives full ownership of all website files, designs, and content created by Servolia. Servolia retains the right to display the project in its portfolio unless otherwise agreed in writing.</p>
            </div>
            <div>
              <h2 className="text-lg font-black text-[#18181B] mb-3">8. Refunds</h2>
              <p>The €{SETUP_PLAN.totalEur} installation fee is non-refundable after work has begun. If Servolia fails to deliver the agreed scope at all, the installation fee is refunded in full. Monthly plan fees are refundable for the current month if cancellation is requested within 5 days of that month&apos;s billing date. After the 5-day window the current month is not refundable, but future billing stops.</p>
            </div>
            <div>
              <h2 className="text-lg font-black text-[#18181B] mb-3">9. Monthly plan cancellation</h2>
              <p>Monthly plans can be cancelled at any time by emailing hello@servolia.com with 30 days notice. No penalty for cancellation. The client retains all assets built during the subscription period.</p>
            </div>
            <div>
              <h2 className="text-lg font-black text-[#18181B] mb-3">10. Limitation of liability</h2>
              <p>Servolia is not liable for results (leads, revenue, bookings) as these depend on market conditions outside our control. We guarantee delivery of the agreed technical scope. Our maximum liability in all cases is limited to the amount paid by the client for the specific service in question.</p>
            </div>
            <div>
              <h2 className="text-lg font-black text-[#18181B] mb-3">11. Governing law</h2>
              <p>These terms are governed by French law. Any disputes shall first be attempted through good-faith negotiation. If unresolved, disputes shall be submitted to the competent courts of France.</p>
            </div>
            <div>
              <h2 className="text-lg font-black text-[#18181B] mb-3">12. Contact</h2>
              <p>For questions about these terms: <a href="mailto:hello@servolia.com" className="text-[#36671E]">hello@servolia.com</a></p>
            </div>
          </div>
        </div>
      </section>
      <Footer />
    </main>
  );
}
