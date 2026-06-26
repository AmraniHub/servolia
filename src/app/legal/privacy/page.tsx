import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — Servolia",
  description: "Servolia privacy policy and GDPR compliance information.",
};

export default function PrivacyPage() {
  return (
    <main className="flex flex-col bg-white">
      <Navbar />
      <section className="bg-[#080E1C] pt-28 pb-12">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-sm font-bold text-[#95BF47] uppercase tracking-widest mb-3">Legal</p>
          <h1 className="text-4xl font-black text-white">Privacy Policy</h1>
          <p className="text-[#94A3B8] mt-2">Last updated: June 2025</p>
        </div>
      </section>
      <section className="py-14 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 prose prose-slate max-w-none">
          <div className="space-y-8 text-[#374151] text-sm leading-relaxed">
            <div>
              <h2 className="text-lg font-black text-[#080E1C] mb-3">1. Who we are</h2>
              <p>Servolia ("we", "us", "our") is an AI web systems studio providing websites, AI receptionists, lead systems, and business automation for service businesses in Europe and the US. Contact: <a href="mailto:hello@servolia.com" className="text-[#95BF47]">hello@servolia.com</a></p>
            </div>
            <div>
              <h2 className="text-lg font-black text-[#080E1C] mb-3">2. Data we collect</h2>
              <p>We collect data you provide voluntarily through our contact form: name, email address, business name, website URL, and the message you send. We do not collect data without your knowledge.</p>
            </div>
            <div>
              <h2 className="text-lg font-black text-[#080E1C] mb-3">3. Why we collect it</h2>
              <p>We use your data to: (a) respond to your audit or service inquiry, (b) send you the free audit PDF, (c) communicate about your project, (d) send occasional relevant updates if you opted in. We do not sell your data to third parties.</p>
            </div>
            <div>
              <h2 className="text-lg font-black text-[#080E1C] mb-3">4. Legal basis (GDPR)</h2>
              <p>Under GDPR, our legal basis for processing your data is legitimate interest (responding to your inquiry) and contractual necessity (delivering services you've purchased). For marketing communications, we rely on your explicit consent.</p>
            </div>
            <div>
              <h2 className="text-lg font-black text-[#080E1C] mb-3">5. Data retention</h2>
              <p>We retain contact inquiry data for up to 24 months. Client project data is retained for up to 5 years for accounting purposes. You may request deletion at any time.</p>
            </div>
            <div>
              <h2 className="text-lg font-black text-[#080E1C] mb-3">6. Cookies</h2>
              <p id="cookies">We use the following cookies: (a) <strong>Essential cookies</strong> — required for the website to function. (b) <strong>Analytics cookies</strong> (Google Analytics 4) — to understand how visitors use our site. These are only activated with your consent via our cookie banner.</p>
            </div>
            <div>
              <h2 className="text-lg font-black text-[#080E1C] mb-3">7. Third-party services</h2>
              <p>We use Stripe for payment processing (subject to <a href="https://stripe.com/privacy" className="text-[#95BF47]">Stripe's privacy policy</a>) and Google Analytics (subject to Google's privacy policy). Stripe does not store your full card details on our servers.</p>
            </div>
            <div>
              <h2 className="text-lg font-black text-[#080E1C] mb-3">8. Your rights (GDPR)</h2>
              <p>You have the right to: access your data, correct inaccuracies, request deletion, restrict processing, data portability, and to withdraw consent at any time. Contact us at <a href="mailto:hello@servolia.com" className="text-[#95BF47]">hello@servolia.com</a> to exercise any of these rights.</p>
            </div>
            <div>
              <h2 className="text-lg font-black text-[#080E1C] mb-3">9. Contact</h2>
              <p>For any privacy-related questions or to exercise your rights: <a href="mailto:hello@servolia.com" className="text-[#95BF47]">hello@servolia.com</a></p>
            </div>
          </div>
        </div>
      </section>
      <Footer />
    </main>
  );
}
