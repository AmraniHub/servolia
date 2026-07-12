"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import type { Build } from "@/lib/supabase";
import { LogOut, Send, MessageSquare, Clock, CreditCard, CheckCircle2, Users, CalendarCheck, Megaphone } from "lucide-react";

interface Message {
  id: string;
  sender: "client" | "admin";
  body: string;
  created_at: string;
}

interface PortalLead {
  created_at: string;
  qualified: boolean;
  contact: string | null;
  excerpt: string;
  fromAds: boolean;
}

interface PortalStats {
  monthEnquiries: number;
  monthBookings: number;
  monthContacts: number;
}

const STATUS_LABEL: Record<Build["status"], { label: string; color: string; bg: string }> = {
  intake: { label: "Awaiting your intake", color: "#92400E", bg: "#FEF3C7" },
  building: { label: "In progress", color: "#1D4ED8", bg: "#DBEAFE" },
  review: { label: "Ready for your review", color: "#5B21B6", bg: "#EDE9FE" },
  delivered: { label: "Delivered", color: "#0369A1", bg: "#E0F2FE" },
  live: { label: "Live", color: "#166534", bg: "#DCFCE7" },
};

function formatDate(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export default function PortalDashboard({ email, builds }: { email: string; builds: Build[] }) {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [leads, setLeads] = useState<PortalLead[]>([]);
  const [stats, setStats] = useState<PortalStats | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/portal/messages")
      .then((r) => r.json())
      .then((d) => setMessages(d.messages ?? []))
      .finally(() => setLoading(false));
    fetch("/api/portal/leads")
      .then((r) => r.json())
      .then((d) => {
        setLeads(d.leads ?? []);
        setStats(d.stats ?? null);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage() {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    setInput("");
    try {
      const res = await fetch("/api/portal/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: text }),
      });
      const data = await res.json();
      if (data.message) setMessages((prev) => [...prev, data.message]);
    } finally {
      setSending(false);
    }
  }

  async function handleLogout() {
    await fetch("/api/portal/logout", { method: "POST" });
    router.push("/portal/login");
    router.refresh();
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-28 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-black text-[#18181B]">Your account</h1>
          <p className="text-sm text-[#71717A]">{email}</p>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-[#E8E6E0] text-[#52525B] text-sm font-semibold hover:bg-[#F5F4EF] transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" /> Sign out
        </button>
      </div>

      {/* Build status cards */}
      {builds.length > 0 && (
        <div className="grid sm:grid-cols-2 gap-4 mb-8">
          {builds.map((b) => {
            const s = STATUS_LABEL[b.status] ?? STATUS_LABEL.intake;
            return (
              <div key={b.id} className="bg-white border border-[#E8E6E0] rounded-2xl p-5">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <h3 className="font-black text-[#18181B]">{b.plan_name ?? b.plan}</h3>
                  <span className="text-[10px] font-black px-2.5 py-1 rounded-full whitespace-nowrap" style={{ background: s.bg, color: s.color }}>
                    {s.label}
                  </span>
                </div>
                <div className="space-y-2 text-sm text-[#52525B]">
                  <div className="flex items-center gap-2">
                    <CreditCard className="w-3.5 h-3.5 text-[#A1A1AA]" />
                    €{Number(b.deposit_paid).toLocaleString()} paid
                    {b.balance_due > 0 && <span className="text-[#A1A1AA]">· €{Number(b.balance_due).toLocaleString()} due on delivery</span>}
                  </div>
                  {b.deadline && (
                    <div className="flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 text-[#A1A1AA]" /> Target delivery: {formatDate(b.deadline)}
                    </div>
                  )}
                  {b.live_at && (
                    <div className="flex items-center gap-2 text-[#166534]">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Live since {formatDate(b.live_at)}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* This-month stats + lead history — the client's own pipeline */}
      {stats && (
        <div className="grid grid-cols-3 gap-3 mb-4">
          {[
            { icon: Users, label: "Enquiries this month", value: stats.monthEnquiries },
            { icon: CalendarCheck, label: "Booking requests", value: stats.monthBookings, highlight: true },
            { icon: Megaphone, label: "Contacts captured", value: stats.monthContacts },
          ].map((s) => (
            <div key={s.label} className={`rounded-2xl border p-4 ${s.highlight ? "bg-[#EEF5EA] border-[#36671E]/20" : "bg-white border-[#E8E6E0]"}`}>
              <s.icon className={`w-4 h-4 mb-2 ${s.highlight ? "text-[#36671E]" : "text-[#A1A1AA]"}`} />
              <p className={`text-2xl font-black ${s.highlight ? "text-[#36671E]" : "text-[#18181B]"}`}>{s.value}</p>
              <p className="text-[11px] text-[#71717A] mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {leads.length > 0 && (
        <div className="bg-white border border-[#E8E6E0] rounded-2xl overflow-hidden mb-8">
          <div className="px-5 py-4 border-b border-[#E8E6E0] flex items-center gap-2 bg-[#FAFAF7]">
            <Users className="w-4 h-4 text-[#36671E]" />
            <h2 className="font-black text-[#18181B] text-sm">Your leads</h2>
            <span className="text-xs text-[#A1A1AA]">— every enquiry your assistant handled</span>
          </div>
          <div className="max-h-80 overflow-y-auto divide-y divide-[#F5F4EF]">
            {leads.map((l, i) => (
              <div key={i} className="px-5 py-3 flex items-start gap-3">
                <span
                  className={`mt-1 text-[10px] font-black px-2 py-0.5 rounded-full whitespace-nowrap ${
                    l.qualified ? "bg-[#DCFCE7] text-[#166534]" : "bg-[#F5F4EF] text-[#71717A]"
                  }`}
                >
                  {l.qualified ? "Booking" : "Enquiry"}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-[#18181B] truncate">{l.excerpt || "(conversation)"}</p>
                  <p className="text-[11px] text-[#A1A1AA] mt-0.5">
                    {formatDate(l.created_at)}
                    {l.contact ? ` · ${l.contact}` : ""}
                    {l.fromAds ? " · from your ads" : ""}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Message thread */}
      <div className="bg-white border border-[#E8E6E0] rounded-2xl overflow-hidden flex flex-col" style={{ height: "560px" }}>
        <div className="px-5 py-4 border-b border-[#E8E6E0] flex items-center gap-2 bg-[#FAFAF7]">
          <MessageSquare className="w-4 h-4 text-[#36671E]" />
          <h2 className="font-black text-[#18181B] text-sm">Message us</h2>
          <span className="text-xs text-[#A1A1AA]">— we usually reply within a few hours</span>
        </div>

        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-3">
          {loading ? (
            <p className="text-sm text-[#A1A1AA] text-center mt-8">Loading…</p>
          ) : messages.length === 0 ? (
            <p className="text-sm text-[#A1A1AA] text-center mt-8">No messages yet — say hello 👋</p>
          ) : (
            messages.map((m) => (
              <div key={m.id} className={`flex ${m.sender === "client" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                    m.sender === "client"
                      ? "bg-[#36671E] text-[#FAFAF7] rounded-br-sm"
                      : "bg-[#F5F4EF] text-[#18181B] rounded-bl-sm border border-[#E8E6E0]"
                  }`}
                >
                  {m.body}
                  <div className={`text-[10px] mt-1 ${m.sender === "client" ? "text-[#FAFAF7]/60" : "text-[#A1A1AA]"}`}>
                    {new Date(m.created_at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>

        <div className="border-t border-[#E8E6E0] p-3 flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
            placeholder="Type a message…"
            className="flex-1 bg-[#FAFAF7] text-[#18181B] placeholder-[#A1A1AA] text-sm rounded-xl px-4 py-2.5 border border-[#E8E6E0] focus:outline-none focus:border-[#36671E] transition-colors"
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || sending}
            className="w-10 h-10 rounded-xl bg-[#36671E] flex items-center justify-center disabled:opacity-40 hover:bg-[#295115] transition-colors flex-shrink-0"
          >
            <Send className="w-4 h-4 text-[#FAFAF7]" />
          </button>
        </div>
      </div>
    </div>
  );
}
