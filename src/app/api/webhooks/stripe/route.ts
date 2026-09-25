import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import Stripe from "stripe";
import { supabaseAdmin, estimateLeadValue } from "@/lib/supabase";
import {
  sendEmail,
  installationPaidEmail,
  clientServicePaidEmail,
  balanceSettledEmail,
  paymentFailedEmail,
} from "@/lib/email";
import { sendMetaCapiEvent } from "@/lib/metaCapi";
import { generateScopeDocument } from "@/lib/scopeDocument";
import { BUILD_PLANS, SETUP_PLAN, resolvePlan } from "@/lib/pricing";
import {
  HOSTING_METADATA_KIND,
  HOSTING_TIERS,
  resolveHostingPlan,
  hostingAmountCents,
  nextChargeDate,
  productCopy,
} from "@/lib/hosting";
import { setShopifyGate, applyGate } from "@/lib/hostingGate";
import { normalizeDomain, purchaseDomainForClient, readDomainRecord, writeDomainRecord, setDomainAutoRenew } from "@/lib/domainSales";
import { hasExtraDomain, writeExtraDomain } from "@/lib/extraDomains";
import { DOMAIN_ORDER_KIND, fulfilDomainOrder, nextYear } from "@/lib/domainOrders";
import { domainOrderEmail } from "@/lib/email";
import { upgradeLinkFor, accountLinkFor, setupLinkFor, assistantLinkFor, referenceFor, subscriptionContext } from "@/lib/upgrade";
import { alreadyFulfilled, writeFulfilment } from "@/lib/fulfilment";
import { assistantSlugFor, installSnippet, ASSISTANT_ORIGIN } from "@/lib/assistant";
import { installAssistantTag } from "@/lib/assistantInstall";
import { ASSISTANT_SITES } from "@/lib/assistantSites";
import { clientRefFor } from "@/lib/clientRefs";
import { billingPortalUrl } from "@/lib/clientPortal";
import { sendTelegramMessage } from "@/lib/telegram";
import { provisionAddon } from "@/lib/provisioning";
import { TOPUP_PACKS, monthKey, writeTopup } from "@/lib/conversationCap";
import { topupReceiptEmail, oneOffServicePaidEmail, receptionistPaidEmail, firstNameFrom } from "@/lib/email";
import { completeReceptionistPurchase, loadReceptionist } from "@/lib/receptionistTrial";
import { startBuildFromIntake } from "@/lib/intakeBuild";
import { stripeFor } from "@/lib/stripeMode";
import { runAsTest, inTestContext, testTag, testPrefixed, excludeTest, isTestRow } from "@/lib/testContext";
import { Sends, paidSubject, troubleSubject, money, emailOutcome, type EmailOutcome } from "@/lib/notify";
import { addWorkingDays, hasOneOff, writeOneOff, type OneOffOrder, type OneOffLeadData } from "@/lib/oneOffOrders";
import { readOwnedDomainMeta, trialEndFor, writeOwnedDomainNote, ownedDomainPaidEmail, ownedDomainOwnerLines } from "@/lib/ownedDomain";

export const runtime = "nodejs";
// A subscriber whose intake beat this event has their draft generated after
// the response (src/lib/intakeBuild.ts): the copy call has reached 50s.
export const maxDuration = 120;

/**
 * Stripe webhook: auto-updates builds when payments clear.
 *
 * Setup:
 *   1. dashboard.stripe.com → Developers → Webhooks → Add endpoint
 *   2. URL: https://servolia.com/api/webhooks/stripe
 *   3. Events: checkout.session.completed, customer.subscription.deleted,
 *              invoice.payment_failed, invoice.paid, invoice.payment_succeeded
 *   4. Copy "Signing secret" → STRIPE_WEBHOOK_SECRET env var
 *
 * FOUNDER TEST MODE (src/lib/testMode.ts): a SECOND endpoint, created in
 * Stripe's TEST mode at the same URL with the same events, signs with
 * STRIPE_TEST_WEBHOOK_SECRET. Events verified with that secret are handled
 * like live ones, inside runAsTest(true): every row written is tagged
 * is_test, alerts say "TEST —", and nothing real happens (no domain bought,
 * no client repository touched, no Meta conversion). Without that secret a
 * test-mode event is acknowledged and ignored, exactly as before.
 */

const GRACE_DAYS = 14; // Vercel-style: banner immediately, hard suspend after this many days.

/** The line a payment-failed owner alert carries about the CLIENT's email,
 *  from what the awaited send really did (src/lib/notify.ts emailOutcome). */
function clientFailureLine(o: EmailOutcome | "not-this-time", otherwise = "Client already told on the first failure."): string {
  return o === "sent" ? "Client emailed (first failure)."
    : o === "failed" ? "CLIENT EMAIL FAILED — tell them by hand."
    : o === "unconfirmed" ? "Client email NOT CONFIRMED (no answer from Resend within 5 s) — check it went."
    : otherwise;
}

export async function POST(req: NextRequest) {
  const key = process.env.STRIPE_SECRET_KEY;
  const whSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!key || !whSecret) {
    return NextResponse.json({ error: "Stripe webhook not configured" }, { status: 503 });
  }

  const stripe = new Stripe(key);
  const sig = req.headers.get("stripe-signature");
  if (!sig) return NextResponse.json({ error: "No signature" }, { status: 400 });

  let event: Stripe.Event;
  let signedByTestEndpoint = false;
  try {
    const body = await req.text();
    try {
      event = stripe.webhooks.constructEvent(body, sig, whSecret);
    } catch (liveErr) {
      /* Not the live endpoint's signature. The founder's TEST-mode endpoint
         signs with its own secret; only that secret is tried, and only when
         it is configured — otherwise this is the same rejection as before. */
      const testSecret = process.env.STRIPE_TEST_WEBHOOK_SECRET;
      if (!testSecret) throw liveErr;
      event = stripe.webhooks.constructEvent(body, sig, testSecret);
      signedByTestEndpoint = true;
    }
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  // Stripe's test endpoint never sends a live event: one that claims to be
  // live under the test secret is not from Stripe.
  if (signedByTestEndpoint && event.livemode) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  // TEST-MODE EVENTS NEVER TOUCH THE CRM.
  //
  // Stripe stamps every event with livemode, which is authoritative — unlike
  // sniffing the API key. Test purchases must still be possible (that is how
  // the checkout gets verified before going live) but they must not leave
  // leads, builds or clients behind: a dashboard showing invented pipeline is
  // worse than an empty one, because you start trusting it. Acknowledged with
  // 200 so Stripe does not retry.
  //
  // FOUNDER TEST MODE is the one exception: an event signed by the test
  // endpoint's own secret was started from the admin's test browser, and is
  // handled below — tagged, excluded from every number, and kept away from
  // anything real.
  if (!event.livemode && !signedByTestEndpoint) {
    console.info(`[stripe] test-mode ${event.type} acknowledged — no CRM rows written`);
    return NextResponse.json({ received: true, testMode: true, skipped: "crm-writes" });
  }

  let modeStripe = stripe;
  if (!event.livemode) {
    const testStripe = stripeFor(false);
    if (!testStripe) {
      console.info(`[stripe] test-mode ${event.type} acknowledged — STRIPE_TEST_SECRET_KEY missing`);
      return NextResponse.json({ received: true, testMode: true, skipped: "no-test-key" });
    }
    modeStripe = testStripe;
  }

  const db = supabaseAdmin();
  if (!db) return NextResponse.json({ received: true });

  /* NEVER A TEST ROW UNTAGGED. Until supabase/2026-09-24-test-mode.sql has
     been run there is no is_test column to tag with, so a test event is
     refused whole — before anything is written — and the founder is told. */
  if (!event.livemode) {
    const missing: string[] = [];
    for (const table of TEST_TABLES) {
      const { error } = await db.from(table).select("is_test").limit(1);
      if (error) missing.push(`${table}: ${error.message}`);
    }
    if (missing.length) {
      console.error("[stripe] test event refused — is_test not readable:", missing.join("; "));
      await sendTelegramMessage(
        `TEST MODE: run supabase/2026-09-24-test-mode.sql first.\n` +
        `A test ${event.type} (${event.id}) was refused and nothing was written: ${missing.join("; ")}\n` +
        `After running it, resend the event from Stripe (test mode > Developers > Events).`,
        undefined, { plain: true },
      ).catch(() => {});
      return NextResponse.json({ received: true, testMode: true, refused: "is_test column missing" });
    }
  }

  return runAsTest(!event.livemode, () => handleEvent(event, modeStripe, db));
}

/** The tables a purchase writes that carry the is_test tag. */
const TEST_TABLES = ["clients", "builds", "hosting_clients", "leads"] as const;

type Db = NonNullable<ReturnType<typeof supabaseAdmin>>;

/**
 * Everything after verification. `stripe` is the client for THIS event's
 * mode (live key for live events, test key for founder test events), so an
 * id read here is read in the mode it was created in. Runs inside
 * runAsTest(!event.livemode): see src/lib/testContext.ts.
 *
 * EVERY ALERT, EMAIL AND META EVENT IS AWAITED BEFORE THE RESPONSE GOES.
 * They used to be fire-and-forget, and on Vercel a function can be frozen
 * the moment its response is returned: a live founder test purchase on
 * 2026-09-25 wrote the client and sent the email, and its Telegram alert
 * never arrived. Each branch starts its sends on `sends` (src/lib/notify.ts,
 * each capped at 5 s, never throwing) and they are all waited for here,
 * side by side, whatever path the branch returns by.
 */
async function handleEvent(event: Stripe.Event, stripe: Stripe, db: Db): Promise<NextResponse> {
  const sends = new Sends();
  try {
    return await handleEventBody(event, stripe, db, sends);
  } finally {
    await sends.settled();
  }
}

