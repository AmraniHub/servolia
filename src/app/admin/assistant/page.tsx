import { supabaseAdmin } from "@/lib/supabase";
import { Sparkles, MessageSquare } from "lucide-react";

export const dynamic = "force-dynamic";

/**
 * What clients ask the portal assistant.
 *
 * This is a listening post, not an inbox — nobody needs to reply here, the AI
 * already did. Its value is that recurring questions ARE the product backlog:
 * three clients asking "how do I change my opening hours" means the portal is
 * missing a button, not that the assistant is doing badly. Anything the
 * assistant couldn't answer shows up in Messages instead, because the handoff
 * writes it into the human thread.
 */

interface Row {
  id: string;
  email: string;
  business: string | null;
  messages: { role: string; content: string }[] | null;
  message_count: number | null;
  lang: string | null;
  updated_at: string;
}

export default async function AssistantChatsPage() {
  const db = supabaseAdmin();
  let rows: Row[] = [];
  let tableMissing = false;

  if (db) {
    const { data, error } = await db
      .from("portal_ai_chats")
      .select("id, email, business, messages, message_count, lang, updated_at")
      .order("updated_at", { ascending: false })
      .limit(100);
    if (error) tableMissing = true;
    else rows = (data as Row[]) ?? [];
  }

  const totalQuestions = rows.reduce(
    (sum, r) => sum + (r.messages ?? []).filter((m) => m.role === "user").length,
    0,
  );

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 lg:py-8 max-w-5xl mx-auto">
      <div className="flex items-center gap-2 mb-1">
        <Sparkles className="w-5 h-5 text-[#36671E]" />
        <h1 className="text-2xl font-black text-[#18181B]">Assistant chats</h1>
      </div>
      <p className="text-sm text-[#71717A] mb-6">
        What clients ask the in-portal assistant — {rows.length} conversation{rows.length === 1 ? "" : "s"} ·{" "}
        {totalQuestions} question{totalQuestions === 1 ? "" : "s"}. Recurring questions are a missing feature, not a bad answer.
      </p>

      {tableMissing ? (
        <div className="bg-white border border-[#E8E6E0] rounded-2xl p-8">
          <p className="text-sm font-black text-[#18181B] mb-2">Transcripts aren&apos;t being stored yet</p>
          <p className="text-sm text-[#71717A] mb-4">
            The assistant works — this page just has nowhere to read from. Run this once in Supabase:
          </p>
          <pre className="text-xs bg-[#FAFAF7] border border-[#E8E6E0] rounded-xl p-4 overflow-x-auto text-[#3F3F46]">{`create table portal_ai_chats (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  business text,
  messages jsonb not null default '[]',
  message_count int default 0,
  lang text default 'en',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index on portal_ai_chats (email);
create index on portal_ai_chats (updated_at desc);`}</pre>
        </div>
      ) : rows.length === 0 ? (
        <div className="bg-white border border-[#E8E6E0] rounded-2xl p-12 text-center">
          <MessageSquare className="w-10 h-10 text-[#A1A1AA] mx-auto mb-3" />
          <p className="text-sm text-[#71717A]">
            No assistant conversations yet. They appear here as soon as a client asks something in their portal.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {rows.map((r) => (
            <div key={r.id} className="bg-white border border-[#E8E6E0] rounded-2xl overflow-hidden">
              <div className="flex items-center justify-between gap-3 px-5 py-3 bg-[#FAFAF7] border-b border-[#E8E6E0] flex-wrap">
                <div className="min-w-0">
                  <p className="text-sm font-black text-[#18181B] truncate">{r.business || r.email}</p>
                  {r.business && <p className="text-xs text-[#71717A] truncate">{r.email}</p>}
                </div>
                <div className="flex items-center gap-2 text-xs text-[#71717A]">
                  {r.lang && (
                    <span className="px-2 py-0.5 rounded-full bg-[#EEF5EA] text-[#36671E] font-black uppercase">{r.lang}</span>
                  )}
                  <span>{new Date(r.updated_at).toLocaleString()}</span>
                </div>
              </div>
              <div className="p-5 space-y-2.5">
                {(r.messages ?? []).map((m, i) => (
                  <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[80%] px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap rounded-2xl ${
                        m.role === "user"
                          ? "bg-[#36671E] text-[#FAFAF7] rounded-br-md"
                          : "bg-[#F5F4EF] text-[#3F3F46] rounded-bl-md"
                      }`}
                    >
                      {m.content}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
