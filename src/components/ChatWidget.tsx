"use client";

import { useState, useEffect, useRef } from "react";
import { MessageSquare, X, Send, Bot, Minimize2 } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const WORKER_URL = process.env.NEXT_PUBLIC_CHAT_WORKER_URL ?? "https://servolia-chat.workers.dev";

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [leadCaptured, setLeadCaptured] = useState(false);
  const [hasGreeted, setHasGreeted] = useState(false);
  const [pulse, setPulse] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Stop pulsing after 8 seconds
  useEffect(() => {
    const t = setTimeout(() => setPulse(false), 8000);
    return () => clearTimeout(t);
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Focus input when opened
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // Greet on first open
  useEffect(() => {
    if (open && !hasGreeted) {
      setHasGreeted(true);
      setLoading(true);
      setTimeout(() => {
        setMessages([{
          role: "assistant",
          content: "Hi! 👋 I'm Solia, Servolia's AI assistant. What kind of business do you run?",
        }]);
        setLoading(false);
      }, 600);
    }
  }, [open, hasGreeted]);

  async function sendMessage(text: string) {
    if (!text.trim() || loading) return;

    const userMessage: Message = { role: "user", content: text };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch(`${WORKER_URL}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages }),
      });

      const data = await res.json() as { reply: string; leadCaptured: boolean };

      setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
      if (data.leadCaptured) setLeadCaptured(true);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Sorry, I'm having a connection issue. Please email us at hello@servolia.com 🙏" },
      ]);
    } finally {
      setLoading(false);
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const quickReplies = messages.length === 1 && !loading ? [
    "Dental clinic",
    "Aesthetic clinic",
    "Real estate",
    "Home services",
    "Restaurant",
  ] : [];

  return (
    <>
      {/* Floating button */}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-2">
        {/* Tooltip bubble */}
        {!open && pulse && (
          <div className="bg-white border border-[#E2E8F0] rounded-xl px-3 py-2 shadow-lg text-xs font-semibold text-[#080E1C] whitespace-nowrap animate-bounce">
            💬 Ask Solia anything
          </div>
        )}

        <button
          onClick={() => setOpen((o) => !o)}
          aria-label="Open chat"
          className={`w-14 h-14 rounded-full shadow-2xl flex items-center justify-center transition-all duration-300 ${
            open
              ? "bg-[#1E293B] rotate-0"
              : "bg-gradient-to-br from-[#95BF47] to-[#6BA52A] hover:scale-110"
          } ${pulse && !open ? "ring-4 ring-[#95BF47]/40 ring-offset-2" : ""}`}
        >
          {open ? (
            <X className="w-5 h-5 text-white" />
          ) : (
            <MessageSquare className="w-6 h-6 text-white fill-white" />
          )}
        </button>
      </div>

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-24 right-5 z-50 w-[340px] sm:w-[380px] rounded-2xl overflow-hidden shadow-2xl shadow-black/30 border border-white/10 flex flex-col"
          style={{ maxHeight: "520px" }}>

          {/* Header */}
          <div className="bg-gradient-to-r from-[#080E1C] to-[#111827] px-4 py-3 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#95BF47] to-[#6BA52A] flex items-center justify-center">
                <Bot className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-white text-sm font-bold">Solia by Servolia</p>
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse" />
                  <span className="text-[#10B981] text-xs">Online · replies instantly</span>
                </div>
              </div>
            </div>
            <button onClick={() => setOpen(false)} className="text-[#475569] hover:text-white transition-colors">
              <Minimize2 className="w-4 h-4" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto bg-[#0F172A] p-3 flex flex-col gap-2.5" style={{ minHeight: "280px", maxHeight: "360px" }}>
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                {m.role === "assistant" && (
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#95BF47] to-[#6BA52A] flex items-center justify-center flex-shrink-0 mr-2 mt-0.5">
                    <Bot className="w-3 h-3 text-white" />
                  </div>
                )}
                <div className={`max-w-[82%] px-3 py-2 rounded-xl text-sm leading-relaxed ${
                  m.role === "user"
                    ? "bg-gradient-to-r from-[#95BF47] to-[#6BA52A] text-[#0B1800] rounded-br-sm"
                    : "bg-[#1E293B] text-[#E2E8F0] rounded-bl-sm border border-white/5"
                }`}>
                  {m.content}
                </div>
              </div>
            ))}

            {/* Typing indicator */}
            {loading && (
              <div className="flex justify-start items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#95BF47] to-[#6BA52A] flex items-center justify-center flex-shrink-0">
                  <Bot className="w-3 h-3 text-white" />
                </div>
                <div className="bg-[#1E293B] border border-white/5 rounded-xl px-4 py-3 flex gap-1.5 items-center">
                  {[0, 1, 2].map((i) => (
                    <span key={i} className="w-1.5 h-1.5 rounded-full bg-[#94A3B8] inline-block"
                      style={{ animation: `pulse 1.2s ${i * 0.15}s infinite` }} />
                  ))}
                </div>
              </div>
            )}

            {/* Quick replies */}
            {quickReplies.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-1">
                {quickReplies.map((r) => (
                  <button key={r} onClick={() => sendMessage(r)}
                    className="text-xs px-3 py-1.5 rounded-full border border-[#95BF47]/40 text-[#93C5FD] hover:bg-[#95BF47]/10 transition-colors">
                    {r}
                  </button>
                ))}
              </div>
            )}

            {/* Lead captured badge */}
            {leadCaptured && (
              <div className="mx-auto px-3 py-1.5 rounded-full bg-[#10B981]/15 border border-[#10B981]/30 text-[#34D399] text-xs font-semibold text-center">
                ✓ Our team has been notified — audit incoming!
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="bg-[#0F172A] border-t border-white/5 px-3 py-2.5 flex gap-2 flex-shrink-0">
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message…"
              className="flex-1 bg-[#1E293B] text-[#E2E8F0] placeholder-[#475569] text-sm rounded-xl px-3 py-2 border border-white/5 focus:outline-none focus:border-[#95BF47]/50 transition-colors"
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || loading}
              className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#95BF47] to-[#6BA52A] flex items-center justify-center disabled:opacity-40 hover:opacity-90 transition-opacity flex-shrink-0"
            >
              <Send className="w-3.5 h-3.5 text-white" />
            </button>
          </div>

          {/* Footer */}
          <div className="bg-[#0F172A] text-center pb-2">
            <span className="text-[#1E293B] text-[10px]">Powered by <span className="text-[#95BF47] font-semibold">Servolia AI</span></span>
          </div>
        </div>
      )}
    </>
  );
}
