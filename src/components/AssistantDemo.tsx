"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { Bot, RotateCcw, Send } from "lucide-react";

/**
 * THE DEMO ON THE PAY PAGE — a conversation that plays itself.
 *
 * A feature list says "answers in Arabic, French and English". This shows a
 * visitor writing at 02:14, an answer three seconds later, a name and a
 * number captured, and the owner's phone lighting up with the lead — then it
 * says, in the owner's language, what just happened. The buyer is not asked
 * to imagine the product; they watch it.
 *
 * THREE RULES IT LEARNED THE HARD WAY (2026-09-17, from the buyer's side):
 *
 *  1. IT IS AN EXAMPLE AND MUST SAY SO. The first version put the CLIENT's
 *     real domain in the frame's title bar next to an invented lead with an
 *     invented phone number. To the one person the page is for, that reads as
 *     "these are my visitors" — and the moment he doubts one number he
 *     doubts the product. So the frame carries an EXEMPLE badge and an
 *     obviously-other business, and a line under it says the real one takes
 *     his name and his colours.
 *  2. IT OPENS IN THE LANGUAGE THE BUYER READS. The page exists to convince
 *     the owner. A French-reading owner met five Arabic bubbles he could not
 *     judge, which is a demo of nothing.
 *  3. THE LANGUAGES ARE TABS, NOT A CHOICE WE MAKE FOR HIM. Clicking from
 *     Français to العربية and watching the same conversation happen again is
 *     the multilingual promise demonstrated rather than claimed — and it is
 *     the reason this product is worth USD 120 to a business whose customers
 *     write in three languages.
 *
 * It is a replay, not a live chat, on purpose: a live demo needs the buyer to
 * think of a question, and most do not. A film needs nothing from them. It
 * plays when scrolled into view, loops with a pause, and under
 * prefers-reduced-motion renders the finished conversation at once.
 */

/** Who is reading the page. */
type OwnerLang = "en" | "fr";
/** Who is writing in the demo. */
type VisitorLang = "ar" | "fr" | "en";

type Turn = { role: "ai" | "user"; text: string };

interface VisitorScript {
  online: string;
  placeholder: string;
  turns: Turn[];
}

/** The example business. Never the buyer's own — see rule 1. */
interface Example {
  name: string;
  domain: string;
  clock: string;
  /** The lead the conversation captures, as the owner's phone shows it. */
  lead: { name: string; phone: string; want: Record<OwnerLang, string> };
}

const RTL: VisitorLang[] = ["ar"];

/* ── study-abroad ─────────────────────────────────────────────────────────
 * The same fictitious agency the try page uses, so a buyer who clicks
 * through meets one example rather than two. The phone number is the
 * documentation-style 06 12 34 56 78 on purpose: it reads as an example.   */

const STUDY_EXAMPLE: Example = {
  name: "Atlas Études",
  domain: "atlas-etudes.ma",
  clock: "02:14",
  lead: {
    name: "Yassine",
    phone: "06 12 34 56 78",
    want: { fr: "Médecine, Lituanie", en: "Medicine, Lithuania" },
  },
};

