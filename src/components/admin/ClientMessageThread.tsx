"use client";

import { useState, useEffect, useRef } from "react";
import { Send, Loader2, MessageSquare } from "lucide-react";

interface Message {
  id: string;
  sender: "client" | "admin";
  body: string;
  created_at: string;
}

export default function ClientMessageThread({ email, buildId }: { email: string; buildId: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`/api/admin/client-messages?email=${encodeURIComponent(email)}`)
      .then((r) => r.json())
      .then((d) => setMessages(d.messages ?? []))
      .finally(() => setLoading(false));
  }, [email]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendReply() {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    setInput("");
    try {
      const res = await fetch("/api/admin/client-messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, buildId, body: text }),
      });
      const data = await res.json();
      if (data.message) setMessages((prev) => [...prev, data.message]);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="bg-white border border-[#E8E6E0] rounded-2xl overflow-hidden flex flex-col" style={{ height: "440px" }}>
      <div className="px-5 py-3.5 border-b border-[#E8E6E0] flex items-center gap-2 bg-[#FAFAF7]">
        <MessageSquare className="w-4 h-4 text-[#36671E]" />
        <h2 className="font-black text-[#18181B] text-sm">Client messages</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2.5">
        {loading ? (
          <p className="text-sm text-[#A1A1AA] text-center mt-6">Loading…</p>
        ) : messages.length === 0 ? (
          <p className="text-sm text-[#A1A1AA] text-center mt-6">No messages yet.</p>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={`flex ${m.sender === "admin" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[80%] px-3.5 py-2 rounded-xl text-sm leading-relaxed ${
                  m.sender === "admin"
                    ? "bg-[#36671E] text-[#FAFAF7] rounded-br-sm"
                    : "bg-[#F5F4EF] text-[#18181B] rounded-bl-sm border border-[#E8E6E0]"
                }`}
              >
                {m.body}
                <div className={`text-[10px] mt-1 ${m.sender === "admin" ? "text-[#FAFAF7]/60" : "text-[#A1A1AA]"}`}>
                  {new Date(m.created_at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-[#E8E6E0] p-2.5 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendReply(); } }}
          placeholder="Reply to client…"
          className="flex-1 bg-[#FAFAF7] text-[#18181B] placeholder-[#A1A1AA] text-sm rounded-lg px-3.5 py-2 border border-[#E8E6E0] focus:outline-none focus:border-[#36671E] transition-colors"
        />
        <button
          onClick={sendReply}
          disabled={!input.trim() || sending}
          className="w-9 h-9 rounded-lg bg-[#36671E] flex items-center justify-center disabled:opacity-40 hover:bg-[#295115] transition-colors flex-shrink-0"
        >
          {sending ? <Loader2 className="w-4 h-4 text-[#FAFAF7] animate-spin" /> : <Send className="w-4 h-4 text-[#FAFAF7]" />}
        </button>
      </div>
    </div>
  );
}
