import type { Metadata } from "next";
import Link from "next/link";
import AssistantBriefForm, { type BriefInitial } from "@/components/AssistantBriefForm";
import { readUpgradeToken, subscriptionContext, referenceFor } from "@/lib/upgrade";
import { supabaseAdmin } from "@/lib/supabase";
import { getClientSite } from "@/lib/clientSites";
import { clientRefFor } from "@/lib/clientRefs";
import { assistantSlugFor, installSnippet } from "@/lib/assistant";
import { assistantInstalled } from "@/lib/assistantInstall";
import { ASSISTANT_SITES } from "@/lib/assistantSites";
import { HOSTING_TIERS, CLIENT_PRODUCTS } from "@/lib/hosting";

export const metadata: Metadata = {
  title: "Your AI assistant",
  robots: { index: false, follow: false },
};

/**
 * THE ASSISTANT'S OWN PAGE — what it knows, and the one line that puts it on
 * a site we do not host.
 *
 * Reached from the receipt and from the service page, by the same signed
 * token as every other client surface. A client who paid for "an assistant
 * trained on your business" needs somewhere to do the training; until this
 * existed the only way was to email us, and the assistant answered from
 * whatever brief we had written from their website.
 *
 * It says INSTALLED only when the tag is actually on their home page, read
 * from the repository at render time — not because a webhook once reported
 * success. A client whose site is elsewhere sees the snippet and a copy
 * button instead, with a mail-to-your-developer link, because the person
 * who pays for the assistant is often not the person who edits the site.
 */
