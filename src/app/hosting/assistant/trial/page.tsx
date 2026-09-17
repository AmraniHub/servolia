import type { Metadata } from "next";
import Link from "next/link";
import { readUpgradeToken, subscriptionContext } from "@/lib/upgrade";
import { HOSTING_TIERS, CLIENT_PRODUCTS } from "@/lib/hosting";
import { ASSISTANT_SITES } from "@/lib/assistantSites";
import { clientRefFor } from "@/lib/clientRefs";
import { trialStateFor, TRIAL_DAYS } from "@/lib/assistantTrial";
import StartTrialButton from "@/components/StartTrialButton";

export const metadata: Metadata = {
  title: "Try it on your site",
  robots: { index: false, follow: false },
};

/**
 * THE CONSENT PAGE. One signed link, one button, one sentence about what
 * will happen and when it stops. Reached from the "we built your assistant"
 * email and from the client's service page — both places only the client
 * holds.
 *
 * What it must never do: start anything on GET. The link may be opened by
 * a mail scanner, a preview pane, or the client twice; only the POST behind
 * the button changes their site.
 */
export default async function TrialPage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string }>;
}) {
  const { t: token = "" } = await searchParams;
  const subscriptionId = token ? await readUpgradeToken(token) : null;
  const ctx = subscriptionId ? await subscriptionContext(subscriptionId) : null;
  const fr = ctx?.lang === "fr";
  const ref = ctx?.ref?.toLowerCase() ?? "";
  const client = clientRefFor(ref);
  const brief = ASSISTANT_SITES[ref];
  const eligible = Boolean(ctx && HOSTING_TIERS.includes(ctx.plan.key) && client && brief);
  const state = eligible ? await trialStateFor(ref) : { state: "none" as const };
  const price = CLIENT_PRODUCTS.chatbot;
  const payUrl = `/hosting?plan=chatbot&ref=${encodeURIComponent(ref)}`;

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

      <div className="flex-1 px-5 py-16">
        <div className="max-w-xl mx-auto">
          {!ctx ? (
            <div className="rounded-2xl border border-[#E8E6E0] bg-white p-7 text-center">
              <h1 className="text-xl font-black text-[#18181B] mb-2">This link has expired</h1>
              <p className="text-sm text-[#52525B]">Reply to our email and we will send a fresh one.</p>
            </div>
          ) : !eligible ? (
            <div className="rounded-2xl border border-[#E8E6E0] bg-white p-7 text-center">
              <h1 className="text-xl font-black text-[#18181B] mb-2">
                {fr ? "Cette page concerne l'essai de l'assistant" : "This page is for the assistant trial"}
              </h1>
              <p className="text-sm text-[#52525B]">
                {fr ? "Elle est réservée aux sites hébergés chez Servolia." : "It is for sites hosted with Servolia."}
              </p>
            </div>
          ) : (
            <>
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#36671E] mb-3">
                {fr ? `${TRIAL_DAYS} jours d'essai, sans carte` : `${TRIAL_DAYS}-day trial, no card`}
              </p>
              <h1 className="text-3xl font-black text-[#161A15] tracking-tight mb-3">
                {fr ? `L'assistant de ${brief!.businessName}, sur votre site` : `${brief!.businessName}'s assistant, on your site`}
              </h1>

              {state.state === "paid" ? (
                <p className="text-[#52525B] leading-relaxed">
                  {fr ? "Votre assistant est déjà actif sur votre site." : "Your assistant is already active on your site."}
                </p>
              ) : state.state === "running" ? (
                <div className="rounded-2xl border border-[#CBE3BC] bg-[#F3F9EE] p-5" data-testid="trial-running">
                  <p className="font-bold text-[#161A15]">
                    {fr ? `Il est en ligne sur ${client!.label}` : `It is live on ${client!.label}`}
                  </p>
                  <p className="text-[14px] text-[#3F3F46] leading-relaxed mt-1">
                    {fr
                      ? `Jusqu'au ${new Date(state.until).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}. Pour le garder ensuite : ${price.monthlyUsd} $/mois.`
                      : `Until ${new Date(state.until).toLocaleDateString("en-GB", { day: "numeric", month: "long" })}. To keep it afterwards: $${price.monthlyUsd}/month.`}
                  </p>
                  <Link href={payUrl} className="inline-flex items-center mt-3 text-[14px] font-bold text-[#36671E] hover:underline">
                    {fr ? "Le garder →" : "Keep it →"}
                  </Link>
                </div>
              ) : state.state === "ended" ? (
                <div className="rounded-2xl border border-[#E8E6E0] bg-white p-5">
                  <p className="font-bold text-[#161A15]">
                    {fr ? "Votre semaine d'essai a eu lieu" : "Your trial week has happened"}
                  </p>
                  <p className="text-[14px] text-[#3F3F46] leading-relaxed mt-1">
                    {fr
                      ? `Pour le remettre en ligne — mêmes réglages, rien à réinstaller : ${price.monthlyUsd} $/mois ou ${price.annualUsd} $/an.`
                      : `To put it back — same settings, nothing to reinstall: $${price.monthlyUsd}/month or $${price.annualUsd}/year.`}
                  </p>
                  <Link href={payUrl} className="inline-flex items-center mt-3 text-[14px] font-bold text-[#36671E] hover:underline">
                    {fr ? "Le remettre en ligne →" : "Put it back →"}
                  </Link>
                </div>
              ) : (
                <>
                  <p className="text-[#52525B] leading-relaxed mb-3">
                    {fr
                      ? `En un clic, l'assistant que nous avons construit pour vous est ajouté aux pages de ${client!.label} et commence à répondre à vos visiteurs — dans leur langue, jour et nuit. Chaque demande qu'il prend arrive sur votre téléphone.`
                      : `One click adds the assistant we built for you to the pages of ${client!.label}, and it starts answering your visitors — in their language, day and night. Every enquiry it takes reaches your phone.`}
                  </p>
                  <p className="text-[#52525B] leading-relaxed mb-6">
                    {fr
                      ? `Au bout de ${TRIAL_DAYS} jours il se retire de lui-même. Rien à faire, rien à payer — sauf si vous le gardez (${price.monthlyUsd} $/mois, résiliable à tout moment).`
                      : `After ${TRIAL_DAYS} days it steps back on its own. Nothing to do, nothing to pay — unless you keep it ($${price.monthlyUsd}/month, cancel anytime).`}
                  </p>
                  <StartTrialButton token={token} lang={ctx.lang} siteLabel={client!.label} />
                  <p className="mt-6 text-[13px] text-[#8A8A80]">
                    {fr ? "Vous voulez d'abord lui parler ? " : "Want to talk to it first? "}
                    <a href={`/hosting/assistant/try?site=${encodeURIComponent(ref)}${fr ? "&lang=fr" : ""}`} target="_blank" rel="noreferrer" className="font-bold text-[#36671E] hover:underline">
                      {fr ? "L'essayer ici →" : "Try it here →"}
                    </a>
                  </p>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </main>
  );
}
