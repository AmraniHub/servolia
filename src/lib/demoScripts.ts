/**
 * THE CONVERSATIONS THE PAY-PAGE DEMO REPLAYS — content only, no player.
 *
 * Split out of AssistantDemo.tsx when a third trade arrived: the component
 * is the projector, this is the film, and a new client's trade should be a
 * data entry rather than a surgery on a 600-line component.
 *
 * FOUR RULES, each paid for in a real mistake:
 *
 *  1. THE SCRIPT MUST FIT THE BUYER'S TRADE. A sourcing agent shown a
 *     bathroom-renovation conversation is a sale lost in one line — the
 *     buyer stops reading the product and starts noticing it is not about
 *     them. Hence a script per trade, and NEUTRAL (a plain appointment)
 *     for a probed business whose trade we could not detect.
 *  2. IT IS AN EXAMPLE AND SAYS SO. Every example business is fictitious
 *     and obviously not the buyer's own; the frame carries an EXEMPLE badge
 *     and the lead's number is a reserved documentation one — Ofcom's
 *     07700 900123 for UK, 06 12 34 56 78 in the French style.
 *  3. THE LEAD IS PER LANGUAGE. One name and number across three tabs read
 *     as a template; three read as three customers.
 *  4. ARABIC IS FUSHA, AND ITS NUMBERS ARE ISOLATED. Modern Standard
 *     Arabic, never dialect (see clientPrompt.ts for the same rule given to
 *     the live model). A space-separated number inside an RTL sentence has
 *     its digit GROUPS laid out right-to-left — "06 12 34 56 78" renders
 *     "78 56 34 12 06" — so every Arabic number is wrapped in U+2066 …
 *     U+2069 (LTR ISOLATE … POP DIRECTIONAL ISOLATE). Guarded by
 *     tests/arabic-bidi.py, which measures geometry because inner_text
 *     returns logical order and cannot see the bug at all.
 */

/** Who is reading the page. */
export type OwnerLang = "en" | "fr";
/** Who is writing in the demo. */
export type VisitorLang = "ar" | "fr" | "en";

export type Turn = { role: "ai" | "user"; text: string };

export interface VisitorScript {
  online: string;
  placeholder: string;
  /** Who this conversation captures — see rule 3. */
  lead: { name: string; phone: string };
  turns: Turn[];
}

/** The example business. Never the buyer's own — see rule 2. */
export interface Example {
  name: string;
  domain: string;
  clock: string;
  /** What the captured lead wanted, as the OWNER's phone words it. */
  want: Record<OwnerLang, string>;
}

export const RTL: VisitorLang[] = ["ar"];

/* An Arabic phone number, pinned as one left-to-right unit — rule 4. */
const ar = (n: string) => `⁦${n}⁩`;
const MA = "06 12 34 56 78";
const UK = "07700 900123";

const ONLINE = {
  fr: "En ligne · répond instantanément",
  ar: "متصل · يرد فوراً",
  en: "Online · replies instantly",
};
const PLACEHOLDER = {
  fr: "Écrivez votre message…",
  ar: "اكتب رسالتك…",
  en: "Type a message…",
};

/* ── study-abroad ─────────────────────────────────────────────────────────
 * The same fictitious agency the try page uses, so a buyer who clicks
 * through meets one example rather than two.                              */

export const STUDY_EXAMPLE: Example = {
  name: "Atlas Études",
  domain: "atlas-etudes.ma",
  clock: "02:14",
  want: { fr: "Médecine, Lituanie", en: "Medicine, Lithuania" },
};

