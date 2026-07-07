import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase";
import { ArrowLeft, Bot, User, Mail, Globe, CheckCircle2 } from "lucide-react";

export const dynamic = "force-dynamic";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export default async function ChatDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = supabaseAdmin();
  if (!db) notFound();

  const { data: session } = await db.from("chat_sessions").select("*").eq("id", id).maybeSingle();
  if (!session) notFound();

  const messages = (session.messages ?? []) as ChatMessage[];

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 lg:py-8 max-w-4xl mx-auto">
      <Link href="/admin/chat" className="inline-flex items-center gap-1.5 text-sm text-[#71717A] hover:text-[#18181B] mb-4">
        <ArrowLeft className="w-4 h-4" /> Chat inbox
      </Link>

      <div className="grid lg:grid-cols-3 gap-6">

        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white border border-[#E8E6E0] rounded-2xl p-6">
            <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
              <h1 className="text-lg font-black text-[#18181B]">
                {session.visitor_business || session.email_captured || "Anonymous visitor"}
              </h1>
              {session.qualified && (
                <span className="flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full bg-[#EEF5EA] text-[#36671E]">
                  <CheckCircle2 className="w-3 h-3" /> QUALIFIED
                </span>
              )}
            </div>
            <p className="text-xs text-[#71717A]">
              {session.message_count} messages · started {new Date(session.created_at).toLocaleString()}
            </p>
          </div>

          {/* Conversation */}
          <div className="bg-white border border-[#E8E6E0] rounded-2xl p-4 space-y-3">
            {messages.map((m, i) => (
              <div key={i} className={`flex gap-2 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
                <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                  m.role === "user" ? "bg-[#F5F4EF] text-[#52525B]" : "bg-[#36671E] text-[#FAFAF7]"
                }`}>
                  {m.role === "user" ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
                </div>
                <div className={`max-w-[80%] px-3.5 py-2.5 rounded-2xl text-sm ${
                  m.role === "user"
                    ? "bg-[#36671E] text-[#FAFAF7] rounded-tr-sm"
                    : "bg-[#FAFAF7] text-[#18181B] rounded-tl-sm border border-[#E8E6E0]"
                }`}>
                  {m.content}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Side: metadata */}
        <aside className="space-y-3">
          <div className="bg-white border border-[#E8E6E0] rounded-2xl p-5">
            <p className="text-xs font-black text-[#71717A] uppercase tracking-widest mb-3">Captured info</p>
            <div className="space-y-2.5 text-sm">
              {session.email_captured && (
                <div className="flex items-center gap-2"><Mail className="w-3.5 h-3.5 text-[#36671E]" /> {session.email_captured}</div>
              )}
              {session.visitor_niche && (
                <div className="text-[#52525B]">Niche: <span className="text-[#18181B] font-semibold">{session.visitor_niche}</span></div>
              )}
              {session.page_url && (
                <div className="flex items-center gap-2 text-xs"><Globe className="w-3.5 h-3.5 text-[#71717A]" /> <span className="text-[#52525B]">{session.page_url}</span></div>
              )}
              {!session.email_captured && !session.visitor_niche && (
                <p className="text-xs text-[#A1A1AA]">No info captured</p>
              )}
            </div>
          </div>

          {session.lead_id && (
            <Link href={`/admin/leads/${session.lead_id}`}
              className="block w-full py-2.5 rounded-xl bg-[#36671E] text-[#FAFAF7] text-sm font-semibold text-center hover:bg-[#295115] transition-colors">
              View linked lead →
            </Link>
          )}
        </aside>
      </div>
    </div>
  );
}
