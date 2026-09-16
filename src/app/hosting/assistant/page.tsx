import type { Metadata } from "next";
import Link from "next/link";
import AssistantBriefForm, { type BriefInitial } from "@/components/AssistantBriefForm";
import { readUpgradeToken, subscriptionContext, referenceFor } from "@/lib/upgrade";
import { supabaseAdmin } from "@/lib/supabase";
import { getClientSite } from "@/lib/clientSites";
import { clientRefFor } from "@/lib/clientRefs";
import { assistantSlugFor, installSnippet } from "@/lib/assistant";
import { assistantInstalled } from "@/lib/assistantInstall";

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
  searchParams: Promise<{ t?: string; saved?: string }>;
}) {
  const { t: token = "" } = await searchParams;
  const subscriptionId = token ? await readUpgradeToken(token) : null;
  const ctx = subscriptionId ? await subscriptionContext(subscriptionId) : null;
  const fr = ctx?.lang === "fr";

  // The row is where the billing address lives; the config follows it.
  const db = supabaseAdmin();
  const { data: row } = db && subscriptionId
    ? await db.from("hosting_clients").select("email, business, repo, branch, site_root, site_url, status").eq("subscription_id", subscriptionId).maybeSingle()
    : { data: null };

  const isAssistant = ctx?.plan.key === "chatbot";
  const slug = ctx ? assistantSlugFor(ctx.ref, ctx.siteLabel || row?.business) : "";
  const config = slug ? await getClientSite(slug) : undefined;
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
          {!subscriptionId || !ctx || !initial ? (
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
                <span className="font-bold text-[#5E6659] tabular-nums">{referenceFor(subscriptionId)}</span>
                {ctx.siteLabel ? <> · {ctx.siteLabel}</> : null}
              </p>

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
