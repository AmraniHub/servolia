import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Link from "next/link";
import { ArrowRight, CheckCircle, Target, Heart, Zap } from "lucide-react";
import type { Metadata } from "next";
import ValueStack from "@/components/ValueStack";

export const metadata: Metadata = {
  title: "About Servolia — Built by an operator, for operators",
  description: "Servolia is an AI client acquisition systems agency built for service businesses in Europe and the US. We deliver fixed-price AI websites and lead systems in 7 days.",
  alternates: {
    canonical: "https://servolia.com/about",
    languages: {
      "en-US": "https://servolia.com/about",
      "fr-FR": "https://servolia.com/fr/a-propos",
      "x-default": "https://servolia.com/about",
    },
  },
};

export default function AboutPage() {
  return (
    <>
      <Navbar />
      <main>
        {/* HERO */}
        <section className="pt-28 pb-16 lg:pt-36 lg:pb-20 bg-[#FAFAF7]">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <p className="text-sm font-bold text-[#36671E] uppercase tracking-widest mb-3">About</p>
            <h1 className="text-4xl sm:text-5xl font-black text-[#18181B] leading-tight mb-6">
              We build the AI system you wish your agency built —{" "}
              <span className="bg-gradient-to-r from-[#36671E] to-[#295115] bg-clip-text text-transparent">in 7 days, at a fixed price.</span>
            </h1>
            <p className="text-lg text-[#52525B] leading-relaxed">
              Servolia is an AI client acquisition systems agency for service businesses — dental clinics, aesthetic clinics, real estate agents, and home services. We don&apos;t do retainers, we don&apos;t do open-ended projects. We deliver a working system in a week, then we keep it running for a small monthly fee.
            </p>
          </div>
        </section>

        {/* MISSION */}
        <section className="py-16 lg:py-20 bg-white border-y border-[#E8E6E0]">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid md:grid-cols-3 gap-6">
              <div className="p-6 rounded-2xl bg-[#FAFAF7] border border-[#E8E6E0]">
                <div className="w-10 h-10 rounded-xl bg-[#36671E] flex items-center justify-center mb-3">
                  <Target className="w-5 h-5 text-[#FAFAF7]" />
                </div>
                <h3 className="font-black text-[#18181B] mb-2">Outcome over output</h3>
                <p className="text-sm text-[#52525B] leading-relaxed">We measure ourselves by the bookings, leads, and revenue your system generates — not by hours billed.</p>
              </div>
              <div className="p-6 rounded-2xl bg-[#FAFAF7] border border-[#E8E6E0]">
                <div className="w-10 h-10 rounded-xl bg-[#36671E] flex items-center justify-center mb-3">
                  <Zap className="w-5 h-5 text-[#FAFAF7]" />
                </div>
                <h3 className="font-black text-[#18181B] mb-2">Fast, fixed, finished</h3>
                <p className="text-sm text-[#52525B] leading-relaxed">Scope locked in writing. Price locked in writing. Deadline locked in writing. Then we ship.</p>
              </div>
              <div className="p-6 rounded-2xl bg-[#FAFAF7] border border-[#E8E6E0]">
                <div className="w-10 h-10 rounded-xl bg-[#36671E] flex items-center justify-center mb-3">
                  <Heart className="w-5 h-5 text-[#FAFAF7]" />
                </div>
                <h3 className="font-black text-[#18181B] mb-2">Long after launch</h3>
                <p className="text-sm text-[#52525B] leading-relaxed">Your monthly care plan keeps the system fast, the AI sharp, and the reports honest. We grow with you.</p>
              </div>
            </div>
          </div>
        </section>

        {/* WHY WE EXIST */}
        <section className="py-16 lg:py-24 bg-[#FAFAF7]">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <p className="text-sm font-bold text-[#36671E] uppercase tracking-widest mb-3">Why Servolia exists</p>
            <h2 className="text-3xl font-black text-[#18181B] leading-tight mb-6">
              Service businesses don&apos;t need another website. They need a system that brings clients.
            </h2>
            <div className="space-y-4 text-[15px] text-[#3F3F46] leading-relaxed">
              <p>
                Most dental clinics, aesthetic practices, and home-service businesses we meet have a website that does one thing well: <em>look pretty</em>. It doesn&apos;t answer questions after hours. It doesn&apos;t capture leads when the phone&apos;s busy. It doesn&apos;t tell you which ad or post drove a paying client through the door.
              </p>
              <p>
                Servolia exists to fix that. We replace your old website with an AI-powered client acquisition system — site, chatbot, booking flow, lead capture, full tracking — in 7 days, for a price you know in advance.
              </p>
              <p>
                Then we stay on. Your monthly care plan keeps everything running: hosting, security, AI retraining, monthly performance reports, and one improvement per month. The kind of partnership a local agency promises but rarely delivers.
              </p>
            </div>
          </div>
        </section>

        {/* PRINCIPLES */}
        <section className="py-16 lg:py-20 bg-white border-y border-[#E8E6E0]">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl font-black text-[#18181B] mb-8">How we work</h2>
            <ul className="space-y-4">
              {[
                ["Free audit before anything else.", "We record a 5-minute Loom of your current online presence — what's working, what's costing you clients, and what we'd fix. No commitment, no call required."],
                ["Scope in writing before you pay.", "Every project starts with a 1-page scope document. Fixed deliverables. Fixed price. Fixed deadline. Approved by you before any invoice."],
                ["50% deposit, 50% on delivery.", "You see your finished system before paying the balance. If you're not happy, we revise. If we miss the deadline through our fault, we refund 10% per day late."],
                ["One revision included.", "Major scope additions are quoted separately. No surprise invoices, no hourly billing, no agency games."],
                ["We never go silent.", "Weekly progress updates. Same-day responses to email. Loom walkthroughs at every milestone."],
              ].map(([title, body], i) => (
                <li key={i} className="flex gap-3">
                  <CheckCircle className="w-5 h-5 text-[#36671E] flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-[#18181B]">{title}</p>
                    <p className="text-sm text-[#52525B] mt-1 leading-relaxed">{body}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* CTA */}
        <section className="py-20 bg-[#36671E]">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
            <h2 className="text-3xl sm:text-4xl font-black text-[#FAFAF7] mb-4">
              Want to see what we&apos;d build for you?
            </h2>
            <p className="text-[#FAFAF7]/80 mb-8 max-w-xl mx-auto">
              Request a free audit. We record a 5-minute Loom showing exactly what we&apos;d fix on your current site to start bringing in more clients. No call, no credit card.
            </p>
            <Link href="/free-audit"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-[#FAFAF7] text-[#36671E] font-black hover:bg-white transition-colors">
              Request my free audit <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </section>
      </main>
      <ValueStack />
      <Footer />
    </>
  );
}
