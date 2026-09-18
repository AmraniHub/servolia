import type { Metadata } from "next";
import Link from "next/link";
import { Check, ExternalLink, FileText, ArrowUpRight, PencilLine } from "lucide-react";
import { editableSite } from "@/lib/siteEditor";
import { listSiteFiles, humanSize, siteFolders as listSiteFolders } from "@/lib/clientFiles";
import { mailSettingsFor } from "@/lib/mailSettings";
import EditorPassword from "@/components/client/EditorPassword";
import RequestCopy, { type CopyView } from "@/components/client/RequestCopy";
import DomainSearch from "@/components/client/DomainSearch";
import DashNav, { dashPageFrom, dashLabel } from "@/components/client/DashNav";
import StatTiles from "@/components/client/StatTiles";
import ServiceCards, { type ServiceCard } from "@/components/client/ServiceCards";
import SupportBox from "@/components/client/SupportBox";
import Recommendations from "@/components/client/Recommendations";
import { recommendationsFor, recommendationCopy } from "@/lib/recommendations";
import { valueFor, featureIntro } from "@/lib/serviceValue";
import NoticeBell from "@/components/client/NoticeBell";
import { noticesFor } from "@/lib/clientNotices";
import FileManager from "@/components/client/FileManager";
import { acceptAttribute, acceptedList } from "@/lib/siteUpload";
import RenewalBar from "@/components/client/RenewalBar";
import ClientSignIn from "@/components/client/ClientSignIn";
import ClientSignOut from "@/components/client/ClientSignOut";
import { clientSession } from "@/lib/clientAreaAuth";
import { readCopyRequest, copyState } from "@/lib/clientCopy";
import { readExtraDomains } from "@/lib/extraDomains";
import { siteHealth } from "@/lib/siteHealth";
import { readUpgradeToken, subscriptionContext, mintUpgradeToken } from "@/lib/upgrade";
import { productCopy, CLIENT_PRODUCTS, HOSTING_TIERS, usd } from "@/lib/hosting";
import { supabaseAdmin } from "@/lib/supabase";
import { readDomainRecord, type DomainRecord } from "@/lib/domainSales";
import { clientRefFor } from "@/lib/clientRefs";
import { hasAssistantSubscription } from "@/lib/assistantAccess";
import { ASSISTANT_SITES } from "@/lib/assistantSites";
import { assistantLinkFor } from "@/lib/upgrade";

export const metadata: Metadata = {
  title: "Your service",
  robots: { index: false, follow: false },
};

/**
 * THE CLIENT'S OWN PAGE, IN OUR NAME.
 *
 * Stripe's billing portal answers "what am I paying and how do I stop". That
 * is a billing question. A client deciding whether they are dealing with a
 * real company is asking a different one — what am I getting, from whom, and
 * until when — and being handed straight to a Stripe screen answers it with
 * somebody else's brand.
 *
 * So this is the front door and Stripe is a room inside it.
 *
 * Every figure comes from STRIPE, live, not from our database and not from
 * arithmetic. The renewal date in particular is read off the subscription item
 * rather than computed from the purchase date, because a client who has
 * changed plan, been credited, or had a failed payment retried has a real date
 * that our maths would not reproduce. On the one page whose job is to be
 * trusted, a plausible-looking wrong date costs more than no date.
 *
 * Reached by the same signed link as the rest: no password, no account to
 * create, delivered only to the address on the subscription.
 */

