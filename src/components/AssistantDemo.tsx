"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { Bot, RotateCcw, Send } from "lucide-react";

/**
 * THE DEMO ON THE PAY PAGE — a conversation that plays itself.
 *
 * A feature list says "answers in Arabic, French and English". This shows a
 * student in Casablanca typing Darija at 02:14, an answer three seconds
 * later, a name and a number captured, and the owner's phone lighting up
 * with the lead — and then it says, in the owner's language, what just
 * happened. The buyer is not asked to imagine the product; they watch it.
 *
 * It is a replay, not a live chat, on purpose: a live demo needs the buyer
 * to think of a question, and most do not. A film needs nothing from them.
 * It plays when scrolled into view, loops with a pause, and under
 * prefers-reduced-motion renders the finished conversation at once.
 *
 * Scripts are keyed by the client's niche (CLIENT_REFS.niche) and the page
 * language. The VISITOR side of a study-abroad script is Arabic whatever the
 * page language, because that is who writes to a Moroccan agency at 2am; the
 * notification and the caption are in the OWNER's language, because that is
 * who is reading the page.
 */

type Lang = "en" | "fr";
type Step =
  | { kind: "ai"; text: string; after: number }
  | { kind: "user"; text: string; after: number }
  | { kind: "toast"; after: number }
  | { kind: "caption"; after: number }
  | { kind: "hold"; after: number };

interface Script {
  /** Direction of the visitor's side of the conversation. */
  rtl: boolean;
  clock: string;
  visitorLang: string;
  online: string;
  placeholder: string;
  steps: Step[];
  toast: { title: string; body: string; time: string };
  caption: string;
}

const STUDY_ABROAD: Record<Lang, Script> = {
  fr: {
    rtl: true,
    clock: "02:14",
    visitorLang: "ar",
    online: "متصل · يجيب فوراً",
    placeholder: "اكتب رسالتك…",
    steps: [
      { kind: "ai", text: "مرحباً بك 👋 أنا هنا لأجيب عن أسئلتك حول الدراسة في الخارج. كيف يمكنني مساعدتك؟", after: 600 },
      { kind: "user", text: "السلام عليكم، بغيت نقرا الطب فليتوانيا. واش ممكن؟ وشحال كيتكلف؟", after: 1400 },
      { kind: "ai", text: "وعليكم السلام 😊 نعم، ليتوانيا من أكثر الوجهات طلباً لدراسة الطب، بجامعات معترف بها دولياً وتكلفة معقولة. التكلفة الدقيقة تعتمد على الجامعة — مستشارنا يعطيك تقديراً مجانياً خلال 24 ساعة. ممكن اسمك ورقم هاتفك؟", after: 1700 },
      { kind: "user", text: "ياسين، 0661 23 45 67", after: 1500 },
      { kind: "ai", text: "شكراً ياسين ✅ سجّلت طلبك: الطب في ليتوانيا. سيتصل بك مستشار متخصص خلال 24 ساعة على 0661 23 45 67. ليلة سعيدة!", after: 1500 },
      { kind: "toast", after: 1300 },
      { kind: "caption", after: 900 },
      { kind: "hold", after: 6500 },
    ],
    toast: {
      title: "🌙 Nouvelle demande captée pendant la fermeture",
      body: "Yassine · 0661 23 45 67 · Médecine, Lituanie",
      time: "02:15",
    },
    caption: "Un visiteur à 2h du matin. Une réponse en arabe, en trois secondes. Un dossier ouvert — pendant que vous dormiez.",
  },
  en: {
    rtl: true,
    clock: "02:14",
    visitorLang: "ar",
    online: "متصل · يجيب فوراً",
    placeholder: "اكتب رسالتك…",
    steps: [
      { kind: "ai", text: "مرحباً بك 👋 أنا هنا لأجيب عن أسئلتك حول الدراسة في الخارج. كيف يمكنني مساعدتك؟", after: 600 },
      { kind: "user", text: "السلام عليكم، بغيت نقرا الطب فليتوانيا. واش ممكن؟ وشحال كيتكلف؟", after: 1400 },
      { kind: "ai", text: "وعليكم السلام 😊 نعم، ليتوانيا من أكثر الوجهات طلباً لدراسة الطب، بجامعات معترف بها دولياً وتكلفة معقولة. التكلفة الدقيقة تعتمد على الجامعة — مستشارنا يعطيك تقديراً مجانياً خلال 24 ساعة. ممكن اسمك ورقم هاتفك؟", after: 1700 },
      { kind: "user", text: "ياسين، 0661 23 45 67", after: 1500 },
      { kind: "ai", text: "شكراً ياسين ✅ سجّلت طلبك: الطب في ليتوانيا. سيتصل بك مستشار متخصص خلال 24 ساعة على 0661 23 45 67. ليلة سعيدة!", after: 1500 },
      { kind: "toast", after: 1300 },
      { kind: "caption", after: 900 },
      { kind: "hold", after: 6500 },
    ],
    toast: {
      title: "🌙 New enquiry caught while you were closed",
      body: "Yassine · 0661 23 45 67 · Medicine, Lithuania",
      time: "02:15",
    },
    caption: "A visitor at 2am. Answered in Arabic, in three seconds. A file opened — while you slept.",
  },
};

