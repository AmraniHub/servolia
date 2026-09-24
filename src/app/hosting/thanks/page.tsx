import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { setupLinkForSession, assistantLinkForSession } from "@/lib/upgrade";
import { resolveHostingPlan } from "@/lib/hosting";

export const metadata: Metadata = {
  title: "Thank you",
  robots: { index: false, follow: false },
};

/**
 * Shared by every client-services payment: hosting, the AI assistant, and a
 * one-off arrears charge.
 *
 * IT USED TO SAY ONE THING TO ALL THREE — "Your hosting is active… your site
 * keeps running exactly as it is." Someone who had just paid $12 to switch
 * their AI assistant back on was told about their hosting, and someone
 * clearing an old balance was told the same. That is the confirmation for a
 * different purchase, arriving at the exact moment a buyer is deciding whether
 * the payment worked — which is when they email to ask.
 *
 * `product` is display only. It picks wording and nothing else; it never
 * decides an amount, so a hand-edited URL can mislabel a page and do no harm.
 *
 * THE ASSISTANT HAS TWO TRUTHS. On a site we host it is being installed by
 * the webhook as this page renders (`hosted=1`), and the page says so. On a
 * site we do not host nothing can appear until the buyer adds one line and
 * describes their business (`brief=1`) — and the page used to tell that
 * buyer "nothing to install", which was the opposite of the truth.
 */
interface Copy {
  title: string;
  body: string;
  /** Used instead, when this payment brought a suspended service back. */
  restoredTitle?: string;
  restoredBody?: string;
}

const COPY_FR: Record<string, Copy> = {
  hosting: {
    title: "Votre hébergement est actif",
    body:
      "Votre site continue de fonctionner exactement comme avant — même adresse, mêmes formulaires, rien à changer.",
    restoredTitle: "Votre site est de nouveau en ligne",
    restoredBody:
      "L'hébergement est réactivé et votre site est de nouveau servi normalement. Cela se fait automatiquement, vous n'avez rien à faire.",
  },
  chatbot: {
    title: "Votre assistant IA est actif",
    body:
      "Il est en train d'être ajouté à votre site — comptez une ou deux minutes le temps que les pages se mettent à jour. Ensuite, il répond à vos visiteurs jour et nuit, dans leur langue. Rien à installer.",
    restoredTitle: "Votre assistant IA est de nouveau actif",
    restoredBody:
      "Il a été réactivé et répond de nouveau à vos clients sur votre site. Cela se fait automatiquement, vous n'avez rien à faire.",
  },
  arrears: {
    title: "C'est réglé",
    body:
      "Votre solde est à jour et il ne reste rien à payer. Il s'agissait d'un paiement unique — il ne se répétera pas.",
  },
  seo_multilingual: {
    title: "Paiement reçu",
    body:
      "Un paiement unique — rien ne se renouvelle. Nous déclarons vos langues (hreflang), écrivons un plan de site par langue et les données structurées, et vous confirmons par email quand c'est en place — sous cinq jours ouvrés. Rien à faire de votre côté d'ici là.",
  },
};

const FALLBACK_FR: Copy = {
  title: "Tout est en ordre",
  body: "Votre paiement a été validé et votre service est actif. Rien d'autre à faire.",
};