export default async function AssistantPage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string; saved?: string; demo?: string; lang?: string }>;
}) {
  const { t: token = "", demo = "", lang: demoLang = "" } = await searchParams;

  /* WALK-THROUGH MODE (`?demo=1`), as on the service and trial pages: the
     exact page a client gets, filled with the fictitious agency, so it can
     be shown and clicked without a signed client link. Saving is refused —
     the form posts a token, and the demo has none. */
  const isDemo = demo === "1";
  const subscriptionId = !isDemo && token ? await readUpgradeToken(token) : null;
  const ctx = isDemo
    ? {
        plan: CLIENT_PRODUCTS.chatbot,
        lang: (demoLang === "fr" ? "fr" : "en") as "en" | "fr",
        ref: "demo-study-abroad",
        siteLabel: "atlas-etudes.ma",
      }
    : subscriptionId
      ? await subscriptionContext(subscriptionId)
      : null;
  const fr = ctx?.lang === "fr";

  // The row is where the billing address lives; the config follows it.
  const db = supabaseAdmin();
  const { data: row } = db && subscriptionId
    ? await db.from("hosting_clients").select("email, business, repo, branch, site_root, site_url, status").eq("subscription_id", subscriptionId).maybeSingle()
    : { data: null };

  const slug = isDemo ? "demo-study-abroad" : ctx ? assistantSlugFor(ctx.ref, ctx.siteLabel || row?.business) : "";
  const config = slug ? await getClientSite(slug) : undefined;
  /* The assistant's subscriber edits it. So does a HOSTING client whose
     assistant Servolia already built (a brief in code under their reference):
     they tried it in the showroom, and this is where they tell it what to
     say before they pay. Same token as their service page — nothing new to
     send them. See the same rule in /api/assistant-brief. */
  const paidAssistant = ctx?.plan.key === "chatbot";
  const builtForHosting = Boolean(ctx) && HOSTING_TIERS.includes(ctx!.plan.key) && Boolean(ASSISTANT_SITES[slug]);
  const isAssistant = paidAssistant || builtForHosting;
  const ref = clientRefFor(ctx?.ref);
  const hosted = Boolean(ref?.repo && !ref.gateWidget);
  const installed = hosted && ref?.repo
    ? await assistantInstalled({ repo: ref.repo, branch: ref.branch, siteRoot: ref.siteRoot ?? null })
    : null;
  const position = config?.widgetPosition === "left" ? "left" : "right";
  const snippet = slug ? installSnippet(slug, position) : "";

  const initial: BriefInitial | null = ctx
    ? {
        businessName: config?.businessName ?? ctx.siteLabel ?? row?.business ?? "",
        about: config?.about ?? "",
        city: config?.city ?? "",
        phone: config?.phone ?? "",
        whatsapp: config?.whatsapp ?? "",
        email: config?.email ?? row?.email ?? "",
        hours: config?.hours ?? "",
        bookingUrl: config?.bookingUrl ?? "",
        languages: config?.languages ?? [ctx.lang],
        services: (config?.services ?? []).map((s) => `${s.name}${s.description ? ` — ${s.description}` : ""}`).join("\n"),
        faqs: (config?.faqs ?? []).map((f) => `${f.q}\n${f.a}`).join("\n\n"),
        instructions: config?.ownerInstructions ?? "",
        tone: config?.aiTone ?? "",
        accent: config?.accent ?? "#36671E",
        position,
        domains: (config?.domains ?? [ctx.siteLabel || row?.business || ""]).filter(Boolean).join(", "),
      }
    : null;

  return (
    <main className="min-h-screen bg-[#FAFAF7] flex flex-col">
      <header className="px-5 py-6 border-b border-[#E8E6E0] bg-white">
        <div className="max-w-xl mx-auto">
          <Link href="/" className="inline-flex items-center">
            <span className="text-xl font-black tracking-tight text-[#18181B]">
              Serv<span className="gradient-text">olia</span>
            </span>
          </Link>
        </div>
      </header>

      <div className="flex-1 px-5 py-12 sm:py-16">
        <div className="max-w-xl mx-auto">
          {(!subscriptionId && !isDemo) || !ctx || !initial ? (
            <div className="rounded-2xl border border-[#E8E6E0] bg-white p-7 text-center">
              <h1 className="text-xl font-black text-[#18181B] mb-2">This link has expired</h1>
              <p className="text-sm text-[#52525B] leading-relaxed">
                Reply to your payment confirmation and we will send a fresh one.
              </p>
            </div>
          ) : !isAssistant ? (
            <div className="rounded-2xl border border-[#E8E6E0] bg-white p-7 text-center">
              <h1 className="text-xl font-black text-[#18181B] mb-2">
                {fr ? "Cette page concerne l'assistant IA" : "This page is for the AI assistant"}
              </h1>
              <p className="text-sm text-[#52525B] leading-relaxed">
                {fr
                  ? "Votre abonnement est un hébergement. Votre page de service est dans votre email de confirmation."
                  : "Your subscription is hosting. Your service page is in your confirmation email."}
              </p>
            </div>
          ) : (
            <>
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#36671E] mb-3">
                {fr ? "Votre assistant IA" : "Your AI assistant"}
              </p>
              <h1 className="text-3xl sm:text-[34px] font-black text-[#161A15] tracking-tight mb-3">
                {fr ? "Ce qu'il sait, et où il répond" : "What it knows, and where it answers"}
              </h1>
              <p className="text-[#52525B] leading-relaxed mb-2">
                {fr
                  ? "Il répond à vos visiteurs à partir de ce que vous écrivez ici. Chaque modification s'applique dès la conversation suivante — rien à redéployer."
                  : "It answers your visitors from what you write here. Every change applies from the next conversation — nothing to redeploy."}
              </p>
              <p className="text-[13px] text-[#8A8A80] mb-8">
                {fr ? "Votre référence" : "Your reference"}{" "}
                <span className="font-bold text-[#5E6659] tabular-nums">{subscriptionId ? referenceFor(subscriptionId) : "DEMO-0000"}</span>
                {ctx.siteLabel ? <> · {ctx.siteLabel}</> : null}
              </p>

              {builtForHosting ? (
                <div className="rounded-2xl border border-[#CBE3BC] bg-[#F7FBF4] p-5 mb-6" data-testid="brief-not-active">
                  <p className="font-bold text-[#161A15]">
                    {fr ? "Construit pour vous — pas encore actif sur votre site" : "Built for you — not yet active on your site"}
                  </p>
                  <p className="text-[14px] text-[#3F3F46] leading-relaxed mt-1">
                    {fr
                      ? "Ce que vous écrivez ici s'applique tout de suite à l'aperçu, et sur votre site dès que vous l'activez."
                      : "What you write here applies to the preview right away, and to your site the moment you turn it on."}
                  </p>
                  <div className="flex flex-wrap gap-3 mt-3">
                    <a href={`/hosting/assistant/try?site=${encodeURIComponent(slug)}`} target="_blank" rel="noreferrer" className="text-[14px] font-bold text-[#36671E] hover:underline">
                      {fr ? "L'essayer →" : "Try it →"}
                    </a>
                    <Link href={`/hosting?plan=chatbot&ref=${encodeURIComponent(ctx.ref)}`} className="text-[14px] font-bold text-[#36671E] hover:underline">
                      {fr ? "L'activer sur mon site →" : "Turn it on for my site →"}
                    </Link>
                  </div>
                </div>
              ) : null}

              <AssistantBriefForm
                token={token}
                lang={ctx.lang}
                initial={initial}
                snippet={snippet}
                hosted={hosted}
                installed={installed}
                tryUrl={`/hosting/assistant/try?site=${encodeURIComponent(slug)}`}
              />
            </>
          )}
        </div>
      </div>

      <footer className="px-5 py-8 border-t border-[#E8E6E0] bg-white">
        <div className="max-w-xl mx-auto text-center">
          <p className="text-xs text-[#8A8A80]">
            {fr ? "Fourni par " : "Provided by "}
            <span className="font-bold text-[#52525B]">Servolia LLC</span> · Wyoming, USA
          </p>
        </div>
      </footer>
    </main>
  );
}