const GENERIC: Record<Lang, Script> = {
  fr: {
    rtl: false,
    clock: "21:40",
    visitorLang: "fr",
    online: "En ligne · répond instantanément",
    placeholder: "Écrivez votre message…",
    steps: [
      { kind: "ai", text: "Bienvenue 👋 Comment puis-je vous aider ?", after: 600 },
      { kind: "user", text: "Bonsoir, vous faites des devis pour une rénovation de salle de bain ?", after: 1400 },
      { kind: "ai", text: "Bonsoir ! Oui — un devis gratuit après une courte visite. Je peux vous proposer mardi 10h ou jeudi 14h. Votre nom et un numéro pour confirmer ?", after: 1700 },
      { kind: "user", text: "Karim, 06 12 34 56 78 — mardi 10h", after: 1500 },
      { kind: "ai", text: "Parfait Karim ✅ Mardi 10h est réservé. L'équipe vous confirme par SMS demain matin. Bonne soirée !", after: 1500 },
      { kind: "toast", after: 1300 },
      { kind: "caption", after: 900 },
      { kind: "hold", after: 6500 },
    ],
    toast: {
      title: "🌙 Nouvelle demande captée pendant la fermeture",
      body: "Karim · 06 12 34 56 78 · Devis salle de bain, mardi 10h",
      time: "21:41",
    },
    caption: "Un dimanche soir, 21h40. Une réponse immédiate, un rendez-vous pris — sans que vous ayez levé les yeux de votre dîner.",
  },
  en: {
    rtl: false,
    clock: "21:40",
    visitorLang: "en",
    online: "Online · replies instantly",
    placeholder: "Type a message…",
    steps: [
      { kind: "ai", text: "Welcome 👋 How can I help?", after: 600 },
      { kind: "user", text: "Hi, do you quote for a full bathroom renovation?", after: 1400 },
      { kind: "ai", text: "We do — a free quote after a short visit. I can offer Tuesday 10:00 or Thursday 14:00. Your name and a number to confirm?", after: 1700 },
      { kind: "user", text: "Karim, 07700 900123 — Tuesday 10", after: 1500 },
      { kind: "ai", text: "Perfect, Karim ✅ Tuesday 10:00 is booked. The team will confirm by text tomorrow morning. Have a good evening!", after: 1500 },
      { kind: "toast", after: 1300 },
      { kind: "caption", after: 900 },
      { kind: "hold", after: 6500 },
    ],
    toast: {
      title: "🌙 New enquiry caught while you were closed",
      body: "Karim · 07700 900123 · Bathroom quote, Tuesday 10:00",
      time: "21:41",
    },
    caption: "Sunday, 9:40pm. An instant answer, a booking made — without you looking up from dinner.",
  },
};

function scriptFor(niche: string | undefined, lang: Lang): Script {
  if (niche === "study-abroad") return STUDY_ABROAD[lang];
  return GENERIC[lang];
}

const UI = {
  fr: { replay: "Rejouer", yourSite: "votre site", typing: "écrit…", label: "Démonstration" },
  en: { replay: "Replay", yourSite: "your website", typing: "typing…", label: "Demo" },
};

type Msg = { role: "ai" | "user"; text: string };