async function handleEventBody(event: Stripe.Event, stripe: Stripe, db: Db, sends: Sends): Promise<NextResponse> {
  const test = inTestContext();
  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;

      // Never trust "completed" alone. A session can complete while the money
      // is still pending (delayed methods like bank transfer / SEPA), so we
      // only fulfil when Stripe says the money is actually there. Stripe sends
      // checkout.session.async_payment_succeeded later for those.
      const paid = session.payment_status === "paid" || session.payment_status === "no_payment_required";
      if (!paid) {
        console.log(`Checkout ${session.id} completed but payment_status=${session.payment_status} — not fulfilling yet.`);
        return NextResponse.json({ received: true, pending: true });
      }

      // ── ADD-ON branch: a managed add-on subscription → provision it ──────
      if (session.mode === "subscription" && session.metadata?.kind === "addon") {
        const customerEmail = session.customer_details?.email ?? session.customer_email ?? null;
        const amount = (session.amount_total ?? 0) / 100;
        await provisionAddon({
          addonKey: session.metadata?.addon ?? "unknown",
          email: customerEmail,
          siteSlug: session.metadata?.siteSlug || null,
          amountEur: amount,
        });
        return NextResponse.json({ received: true });
      }

      // ── HOSTING branch: a hosting subscription → its own table ──────────
      // Must stay ABOVE the generic subscription branch below. Falling through
      // would write a hosting client into `clients` — putting USD hosting money
      // into Servolia's EUR MRR — and open a build for a site that already
      // exists and was never scoped here.
      if (session.mode === "subscription" && session.metadata?.kind === HOSTING_METADATA_KIND) {
        const customerEmail = session.customer_details?.email ?? session.customer_email ?? null;
        const amount = (session.amount_total ?? 0) / 100; // everything charged today
        const period = session.metadata?.period === "annual" ? "annual" : "monthly";
        /* The PLAN's price, not the session total. The total may carry a
           domain's year and a one-time setup, and neither belongs in the
           monthly figure the admin sums as recurring revenue. An annual
           charge is a year of the monthly rate; the monthly figure is stored
           either way so the column means one thing. */
        const paidPlan = resolveHostingPlan(session.metadata?.plan);
        const planKey = paidPlan?.key ?? (session.metadata?.plan || "hosting");
        const planUsd = paidPlan ? hostingAmountCents(paidPlan, period) / 100 : amount;
        const monthlyUsd = period === "annual" ? planUsd / 12 : planUsd;
        const subId = typeof session.subscription === "string" ? session.subscription : null;
        const hostRef = clientRefFor(session.metadata?.ref ?? "");
        /* An admin link with free days and/or a domain we ALREADY own
           (src/lib/ownedDomain.ts). Null for every other hosting session. */
        const ownedLink = readOwnedDomainMeta(session.metadata);
        /* Two kinds of thing are sold on this line and they are fulfilled
           differently. A TIER hosts a site: paying for it lifts the site's
           gate. An ADD-ON sits on a site that is already paid for: the AI
           assistant is installed, the site's gate is not touched. Treating
           the two alike is how buying a $12 assistant would switch on a site
           whose hosting is unpaid. */
        const isTier = HOSTING_TIERS.includes(planKey);
        const isAssistant = planKey === "chatbot";

        /* IDEMPOTENCY, KEYED ON THE WORK, NOT ON THE INSERT.
         *
         * This used to read a duplicate-key error from the insert below as
         * "already handled" and skip everything after it. Excellence Agency
         * paid on 2026-09-16 with a row already on file, the insert collided,
         * and the gate, the receipt and the alert were all skipped — silently,
         * because a duplicate is not an error. The row existing says nothing
         * about whether the site was switched on.
         *
         * So the question is asked of the row's notes, where the LAST step
         * below records the checkout session it completed. A Stripe retry
         * finds it and stops here. A first delivery that died halfway does
         * not, and finishes — every step is safe to repeat. */
        const { data: known } = subId
          ? await db.from("hosting_clients").select("id, notes").eq("subscription_id", subId).maybeSingle()
          : { data: null };
        if (known && alreadyFulfilled(known.notes, session.id)) {
          return NextResponse.json({ received: true, line: "hosting", replay: true });
        }

        /* A row created by hand before the payment — same address, same
           plan, no subscription yet — is COMPLETED, not duplicated. That is
           the normal shape for a client the operator set up in advance. */
        let hostRow: { id: string; notes: string | null } | null = known ?? null;
        if (!hostRow && customerEmail) {
          // A test purchase may only ever complete a TEST row, never a real
          // client's pre-created one — and a live one never a test row.
          const { data: pre } = await excludeTest(db, (live) => {
            const preQ = db.from("hosting_clients")
              .select("id, notes")
              .ilike("email", customerEmail).eq("plan", planKey).is("subscription_id", null);
            return (test ? preQ.eq("is_test", true) : live(preQ))
              .order("created_at", { ascending: false }).limit(1).maybeSingle();
          });
          if (pre) hostRow = pre;
        }

        const rowValues: Record<string, unknown> = {
          business: session.metadata?.business || customerEmail || "Unknown",
          contact_name: session.metadata?.contact_name || null,
          email: customerEmail,
          site_url: session.metadata?.site_url || null,
          repo: session.metadata?.repo || null,
          branch: session.metadata?.branch || "main",
          site_root: session.metadata?.site_root || null,
          vercel_project: session.metadata?.vercel_project || null,
          plan: planKey,
          monthly_usd: monthlyUsd,
          billing_period: period,
          status: "active",
          customer_id: (session.customer as string) ?? null,
          subscription_id: subId,
          ...testTag(),
        };
        if (hostRow) {
          /* Only overwrite what the payment actually knows. A pre-created
             row carries the repo and site the operator recorded; a checkout
             from the public page carries neither, and null must not win. */
          const patch: Record<string, unknown> = { ...rowValues };
          for (const k of ["site_url", "repo", "site_root", "vercel_project", "contact_name"]) {
            if (patch[k] === null) delete patch[k];
          }
          if (!session.metadata?.branch) delete patch.branch;
          const { error } = await db.from("hosting_clients").update(patch).eq("id", hostRow.id);
          if (error) console.error("[stripe] hosting_clients update failed:", error.message);
        } else {
          const { data, error } = await db.from("hosting_clients").insert(rowValues).select("id, notes").maybeSingle();
          if (data) {
            hostRow = data;
          } else if (error && /duplicate|unique/i.test(error.message) && subId) {
            // Two deliveries at once: the other one inserted first. Use its row.
            const { data: again } = await db.from("hosting_clients").select("id, notes").eq("subscription_id", subId).maybeSingle();
            hostRow = again ?? null;
          } else if (error) {
            console.error("[stripe] hosting_clients insert failed:", error.message);
          }
        }

        /* Auto-restore the paid add-on. The suspended notice promises the
         * assistant comes back "automatiquement dès reception du paiement",
         * so it has to actually happen -- a promise kept by a human doing it
         * later is a promise the client experiences as broken.
         *
         * Awaited, but it can never fail the webhook: the catch swallows a
         * GitHub outage and reports it as "not restored". Left fire-and-forget
         * this would still work, but nothing downstream could know whether the
         * flip actually happened — and the confirmation email says "your
         * assistant is back on", which must not be a guess. setShopifyGate
         * returns false when the file already said what we wanted, so a client
         * who was never suspended is not told they were just reinstated. */
        let restored = false;
        // Never on a test purchase: the gate lives in a real client's repo.
        if (session.metadata?.gate_widget && session.metadata?.repo && !test) {
          restored = await setShopifyGate(
            {
              repo: session.metadata.repo,
              branch: session.metadata.branch || "main",
              siteRoot: session.metadata.site_root || null,
            },
            session.metadata.gate_widget,
            false,
          ).catch((e) => {
            /* LOUD, not just logged. The suspended notice on the client's own
               storefront promises the assistant returns "automatiquement dès
               reception du paiement". If this fails — a missing GH_TOKEN, a
               revoked one, a GitHub outage — the client has paid and the thing
               they paid for is still off, and a console line in a serverless
               log is not something anyone reads. */
            console.error("[stripe] chatbot restore failed:", e?.message);
            sends.alert(
              `PAID but NOT restored — ${session.metadata?.business || session.metadata?.ref || "a client"}\n` +
              `${e?.message ?? "unknown error"}\n` +
              `They have paid and the service is still off. Restore it by hand.`,
            );
            return false;
          });
        }

        /* SWITCH ON A WHOLE SITE ON ITS FIRST PAYMENT — hosting tiers only.
         *
         * The block above restores a Shopify add-on. This is the Vercel gate,
         * and it is also how a site is brought online in the first place: a
         * client moving to a new domain sits behind the neutral notice until
         * hosting is paid for, and the payment is what lifts it. Same
         * promise as the add-on -- "live the moment payment clears" -- so it
         * is awaited and loud on failure for the same reasons. A site that
         * was never gated comes back changed=false and is left alone. */
        let activated = false;
        if (isTier && hostRef?.repo && !hostRef.gateWidget && !test) {
          const outcome = await applyGate(
            { repo: hostRef.repo, branch: hostRef.branch, siteRoot: hostRef.siteRoot ?? null, gateWidget: null },
            false,
          );
          if (outcome.ok) {
            activated = outcome.changed;
          } else if (outcome.reason !== "no-repo") {
            console.error("[stripe] activation failed:", outcome.reason, outcome.detail);
            sends.alert(
              `PAID but NOT switched on — ${session.metadata?.business || session.metadata?.ref || "a client"}\n` +
              `${outcome.reason}${outcome.detail ? ` (${outcome.detail})` : ""}\n` +
              `They have paid and their site is still behind the notice. Lift it by hand.`,
            );
          }
        }

        /* THE ASSISTANT, PUT ON THE SITE.
         *
         * For a client whose repository we already write to, the pay page's
         * "nothing to install" is made true here: one commit adds the script
         * tag to every page, and Vercel redeploys. The slug the tag carries is
         * the client's ref, which is also the name of the brief in
         * ASSISTANT_SITES — so the assistant answers about the right business
         * from its first conversation. A site we do not host gets the one
         * line in its receipt instead, with the page where they describe
         * their business. */
        let assistantInstalled = false;
        let assistantDetail: string | null = null;
        const assistantSlug = isAssistant ? assistantSlugFor(session.metadata?.ref, session.metadata?.business) : "";
        if (isAssistant && test) {
          assistantDetail = "TEST: not committed to the client's site";
        } else if (isAssistant && hostRef?.repo && !hostRef.gateWidget) {
          const brief = ASSISTANT_SITES[assistantSlug];
          const outcome = await installAssistantTag(
            { repo: hostRef.repo, branch: hostRef.branch, siteRoot: hostRef.siteRoot ?? null },
            assistantSlug,
            brief?.widgetPosition ?? "right",
          );
          if (outcome.ok) {
            assistantInstalled = true;
            assistantDetail = outcome.changed
              ? `added to ${outcome.changed} page${outcome.changed === 1 ? "" : "s"}`
              : "already on every page";
          } else {
            console.error("[stripe] assistant install failed:", outcome.reason, outcome.detail);
            sends.alert(
              `PAID but assistant NOT installed — ${session.metadata?.business || session.metadata?.ref || "a client"}\n` +
              `${outcome.reason}${outcome.detail ? ` (${outcome.detail})` : ""}\n` +
              `They have paid and the script is not on their site. Add it by hand:\n` +
              installSnippet(assistantSlug, brief?.widgetPosition ?? "right"),
            );
          }
        }

        /* A DOMAIN BOUGHT WITH THE PLAN.
         *
         * The client has paid for it, so the purchase is funded before it is
         * made. It is quoted again at this moment and refused if the name
         * has gone or Vercel now wants more than was charged; any refusal is
         * recorded on the row as "pending" and shouted to the operator, who
         * has a Buy button on the client's page. Awaited, because the
         * receipt below says whether the domain is registered, and that must
         * not be a guess. Never bought twice: a row whose record already says
         * "bought" for this name is a first delivery that got this far. */
        // Never on an owned-domain link, whatever else the session carries:
        // that domain is already ours, and buying it again would fail or double-bill.
        const domainWanted = ownedLink ? null : normalizeDomain(session.metadata?.domain ?? "");
        let domainBought = false;
        const priorDomain = readDomainRecord(hostRow?.notes);
        if (domainWanted && priorDomain?.status === "bought" && priorDomain.domain === domainWanted) {
          domainBought = true;
        } else if (domainWanted) {
          const retail = Number(session.metadata?.domain_retail_usd ?? 0);
          /* A test purchase never buys a domain: the name is recorded as
             pending with the note "TEST: domain not bought", and nobody is
             alerted to buy it by hand. */
          const outcome = test
            ? { ok: false as const, reason: "error" as const, detail: "TEST: domain not bought" }
            : await purchaseDomainForClient(domainWanted, retail);
          domainBought = outcome.ok;
          if (hostRow?.id) {
            const { data: fresh } = await db.from("hosting_clients").select("notes").eq("id", hostRow.id).maybeSingle();
            const notes = writeDomainRecord(fresh?.notes ?? hostRow.notes, {
              domain: domainWanted,
              retailUsd: retail,
              status: outcome.ok ? "bought" : "pending",
              orderId: outcome.ok ? outcome.orderId : undefined,
              boughtAt: outcome.ok ? new Date().toISOString().slice(0, 10) : undefined,
              // On a monthly plan the domain is not on the subscription, so
              // its next year is charged by the domain-billing cron on this
              // date. On a yearly plan it renews with the plan: no date.
              nextChargeAt: outcome.ok && session.metadata?.domain_billing === "yearly-invoice"
                ? nextChargeDate(new Date(event.created * 1000), "annual").toISOString().slice(0, 10)
                : undefined,
              note: outcome.ok ? undefined : `${outcome.reason}${outcome.detail ? ` (${outcome.detail})` : ""}`,
            });
            await db.from("hosting_clients").update({ site_url: `https://${domainWanted}`, notes }).eq("id", hostRow.id);
            hostRow = { ...hostRow, notes };
          }
          if (!outcome.ok && !test) {
            console.error("[stripe] domain purchase failed:", domainWanted, outcome.reason, outcome.detail);
            sends.alert(
              [
                `DOMAIN NOT BOUGHT - ${domainWanted}`,
                `Client paid for it: ${session.metadata?.business || customerEmail || "unknown"}`,
                `Reason: ${outcome.reason}${outcome.detail ? ` (${outcome.detail})` : ""}`,
                outcome.reason === "no-contact" || outcome.reason === "not-configured"
                  ? `Set VERCEL_TOKEN, VERCEL_TEAM_ID and DOMAIN_CONTACT_JSON, then press Buy on the client's page.`
                  : `Press Buy on the client's page, or buy it by hand.`,
                hostRow?.id ? `https://servolia.com/admin/hosting/${hostRow.id}` : `https://servolia.com/admin/hosting`,
              ].join("\n"),
            );
          }
        }

        /* A DOMAIN WE ALREADY OWN, AND/OR FREE DAYS FIRST.
         *
         * Nothing is bought or attached: the admin link was refused unless
         * the domain was already in our team and on the client's project.
         * What is recorded is the marker the domain's renewal will need (its
         * price and the day its second year is due), and the day the hosting
         * really starts, read from Stripe's own trial_end so the email below
         * names the date the card is actually charged. */
        let ownedStartsIso: string | null = null;
        let ownedRenewsOn: string | null = null;
        if (ownedLink) {
          const paidAt = new Date(event.created * 1000);
          ownedStartsIso = (await trialEndFor(subId, event.livemode, paidAt, ownedLink.trialDays)).iso;
          if (ownedLink.domain) {
            ownedRenewsOn = nextChargeDate(paidAt, "annual").toISOString().slice(0, 10);
            if (hostRow?.id) {
              const { data: fresh } = await db.from("hosting_clients").select("notes").eq("id", hostRow.id).maybeSingle();
              const notes = writeOwnedDomainNote(fresh?.notes ?? hostRow.notes, {
                domain: ownedLink.domain,
                usd: ownedLink.usd,
                project: session.metadata?.vercel_project || null,
                renewsOn: ownedRenewsOn,
                paidOn: paidAt.toISOString().slice(0, 10),
              });
              await db.from("hosting_clients").update({ notes }).eq("id", hostRow.id);
              hostRow = { ...hostRow, notes };
            }
          }
        }

        /* CONFIRM IT TO THE CLIENT, IN OUR OWN NAME.
         *
         * /hosting/thanks tells the buyer a receipt is on its way. Until this
         * existed, the only thing that could keep that promise was Stripe's
         * "Successful payments" toggle — off by default in some accounts,
         * invisible to the API, and changeable by anyone with dashboard
         * access. A small client paying a stranger's Stripe page and then
         * receiving nothing is exactly the moment a payment feels like a scam.
         *
         * Sent once per checkout session: the fulfilment marker at the end
         * of this branch is what stops a replay from sending it twice. */
        const product = resolveHostingPlan(session.metadata?.plan);
        // Set at checkout from the client record, so the confirmation matches
        // the language they bought in rather than the language we default to.
        const emailLang = session.metadata?.lang === "fr" ? "fr" : "en";
        let briefUrl: string | null = null;
        if (isAssistant && subId) {
          briefUrl = await assistantLinkFor(subId, "https://servolia.com").catch(() => null);
        }
        if (customerEmail && ownedLink && ownedStartsIso) {
          /* Its own receipt: "payment cleared, your hosting is active, renews
             in a year" would be false twice over for a link whose hosting has
             not been charged yet. */
          const tpl = ownedDomainPaidEmail({
            domain: ownedLink.domain,
            domainUsd: ownedLink.usd,
            tier: (product && productCopy(product, emailLang).tier) || "Hosting",
            planUsd,
            period,
            hostingStartsIso: ownedStartsIso,
            siteLabel: session.metadata?.business || "",
            portalUrl: subId ? await accountLinkFor(subId, "https://servolia.com").catch(() => null) : null,
            lang: emailLang,
          });
          sends.add("hosting receipt", sendEmail(customerEmail, tpl.subject, tpl.html));
        } else if (customerEmail) {
          const copy = product ? productCopy(product, emailLang) : null;
          /* The switch-to-yearly offer, minted only when the year is actually
             cheaper than twelve months. Never for an annual buyer, who has
             nothing to upgrade to. Failing to mint must not cost them their
             receipt, so it degrades to no offer rather than no email. */
          let upgradeUrl: string | null = null;
          if (period === "monthly" && subId && product && product.annualUsd < product.monthlyUsd * 12) {
            upgradeUrl = await upgradeLinkFor(subId, "https://servolia.com").catch(() => null);
          }
          /* Their own service page, in OUR name, which then hands off to
             Stripe for the billing parts Stripe owns. Sending a client
             straight to a Stripe screen answers "what am I paying" with
             somebody else's brand, and leaves "what am I actually getting,
             from whom, until when" unanswered — which is the question a
             client deciding whether we are a real company is asking. */
          let portalUrl: string | null = null;
          if (subId) {
            portalUrl = await accountLinkFor(subId, "https://servolia.com").catch(() => null);
          }
          /* The handover step, only for a buyer of HOSTING we do not already
             host. A known ref means the site is already in our hands; asking
             them where it lives would read as if we had lost it. An assistant
             buyer gets the assistant's own page instead, whatever their site. */
          let setupUrl: string | null = null;
          if (subId && !hostRef && isTier) {
            setupUrl = await setupLinkFor(subId, "https://servolia.com").catch(() => null);
          }
          const tpl = clientServicePaidEmail({
            productName: copy?.heading ?? "Website hosting",
            productNoun: copy?.sentenceName ?? "hosting",
            siteLabel: session.metadata?.business || session.metadata?.ref || "",
            amountUsd: planUsd,
            totalPaidUsd: amount,
            domainUsd: Number(session.metadata?.domain_retail_usd) || null,
            oneTimeUsd: Number(session.metadata?.setup_usd) || null,
            period,
            nextChargeIso: nextChargeDate(new Date(event.created * 1000), period).toISOString(),
            monthlyUsd: product?.monthlyUsd,
            restored,
            activated,
            includes: copy?.includes ?? [],
            lang: emailLang,
            upgradeUrl,
            portalUrl,
            setupUrl,
            reference: subId ? referenceFor(subId) : null,
            domainName: domainWanted,
            domainRegistered: domainBought,
            domainBilling: session.metadata?.domain_billing === "yearly-invoice" ? "yearly-invoice" : "with-plan",
            assistant: isAssistant
              ? {
                  installed: assistantInstalled,
                  /* This one is pasted by the CLIENT, so it has to work where
                     they put it: relative for a site we host and therefore
                     proxy, absolute for one we do not, where a relative path
                     would 404 and the assistant would never appear. */
                  snippet: assistantInstalled
                    ? null
                    : installSnippet(
                        assistantSlug,
                        ASSISTANT_SITES[assistantSlug]?.widgetPosition ?? "right",
                        clientRefFor(session.metadata?.ref ?? "")?.repo &&
                        !clientRefFor(session.metadata?.ref ?? "")?.gateWidget
                          ? {}
                          : { origin: ASSISTANT_ORIGIN },
                      ),
                  briefUrl,
                }
              : null,
          });
          sends.add("hosting receipt", sendEmail(customerEmail, tpl.subject, tpl.html));
        }

        /* And tell the owner (Telegram + email). A hosting client once paid
         * with nobody knowing until the Stripe balance was next opened.
         *
         * The reference is what the client will quote, so it is what the
         * operator needs in hand. A self-serve buyer is not hosted yet — say
         * so here, at the moment the money lands, rather than leaving it to
         * be discovered on the list page. Sent once per checkout session:
         * a replay stopped at the fulfilment marker above. */
        if (ownedLink && ownedStartsIso) {
          // The same facts as the client's email; the amount is what was charged TODAY.
          const who = session.metadata?.business || customerEmail;
          const tier = product?.name ?? "Hosting";
          sends.owner({
            subject: paidSubject(
              ownedLink.domain ? `Domain ${ownedLink.domain} (first year) + ${tier} after ${ownedLink.trialDays} free days` : `${tier} — ${ownedLink.trialDays} free days`,
              amount, session.currency ?? "usd", who,
            ),
            lines: [
              ...ownedDomainOwnerLines({
                domain: ownedLink.domain,
                domainUsd: ownedLink.usd,
                chargedTodayUsd: amount,
                currency: session.currency ?? "usd",
                tier,
                planUsd,
                period,
                trialDays: ownedLink.trialDays,
                hostingStartsIso: ownedStartsIso,
                renewsOn: ownedRenewsOn,
                project: session.metadata?.vercel_project || null,
              }),
              `${session.metadata?.business || "unnamed site"}`,
              `${customerEmail ?? "no email"}`,
              subId && `Ref ${referenceFor(subId)}`,
              `Next: nothing today${ownedLink.domain ? `; the domain's second year (${ownedRenewsOn}) must be billed by hand until domain renewals are automated` : ""}.`,
            ],
            link: hostRow?.id ? `https://servolia.com/admin/hosting/${hostRow.id}` : "https://servolia.com/admin/hosting",
          });
        } else {
          const selfServe = !hostRef && isTier;
          const who = session.metadata?.business || session.metadata?.ref || customerEmail;
          sends.owner({
            subject: paidSubject(`${product?.name ?? "Hosting"} (${period})`, amount, session.currency ?? "usd", who),
            lines: [
              `${product?.name ?? "Hosting"} paid — ${money(amount, session.currency ?? "usd")} ${period}`,
              `${session.metadata?.business || session.metadata?.ref || "unnamed site"}`,
              `${customerEmail ?? "no email"}`,
              subId && `Ref ${referenceFor(subId)}`,
              restored && `♻️ ${session.metadata?.gate_widget} switched back on`,
              activated && `🟢 Site switched on — the notice is lifted`,
              isAssistant && assistantInstalled && `🤖 Assistant installed — ${assistantDetail}`,
              isAssistant && !assistantInstalled && hostRef?.repo && !hostRef.gateWidget && `⚠️ Assistant NOT installed — see the alert`,
              isAssistant && !hostRef && `ℹ️ Site not hosted by us — they add one line; the brief page was emailed`,
              domainWanted && `🌐 Domain ${domainWanted}: ${domainBought ? "bought on Vercel" : "NOT bought — see the alert"}`,
              `Next: ${[
                selfServe && "⚠️ NEEDS SETUP — not hosted yet; their handover arrives as a separate alert",
                domainWanted && !domainBought && !test && "buy the domain (see the alert)",
              ].filter(Boolean).join("; ") || "nothing flagged here (any failure above came as its own alert)"}`,
            ],
            link: hostRow?.id ? `https://servolia.com/admin/hosting/${hostRow.id}` : "https://servolia.com/admin/hosting",
          });
        }

        /* LAST: record that this session's work is done. Written after the
           email and the alert so that a crash anywhere above leaves no
           marker, and the retry does the job properly. */
        if (hostRow?.id) {
          const { data: fresh } = await db.from("hosting_clients").select("notes").eq("id", hostRow.id).maybeSingle();
          await db.from("hosting_clients").update({
            notes: writeFulfilment(fresh?.notes ?? hostRow.notes, {
              session: session.id,
              at: new Date().toISOString(),
              plan: planKey,
            }),
          }).eq("id", hostRow.id);
        }

        return NextResponse.json({ received: true, line: "hosting" });
      }

      /* ── ARREARS branch: a one-off charge clearing an old balance ─────────
       *
       * THIS MUST NOT FALL THROUGH. Arrears are sold in `payment` mode, so the
       * subscription guard above does not catch them, and the next branch that
       * would is the build-payment path at the bottom — which has no mode check
       * at all. Without this, settling a $15 debt would open a BUILD, invent a
       * LEAD, and email the payer that their "installation" had cleared and
       * their site was being made, in euros. A client clearing an old invoice
       * would be told they had just commissioned a new project.
       *
       * Dormant today: no client in CLIENT_REFS carries arrearsUsd, so
       * /api/hosting-checkout refuses every arrears request with "Nothing
       * outstanding". It stops being dormant the moment one is added. */
      /* A DOMAIN SOLD ON ITS OWN, from a link made on /admin/hosting
       * (src/lib/domainOrders.ts). No plan, no hosting row: the record is
       * kept on the Stripe customer. Bought, put on the Vercel project if one
       * was named, and the client is told in a Servolia email either way —
       * a name the registrar refused is a refund to make, said out loud. */
      if (session.mode === "payment" && session.metadata?.kind === DOMAIN_ORDER_KIND) {
        const res = await fulfilDomainOrder(stripe, session, test);
        if (!res) {
          await sendTelegramMessage(testPrefixed(`⚠️ Domain order ${session.id} paid but unreadable (no domain or no customer). Check it in Stripe.`), undefined, { plain: true });
          return NextResponse.json({ received: true });
        }
        if (res.duplicate) return NextResponse.json({ received: true, duplicate: true });
        const rec = res.record;
        const bought = rec.status === "bought";
        if (res.customerEmail) {
          const tpl = domainOrderEmail({
            domain: rec.domain, amountUsd: rec.retailUsd, registered: bought,
            renewsOnIso: rec.renewsOn ?? nextYear(new Date().toISOString().slice(0, 10)),
            name: rec.name, lang: rec.lang,
          });
          await sendEmail(res.customerEmail, tpl.subject, tpl.html).catch(() => false);
        }
        const who = rec.name || res.customerEmail || "?";
        await sendTelegramMessage(testPrefixed(
          bought
            ? `🌐 ${who} paid $${rec.retailUsd.toFixed(2)} and ${rec.domain} is REGISTERED (order ${rec.orderId}). Renews ${rec.renewsOn}.\n` +
              (res.attach === "done" ? `Attached to Vercel project ${rec.project}.` :
               res.attach === "failed" ? `NOT attached to ${rec.project} (${res.attachDetail}) - add it in Vercel > ${rec.project} > Domains.` :
               "No Vercel project named - attach it by hand.") +
              (res.cardSaved ? "" : "\nCard NOT saved as default - next year's renewal will fail; set it in Stripe.")
            : `⚠️ ${who} PAID $${rec.retailUsd.toFixed(2)} for ${rec.domain} and it was NOT registered (${rec.note}). Buy it by hand (vercel domains buy ${rec.domain}) or refund them. They were told.`,
        ), undefined, { plain: true });
        return NextResponse.json({ received: true });
      }

      /* AN EXTRA DOMAIN, BOUGHT FROM THE CLIENT'S OWN PANEL.
       *
       * The money is already taken by the time this runs, so the registrar
       * order happens here and the outcome is recorded either way — a name
       * that could not be registered must be visible as a refund to make,
       * not lost in a log.
       *
       * Idempotent on the domain name, because Stripe delivers a webhook more
       * than once as a matter of course and a second delivery must not buy a
       * second copy of something the client already owns. */
      if (session.mode === "payment" && session.metadata?.kind === "domain_addon") {
        const domain = normalizeDomain(session.metadata?.domain ?? "");
        const retail = Number(session.metadata?.domain_retail_usd ?? 0);
        const subId = session.metadata?.subscription_id ?? "";
        const ref = session.metadata?.ref ?? "";

        if (db && domain && subId) {
          const { data: row } = await db
            .from("hosting_clients")
            .select("id, notes, business")
            .eq("subscription_id", subId)
            .maybeSingle();
          const notes = (row as { notes?: string | null } | null)?.notes ?? null;

          if (row && !hasExtraDomain(notes, domain)) {
            // Never bought on a test purchase (recorded as failed: TEST).
            const outcome = test
              ? { ok: false as const, reason: "TEST: domain not bought" }
              : await purchaseDomainForClient(domain, retail);
            const next = new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10);
            const rec = outcome.ok
              ? { domain, retailUsd: retail, orderId: outcome.orderId, boughtAt: new Date().toISOString().slice(0, 10), nextChargeAt: next }
              : { domain, retailUsd: retail, failed: outcome.reason };
            await db.from("hosting_clients")
              .update({ notes: writeExtraDomain(notes, rec) })
              .eq("id", (row as { id: string }).id);

            // Once per domain: a replay finds it recorded (hasExtraDomain) and stops above.
            const who = ref || (row as { business?: string | null }).business || session.customer_details?.email || domain;
            sends.owner({
              subject: paidSubject(`extra domain ${domain}`, retail, "usd", who),
              lines: [
                outcome.ok
                  ? `🌐 ${who} bought ${domain} for ${money(retail, "usd")}. Registered.`
                  : `⚠️ ${who} PAID ${money(retail, "usd")} for ${domain} and the registrar refused (${outcome.reason}).`,
                outcome.ok
                  ? `Next: point it at their project when you can.`
                  : `Next: register it by hand or refund them.`,
              ],
              link: `https://servolia.com/admin/hosting/${(row as { id: string }).id}`,
            });
          }
        }
        return NextResponse.json({ received: true });
      }

      /* A ONE-OFF SERVICE on the hosting line — today the multilingual search
       * setup. Until 2026-09-22 this fell through to the arrears branch
       * below: the buyer got a receipt titled "Outstanding balance", Telegram
       * said "Arrears settled", and nothing recorded the work to do. The
       * plan key on the session is what tells the two apart. */
      if (session.mode === "payment" && session.metadata?.kind === HOSTING_METADATA_KIND && session.metadata?.plan === "seo_multilingual") {
        const customerEmail = session.customer_details?.email ?? session.customer_email ?? null;
        const amount = (session.amount_total ?? 0) / 100;
        const siteLabel = session.metadata?.business || session.metadata?.ref || "";
        const lang = session.metadata?.lang === "fr" ? "fr" : "en";
        const product = resolveHostingPlan("seo_multilingual");

        /* RECORD THE ORDER FIRST (2026-09-25). Its "within five working days"
           promise used to live only in an email and a Telegram — and the first
           live purchase lost both. src/lib/oneOffOrders.ts: a line on the
           client's hosting row when one exists (by address, else by the ref's
           repository), otherwise a lead; keyed on this session, so a
           redelivered event stops here without a second email or alert.
           /admin/today lists it until it is marked done. A test purchase
           touches only test rows and writes a test-tagged lead. */
        const paidOn = new Date(event.created * 1000);
        const order: OneOffOrder = {
          service: "seo_multilingual",
          session: session.id,
          paidAt: paidOn.toISOString().slice(0, 10),
          dueAt: addWorkingDays(paidOn, 5),
          amountUsd: amount,
        };
        /* ALREADY RECORDED? Asked of BOTH stores before anything is written:
           a first delivery may have written a lead (no hosting row then) and
           the client bought hosting since, so a redelivery would now find a
           row and record the same order a second time. `like` on the notes
           is a superset (`_` in a session id is a wildcard); hasOneOff is the
           exact check. */
        const [{ data: rowsWithIt }, { data: leadWithIt }] = await Promise.all([
          db.from("hosting_clients").select("id, notes").like("notes", `%${session.id}%`).limit(10),
          db.from("leads").select("id")
            .eq("raw_data->>type", "oneoff").eq("raw_data->>session", session.id).limit(1).maybeSingle(),
        ]);
        const onRow = ((rowsWithIt ?? []) as { id: string; notes: string | null }[]).some((r) => hasOneOff(r.notes, session.id));
        if (onRow || leadWithIt) {
          return NextResponse.json({ received: true, line: "one-off", replay: true });
        }

        /* WHOSE ROW. The ref's repository first (the site the checkout was
           opened for), then the buyer's address by exact, case-insensitive
           equality — `ilike` alone treats `_` and `%` in an address as
           wildcards, so it is only a superset that the filter below narrows.
           Among several matches an active row wins, then the newest. A test
           purchase considers only test rows. */
        type HostRow = { id: string; business: string | null; notes: string | null; email: string | null; status: string | null; created_at: string | null };
        const onlyThisMode = <Q,>(q: Q, live: <T>(x: T) => T) =>
          test ? (q as unknown as { eq(c: string, v: boolean): Q }).eq("is_test", true) : live(q);
        const best = (rows: HostRow[]): HostRow | null =>
          [...rows].sort((a, b) =>
            Number(b.status === "active") - Number(a.status === "active") ||
            String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")))[0] ?? null;
        const COLS = "id, business, notes, email, status, created_at";
        let host: HostRow | null = null;
        const refRepo = clientRefFor(session.metadata?.ref ?? "")?.repo;
        if (refRepo) {
          const { data } = await excludeTest(db, (live) => onlyThisMode(
            db.from("hosting_clients").select(COLS).eq("repo", refRepo), live,
          ).limit(20));
          host = best((data ?? []) as HostRow[]);
        }
        if (!host && customerEmail) {
          const want = customerEmail.trim().toLowerCase();
          const { data } = await excludeTest(db, (live) => onlyThisMode(
            db.from("hosting_clients").select(COLS).ilike("email", customerEmail.trim()), live,
          ).limit(20));
          host = best(((data ?? []) as HostRow[]).filter((r) => (r.email ?? "").trim().toLowerCase() === want));
        }
        let recordedAt: string | null = null;
        if (host) {
          const { error } = await db.from("hosting_clients")
            .update({ notes: writeOneOff(host.notes, order) }).eq("id", host.id);
          if (error) console.error("[stripe] one-off record failed:", error.message);
          else recordedAt = `https://servolia.com/admin/hosting/${host.id}`;
        } else {
          const raw: OneOffLeadData = { type: "oneoff", ...order, siteLabel };
          const { data: lead, error } = await db.from("leads").insert({
            business: siteLabel || customerEmail || "One-off order",
            email: customerEmail,
            source: "one-off",
            /* A stage of its own: not "deposit_paid"/"live" (both count as an
               installation won), not "new" (a lead to answer within 48 h).
               Listed on /admin/today with its due date instead. */
            stage: "one_off",
            plan_interest: "seo_multilingual",
            value_estimate: 0, // a one-off already paid is not pipeline
            raw_data: raw,
            ...testTag(),
          }).select("id").single();
          if (error || !lead) console.error("[stripe] one-off lead failed:", error?.message);
          else recordedAt = `https://servolia.com/admin/leads/${(lead as { id: string }).id}`;
        }

        // Awaited before the owner is told, so the alert says whether the
        // client actually has their confirmation.
        let receipt: EmailOutcome | "no-address" = "no-address";
        if (customerEmail) {
          const tpl = oneOffServicePaidEmail({
            productName: product ? productCopy(product, lang).heading : "Multilingual search setup",
            amountUsd: amount,
            siteLabel,
            whatHappens: lang === "fr"
              ? "nous déclarons vos langues (hreflang), écrivons un plan de site par langue et les données structurées, et vous confirmons par email quand c'est en place — sous cinq jours ouvrés."
              : "we declare your languages (hreflang), write a sitemap per language and the structured data, and email you when it is in place — within five working days.",
            lang,
          });
          receipt = emailOutcome(await sends.add("one-off receipt", sendEmail(customerEmail, tpl.subject, tpl.html)));
        }
        sends.owner({
          subject: paidSubject("multilingual search setup (one-off)", amount, session.currency ?? "usd", siteLabel || customerEmail),
          lines: [
            `ONE-OFF PAID - multilingual search setup, ${money(amount, session.currency ?? "usd")}`,
            siteLabel || "unnamed site",
            customerEmail ?? "no email",
            `DUE ${order.dueAt} (five working days from ${order.paidAt})`,
            receipt === "sent" ? "Receipt: sent."
              : receipt === "failed" ? "Receipt: FAILED — email them by hand."
              : receipt === "unconfirmed" ? "Receipt: NOT CONFIRMED (no answer from Resend within 5 s) — check it went, or email them by hand."
              : "Receipt: none — no address on the payment. Reach them by hand.",
            recordedAt
              ? host ? `Recorded on ${host.business ?? "their"} hosting row; on /admin/today until marked done.` : `No hosting row for this client — recorded as a lead; on /admin/today until marked done.`
              : `⚠️ NOT RECORDED (database error) — note the due date by hand.`,
            `Next: by ${order.dueAt} — hreflang, a sitemap per language, structured data. Confirm to the client by email, then press Done on /admin/today.`,
          ],
          link: recordedAt ?? "https://servolia.com/admin/today",
        });
        return NextResponse.json({ received: true, line: "one-off" });
      }

      if (session.mode === "payment" && session.metadata?.kind === HOSTING_METADATA_KIND) {
        const customerEmail = session.customer_details?.email ?? session.customer_email ?? null;
        const amount = (session.amount_total ?? 0) / 100;
        const label = session.metadata?.label || "Outstanding balance";
        const siteLabel = session.metadata?.ref || "";

        if (customerEmail) {
          const tpl = balanceSettledEmail({
            siteLabel,
            amountUsd: amount,
            label,
            lang: session.metadata?.lang === "fr" ? "fr" : "en",
          });
          sends.add("arrears receipt", sendEmail(customerEmail, tpl.subject, tpl.html));
        }

        sends.owner({
          subject: paidSubject(`arrears settled (${label})`, amount, session.currency ?? "usd", siteLabel || customerEmail),
          lines: [
            `💵 Arrears settled — ${money(amount, session.currency ?? "usd")}`,
            siteLabel || "unnamed site",
            customerEmail ?? "no email",
            `Next: check their account is back to good standing.`,
          ],
          link: "https://servolia.com/admin/hosting",
        });

        return NextResponse.json({ received: true, line: "arrears" });
      }

      // ── RECEPTIONIST branch: a practice keeps the receptionist it tried ──
      // Must stay ABOVE the generic plan branch below, which would open a
      // build in `intake` and email her an intake form for a website she
      // never asked for. This one makes her a client on the receptionist
      // that is already on her site (completeReceptionistPurchase), and is
      // idempotent on the subscription id.
      if (session.mode === "subscription" && session.metadata?.kind === "receptionist") {
        const customerEmail = (session.customer_details?.email ?? session.customer_email ?? session.metadata?.email ?? "").trim().toLowerCase();
        const lang = session.metadata?.lang === "en" ? "en" : "fr";
        const out = await completeReceptionistPurchase({
          slug: session.metadata?.slug ?? "",
          email: customerEmail,
          planKey: session.metadata?.plan ?? "",
          billing: session.metadata?.billing === "annual" ? "annual" : "monthly",
          customerId: (session.customer as string) ?? null,
          subscriptionId: (session.subscription as string) ?? null,
        });
        if (!out.ok) {
          /* 500 on purpose: Stripe redelivers the event later, and
             completeReceptionistPurchase is built so a retry finishes the
             job (see its header). A 200 here would make a transient database
             failure permanent. */
          await sendTelegramMessage(
            `Receptionist payment NOT finished yet - ${customerEmail || "no email"}\n` +
            `slug ${session.metadata?.slug ?? "?"} · plan ${session.metadata?.plan ?? "?"} · session ${session.id}\n` +
            `Reason: ${out.reason}\nStripe will redeliver it. If this message keeps coming, record the client by hand.`,
            undefined, { plain: true },
          ).catch(() => {});
          return NextResponse.json({ received: false, line: "receptionist", retry: true }, { status: 500 });
        }
        if (out.duplicate) {
          await sendTelegramMessage(
            `SECOND SUBSCRIPTION for an already-paid receptionist - ${out.business}\n` +
            `${customerEmail} paid again (session ${session.id}). Recorded as a client, NOT linked. ` +
            `Cancel and refund one of the two subscriptions in Stripe, then mark the extra clients row churned.`,
            undefined, { plain: true },
          ).catch(() => {});
          return NextResponse.json({ received: true, line: "receptionist", duplicate: true });
        }
        if (!out.already) {
          const plan = resolvePlan(session.metadata?.plan);
          if (customerEmail && plan) {
            const tpl = receptionistPaidEmail({
              business: out.business,
              domain: (await loadReceptionist(session.metadata?.slug ?? ""))?.config.receptionist?.domain ?? out.business,
              planName: lang === "fr" ? plan.nameFr : plan.name,
              conversations: plan.conversations,
              lang,
            });
            sends.add("receptionist receipt", sendEmail(customerEmail, tpl.subject, tpl.html));
          }
          // Once: a replay comes back out.already and skips this block.
          sends.owner({
            subject: paidSubject(`${out.planName} — kept after the receptionist trial`, (session.amount_total ?? 0) / 100, session.currency ?? "eur", out.business || customerEmail),
            lines: [
              `NEW CLIENT from the receptionist trial - ${out.business}`,
              `${out.planName} · EUR ${Math.round(out.monthlyEur * 100) / 100}/mo equivalent · ${session.metadata?.billing ?? "monthly"} · installation waived`,
              customerEmail || "no email",
              out.linked
                ? `Next: nothing — linked to their receptionist; the meter and portal are live.`
                : `Next: NOT LINKED to a receptionist row (slug ${session.metadata?.slug ?? "?"}) - their widget will go quiet at the end of the trial. Fix by hand.`,
            ],
            link: out.clientId ? `https://servolia.com/admin/clients/${out.clientId}` : "https://servolia.com/admin/clients",
          });
          sends.add("meta purchase", sendMetaCapiEvent({
            eventName: "Purchase",
            email: customerEmail,
            value: (session.amount_total ?? 0) / 100,
            currency: "EUR",
            eventSourceUrl: "https://servolia.com/fr/essai",
          }));
        }
        return NextResponse.json({ received: true, line: "receptionist", already: out.already });
      }

      // ── MONTHLY PLAN branch: recurring subscription, not the installation ──
      if (session.mode === "subscription") {
        const customerEmail = session.customer_details?.email ?? session.customer_email ?? null;
        const amount = (session.amount_total ?? 0) / 100;
        const planKey = session.metadata?.plan ?? "essentiel";
        // resolvePlan also maps the retired care/care_growth/care_scale keys.
        const plan = resolvePlan(planKey);
        const planLabel = plan?.name ?? "Essentiel";
        const billing: "monthly" | "annual" = session.metadata?.billing === "annual" ? "annual" : "monthly";
        const subscriptionId = (session.subscription as string) ?? null;

        /* A redelivered event must not open a second client. Stripe retries
           on any non-2xx and occasionally on a 2xx it lost; the subscription
           id is unique to this purchase. */
        if (subscriptionId) {
          const { data: seen } = await db.from("clients")
            .select("id").eq("subscription_id", subscriptionId).limit(1).maybeSingle();
          if (seen) return NextResponse.json({ received: true, already: true });
        }

        // ── Open a build so delivery actually starts ──────────────────────
        // A self-serve subscriber has no build: they never went through the
        // scope flow. Without this they'd be an active paying client with
        // nothing in the pipeline, no intake, and no site ever generated.
        // Guarded on email so a client who DID come through the scope flow
        // (and already has a build) doesn't get a duplicate.
        //
        // THE BUILD CARRIES THE SESSION ID, AND THE CLIENT CARRIES THE BUILD
        // (2026-09-24, Step 6 map). The intake finds its build by
        // checkout_session_id (src/app/api/contact) and this insert wrote none,
        // so no /pricing buyer's answers ever reached their build and the
        // "draft within minutes" email was never kept. And every per-client
        // feature keys on clients.build_id -- the meter, the 80/100% emails,
        // top-ups, the owed domain/mailbox rows on Today, suspension, the
        // overage watch -- so a clients row without it was silent on all of
        // them. The trial path (src/lib/receptionistTrial.ts) always did both.
        const installationCents = Number(session.metadata?.installation_cents ?? 0);
        const installationPaid = Number.isFinite(installationCents) ? installationCents / 100 : 0;
        let buildId: string | null = null;
        let buildOpened = false; // a new build, opened by this event
        let buildReused = false; // a scope-flow client's own build, no client on it yet
        let reusedStatus = "";
        let reusedDeposit = 0;
        if (customerEmail) {
          /* Reuse the newest build under this email that NO client owns yet:
             a scope-flow client arriving to subscribe, at whatever stage her
             site is (she may have done her intake the day she paid). A build
             a client already owns is somebody's site -- a receptionist
             client, a second practice -- and tying this subscription to it
             would meter it, and on a failed card suspend it, for the wrong
             plan. Decided by ownership, never by status: status alone opened
             a second, empty build for a scope client whose site was already
             built. (Reviews of 2db729c, 2026-09-24.) */
          /* Test and live never share a build: a test purchase adopts only a
             test build, and a live one never adopts a test build (is_test is
             not true — every pre-existing row qualifies, as before). */
          const { data: candidates } = await excludeTest(db, (live) => {
            const q = db.from("builds")
              .select("id, status, checkout_session_id, deposit_paid")
              .in("email", Array.from(new Set([customerEmail, customerEmail.toLowerCase()])));
            return (test ? q.eq("is_test", true) : live(q))
              .order("created_at", { ascending: false }).limit(5);
          });
          for (const c of (candidates ?? []) as { id: string; status: string; checkout_session_id: string | null; deposit_paid: number | null }[]) {
            const { data: owner } = await db.from("clients")
              .select("id").eq("build_id", c.id).limit(1).maybeSingle();
            if (owner) continue;
            buildId = c.id;
            buildReused = true;
            reusedStatus = c.status;
            reusedDeposit = Number(c.deposit_paid ?? 0);
            if (!c.checkout_session_id) {
              await db.from("builds").update({ checkout_session_id: session.id }).eq("id", buildId);
            }
            break;
          }
          if (!buildId) {
            const { data: opened, error: buildErr } = await db.from("builds").insert({
              business: "Pending intake",
              // Lowercase, like the clients row: the portal lists builds by the
              // lowercase login cookie, exactly.
              email: customerEmail.toLowerCase(),
              plan: SETUP_PLAN.key,
              plan_name: SETUP_PLAN.name,
              total_price: installationPaid,
              deposit_paid: installationPaid, // column name predates the model change
              balance_due: 0,
              status: "intake",
              customer_id: (session.customer as string) ?? null,
              checkout_session_id: session.id,
              ...testTag(),
            }).select("id").single();
            // A paid client with no build is the failure this branch exists to
            // prevent: answer 500 so Stripe delivers the event again.
            if (buildErr || !opened) {
              console.error("[stripe-webhook] plan build insert failed", buildErr?.message);
              return NextResponse.json({ error: "build not recorded" }, { status: 500 });
            }
            buildId = opened.id as string;
            buildOpened = true;
          }
        }

        const { data: client, error: clientErr } = await db.from("clients").insert({
          build_id: buildId,
          business: customerEmail ?? "Unknown",
          // Lowercase: the portal's login cookie is, and billing matches it exactly.
          email: customerEmail ? customerEmail.toLowerCase() : null,
          plan: plan?.key ?? planLabel.toLowerCase(),
          // The plan's monthly worth, never the checkout total: that carried
          // the EUR 690 installation (or a whole year) into MRR. To the cent:
          // 1490 / 12 is 124.1666..., and the portal printed it whole.
          monthly_amount: plan
            ? Math.round((billing === "annual" ? plan.annualEur / 12 : plan.monthlyEur) * 100) / 100
            : amount,
          status: "active",
          customer_id: (session.customer as string) ?? null,
          subscription_id: subscriptionId,
          ...testTag(),
        }).select("id").single();
        if (clientErr || !client) {
          // Undo our own build so a retry starts clean.
          if (buildOpened && buildId) await db.from("builds").delete().eq("id", buildId);
          /* 23505 = the unique index on clients.subscription_id
             (supabase/2026-09-22-clients-subscription-unique.sql) caught a
             parallel delivery of this same event: it won, and did the rest. */
          if (clientErr?.code === "23505") return NextResponse.json({ received: true, already: true });
          console.error("[stripe-webhook] plan client insert failed", clientErr?.message);
          return NextResponse.json({ error: "client not recorded" }, { status: 500 });
        }

        /* The client may have finished the intake BEFORE this event arrived:
           the form is on the success page and Stripe gives no ordering
           promise. Their answers are on the lead row, keyed by this session
           id -- start the build from them now, or it waits forever. */
        let intakeAlready = false;
        if (buildId && (buildOpened || buildReused)) {
          const { data: early } = await db.from("leads")
            .select("id, business, raw_data")
            .eq("raw_data->>sessionId", session.id)
            .eq("raw_data->>type", "intake")
            .order("created_at", { ascending: false }).limit(1).maybeSingle();
          if (early?.raw_data) {
            intakeAlready = await startBuildFromIntake({
              buildId, leadId: early.id as string, intake: early.raw_data as Record<string, unknown>,
              business: (early.business as string | null) ?? null,
            });
          }
        }

        // Send them to the intake form — the build cannot start without it.
        // Skipped when their answers are already in: the draft email follows.
        if (customerEmail && (buildOpened || (buildReused && reusedStatus === "intake")) && !intakeAlready) {
          // The name on the payment, or a neutral greeting — never the
          // address's local part ("Hi hello," for hello@...).
          const firstName = firstNameFrom(session.customer_details?.name);
          const emailLang = session.metadata?.lang === "fr" ? "fr" : "en";
          const tpl = installationPaidEmail(firstName, planLabel, amount, emailLang, {
            sessionId: session.id, plan: planKey, billing,
          });
          sends.add("welcome email", sendEmail(customerEmail, tpl.subject, tpl.html));
        }

        // A subscriber who started as a lead must leave the pipeline's
        // "waiting" stages the moment they pay — the legacy-build branch
        // already does this; this (the main path) didn't, so paying
        // clients sat in awaiting_response and polluted every funnel number.
        if (customerEmail) {
          const moved = db.from("leads")
            .update({ stage: "deposit_paid" })
            .eq("email", customerEmail)
            .in("stage", ["new", "audit_sent", "qualified"]);
          // A test purchase moves only test leads.
          await (test ? moved.eq("is_test", true) : moved);
        }

        /* The plan checkout charges the installation on every monthly purchase; a
           scope-flow client already paid it on her build. The checkout cannot
           know that, so the founder is told to refund it. */
        if (buildReused && reusedDeposit > 0 && installationPaid > 0) {
          await sendTelegramMessage(
            `INSTALLATION CHARGED TWICE - refund EUR ${installationPaid.toLocaleString()} to ${customerEmail}: their build had EUR ${reusedDeposit.toLocaleString()} already paid.\nhttps://servolia.com/admin/builds/${buildId}`,
            undefined, { plain: true },
          ).catch(() => {});
        }

        // Once per subscription: a replay stopped at the subscription_id check above.
        {
          const billingLabel = session.metadata?.billing === "annual" ? "annual" : "monthly";
          const cur = session.currency ?? "eur";
          sends.owner({
            subject: paidSubject(`${planLabel} plan (${billingLabel})`, amount, cur, customerEmail),
            lines: [
              `🔁 New ${planLabel} subscriber — ${money(amount, cur)} ${billingLabel}`,
              session.customer_details?.name || null,
              customerEmail ?? "no email",
              `Installation collected: ${money(installationPaid, cur)}${billingLabel === "annual" ? " (waived — annual)" : ""}`,
              intakeAlready
                ? "🧱 Build opened — their intake was already in, draft generating"
                : buildOpened ? "🧱 Build opened — waiting on their intake form" : "ℹ️ Existing build found — no new build opened",
              intakeAlready
                ? "Next: review the draft when it lands."
                : customerEmail && (buildOpened || (buildReused && reusedStatus === "intake"))
                  ? "Next: wait for their intake form (the welcome email links it)."
                  : "Next: check their existing build — no intake email was sent for this purchase.",
            ],
            link: `https://servolia.com/admin/clients/${client.id}`,
          });
        }

        sends.add("meta purchase", sendMetaCapiEvent({
          eventName: "Purchase",
          email: customerEmail,
          value: amount,
          currency: "EUR",
          eventSourceUrl: "https://servolia.com/pricing",
        }));

        return NextResponse.json({ received: true });
      }

      // ── TOP-UP branch: a one-off pack of conversations, bought from the portal.
      // Credited to the clients row that carries the buyer's email, as a marker
      // line on notes keyed by this session — a replayed webhook credits nothing
      // twice. Must run before the build-payment logic at the bottom, which has
      // no mode check and would open a build for a €49 pack.
      if (session.mode === "payment" && session.metadata?.kind === "topup") {
        const customerEmail = (session.customer_details?.email ?? session.customer_email ?? session.metadata?.email ?? "").trim();
        const conversations = Number(session.metadata?.conversations ?? 0);
        const pack = TOPUP_PACKS[session.metadata?.pack ?? ""];
        const lang = session.metadata?.lang === "fr" ? "fr" : "en";
        const month = monthKey(new Date(event.created * 1000));
        let credited = false;
        let business = customerEmail;
        if (customerEmail && conversations > 0) {
          // A test pack is credited only to a test client; a paid one never.
          const { data: row } = await excludeTest(db, (live) => {
            const rowQ = db.from("clients").select("id, business, notes")
              .ilike("email", customerEmail).in("status", ["active", "past_due", "paused"]);
            return (test ? rowQ.eq("is_test", true) : live(rowQ))
              .order("created_at", { ascending: false }).limit(1).maybeSingle();
          });
          const c = row as { id: string; business: string; notes: string | null } | null;
          if (c) {
            business = c.business;
            const notes = writeTopup(c.notes, { conversations, month, session: session.id });
            if (notes !== (c.notes ?? "")) {
              const { error } = await db.from("clients").update({ notes }).eq("id", c.id);
              credited = !error;
            } else {
              return NextResponse.json({ received: true, line: "topup", replay: true });
            }
          }
        }
        if (customerEmail && credited) {
          const tpl = topupReceiptEmail({ businessName: business, conversations, priceEur: pack?.priceEur ?? (session.amount_total ?? 0) / 100, month, lang });
          sends.add("top-up receipt", sendEmail(customerEmail, tpl.subject, tpl.html));
        }
        // Once per session: a replay found its marker on the notes and returned above.
        sends.owner({
          subject: paidSubject(`top-up +${conversations} conversations`, (session.amount_total ?? 0) / 100, session.currency ?? "eur", business || customerEmail),
          lines: [
            credited ? `Top-up credited - ${business}` : `TOP-UP PAID BUT NOT CREDITED - ${customerEmail || "no email"}`,
            `+${conversations} conversations for ${month}, EUR ${(session.amount_total ?? 0) / 100}`,
            customerEmail || "no email",
            credited
              ? `Next: nothing — credited and receipted.`
              : `Next: no active clients row carries that email. Credit it by hand on the client's notes: servolia-topup: +${conversations} | month: ${month} | session: ${session.id}`,
          ],
          link: "https://servolia.com/admin/clients",
        });
        return NextResponse.json({ received: true, line: "topup", credited });
      }

      // ── CUSTOM REQUEST branch: a one-off payment for personalized extra work.
      // Must run before the build-payment logic below, or it would be mistaken
      // for the installation payment on the client's original build.
      if (session.metadata?.kind === "custom_request") {
        const requestId = session.metadata?.requestId;
        const amount = (session.amount_total ?? 0) / 100;
        // A test payment marks a request paid only on a TEST build.
        if (requestId && (!test || await isTestRow(db, "builds", session.metadata?.buildId ?? ""))) {
          try {
            await db.from("custom_requests")
              .update({ status: "paid", paid_at: new Date().toISOString() })
              .eq("id", requestId);
          } catch { /* table may not exist yet — never drop the webhook */ }
        }
        sends.owner({
          subject: paidSubject("custom work", amount, session.currency ?? "eur", session.customer_details?.email),
          lines: [
            `🧾 Custom work paid — ${money(amount, session.currency ?? "eur")}`,
            session.customer_details?.email ?? "no email",
            `Next: do the requested work${requestId ? ` (request ${requestId})` : ""}.`,
          ],
          link: session.metadata?.buildId ? `https://servolia.com/admin/builds/${session.metadata.buildId}` : "https://servolia.com/admin/builds",
        });
        return NextResponse.json({ received: true });
      }

      // (Pay-per-booking retired 2026-08-13 by operator decision — one model
      // only: installation paid up front, then the subscription. The old
      // ppb_setup branch, /api/checkout-ppb and the invoicing cron are gone.)

      const sessionId = session.id;
      const customerEmail = session.customer_details?.email ?? session.customer_email ?? null;
      const amountPaid = (session.amount_total ?? 0) / 100;

      // Find the matching build (was created when checkout started)
      let { data: build } = await db
        .from("builds")
        .select("*")
        .eq("checkout_session_id", sessionId)
        .maybeSingle();

      // This is now the NORMAL path, not a fallback: /api/checkout deliberately
      // writes nothing, so the lead and the build are both created here — when
      // money actually moved. Status stays "intake" because paying doesn't mean
      // intake is done; the /onboarding submission flips it to "building".
      if (!build) {
        const planMeta = session.metadata?.plan ?? "unknown";
        const planLabel = BUILD_PLANS[planMeta]?.name ?? planMeta;

        // Link the lead this purchase came from, or create one — a paying
        // customer must exist in the CRM even if they never filled a form.
        // A test purchase never links to (or writes a scope for) a real
        // lead: it always gets its own tagged lead below.
        let leadId = (test ? null : session.metadata?.lead_id) || null;
        if (!leadId) {
          const { data: newLead } = await db.from("leads").insert({
            business: customerEmail ?? `Direct purchase · ${planLabel}`,
            email: customerEmail,
            source: "direct-purchase",
            stage: "deposit_paid",       // they have paid — this is not a guess
            plan_interest: planMeta,
            value_estimate: estimateLeadValue(null, planMeta),
            ...testTag(),
          }).select("id").single();
          leadId = (newLead as { id: string } | null)?.id ?? null;
        }

        const { data: newBuild } = await db.from("builds").insert({
          lead_id: leadId,
          business: customerEmail ?? "Pending intake",
          email: customerEmail,
          plan: planMeta,
          plan_name: planLabel,
          // One-time payments are charged IN FULL (see /api/checkout), so what
          // they paid IS the project price and nothing is outstanding.
          total_price: amountPaid,
          deposit_paid: amountPaid,           // column name predates the model change
          balance_due: 0,
          status: "intake",
          checkout_session_id: sessionId,
          customer_id: (session.customer as string) ?? null,
          ...testTag(),
        }).select("*").single();
        build = newBuild;
      } else {
        /* A build already carrying THIS session id can only be a repeat of
           this event: /api/checkout writes nothing, and only this branch
           stamps checkout_session_id on a build. The old code wrote status
           "intake" over whatever it was -- a live site went back to awaiting
           its intake, the client got a fresh "complete your intake" email,
           and submitting it regenerated her published site as a draft.
           Nothing is written or sent again. (Review round 2, 2026-09-24.) */
        return NextResponse.json({ received: true, already: true });
      }

      // Auto-create a scope acceptance if this build's lead doesn't already have
      // one. Direct /pricing purchases skip the audit funnel entirely, so
      // without this they'd pay having never seen or accepted a written
      // scope -- directly contradicting the pricing page's own promised
      // process ("02. Approve scope" before "03. €690 installation"). This
      // doesn't gate payment (keeps the self-serve path fast); it just makes
      // sure the scope exists and is reachable from the portal right after.
      if (build?.lead_id) {
        const { data: existingScope } = await db.from("scope_acceptances")
          .select("id").eq("lead_id", build.lead_id).maybeSingle();
        const planKey = build.plan as keyof typeof BUILD_PLANS | undefined;
        if (!existingScope && planKey && BUILD_PLANS[planKey]) {
          const businessName = build.business && build.business !== "Pending intake" ? build.business : "Your business";
          const scopeText = generateScopeDocument({ businessName, email: customerEmail, planKey, forWeb: true });
          await db.from("scope_acceptances").insert({
            lead_id: build.lead_id,
            token: randomUUID(),
            business_name: businessName,
            email: customerEmail,
            plan_key: planKey,
            scope_text: scopeText,
          });
        }
      }

      // Send the payment-received email to the client, in the language they
      // bought in (set at checkout — see /api/checkout's metadata.lang).
      if (customerEmail && build) {
        // The name on the payment, or a neutral greeting — never the local part.
        const firstName = firstNameFrom(session.customer_details?.name);
        const emailLang = session.metadata?.lang === "fr" ? "fr" : "en";
        const tpl = installationPaidEmail(firstName, build.plan_name ?? "system", amountPaid, emailLang, { sessionId });
        sends.add("payment email", sendEmail(customerEmail, tpl.subject, tpl.html));
      }

      // Meta Conversions API — real, confirmed revenue (never for a test: metaCapi refuses in test context)
      sends.add("meta purchase", sendMetaCapiEvent({
        eventName: "Purchase",
        email: customerEmail,
        value: amountPaid,
        currency: "EUR",
        eventSourceUrl: "https://servolia.com/pricing",
      }));

      // Tell the owner. Once: a replay found the build by its session id and returned above.
      {
        const planName = build?.plan_name ?? session.metadata?.plan ?? "?";
        sends.owner({
          subject: paidSubject(`${planName} (one-off)`, amountPaid, session.currency ?? "eur", customerEmail),
          lines: [
            `💰 Payment received — ${money(amountPaid, session.currency ?? "eur")}`,
            session.customer_details?.name || null,
            customerEmail ?? "no email",
            `Plan: ${planName}`,
            `Next: wait for their intake form (the payment email links it).`,
          ],
          link: build ? `https://servolia.com/admin/builds/${build.id}` : "https://servolia.com/admin/builds",
        });
      }
    }

    // ── Recurring invoice failed: flag past_due, start grace, notify ──────
    if (event.type === "invoice.payment_failed") {
      const invoice = event.data.object as Stripe.Invoice & { subscription?: string | null };
      const subscriptionId = typeof invoice.subscription === "string" ? invoice.subscription : null;
      const customerId = typeof invoice.customer === "string" ? invoice.customer : null;
      const reason = invoice.last_finalization_error?.message ?? "Card declined or expired";

      const { data: existing } = await db.from("clients").select("id, past_due_since, business, email, plan, build_id")
        .or([subscriptionId ? `subscription_id.eq.${subscriptionId}` : null, customerId ? `customer_id.eq.${customerId}` : null].filter(Boolean).join(","))
        .order("created_at", { ascending: false }).limit(1).maybeSingle();

      if (existing) {
        const now = new Date();
        const pastDueSince = existing.past_due_since ?? now.toISOString();
        const suspendAt = new Date(new Date(pastDueSince).getTime() + GRACE_DAYS * 86400000).toISOString();
        await db.from("clients").update({
          payment_status: "past_due",
          past_due_since: pastDueSince,
          suspend_at: suspendAt,
          last_payment_failure_reason: String(reason).slice(0, 500),
          open_invoice_url: invoice.hosted_invoice_url ?? null,
        }).eq("id", existing.id);

        /* TELL THE CLIENT (Step 6 map, 2026-09-24). An EUR plan client whose
           card failed was never emailed -- only Telegram heard -- and found
           out when something stopped. Same template and the same once-only
           guard as the hosting branch below: `past_due_since` null before the
           update above means this is the FIRST failure; Stripe's retries
           land here again and are silent. No stop date is promised: nothing
           suspends an EUR client automatically today. */
        let emailed: EmailOutcome | "not-this-time" = "not-this-time";
        if (!existing.past_due_since && existing.email && subscriptionId) {
          const plan = resolvePlan(existing.plan as string | null);
          let lang: "en" | "fr" = "fr";
          try {
            const s = await stripe.checkout.sessions.list({ subscription: subscriptionId, limit: 1 });
            const l = s.data[0]?.metadata?.lang;
            if (l === "en" || l === "fr") lang = l;
          } catch { /* French: the market these plans are sold to */ }
          let siteLabel = "";
          if (existing.build_id) {
            const { data: b } = await db.from("builds").select("business").eq("id", existing.build_id).maybeSingle();
            const biz = (b?.business as string | null) ?? "";
            if (biz && biz !== "Pending intake" && !biz.includes("@")) siteLabel = biz;
          }
          const portalUrl = await billingPortalUrl(subscriptionId, { locale: lang, returnUrl: "https://servolia.com/portal", livemode: event.livemode });
          const tpl = paymentFailedEmail({
            productName: `Servolia ${plan ? (lang === "fr" ? plan.nameFr : plan.name) : ""}`.trim(),
            productNoun: lang === "fr" ? "abonnement" : "plan",
            siteLabel,
            portalUrl,
            invoiceUrl: invoice.hosted_invoice_url ?? null,
            graceEndsIso: null,
            attempt: "first",
            lang,
          });
          // Awaited: the alert below states what really happened. sendEmail
          // answers false (never throws) when Resend refuses; a 5 s timeout
          // is "not confirmed", not "failed".
          emailed = emailOutcome(await sends.add("payment failed email", sendEmail(existing.email as string, tpl.subject, tpl.html)));
        }

        {
          const told = clientFailureLine(emailed);
          const planName = resolvePlan(existing.plan as string | null)?.name ?? (existing.plan as string | null) ?? "plan";
          const who = (existing.business as string | null) ?? (existing.email as string | null) ?? "Unknown client";
          sends.owner({
            subject: troubleSubject("Payment failed", `${planName}${invoice.amount_due ? ` — ${money(invoice.amount_due / 100, invoice.currency ?? "eur")}` : ""}`, who),
            lines: [
              `🔴 Payment failed — ${who}`,
              existing.email && existing.email !== who ? String(existing.email) : null,
              `Reason: ${String(reason).slice(0, 200)}`,
              invoice.attempt_count ? `Attempt ${invoice.attempt_count} — Stripe retries on its own schedule.` : null,
              `Grace ends: ${new Date(suspendAt).toLocaleDateString()}`,
              told,
              emailed === "failed" ? "Next: tell the client by hand."
                : emailed === "unconfirmed" ? "Next: check the email went (Resend logs), or tell the client by hand."
                : "Next: watch for the retry; nothing suspends an EUR plan automatically.",
            ],
            link: `https://servolia.com/admin/clients/${existing.id}`,
          });
        }
      }
    }

    // ── Same for a hosting client ────────────────────────────────────────
    // Runs alongside the clients branch above rather than instead of it: a
    // subscription belongs to exactly one of the two tables, so whichever
    // lookup misses simply updates nothing.
    if (event.type === "invoice.payment_failed") {
      const invoice = event.data.object as Stripe.Invoice & { subscription?: string | null };
      const subscriptionId = typeof invoice.subscription === "string" ? invoice.subscription : null;
      const customerId = typeof invoice.customer === "string" ? invoice.customer : null;
      const filter = [
        subscriptionId ? `subscription_id.eq.${subscriptionId}` : null,
        customerId ? `customer_id.eq.${customerId}` : null,
      ].filter(Boolean).join(",");

      if (filter) {
        const { data: host } = await db.from("hosting_clients")
          .select("id, past_due_since, business, repo, branch, site_root, email, plan, subscription_id, payment_status")
          .or(filter).maybeSingle();

        if (host) {
          const now = new Date();
          const pastDueSince = host.past_due_since ?? now.toISOString();
          const suspendAt = new Date(new Date(pastDueSince).getTime() + GRACE_DAYS * 86400000).toISOString();
          await db.from("hosting_clients").update({
            status: "past_due",
            /* Never walk the marker back. Stripe retries a declined card for
               days, and each retry lands here; overwriting `past_due_final`
               with `past_due` would put a client who has already had their
               final notice back into the dunning cron's queue and email them
               the same warning again. */
            ...(host.payment_status === "past_due_final" ? {} : { payment_status: "past_due" }),
            past_due_since: pastDueSince,
            suspend_at: suspendAt,
            open_invoice_url: invoice.hosted_invoice_url ?? null,
          }).eq("id", host.id);

          /* TELL THE CLIENT. Their card was declined and, until this existed,
           * the only people who found out were us. Stripe retries over several
           * days, each retry firing this same event, so the notice is sent
           * ONLY on the first failure — `past_due_since` was null before the
           * update above, and that is the flag. Without the guard a client
           * gets four identical warnings for one expired card, which reads as
           * dunning by machine gun. */
          let hostEmailed: EmailOutcome | "not-this-time" = "not-this-time";
          if (!host.past_due_since && host.email && host.subscription_id) {
            const failedPlan = resolveHostingPlan(host.plan);
            const ctx = await subscriptionContext(host.subscription_id, event.livemode);
            const failLang = ctx?.lang ?? "en";
            const failCopy = failedPlan ? productCopy(failedPlan, failLang) : null;
            const portalUrl = await billingPortalUrl(host.subscription_id, {
              livemode: event.livemode,
              locale: failLang,
              returnUrl: `https://servolia.com/hosting/billing?done=1${failLang === "fr" ? "&lang=fr" : ""}`,
            });
            const tpl = paymentFailedEmail({
              productName: failCopy?.heading ?? "Website hosting",
              productNoun: failCopy?.sentenceName ?? "hosting",
              siteLabel: ctx?.siteLabel || host.business || "",
              portalUrl,
              invoiceUrl: invoice.hosted_invoice_url ?? null,
              graceEndsIso: suspendAt,
              attempt: "first",
              lang: failLang,
            });
            // Awaited: the alert below says what really happened to it.
            hostEmailed = emailOutcome(await sends.add("payment failed email", sendEmail(host.email, tpl.subject, tpl.html)));
          }

          // The site is NOT gated here. Stripe retries a failed card over
          // several days, and cutting a paid-up-until-yesterday client off the
          // moment one retry fails reads as sabotage. The grace deadline is
          // recorded; gating is a separate, later decision.
          sends.owner({
            subject: troubleSubject("Payment failed", `hosting${invoice.amount_due ? ` — ${money(invoice.amount_due / 100, invoice.currency ?? "usd")}` : ""}`, host.business || host.email),
            lines: [
              `🔴 Hosting payment failed — ${host.business}`,
              host.email || null,
              invoice.attempt_count ? `Attempt ${invoice.attempt_count} — Stripe retries on its own schedule.` : null,
              `Grace ends: ${new Date(suspendAt).toLocaleDateString()}`,
              clientFailureLine(hostEmailed,
                host.past_due_since ? "Client already told on the first failure."
                  : !host.email ? "No address on file — the client was NOT told."
                  : "Client NOT told (no subscription on the row for their billing link)."),
              hostEmailed === "failed" || (hostEmailed === "not-this-time" && !host.past_due_since) ? "Next: tell the client by hand."
                : hostEmailed === "unconfirmed" ? "Next: check the email went (Resend logs), or tell the client by hand."
                : "Next: watch for the retry; the site stays up through the grace period.",
            ],
            link: `https://servolia.com/admin/hosting/${host.id}`,
          });
        }
      }
    }

    // ── Invoice paid: clear past_due back to ok, unsuspend if needed ──────
    if (event.type === "invoice.paid" || event.type === "invoice.payment_succeeded") {
      const invoice = event.data.object as Stripe.Invoice & { subscription?: string | null };
      const subscriptionId = typeof invoice.subscription === "string" ? invoice.subscription : null;
      const customerId = typeof invoice.customer === "string" ? invoice.customer : null;
      const filter = [subscriptionId ? `subscription_id.eq.${subscriptionId}` : null, customerId ? `customer_id.eq.${customerId}` : null].filter(Boolean).join(",");
      if (filter) {
        await db.from("clients").update({
          payment_status: "ok",
          past_due_since: null,
          suspend_at: null,
          suspended_at: null,
          last_payment_failure_reason: null,
          open_invoice_url: null,
        }).or(filter);

        /* Hosting equivalent — and the half that makes automatic suspension
         * safe to have at all.
         *
         * This used to clear the STATUS only, which meant a client whose site
         * had been paused stayed paused after paying until somebody noticed.
         * Automating the cut-off without automating the restore would have
         * been strictly worse than leaving both manual: the punishment would
         * run on a schedule and the forgiveness would not.
         *
         * The row is read BEFORE the update, because the update is what
         * destroys the evidence that they were suspended.
         */
        const { data: wasHost } = await db.from("hosting_clients")
          .select("id, business, status, plan, repo, branch, site_root, subscription_id")
          .or(filter).maybeSingle();

        await db.from("hosting_clients").update({
          status: "active",
          payment_status: "ok",
          past_due_since: null,
          suspend_at: null,
          open_invoice_url: null,
        }).or(filter);

        /* Only a hosting TIER has a site gate to lift. A suspended add-on (the
           AI assistant) comes back by itself: its widget reads this row's
           status, which the update above just set to active. Lifting the site
           gate on an add-on payment would switch on a website whose own
           hosting may still be unpaid. */
        const wasTier = HOSTING_TIERS.includes(String(wasHost?.plan ?? "").toLowerCase());
        // Never on a test event: lifting a gate commits to a real client repo.
        if (wasHost?.status === "suspended" && wasHost.subscription_id && wasTier && !test) {
          const ctx = await subscriptionContext(wasHost.subscription_id, event.livemode);
          const ref = clientRefFor(ctx?.ref);
          const outcome = await applyGate(
            {
              repo: ref?.repo ?? wasHost.repo,
              branch: ref?.branch ?? wasHost.branch,
              siteRoot: ref?.siteRoot ?? wasHost.site_root,
              gateWidget: ref?.gateWidget ?? null,
            },
            false,
          );
          /* Never throw from here. Stripe replays any non-2xx and the client
             would be charged again for a payment that already succeeded. A
             failed restore is loud instead, because the client has paid and
             their site is still dark. */
          if (!outcome.ok) {
            console.error("[stripe] restore failed:", wasHost.business, outcome.reason, outcome.detail);
            sends.alert(
              `PAID but NOT restored — ${wasHost.business}\n` +
              `${outcome.reason}${outcome.detail ? ` (${outcome.detail})` : ""}\n` +
              `They have paid and their service is still off. Restore it by hand.`,
            );
          }
        }

        /* THE OWNER IS TOLD OF EVERY RENEWAL (2026-09-25). Only on
           `invoice.paid`: the endpoint also receives invoice.payment_succeeded
           for the same invoice, and answering both would say it twice. Not
           the subscription's FIRST invoice (billing_reason
           subscription_create): its checkout.session.completed already told
           the owner. Not a zero invoice (a trial's opening one). */
        if (event.type === "invoice.paid" && (invoice.amount_paid ?? 0) > 0 && invoice.billing_reason !== "subscription_create") {
          const { data: planClient } = wasHost
            ? { data: null }
            : await db.from("clients").select("id, business, email, plan").or(filter)
                .order("created_at", { ascending: false }).limit(1).maybeSingle();
          const pc = planClient as { id: string; business: string | null; email: string | null; plan: string | null } | null;
          const who = wasHost?.business || pc?.business || invoice.customer_name || invoice.customer_email;
          /* subscription_update is a plan CHANGE (the switch to yearly, a
             tier change, their proration) — not a renewal, and saying
             "renewal" hides that the client's plan just moved. */
          const planChange = invoice.billing_reason === "subscription_update";
          const kind = planChange ? "plan changed" : "renewal";
          const what = wasHost
            ? `${resolveHostingPlan(wasHost.plan as string | null)?.name ?? "hosting"} ${kind}`
            : `${resolvePlan(pc?.plan)?.name ?? "plan"} ${kind}`;
          const line = invoice.lines?.data?.[0]?.description;
          sends.owner({
            subject: paidSubject(what, invoice.amount_paid / 100, invoice.currency ?? "eur", who),
            lines: [
              `${planChange ? "🔀" : "🔁"} ${what} — ${money(invoice.amount_paid / 100, invoice.currency ?? "eur")}`,
              line || null,
              invoice.customer_email || pc?.email || null,
              invoice.billing_reason ? `Stripe: ${invoice.billing_reason}` : null,
              wasHost?.status === "suspended" ? "Was suspended — restored by this payment (see any alert above)." : null,
              planChange
                ? "Next: check their row shows the new plan and billing period."
                : "Next: nothing — renewal collected.",
            ],
            link: wasHost?.id
              ? `https://servolia.com/admin/hosting/${wasHost.id}`
              : pc?.id ? `https://servolia.com/admin/clients/${pc.id}` : "https://servolia.com/admin/clients",
          });
        }
      }
    }

    // ── Subscription cancelled (in Stripe or by the client) ───────────────
    if (event.type === "customer.subscription.deleted") {
      const sub = event.data.object as Stripe.Subscription;
      await db.from("clients").update({
        status: "churned",
        churned_at: new Date().toISOString(),
      }).eq("subscription_id", sub.id);

      // Hosting equivalent. A cancelled hosting subscription is the one case
      // where the site should actually stop being served -- but that is a
      // deliberate action, not an automatic one, so it is only recorded here.
      const { data: churnedHost } = await db.from("hosting_clients")
        .select("id, business, notes").eq("subscription_id", sub.id).maybeSingle();
      await db.from("hosting_clients").update({
        status: "churned",
        churned_at: new Date().toISOString(),
      }).eq("subscription_id", sub.id);

      /* A domain we bought for them stops renewing on our card. It stays
       * theirs until it expires, and a transfer is theirs for the asking;
       * what ends is us paying Vercel every year for a client who left. */
      const churnedDomain = readDomainRecord(churnedHost?.notes);
      if (churnedDomain?.status === "bought" && !test) {
        const res = await setDomainAutoRenew(churnedDomain.domain, false);
        sends.alert(
          `Hosting cancelled - ${churnedHost?.business ?? "client"}\n` +
          `Domain ${churnedDomain.domain}: auto-renew ${res.ok ? "switched OFF" : `NOT switched off (${res.code ?? res.status}) - do it in Vercel > Domains`}. ` +
          `It stays registered until it expires; transfer it to them if they ask.`,
        );
      }

      {
        const { data: client } = await db.from("clients").select("id, business, email").eq("subscription_id", sub.id).maybeSingle();
        const who = client?.business ?? client?.email ?? churnedHost?.business ?? "Unknown client";
        sends.owner({
          subject: troubleSubject("Subscription ended", churnedHost ? "hosting" : "plan", who),
          lines: [
            `⚠️ Subscription cancelled — ${who}`,
            client?.email && client.email !== who ? client.email : null,
            `Stripe subscription ${sub.id}`,
            churnedHost
              ? "Next: decide when the site stops being served — nothing is switched off automatically."
              : "Next: nothing is billed again; reach out if it was not intended.",
          ],
          link: churnedHost
            ? `https://servolia.com/admin/hosting/${churnedHost.id}`
            : client?.id ? `https://servolia.com/admin/clients/${client.id}` : "https://servolia.com/admin/clients",
        });
      }
    }
  } catch (err) {
    console.error("Webhook handler error:", err);
  }

  return NextResponse.json({ received: true });
}