export const STUDY: Record<VisitorLang, VisitorScript> = {
  fr: {
    online: ONLINE.fr,
    placeholder: PLACEHOLDER.fr,
    lead: { name: "Yassine", phone: MA },
    turns: [
      { role: "ai", text: "Bienvenue chez {NAME} 👋 Je réponds à vos questions sur les études à l'étranger. Comment puis-je vous aider ?" },
      { role: "user", text: "Bonsoir, je voudrais étudier la médecine en Lituanie. C'est possible ? Et quel budget ?" },
      { role: "ai", text: "Bonsoir 😊 Oui — la Lituanie est notre destination la plus demandée en médecine : des universités reconnues, à un coût raisonnable. Le budget exact dépend de l'université ; un conseiller vous envoie une estimation gratuite sous 24h. Votre nom et un numéro ?" },
      { role: "user", text: `Yassine, ${MA}` },
      { role: "ai", text: `Merci Yassine ✅ C'est noté : médecine en Lituanie. Un conseiller vous appelle sous 24h au ${MA}. Bonne nuit !` },
    ],
  },
  ar: {
    online: ONLINE.ar,
    placeholder: PLACEHOLDER.ar,
    lead: { name: "ياسين", phone: MA },
    turns: [
      { role: "ai", text: "مرحباً بك في {NAME} 👋 أنا هنا للإجابة عن أسئلتك حول الدراسة في الخارج. كيف يمكنني مساعدتك؟" },
      { role: "user", text: "السلام عليكم، أرغب في دراسة الطب في ليتوانيا. هل هذا ممكن؟ وما هي التكاليف؟" },
      { role: "ai", text: "وعليكم السلام 😊 نعم، ليتوانيا من أكثر الوجهات طلباً لدراسة الطب، بجامعات معترف بها دولياً وتكاليف معقولة. التكلفة الدقيقة تعتمد على الجامعة، وسيوافيك أحد مستشارينا بتقدير مجاني خلال 24 ساعة. هل يمكنك تزويدي باسمك ورقم هاتفك؟" },
      { role: "user", text: `ياسين، ${ar(MA)}` },
      { role: "ai", text: `شكراً لك ياسين ✅ سجّلت طلبك: دراسة الطب في ليتوانيا. سيتصل بك مستشار متخصص خلال 24 ساعة على الرقم ${ar(MA)}. طابت ليلتك!` },
    ],
  },
  en: {
    online: ONLINE.en,
    placeholder: PLACEHOLDER.en,
    lead: { name: "Emma", phone: UK },
    turns: [
      { role: "ai", text: "Welcome to {NAME} 👋 I'm here to answer your questions about studying abroad. How can I help?" },
      { role: "user", text: "Hi, I'd like to study medicine in Lithuania. Is that possible, and what does it cost?" },
      { role: "ai", text: "Hello 😊 Yes — Lithuania is our most requested destination for medicine: internationally recognised universities at a reasonable cost. The exact cost depends on the university; an advisor sends you a free estimate within 24 hours. Your name and a number?" },
      { role: "user", text: `Emma, ${UK}` },
      { role: "ai", text: `Thank you Emma ✅ Noted: medicine in Lithuania. An advisor will call you within 24 hours on ${UK}. Good night!` },
    ],
  },
};

/* ── sourcing / import-export ─────────────────────────────────────────────
 * Written for GoodsCoChina, whose buyers are importers and retailers in
 * other time zones — so the after-hours story is not a flourish for her,
 * it is the whole product: a London buyer writes at 02:14 Yiwu time.
 *
 * Every promise in the assistant's lines is one HER OWN SITE makes:
 * verified factories, a free sourcing plan, options within 24 hours, an
 * on-site audit before any deposit. A demo that promises more than the
 * client does would be a demo she cannot honour.                          */

export const SOURCING_EXAMPLE: Example = {
  name: "Canton Bridge",
  domain: "canton-bridge.com",
  clock: "02:14",
  want: {
    fr: "5 000 unités, rangement cuisine — usines",
    en: "5,000 units, kitchen storage — factories",
  },
};

