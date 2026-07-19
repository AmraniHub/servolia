import Anthropic from "@anthropic-ai/sdk";
import type {
  ClientSiteConfig, ClientService, ClientFaq, ClientHighlight,
  ClientStat, ClientSolution, ClientExpertiseBlock,
} from "@/lib/clientSites";
import {
  isDentalNiche, dentalCopyPlaybook, DENTAL_HIGHLIGHT_IMAGES, DENTAL_EXPERTISE_IMAGES,
} from "@/lib/niches/dental";

/**
 * AI enrichment for client-site generation.
 *
 * configFromIntake() does the mechanical 60% (slug, contacts, colors, structure).
 * This layer does the other 40% that used to be manual founder work: it has
 * Claude write the client's entire site copy — hero, about, service descriptions,
 * why-us, FAQs — plus the receptionist's tone and greeting, from the raw intake
 * answers, in the client's language.
 *
 * Guardrails: uses ONLY facts present in the intake. Never invents prices,
 * certifications, review counts, or years in business. Gracefully returns the
 * mechanical draft unchanged if the API key is missing or the call fails —
 * generation never breaks delivery.
 */

const MODEL = "claude-haiku-4-5-20251001";

interface AiCopy {
  heroHeadline?: string;
  heroSub?: string;
  about?: string;
  services?: ClientService[];
  whyUs?: string[];
  faqs?: ClientFaq[];
  aiTone?: string;
  aiGreeting?: string;
  // Rich multi-page blocks — grounded in intake, never invented.
  highlights?: ClientHighlight[];
  solutions?: ClientSolution[];
  expertise?: ClientExpertiseBlock[];
  stats?: ClientStat[];
}

function extractJson<T>(raw: string): T | null {
  const cleaned = raw.replace(/```json\s*|```\s*$/g, "").trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]) as T;
    } catch {
      return null;
    }
  }
}

const cleanStr = (v: unknown, max = 400): string | undefined => {
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t.length > 1 ? t.slice(0, max) : undefined;
};

/** Validate and clamp whatever the model returned before it touches the config. */
function sanitize(copy: AiCopy): AiCopy {
  const out: AiCopy = {};
  out.heroHeadline = cleanStr(copy.heroHeadline, 90);
  out.heroSub = cleanStr(copy.heroSub, 220);
  out.about = cleanStr(copy.about, 900);
  out.aiTone = cleanStr(copy.aiTone, 80);
  out.aiGreeting = cleanStr(copy.aiGreeting, 160);

  if (Array.isArray(copy.services)) {
    out.services = copy.services
      .map((s) => ({
        name: cleanStr(s?.name, 60) ?? "",
        description: cleanStr(s?.description, 160),
        price: cleanStr(s?.price, 40),
      }))
      .filter((s) => s.name)
      .slice(0, 8);
    if (!out.services.length) delete out.services;
  }

  if (Array.isArray(copy.whyUs)) {
    out.whyUs = copy.whyUs
      .map((w) => cleanStr(w, 90))
      .filter((w): w is string => !!w)
      .slice(0, 5);
    if (!out.whyUs.length) delete out.whyUs;
  }

  if (Array.isArray(copy.faqs)) {
    out.faqs = copy.faqs
      .map((f) => ({ q: cleanStr(f?.q, 120) ?? "", a: cleanStr(f?.a, 400) ?? "" }))
      .filter((f) => f.q && f.a)
      .slice(0, 6);
    if (!out.faqs.length) delete out.faqs;
  }

  if (Array.isArray(copy.highlights)) {
    out.highlights = copy.highlights
      .map((h) => ({ title: cleanStr(h?.title, 80) ?? "", body: cleanStr(h?.body, 260) ?? "" }))
      .filter((h) => h.title && h.body)
      .slice(0, 3);
    if (!out.highlights.length) delete out.highlights;
  }

  if (Array.isArray(copy.solutions)) {
    out.solutions = copy.solutions
      .map((s) => ({ title: cleanStr(s?.title, 60) ?? "", body: cleanStr(s?.body, 160) }))
      .filter((s) => s.title)
      .slice(0, 6);
    if (!out.solutions.length) delete out.solutions;
  }

  if (Array.isArray(copy.expertise)) {
    out.expertise = copy.expertise
      .map((e) => ({
        eyebrow: cleanStr(e?.eyebrow, 48),
        title: cleanStr(e?.title, 80) ?? "",
        body: cleanStr(e?.body, 420) ?? "",
        bullets: Array.isArray(e?.bullets)
          ? e.bullets.map((b) => cleanStr(b, 90)).filter((b): b is string => !!b).slice(0, 5)
          : undefined,
      }))
      .filter((e) => e.title && e.body)
      .slice(0, 2);
    if (!out.expertise.length) delete out.expertise;
  }

  if (Array.isArray(copy.stats)) {
    out.stats = copy.stats
      .map((s) => ({ value: cleanStr(s?.value, 12) ?? "", label: cleanStr(s?.label, 40) ?? "" }))
      .filter((s) => s.value && s.label)
      .slice(0, 4);
    if (!out.stats.length) delete out.stats;
  }

  return out;
}

/**
 * Enrich a mechanical draft config with AI-written copy.
 * Returns { config, ai } — ai=false means the fallback draft was kept as-is.
 */