export default function AssistantDemo({
  lang = "en",
  niche,
  siteLabel = "",
  accent = "#36671E",
}: {
  lang?: Lang;
  niche?: string;
  /** Shown in the frame's title bar so the buyer sees THEIR site running it. */
  siteLabel?: string;
  accent?: string;
}) {
  const script = scriptFor(niche, lang);
  const ui = UI[lang];
  const reduced = useReducedMotion();

  const [messages, setMessages] = useState<Msg[]>([]);
  const [typing, setTyping] = useState(false);
  const [draft, setDraft] = useState("");
  const [toast, setToast] = useState(false);
  const [caption, setCaption] = useState(false);
  const [run, setRun] = useState(0);
  const [visible, setVisible] = useState(false);
  const frameRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Start when it comes into view; the page is long and a film nobody sees
  // is a film that finished before they scrolled to it.
  useEffect(() => {
    const node = frameRef.current;
    if (!node || typeof IntersectionObserver === "undefined") { setVisible(true); return; }
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.35 });
    io.observe(node);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, typing, draft]);

  // The film. One timer chain per run; leaving the viewport or hitting
  // Replay tears it down and starts clean, so timers never stack. Under
  // reduced motion nothing runs: the finished state is derived at render.
  useEffect(() => {
    if (!visible || reduced) return;
    let cancelled = false;
    const timers: number[] = [];
    const wait = (ms: number) => new Promise<void>((r) => { timers.push(window.setTimeout(r, ms)); });

    async function play() {
      // Every state change happens after an await, never in the effect body.
      await wait(40);
      if (cancelled) return;
      setMessages([]); setToast(false); setCaption(false); setTyping(false); setDraft("");
      await wait(400);
      for (const step of script.steps) {
        if (cancelled) return;
        if (step.kind === "ai") {
          setTyping(true);
          await wait(Math.min(2200, 700 + step.text.length * 12));
          if (cancelled) return;
          setTyping(false);
          setMessages((m) => [...m, { role: "ai", text: step.text }]);
        } else if (step.kind === "user") {
          // Typed into the box, character by character, then sent.
          for (let i = 1; i <= step.text.length; i++) {
            if (cancelled) return;
            setDraft(step.text.slice(0, i));
            await wait(step.text.length > 40 ? 28 : 45);
          }
          await wait(350);
          if (cancelled) return;
          setDraft("");
          setMessages((m) => [...m, { role: "user", text: step.text }]);
        } else if (step.kind === "toast") {
          setToast(true);
        } else if (step.kind === "caption") {
          setCaption(true);
        }
        await wait(step.after);
      }
      if (!cancelled) setRun((r) => r + 1); // loop
    }
    play();
    return () => { cancelled = true; timers.forEach(clearTimeout); };
  }, [visible, run, reduced, script]);

  const dir = script.rtl ? "rtl" : "ltr";
  const site = siteLabel.trim() || ui.yourSite;

  // prefers-reduced-motion: the whole conversation, the notification and the
  // caption at once — the same information without the film.
  const finished: Msg[] = script.steps
    .filter((s): s is Extract<Step, { kind: "ai" | "user" }> => s.kind === "ai" || s.kind === "user")
    .map((s) => ({ role: s.kind, text: s.text }));
  const shownMessages = reduced ? finished : messages;
  const shownToast = reduced || toast;
  const shownCaption = reduced || caption;
  const shownTyping = !reduced && typing;
  const shownDraft = reduced ? "" : draft;

  return (
    <div className="w-full max-w-[420px] mx-auto">
      {/* The frame: a dark "screen" holding the client's page with the
          assistant open, so the eye reads it as a window into their site. */}
      <div
        ref={frameRef}
        data-testid="assistant-demo"
        className="relative rounded-[22px] bg-[#111713] p-3 shadow-[0_24px_60px_rgba(17,23,19,0.35)] ring-1 ring-white/10"
      >
        <div className="flex items-center justify-between px-2 pb-2.5 text-[11px] font-semibold text-white/55">
          <span className="truncate" data-testid="demo-site">{site}</span>
          <span className="tabular-nums">{script.clock}</span>
        </div>

        <div className="rounded-2xl overflow-hidden bg-[#FAFAF7] border border-black/10">
          {/* Header, in the client's accent */}
          <div className="px-4 py-3 flex items-center gap-2.5" style={{ background: accent }}>
            <div className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-white text-[13.5px] font-bold leading-none truncate">{site}</p>
              <p className="text-white/85 text-[11px] mt-1 flex items-center gap-1.5" dir={dir}>
                <span className="w-1.5 h-1.5 rounded-full bg-[#BEF264] animate-pulse" /> {script.online}
              </p>
            </div>
          </div>

          {/* Conversation */}
          <div ref={listRef} dir={dir} data-testid="demo-conversation" className="h-[300px] overflow-y-auto px-3.5 py-3.5 space-y-2.5" lang={script.visitorLang}>
            {shownMessages.map((m, i) => (
              <div
                key={`${run}-${i}`}
                className={`max-w-[84%] px-3.5 py-2.5 text-[14px] leading-[1.5] rounded-2xl animate-[fadeUp_.25s_ease] ${
                  m.role === "user"
                    ? "ms-auto text-white rounded-ee-md"
                    : "me-auto bg-white border border-[#E8E6E0] text-[#18181B] rounded-es-md"
                }`}
                style={m.role === "user" ? { background: accent } : undefined}
              >
                {m.text}
              </div>
            ))}
            {shownTyping ? (
              <div className="me-auto bg-white border border-[#E8E6E0] rounded-2xl rounded-es-md px-4 py-3 flex items-center gap-1.5 w-fit">
                {[0, 1, 2].map((d) => (
                  <span key={d} className="w-1.5 h-1.5 rounded-full bg-[#A1A1AA]" style={{ animation: `bounce 1.2s ${d * 0.15}s infinite ease-in-out` }} />
                ))}
                <span className="sr-only">{ui.typing}</span>
              </div>
            ) : null}
          </div>

          {/* Input bar, where the visitor's message is typed out */}
          <div className="flex items-end gap-2 px-3 py-2.5 border-t border-[#E8E6E0] bg-white" dir={dir}>
            <div className="flex-1 min-h-[40px] px-3.5 py-2 rounded-2xl bg-[#FAFAF7] border border-[#E8E6E0] text-[14px] leading-[1.5]">
              {shownDraft ? (
                <span className="text-[#18181B]">{shownDraft}<span className="inline-block w-[1.5px] h-[1em] align-[-2px] bg-[#18181B] ms-[1px] animate-pulse" /></span>
              ) : (
                <span className="text-[#A1A1AA]">{script.placeholder}</span>
              )}
            </div>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: accent }}>
              <Send className={`w-4 h-4 text-white ${script.rtl ? "-scale-x-100" : ""}`} />
            </div>
          </div>
        </div>

        {/* The owner's phone. It slides in over the frame so the eye lands on
            it: the enquiry has left the website and reached a person. */}
        <div
          aria-live="polite"
          data-testid="demo-toast"
          className={`absolute left-3 right-3 top-9 transition-all duration-500 ${shownToast ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-3 pointer-events-none"}`}
        >
          <div className="mx-auto max-w-[360px] rounded-2xl bg-white/95 backdrop-blur border border-black/10 shadow-[0_12px_40px_rgba(0,0,0,0.28)] px-4 py-3 flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl shrink-0 flex items-center justify-center text-white" style={{ background: accent }}>
              <Bot className="w-4.5 h-4.5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-[12.5px] font-bold text-[#18181B] truncate">{script.toast.title}</p>
                <span className="text-[11px] text-[#71717A] tabular-nums shrink-0">{script.toast.time}</span>
              </div>
              <p className="text-[12.5px] text-[#3F3F46] leading-snug mt-0.5">{script.toast.body}</p>
            </div>
          </div>
        </div>
      </div>

      {/* What just happened, in the owner's words */}
      <div className="mt-4 min-h-[64px] flex items-start justify-between gap-3">
        <p className={`text-[14px] leading-relaxed text-[#3F3F46] transition-opacity duration-500 ${shownCaption ? "opacity-100" : "opacity-0"}`}>
          <span className="block text-[10px] font-black uppercase tracking-[0.18em] text-[#8A8A80] mb-1">{ui.label}</span>
          {script.caption}
        </p>
        {!reduced ? (
          <button
            type="button"
            onClick={() => setRun((r) => r + 1)}
            className="shrink-0 inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#71717A] hover:text-[#18181B] transition-colors mt-4"
          >
            <RotateCcw className="w-3.5 h-3.5" /> {ui.replay}
          </button>
        ) : null}
      </div>

      <style jsx global>{`
        @keyframes bounce { 0%, 60%, 100% { transform: translateY(0); opacity: .5 } 30% { transform: translateY(-4px); opacity: 1 } }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(6px) } to { opacity: 1; transform: none } }
      `}</style>
    </div>
  );
}
