import type { Metadata } from "next";
import Link from "next/link";
import { Check, ExternalLink, FileText, ArrowUpRight, PencilLine } from "lucide-react";
import { editableSite } from "@/lib/siteEditor";
import { listSiteFiles, humanSize } from "@/lib/clientFiles";
import EditorPassword from "@/components/client/EditorPassword";
import RequestCopy from "@/components/client/RequestCopy";
import { readUpgradeToken, subscriptionContext } from "@/lib/upgrade";
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
    problem: {
      title: "Ce lien a expiré",
      body: "Les liens de service ne durent pas indéfiniment. Répondez à l'un de nos emails et nous vous en envoyons un nouveau.",
    },
  },
};

function Shell({ lang, children }: { lang: "en" | "fr"; children: React.ReactNode }) {
  const t = T[lang];
  return (
    <main className="min-h-screen bg-[#FAFAF7] flex flex-col">
      <header className="px-5 py-6 border-b border-[#E8E6E0] bg-white">
        <div className="max-w-lg mx-auto">
          <Link href="/" className="inline-flex items-center">
            <span className="text-xl font-black tracking-tight text-[#18181B]">
              Serv<span className="gradient-text">olia</span>
            </span>
          </Link>
        </div>
      </header>
      <div className="flex-1 px-5 py-12 sm:py-16">
        <div className="max-w-lg mx-auto">{children}</div>
      </div>
      <footer className="px-5 py-8 border-t border-[#E8E6E0] bg-white">
        <div className="max-w-lg mx-auto text-center">
          <p className="text-xs text-[#8A8A80]">{t.provider}</p>
        </div>
      </footer>
    </main>
  );
}

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string; demo?: string; lang?: string }>;
}) {
  const { t: token = "", demo = "", lang: demoLang = "" } = await searchParams;

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
  const subId = !isDemo && token ? await readUpgradeToken(token) : null;
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
  if (!isDemo && subId) {
    const db = supabaseAdmin();
    const { data: row } = db
      ? await db.from("hosting_clients").select("notes").eq("subscription_id", subId).maybeSingle()
      : { data: null };
    domainRec = readDomainRecord(row?.notes);
  }

  if (!ctx) {
    const t = T.en;
    return (
      <Shell lang="en">
        <div className="rounded-2xl border border-[#E8E6E0] bg-white p-7 text-center">
          <h1 className="text-xl font-black text-[#18181B] mb-2">{t.problem.title}</h1>
          <p className="text-sm text-[#52525B] leading-relaxed">{t.problem.body}</p>
        </div>
      </Shell>
    );
  }

  const t = T[ctx.lang];
  const fr = ctx.lang === "fr";
  const copy = productCopy(ctx.plan, ctx.lang);

  /* The page editor, for a client who has one mounted on their own domain.
     `adminUrl` is set only once their host is actually rewriting /admin, so
     this card cannot advertise a link that 404s. */
  const editor = editableSite(ctx.ref);
  const editorUrl = editor?.adminUrl ?? null;

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
    <Shell lang={ctx.lang}>
      {isDemo ? (
        <div className="mb-6 rounded-xl border border-[#F5E3B3] bg-[#FEF7E7] px-4 py-3 text-[13px] text-[#92700E]">
          <strong className="font-bold">Example page.</strong> Sample figures, not a real account.
        </div>
      ) : null}
      <h1 className="text-3xl font-black text-[#18181B] tracking-tight mb-7">{t.heading}</h1>

      <div className="rounded-2xl border border-[#E8E6E0] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden mb-5">
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
      </div>

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
      {editorUrl ? <EditorPassword token={token} lang={ctx.lang} sample={isDemo} /> : null}

      {/* THE FILES. A client asking for the admin of their site is usually
          asking something underneath it — is this actually mine? A list of
          their own files, by name, answers that better than a sentence. */}
      {siteFiles.unavailable && !siteFiles.files.length ? null : (
        <div className="rounded-2xl border border-[#E8E6E0] bg-white p-7 mb-5">
          <p className="text-[10px] font-black text-[#8A8A80] uppercase tracking-widest mb-3">{t.filesTitle}</p>
          <ul className="space-y-1.5 mb-3">
            {siteFiles.files.map((f) => (
              <li key={f.name} className="flex items-baseline justify-between gap-4 text-[14px]">
                <span className={`truncate ${f.kind === "page" ? "font-bold text-[#18181B]" : "text-[#3F3F46]"}`}>
                  {f.name}
                  {f.kind === "folder" ? "/" : ""}
                </span>
                <span className="shrink-0 text-[13px] text-[#8A8A80] tabular-nums">
                  {f.size === null ? "—" : humanSize(f.size)}
                </span>
              </li>
            ))}
          </ul>
          <p className="text-[13.5px] text-[#52525B] leading-relaxed">
            {t.filesBody(siteFiles.files.length, humanSize(siteFiles.bytes))}
          </p>
          <RequestCopy token={token} lang={ctx.lang} sample={isDemo} />
        </div>
      )}

      {/* The assistant's own page: its brief, its languages, where its leads
          go, and the install line for a site we do not host. The one thing
          an assistant client comes back here for, so it is a card and not a
          footnote. */}
      {!isDemo && ctx.plan.key === "chatbot" ? (
        <Link
          href={`/hosting/assistant?t=${encodeURIComponent(token)}`}
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
              <a href={`/hosting/assistant/try?site=${encodeURIComponent(ctx.ref)}${fr ? "&lang=fr" : ""}${token ? `&t=${encodeURIComponent(token)}` : ""}`} target="_blank" rel="noreferrer" className="hover:underline">
                {fr ? "L'essayer maintenant →" : "Try it now →"}
              </a>
              {settingsUrl ? (
                <a href={settingsUrl} className="hover:underline">
                  {fr ? "Lui dire quoi dire →" : "Tell it what to say →"}
                </a>
              ) : null}
              {token ? (
                <Link href={`/hosting/assistant/trial?t=${encodeURIComponent(token)}`} className="hover:underline">
                  {fr ? "7 jours d'essai sur mon site →" : "7-day trial on my site →"}
                </Link>
              ) : null}
            </span>
          ) : null}
        </div>
      ) : null}

      {domainRec ? (
        <div className="rounded-2xl border border-[#E8E6E0] bg-white p-7 mb-5">
          <p className="text-[10px] font-black text-[#8A8A80] uppercase tracking-widest mb-3">{t.domain}</p>
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

      {showUpgrade ? (
        <Link
          href={`/hosting/upgrade?t=${encodeURIComponent(token)}`}
          className="flex items-center justify-between gap-3 rounded-2xl border border-dashed border-[#CBE3BC] bg-[#F7FBF4] px-6 py-5 mb-5 hover:bg-[#F3F9EE] transition"
        >
          <span className="font-bold text-[#18181B]">{t.upgrade} {money(saving)}</span>
          <ArrowUpRight className="w-4 h-4 text-[#36671E] shrink-0" />
        </Link>
      ) : null}

      <a
        href={`/api/billing-portal?t=${encodeURIComponent(token)}`}
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

      <p className="mt-8 text-center text-[13px] text-[#8A8A80]">{t.help}</p>
    </Shell>
  );
}
