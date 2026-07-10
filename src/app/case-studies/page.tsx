import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Link from "next/link";
import { ArrowRight, Clock, CheckCircle } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Example Deployments — What a Servolia System Delivers",
  description: "Illustrative deployment scenarios showing how dental clinics, aesthetic practices, and service businesses in Europe and the US use Servolia AI systems to capture and book more clients.",
};

const cases = [
  {
    id: "dental-scenario",
    badge: "Dental clinic · Western Europe",
    name: "Dental clinic scenario",
    system: "AI Booking System",
    plan: "Growth Plan (€149/mo)",
    timeline: "5-day build · designed for results in week 1",
    headline: "Turning after-hours enquiries into booked appointments.",
    challenge:
      "A typical practice is full during the day but loses patients who call after hours. With no online booking, every missed call can go to a competitor — and the front desk burns hours each day managing appointments by phone instead of treating patients.",
    solution: [
      "10-page website rebuilt for conversion with trust signals and before/after gallery",
      "AI receptionist trained on the treatment list, pricing, and booking rules",
      "Online booking flow integrated into the site — patients self-schedule 24/7",
      "Automated confirmation, reminder (48h before), and follow-up (no-show recovery)",
      "Google Analytics 4 + Meta Pixel installed for future ad tracking",
    ],
    results: [
      { metric: "+400%", label: "Target: online bookings" },
      { metric: "24/7", label: "After-hours coverage" },
      { metric: "Hours", label: "Saved on admin weekly" },
      { metric: "100%", label: "Enquiries captured in CRM" },
    ],
    capability:
      "With the AI handling enquiries after 6pm, patients book, get a confirmation, and receive a reminder automatically — the schedule fills without manual phone work.",
    cta: "/contact",
    color: "from-[#36671E] to-[#295115]",
    lightColor: "bg-[#EEF5EA]",
    borderColor: "border-[#36671E]/20",
  },
  {
    id: "aesthetic-scenario",
    badge: "Aesthetic clinic · Europe",
    name: "Aesthetic clinic scenario",
    system: "AI Client System",
    plan: "Authority Plan (€299/mo)",
    timeline: "7-day build · designed for first booking in week 1",
    headline: "Converting Instagram interest that was going nowhere.",
    challenge:
      "A clinic with a few thousand Instagram followers gets steady DM interest in Botox and filler consultations, but no system to convert it. Potential clients message, wait for a slow reply, and book with a competitor — demand is strong but revenue stays flat.",
    solution: [
      "Full clinic website with treatment-specific pages (Botox, fillers, laser, skin care)",
      "AI receptionist trained on treatments, prices, and consultation protocols",
      "Instagram link-in-bio → lead capture → auto-booking flow",
      "Lead CRM dashboard showing every enquiry, source, and status",
      "Automated 48-hour follow-up for unbooked leads",
      "Monthly performance report: leads, bookings, revenue attribution",
    ],
    results: [
      { metric: "×4", label: "Target: bookings/week" },
      { metric: "Most", label: "Enquiries handled by AI" },
      { metric: "Week 1", label: "Designed time to first booking" },
      { metric: "1 view", label: "Every lead, source & status" },
    ],
    capability:
      "Instead of DMs no one can keep up with, every enquiry flows into one system and gets followed up automatically — so interest turns into booked consultations.",
    cta: "/contact",
    color: "from-[#295115] to-[#6B8439]",
    lightColor: "bg-[#EEF5EA]",
    borderColor: "border-[#6BA52A]/20",
  },
  {
    id: "hvac-scenario",
    badge: "HVAC / home services · US",
    name: "Home services scenario",
    system: "AI Booking System",
    plan: "Growth Plan ($199/mo)",
    timeline: "4-day build · designed for quote requests in week 1",
    headline: "Replacing word-of-mouth-only with a 24/7 lead engine.",
    challenge:
      "A successful HVAC business runs entirely on word-of-mouth with no website or online presence. The owner spends 10+ hours a week on the phone just qualifying leads, scheduling quotes, and chasing people who go quiet.",
    solution: [
      "Professional HVAC website built for the local market (service areas, trust signals, licences)",
      "AI receptionist that qualifies leads 24/7 (service needed, urgency, address, budget)",
      "Online quote request flow with instant lead notification to the owner's phone",
      "Google Business Profile integration and local SEO setup",
      "Google Analytics 4 tracking — knows which neighbourhoods drive the most leads",
    ],
    results: [
      { metric: "10h/wk", label: "Target: admin time saved" },
      { metric: "24/7", label: "Lead qualification" },
      { metric: "Instant", label: "Lead alerts to phone" },
      { metric: "100%", label: "Leads captured & scored" },
    ],
    capability:
      "The AI qualifies leads around the clock, so the owner only speaks to people who are already serious — and no enquiry slips through voicemail again.",
    cta: "/contact",
    color: "from-[#10B981] to-[#34D399]",
    lightColor: "bg-[#ECFDF5]",
    borderColor: "border-[#10B981]/20",
  },
];

