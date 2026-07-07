import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Use — Servolia",
  description: "Terms of use governing access to and use of the Servolia website and services.",
};

export default function TermsOfUsePage() {
  return (
    <main className="flex flex-col bg-white">
      <Navbar />
      <section className="bg-[#FAFAF7] pt-28 pb-12">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-sm font-bold text-[#36671E] uppercase tracking-widest mb-3">Legal</p>
          <h1 className="text-4xl font-black text-[#18181B]">Terms of Use</h1>
          <p className="text-[#52525B] mt-2">Servolia LLC — Last updated: July 2026</p>
        </div>
      </section>
      <section className="py-14 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="space-y-8 text-[#374151] text-sm leading-relaxed">
            <div>
              <h2 className="text-lg font-black text-[#080E1C] mb-3">1. Acceptance of these terms</h2>
              <p>These Terms of Use govern your access to and use of servolia.com (the &quot;Site&quot;) and any services described on it, operated by <strong>Servolia LLC</strong> (&quot;Servolia&quot;, &quot;we&quot;, &quot;us&quot;). By using the Site, you agree to these terms. If you don&apos;t agree, please don&apos;t use the Site.</p>
            </div>
            <div>
              <h2 className="text-lg font-black text-[#080E1C] mb-3">2. Use of the Site</h2>
              <p>You may browse the Site and submit inquiries for lawful business purposes only. You agree not to: scrape or copy Site content for commercial reuse, attempt to disrupt or reverse-engineer the Site or chatbot, or submit false information through our forms.</p>
            </div>
            <div>
              <h2 className="text-lg font-black text-[#080E1C] mb-3">3. Services and purchases</h2>
              <p>Servolia provides AI-powered websites, receptionist chatbots, booking systems, and CRM dashboards for service businesses, delivered under a written scope and fixed price. Purchases, delivery timelines, revisions, and payment terms are governed by our <Link href="/legal/cgv" className="text-[#36671E] underline">Terms &amp; Conditions of Sale (CGV)</Link>, which forms part of any paid engagement. Refund eligibility is set out in our <Link href="/legal/refund" className="text-[#36671E] underline">Return &amp; Refund Policy</Link>.</p>
            </div>
            <div>
              <h2 className="text-lg font-black text-[#080E1C] mb-3">4. Intellectual property</h2>
              <p>The Site&apos;s design, copy, and branding are the property of Servolia LLC and may not be copied or reused without permission. Ownership of deliverables built for a paying client transfers to that client upon full payment, as detailed in the CGV.</p>
            </div>
            <div>
              <h2 className="text-lg font-black text-[#080E1C] mb-3">5. No guarantee of results</h2>
              <p>Servolia builds and delivers the agreed technical scope (website, chatbot, booking flow, CRM, etc.). We do not guarantee specific business outcomes — leads, bookings, or revenue — as these depend on factors outside our control, including your market, offer, and how the system is used.</p>
            </div>
            <div>
              <h2 className="text-lg font-black text-[#080E1C] mb-3">6. Third-party links and tools</h2>
              <p>The Site may link to or embed third-party tools (Stripe, WhatsApp, Google Analytics, Meta Pixel). Your use of those tools is subject to their own terms and privacy policies.</p>
            </div>
            <div>
              <h2 className="text-lg font-black text-[#080E1C] mb-3">7. Limitation of liability</h2>
              <p>The Site and its content are provided &quot;as is.&quot; To the extent permitted by law, Servolia LLC is not liable for indirect or consequential damages arising from use of the Site. For paid services, liability is limited as described in the CGV.</p>
            </div>
            <div>
              <h2 className="text-lg font-black text-[#080E1C] mb-3">8. Changes to these terms</h2>
              <p>We may update these Terms of Use from time to time. The &quot;Last updated&quot; date above reflects the most recent revision. Continued use of the Site after changes means you accept the updated terms.</p>
            </div>
            <div>
              <h2 className="text-lg font-black text-[#080E1C] mb-3">9. Contact</h2>
              <p>Questions about these terms: <a href="mailto:hello@servolia.com" className="text-[#36671E]">hello@servolia.com</a></p>
            </div>
          </div>
        </div>
      </section>
      <Footer />
    </main>
  );
}
