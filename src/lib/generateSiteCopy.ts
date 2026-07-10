import Anthropic from "@anthropic-ai/sdk";
import type { ClientSiteConfig, ClientService, ClientFaq } from "@/lib/clientSites";

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

  const prompt = `You are the senior copywriter at Servolia, an agency that delivers websites with AI receptionists for service businesses (dental clinics, aesthetic clinics, real estate, home services, law firms...).

A new client paid and filled our intake form. Write their complete website copy IN ${lang.toUpperCase()}.

CLIENT INTAKE (their own words — the source of truth):
${intakeText || "(intake was sparse — write solid generic copy for the niche)"}

Business name: ${draft.businessName}
Niche: ${draft.niche}
City/Country: ${[draft.city, draft.country].filter(Boolean).join(", ") || "not specified"}
Current parsed services: ${draft.services.map((s) => s.name).join(", ") || "none parsed"}

Return ONLY a JSON object with exactly these keys:
{
  "heroHeadline": "≤80 chars. Benefit-led, specific to this business. Not generic 'welcome'.",
  "heroSub": "≤200 chars. What they do + the 24/7 online booking/assistant advantage.",
  "about": "2-4 sentences. Warm, credible, specific to this business and city.",
  "services": [{ "name": "...", "description": "one sentence, concrete", "price": "ONLY if the intake states a price, else omit this key" }],
  "whyUs": ["4-5 short differentiators grounded in the intake"],
  "faqs": [{ "q": "...", "a": "..." }],
  "aiTone": "2-4 words describing how the AI receptionist should speak for this business",
  "aiGreeting": "the receptionist's first message, ≤140 chars, friendly, mentions the business name"
}

Rules — these are hard constraints:
- Write in ${lang}. Natural, professional, no hype words like "best" or "#1".
- Use ONLY facts from the intake. NEVER invent prices, certifications, awards, review counts, years in business, or team size. If the intake gives prices, use them exactly.
- faqs: write 5-6 covering what real customers in the "${draft.niche}" niche ask (booking, prices/quotes policy, location, first visit, emergencies/urgency if relevant). Answers must be honest for a business whose details you only partly know — prefer "contact us / ask the assistant" over invented specifics.
- Keep every service the client listed; add descriptions for each. Do not add services they didn't mention.`;

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

    const config: ClientSiteConfig = {
      ...draft,
      heroHeadline: copy.heroHeadline ?? draft.heroHeadline,
      heroSub: copy.heroSub ?? draft.heroSub,
      about: copy.about ?? draft.about,
      services: services?.length ? services : draft.services,
      whyUs: copy.whyUs ?? draft.whyUs,
      faqs: copy.faqs ?? draft.faqs,
      aiTone: copy.aiTone ?? draft.aiTone,
      aiGreeting: copy.aiGreeting ?? draft.aiGreeting,
    };
    return { config, ai: true };
  } catch {
    return { config: draft, ai: false };
  }
}