export default function CaseStudiesPage() {
  return (
    <>
      <Navbar />
      <main>
        {/* HERO */}
        <section className="pt-28 pb-16 lg:pt-36 lg:pb-20 bg-[#FAFAF7]">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <p className="text-sm font-bold text-[#36671E] uppercase tracking-widest mb-3">Example Deployments</p>
            <h1 className="text-4xl sm:text-5xl font-black text-[#18181B] leading-tight mb-5">
              What a Servolia system{" "}
              <span className="bg-gradient-to-r from-[#36671E] to-[#295115] bg-clip-text text-transparent">
                is built to do.
              </span>
            </h1>
            <p className="text-[#52525B] text-lg max-w-2xl mx-auto mb-4">
              The scenarios below show how each Servolia system is designed to work for a typical service business — the problem, what we build, and the outcomes it&apos;s built to drive.
            </p>
            <p className="text-xs text-[#A1A1AA] max-w-xl mx-auto mb-10">
              Illustrative deployment scenarios based on typical service-business benchmarks. Targets shown are design goals, not guaranteed results — individual outcomes vary. Named client case studies will be published as our roster grows.
            </p>

            {/* What's locked in writing */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto">
              {[
                { n: "7 days", label: "Kickoff to live system" },
                { n: "50%", label: "Deposit to start" },
                { n: "10%", label: "Back per day if late" },
                { n: "100%", label: "Ownership on payment" },
              ].map((s, i) => (
                <div key={i} className="p-4 rounded-2xl bg-[#F5F4EF] border border-[#D4D2CC] text-center">
                  <p className="text-2xl font-black text-[#18181B] mb-1">{s.n}</p>
                  <p className="text-xs text-[#71717A]">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CASE STUDIES */}
        <div className="bg-[#FAFAF7]">
          {cases.map((c, idx) => (
            <section key={c.id} id={c.id} className={`py-20 lg:py-28 ${idx % 2 === 0 ? "bg-[#FAFAF7]" : "bg-white"}`}>
              <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">

                {/* Header */}
                <div className="mb-10">
                  <span className="inline-block text-xs font-bold text-[#71717A] uppercase tracking-widest bg-white border border-[#E8E6E0] px-3 py-1 rounded-full mb-4">{c.badge}</span>
                  <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-[#080E1C] leading-tight mb-3 max-w-3xl">
                    {c.headline}
                  </h2>
                  <div className="flex flex-wrap gap-3">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold bg-gradient-to-r ${c.color} text-[#FAFAF7]`}>{c.system}</span>
                    <span className="px-3 py-1 rounded-full text-xs font-medium text-[#71717A] bg-white border border-[#E8E6E0]">{c.plan}</span>
                    <span className="px-3 py-1 rounded-full text-xs font-medium text-[#71717A] bg-white border border-[#E8E6E0] flex items-center gap-1"><Clock className="w-3 h-3" />{c.timeline}</span>
                  </div>
                </div>

                <div className="grid lg:grid-cols-5 gap-8">
                  {/* Left: story */}
                  <div className="lg:col-span-3 space-y-6">
                    <div className="p-6 rounded-2xl bg-white border border-[#E8E6E0]">
                      <h3 className="text-sm font-black text-[#080E1C] uppercase tracking-wide mb-3">The challenge</h3>
                      <p className="text-[#71717A] text-sm leading-relaxed">{c.challenge}</p>
                    </div>
                    <div className="p-6 rounded-2xl bg-white border border-[#E8E6E0]">
                      <h3 className="text-sm font-black text-[#080E1C] uppercase tracking-wide mb-3">What we built</h3>
                      <ul className="space-y-2.5">
                        {c.solution.map((s, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-[#71717A]">
                            <CheckCircle className="w-4 h-4 text-[#36671E] shrink-0 mt-0.5" />{s}
                          </li>
                        ))}
                      </ul>
                    </div>
                    {/* Capability note */}
                    <div className={`p-6 rounded-2xl border-2 ${c.borderColor} ${c.lightColor}`}>
                      <h3 className="text-sm font-black text-[#080E1C] uppercase tracking-wide mb-3">In practice</h3>
                      <p className="text-[#080E1C] text-sm leading-relaxed">{c.capability}</p>
                    </div>
                  </div>

                  {/* Right: results */}
                  <div className="lg:col-span-2 space-y-4">
                    <div className="p-6 rounded-2xl bg-[#FAFAF7]">
                      <h3 className="text-xs font-black text-[#71717A] uppercase tracking-widest mb-5">Built to deliver</h3>
                      <div className="grid grid-cols-2 gap-4">
                        {c.results.map((r, i) => (
                          <div key={i} className="text-center p-4 rounded-xl bg-[#F5F4EF] border border-[#D4D2CC]">
                            <p className={`text-2xl font-black bg-gradient-to-r ${c.color} bg-clip-text text-transparent`}>{r.metric}</p>
                            <p className="text-xs text-[#71717A] mt-1 leading-tight">{r.label}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="p-5 rounded-2xl bg-white border border-[#E8E6E0]">
                      <p className="text-xs text-[#71717A] mb-1">System used</p>
                      <p className="font-black text-[#080E1C] text-sm mb-0.5">{c.system}</p>
                      <p className="text-xs text-[#71717A]">{c.plan}</p>
                    </div>
                    <Link href={c.cta}
                      className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl bg-gradient-to-r from-[#36671E] to-[#295115] text-[#FAFAF7] font-black text-sm hover:opacity-90 transition-opacity">
                      Get results like this <ArrowRight className="w-4 h-4" />
                    </Link>
                  </div>
                </div>
              </div>
            </section>
          ))}
        </div>

        {/* BOTTOM CTA */}
        <section className="py-20 bg-[#FAFAF7]">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
            <p className="text-sm font-bold text-[#36671E] uppercase tracking-widest mb-3">Your turn</p>
            <h2 className="text-3xl sm:text-4xl font-black text-[#18181B] mb-4">
              Want results like these for your business?
            </h2>
            <p className="text-[#52525B] mb-8 max-w-xl mx-auto">
              Start with a free audit. We record a 5-minute Loom video of your current online presence and show you exactly what to fix — no charge, no commitment.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/free-audit"
                className="px-8 py-4 rounded-xl bg-gradient-to-r from-[#36671E] to-[#295115] text-[#FAFAF7] font-black hover:opacity-90 transition-opacity flex items-center justify-center gap-2">
                Get my free audit <ArrowRight className="w-4 h-4" />
              </Link>
              <Link href="/pricing"
                className="px-8 py-4 rounded-xl border border-[#A1A1AA] text-[#18181B] font-semibold hover:bg-[#F5F4EF] transition-colors">
                View pricing
              </Link>
            </div>
            <p className="text-xs text-[#A1A1AA] mt-5">Audit delivered within 24h · No call required · No credit card</p>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
