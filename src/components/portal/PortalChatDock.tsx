"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { MessageCircle, X, Minus, Send, Loader2, Sparkles, UserRound, ArrowUpRight } from "lucide-react";

/**
 * Messenger-style chat dock for the client portal.
 *
 * Two deliberately SEPARATE channels behind one launcher, because the client
 * should never have to guess where a question goes:
 *
 *   ASSISTANT — instant AI, knows their account, answers "how / what / when"
 *               in seconds. Costs the founder nothing and never sleeps.
 *   ABDELALI  — the human thread (client_messages). Anything about money,
 *               scope, or a change to their site belongs here.
 *
 * The client is never trapped with the bot: the human tab is one tap away at
 * all times, and every assistant answer sits above a visible handoff button
 * that carries the conversation across as context. A support widget that
 * hides the human is the fastest way to lose a client who is already annoyed.
 *
 * Rendered as a fixed dock so it follows the client across every portal tab —
 * the full-height Messages tab still exists for reading a long thread, exactly
 * like Messenger's popup and its full page.
 */

type Channel = "assistant" | "human";
interface Msg { role: "user" | "assistant"; content: string }
interface HumanMsg { id: string; sender: "client" | "admin"; body: string; created_at: string }

const T = {
  en: {
    launcher: "Help",
    title: "Help",
    assistant: "Assistant", human: "Abdelali",
    assistantSub: "Instant answers about your account",
    humanSub: "Replies personally, usually within a few hours",
    greet: "Hi 👋 Ask me anything about your site, your plan, or your numbers. I can see your account, so the answers are yours — not generic.",
    suggestions: ["What plan am I on?", "How is my site doing?", "How do I get more enquiries?"],
    placeholder: "Ask a question…",
    humanPlaceholder: "Write to Abdelali…",
    thinking: "Thinking…",
    handoff: "Talk to Abdelali instead",
    handoffSent: "Sent to Abdelali with this conversation attached.",
    noHuman: "No messages yet. Anything about your site, billing or a change goes here.",
    minimize: "Minimize", close: "Close",
    sending: "Sending…",
  },
  fr: {
    launcher: "Aide",
    title: "Aide",
    assistant: "Assistante", human: "Abdelali",
    assistantSub: "Réponses instantanées sur votre compte",
    humanSub: "Répond personnellement, en général sous quelques heures",
    greet: "Bonjour 👋 Posez-moi une question sur votre site, votre formule ou vos chiffres. Je vois votre compte : les réponses sont les vôtres, pas des généralités.",
    suggestions: ["Quelle est ma formule ?", "Comment se porte mon site ?", "Comment avoir plus de demandes ?"],
    placeholder: "Posez votre question…",
    humanPlaceholder: "Écrire à Abdelali…",
    thinking: "Réflexion…",
    handoff: "Parler à Abdelali",
    handoffSent: "Envoyé à Abdelali avec cette conversation.",
    noHuman: "Aucun message. Tout ce qui concerne votre site, la facturation ou une modification passe ici.",
    minimize: "Réduire", close: "Fermer",
    sending: "Envoi…",
  },
};

