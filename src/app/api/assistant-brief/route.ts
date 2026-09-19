import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { sendTelegramMessage } from "@/lib/telegram";
import { readUpgradeToken, subscriptionContext, referenceFor } from "@/lib/upgrade";
import { getClientSite, type ClientSiteConfig, type ClientService, type ClientFaq } from "@/lib/clientSites";
import { assistantSlugFor, hostnameOf, installSnippet, isAssistantLang, ASSISTANT_ORIGIN, type AssistantLang } from "@/lib/assistant";
import { clientRefFor } from "@/lib/clientRefs";
import { ASSISTANT_SITES } from "@/lib/assistantSites";
import { HOSTING_TIERS } from "@/lib/hosting";

export const runtime = "nodejs";

/**
 * The client's brief for their assistant, written to client_sites.
 *
 * Authorised by the subscription's signed token, like every other client
 * surface, and scoped to that subscription's slug: it can only ever write the
 * config of the assistant the token holder pays for.
 *
 * WHAT IT NEVER TAKES FROM THE FORM: the slug (derived from the subscription),
 * the billing address the enabled check keys on (read from the hosting row),
 * the assistantOnly marker and the feature switch. Those decide who pays and
 * who is served, and a form field is a thing anyone can edit in devtools.
 *
 * Starts from the existing config — the database row if the client saved
 * before, else the brief kept in code — so fields the form does not show
 * (a pixel id, a timezone, quick replies) survive a save instead of being
 * wiped by the absence of an input for them.
 */
const MAX = 4000;
const clean = (v: unknown, max = 300) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** "Teeth whitening — from €190" → { name, description }. One per line. */
function parseServices(raw: string): ClientService[] {
  return raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).slice(0, 20).map((line) => {
    const m = line.match(/^(.+?)\s*(?:—|–|-|:)\s+(.+)$/);
    return m ? { name: m[1].trim().slice(0, 80), description: m[2].trim().slice(0, 240) } : { name: line.slice(0, 80) };
  });
}