const T = {
  en: {
    heading: "Your service",
    forLabel: "Site",
    statusActive: "Active",
    statusPastDue: "Payment due",
    statusEnding: "Ends at the end of this period",
    statusOther: "Inactive",
    plan: "Plan",
    renews: "Renews",
    renewsNever: "—",
    endsOn: "Runs until",
    included: "What this covers",
    manage: "Manage billing & invoices",
    manageNote: "Change your card, download invoices, or cancel — no need to ask us.",
    terms: "What you get, in full",
    upgrade: "Pay yearly and save",
    provider: "Provided by Servolia LLC · Wyoming, USA",
    help: "Questions? Reply to any email from us.",
    domain: "Your domain",
    domainRegistered: "Registered by Servolia for you",
    domainRenews: "renews with your plan",
    domainRenewsInvoice: (d: string) => `renewed each year on your invoice — next on ${d}`,
    domainPending: "Being registered — we will confirm by email.",
    domainYours: "It is yours: on request we transfer it to any registrar account you name.",
    editorTitle: "Edit your website",
    editorBody: "Change the words on your pages yourself, whenever you like. Your design stays exactly as it is, and the site updates in about a minute.",
    editorNote: "Opens on your own website. Use the password below — it is not the same as any other password you have.",
    filesTitle: "Your website's files",
    filesBody: (n: number, size: string) =>
      `${n} ${n === 1 ? "file" : "files"}, ${size} in all. This is what your website is made of, and it is yours — ask any time and we will send you a copy.`,
    filesUnavailable: "We cannot list your files at this moment. Ask us and we will send them.",
    daysLeft: "{n} days left on this period.",
    secWebsite: "Your website",
    secDomain: "Your domain",
    secServices: "Your plan and services",
    secAccount: "Your account",
    secFiles: "Your files",
    secHelp: "Help",
    tileSite: "Your site",
    siteUp: "Online",
    siteDown: "Not responding",
    siteUnknown: "Checking",
    tileChanged: "Last change",
    changesIn30: (n: number) => `${n} in the last 30 days`,
    boughtTitle: (d: string) => `${d} is yours.`,
    boughtBody: "We are pointing it at your website now. It can take a few minutes to start working, and we will email you when it is live.",
    alsoYours: "Also yours",
    renewsOn: (d: string) => `renews ${d}`,
    domainProblem: "we are sorting this one out",
    copyTitle: "Take a copy",
    copyBody: "Your website is yours. Ask for a copy of every file and we will confirm, then a download appears here.",
    tileStatus: "Status",
    tilePlan: "Plan",
    tileFiles: "Files",
    mailTitle: "Your email on your phone",
    mailIntro: (addr: string) => `Add ${addr} to the Mail app on your phone with exactly these settings.`,
    mailWebmail: "Or read it in a browser",
    mailUser: "Username",
    mailUserValue: "your full email address",
    mailIn: "Incoming (IMAP)",
    mailOut: "Outgoing (SMTP)",
    mailWhy:
      "These must match exactly. Your mailbox lives in one specific data centre, and a phone pointed at the wrong one reaches a working server that does not know your account — so it reports a wrong password when the password is fine.",
    mailApp:
      "If you have two-step login turned on, your phone needs an app password, not your normal one. Ask us and we will make you one.",
    problem: {
      title: "This link has expired",
      body: "Service links do not last forever. Reply to any email from us and we will send a fresh one.",
    },
  },
  fr: {
    heading: "Votre service",
    forLabel: "Site",
    statusActive: "Actif",
    statusPastDue: "Paiement en attente",
    statusEnding: "Se termine à la fin de la période",
    statusOther: "Inactif",
    plan: "Formule",
    renews: "Renouvellement",
    renewsNever: "—",
    endsOn: "Actif jusqu'au",
    included: "Ce que cela comprend",
    manage: "Facturation et factures",
    manageNote: "Changez de carte, téléchargez vos factures ou résiliez — sans nous contacter.",
    terms: "Le détail de la prestation",
    upgrade: "Passer à l'année et économiser",
    provider: "Fourni par Servolia LLC · Wyoming, USA",
    help: "Une question ? Répondez à n'importe lequel de nos emails.",
    domain: "Votre domaine",
    domainRegistered: "Enregistré par Servolia pour vous",
    domainRenews: "renouvelé avec votre formule",
    domainRenewsInvoice: (d: string) => `renouvelé chaque année sur votre facture — prochaine fois le ${d}`,
    domainPending: "En cours d'enregistrement — nous vous confirmons par email.",
    domainYours: "Il vous appartient : sur simple demande, nous le transférons vers le compte registrar de votre choix.",
    editorTitle: "Modifier votre site",
    editorBody: "Changez vous-même les textes de vos pages, quand vous voulez. Votre design ne bouge pas, et le site se met à jour en une minute environ.",
    editorNote: "S'ouvre sur votre propre site. Utilisez le mot de passe ci-dessous — il n'est identique à aucun autre.",
    filesTitle: "Les fichiers de votre site",
    filesBody: (n: number, size: string) =>
      `${n} ${n === 1 ? "fichier" : "fichiers"}, ${size} au total. Voilà de quoi votre site est fait, et il vous appartient — demandez-nous une copie quand vous voulez.`,
    filesUnavailable: "Nous ne pouvons pas lister vos fichiers pour l'instant. Demandez-nous et nous vous les envoyons.",
    daysLeft: "Il reste {n} jours sur cette période.",
    secWebsite: "Votre site",
    secDomain: "Votre domaine",
    secServices: "Votre formule et vos services",
    secAccount: "Votre compte",
    secFiles: "Vos fichiers",
    secHelp: "Aide",
    tileSite: "Votre site",
    siteUp: "En ligne",
    siteDown: "Ne répond pas",
    siteUnknown: "Vérification",
    tileChanged: "Dernier changement",
    changesIn30: (n: number) => `${n} sur les 30 derniers jours`,
    boughtTitle: (d: string) => `${d} est à vous.`,
    boughtBody: "Nous le dirigeons vers votre site. Cela peut prendre quelques minutes, et nous vous écrivons dès qu'il est actif.",
    alsoYours: "Également à vous",
    renewsOn: (d: string) => `renouvellement le ${d}`,
    domainProblem: "nous nous en occupons",
    copyTitle: "Prendre une copie",
    copyBody: "Votre site vous appartient. Demandez une copie de tous les fichiers ; nous confirmons et le téléchargement apparaît ici.",
    tileStatus: "État",
    tilePlan: "Formule",
    tileFiles: "Fichiers",
    mailTitle: "Votre email sur votre téléphone",
    mailIntro: (addr: string) => `Ajoutez ${addr} à l'application Mail de votre téléphone avec exactement ces réglages.`,
    mailWebmail: "Ou lisez-le dans un navigateur",
    mailUser: "Identifiant",
    mailUserValue: "votre adresse email complète",
    mailIn: "Réception (IMAP)",
    mailOut: "Envoi (SMTP)",
    mailWhy:
      "Ces réglages doivent être exacts. Votre boîte se trouve dans un centre de données précis, et un téléphone dirigé vers le mauvais atteint un serveur qui fonctionne mais ne connaît pas votre compte — il annonce alors un mot de passe incorrect alors qu'il est bon.",
    mailApp:
      "Si la connexion en deux étapes est activée, votre téléphone a besoin d'un mot de passe d'application, pas de votre mot de passe habituel. Demandez-nous et nous vous en créons un.",
    problem: {
      title: "Ce lien a expiré",
      body: "Les liens de service ne durent pas indéfiniment. Répondez à l'un de nos emails et nous vous en envoyons un nouveau.",
    },
  },
};

/**
 * A labelled group of cards.
 *
 * The page was eight cards of identical weight in one column, so everything
 * looked equally important and nothing was findable — a client hunting for
 * their renewal date read the same as one hunting for their password. Three
 * groups and a heading each is the whole fix.
 */
