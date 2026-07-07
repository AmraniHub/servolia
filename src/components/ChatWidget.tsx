"use client";

import { useState, useEffect, useRef } from "react";
import { MessageSquare, X, Send, Bot, Minimize2 } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export interface ChatWidgetProps {
  /** When set, chats route to this client's trained AI receptionist. */
  siteSlug?: string;
  /** Header title, e.g. "Front desk · Meridian Dental". Defaults to Servolia. */
  brandName?: string;
  /** Bot avatar/first-line name. */
  botName?: string;
  /** Brand hex for the launcher, header, bubbles, send button. */
  accent?: string;
  /** First message shown when the widget opens. */
  greeting?: string;
  /** Quick-reply chips shown after the greeting. */
  quickReplies?: string[];
  /** Small "Powered by Servolia AI" footer. Off for white-labelled client sites. */
  poweredBy?: boolean;
}

function getSessionId(scope: string): string {
  if (typeof window === "undefined") return "";
  const KEY = `servolia_chat_sid_${scope}`;
  let sid = localStorage.getItem(KEY);
  if (!sid) {
    sid = crypto.randomUUID();
    localStorage.setItem(KEY, sid);
  }
  return sid;
}

export default function ChatWidget({
  siteSlug,
  brandName = "Solia by Servolia",
  botName = "Solia",
  accent = "#36671E",
  greeting,
  quickReplies: quickRepliesProp,
  poweredBy = true,
}: ChatWidgetProps = {}) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [qualified, setQualified] = useState(false);
  const [hasGreeted, setHasGreeted] = useState(false);
  const [pulse, setPulse] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const openingLine =
    greeting ??
    (siteSlug
      ? "Hi 👋 How can I help you today?"
      : "Hi! 👋 I'm Solia, Servolia's AI assistant. What kind of business do you run?");

  const defaultQuickReplies = siteSlug
    ? ["Book an appointment", "Opening hours", "Prices"]
    : ["Dental clinic", "Aesthetic clinic", "Real estate", "Home services", "Med spa"];
  const quickReplyOptions = quickRepliesProp ?? defaultQuickReplies;

  useEffect(() => {
    const t = setTimeout(() => setPulse(false), 8000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (open && !hasGreeted) {
      setHasGreeted(true);
      setLoading(true);
      const t = setTimeout(() => {
        setMessages([{ role: "assistant", content: openingLine }]);
        setLoading(false);
      }, 500);
      return () => clearTimeout(t);
    }
  }, [open, hasGreeted, openingLine]);

  async function sendMessage(text: string) {
    if (!text.trim() || loading) return;

    const userMessage: Message = { role: "user", content: text };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages,
          sessionId: getSessionId(siteSlug ?? "servolia"),
          pageUrl: typeof window !== "undefined" ? window.location.pathname : "/",
          siteSlug,
        }),
      });
      const data = (await res.json()) as { reply: string; qualified: boolean };
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
      if (data.qualified) setQualified(true);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Sorry, I'm having a connection issue. Please try again in a moment 🙏" },
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

  const quickReplies = messages.length === 1 && !loading ? quickReplyOptions : [];

  const confirmationText = siteSlug
    ? "✓ Got it — the team will confirm shortly!"
    : "✓ Our team has been notified — audit incoming!";

  return (
    <>
      <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-2">
        {!open && pulse && (
          <div className="bg-white border border-[#E8E6E0] rounded-xl px-3 py-2 shadow-card text-xs font-semibold text-[#18181B] whitespace-nowrap animate-bounce">
            💬 {siteSlug ? "Chat with us" : "Ask Solia anything"}
          </div>
        )}

        <button
          onClick={() => setOpen((o) => !o)}
          aria-label="Open chat"
          style={open ? { background: "#18181B" } : { background: accent }}
          className={`w-14 h-14 rounded-full shadow-elevated flex items-center justify-center transition-all duration-300 ${
            open ? "" : "hover:scale-110"
          }`}
        >
          {open ? (
            <X className="w-5 h-5 text-[#FAFAF7]" />
          ) : (
            <MessageSquare className="w-6 h-6 text-[#FAFAF7] fill-[#FAFAF7]" />
          )}
        </button>
      </div>

      {open && (
        <div
          className="fixed bottom-24 right-5 z-50 w-[340px] sm:w-[380px] rounded-2xl overflow-hidden shadow-elevated border border-[#E8E6E0] flex flex-col bg-white"
          style={{ maxHeight: "540px" }}
        >
          {/* Header */}
          <div className="px-4 py-3 flex items-center justify-between flex-shrink-0" style={{ background: accent }}>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-[#FAFAF7]/15 flex items-center justify-center">
                <Bot className="w-4 h-4 text-[#FAFAF7]" />
              </div>
              <div>
                <p className="text-[#FAFAF7] text-sm font-bold">{brandName}</p>
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#0CA6E9] animate-pulse" />
                  <span className="text-[#FAFAF7]/80 text-xs">Online · replies instantly</span>
                </div>
              </div>
            </div>
            <button onClick={() => setOpen(false)} className="text-[#FAFAF7]/60 hover:text-[#FAFAF7] transition-colors">
              <Minimize2 className="w-4 h-4" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto bg-[#FAFAF7] p-3 flex flex-col gap-2.5" style={{ minHeight: "300px", maxHeight: "380px" }}>
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                {m.role === "assistant" && (
                  <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mr-2 mt-0.5" style={{ background: accent }}>
                    <Bot className="w-3 h-3 text-[#FAFAF7]" />
                  </div>
                )}
                <div
                  className={`max-w-[82%] px-3 py-2 rounded-xl text-sm leading-relaxed ${
                    m.role === "user"
                      ? "text-[#FAFAF7] rounded-br-sm"
                      : "bg-white text-[#18181B] rounded-bl-sm border border-[#E8E6E0]"
                  }`}
                  style={m.role === "user" ? { background: accent } : undefined}
                >
                  {m.content}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start items-center gap-2">
                <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: accent }}>
                  <Bot className="w-3 h-3 text-[#FAFAF7]" />
                </div>
                <div className="bg-white border border-[#E8E6E0] rounded-xl px-4 py-3 flex gap-1.5 items-center">
                  {[0, 1, 2].map((i) => (
                    <span key={i} className="w-1.5 h-1.5 rounded-full bg-[#A1A1AA] inline-block" style={{ animation: `pulse 1.2s ${i * 0.15}s infinite` }} />
                  ))}
                </div>
              </div>
            )}

            {quickReplies.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-1">
                {quickReplies.map((r) => (
                  <button
                    key={r}
                    onClick={() => sendMessage(r)}
                    className="text-xs px-3 py-1.5 rounded-full border bg-white hover:bg-[#F5F4EF] transition-colors"
                    style={{ borderColor: `${accent}55`, color: accent }}
                  >
                    {r}
                  </button>
                ))}
              </div>
            )}

            {qualified && (
              <div className="mx-auto px-3 py-1.5 rounded-full bg-[#EEF5EA] border border-[#36671E]/30 text-[#36671E] text-xs font-semibold text-center">
                {confirmationText}
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="bg-white border-t border-[#E8E6E0] px-3 py-2.5 flex gap-2 flex-shrink-0">
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message…"
              className="flex-1 bg-[#FAFAF7] text-[#18181B] placeholder-[#A1A1AA] text-sm rounded-xl px-3 py-2 border border-[#E8E6E0] focus:outline-none transition-colors"
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || loading}
              className="w-9 h-9 rounded-xl flex items-center justify-center disabled:opacity-40 transition-opacity flex-shrink-0"
              style={{ background: accent }}
            >
              <Send className="w-3.5 h-3.5 text-[#FAFAF7]" />
            </button>
          </div>

          {/* Footer */}
          {poweredBy && (
            <div className="bg-white text-center pb-2">
              <span className="text-[#A1A1AA] text-[10px]">
                Powered by <span className="text-[#36671E] font-semibold">Servolia AI</span>
              </span>
            </div>
          )}
          <div className="sr-only">{botName}</div>
        </div>
      )}
    </>
  );
}
