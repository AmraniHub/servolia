import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import ChatWidget from "@/components/ChatWidget";
import type { MarketingContent, IconName } from "@/lib/content/pages";
import { FaqSchema } from "@/components/StructuredData";
import {
  Globe, Bot, Calendar, LayoutDashboard, BarChart3, Shield, Zap, Clock,
  Users, Phone, MessageSquare, TrendingUp, Lock, FileText, Scale,
  Calculator, Briefcase, Search, CheckCircle, XCircle, ArrowRight,
} from "lucide-react";

const ICONS: Record<IconName, React.ComponentType<{ className?: string }>> = {
  globe: Globe, bot: Bot, calendar: Calendar, dashboard: LayoutDashboard,
  chart: BarChart3, shield: Shield, zap: Zap, clock: Clock, users: Users,
  phone: Phone, message: MessageSquare, trending: TrendingUp, lock: Lock,
  file: FileText, scale: Scale, calculator: Calculator, briefcase: Briefcase,
  search: Search,
};

export default function MarketingPage({ data }: { data: MarketingContent }) {
  return (
    <>
      <FaqSchema faqs={data.faqs} />
      <Navbar />
      <main className="bg-[#FAFAF7]">
        {/* HERO */}
        <section className="relative pt-32 pb-20 lg:pt-40 lg:pb-28 bg-[#091C20] overflow-hidden">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-[#36671E] opacity-60 rounded-full blur-[120px]" />
            <div className="absolute inset-0 grain opacity-30" />
          </div>
          <div className="relative max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#0CA6E9]/40 bg-[#0CA6E9]/10 text-[#ABDF90] text-xs font-bold uppercase tracking-widest mb-6">
              {data.eyebrow}
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-[#FAFAF7] leading-[1.05] tracking-tight mb-6">
              {data.title}{" "}
              <span className="bg-gradient-to-r from-[#0CA6E9] to-[#ABDF90] bg-clip-text text-transparent">{data.highlight}</span>
            </h1>
            <p className="text-[#ABDF90]/80 text-lg max-w-2xl mx-auto mb-7 leading-relaxed">{data.sub}</p>
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 mb-9">
              {data.heroBullets.map((b) => (
                <span key={b} className="flex items-center gap-1.5 text-[#FAFAF7]/70 text-sm font-medium">
                  <CheckCircle className="w-4 h-4 text-[#0CA6E9]" /> {b}
                </span>
              ))}
            </div>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/free-audit"
                className="group px-8 py-4 rounded-xl bg-[#0CA6E9] text-[#091C20] font-black text-base hover:bg-[#ABDF90] transition-colors shadow-lg shadow-[#0CA6E9]/20 flex items-center gap-2">
                Book a Free System Audit <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link href="/pricing"
                className="px-7 py-4 rounded-xl border border-[#FAFAF7]/20 text-[#FAFAF7] font-semibold text-base hover:bg-[#FAFAF7]/8 transition-colors">
                View pricing
              </Link>
            </div>
          </div>
        </section>

        {/* PROBLEM / GAIN */}
        <section className="py-20 lg:py-24 bg-[#FAFAF7]">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-2 gap-5">
            <div className="bg-white rounded-2xl p-7 border border-red-100">
              <div className="flex items-center gap-2 mb-6">
                <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center">
                  <XCircle className="w-4 h-4 text-red-500" />
                </div>
                <p className="text-xs font-black text-red-500 uppercase tracking-widest">{data.withoutTitle}</p>
              </div>
              <ul className="space-y-4">
                {data.without.map((t, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-[#52525B]">
                    <div className="w-4 h-4 rounded-full bg-red-100 flex items-center justify-center mt-0.5 shrink-0">
                      <div className="w-1.5 h-1.5 rounded-full bg-red-400" />
                    </div>
                    {t}
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-white rounded-2xl p-7 border border-[#D6E2CF]">
              <div className="flex items-center gap-2 mb-6">
                <div className="w-8 h-8 rounded-lg bg-[#EEF5EA] flex items-center justify-center">
                  <CheckCircle className="w-4 h-4 text-[#36671E]" />
                </div>
                <p className="text-xs font-black text-[#36671E] uppercase tracking-widest">{data.withTitle}</p>
              </div>
              <ul className="space-y-4">
                {data.with.map((t, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-[#52525B]">
                    <div className="w-4 h-4 rounded-full bg-[#EEF5EA] flex items-center justify-center mt-0.5 shrink-0">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#36671E]" />
                    </div>
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* FEATURES */}
        <section className="py-20 lg:py-24 bg-white">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl sm:text-4xl font-black text-[#18181B] text-center mb-14">{data.featuresTitle}</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {data.features.map((f, i) => {
                const Icon = ICONS[f.icon];
                return (
                  <div key={i} className="bg-[#FAFAF7] rounded-2xl p-6 border border-[#E8E6E0] hover:border-[#36671E]/30 hover:shadow-card transition-all duration-300">
                    <div className="w-11 h-11 rounded-xl bg-[#36671E] flex items-center justify-center text-[#FAFAF7] mb-5 shadow-lg shadow-[#36671E]/20">
                      <Icon className="w-5 h-5" />
                    </div>
                    <h3 className="text-base font-black text-[#18181B] mb-2">{f.title}</h3>
                    <p className="text-sm text-[#71717A] leading-relaxed">{f.body}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section className="py-20 lg:py-24 bg-[#FAFAF7]">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl sm:text-4xl font-black text-[#18181B] text-center mb-14">How it works</h2>
            <div className="grid md:grid-cols-3 gap-6">
              {data.steps.map((s, i) => (
                <div key={i} className="relative bg-white rounded-2xl p-7 border border-[#E8E6E0] overflow-hidden">
                  <span className="absolute -right-3 -top-4 text-[88px] font-black text-[#F0EFEA] leading-none select-none pointer-events-none">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div className="relative">
                    <h3 className="text-lg font-black text-[#18181B] mb-3">{s.title}</h3>
                    <p className="text-sm text-[#71717A] leading-relaxed">{s.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="py-20 bg-white">
          <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl font-black text-[#18181B] text-center mb-10">Common questions</h2>
            <div className="space-y-3">
              {data.faqs.map((f, i) => (
                <details key={i} className="group bg-[#FAFAF7] border border-[#E8E6E0] rounded-xl overflow-hidden">
                  <summary className="flex items-center justify-between px-6 py-4 cursor-pointer list-none">
                    <span className="font-bold text-[#18181B] text-sm">{f.q}</span>
                    <span className="text-[#71717A] transition-transform group-open:rotate-45 text-xl leading-none">+</span>
                  </summary>
                  <div className="px-6 pb-5 text-[#71717A] text-sm leading-relaxed border-t border-[#F5F4EF] pt-4">{f.a}</div>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-24 bg-[#091C20] relative overflow-hidden">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[350px] bg-[#36671E] opacity-60 rounded-full blur-[100px] pointer-events-none" />
          <div className="relative max-w-2xl mx-auto px-4 sm:px-6 text-center">
            <h2 className="text-3xl sm:text-4xl font-black text-[#FAFAF7] mb-4 leading-tight">{data.ctaHeadline}</h2>
            <p className="text-[#FAFAF7]/60 mb-8 max-w-xl mx-auto">{data.ctaSub}</p>
            <Link href="/free-audit"
              className="group inline-flex items-center gap-2 px-9 py-4 rounded-xl bg-[#0CA6E9] text-[#091C20] font-black text-lg hover:bg-[#ABDF90] transition-colors shadow-lg shadow-[#0CA6E9]/20">
              Book a Free System Audit <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
            <p className="text-[#FAFAF7]/40 text-xs mt-5">Delivered within 24h · No call required · Fixed price in writing</p>
          </div>
        </section>
      </main>
      <Footer />
      <ChatWidget />
    </>
  );
}