function Section({ title, children, when = true }: { title: string; children: React.ReactNode; when?: boolean }) {
  if (!when) return null;
  return (
    <section className="mb-9">
      {/* Named for screen readers, not drawn: the nav and the page title
          already say where you are, and a third copy of the same word is
          noise. */}
      <h2 className="sr-only">{title}</h2>
      <div className="space-y-5">{children}</div>
    </section>
  );
}

/**
 * How much of the paid period is left, as a bar.
 *
 * A date alone makes a person do arithmetic to answer the question they
 * actually have, which is "am I about to be charged". The bar answers it at a
 * glance and the date stays for the ones who want it.
 *
 * Only drawn when the whole period is known. A half-filled bar computed from a
 * guess would be a confident picture of nothing.
 */
/**
 * The panel around every page.
 *
 * A header that names who this is and what site it is about, a spine of
 * sections down the left, and the page itself. The client is always told
 * three things without looking for them: whose service this is, which site,
 * and whether it is up.
 */
function Shell({
  lang, children, nav, siteLabel, status, bell,
}: {
  lang: "en" | "fr";
  children: React.ReactNode;
  nav?: React.ReactNode;
  siteLabel?: string;
  status?: { label: string; tone: string };
  bell?: React.ReactNode;
}) {
  const t = T[lang];
  return (
    <main className="min-h-screen bg-[#FAFAF7] flex flex-col">
      <header className="px-5 py-4 border-b border-[#E8E6E0] bg-white/90 backdrop-blur sticky top-0 z-20">
        <div className="max-w-5xl mx-auto flex items-center gap-4">
          <Link href="/" className="inline-flex items-center shrink-0">
            <span className="text-xl font-black tracking-tight text-[#18181B]">
              Serv<span className="gradient-text">olia</span>
            </span>
          </Link>
          {siteLabel ? (
            <>
              <span className="h-5 w-px bg-[#E8E6E0] hidden sm:block" aria-hidden="true" />
              <span className="min-w-0 hidden sm:flex items-center gap-2">
                <span className="truncate text-[14px] font-bold text-[#3F3F46]">{siteLabel}</span>
                {status ? (
                  <span className={`shrink-0 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${status.tone}`}>
                    {status.label}
                  </span>
                ) : null}
              </span>
            </>
          ) : null}
          {bell ? <div className="ml-auto">{bell}</div> : null}
        </div>
      </header>
      <div className="flex-1 px-5 py-8">
        <div className={`mx-auto ${nav ? "max-w-5xl lg:flex lg:gap-10" : "max-w-lg"}`}>
          {nav}
          <div className="min-w-0 flex-1 mt-6 lg:mt-0">{children}</div>
        </div>
      </div>
      <footer className="px-5 py-8 border-t border-[#E8E6E0] bg-white">
        <div className="max-w-5xl mx-auto text-center">
          <p className="text-xs text-[#8A8A80]">{t.provider}</p>
        </div>
      </footer>
    </main>
  );
}

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string; demo?: string; lang?: string; page?: string; bought?: string }>;
}) {
  const { t: token = "", demo = "", lang: demoLang = "", page: wantPage = "", bought = "" } = await searchParams;
  const dashPage = dashPageFrom(wantPage);

  /* ?demo=1 — the page with INVENTED data, so it can be looked at before any
   * client exists and shown to a prospect without opening someone's account.
   *
   * Safe to leave reachable: it reads nothing. Every value below is written
   * here, no token is accepted, and no subscription is fetched — so there is
   * no real client whose details it could show by mistake. It is also banner-
   * marked and noindex, because a sample that can be mistaken for a live
   * account is worse than no sample.
   */
  const isDemo = demo === "1";
  // Resolved once, because two things hang off it: Stripe's view of the
  // subscription, and our own row (where a domain bought with the plan lives).
  /* Either credential opens this page. The emailed link is what every receipt
     and reminder already carries; the signed-in session is for the client who
     comes back four months later with no idea which email it was in. */
  const subId = isDemo ? null : (token ? await readUpgradeToken(token) : null) || (await clientSession());
  const ctx = isDemo
    ? {
        plan: CLIENT_PRODUCTS.hosting,
        lang: (demoLang === "fr" ? "fr" : "en") as "en" | "fr",
        ref: "goodscochina",
        siteLabel: "goodscochina.com",
        interval: "year" as const,
        status: "active",
        /* A FIXED date, not now-plus-a-year. Reading the clock during render
           is impure and the lint rule is right to refuse it; a sample also
           reads better when it does not quietly change every day. */
        renewsAt: "2027-09-09T00:00:00.000Z",
        cancelAtPeriodEnd: false,
        amountCents: CLIENT_PRODUCTS.hosting.annualUsd * 100,
      }
    : subId
      ? await subscriptionContext(subId)
      : null;

  /* The domain bought with the plan, if any. Read from our row rather than
     from Stripe: Stripe knows a line item was paid; only we know whether the
     registration went through and where it is attached. */
  const DEMO_DOMAIN: DomainRecord = { domain: "goodscochina-shop.com", status: "bought", retailUsd: 26, boughtAt: "2026-09-09" };
  let domainRec: DomainRecord | null = isDemo ? DEMO_DOMAIN : null;
  /* Where their request for a copy of the site stands. Read from the same row
     as the domain rather than with a second query — one read, two answers. */
  let copyView: CopyView = "none";
  /* The row's notes, kept so the notice list can read what has been
     dismissed without a second query. */
  let rowNotes: string | null = null;
  /* Domains bought from this panel after the plan. Their own records, so the
     one that came with the plan is untouched. */
  let extraDomains: { domain: string; nextChargeAt?: string; failed?: string }[] = [];
  if (!isDemo && subId) {
    const db = supabaseAdmin();
    const { data: row } = db
      ? await db.from("hosting_clients").select("notes").eq("subscription_id", subId).maybeSingle()
      : { data: null };
    rowNotes = (row as { notes?: string | null } | null)?.notes ?? null;
    domainRec = readDomainRecord(row?.notes);
    const state = copyState(readCopyRequest((row as { notes?: string | null } | null)?.notes));
    /* "Refused" and "expired" both show as nothing asked yet. A page that
       reports a refusal, with no reason and nobody to ask, is worse for the
       client than a button they can press again. */
    copyView = state === "ready" ? "ready" : state === "waiting" ? "waiting" : "none";
    extraDomains = readExtraDomains((row as { notes?: string | null } | null)?.notes);
  }

  /* No credential, or one that no longer works: offer the way in rather than
     the dead end. "This link has expired" was the whole page for a client who
     simply opened an old email — true, and no help at all. */
  if (!ctx) {
    return (
      <Shell lang="en">
        <ClientSignIn lang="en" hadToken={Boolean(token)} />
      </Shell>
    );
  }

  /* Every link on this page carries a signed token: the billing portal, the
     assistant pages, the upgrade page. A client who signed in with a password
     has no token, so one is minted here — otherwise those links would all
     lead to "this link has expired" for exactly the people who just proved
     who they are. */
  const linkToken = token || (subId ? await mintUpgradeToken(subId) : "");

  const t = T[ctx.lang];
  const fr = ctx.lang === "fr";
  const copy = productCopy(ctx.plan, ctx.lang);

  /* The page editor, for a client who has one mounted on their own domain.
     `adminUrl` is set only once their host is actually rewriting /admin, so
     this card cannot advertise a link that 404s. */
  const editor = editableSite(ctx.ref);
  /* Offered only where the client is the one who edits. Where we maintain the
     site, the editor exists and the panel stays quiet about it. */
  const editorUrl = editor && editor.showOnPanel !== false ? (editor.adminUrl ?? null) : null;

  /* Their own files, listed from the repository their host deploys. In the
     sample page this is invented, because a demo must never reach into a real
     client's repository to fill itself in. */
  const siteFiles = isDemo
    ? {
        unavailable: false,
        bytes: 372_000,
        files: [
          { name: "index.html", size: 353_810, kind: "page" as const },
          { name: "sourcing.html", size: 15_612, kind: "page" as const },
          { name: "contact.html", size: 4_493, kind: "page" as const },
          { name: "favicon.ico", size: 4_286, kind: "image" as const },
          { name: "css", size: null, kind: "folder" as const },
          { name: "img", size: null, kind: "folder" as const },
        ],
      }
    : await listSiteFiles(ctx.ref);
  /* Only fetched on the page that offers an upload: it is a second call to
     GitHub and every other page would pay for it without using it. */
  if (isDemo) extraDomains = [{ domain: "yiwu-goods.com", nextChargeAt: "2027-09-18" }];

  /* Measured, not asserted. Only on the page that shows it: a fetch of their
     site and a read of their repository is not worth doing on Billing. */
  const health = isDemo
    ? { up: true, status: 200, lastChange: "2026-09-18T04:00:00.000Z", recentChanges: 7 }
    : dashPage === "overview"
      ? await siteHealth(ctx.ref, ctx.siteLabel ? `https://${ctx.siteLabel.replace(/^https?:\/\//, "")}` : null)
      : { up: null, status: null, lastChange: null, recentChanges: 0 };

  const siteFolders = isDemo
    ? ["", "css", "img", "js"]
    : dashPage === "files"
      ? await listSiteFolders(ctx.ref)
      : [];

  /* Their mailbox settings, worked out from their own domain's MX record.
     Only for a client who HAS a mailbox on their domain — see the `mailbox`
     note in clientRefs: a client whose published address has no MX behind it
     must not be handed confident settings for a box that does not exist. */
  const mailbox = isDemo ? "info@goodscochina.com" : clientRefFor(ctx.ref)?.mailbox;
  const mail = mailbox ? await mailSettingsFor(mailbox.split("@")[1] ?? "") : null;

  /* Servolia's own recommendation, on the page the client owns. Hosting-tier
   * clients only, and only until the assistant is theirs — the same rule as
   * the /hosting?ref= page, kept by the same helper. */
  const recommendAssistant =
    !isDemo &&
    HOSTING_TIERS.includes(ctx.plan.key) &&
    Boolean(ctx.ref) &&
    !(await hasAssistantSubscription(clientRefFor(ctx.ref)?.email));
  /* Already built for them (a brief in code under their reference): the
     card then opens the showroom and the settings page, not just the price. */
  const builtAssistant = recommendAssistant && Boolean(ASSISTANT_SITES[ctx.ref.toLowerCase()]);
  const settingsUrl = builtAssistant && subId ? await assistantLinkFor(subId) : null;

  const money = (n: number) => (fr ? `${usd(n)} $` : `$${usd(n)}`);

  /* THE CATALOGUE, AS THIS CLIENT SEES IT.
   *
   * Built from CLIENT_PRODUCTS rather than written out here, so a price
   * changed in one place is changed on every client's panel — and so a new
   * service appears without anyone remembering this file exists.
   *
   * What they already pay for comes first and is marked. A client who cannot
   * see their own plan on the page listing what they could buy reads the whole
   * page as a sales pitch, and is right to. */
  /* Findings about THEIR site, each carrying the number that produced it.
     Only on the two pages that show them — every rule reads data already
     fetched for those pages, so it costs nothing extra. */
  const dashHref = (page: string) =>
    `/hosting/account?page=${page}${linkToken ? `&t=${encodeURIComponent(linkToken)}` : ""}`;
  const recs = dashPage === "overview" || dashPage === "services"
    ? recommendationsFor({
        ref: ctx.ref,
        lang: ctx.lang,
        files: siteFiles,
        health,
        hasAssistant: ctx.plan.key === "chatbot" || !recommendAssistant,
        linkFor: dashHref,
      })
    : [];
  const recCopy = recommendationCopy(ctx.lang);


  const serviceCards: ServiceCard[] = Object.values(CLIENT_PRODUCTS)
    .filter((prod) => !("retired" in prod && prod.retired))
    /* THEIR OWN TIER, AND THINGS THAT ADD TO IT — never the other tiers.
     *
     * A client who has already chosen a hosting plan does not want the other
     * two hosting plans on their own panel. It reads as a shop when they have
     * already bought, and a cheaper tier beside what they pay reads worse than
     * that. What belongs here is what they do NOT have and could add: the
     * assistant, multilingual search. */
    .filter((prod) => !HOSTING_TIERS.includes(prod.key) || prod.key === ctx.plan.key)
    .map((prod) => {
      const c = productCopy(prod, ctx.lang);
      const yearly = HOSTING_TIERS.includes(prod.key);
      const price = yearly
        ? `${money(prod.annualUsd)} / ${fr ? "an" : "year"}`
        : `${money(prod.monthlyUsd)} / ${fr ? "mois" : "month"}`;
      const owned = prod.key === ctx.plan.key;
      return {
        key: prod.key,
        name: c.heading,
        blurb: c.blurb,
        price,
        includes: c.includes,
        value: valueFor(prod.key, ctx.lang),
        bestFor: c.bestFor ?? null,
        owned,
        ready: !owned && prod.key === "chatbot" && builtAssistant,
        href: `/hosting?plan=${prod.key}${ctx.ref ? `&ref=${encodeURIComponent(ctx.ref)}` : ""}`,
      };
    })
    /* Theirs first, then the one already built for them, then the rest. */
    .sort((a, b) => Number(b.owned ?? false) - Number(a.owned ?? false) || Number(b.ready ?? false) - Number(a.ready ?? false));
  // Cents to dollars WITHOUT rounding: a 5.39 plan must not read "$5".
  const amount = ctx.amountCents !== null ? ctx.amountCents / 100 : null;
  const per = ctx.interval === "year" ? (fr ? "an" : "year") : (fr ? "mois" : "month");
  const date = ctx.renewsAt
    ? new Date(ctx.renewsAt).toLocaleDateString(fr ? "fr-FR" : "en-GB", {
        day: "numeric", month: "long", year: "numeric", timeZone: "UTC",
      })
    : null;

  /* Three states worth distinguishing. "Cancelled but still running" is the
     one people get wrong: showing Active is a lie, showing Inactive frightens
     someone whose site is still perfectly up. */
  const ending = ctx.cancelAtPeriodEnd;
  const active = ctx.status === "active" || ctx.status === "trialing";
  const pastDue = ctx.status === "past_due" || ctx.status === "unpaid";

  /* What the client should see the moment they open the panel. Derived from
     state we already hold, so nothing here can be stale — and the assistant
     trial is the one that earns its place: it is built, it is theirs to try,
     and nothing tells them unless this does. */
  const notices = isDemo
    ? []
    : noticesFor({
        notes: rowNotes,
        lang: ctx.lang,
        assistantWaiting: builtAssistant,
        copyReady: copyView === "ready",
        paymentDue: pastDue,
        siteUp: health.up,
        newDomain: null,
        linkFor: dashHref,
        assistantTrialHref: linkToken ? `/hosting/assistant/trial?t=${encodeURIComponent(linkToken)}` : null,
        billingHref: linkToken ? `/api/billing-portal?t=${encodeURIComponent(linkToken)}` : null,
      });

  const label = ending ? t.statusEnding : pastDue ? t.statusPastDue : active ? t.statusActive : t.statusOther;
  const tone = ending
    ? "bg-[#FEF7E7] text-[#92700E] border-[#F5E3B3]"
    : pastDue
      ? "bg-[#FDECEC] text-[#B91C1C] border-[#F5C6C6]"
      : active
        ? "bg-[#F3F9EE] text-[#36671E] border-[#CBE3BC]"
        : "bg-[#F4F4F0] text-[#71717A] border-[#E8E6E0]";

  // Only where the year genuinely beats twelve months, and only when monthly.
  const saving = ctx.plan.monthlyUsd * 12 - ctx.plan.annualUsd;
  const showUpgrade = ctx.interval === "month" && saving > 0 && active && !ending;

  return (
    <Shell
      lang={ctx.lang}
      siteLabel={ctx.siteLabel || undefined}
      status={{ label, tone }}
      bell={<NoticeBell notices={notices} lang={ctx.lang} token={linkToken} />}
      nav={
        <DashNav
          active={dashPage}
          lang={ctx.lang}
          token={token}
          counts={{ files: siteFiles.files.length }}
        />
      }
    >
      {isDemo ? (
        <div className="mb-6 rounded-xl border border-[#F5E3B3] bg-[#FEF7E7] px-4 py-3 text-[13px] text-[#92700E]">
          <strong className="font-bold">Example page.</strong> Sample figures, not a real account.
        </div>
      ) : null}
      <div className="flex items-baseline justify-between gap-4 mb-1">
        <h1 className="text-[26px] font-black text-[#18181B] tracking-tight">{dashLabel(dashPage, ctx.lang)}</h1>
        {/* Only for a password session. Someone on an emailed link has nothing
            to sign out of, and a button that does nothing visible is worse
            than no button. */}
        {!isDemo && !token ? <ClientSignOut lang={ctx.lang} /> : null}
      </div>
      {/* One line under every page title saying what this page is for. A
          client who has to work out what a section does reads it once and
          never comes back. */}
      {featureIntro(dashPage, ctx.lang) ? (
        <p className="text-[14px] text-[#71717A] leading-relaxed mb-6 max-w-2xl">{featureIntro(dashPage, ctx.lang)}</p>
      ) : <div className="mb-6" />}

      {dashPage === "overview" ? (
        <StatTiles
          tiles={[
            {
              label: t.tileSite,
              /* What a fetch of their site just returned, not what our row
                 believes. A panel that reports "Active" from a database while
                 the site is down is the one thing that destroys a status
                 page. */
              value: health.up === null ? t.siteUnknown : health.up ? t.siteUp : t.siteDown,
              live: health.up === true,
              hint: ctx.siteLabel || undefined,
            },
            { label: t.tilePlan, value: copy.heading, hint: amount !== null ? `${money(amount)} / ${per}` : undefined },
            { label: ending ? t.endsOn : t.renews, value: date ?? t.renewsNever },
            {
              label: t.tileChanged,
              value: health.lastChange
                ? new Date(health.lastChange).toLocaleDateString(fr ? "fr-FR" : "en-GB", {
                    day: "numeric", month: "short", timeZone: "UTC",
                  })
                : "—",
              hint: health.recentChanges ? t.changesIn30(health.recentChanges) : undefined,
            },
          ]}
        />
      ) : null}

      {dashPage === "overview" ? (
        <div className="mb-6">
          <Recommendations items={recs} heading={recCopy.heading} sub={recCopy.sub} quiet={recCopy.quiet} />
        </div>
      ) : null}

      <div className={`rounded-2xl border border-[#E8E6E0] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden mb-5 ${dashPage === "overview" ? "" : "hidden"}`}>
        <div className="px-7 py-6 border-b border-[#F0EFEA] bg-[#FAFAF7] flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[10px] font-black text-[#8A8A80] uppercase tracking-widest mb-1">{t.forLabel}</p>
            <p className="text-[17px] font-bold text-[#18181B] truncate">{ctx.siteLabel || copy.heading}</p>
          </div>
          <span className={`shrink-0 text-[11px] font-bold px-2.5 py-1 rounded-full border ${tone}`}>{label}</span>
        </div>

        <dl className="px-7 py-6 space-y-4 text-[15px]">
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-[#71717A]">{t.plan}</dt>
            <dd className="font-bold text-[#18181B] text-right">
              {copy.heading}
              {amount !== null ? <> · {money(amount)} / {per}</> : null}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-[#71717A]">{ending ? t.endsOn : t.renews}</dt>
            <dd className="font-bold text-[#18181B] tabular-nums">{date ?? t.renewsNever}</dd>
          </div>
        </dl>
        {/* Monthly unless Stripe says a year: an unknown interval drawn as a
            year shows a nearly-empty bar to someone billed every month. */}
        {ctx.renewsAt ? (
          <RenewalBar
            renewsAt={String(ctx.renewsAt)}
            interval={ctx.interval === "year" ? "year" : "month"}
            label={t.daysLeft}
          />
        ) : null}
      </div>


      <Section title={t.secWebsite} when={dashPage === "website"}>
      {/* THE THING SHE ASKED FOR, ABOVE THE THINGS WE WANT TO SELL HER.
          A client who asked for control of her own pages should find that
          control first on the page that represents her service, not below two
          upsells. The password is not printed here — this page is opened by a
          link from an email, and a page that hands out a password is a page
          that hands it to whoever forwarded the link. */}
      {editorUrl ? (
        <a
          href={editorUrl}
          target="_blank"
          rel="noreferrer"
          data-testid="account-editor-card"
          className="block rounded-2xl border border-[#E8E6E0] bg-white px-6 py-5 mb-5 hover:border-[#CBC9C2] transition"
        >
          <span className="flex items-start justify-between gap-3">
            <span>
              <span className="block font-bold text-[#18181B]">{t.editorTitle}</span>
              <span className="block text-[13px] text-[#71717A] mt-0.5 leading-relaxed">{t.editorBody}</span>
            </span>
            <PencilLine className="w-4 h-4 text-[#36671E] shrink-0 mt-1" />
          </span>
          <span className="block text-[12.5px] text-[#8A8A80] mt-3 leading-relaxed">{t.editorNote}</span>
        </a>
      ) : null}

      {/* The password sits directly under the link it opens, because that is
          the moment someone realises they do not know it. Only where there is
          an editor to let them into. */}
      {editorUrl ? <EditorPassword token={linkToken} lang={ctx.lang} sample={isDemo} /> : null}

      {/* HER EMAIL ON HER PHONE. The settings are derived from her domain's
          own MX record, so the region can never be stale — and the region is
          the whole bug: a phone on the wrong data centre reaches a healthy
          server and reports a wrong password. */}
      {mail && mailbox ? (
        <div className="rounded-2xl border border-[#E8E6E0] bg-white p-7 mb-5" data-testid="account-mail-card">
          <p className="text-[10px] font-black text-[#8A8A80] uppercase tracking-widest mb-3">{t.mailTitle}</p>
          <p className="text-[14px] text-[#52525B] leading-relaxed mb-4">{t.mailIntro(mailbox)}</p>

          <dl className="text-[14px] space-y-3">
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-[#71717A]">{t.mailUser}</dt>
              <dd className="font-bold text-[#18181B] text-right break-all">{mailbox}</dd>
            </div>
            {([
              [t.mailIn, mail.incoming],
              [t.mailOut, mail.outgoing],
            ] as const).map(([label, h]) => (
              <div key={label} className="flex items-baseline justify-between gap-4">
                <dt className="text-[#71717A] shrink-0">{label}</dt>
                <dd className="font-bold text-[#18181B] text-right">
                  {/* The host is the part that must be typed exactly, so it is
                      the part set in a monospace face. */}
                  <span className="font-mono text-[13.5px] break-all">{h.host}</span>
                  <span className="block text-[13px] font-normal text-[#71717A] mt-0.5">
                    {h.port} · {h.security}
                  </span>
                </dd>
              </div>
            ))}
          </dl>

          <p className="mt-4 text-[12.5px] text-[#8A8A80] leading-relaxed">{t.mailWhy}</p>
          {mail.appPasswordIfTwoFactor ? (
            <p className="mt-2 text-[12.5px] text-[#8A8A80] leading-relaxed">{t.mailApp}</p>
          ) : null}
          <a
            href={mail.webmail}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 mt-4 text-[13.5px] font-bold text-[#36671E] hover:underline"
          >
            {t.mailWebmail} <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      ) : null}

      </Section>

      <Section title={t.secFiles} when={dashPage === "files"}>
        {/* The manager, not a list. A client looking at their own files is
            usually looking for the one they want to change. */}
        <FileManager
          token={linkToken}
          lang={ctx.lang}
          files={siteFiles.files.map((f) => ({
            name: f.name,
            kind: f.kind,
            size: f.size === null ? "—" : humanSize(f.size),
          }))}
          folders={siteFolders}
          accept={acceptAttribute()}
          acceptedList={acceptedList()}
          sample={isDemo}
        />

        <div className="rounded-2xl border border-[#E8E6E0] bg-white p-7">
          <p className="text-[10px] font-black text-[#8A8A80] uppercase tracking-widest mb-3">{t.copyTitle}</p>
          <p className="text-[14px] text-[#52525B] leading-relaxed">{t.copyBody}</p>
          <RequestCopy token={linkToken} lang={ctx.lang} initial={copyView} sample={isDemo} />
        </div>
      </Section>


      <Section title={t.secDomain} when={dashPage === "domains"}>
      {domainRec ? (
        <div className="rounded-2xl border border-[#E8E6E0] bg-white p-7 mb-5">
          <p className="text-[17px] font-bold text-[#18181B] break-all">{domainRec.domain}</p>
          <p className="mt-1.5 text-[14px] text-[#52525B] leading-relaxed">
            {domainRec.status === "bought"
              ? `${t.domainRegistered} · ${
                  domainRec.nextChargeAt
                    ? t.domainRenewsInvoice(
                        new Date(`${domainRec.nextChargeAt}T00:00:00Z`).toLocaleDateString(fr ? "fr-FR" : "en-GB", {
                          day: "numeric", month: "long", year: "numeric", timeZone: "UTC",
                        }),
                      )
                    : t.domainRenews
                }`
              : t.domainPending}
          </p>
          <p className="mt-2 text-[13px] text-[#8A8A80] leading-relaxed">{t.domainYours}</p>
        </div>
      ) : null}

        {bought ? (
          /* Straight back from Stripe. The registrar order happens on the
             webhook, which may land a moment after the client does — so this
             says what is true right now rather than claiming it is finished. */
          <div className="rounded-2xl border border-[#CBE3BC] bg-[#F7FBF4] p-6">
            <p className="text-[15px] font-bold text-[#18181B]">{t.boughtTitle(bought)}</p>
            <p className="mt-1 text-[14px] text-[#52525B] leading-relaxed">{t.boughtBody}</p>
          </div>
        ) : null}

        {extraDomains.length ? (
          <div className="rounded-2xl border border-[#E8E6E0] bg-white p-7">
            <p className="text-[10px] font-black text-[#8A8A80] uppercase tracking-widest mb-3">{t.alsoYours}</p>
            <ul className="space-y-2">
              {extraDomains.map((d) => (
                <li key={d.domain} className="flex items-baseline justify-between gap-3 text-[14px]">
                  <span className="font-bold text-[#18181B] break-all">{d.domain}</span>
                  <span className="shrink-0 text-[12.5px] text-[#8A8A80]">
                    {d.failed ? t.domainProblem : d.nextChargeAt ? t.renewsOn(d.nextChargeAt) : ""}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {/* Adding one. The price comes from the registrar before the client
            sees it, so nobody is quoted one figure and invoiced another. */}
        <DomainSearch
          token={linkToken}
          lang={ctx.lang}
          sample={isDemo}
        />
      </Section>

      <Section title={t.secServices} when={dashPage === "services"}>
        {recs.length ? (
          <Recommendations items={recs} heading={recCopy.heading} sub={recCopy.sub} quiet={recCopy.quiet} />
        ) : null}

        <ServiceCards cards={serviceCards} lang={ctx.lang} />

      <div className="rounded-2xl border border-[#E8E6E0] bg-white p-7 mb-5">
        <p className="text-[10px] font-black text-[#8A8A80] uppercase tracking-widest mb-4">{t.included}</p>
        <ul className="space-y-2.5">
          {copy.includes.map((line) => (
            <li key={line} className="flex items-start gap-2.5 text-[15px] text-[#3F3F46]">
              <Check className="w-4 h-4 text-[#36671E] mt-1 shrink-0" />
              <span>{line}</span>
            </li>
          ))}
        </ul>
      </div>

      {showUpgrade ? (
        <Link
          href={`/hosting/upgrade?t=${encodeURIComponent(linkToken)}`}
          className="flex items-center justify-between gap-3 rounded-2xl border border-dashed border-[#CBE3BC] bg-[#F7FBF4] px-6 py-5 mb-5 hover:bg-[#F3F9EE] transition"
        >
          <span className="font-bold text-[#18181B]">{t.upgrade} {money(saving)}</span>
          <ArrowUpRight className="w-4 h-4 text-[#36671E] shrink-0" />
        </Link>
      ) : null}
      {/* The assistant's own page: its brief, its languages, where its leads
          go, and the install line for a site we do not host. The one thing
          an assistant client comes back here for, so it is a card and not a
          footnote. */}
      {!isDemo && ctx.plan.key === "chatbot" ? (
        <Link
          href={`/hosting/assistant?t=${encodeURIComponent(linkToken)}`}
          className="flex items-center justify-between gap-3 rounded-2xl border border-[#CBE3BC] bg-[#F7FBF4] px-6 py-5 mb-5 hover:bg-[#F3F9EE] transition"
        >
          <span>
            <span className="block font-bold text-[#18181B]">
              {fr ? "Régler mon assistant" : "Set up my assistant"}
            </span>
            <span className="block text-[13px] text-[#71717A] mt-0.5">
              {fr
                ? "Ce qu'il sait, ses langues, où arrivent les demandes — et la ligne à ajouter à votre site."
                : "What it knows, its languages, where enquiries go — and the line to add to your site."}
            </span>
          </span>
          <ArrowUpRight className="w-4 h-4 text-[#36671E] shrink-0" />
        </Link>
      ) : null}

      {recommendAssistant ? (
        <div className="rounded-2xl border border-[#CBE3BC] bg-[#F7FBF4] px-6 py-5 mb-5" data-testid="account-assistant-card">
          <span className="block text-[10px] font-black uppercase tracking-[0.16em] text-[#36671E] mb-1.5">
            {builtAssistant
              ? (fr ? "Construit par Servolia pour vous" : "Built by Servolia for you")
              : (fr ? "Recommandé par Servolia" : "Recommended by Servolia")}
          </span>
          <Link
            href={`/hosting?plan=chatbot&ref=${encodeURIComponent(ctx.ref)}`}
            className="flex items-center justify-between gap-3 hover:opacity-90"
          >
            <span>
              <span className="block font-bold text-[#18181B]">
                {builtAssistant
                  ? (fr ? "Votre assistant IA est prêt" : "Your AI assistant is ready")
                  : (fr ? "Ajouter l'assistant IA" : "Add the AI assistant")}
                {" · "}
                {fr ? `${CLIENT_PRODUCTS.chatbot.monthlyUsd} $/mois` : `$${CLIENT_PRODUCTS.chatbot.monthlyUsd}/month`}
              </span>
              <span className="block text-[13px] text-[#71717A] mt-0.5">
                {fr
                  ? "À vos couleurs, formé sur vos pages et vos consignes — chaque demande sur votre téléphone, 24h/24."
                  : "In your colours, trained on your pages and your instructions — every enquiry on your phone, 24/7."}
              </span>
            </span>
            <ArrowUpRight className="w-4 h-4 text-[#36671E] shrink-0" />
          </Link>
          {builtAssistant ? (
            /* The showroom and the settings page: try the real one, then
               tell it what to say — both before paying a cent. The settings
               link is minted from THIS hosting token, the same key that
               opened this page. */
            <span className="flex flex-wrap gap-x-5 gap-y-1 mt-3 text-[13.5px] font-bold text-[#36671E]">
              <a href={`/hosting/assistant/try?site=${encodeURIComponent(ctx.ref)}${fr ? "&lang=fr" : ""}${linkToken ? `&t=${encodeURIComponent(linkToken)}` : ""}`} target="_blank" rel="noreferrer" className="hover:underline">
                {fr ? "L'essayer maintenant →" : "Try it now →"}
              </a>
              {settingsUrl ? (
                <a href={settingsUrl} className="hover:underline">
                  {fr ? "Lui dire quoi dire →" : "Tell it what to say →"}
                </a>
              ) : null}
              {linkToken ? (
                <Link href={`/hosting/assistant/trial?t=${encodeURIComponent(linkToken)}`} className="hover:underline">
                  {fr ? "7 jours d'essai sur mon site →" : "7-day trial on my site →"}
                </Link>
              ) : null}
            </span>
          ) : null}
        </div>
      ) : null}

      </Section>

      <Section title={t.secHelp} when={dashPage === "help"}>
        <SupportBox token={linkToken} lang={ctx.lang} sample={isDemo} />
      </Section>

      <Section title={t.secAccount} when={dashPage === "billing"}>

      <a
        href={`/api/billing-portal?t=${encodeURIComponent(linkToken)}`}
        className="flex items-center justify-between gap-3 rounded-2xl border border-[#E8E6E0] bg-white px-6 py-5 mb-3 hover:border-[#CBC9C2] transition"
      >
        <span>
          <span className="block font-bold text-[#18181B]">{t.manage}</span>
          <span className="block text-[13px] text-[#71717A] mt-0.5">{t.manageNote}</span>
        </span>
        <ExternalLink className="w-4 h-4 text-[#A8A8A0] shrink-0" />
      </a>

      <Link
        href="/hosting/terms"
        className="flex items-center justify-between gap-3 rounded-2xl border border-[#E8E6E0] bg-white px-6 py-5 hover:border-[#CBC9C2] transition"
      >
        <span className="font-bold text-[#18181B]">{t.terms}</span>
        <FileText className="w-4 h-4 text-[#A8A8A0] shrink-0" />
      </Link>

      </Section>

      <p className="mt-8 text-center text-[13px] text-[#8A8A80]">{t.help}</p>
    </Shell>
  );
}
