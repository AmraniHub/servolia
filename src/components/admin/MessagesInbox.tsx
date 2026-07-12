"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { MessageSquare, Send, Loader2, PenSquare, ArrowLeft, Search } from "lucide-react";

/**
 * Unified client-messages inbox. Left: every conversation with unread badges.
 * Right: the thread, where you reply or start a new message to any client.
 */

interface Thread { email: string; lastBody: string; lastAt: string; lastSender: string; unread: number }
interface Contact { email: string; business: string | null }
interface Message { id: string; sender: "client" | "admin"; body: string; created_at: string }

export default function MessagesInbox() {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingThread, setLoadingThread] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [composing, setComposing] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadThreads = useCallback(async () => {
    const res = await fetch("/api/admin/messages");
    if (res.ok) {
      const d = await res.json();
      setThreads(d.threads ?? []);
      setContacts(d.contacts ?? []);
    }
  }, []);
  useEffect(() => { loadThreads(); }, [loadThreads]);

  const openThread = useCallback(async (email: string) => {
    setActive(email); setComposing(false); setLoadingThread(true); setMessages([]);
    try {
      const res = await fetch(`/api/admin/client-messages?email=${encodeURIComponent(email)}`);
      const d = await res.json();
      setMessages(d.messages ?? []);
      // clear the unread badge locally
      setThreads((prev) => prev.map((t) => (t.email === email ? { ...t, unread: 0 } : t)));
    } finally { setLoadingThread(false); }
  }, []);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  async function send() {
    const text = input.trim();
    const email = active;
    if (!text || !email || sending) return;
    setSending(true); setInput("");
    try {
      const res = await fetch("/api/admin/client-messages", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, body: text }),
      });
      const d = await res.json();
      if (d.message) {
        setMessages((prev) => [...prev, d.message]);
        loadThreads();
      }
    } finally { setSending(false); }
  }

  function startNew(email: string) {
    if (!email.trim()) return;
    setComposing(false);
    setNewEmail("");
    openThread(email.trim().toLowerCase());
  }

  const totalUnread = threads.reduce((s, t) => s + t.unread, 0);

  return (
    <div className="p-4 sm:p-6 max-w-6xl">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-black text-[#18181B] flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-[#36671E]" /> Messages
            {totalUnread > 0 && <span className="text-xs font-black px-2 py-0.5 rounded-full bg-[#36671E] text-white">{totalUnread}</span>}
          </h1>
          <p className="text-sm text-[#71717A]">Every client conversation in one place.</p>
        </div>
        <button onClick={() => { setComposing(true); setActive(null); }} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#36671E] text-white text-sm font-bold hover:bg-[#295115]">
          <PenSquare className="w-4 h-4" /> New message
        </button>
      </div>

      <div className="grid md:grid-cols-[300px_1fr] gap-4 bg-white border border-[#E8E6E0] rounded-2xl overflow-hidden" style={{ minHeight: "540px" }}>
        {/* Thread list */}
        <div className={`border-r border-[#E8E6E0] ${active || composing ? "hidden md:block" : ""}`}>
          {threads.length === 0 ? (
            <p className="text-sm text-[#A1A1AA] text-center p-8">No conversations yet.</p>
          ) : (
            <div className="divide-y divide-[#F5F4EF] max-h-[540px] overflow-y-auto">
              {threads.map((t) => (
                <button key={t.email} onClick={() => openThread(t.email)}
                  className={`w-full text-left px-4 py-3 hover:bg-[#FAFAF7] transition-colors ${active === t.email ? "bg-[#EEF5EA]" : ""}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-bold text-[#18181B] truncate">{t.email}</span>
                    {t.unread > 0 && <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full bg-[#36671E] text-white flex-shrink-0">{t.unread}</span>}
                  </div>
                  <p className="text-xs text-[#71717A] truncate mt-0.5">{t.lastSender === "admin" ? "You: " : ""}{t.lastBody}</p>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right pane */}
        <div className="flex flex-col" style={{ height: "540px" }}>
          {composing ? (
            <ComposeNew contacts={contacts} onPick={startNew} value={newEmail} setValue={setNewEmail} />
          ) : !active ? (
            <div className="flex-1 flex items-center justify-center text-sm text-[#A1A1AA]">
              Select a conversation, or start a new one.
            </div>
          ) : (
            <>
              <div className="px-4 py-3 border-b border-[#E8E6E0] bg-[#FAFAF7] flex items-center gap-2">
                <button onClick={() => setActive(null)} className="md:hidden text-[#52525B]"><ArrowLeft className="w-4 h-4" /></button>
                <span className="text-sm font-black text-[#18181B] truncate">{active}</span>
              </div>
              <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2.5">
                {loadingThread ? (
                  <p className="text-sm text-[#A1A1AA] text-center mt-6">Loading…</p>
                ) : messages.length === 0 ? (
                  <p className="text-sm text-[#A1A1AA] text-center mt-6">No messages yet — say hello 👋</p>
                ) : (
                  messages.map((m) => (
                    <div key={m.id} className={`flex ${m.sender === "admin" ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[80%] px-3.5 py-2 rounded-xl text-sm leading-relaxed ${
                        m.sender === "admin" ? "bg-[#36671E] text-[#FAFAF7] rounded-br-sm" : "bg-[#F5F4EF] text-[#18181B] rounded-bl-sm border border-[#E8E6E0]"
                      }`}>
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
                <input value={input} onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                  placeholder="Type a message to your client…"
                  className="flex-1 bg-[#FAFAF7] text-[#18181B] placeholder-[#A1A1AA] text-sm rounded-lg px-3.5 py-2 border border-[#E8E6E0] focus:outline-none focus:border-[#36671E]" />
                <button onClick={send} disabled={!input.trim() || sending}
                  className="w-9 h-9 rounded-lg bg-[#36671E] flex items-center justify-center disabled:opacity-40 hover:bg-[#295115] flex-shrink-0">
                  {sending ? <Loader2 className="w-4 h-4 text-white animate-spin" /> : <Send className="w-4 h-4 text-white" />}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
      <p className="text-xs text-[#A1A1AA] mt-3">Clients get an email + a portal notification for every message you send. They reply from their portal.</p>
    </div>
  );
}

function ComposeNew({ contacts, onPick, value, setValue }: {
  contacts: Contact[]; onPick: (email: string) => void; value: string; setValue: (v: string) => void;
}) {
  const filtered = value
    ? contacts.filter((c) => c.email.toLowerCase().includes(value.toLowerCase()) || (c.business ?? "").toLowerCase().includes(value.toLowerCase()))
    : contacts;
  return (
    <div className="p-5 flex flex-col h-full">
      <p className="text-sm font-black text-[#18181B] mb-3">New message to a client</p>
      <div className="relative mb-3">
        <Search className="w-4 h-4 text-[#A1A1AA] absolute left-3 top-1/2 -translate-y-1/2" />
        <input value={value} onChange={(e) => setValue(e.target.value)} placeholder="Search a client, or type an email…"
          className="w-full pl-9 pr-3 py-2.5 bg-[#FAFAF7] border border-[#E8E6E0] rounded-xl text-sm focus:outline-none focus:border-[#36671E]" />
      </div>
      <div className="flex-1 overflow-y-auto divide-y divide-[#F5F4EF] border border-[#E8E6E0] rounded-xl">
        {filtered.length === 0 && /@/.test(value) ? (
          <button onClick={() => onPick(value)} className="w-full text-left px-4 py-3 hover:bg-[#FAFAF7] text-sm font-bold text-[#36671E]">
            Start conversation with {value}
          </button>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-[#A1A1AA] text-center p-6">No matching clients.</p>
        ) : (
          filtered.map((c) => (
            <button key={c.email} onClick={() => onPick(c.email)} className="w-full text-left px-4 py-3 hover:bg-[#FAFAF7]">
              <p className="text-sm font-bold text-[#18181B]">{c.business ?? c.email}</p>
              {c.business && <p className="text-xs text-[#A1A1AA]">{c.email}</p>}
            </button>
          ))
        )}
      </div>
    </div>
  );
}