const COPY: Record<string, Copy> = {
  hosting: {
    title: "Your hosting is active",
    body:
      "Your site keeps running exactly as it is — same address, same forms, nothing to switch over.",
    restoredTitle: "Your site is back online",
    restoredBody:
      "Hosting is active again and your site is being served as normal. That happens automatically, so there is nothing for you to do.",
  },
  chatbot: {
    title: "Your assistant is live",
    body:
      "It is being added to your site now — allow a minute or two for the pages to update. From then on it answers your visitors day and night, in their own language. Nothing to install.",
    restoredTitle: "Your assistant is back on",
    restoredBody:
      "It has been switched back on and is answering customers on your site again. That happens automatically, so there is nothing for you to do.",
  },
  arrears: {
    title: "That's settled",
    body:
      "Your balance is clear and nothing is outstanding. This was a one-off charge — it will not repeat.",
  },
  /* A ONE-OFF SERVICE. It used to fall through to FALLBACK — "your service is
     active, nothing else to do" — and then the footer line promised a renewal
     date for a payment that never renews. The body repeats what
     oneOffServicePaidEmail promises, word for word in substance, so the page
     and the inbox tell the buyer the same thing. */
  seo_multilingual: {
    title: "Payment received",
    body:
      "A single payment — nothing renews. We declare your languages (hreflang), write a sitemap per language and the structured data, and email you when it is in place — within five working days. Nothing for you to do until then.",
  },
};

/* A brand-new client is told the opposite of an existing one. "Nothing to
   switch over" is true for a site we already run and a plain falsehood for a
   site that is still on somebody else's server -- and it is the first thing
   they read after paying. */
const SETUP_EN = {
  title: "Payment received",
  body:
    "One short step left: tell us where your site and domain live today, and we will take it from there. It takes about a minute.",
  cta: "Tell us where your site is",
};
const SETUP_FR = {
  title: "Paiement reçu",
  body:
    "Il reste une étape courte : indiquez-nous où se trouvent votre site et votre domaine aujourd'hui, et nous prenons le relais. Cela prend une minute.",
  cta: "Indiquer où se trouve mon site",
};

/* The assistant on a site we do not host: two things only the buyer can do. */
const BRIEF_EN = {
  title: "Payment received",
  body:
    "Two short steps and your assistant is answering: add one line to your site (it is in your confirmation email, ready to copy), and tell the assistant about your business so it answers correctly.",
  cta: "Describe my business",
};
const BRIEF_FR = {
  title: "Paiement reçu",
  body:
    "Deux étapes courtes et votre assistant répond : ajoutez une ligne à votre site (elle est dans votre email de confirmation, prête à copier), et décrivez-lui votre activité pour qu'il réponde juste.",
  cta: "Décrire mon activité",
};

const FALLBACK: Copy = {
  title: "You're all set",
  body: "Your payment went through and your service is active. Nothing else to do.",
};

