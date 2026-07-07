import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase";
import { MessageSquare, CheckCircle2, Circle } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ChatInboxPage() {
  const db = supabaseAdmin();
  const { data: sessions } = db
    ? await db.from("chat_sessions").select("*").order("updated_at", { ascending: false }).limit(100)
    : { data: [] };

  const qualified = (sessions ?? []).filter(s => s.qualified).length;

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 lg:py-8 max-w-7xl mx-auto">
      <h1 className="text-2xl font-black text-[#18181B] mb-1">Chat inbox</h1>
      <p className="text-sm text-[#71717A] mb-6">{(sessions?.length ?? 0)} conversations · {qualified} qualified</p>

      {(sessions?.length ?? 0) === 0 ? (
        <div className="bg-white border border-[#E8E6E0] rounded-2xl p-12 text-center">
          <MessageSquare className="w-10 h-10 text-[#A1A1AA] mx-auto mb-3" />
          <p className="text-sm text-[#71717A]">No chatbot conversations yet. Add <code className="px-1.5 py-0.5 rounded bg-[#FAFAF7]">ANTHROPIC_API_KEY</code> to env vars to activate Solia.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sessions?.map(s => {
            const msgs = (s.messages ?? []) as Array<{ role: string; content: string }>;
            const lastMsg = msgs[msgs.length - 1];
            return (
              <Link key={s.id} href={`/admin/chat/${s.id}`}
                className="block bg-white border border-[#E8E6E0] rounded-2xl p-5 hover:border-[#36671E]/40 transition-colors">
                <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    {s.qualified
                      ? <CheckCircle2 className="w-4 h-4 text-[#36671E]" />
                      : <Circle className="w-4 h-4 text-[#A1A1AA]" />}
                    <span className="text-sm font-semibold text-[#18181B]">
                      {s.visitor_business || s.email_captured || "Anonymous visitor"}
                    </span>
                    {s.qualified && (
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-[#EEF5EA] text-[#36671E]">QUALIFIED</span>
                    )}
                  </div>
                  <span className="text-xs text-[#71717A]">{new Date(s.updated_at).toLocaleString()}</span>
                </div>
                <p className="text-xs text-[#71717A] mb-2">{s.message_count} messages · {s.visitor_niche ?? "unknown niche"} · {s.page_url ?? "/"}</p>
                {lastMsg && (
                  <p className="text-sm text-[#52525B] italic line-clamp-2">
                    {lastMsg.role === "user" ? "Visitor: " : "Solia: "}{lastMsg.content}
                  </p>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