const STUDY: Record<VisitorLang, VisitorScript> = {
  fr: {
    online: "En ligne · répond instantanément",
    placeholder: "Écrivez votre message…",
    turns: [
      { role: "ai", text: "Bienvenue chez {NAME} 👋 Je réponds à vos questions sur les études à l'étranger. Comment puis-je vous aider ?" },
      { role: "user", text: "Bonsoir, je voudrais étudier la médecine en Lituanie. C'est possible ? Et quel budget ?" },
      { role: "ai", text: "Bonsoir 😊 Oui — la Lituanie est notre destination la plus demandée en médecine : des universités reconnues, à un coût raisonnable. Le budget exact dépend de l'université ; un conseiller vous envoie une estimation gratuite sous 24h. Votre nom et un numéro ?" },
      { role: "user", text: "Yassine, 06 12 34 56 78" },
      { role: "ai", text: "Merci Yassine ✅ C'est noté : médecine en Lituanie. Un conseiller vous appelle sous 24h au 06 12 34 56 78. Bonne nuit !" },
    ],
  },
  ar: {
    online: "متصل · يجيب فوراً",
    placeholder: "اكتب رسالتك…",
    turns: [
      { role: "ai", text: "مرحباً بك في {NAME} 👋 أنا هنا لأجيب عن أسئلتك حول الدراسة في الخارج. كيف يمكنني مساعدتك؟" },
      { role: "user", text: "السلام عليكم، بغيت نقرا الطب فليتوانيا. واش ممكن؟ وشحال كيتكلف؟" },
      { role: "ai", text: "وعليكم السلام 😊 نعم، ليتوانيا من أكثر الوجهات طلباً لدراسة الطب، بجامعات معترف بها دولياً وتكلفة معقولة. التكلفة الدقيقة تعتمد على الجامعة — مستشارنا يعطيك تقديراً مجانياً خلال 24 ساعة. ممكن اسمك ورقم هاتفك؟" },
      { role: "user", text: "ياسين، 06 12 34 56 78" },
      { role: "ai", text: "شكراً ياسين ✅ سجّلت طلبك: الطب في ليتوانيا. سيتصل بك مستشار متخصص خلال 24 ساعة على 06 12 34 56 78. ليلة سعيدة!" },
    ],
  },
  en: {
    online: "Online · replies instantly",
    placeholder: "Type a message…",
    turns: [
      { role: "ai", text: "Welcome to {NAME} 👋 I'm here to answer your questions about studying abroad. How can I help?" },
      { role: "user", text: "Hi, I'd like to study medicine in Lithuania. Is that possible, and what does it cost?" },
      { role: "ai", text: "Hello 😊 Yes — Lithuania is our most requested destination for medicine: internationally recognised universities at a reasonable cost. The exact cost depends on the university; an advisor sends you a free estimate within 24 hours. Your name and a number?" },
      { role: "user", text: "Yassine, 06 12 34 56 78" },
      { role: "ai", text: "Thank you Yassine ✅ Noted: medicine in Lithuania. An advisor will call you within 24 hours on 06 12 34 56 78. Good night!" },
    ],
  },
};

/* ── everyone else ───────────────────────────────────────────────────────── */

const GENERIC_EXAMPLE: Example = {
  name: "Atelier Renov",
  domain: "atelier-renov.ma",
  clock: "21:40",
  lead: {
    name: "Karim",
    phone: "06 12 34 56 78",
    want: { fr: "Devis salle de bain, mardi 10h", en: "Bathroom quote, Tuesday 10:00" },
  },
};

const GENERIC: Record<VisitorLang, VisitorScript> = {
  fr: {
    online: "En ligne · répond instantanément",
    placeholder: "Écrivez votre message…",
    turns: [
      { role: "ai", text: "Bienvenue chez {NAME} 👋 Comment puis-je vous aider ?" },
      { role: "user", text: "Bonsoir, vous faites des devis pour une rénovation de salle de bain ?" },
      { role: "ai", text: "Bonsoir ! Oui — un devis gratuit après une courte visite. Je peux vous proposer mardi 10h ou jeudi 14h. Votre nom et un numéro pour confirmer ?" },
      { role: "user", text: "Karim, 06 12 34 56 78 — mardi 10h" },
      { role: "ai", text: "Parfait Karim ✅ Mardi 10h est réservé. L'équipe vous confirme par SMS demain matin. Bonne soirée !" },
    ],
  },
  ar: {
    online: "متصل · يجيب فوراً",
    placeholder: "اكتب رسالتك…",
    turns: [
      { role: "ai", text: "مرحباً بك في {NAME} 👋 كيف يمكنني مساعدتك؟" },
      { role: "user", text: "السلام عليكم، واش كتديرو تسعيرة لتجديد حمام؟" },
      { role: "ai", text: "وعليكم السلام! نعم — تسعيرة مجانية بعد زيارة قصيرة. عندي الثلاثاء 10:00 أو الخميس 14:00. ممكن اسمك ورقم للتأكيد؟" },
      { role: "user", text: "كريم، 06 12 34 56 78 — الثلاثاء 10:00" },
      { role: "ai", text: "ممتاز كريم ✅ الثلاثاء 10:00 محجوز. الفريق سيؤكد لك برسالة غداً صباحاً. ليلة سعيدة!" },
    ],
  },
  en: {
    online: "Online · replies instantly",
    placeholder: "Type a message…",
    turns: [
      { role: "ai", text: "Welcome to {NAME} 👋 How can I help?" },
      { role: "user", text: "Hi, do you quote for a full bathroom renovation?" },
      { role: "ai", text: "We do — a free quote after a short visit. I can offer Tuesday 10:00 or Thursday 14:00. Your name and a number to confirm?" },
      { role: "user", text: "Karim, 06 12 34 56 78 — Tuesday 10:00" },
      { role: "ai", text: "Perfect, Karim ✅ Tuesday 10:00 is booked. The team will confirm by text tomorrow morning. Have a good evening!" },
    ],
  },
};