/** Paragraphs of "question\nanswer". Tolerates a one-line block as a bare question. */
function parseFaqs(raw: string): ClientFaq[] {
  return raw.split(/\r?\n\s*\r?\n/).map((b) => b.trim()).filter(Boolean).slice(0, 25).flatMap((block) => {
    const [q, ...rest] = block.split(/\r?\n/);
    const a = rest.join(" ").trim();
    if (!q || !a) return [];
    return [{ q: q.trim().slice(0, 200), a: a.slice(0, 600) }];
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const subscriptionId = await readUpgradeToken(clean(body?.token, 2000));
  if (!subscriptionId) return NextResponse.json({ error: "invalid-link" }, { status: 400 });

  const ctx = await subscriptionContext(subscriptionId);
  /* WHO MAY WRITE A BRIEF: the assistant's own subscriber — or a HOSTING
     client whose assistant Servolia has already built (a brief in code under
     their reference). The second is the showroom's other half: they tried
     it, now they tell it what to say before they pay. It cannot switch
     anything on — assistantEnabled() keys on a chatbot row that does not
     exist yet — and it can only ever write the config under THEIR slug. */
  const hostingWithBrief =
    Boolean(ctx) &&
    HOSTING_TIERS.includes(ctx!.plan.key) &&
    Boolean(ASSISTANT_SITES[assistantSlugFor(ctx!.ref, ctx!.siteLabel)]);
  if (!ctx || !(ctx.plan.key === "chatbot" || hostingWithBrief)) {
    return NextResponse.json({ error: "not-assistant" }, { status: 400 });
  }

  const db = supabaseAdmin();
  if (!db) return NextResponse.json({ error: "no-db" }, { status: 503 });

  /* The paying row must exist: the enabled check keys on its address, and a
     brief for an assistant that is not paid for would be answered to nobody.
     The webhook writes it seconds after payment; a click that beats it gets
     "try again in a minute", not a silent save. */
  const { data: row } = await db.from("hosting_clients")
    .select("email, business").eq("subscription_id", subscriptionId).maybeSingle();
  if (!row?.email) return NextResponse.json({ error: "not-ready" }, { status: 409 });

  let slug = assistantSlugFor(ctx.ref, ctx.siteLabel || row.business);
  if (slug.startsWith("demo-")) slug = `site-${slug}`; // never shadow a bundled demo
  const existing = await getClientSite(slug);
  const base: Partial<ClientSiteConfig> = existing && !existing.isDemo ? existing : {};

  const businessName = clean(body?.businessName, 120);
  const email = clean(body?.email, 200);
  if (!businessName || !/.+@.+\..+/.test(email)) {
    return NextResponse.json({ error: "missing-fields" }, { status: 400 });
  }

  const languages = (Array.isArray(body?.languages) ? body.languages : []).filter(isAssistantLang) as AssistantLang[];
  const accent = /^#[0-9a-fA-F]{6}$/.test(clean(body?.accent, 7)) ? clean(body?.accent, 7) : (base.accent ?? "#36671E");
  const domains = clean(body?.domains, 600).split(/[,\s]+/).map((d) => hostnameOf(d)).filter(Boolean);
  const about = clean(body?.about, MAX);
  const whatsapp = clean(body?.whatsapp, 20).replace(/[^\d]/g, "");
  const renamed = Boolean(base.businessName && base.businessName !== businessName);

  const config: ClientSiteConfig = {
    ...base,
    slug,
    businessName,
    niche: base.niche ?? "service",
    language: ctx.lang,
    accent,
    city: clean(body?.city, 80) || undefined,
    phone: clean(body?.phone, 40) || undefined,
    whatsapp: whatsapp || undefined,
    email,
    hours: clean(body?.hours, 160) || undefined,
    bookingUrl: /^https?:\/\//.test(clean(body?.bookingUrl, 300)) ? clean(body?.bookingUrl, 300) : undefined,
    about: about || base.about || businessName,
    services: parseServices(clean(body?.services, MAX)),
    faqs: parseFaqs(clean(body?.faqs, MAX)),
    whyUs: base.whyUs ?? [],
    heroHeadline: base.heroHeadline ?? businessName,
    heroSub: base.heroSub ?? (about || businessName).slice(0, 160),
    aiTone: clean(body?.tone, 80) || undefined,
    /* The owner's own orders for the assistant — the field that answers
       "I want it to do THIS for me". Free text on purpose: nobody can
       enumerate every wish, and the prompt frames it under the safety
       rules rather than above them. */
    ownerInstructions: clean(body?.instructions, 1500) || undefined,
    languages: languages.length ? languages : (base.languages ?? [ctx.lang]),
    // Greetings written for the old name would keep saying it.
    greetings: renamed ? undefined : base.greetings,
    widgetPosition: body?.position === "left" ? "left" : "right",
    domains: domains.length ? domains : (base.domains ?? []),
    assistantOnly: true,
    hostingEmail: row.email,
    isDemo: false,
    features: { chat: true },
    status: "draft",
  };

  const { data: current } = await db.from("client_sites").select("id").eq("slug", slug).maybeSingle();
  const record = {
    slug,
    build_id: null,
    business: businessName,
    niche: config.niche,
    config,
    status: "draft" as const,
    notes: "ASSISTANT ONLY — hosting add-on (chatbot). No site is rendered for this slug.",
  };
  const { error } = current
    ? await db.from("client_sites").update(record).eq("id", (current as { id: string }).id)
    : await db.from("client_sites").insert(record);
  if (error) {
    console.error("[assistant-brief] write failed:", error.message);
    return NextResponse.json({ error: "write-failed" }, { status: 500 });
  }

  sendTelegramMessage(
    [
      `Assistant brief ${current ? "updated" : "saved"} - ${businessName}`,
      `Ref ${referenceFor(subscriptionId)} · slug ${slug}`,
      `${config.services.length} services · ${config.faqs.length} Q&A · ${(config.languages ?? []).join("/")}`,
      `Leads to: ${email}${domains.length ? ` · on ${domains.join(", ")}` : ""}`,
    ].join("\n"),
    undefined,
    { plain: true, silent: true },
  ).catch(() => {});

  /* Same rule as the assistant page: a site we host proxies /assistant.js from
     its own domain, so the snippet stays relative and names no supplier. One
     we do not host is about to be pasted somewhere that cannot proxy, where a
     relative path just 404s, so it gets the absolute URL. */
  const hostRef = clientRefFor(ctx.ref);
  const hosted = Boolean(hostRef?.repo && !hostRef.gateWidget);
  return NextResponse.json({
    ok: true,
    slug,
    snippet: installSnippet(slug, config.widgetPosition, hosted ? {} : { origin: ASSISTANT_ORIGIN }),
  });
}