export default async function HostingThanks({
  searchParams,
}: {
  searchParams: Promise<{
    product?: string; restored?: string; lang?: string;
    setup?: string; brief?: string; hosted?: string; session_id?: string; domain?: string;
  }>;
}) {
  const {
    product = "", restored = "", lang = "", setup = "", brief = "",
    session_id: sessionId = "", domain = "",
  } = await searchParams;
  const fr = lang === "fr";
  /* A domain bought with the plan is being registered by the webhook as this
     page renders. Said here so the buyer does not go looking for it. */
  const domainNote = domain === "1"
    ? (fr
        ? " Votre domaine est en cours d'enregistrement — vous le retrouverez dans l'email de confirmation."
        : " Your domain is being registered — you will find it in the confirmation email.")
    : "";

  /* A first purchase and a reinstatement need different words, and the
     difference is within a product rather than between two. Telling a
     first-time buyer their assistant is "back on" invents a suspension that
     never happened; telling a reinstated client it is "now live" ignores the
     week it was off. Falls back to the plain wording when a product has no
     restored variant. */
  /* Only the server knows whether this buyer already had a site with us, so
     the checkout flags it rather than the page guessing. */
  /* A one-off has no subscription, so setupLinkForSession can never mint its
     link: a stale or hand-built `setup=1` on one would read "one short step
     left" above no button at all. One-off purchases never take the step. */
  const isOneOff = Boolean(resolveHostingPlan(product)?.oneOffUsd) || product === "arrears";
  const isSetup = setup === "1" && !isOneOff;
  const isBrief = brief === "1";
  const setupUrl = isSetup && sessionId ? await setupLinkForSession(sessionId) : null;
  const briefUrl = isBrief && sessionId ? await assistantLinkForSession(sessionId) : null;
  const stepCopy = isBrief ? (fr ? BRIEF_FR : BRIEF_EN) : (fr ? SETUP_FR : SETUP_EN);
  const stepUrl = isBrief ? briefUrl : setupUrl;
  const isStep = isSetup || isBrief;
  /* The link could not be minted here (Stripe slow, session unreadable). The
     webhook mints the same link into the confirmation email, so point there
     rather than describe a step with nothing to click. */
  const noLinkNote = fr
    ? " Le lien pour le faire est dans votre email de confirmation."
    : " The link to do it is in your confirmation email.";

  const entry = (fr ? COPY_FR : COPY)[product];
  const isRestore = restored === "1";
  const copy: Copy = entry
    ? {
        title: (isRestore && entry.restoredTitle) || entry.title,
        body: (isRestore && entry.restoredBody) || entry.body,
      }
    : (fr ? FALLBACK_FR : FALLBACK);

  return (
    <main className="min-h-screen bg-[#FAFAF7] flex flex-col">
      <header className="px-5 py-6 border-b border-[#E8E6E0] bg-white">
        <div className="max-w-md mx-auto">
          <Link href="/" className="inline-flex items-center">
            <span className="text-xl font-black tracking-tight text-[#18181B]">
              Serv<span className="gradient-text">olia</span>
            </span>
          </Link>
        </div>
      </header>

      <div className="flex-1 px-5 py-20">
        <div className="max-w-md mx-auto text-center">
          <CheckCircle2 className="w-14 h-14 text-[#16A34A] mx-auto mb-5" />
          <h1 className="text-2xl font-black text-[#18181B] mb-3">
            {isStep ? stepCopy.title : copy.title}
          </h1>
          <p className="text-[#52525B] leading-relaxed mb-6">
            {(isStep ? stepCopy.body : copy.body) + domainNote + (isStep && !stepUrl ? noLinkNote : "")}
          </p>
          {isStep && stepUrl ? (
            <a
              href={stepUrl}
              className="inline-flex items-center justify-center h-12 px-7 mb-6 rounded-xl bg-gradient-to-r from-[#36671E] to-[#295115] text-[#FAFAF7] font-bold hover:opacity-90 transition"
            >
              {stepCopy.cta}
            </a>
          ) : null}

          {/* This promise is now kept by our own webhook rather than by a
              Stripe dashboard toggle nobody can see — see
              clientServicePaidEmail in src/lib/email.ts. */}
          <p className="text-sm text-[#71717A] leading-relaxed mb-8">
            {isOneOff
              ? (fr
                  ? "Une confirmation arrive dans votre boîte mail, avec le montant payé. Stripe envoie un reçu séparé pour vos archives."
                  : "A confirmation is on its way to your inbox, with what you paid. Stripe sends a separate receipt for your records.")
              : fr
                ? "Une confirmation arrive dans votre boîte mail, avec le montant payé et la date de renouvellement. Stripe envoie un reçu séparé pour vos archives."
                : "A confirmation is on its way to your inbox, with what you paid and when it renews. Stripe sends a separate receipt for your records."}
          </p>

          <Link
            href="/"
            className="inline-flex items-center justify-center h-11 px-6 rounded-xl bg-[#18181B] text-white font-bold hover:bg-[#27272A]"
          >
            {fr ? "Retour sur Servolia" : "Back to Servolia"}
          </Link>
        </div>
      </div>

      <footer className="px-5 py-8 border-t border-[#E8E6E0] bg-white">
        <div className="max-w-md mx-auto text-center">
          <p className="text-xs text-[#8A8A80]">
            {fr ? "Facturé par " : "Billed by "}
            <span className="font-bold text-[#52525B]">Servolia</span>
            {fr ? " · Paiement traité par Stripe" : " · Payments processed by Stripe"}
          </p>
        </div>
      </footer>
    </main>
  );
}