/* ── any real business, unknown trade ────────────────────────────────────
 * Shown when a prospect typed THEIR domain: the demo then wears their name,
 * so the topic must fit whoever they are. A visitor asking for an
 * appointment fits a clinic, an agency and a workshop alike; a bathroom
 * quote on a dentist's demo would cost the sale in one line. */

const NEUTRAL_LEAD = {
  name: "Yassine",
  phone: "06 12 34 56 78",
  want: { fr: "Demande de rendez-vous, jeudi", en: "Appointment request, Thursday" } as Record<OwnerLang, string>,
};

const NEUTRAL: Record<VisitorLang, VisitorScript> = {
  fr: {
    online: "En ligne · répond instantanément",
    placeholder: "Écrivez votre message…",
    turns: [
      { role: "ai", text: "Bienvenue chez {NAME} 👋 Comment puis-je vous aider ?" },
      { role: "user", text: "Bonjour, est-ce que vous prenez de nouveaux clients ? J'aimerais un rendez-vous cette semaine." },
      { role: "ai", text: "Bonjour 😊 Oui, avec plaisir. Dites-moi ce dont vous avez besoin et je vous propose un créneau — ou quelqu'un de l'équipe vous rappelle. Votre nom et un numéro ?" },
      { role: "user", text: "Yassine, 06 12 34 56 78 — jeudi si possible" },
      { role: "ai", text: "Merci Yassine ✅ C'est noté pour jeudi. {NAME} vous confirme l'horaire très vite au 06 12 34 56 78. Bonne journée !" },
    ],
  },
  ar: {
    online: "متصل · يجيب فوراً",
    placeholder: "اكتب رسالتك…",
    turns: [
      { role: "ai", text: "مرحباً بك في {NAME} 👋 كيف يمكنني مساعدتك؟" },
      { role: "user", text: "السلام عليكم، واش كتقبلو عملاء جدد؟ بغيت موعد هاد السيمانة." },
      { role: "ai", text: "وعليكم السلام 😊 مرحباً بك. قل لي ما تحتاجه وسأقترح عليك موعداً — أو يتصل بك أحد من الفريق. ممكن اسمك ورقم هاتفك؟" },
      { role: "user", text: "ياسين، 06 12 34 56 78 — الخميس إن أمكن" },
      { role: "ai", text: "شكراً ياسين ✅ سجّلت طلبك ليوم الخميس. {NAME} سيؤكد لك الموعد قريباً على 06 12 34 56 78. نهار سعيد!" },
    ],
  },
  en: {
    online: "Online · replies instantly",
    placeholder: "Type a message…",
    turns: [
      { role: "ai", text: "Welcome to {NAME} 👋 How can I help?" },
      { role: "user", text: "Hi, are you taking new clients? I'd like an appointment this week." },
      { role: "ai", text: "Hello 😊 Gladly. Tell me what you need and I'll suggest a slot — or someone from the team calls you back. Your name and a number?" },
      { role: "user", text: "Yassine, 06 12 34 56 78 — Thursday if possible" },
      { role: "ai", text: "Thank you Yassine ✅ Noted for Thursday. {NAME} will confirm the time shortly on 06 12 34 56 78. Have a good day!" },
    ],
  },
};

/* ── what the OWNER reads: the alert, the caption, the chrome ───────────── */

