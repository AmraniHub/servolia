import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — Servolia",
  description:
    "How Servolia LLC handles personal data: who we are, what we collect on servolia.com and on client sites, the processors we use, international transfers, and your GDPR rights.",
  alternates: {
    canonical: "https://servolia.com/legal/privacy",
    languages: {
      "en-US": "https://servolia.com/legal/privacy",
      "fr-FR": "https://servolia.com/fr/legal/confidentialite",
      "x-default": "https://servolia.com/legal/privacy",
    },
  },
};

/**
 * Rewritten 2026-08-12. The previous version was dated June 2025 and described
 * only the marketing contact form — it never mentioned that Servolia also
 * processes the ENQUIRIES OF OUR CLIENTS' OWN CUSTOMERS (chat transcripts on
 * client sites), named only two processors out of nine, disclosed no
 * international transfer, and omitted the Meta Pixel that the Terms of Use
 * already declared. A site carrying a "GDPR Compliant" badge and selling
 * "GDPR pages included" cannot have the thinnest policy of the three.
 *
 * Two roles are separated throughout because they carry different duties:
 * CONTROLLER for servolia.com visitors and client accounts, PROCESSOR for the
 * end-customer data captured on a client's own site.
 */
export default function PrivacyPage() {
  return (
    <main className="flex flex-col bg-white">
      <Navbar />
      <section className="bg-[#FAFAF7] pt-28 pb-12">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-sm font-bold text-[#36671E] uppercase tracking-widest mb-3">Legal</p>
          <h1 className="text-4xl font-black text-[#18181B]">Privacy Policy</h1>
          <p className="text-[#52525B] mt-2">Servolia LLC — Last updated: August 2026</p>
        </div>
      </section>
      <section className="py-14 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 prose prose-slate max-w-none">
          <div className="space-y-8 text-[#3F3F46] text-sm leading-relaxed">

            <div>
              <h2 className="text-lg font-black text-[#18181B] mb-3">1. Who we are</h2>
              <p className="mb-3">
                <strong>Servolia LLC</strong> is a limited liability company registered in the State of
                Wyoming, USA, trading as Servolia (&ldquo;Servolia&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;).
                We build websites, AI receptionists, booking systems and client portals for service
                businesses in Europe and the US.
              </p>
              <p>
                For anything in this policy, or to exercise any right described in section 8, write to{" "}
                <a href="mailto:hello@servolia.com" className="text-[#36671E]">hello@servolia.com</a>.
                We answer privacy requests within 30 days.
              </p>
            </div>

            <div>
              <h2 className="text-lg font-black text-[#18181B] mb-3">2. The two roles we act in</h2>
              <p className="mb-3">
                <strong>As controller</strong> — for people who visit servolia.com, request a free audit,
                subscribe to our list, or hold a client account with us. We decide why and how that data
                is used, and this policy governs it.
              </p>
              <p className="mb-3">
                <strong>As processor</strong> — for the enquiries our clients&apos; own customers submit on
                a site we built and host for them (for example a patient messaging a dental practice&apos;s
                AI receptionist). There, <em>our client</em> is the controller and decides the purpose;
                we process on their documented instructions, under our agreement with them. If you
                contacted a business through a site we operate and want your data removed, you may
                write to us and we will act on that business&apos;s instruction, or you can contact them
                directly.
              </p>
              <p>
                Clients acting as controllers can request a written data-processing agreement from us at
                any time at <a href="mailto:hello@servolia.com" className="text-[#36671E]">hello@servolia.com</a>.
              </p>
            </div>

            <div>
              <h2 className="text-lg font-black text-[#18181B] mb-3">3. What we collect</h2>
              <p className="mb-3"><strong>On servolia.com:</strong></p>
              <ul className="list-disc pl-5 space-y-1 mb-4">
                <li>Audit and contact forms: your name, email, business name, website URL, and your message.</li>
                <li>Newsletter: your email address, if you opt in.</li>
                <li>Client accounts: your business details, billing records, the intake information you provide, and messages you exchange with us in the portal.</li>
                <li>Our own site assistant: what you type into it, so we can answer and follow up.</li>
                <li>Analytics and advertising: pages viewed, referrer, approximate location, device and browser — and, if you accept them, cookies and pixels (section 7).</li>
              </ul>
              <p className="mb-3"><strong>On a client&apos;s site that we operate (as processor):</strong></p>
              <ul className="list-disc pl-5 space-y-1 mb-4">
                <li>What a visitor writes to the AI receptionist, and the reply, with timestamps.</li>
                <li>Booking and contact submissions: name, phone, email, reason for the visit, preferred time.</li>
                <li>Page-visit statistics for that site.</li>
              </ul>
              <p>
                <strong>Please do not send sensitive details through a chat or contact form.</strong> Those
                channels are for arranging an appointment, not for describing a medical condition,
                diagnosis or treatment. We ask our clients to configure their assistants accordingly, and
                we do not ask visitors health questions. Where a visitor volunteers such information
                anyway, it is stored with the rest of that conversation and treated with the same
                protections, and it can be deleted on request.
              </p>
            </div>

            <div>
              <h2 className="text-lg font-black text-[#18181B] mb-3">4. Why we use it, and our legal basis</h2>
              <ul className="list-disc pl-5 space-y-1">
                <li><strong>To answer your enquiry and send the audit you asked for</strong> — legitimate interest in responding to someone who contacted us.</li>
                <li><strong>To deliver, host and support a service you bought</strong> — performance of our contract with you.</li>
                <li><strong>To take payment, invoice, and keep accounting records</strong> — contract, and legal obligation.</li>
                <li><strong>Marketing emails</strong> — your consent, withdrawable at any time from the link in every email.</li>
                <li><strong>Analytics and advertising cookies</strong> — your consent, given through the cookie banner and withdrawable at any time.</li>
                <li><strong>Security, fraud prevention and service reliability</strong> — legitimate interest in keeping the service safe and available.</li>
              </ul>
            </div>

            <div>
              <h2 className="text-lg font-black text-[#18181B] mb-3">5. Who processes data for us</h2>
              <p className="mb-3">
                We never sell personal data. We share it only with the providers that make the service
                run, each under its own agreement and privacy terms:
              </p>
              <ul className="list-disc pl-5 space-y-1 mb-3">
                <li><strong>Vercel</strong> — website and application hosting.</li>
                <li><strong>Supabase</strong> — the database holding enquiries, accounts and conversations.</li>
                <li><strong>Anthropic</strong> and <strong>Cloudflare</strong> — the AI models that generate assistant replies. Conversation text is sent to them to produce an answer.</li>
                <li><strong>Stripe</strong> — payments, subscriptions and invoices. Card details are entered directly with Stripe and never reach our servers.</li>
                <li><strong>Resend</strong> — transactional and marketing email delivery.</li>
                <li><strong>Telegram</strong> — internal alerts to our own team when an enquiry arrives.</li>
                <li><strong>Google Analytics 4</strong> and <strong>Google Places</strong> — site analytics, and business look-ups.</li>
                <li><strong>Meta</strong> — advertising measurement via the Meta Pixel and the Conversions API. Where we send conversion events from our server, contact details are hashed first and cannot be read back.</li>
              </ul>
              <p>
                We may also disclose data where the law requires it, or to establish or defend a legal
                claim.
              </p>
            </div>

            <div>
              <h2 className="text-lg font-black text-[#18181B] mb-3">6. International transfers</h2>
              <p>
                Servolia LLC is established in the United States, and several providers above process
                data in the United States or other countries outside the European Economic Area and the
                United Kingdom. Where data leaves the EEA or the UK, the transfer is made under the
                European Commission&apos;s Standard Contractual Clauses (with the UK Addendum where
                applicable) or another lawful transfer mechanism offered by that provider, together with
                the technical measures described in section 9. You may ask us for details of the
                mechanism used for a specific provider.
              </p>
            </div>

            {/* The footer's "Cookie Policy" link targets #cookies — this anchor
                is what it lands on. Renaming or removing it breaks that link. */}
            <div id="cookies" className="scroll-mt-24">
              <h2 className="text-lg font-black text-[#18181B] mb-3">7. Cookies and tracking</h2>
              <p className="mb-3">
                <strong>Essential cookies</strong> are always active — they keep you signed in and keep
                the site working. They need no consent.
              </p>
              <p className="mb-3">
                <strong>Analytics and advertising cookies</strong> (Google Analytics 4, Meta Pixel,
                Google Ads) load <em>only</em> if you accept them in the cookie banner. Decline and they
                are not set. You can change your mind at any time by clearing this site&apos;s data in
                your browser, which makes the banner ask again.
              </p>
              <p>
                Sites we build for clients carry their own cookie notice and their own consent banner.
              </p>
            </div>

            <div>
              <h2 className="text-lg font-black text-[#18181B] mb-3">8. How long we keep it</h2>
              <ul className="list-disc pl-5 space-y-1">
                <li>Enquiries that do not become clients: up to 24 months.</li>
                <li>Client records, contracts and invoices: up to 10 years, to meet accounting and tax obligations.</li>
                <li>Conversations and enquiries on a client&apos;s site: for as long as their plan is active, then 60 days after it ends, during which we export the data to them on request. After that it is deleted, unless they instruct otherwise.</li>
                <li>Marketing list: until you unsubscribe.</li>
              </ul>
            </div>

            <div>
              <h2 className="text-lg font-black text-[#18181B] mb-3">9. Security</h2>
              <p>
                Data is encrypted in transit. Access to production systems is restricted, protected by
                two-factor authentication, and rate-limited against brute force. Card details never touch
                our servers. No online service can promise absolute security, but if a breach ever
                affected your data we would notify you and the competent authority as the law requires.
              </p>
            </div>

            <div>
              <h2 className="text-lg font-black text-[#18181B] mb-3">10. Your rights</h2>
              <p className="mb-3">
                If you are in the EEA or the UK you have the right to access your data, correct it, have
                it deleted, restrict or object to processing, receive it in a portable format, and
                withdraw consent at any time without affecting processing already carried out. Write to{" "}
                <a href="mailto:hello@servolia.com" className="text-[#36671E]">hello@servolia.com</a>{" "}
                and we will respond within 30 days, free of charge.
              </p>
              <p>
                You also have the right to lodge a complaint with your national data protection
                authority — in France, the CNIL (<span className="whitespace-nowrap">cnil.fr</span>); in
                the UK, the ICO (<span className="whitespace-nowrap">ico.org.uk</span>). We would rather
                you came to us first so we can put it right.
              </p>
            </div>

            <div>
              <h2 className="text-lg font-black text-[#18181B] mb-3">11. Changes</h2>
              <p>
                We update this policy when what we do changes. The date at the top always reflects the
                current version, and material changes are announced to clients by email.
              </p>
            </div>

          </div>
        </div>
      </section>
      <Footer />
    </main>
  );
}