export async function aiEnrichConfig(
  draft: ClientSiteConfig,
  intake: Record<string, unknown>
): Promise<{ config: ClientSiteConfig; ai: boolean }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { config: draft, ai: false };

  const lang = draft.language === "fr" ? "French" : "English";

  // Give the model everything the client told us, plus the mechanical skeleton.
  const intakeText = Object.entries(intake)
    .filter(([, v]) => typeof v === "string" && (v as string).trim().length > 0)
    .map(([k, v]) => `${k}: ${String(v).trim().slice(0, 500)}`)
    .join("\n");

  const nicheLang = draft.language;
  const nichePlaybook = isDentalNiche(draft.niche) ? dentalCopyPlaybook(nicheLang) : "";

  const prompt = `You are the senior copywriter at Servolia, an agency that delivers websites with AI receptionists for service businesses (dental clinics, aesthetic clinics, real estate, home services, law firms...).

A new client paid and filled our intake form. Write their complete website copy IN ${lang.toUpperCase()}.

CLIENT INTAKE (their own words — the source of truth):
${intakeText || "(intake was sparse — write solid generic copy for the niche)"}

Business name: ${draft.businessName}
Niche: ${draft.niche}
City/Country: ${[draft.city, draft.country].filter(Boolean).join(", ") || "not specified"}
Current parsed services: ${draft.services.map((s) => s.name).join(", ") || "none parsed"}
${nichePlaybook}

Return ONLY a JSON object with exactly these keys:
{
  "heroHeadline": "≤80 chars. Benefit-led, specific to this business. Not generic 'welcome'.",
  "heroSub": "≤200 chars. What they do + the 24/7 online booking/assistant advantage.",
  "about": "2-4 sentences. Warm, credible, specific to this business and city.",
  "services": [{ "name": "...", "description": "one sentence, concrete", "price": "ONLY if the intake states a price, else omit this key" }],
  "whyUs": ["4-5 short differentiators grounded in the intake"],
  "faqs": [{ "q": "...", "a": "..." }],
  "highlights": [{ "title": "≤80 chars", "body": "≤240 chars — a headline feature/differentiator of this business" }],
  "solutions": [{ "title": "≤50 chars — a service/treatment category this business offers", "body": "one short sentence" }],
  "expertise": [{ "eyebrow": "2-4 word label", "title": "≤80 chars", "body": "2-3 sentences on this area of their work", "bullets": ["3-4 short supporting points"] }],
  "stats": [{ "value": "e.g. '10 ans' or '500+'", "label": "what it measures" }],
  "aiTone": "2-4 words describing how the AI receptionist should speak for this business",
  "aiGreeting": "the receptionist's first message, ≤140 chars, friendly, mentions the business name"
}

Rules — these are hard constraints:
- Write in ${lang}. Natural, professional, no hype words like "best" or "#1".
- Use ONLY facts from the intake. NEVER invent prices, certifications, awards, review counts, years in business, or team size. If the intake gives prices, use them exactly.
- faqs: write 5-6 covering what real customers in the "${draft.niche}" niche ask (booking, prices/quotes policy, location, first visit, emergencies/urgency if relevant). Answers must be honest for a business whose details you only partly know — prefer "contact us / ask the assistant" over invented specifics.
- Keep every service the client listed; add descriptions for each. Do not add services they didn't mention.
- highlights: 2-3 real feature blocks drawn from the intake (a service they emphasise, a technology, a reassurance point). If the intake is too thin, return fewer or omit the key — do not invent capabilities.
- solutions: 3-6 treatment/service categories THIS business actually offers (based on their services). Never list a service they didn't mention.
- expertise: 1-2 in-depth blocks about their strongest area, grounded in the intake. Omit if you'd have to invent.
- stats: ONLY include a stat if the intake states a real number (years in business, patients/clients served, locations). If the intake gives no real numbers, return an empty array — NEVER fabricate a statistic.`;

  try {
    const client = new Anthropic({ apiKey });
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 2000,
      messages: [{ role: "user", content: prompt }],
    });
    const text = res.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
    const parsed = extractJson<AiCopy>(text);
    if (!parsed) return { config: draft, ai: false };

    const copy = sanitize(parsed);

    // Merge: AI copy wins where present; mechanical draft is the safety net.
    // Preserve any price the mechanical parse captured if AI dropped it for the same service.
    const services = copy.services?.map((s) => {
      const prev = draft.services.find((p) => p.name.toLowerCase() === s.name.toLowerCase());
      return { ...s, price: s.price ?? prev?.price };
    });

    // Attach illustrative images to the AI-written visual blocks. The model
    // supplies the words; we supply niche-appropriate stock imagery by position
    // (dental only for now — other niches render image-less gradient variants).
    const dental = isDentalNiche(draft.niche);
    const highlights = copy.highlights?.map((h, i) => ({
      ...h,
      imageUrl: dental ? DENTAL_HIGHLIGHT_IMAGES[i % DENTAL_HIGHLIGHT_IMAGES.length] : undefined,
    }));
    const expertise = copy.expertise?.map((e, i) => ({
      ...e,
      imageUrl: dental ? DENTAL_EXPERTISE_IMAGES[i % DENTAL_EXPERTISE_IMAGES.length] : undefined,
    }));

    const config: ClientSiteConfig = {
      ...draft,
      heroHeadline: copy.heroHeadline ?? draft.heroHeadline,
      heroSub: copy.heroSub ?? draft.heroSub,
      about: copy.about ?? draft.about,
      services: services?.length ? services : draft.services,
      whyUs: copy.whyUs ?? draft.whyUs,
      faqs: copy.faqs ?? draft.faqs,
      highlights: highlights?.length ? highlights : draft.highlights,
      solutions: copy.solutions?.length ? copy.solutions : draft.solutions,
      expertise: expertise?.length ? expertise : draft.expertise,
      stats: copy.stats?.length ? copy.stats : draft.stats,
      aiTone: copy.aiTone ?? draft.aiTone,
      aiGreeting: copy.aiGreeting ?? draft.aiGreeting,
    };
    return { config, ai: true };
  } catch {
    return { config: draft, ai: false };
  }
}