export default function PortalChatDock({
  lang = "en",
  unreadHuman = 0,
  onOpenFullThread,
}: {
  lang?: "en" | "fr";
  unreadHuman?: number;
  onOpenFullThread?: () => void;
}) {
  const l = lang === "fr" ? ("fr" as const) : ("en" as const);
  const t = T[l];

  const [open, setOpen] = useState(false);
  const [channel, setChannel] = useState<Channel>("assistant");
  const [ai, setAi] = useState<Msg[]>([]);
  const [human, setHuman] = useState<HumanMsg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [ai, human, open, channel]);

  const loadHuman = useCallback(async () => {
    try {
      const res = await fetch("/api/portal/messages");
      if (res.ok) setHuman((await res.json()).messages ?? []);
    } catch { /* offline — the tab still opens */ }
  }, []);

  useEffect(() => {
    if (open && channel === "human") loadHuman();
  }, [open, channel, loadHuman]);

  async function askAssistant(question: string) {
    const next = [...ai, { role: "user" as const, content: question }];
    setAi(next);
    setInput("");
    setBusy(true);
    try {
      const res = await fetch("/api/portal/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next, lang: l }),
      });
      const d = await res.json();
      setAi([...next, { role: "assistant", content: d.reply ?? d.error ?? "…" }]);
    } catch {
      setAi([...next, { role: "assistant", content: t.handoff }]);
    } finally {
      setBusy(false);
    }
  }

  async function sendHuman(body: string) {
    setInput("");
    setBusy(true);
    try {
      await fetch("/api/portal/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      await loadHuman();
    } finally {
      setBusy(false);
    }
  }

  /** Hand the AI conversation to the human thread so nothing is retyped. */
  async function handoff() {
    const transcript = ai.map((m) => `${m.role === "user" ? "Me" : "Assistant"}: ${m.content}`).join("\n");
    const body = transcript
      ? (l === "fr"
          ? `Bonjour Abdelali — j'ai commencé avec l'assistante :\n\n${transcript}`
          : `Hi Abdelali — I started with the assistant:\n\n${transcript}`)
      : (l === "fr" ? "Bonjour Abdelali, j'ai une question." : "Hi Abdelali, I have a question.");
    setChannel("human");
    await sendHuman(body);
    setNote(t.handoffSent);
    setTimeout(() => setNote(""), 4000);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const v = input.trim();
    if (!v || busy) return;
    if (channel === "assistant") askAssistant(v);
    else sendHuman(v);
  }

  const unread = unreadHuman > 0 && !open;

  return (
    <>
      {/* Launcher */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label={t.launcher}
          className="fixed bottom-5 right-5 z-40 flex items-center gap-2 pl-4 pr-5 py-3 rounded-full bg-[var(--p-accent)] text-[var(--p-accent-fg)] font-black text-sm shadow-lg hover:opacity-90 transition-opacity"
        >
          <MessageCircle className="w-5 h-5" />
          {t.launcher}
          {unread && (
            <span className="ml-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[#EF4444] text-white text-[10px] font-black flex items-center justify-center">
              {unreadHuman > 9 ? "9+" : unreadHuman}
            </span>
          )}
        </button>
      )}

      {/* Dock */}
      {open && (
        <div className="fixed bottom-0 right-0 sm:bottom-5 sm:right-5 z-40 w-full sm:w-[380px] h-[70vh] sm:h-[560px] flex flex-col rounded-t-2xl sm:rounded-2xl border border-[var(--p-border)] bg-[var(--p-surface)] shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--p-border)] bg-[var(--p-card)]">
            <p className="text-sm font-black text-[var(--p-text)]">{t.title}</p>
            <div className="flex items-center gap-1">
              {onOpenFullThread && (
                <button onClick={() => { onOpenFullThread(); setOpen(false); }}
                  aria-label="Open full thread"
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--p-muted)] hover:bg-[var(--p-raised)]">
                  <ArrowUpRight className="w-4 h-4" />
                </button>
              )}
              <button onClick={() => setOpen(false)} aria-label={t.minimize}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--p-muted)] hover:bg-[var(--p-raised)]">
                <Minus className="w-4 h-4" />
              </button>
              <button onClick={() => setOpen(false)} aria-label={t.close}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--p-muted)] hover:bg-[var(--p-raised)]">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Channel switch — the two are never mixed */}
          <div className="flex gap-1 p-1 m-3 rounded-xl bg-[var(--p-raised)]">
            {([
              { k: "assistant" as Channel, label: t.assistant, Icon: Sparkles },
              { k: "human" as Channel, label: t.human, Icon: UserRound },
            ]).map(({ k, label, Icon }) => (
              <button key={k} onClick={() => setChannel(k)}
                aria-pressed={channel === k}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-black transition-colors ${
                  channel === k ? "bg-[var(--p-accent)] text-[var(--p-accent-fg)]" : "text-[var(--p-muted)] hover:text-[var(--p-text)]"
                }`}>
                <Icon className="w-3.5 h-3.5" /> {label}
                {k === "human" && unreadHuman > 0 && (
                  <span className="ml-0.5 w-1.5 h-1.5 rounded-full bg-[#EF4444]" />
                )}
              </button>
            ))}
          </div>
          <p className="px-4 -mt-1 mb-2 text-[11px] text-[var(--p-muted)]">
            {channel === "assistant" ? t.assistantSub : t.humanSub}
          </p>

          {/* Thread */}
          <div className="flex-1 overflow-y-auto px-4 pb-2 space-y-2.5">
            {channel === "assistant" ? (
              <>
                <Bubble side="in">{t.greet}</Bubble>
                {ai.map((m, i) => (
                  <Bubble key={i} side={m.role === "user" ? "out" : "in"}>{m.content}</Bubble>
                ))}
                {busy && (
                  <Bubble side="in">
                    <span className="inline-flex items-center gap-1.5 text-[var(--p-muted)]">
                      <Loader2 className="w-3 h-3 animate-spin" /> {t.thinking}
                    </span>
                  </Bubble>
                )}
                {ai.length === 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {t.suggestions.map((s) => (
                      <button key={s} onClick={() => askAssistant(s)}
                        className="px-2.5 py-1.5 rounded-full border border-[var(--p-border)] text-[11px] font-semibold text-[var(--p-muted)] hover:text-[var(--p-text)] hover:border-[var(--p-accent)] transition-colors">
                        {s}
                      </button>
                    ))}
                  </div>
                )}
                {ai.length > 0 && (
                  <button onClick={handoff} disabled={busy}
                    className="w-full mt-2 py-2 rounded-xl border border-[var(--p-border)] text-xs font-bold text-[var(--p-accent)] hover:bg-[var(--p-raised)] transition-colors disabled:opacity-50">
                    {t.handoff} →
                  </button>
                )}
              </>
            ) : (
              <>
                {human.length === 0 && <p className="text-xs text-[var(--p-muted)] py-4">{t.noHuman}</p>}
                {human.map((m) => (
                  <Bubble key={m.id} side={m.sender === "client" ? "out" : "in"}>{m.body}</Bubble>
                ))}
                {note && <p className="text-[11px] font-bold text-[var(--p-ok-fg)] py-1">{note}</p>}
              </>
            )}
            <div ref={endRef} />
          </div>

          {/* Composer */}
          <form onSubmit={submit} className="flex items-center gap-2 p-3 border-t border-[var(--p-border)] bg-[var(--p-card)]">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={channel === "assistant" ? t.placeholder : t.humanPlaceholder}
              aria-label={channel === "assistant" ? t.placeholder : t.humanPlaceholder}
              className="flex-1 px-3.5 py-2.5 rounded-full bg-[var(--p-raised)] border border-[var(--p-border)] text-sm text-[var(--p-text)] focus:outline-none focus:border-[var(--p-accent)]"
            />
            <button type="submit" disabled={busy || !input.trim()} aria-label="Send"
              className="w-10 h-10 rounded-full bg-[var(--p-accent)] text-[var(--p-accent-fg)] flex items-center justify-center disabled:opacity-40 hover:opacity-90 transition-opacity">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </form>
        </div>
      )}
    </>
  );
}

function Bubble({ side, children }: { side: "in" | "out"; children: React.ReactNode }) {
  const out = side === "out";
  return (
    <div className={`flex ${out ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words ${
          out
            ? "bg-[var(--p-accent)] text-[var(--p-accent-fg)] rounded-2xl rounded-br-md"
            : "bg-[var(--p-raised)] text-[var(--p-text)] rounded-2xl rounded-bl-md"
        }`}
      >
        {children}
      </div>
    </div>
  );
}