const OWNER = {
  fr: {
    example: "Exemple",
    tabsHint: "Changez de langue — c'est la même conversation :",
    toastTitle: "🌙 Nouvelle demande captée pendant la fermeture",
    toastTime: (c: string) => c,
    caption: "Un visiteur écrit la nuit, dans sa langue. Réponse en trois secondes, coordonnées prises, et votre téléphone sonne — pendant que vous dormiez.",
    footnote: "Chez vous, l'assistant porte le nom, les couleurs et les informations de votre entreprise. Ceci est un exemple.",
    replay: "Rejouer",
    typing: "écrit…",
    langs: { ar: "العربية", fr: "Français", en: "English" },
  },
  en: {
    example: "Example",
    tabsHint: "Switch language — it is the same conversation:",
    toastTitle: "🌙 New enquiry caught while you were closed",
    toastTime: (c: string) => c,
    caption: "A visitor writes at night, in their own language. Answered in three seconds, details taken, and your phone rings — while you were asleep.",
    footnote: "On your site the assistant carries your business name, your colours and your information. This is an example.",
    replay: "Replay",
    typing: "typing…",
    langs: { ar: "العربية", fr: "Français", en: "English" },
  },
} as const;

/** One minute past the last message — the alert arrives after the chat ends. */
function plusOneMinute(clock: string): string {
  const [h, m] = clock.split(":").map(Number);
  const t = (h * 60 + m + 1) % (24 * 60);
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}

type Msg = { role: "ai" | "user"; text: string };

