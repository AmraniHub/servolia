import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import {
  readReceptionistToken, loadReceptionist, receptionistPhase, receptionistSnippet, safetyLine, takeoverOpen, RECEPTIONIST_TRIAL_DAYS,
} from "@/lib/receptionistTrial";
import { PLANS, PLAN_ORDER, POPULAR_PLAN_KEY, SETUP_PLAN } from "@/lib/pricing";
import PageLang from "@/components/PageLang";
import { DetailsForm, SnippetBox, InstallCheck, KeepPlans } from "@/components/ReceptionistTrial";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Votre réceptionniste",
  robots: { index: false, follow: false },
};

/**
 * HER PAGE — reached only from the link mailed to the address in the token
 * (src/lib/receptionistTrial.ts). Opening it changes nothing: email scanners
 * open links, and a trial must start with her click, not theirs.
 *
 * One page for the whole life of the trial, so every email can carry the
 * same kind of link:
 *   draft   → what it read on her site, the few details it cannot read, and
 *             the click that starts seven days;
 *   running → the line to paste, whether we can see it yet, what it says,
 *             and the plans to keep it;
 *   ended   → the plans;
 *   paid    → it is hers; where her client space is.
 */
export default async function ConfirmerPage({ searchParams }: { searchParams: Promise<{ t?: string; paid?: string }> }) {
  const { t: token = "", paid } = await searchParams;
  const claim = await readReceptionistToken(token);
  const row = claim ? await loadReceptionist(claim.slug) : null;
  const config = row?.config;
  const r = config?.receptionist;
  const fr = (claim?.lang ?? "fr") === "fr";
  const lang = fr ? "fr" : "en";
  const mine = Boolean(r && claim && r.email?.toLowerCase() === claim.email.toLowerCase());
  /* Someone else started this domain's trial but never put the line on the
     site within 48 hours: the address that confirmed now may take it over,
     and sees the start form as if it were fresh (takeoverOpen). */
  const takeover = Boolean(claim && !mine && takeoverOpen(r));
  const owner = Boolean(r && claim && (!r.email || mine || takeover));
  const phase = takeover ? "draft" : receptionistPhase(r);
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("x-forwarded-host") ?? h.get("host") ?? "servolia.com"}`;
  const date = (iso?: string) => (iso ? new Date(iso).toLocaleDateString(fr ? "fr-FR" : "en-GB", { day: "numeric", month: "long" }) : "");

  const plans = PLAN_ORDER.map((k) => PLANS[k]).map((p) => ({
    key: p.key, name: fr ? p.nameFr : p.name, monthlyEur: p.monthlyEur, annualEur: p.annualEur,
    conversations: p.conversations, audience: fr ? p.audienceFr : p.audience, popular: p.key === POPULAR_PLAN_KEY,
  }));
  const own = (config?.ownerInstructions ?? "").replace(safetyLine(r?.lang ?? "fr"), "").trim();
  const init = { phone: config?.phone, hours: config?.hours, address: config?.address, bookingUrl: config?.bookingUrl, instructions: own };

  const card = "rounded-2xl bg-white border border-[#E8E6E0] p-5 sm:p-6";
  const h2 = "text-lg font-black text-[#18181B] mb-3";

  return (
    <main className="min-h-screen bg-[#FAFAF7] flex flex-col" lang={lang}>
      <header className="px-5 py-5 border-b border-[#E8E6E0] bg-white">
        <div className="max-w-2xl mx-auto">
          <Link href="/fr" className="text-xl font-black tracking-tight text-[#18181B]">Serv<span className="gradient-text">olia</span></Link>
        </div>
      </header>

      <div className="flex-1 px-5 py-12">
        <div className="max-w-2xl mx-auto flex flex-col gap-6">
          {!claim || !row || !config || !r ? (
            <div className={card} data-testid="essai-invalid">
              <h1 className="text-xl font-black text-[#18181B] mb-2">{fr ? "Ce lien n'est plus valide" : "This link is no longer valid"}</h1>
              <p className="text-[14.5px] text-[#52525B]">
                {fr ? "Il a expiré, ou il ne correspond à aucune réceptionniste. " : "It has expired, or it matches no receptionist. "}
                <Link href="/fr/essai" className="font-bold text-[#36671E] hover:underline">{fr ? "Recommencer →" : "Start again →"}</Link>
              </p>
            </div>
          ) : !owner ? (
            <div className={card} data-testid="essai-taken">
              <h1 className="text-xl font-black text-[#18181B] mb-2">{config.businessName}</h1>
              <p className="text-[14.5px] text-[#52525B]">
                {fr
                  ? `L'essai de ${r.domain} a déjà été lancé depuis une autre adresse. Si c'est une erreur, écrivez à hello@servolia.com.`
                  : `The trial for ${r.domain} was already started from another address. If that is a mistake, write to hello@servolia.com.`}
              </p>
            </div>
          ) : (
            <>
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#36671E] mb-2" data-testid="essai-phase">
                  {phase === "draft" ? (fr ? "Adresse confirmée" : "Address confirmed")
                    : phase === "running" ? (fr ? `Essai en cours — jusqu'au ${date(r.until)}` : `Trial running — until ${date(r.until)}`)
                    : phase === "ended" ? (fr ? "Essai terminé" : "Trial over")
                    : (fr ? "Elle est à vous" : "It is yours")}
                </p>
                <h1 className="text-3xl font-black text-[#161A15] tracking-tight">{config.businessName}</h1>
                <p className="mt-1 text-[14px] text-[#71717A]">{r.domain} · {claim.email}</p>
              </div>

              {phase === "paid" || paid === "1" ? (
                <div className={`${card} border-[#36671E]/30`} data-testid="essai-paid">
                  <h2 className={h2}>{fr ? "Merci — elle reste en ligne." : "Thank you — it stays live."}</h2>
                  <p className="text-[14.5px] text-[#3F3F46] leading-relaxed">
                    {phase === "paid"
                      ? (fr
                          ? "Votre formule est active. Vos demandes, votre compteur de conversations et vos factures sont dans votre espace client — connexion par lien envoyé à votre email, sans mot de passe."
                          : "Your plan is active. Your enquiries, conversation meter and invoices are in your client space — sign in with a link sent to your email, no password.")
                      : (fr
                          ? "Paiement reçu — la confirmation arrive par email dans une minute, avec l'accès à votre espace client."
                          : "Payment received — the confirmation arrives by email within a minute, with access to your client space.")}
                  </p>
                  <Link href="/portal" className="mt-4 inline-flex items-center h-11 px-5 rounded-xl bg-[#18181B] text-white text-[14px] font-bold">
                    {fr ? "Mon espace client →" : "My client space →"}
                  </Link>
                </div>
              ) : null}

              {phase === "draft" ? (
                <div className={card} data-testid="essai-start">
                  <h2 className={h2}>{fr ? "Deux minutes pour la rendre juste" : "Two minutes to make it right"}</h2>
                  <p className="text-[14px] text-[#52525B] mb-5">
                    {fr
                      ? `Elle connaît déjà votre nom${config.phone ? ", votre téléphone" : ""}${config.services.length ? " et les soins de votre site" : ""}. Complétez ce qu'une page d'accueil ne dit pas — ou laissez vide, elle proposera au patient d'être rappelé.`
                      : `It already knows your name${config.phone ? ", your phone" : ""}${config.services.length ? " and the treatments on your site" : ""}. Add what a homepage does not say — or leave it blank, and it will offer the patient a call-back.`}
                  </p>
                  <DetailsForm token={token} lang={lang} init={init} mode="start" />
                  <p className="mt-4 text-[12.5px] text-[#71717A]">
                    {fr
                      ? `${RECEPTIONIST_TRIAL_DAYS} jours gratuits, sans carte, à partir de maintenant — et si vous la collez pendant l'essai, ils repartent du jour où elle apparaît sur votre site.`
                      : `${RECEPTIONIST_TRIAL_DAYS} free days, no card, from now — and if you paste it during the trial, they restart from the day it appears on your site.`}
                  </p>
                </div>
              ) : null}

              {phase === "running" ? (
                <>
                  <div className={card} data-testid="essai-install">
                    <h2 className={h2}>
                      {r.installedAt
                        ? (fr ? `Elle est sur votre site depuis le ${date(r.installedAt)} ✓` : `On your site since ${date(r.installedAt)} ✓`)
                        : (fr ? "Il reste une ligne à coller" : "One line left to paste")}
                    </h2>
                    {!r.installedAt ? (
                      <p className="text-[14px] text-[#52525B] mb-4">
                        {fr
                          ? "Collez-la juste avant </body> de votre site — ou envoyez-la à la personne qui s'en occupe. Vos 7 jours repartent du jour où nous la voyons."
                          : "Paste it just before your site's </body> — or send it to whoever runs your site. Your 7 days restart from the day we see it."}
                      </p>
                    ) : null}
                    <SnippetBox snippet={receptionistSnippet(row.slug)} lang={lang} />
                    {!r.installedAt ? (
                      <>
                        <details className="mt-4 text-[13.5px] text-[#3F3F46]">
                          <summary className="cursor-pointer font-bold text-[#18181B]">{fr ? "Où la coller, selon votre site" : "Where to paste it, by platform"}</summary>
                          <ul className="mt-2 list-disc pl-5 space-y-1">
                            <li><strong>WordPress</strong> — {fr ? "extension « WPCode » (ou « Insert Headers and Footers ») → Pied de page." : "“WPCode” plugin (or “Insert Headers and Footers”) → Footer."}</li>
                            <li><strong>Wix</strong> — {fr ? "Paramètres → Code personnalisé → Ajouter → « Body – fin », toutes les pages." : "Settings → Custom code → Add → “Body – end”, all pages."}</li>
                            <li><strong>Squarespace</strong> — {fr ? "Paramètres → Avancé → Injection de code → Pied de page." : "Settings → Advanced → Code injection → Footer."}</li>
                            <li><strong>Webflow</strong> — {fr ? "Paramètres du projet → Code personnalisé → Code du pied de page, puis publier." : "Project settings → Custom code → Footer code, then publish."}</li>
                            <li>{fr ? "Autre, ou une agence s'en occupe : transférez-leur l'email « Votre essai a commencé »." : "Anything else, or an agency runs it: forward them the “Your trial has started” email."}</li>
                          </ul>
                        </details>
                        <InstallCheck token={token} lang={lang} domain={r.domain} />
                      </>
                    ) : (
                      <p className="mt-3 text-[13.5px] text-[#52525B]">
                        {fr
                          ? "Elle est aussi en bas de cette page. Demandez-lui un rendez-vous en laissant un nom et un téléphone, comme un patient : vous recevrez l'email de demande — c'est le meilleur test."
                          : "It is also at the bottom of this page. Ask it for an appointment and leave a name and phone, as a patient would: you will get the request email — the best test there is."}
                      </p>
                    )}
                  </div>

                  <details className={card} data-testid="essai-edit">
                    <summary className="cursor-pointer text-lg font-black text-[#18181B]">{fr ? "Ce qu'elle dit" : "What it says"}</summary>
                    <div className="mt-4"><DetailsForm token={token} lang={lang} init={init} mode="edit" /></div>
                  </details>
                </>
              ) : null}

              {(phase === "running" || phase === "ended") && paid !== "1" ? (
                <div className={card} id="garder">
                  <h2 className={h2}>{fr ? "La garder" : "Keep it"}</h2>
                  <p className="text-[14px] text-[#52525B] mb-4">
                    {phase === "ended"
                      ? (fr ? "Elle s'est retirée de votre site. Dans les minutes qui suivent le paiement elle revient, sans rien toucher : la ligne est déjà là." : "It has stepped back from your site. Within minutes of payment it returns, with nothing to change: the line is already there.")
                      : (fr ? "Choisissez selon le nombre de conversations par mois. Elle reste en ligne sans interruption." : "Choose by conversations a month. It stays live without a break.")}
                  </p>
                  <KeepPlans token={token} lang={lang} plans={plans} setupEur={SETUP_PLAN.totalEur} />
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>

      {claim && row && owner && phase !== "paid" ? (
        <>
          <PageLang lang={lang} />
          <script
            defer
            src="/assistant.js"
            data-site={row.slug}
            data-origin={origin}
            data-position="right"
            data-preview={phase === "running" ? undefined : "1"}
          />
        </>
      ) : null}
    </main>
  );
}