export const SOURCING: Record<VisitorLang, VisitorScript> = {
  en: {
    online: ONLINE.en,
    placeholder: PLACEHOLDER.en,
    lead: { name: "James", phone: UK },
    turns: [
      { role: "ai", text: "Welcome to {NAME} 👋 Tell me what you are sourcing and I will come back with verified factory options. How can I help?" },
      { role: "user", text: "Hi, I need around 5,000 kitchen storage units. Can you find a factory and give me a price?" },
      { role: "ai", text: "Yes — that is a typical order for us. I can come back with verified factory options, pricing and a timeline, free of charge. Two quick things: which country are we shipping to, and do you have a target price or a sample? And your name with an email or WhatsApp, so the team can send the plan?" },
      { role: "user", text: `James, ${UK} — shipping to the UK` },
      { role: "ai", text: `Thank you James ✅ Noted: 5,000 kitchen storage units, shipping to the UK. Our sourcing team will send you verified factory options within 24 hours on ${UK}. Every factory is audited on site before you pay a deposit.` },
    ],
  },
  fr: {
    online: ONLINE.fr,
    placeholder: PLACEHOLDER.fr,
    lead: { name: "Karim", phone: MA },
    turns: [
      { role: "ai", text: "Bienvenue chez {NAME} 👋 Dites-moi ce que vous souhaitez sourcer et je vous reviens avec des usines vérifiées. Comment puis-je vous aider ?" },
      { role: "user", text: "Bonjour, j'ai besoin d'environ 5 000 unités de rangement de cuisine. Pouvez-vous trouver une usine et me donner un prix ?" },
      { role: "ai", text: "Oui — c'est une commande courante pour nous. Je peux vous revenir avec des usines vérifiées, les prix et un délai, gratuitement. Deux précisions : vers quel pays expédions-nous, et avez-vous un prix cible ou un échantillon ? Votre nom avec un email ou WhatsApp, pour que l'équipe vous envoie le plan ?" },
      { role: "user", text: `Karim, ${MA} — expédition vers la France` },
      { role: "ai", text: `Merci Karim ✅ C'est noté : 5 000 unités de rangement de cuisine, expédition vers la France. Notre équipe vous envoie des options d'usines vérifiées sous 24h au ${MA}. Chaque usine est auditée sur place avant tout acompte.` },
    ],
  },
  ar: {
    online: ONLINE.ar,
    placeholder: PLACEHOLDER.ar,
    lead: { name: "ياسين", phone: MA },
    turns: [
      { role: "ai", text: "مرحباً بك في {NAME} 👋 أخبرني بما ترغب في استيراده وسأعود إليك بخيارات مصانع موثوقة. كيف يمكنني مساعدتك؟" },
      { role: "user", text: "السلام عليكم، أحتاج نحو 5000 وحدة من منظمات المطبخ. هل يمكنكم إيجاد مصنع وتقديم السعر؟" },
      { role: "ai", text: "وعليكم السلام 😊 نعم، هذه كمية معتادة لدينا. سأعود إليك بخيارات مصانع موثوقة والأسعار والمدة الزمنية، مجاناً. أمران فقط: إلى أي بلد سنشحن، وهل لديك سعر مستهدف أو نموذج؟ وهل يمكنك تزويدي باسمك وبريدك الإلكتروني أو رقم واتساب ليرسل لك الفريق الخطة؟" },
      { role: "user", text: `ياسين، ${ar(MA)} — الشحن إلى المغرب` },
      { role: "ai", text: `شكراً لك ياسين ✅ سجّلت طلبك: 5000 وحدة من منظمات المطبخ، الشحن إلى المغرب. سيرسل لك فريق التوريد خيارات مصانع موثوقة خلال 24 ساعة على الرقم ${ar(MA)}. كل مصنع يُراجَع ميدانياً قبل أي دفعة مقدمة.` },
    ],
  },
};

/* ── the fixed fallback example: a home-services workshop ───────────────── */

export const GENERIC_EXAMPLE: Example = {
  name: "Atelier Renov",
  domain: "atelier-renov.ma",
  clock: "21:40",
  want: { fr: "Devis salle de bain, mardi 10h", en: "Bathroom quote, Tuesday 10:00" },
};

export const GENERIC: Record<VisitorLang, VisitorScript> = {
  fr: {
    online: ONLINE.fr,
    placeholder: PLACEHOLDER.fr,
    lead: { name: "Karim", phone: MA },
    turns: [
      { role: "ai", text: "Bienvenue chez {NAME} 👋 Comment puis-je vous aider ?" },
      { role: "user", text: "Bonsoir, vous faites des devis pour une rénovation de salle de bain ?" },
      { role: "ai", text: "Bonsoir ! Oui — un devis gratuit après une courte visite. Je peux vous proposer mardi 10h ou jeudi 14h. Votre nom et un numéro pour confirmer ?" },
      { role: "user", text: `Karim, ${MA} — mardi 10h` },
      { role: "ai", text: "Parfait Karim ✅ Mardi 10h est réservé. L'équipe vous confirme par SMS demain matin. Bonne soirée !" },
    ],
  },
  ar: {
    online: ONLINE.ar,
    placeholder: PLACEHOLDER.ar,
    lead: { name: "كريم", phone: MA },
    turns: [
      { role: "ai", text: "مرحباً بك في {NAME} 👋 كيف يمكنني مساعدتك؟" },
      { role: "user", text: "مساء الخير، هل تقدمون عروض أسعار لتجديد الحمّام بالكامل؟" },
      { role: "ai", text: "مساء النور! نعم، نقدم عرض سعر مجانياً بعد زيارة قصيرة للمعاينة. لدينا موعد متاح الثلاثاء في الساعة 10:00 أو الخميس في الساعة 14:00. هل يمكنك تزويدي باسمك ورقم هاتفك للتأكيد؟" },
      { role: "user", text: `كريم، ${ar(MA)} — الثلاثاء في الساعة 10:00` },
      { role: "ai", text: "ممتاز يا كريم ✅ تم حجز موعد الثلاثاء في الساعة 10:00. سيؤكد لك الفريق الموعد برسالة نصية صباح الغد. طابت ليلتك!" },
    ],
  },
  en: {
    online: ONLINE.en,
    placeholder: PLACEHOLDER.en,
    lead: { name: "James", phone: UK },
    turns: [
      { role: "ai", text: "Welcome to {NAME} 👋 How can I help?" },
      { role: "user", text: "Hi, do you quote for a full bathroom renovation?" },
      { role: "ai", text: "We do — a free quote after a short visit. I can offer Tuesday 10:00 or Thursday 14:00. Your name and a number to confirm?" },
      { role: "user", text: `James, ${UK} — Tuesday 10:00` },
      { role: "ai", text: "Perfect, James ✅ Tuesday 10:00 is booked. The team will confirm by text tomorrow morning. Have a good evening!" },
    ],
  },
};