export default function AssistantDemo({
  lang = "en",
  niche,
  languages,
  accent = "#36671E",
  business,
}: {
  /** The OWNER's language — the page is written to convince them. */
  lang?: OwnerLang;
  niche?: string;
  /** Which languages this assistant speaks, from the client's brief. */
  languages?: VisitorLang[];
  /** The client's brand colour, so the widget looks like theirs. */
  accent?: string;
  /**
   * A REAL business that asked to see itself — from the brand probe, or a
   * known client's brief. The frame then carries their name and domain (the
   * EXEMPLE badge and the invented lead stay, so it still reads as an
   * example), and the script switches to one that fits any trade unless the
   * niche says otherwise. Absent → the fixed fictitious examples.
   */
  business?: { name: string; domain: string };
}) {
  const study = niche === "study-abroad";
  const scripts = business ? (study ? STUDY : NEUTRAL) : (study ? STUDY : GENERIC);
  const fixed = study ? STUDY_EXAMPLE : GENERIC_EXAMPLE;
  const example: Example = business
    ? {
        name: business.name,
        domain: business.domain,
        clock: study ? STUDY_EXAMPLE.clock : "21:40",
        lead: study ? STUDY_EXAMPLE.lead : NEUTRAL_LEAD,
      }
    : fixed;
  const O = OWNER[lang];
  const reduced = useReducedMotion();

  // The tabs: the languages actually sold, in a stable order, and always
  // including the owner's own so the page opens in something they can read.
  const order: VisitorLang[] = ["fr", "ar", "en"];
  const offered = (languages?.length ? languages : (["ar", "fr", "en"] as VisitorLang[]))
    .filter((l): l is VisitorLang => l === "ar" || l === "fr" || l === "en");
  const tabs = order.filter((l) => offered.includes(l));
  const opening: VisitorLang = tabs.includes(lang) ? lang : (tabs[0] ?? "fr");

  const [tab, setTab] = useState<VisitorLang>(opening);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [typing, setTyping] = useState(false);
  const [draft, setDraft] = useState("");
  const [toast, setToast] = useState(false);
  const [caption, setCaption] = useState(false);
  const [run, setRun] = useState(0);
  const [visible, setVisible] = useState(false);
  const frameRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const script = scripts[tab];
  // The name is written into the turns ONCE per (script, name): the effect
  // and the reduced-motion render must play identical text, and a fresh
  // fresh array per render would re-trigger the film for ever.
  const turns = useMemo(
    () => script.turns.map((t) => ({ ...t, text: t.text.split("{NAME}").join(example.name) })),
    [script, example.name],
  );
  const rtl = RTL.includes(tab);

  // Start when it comes into view; the page is long and a film nobody sees
  // is a film that finished before they scrolled to it.
  useEffect(() => {
    const node = frameRef.current;
    if (!node || typeof IntersectionObserver === "undefined") { setVisible(true); return; }
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.3 });
    io.observe(node);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, typing, draft]);

  // The film. One timer chain per run; leaving the viewport, switching
  // language or hitting Replay tears it down and starts clean, so timers
  // never stack. Under reduced motion nothing runs — the finished state is
  // derived at render instead.
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
      for (const turn of turns) {
        if (cancelled) return;
        if (turn.role === "ai") {
          setTyping(true);
          await wait(Math.min(2200, 700 + turn.text.length * 11));
          if (cancelled) return;
          setTyping(false);
          setMessages((m) => [...m, turn]);
        } else {
          // Typed into the box, character by character, then sent.
          for (let i = 1; i <= turn.text.length; i++) {
            if (cancelled) return;
            setDraft(turn.text.slice(0, i));
            await wait(turn.text.length > 40 ? 26 : 42);
          }
          await wait(340);
          if (cancelled) return;
          setDraft("");
          setMessages((m) => [...m, turn]);
        }
        await wait(turn.role === "ai" ? 1500 : 1300);
      }
      if (cancelled) return;
      setToast(true);
      await wait(900);
      if (cancelled) return;
      setCaption(true);
      await wait(7000);
      if (!cancelled) setRun((r) => r + 1); // loop
    }
    play();
    return () => { cancelled = true; timers.forEach(clearTimeout); };
  }, [visible, run, reduced, turns]);

  // prefers-reduced-motion: the whole conversation, the notification and the
  // caption at once — the same information without the film.
  const shownMessages = reduced ? turns : messages;
  const shownToast = reduced || toast;
  const shownCaption = reduced || caption;
  const shownTyping = !reduced && typing;
  const shownDraft = reduced ? "" : draft;
  const dir = rtl ? "rtl" : "ltr";

  /** Wipe the screen NOW, then let the effect start the film again.
   *
   * The clear used to live inside the effect, one tick later. For that tick
   * the previous language's bubbles sat under the newly-selected tab: you
   * tapped العربية and read French for half a second, which on the one
   * screen that has to look competent reads as a broken switch. A click
   * handler is exactly where a synchronous reset belongs. */
  function restart(next?: VisitorLang) {
    setMessages([]);
    setToast(false);
    setCaption(false);
    setTyping(false);
    setDraft("");
    if (next && next !== tab) setTab(next);
    setRun((r) => r + 1);
  }

  return (
    <div className="w-full max-w-[430px] mx-auto">
      {/* The tabs. They are the product's main claim, so they sit above the
          frame where they are read before the conversation starts. */}
      {tabs.length > 1 ? (
        <div className="mb-3">
          <p className="text-[11.5px] text-[#8A8A80] mb-1.5">{O.tabsHint}</p>
          <div className="flex items-center gap-1 p-1 rounded-xl bg-[#F0EFEA]" role="tablist" data-testid="demo-langs">
            {tabs.map((l) => (
              <button
                key={l}
                type="button"
                role="tab"
                aria-selected={tab === l}
                onClick={() => { if (l !== tab) restart(l); }}
                data-lang={l}
                className={`flex-1 h-8 rounded-lg text-[13px] font-bold transition ${
                  tab === l ? "bg-white text-[#18181B] shadow-sm" : "text-[#71717A] hover:text-[#18181B]"
                }`}
              >
                {O.langs[l]}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {/* The frame: a dark "screen" holding an EXAMPLE business's page with
          the assistant open. The badge and the other business's domain are
          what stop the buyer reading invented leads as their own. */}
      <div
        ref={frameRef}
        data-testid="assistant-demo"
        className="relative rounded-[22px] bg-[#111713] p-3 shadow-[0_24px_60px_rgba(17,23,19,0.35)] ring-1 ring-white/10"
      >
        <div className="flex items-center justify-between gap-2 px-2 pb-2.5 text-[11px] font-semibold text-white/55">
          <span className="flex items-center gap-2 min-w-0">
            <span className="shrink-0 rounded-md bg-white/15 px-1.5 py-0.5 text-[9.5px] font-black uppercase tracking-[0.12em] text-white/80"
                  data-testid="demo-badge">
              {O.example}
            </span>
            <span className="truncate" data-testid="demo-site">{example.domain}</span>
          </span>
          <span className="tabular-nums shrink-0">{example.clock}</span>
        </div>

        <div className="rounded-2xl overflow-hidden bg-[#FAFAF7] border border-black/10">
          {/* Header, in the client's accent */}
          <div className="px-4 py-3 flex items-center gap-2.5" style={{ background: accent }}>
            <div className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-white text-[13.5px] font-bold leading-none truncate">{example.name}</p>
              <p className="text-white/85 text-[11px] mt-1 flex items-center gap-1.5" dir={dir}>
                <span className="w-1.5 h-1.5 rounded-full bg-[#BEF264] animate-pulse" /> {script.online}
              </p>
            </div>
          </div>

          {/* Conversation */}
          <div ref={listRef} dir={dir} lang={tab} data-testid="demo-conversation"
               className="h-[300px] overflow-y-auto px-3.5 py-3.5 space-y-2.5">
            {shownMessages.map((m, i) => (
              <div
                key={`${tab}-${run}-${i}`}
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
                <span className="sr-only">{O.typing}</span>
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
              <Send className={`w-4 h-4 text-white ${rtl ? "-scale-x-100" : ""}`} />
            </div>
          </div>
        </div>

        {/* The owner's phone. It slides in over the frame so the eye lands on
            it: the enquiry has left the website and reached a person. Always
            in the OWNER's language — it is his phone, not the visitor's. */}
        <div
          aria-live="polite"
          data-testid="demo-toast"
          className={`absolute left-3 right-3 top-9 transition-all duration-500 ${shownToast ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-3 pointer-events-none"}`}
        >
          <div className="mx-auto max-w-[380px] rounded-2xl bg-white/95 backdrop-blur border border-black/10 shadow-[0_12px_40px_rgba(0,0,0,0.28)] px-4 py-3 flex items-start gap-3" dir={lang === "fr" ? "ltr" : "ltr"}>
            <div className="w-9 h-9 rounded-xl shrink-0 flex items-center justify-center text-white" style={{ background: accent }}>
              <Bot className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-[12.5px] font-bold text-[#18181B] truncate">{O.toastTitle}</p>
                <span className="text-[11px] text-[#71717A] tabular-nums shrink-0">{O.toastTime(plusOneMinute(example.clock))}</span>
              </div>
              <p className="text-[12.5px] text-[#3F3F46] leading-snug mt-0.5">
                {example.lead.name} · {example.lead.phone} · {example.lead.want[lang]}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* What just happened, in the owner's words — then the one line that
          says why the example is not his own business. */}
      <div className="mt-4 flex items-start justify-between gap-3">
        <p className={`text-[14px] leading-relaxed text-[#3F3F46] transition-opacity duration-500 ${shownCaption ? "opacity-100" : "opacity-0"}`}
           data-testid="demo-caption">
          {O.caption}
        </p>
        {!reduced ? (
          <button
            type="button"
            onClick={() => restart()}
            className="shrink-0 inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#71717A] hover:text-[#18181B] transition-colors mt-0.5"
          >
            <RotateCcw className="w-3.5 h-3.5" /> {O.replay}
          </button>
        ) : null}
      </div>
      <p className="mt-2.5 text-[12.5px] leading-relaxed text-[#8A8A80]" data-testid="demo-footnote">
        {business
          ? (lang === "fr"
              ? `Ceci est un exemple de conversation pour ${business.domain}. Le vrai assistant est formé sur vos services et vos informations — il n'invente jamais un prix ni une promesse.`
              : `This is an example conversation for ${business.domain}. The real assistant is trained on your services and your information — it never invents a price or a promise.`)
          : O.footnote}
      </p>

      <style jsx global>{`
        @keyframes bounce { 0%, 60%, 100% { transform: translateY(0); opacity: .5 } 30% { transform: translateY(-4px); opacity: 1 } }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(6px) } to { opacity: 1; transform: none } }
      `}</style>
    </div>
  );
}
