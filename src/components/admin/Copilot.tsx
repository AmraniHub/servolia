"use client";

import { useState, useRef, useEffect } from "react";
import { Sparkles, X, Send, Loader2 } from "lucide-react";

/**
 * Solia Copilot — a floating AI business partner, available on every admin page.
 * Read-only: it answers questions over the live CRM snapshot and advises.
 * Colors follow the admin theme (green light / red dark) via the [data-admin-theme] root.
 */

interface Msg { role: "user" | "assistant"; content: string }

const SUGGESTIONS = [
  "How's the business doing today?",
  "Any leads or messages I need to act on?",
  "Which prospects are stalled?",
  "What should I focus on this week?",
];

export default function Copilot() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading]);
  useEffect(() => { if (open) inputRef.current?.focus(); }, [open]);

  async function send(text: string) {
    const q = text.trim();
    if (!q || loading) return;
    const next = [...messages, { role: "user" as const, content: q }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/admin/copilot", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });
      const data = await res.json();
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply ?? "…" }]);
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "Connection issue — try again." }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/* Launcher */}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Open copilot"
        className="fixed bottom-5 right-5 z-40 w-14 h-14 rounded-full bg-[#36671E] text-[#FAFAF7] shadow-elevated flex items-center justify-center hover:scale-105 transition-transform"
      >
        {open ? <X className="w-6 h-6" /> : <Sparkles className="w-6 h-6" />}
      </button>

      {open && (
        <div className="fixed bottom-24 right-5 z-40 w-[360px] max-w-[calc(100vw-2.5rem)] rounded-2xl overflow-hidden shadow-elevated border border-[#E8E6E0] bg-white flex flex-col" style={{ height: "560px" }}>
          {/* Header */}
          <div className="px-4 py-3 flex items-center gap-2.5 bg-[#36671E] flex-shrink-0">
            <div className="w-8 h-8 rounded-full bg-[#FAFAF7]/15 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-[#FAFAF7]" />
            </div>
            <div>
              <p className="text-[#FAFAF7] text-sm font-black">Solia Copilot</p>
              <p className="text-[#FAFAF7]/70 text-xs">Knows your live business</p>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto bg-[#FAFAF7] p-3 flex flex-col gap-2.5">
            {messages.length === 0 && (
              <div className="mt-2">
                <p className="text-sm text-[#71717A] px-1 mb-3">Ask me anything about your business — I can see your live numbers, leads, calls and messages.</p>
                <div className="flex flex-col gap-1.5">
                  {SUGGESTIONS.map((s) => (
                    <button key={s} onClick={() => send(s)}
                      className="text-left text-sm px-3 py-2 rounded-lg bg-white border border-[#E8E6E0] text-[#36671E] font-semibold hover:bg-[#EEF5EA] transition-colors">
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] px-3.5 py-2 rounded-xl text-sm leading-relaxed whitespace-pre-wrap ${
                  m.role === "user" ? "bg-[#36671E] text-[#FAFAF7] rounded-br-sm" : "bg-white text-[#18181B] rounded-bl-sm border border-[#E8E6E0]"
                }`}>
                  {m.content}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="bg-white border border-[#E8E6E0] rounded-xl px-4 py-3 flex gap-1.5 items-center">
                  <Loader2 className="w-4 h-4 text-[#36671E] animate-spin" />
                  <span className="text-xs text-[#71717A]">Thinking…</span>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="bg-white border-t border-[#E8E6E0] p-2.5 flex gap-2 flex-shrink-0">
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
              placeholder="Ask your copilot…"
              className="flex-1 bg-[#FAFAF7] text-[#18181B] placeholder-[#A1A1AA] text-sm rounded-lg px-3.5 py-2 border border-[#E8E6E0] focus:outline-none focus:border-[#36671E]"
            />
            <button onClick={() => send(input)} disabled={!input.trim() || loading}
              className="w-9 h-9 rounded-lg bg-[#36671E] flex items-center justify-center disabled:opacity-40 hover:bg-[#295115] transition-colors flex-shrink-0">
              <Send className="w-4 h-4 text-[#FAFAF7]" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
