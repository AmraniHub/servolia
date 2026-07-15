import Link from "next/link";
import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import ChatWidget from "@/components/ChatWidget";
import { formatDate } from "@/lib/content/posts";
import { getAllPosts } from "@/lib/content/dynamicPosts";
import { Clock, ArrowRight } from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Insights — AI Client Systems for Service Businesses | Servolia",
  description: "Practical insights on AI receptionists, booking systems, lead capture, and client acquisition for dental clinics, law firms, and service businesses.",
  alternates: { canonical: "https://servolia.com/blog" },
};

export default async function BlogIndex() {
  const POSTS = await getAllPosts();
  const [featured, ...rest] = POSTS;
  const categories = Array.from(new Set(POSTS.map((p) => p.category)));

  return (
    <>
      <Navbar heroDark />
      <main className="bg-[#FAFAF7]">
        {/* HERO */}
        <section className="relative pt-32 pb-14 lg:pt-40 lg:pb-16 bg-[#0A1F14] overflow-hidden">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[450px] bg-[#36671E] opacity-60 rounded-full blur-[120px]" />
            <div className="absolute inset-0 grain opacity-30" />
          </div>
          <div className="relative max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#BEF264]/40 bg-[#BEF264]/10 text-[#ABDF90] text-xs font-bold uppercase tracking-widest mb-6">
              Insights
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-[#FAFAF7] leading-[1.05] tracking-tight mb-5">
              Client acquisition,{" "}
              <span className="bg-gradient-to-r from-[#BEF264] to-[#ABDF90] bg-clip-text text-transparent">made practical.</span>
            </h1>
            <p className="text-[#ABDF90]/80 text-lg max-w-2xl mx-auto leading-relaxed">
              No-fluff thinking on AI receptionists, booking, and lead capture for service businesses that want more booked clients and less manual work.
            </p>
          </div>
        </section>

        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-14 lg:py-20">
          {/* Categories */}
          <div className="flex flex-wrap justify-center gap-2 mb-12">
            {categories.map((c) => (
              <span key={c} className="px-3.5 py-1.5 rounded-full border border-[#E8E6E0] bg-white text-[#52525B] text-xs font-bold">{c}</span>
            ))}
          </div>

          {/* Featured */}
          {featured && (
            <Link href={`/blog/${featured.slug}`}
              className="group block rounded-3xl overflow-hidden border border-[#E8E6E0] bg-white hover:shadow-elevated transition-all duration-300 mb-12">
              <div className="grid lg:grid-cols-2">
                <div className="bg-[#0A1F14] p-8 lg:p-12 flex flex-col justify-center relative overflow-hidden min-h-[240px]">
                  {featured.coverImageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={featured.coverImageUrl} alt="" className="absolute inset-0 w-full h-full object-cover opacity-40" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0A1F14] via-[#0A1F14]/80 to-[#0A1F14]/40 pointer-events-none" />
                  <div className="absolute -top-10 -right-10 w-64 h-64 bg-[#36671E] opacity-50 rounded-full blur-3xl pointer-events-none" />
                  <div className="relative">
                    <span className="text-[10px] font-black text-[#ABDF90] uppercase tracking-widest">Featured · {featured.category}</span>
                    <h2 className="text-2xl lg:text-3xl font-black text-[#FAFAF7] mt-3 leading-tight group-hover:text-[#ABDF90] transition-colors">{featured.title}</h2>
                  </div>
                </div>
                <div className="p-8 lg:p-12 flex flex-col justify-center">
                  <p className="text-[#52525B] leading-relaxed mb-6">{featured.excerpt}</p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs text-[#A1A1AA]">
                      <time dateTime={featured.publishedAt}>{formatDate(featured.publishedAt)}</time>
                      <span>·</span>
                      <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {featured.readingMinutes} min</span>
                    </div>
                    <span className="inline-flex items-center gap-1.5 text-sm font-bold text-[#36671E] group-hover:gap-2.5 transition-all">
                      Read <ArrowRight className="w-4 h-4" />
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          )}

          {/* Grid */}
          <div className="grid md:grid-cols-3 gap-5">
            {rest.map((p) => (
              <Link key={p.slug} href={`/blog/${p.slug}`}
                className="group bg-white rounded-2xl overflow-hidden border border-[#E8E6E0] hover:border-[#36671E]/30 hover:shadow-card transition-all duration-300 flex flex-col">
                {p.coverImageUrl && (
                  <div className="aspect-video w-full overflow-hidden bg-[#F5F4EF]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.coverImageUrl} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  </div>
                )}
                <div className="p-7 flex flex-col flex-1">
                  <span className="self-start text-[10px] font-black text-[#36671E] bg-[#EEF5EA] px-2.5 py-1 rounded-full uppercase tracking-widest mb-4">{p.category}</span>
                  <h3 className="text-lg font-black text-[#18181B] mb-2 leading-tight group-hover:text-[#36671E] transition-colors">{p.title}</h3>
                  <p className="text-sm text-[#71717A] leading-relaxed flex-1 mb-5">{p.excerpt}</p>
                  <div className="flex items-center gap-2 text-xs text-[#A1A1AA] border-t border-[#F5F4EF] pt-4">
                    <time dateTime={p.publishedAt}>{formatDate(p.publishedAt)}</time>
                    <span>·</span>
                    <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {p.readingMinutes} min</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* CTA */}
        <section className="py-16 bg-white border-t border-[#E8E6E0]">
          <div className="max-w-2xl mx-auto px-4 sm:px-6 text-center">
            <h2 className="text-2xl sm:text-3xl font-black text-[#18181B] mb-3">Want this working for your business?</h2>
            <p className="text-[#71717A] mb-7">Start with a free audit — we'll map where you're losing clients and what to fix.</p>
            <Link href="/free-audit"
              className="group inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-[#36671E] text-[#FAFAF7] font-black hover:bg-[#295115] transition-colors">
              Book a Free System Audit <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        </section>
      </main>
      <Footer />
      <ChatWidget />
    </>
  );
}
