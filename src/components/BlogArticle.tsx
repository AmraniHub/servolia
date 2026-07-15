import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import ChatWidget from "@/components/ChatWidget";
import CoverImage from "@/components/CoverImage";
import type { Post, Block } from "@/lib/content/posts";
import { formatDate, getRelated } from "@/lib/content/posts";
import { Clock, ArrowRight, ArrowLeft, Quote } from "lucide-react";

function renderBlock(b: Block, i: number) {
  switch (b.type) {
    case "h2":
      return <h2 key={i} className="text-2xl font-black text-[#18181B] mt-10 mb-4 scroll-mt-24">{b.text}</h2>;
    case "p":
      return <p key={i} className="text-[#3F3F46] text-[17px] leading-[1.75] mb-5">{b.text}</p>;
    case "ul":
      return (
        <ul key={i} className="space-y-2.5 mb-6">
          {b.items.map((it, j) => (
            <li key={j} className="flex items-start gap-3 text-[#3F3F46] text-[16px] leading-relaxed">
              <span className="w-1.5 h-1.5 rounded-full bg-[#36671E] mt-2.5 shrink-0" /> {it}
            </li>
          ))}
        </ul>
      );
    case "ol":
      return (
        <ol key={i} className="space-y-3 mb-6">
          {b.items.map((it, j) => (
            <li key={j} className="flex items-start gap-3 text-[#3F3F46] text-[16px] leading-relaxed">
              <span className="w-6 h-6 rounded-lg bg-[#EEF5EA] text-[#36671E] text-xs font-black flex items-center justify-center shrink-0 mt-0.5">{j + 1}</span>
              {it}
            </li>
          ))}
        </ol>
      );
    case "quote":
      return (
        <blockquote key={i} className="my-8 pl-5 border-l-4 border-[#36671E] relative">
          <Quote className="w-5 h-5 text-[#36671E]/40 mb-2" />
          <p className="text-xl font-bold text-[#18181B] leading-snug italic">{b.text}</p>
        </blockquote>
      );
    case "callout":
      return (
        <div key={i} className="my-8 p-5 rounded-2xl bg-[#EEF5EA] border border-[#D6E2CF]">
          <p className="text-[#36671E] text-[15px] font-semibold leading-relaxed">{b.text}</p>
        </div>
      );
  }
}

export default function BlogArticle({ post }: { post: Post }) {
  const related = getRelated(post.related);

  return (
    <>
      <Navbar heroDark />
      <main className="bg-white">
        {/* HERO */}
        <section className="relative pt-32 pb-14 lg:pt-40 lg:pb-16 bg-[#0A1F14] overflow-hidden">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-[#36671E] opacity-60 rounded-full blur-[120px]" />
            <div className="absolute inset-0 grain opacity-30" />
          </div>
          <div className="relative max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <Link href="/blog" className="inline-flex items-center gap-1.5 text-[#ABDF90] text-sm font-semibold mb-6 hover:text-[#FAFAF7] transition-colors">
              <ArrowLeft className="w-4 h-4" /> All insights
            </Link>
            <div className="flex items-center gap-3 mb-5">
              <span className="px-3 py-1 rounded-full bg-[#BEF264]/15 border border-[#36671E]/30 text-[#ABDF90] text-xs font-black uppercase tracking-widest">{post.category}</span>
              <span className="flex items-center gap-1.5 text-[#FAFAF7]/50 text-xs"><Clock className="w-3.5 h-3.5" /> {post.readingMinutes} min read</span>
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-[#FAFAF7] leading-[1.1] tracking-tight mb-6">{post.title}</h1>
            <div className="flex items-center gap-2 text-[#FAFAF7]/50 text-sm">
              <span className="font-semibold text-[#FAFAF7]/70">The Servolia Team</span>
              <span>·</span>
              <time dateTime={post.publishedAt}>{formatDate(post.publishedAt)}</time>
            </div>
          </div>
        </section>

        {/* BODY */}
        <article className="py-14 lg:py-20">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            {post.coverImageUrl && (
              <CoverImage
                src={post.coverImageUrl}
                alt={post.title}
                className="w-full h-auto rounded-2xl mb-10 border border-[#E8E6E0]"
                fallbackClassName="w-full aspect-[1200/630] rounded-2xl mb-10 border border-[#E8E6E0]"
              />
            )}
            <p className="text-xl text-[#52525B] leading-relaxed font-medium mb-10 pb-10 border-b border-[#E8E6E0]">{post.excerpt}</p>
            {post.body.map(renderBlock)}
          </div>
        </article>

        {/* CTA */}
        <section className="pb-16">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="rounded-3xl bg-[#0A1F14] p-8 lg:p-10 text-center relative overflow-hidden">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[250px] bg-[#36671E] opacity-60 rounded-full blur-[90px] pointer-events-none" />
              <div className="relative">
                <h2 className="text-2xl sm:text-3xl font-black text-[#FAFAF7] mb-3">{post.ctaHeadline}</h2>
                <p className="text-[#FAFAF7]/60 mb-7 max-w-lg mx-auto">Get a free audit of your client journey — we'll show you exactly where you're losing enquiries and what to fix. No call required.</p>
                <Link href="/free-audit"
                  className="group inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-[#BEF264] text-[#0A1F14] font-black hover:bg-[#D9F99D] transition-colors shadow-lg shadow-[#BEF264]/20">
                  Book a Free System Audit <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* RELATED */}
        {related.length > 0 && (
          <section className="py-14 bg-[#FAFAF7] border-t border-[#E8E6E0]">
            <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
              <h2 className="text-xl font-black text-[#18181B] mb-6">Keep reading</h2>
              <div className="grid md:grid-cols-2 gap-5">
                {related.map((r) => (
                  <Link key={r.slug} href={`/blog/${r.slug}`}
                    className="group bg-white rounded-2xl p-6 border border-[#E8E6E0] hover:border-[#36671E]/30 hover:shadow-card transition-all duration-300">
                    <span className="text-[10px] font-black text-[#36671E] bg-[#EEF5EA] px-2.5 py-1 rounded-full uppercase tracking-widest">{r.category}</span>
                    <h3 className="text-lg font-black text-[#18181B] mt-4 mb-2 group-hover:text-[#36671E] transition-colors">{r.title}</h3>
                    <p className="text-sm text-[#71717A] leading-relaxed line-clamp-2">{r.excerpt}</p>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}
      </main>
      <Footer />
      <ChatWidget />
    </>
  );
}