/* ── any real business whose trade we could not detect ────────────────────
 * Shown when a prospect typed THEIR domain and the probe found no trade:
 * the demo wears their name, so the topic must fit whoever they are. An
 * appointment request fits a clinic, an agency and a workshop alike.      */

export const NEUTRAL_WANT: Record<OwnerLang, string> = {
  fr: "Demande de rendez-vous, jeudi",
  en: "Appointment request, Thursday",
};

export const NEUTRAL: Record<VisitorLang, VisitorScript> = {
  fr: {
    online: ONLINE.fr,
    placeholder: PLACEHOLDER.fr,
    lead: { name: "Yassine", phone: MA },
    turns: [
      { role: "ai", text: "Bienvenue chez {NAME} 👋 Comment puis-je vous aider ?" },
      { role: "user", text: "Bonjour, est-ce que vous prenez de nouveaux clients ? J'aimerais un rendez-vous cette semaine." },
      { role: "ai", text: "Bonjour 😊 Oui, avec plaisir. Dites-moi ce dont vous avez besoin et je vous propose un créneau — ou quelqu'un de l'équipe vous rappelle. Votre nom et un numéro ?" },
      { role: "user", text: `Yassine, ${MA} — jeudi si possible` },
      { role: "ai", text: `Merci Yassine ✅ C'est noté pour jeudi. {NAME} vous confirme l'horaire très vite au ${MA}. Bonne journée !` },
    ],
  },
  ar: {
    online: ONLINE.ar,
    placeholder: PLACEHOLDER.ar,
    lead: { name: "ياسين", phone: MA },
    turns: [
      { role: "ai", text: "مرحباً بك في {NAME} 👋 كيف يمكنني مساعدتك؟" },
      { role: "user", text: "السلام عليكم، هل تقبلون عملاء جدداً؟ أرغب في حجز موعد هذا الأسبوع." },
      { role: "ai", text: "وعليكم السلام 😊 مرحباً بك. أخبرني بما تحتاجه وسأقترح عليك موعداً مناسباً، أو يمكن لأحد أفراد الفريق الاتصال بك. هل يمكنك تزويدي باسمك ورقم هاتفك؟" },
      { role: "user", text: `ياسين، ${ar(MA)} — يوم الخميس إن أمكن` },
      { role: "ai", text: `شكراً لك ياسين ✅ سجّلت طلبك ليوم الخميس. سيؤكد لك {NAME} الموعد قريباً على الرقم ${ar(MA)}. طاب يومك!` },
    ],
  },
  en: {
    online: ONLINE.en,
    placeholder: PLACEHOLDER.en,
    lead: { name: "James", phone: UK },
    turns: [
      { role: "ai", text: "Welcome to {NAME} 👋 How can I help?" },
      { role: "user", text: "Hi, are you taking new clients? I'd like an appointment this week." },
      { role: "ai", text: "Hello 😊 Gladly. Tell me what you need and I'll suggest a slot — or someone from the team calls you back. Your name and a number?" },
      { role: "user", text: `James, ${UK} — Thursday if possible` },
      { role: "ai", text: `Thank you James ✅ Noted for Thursday. {NAME} will confirm the time shortly on ${UK}. Have a good day!` },
    ],
  },
};

/* ── which script a trade gets ───────────────────────────────────────────
 *
 * The key comes from CLIENT_REFS.niche for a known client, or the brand
 * probe's detection for a typed domain. An unrecognised trade is NOT an
 * error: it means the fixed workshop example for a stranger, and NEUTRAL
 * for a real business wearing its own name.
 */
export type TradeKey = "study-abroad" | "sourcing" | "generic";

export function tradeOf(niche?: string | null): TradeKey {
  const n = (niche ?? "").toLowerCase();
  if (n === "study-abroad") return "study-abroad";
  if (n === "sourcing") return "sourcing";
  return "generic";
}

export const TRADES: Record<TradeKey, { scripts: Record<VisitorLang, VisitorScript>; example: Example }> = {
  "study-abroad": { scripts: STUDY, example: STUDY_EXAMPLE },
  sourcing: { scripts: SOURCING, example: SOURCING_EXAMPLE },
  generic: { scripts: GENERIC, example: GENERIC_EXAMPLE },
};
