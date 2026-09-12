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
  resolveHostingPlan,
  hostingAmountCents,
  nextChargeDate,
  productCopy,
} from "@/lib/hosting";
import { setShopifyGate, applyGate } from "@/lib/hostingGate";
import { normalizeDomain, purchaseDomainForClient, readDomainRecord, writeDomainRecord, setDomainAutoRenew } from "@/lib/domainSales";
import { upgradeLinkFor, accountLinkFor, setupLinkFor, referenceFor, subscriptionContext } from "@/lib/upgrade";
import { clientRefFor } from "@/lib/clientRefs";
import { billingPortalUrl } from "@/lib/clientPortal";
import { sendTelegramMessage } from "@/lib/telegram";
import { provisionAddon } from "@/lib/provisioning";

export const runtime = "nodejs";

/**
 * Stripe webhook: auto-updates builds when payments clear.
 *
 * Setup:
 *   1. dashboard.stripe.com → Developers → Webhooks → Add endpoint
 *   2. URL: https://servolia.com/api/webhooks/stripe
 *   3. Events: checkout.session.completed, customer.subscription.deleted,
 *              invoice.payment_failed, invoice.paid, invoice.payment_succeeded
 *   4. Copy "Signing secret" → STRIPE_WEBHOOK_SECRET env var
 */

const GRACE_DAYS = 14; // Vercel-style: banner immediately, hard suspend after this many days.

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
  try {
    const body = await req.text();
    event = stripe.webhooks.constructEvent(body, sig, whSecret);
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
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
  if (!event.livemode) {
    console.info(`[stripe] test-mode ${event.type} acknowledged — no CRM rows written`);
    return NextResponse.json({ received: true, testMode: true, skipped: "crm-writes" });
  }

  const db = supabaseAdmin();
  if (!db) return NextResponse.json({ received: true });

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
        const planUsd = paidPlan ? hostingAmountCents(paidPlan, period) / 100 : amount;
        const monthlyUsd = period === "annual" ? planUsd / 12 : planUsd;

        const { data: hostRow, error: hostErr } = await db.from("hosting_clients").insert({
          business: session.metadata?.business || customerEmail || "Unknown",
          contact_name: session.metadata?.contact_name || null,
          email: customerEmail,
          site_url: session.metadata?.site_url || null,
          repo: session.metadata?.repo || null,
          branch: session.metadata?.branch || "main",
          site_root: session.metadata?.site_root || null,
          vercel_project: session.metadata?.vercel_project || null,
          plan: session.metadata?.plan || "hosting",
          monthly_usd: monthlyUsd,
          billing_period: period,
          status: "active",
          customer_id: (session.customer as string) ?? null,
          subscription_id: (session.subscription as string) ?? null,
        }).select("id").maybeSingle();
        // A duplicate is the unique index doing its job on a Stripe retry, not
        // a failure — Stripe replays any non-2xx, so never 500 on it.
        const alreadySeen = Boolean(hostErr && /duplicate|unique/i.test(hostErr.message));
        if (hostErr && !alreadySeen) {
          console.error("[stripe] hosting_clients insert failed:", hostErr.message);
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
        if (session.metadata?.gate_widget && session.metadata?.repo) {
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
            sendTelegramMessage(
              `*PAID but NOT restored — ${session.metadata?.business || session.metadata?.ref || "a client"}*\n` +
              `${e?.message ?? "unknown error"}\n` +
              `They have paid and the service is still off. Restore it by hand.`,
            ).catch(() => {});
            return false;
          });
        }

        /* SWITCH ON A WHOLE SITE ON ITS FIRST PAYMENT.
         *
         * The block above restores a Shopify add-on. This is the Vercel gate,
         * and it is also how a site is brought online in the first place: a
         * client moving to a new domain sits behind the neutral notice until
         * hosting is paid for, and the payment is what lifts it. Same
         * promise as the add-on -- "live the moment payment clears" -- so it
         * is awaited and loud on failure for the same reasons. A site that
         * was never gated comes back changed=false and is left alone. */
        let activated = false;
        const hostRef = clientRefFor(session.metadata?.ref ?? "");
        if (hostRef?.repo && !hostRef.gateWidget && !alreadySeen) {
          const outcome = await applyGate(
            { repo: hostRef.repo, branch: hostRef.branch, siteRoot: hostRef.siteRoot ?? null, gateWidget: null },
            false,
          );
          if (outcome.ok) {
            activated = outcome.changed;
          } else if (outcome.reason !== "no-repo") {
            console.error("[stripe] activation failed:", outcome.reason, outcome.detail);
            sendTelegramMessage(
              `*PAID but NOT switched on — ${session.metadata?.business || session.metadata?.ref || "a client"}*\n` +
              `${outcome.reason}${outcome.detail ? ` (${outcome.detail})` : ""}\n` +
              `They have paid and their site is still behind the notice. Lift it by hand.`,
            ).catch(() => {});
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
         * not be a guess. */
        const domainWanted = normalizeDomain(session.metadata?.domain ?? "");
        let domainBought = false;
        if (domainWanted && !alreadySeen) {
          const retail = Number(session.metadata?.domain_retail_usd ?? 0);
          const outcome = await purchaseDomainForClient(domainWanted, retail);
          domainBought = outcome.ok;
          if (hostRow?.id) {
            await db.from("hosting_clients").update({
              site_url: `https://${domainWanted}`,
              notes: writeDomainRecord(null, {
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
              }),
            }).eq("id", hostRow.id);
          }
          if (!outcome.ok) {
            console.error("[stripe] domain purchase failed:", domainWanted, outcome.reason, outcome.detail);
            sendTelegramMessage(
              [
                `DOMAIN NOT BOUGHT - ${domainWanted}`,
                `Client paid for it: ${session.metadata?.business || customerEmail || "unknown"}`,
                `Reason: ${outcome.reason}${outcome.detail ? ` (${outcome.detail})` : ""}`,
                outcome.reason === "no-contact" || outcome.reason === "not-configured"
                  ? `Set VERCEL_TOKEN, VERCEL_TEAM_ID and DOMAIN_CONTACT_JSON, then press Buy on the client's page.`
                  : `Press Buy on the client's page, or buy it by hand.`,
                hostRow?.id ? `https://servolia.com/admin/hosting/${hostRow.id}` : `https://servolia.com/admin/hosting`,
              ].join("\n"),
              undefined,
              { plain: true },
            ).catch(() => {});
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
         * Guarded on `alreadySeen` so a replayed webhook cannot email them a
         * second time: the unique index on subscription_id is the idempotency
         * key, reused rather than reinvented. A non-duplicate insert error
         * still sends — they paid, so they get their confirmation even if our
         * bookkeeping had a bad moment. */
        const product = resolveHostingPlan(session.metadata?.plan);
        // Set at checkout from the client record, so the confirmation matches
        // the language they bought in rather than the language we default to.
        const emailLang = session.metadata?.lang === "fr" ? "fr" : "en";
        if (customerEmail && !alreadySeen) {
          const copy = product ? productCopy(product, emailLang) : null;
          /* The switch-to-yearly offer, minted only when the year is actually
             cheaper than twelve months. Never for an annual buyer, who has
             nothing to upgrade to. Failing to mint must not cost them their
             receipt, so it degrades to no offer rather than no email. */
          let upgradeUrl: string | null = null;
          const subId = typeof session.subscription === "string" ? session.subscription : null;
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
          /* The handover step, only for a buyer we do not already host. A
             known ref means the site is already in our hands; asking them
             where it lives would read as if we had lost it. */
          let setupUrl: string | null = null;
          if (subId && !clientRefFor(session.metadata?.ref ?? "")) {
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
          });
          sendEmail(customerEmail, tpl.subject, tpl.html).catch(() => {});
        }

        /* And tell the operator. Every other branch here notifies Telegram;
         * this one did not, so a hosting client could pay and nobody would
         * know until the Stripe balance was next opened. */
        const hostTgToken = process.env.TELEGRAM_BOT_TOKEN;
        const hostTgChatId = process.env.TELEGRAM_CHAT_ID;
        if (hostTgToken && hostTgChatId && !alreadySeen) {
          /* The reference is what the client will quote, so it is what the
             operator needs in hand. A self-serve buyer is not hosted yet —
             say so here, at the moment the money lands, rather than leaving
             it to be discovered on the list page. */
          const subIdForRef = typeof session.subscription === "string" ? session.subscription : null;
          const selfServe = !clientRefFor(session.metadata?.ref ?? "");
          const adminUrl = hostRow?.id
            ? `https://servolia.com/admin/hosting/${hostRow.id}`
            : "https://servolia.com/admin/hosting";
          const msg = `🌐 *${product?.name ?? "Hosting"} paid — $${amount} ${period}*\n` +
                      `${session.metadata?.business || session.metadata?.ref || "unnamed site"}\n` +
                      `${customerEmail ?? "no email"}\n` +
                      (subIdForRef ? `Ref ${referenceFor(subIdForRef)}\n` : "") +
                      (restored ? `♻️ ${session.metadata?.gate_widget} switched back on\n` : "") +
                      (activated ? `🟢 Site switched on — the notice is lifted\n` : "") +
                      (domainWanted ? `🌐 Domain ${domainWanted}: ${domainBought ? "bought on Vercel" : "NOT bought — see the alert"}\n` : "") +
                      (selfServe ? `⚠️ NEEDS SETUP — not hosted yet. Their handover arrives as a separate alert.\n` : "") +
                      `\n[Open](${adminUrl})`;
          fetch(`https://api.telegram.org/bot${hostTgToken}/sendMessage`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: hostTgChatId, text: msg, parse_mode: "Markdown" }),
          }).catch(() => {});
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
          sendEmail(customerEmail, tpl.subject, tpl.html).catch(() => {});
        }

        const tgToken = process.env.TELEGRAM_BOT_TOKEN;
        const tgChatId = process.env.TELEGRAM_CHAT_ID;
        if (tgToken && tgChatId) {
          const msg = `💵 *Arrears settled — $${amount}*\n${siteLabel || "unnamed site"}\n${customerEmail ?? "no email"}`;
          fetch(`https://api.telegram.org/bot${tgToken}/sendMessage`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: tgChatId, text: msg, parse_mode: "Markdown" }),
          }).catch(() => {});
        }

        return NextResponse.json({ received: true, line: "arrears" });
      }

      // ── MONTHLY PLAN branch: recurring subscription, not the installation ──
      if (session.mode === "subscription") {
        const customerEmail = session.customer_details?.email ?? session.customer_email ?? null;
        const amount = (session.amount_total ?? 0) / 100;
        const planKey = session.metadata?.plan ?? "essentiel";
        // resolvePlan also maps the retired care/care_growth/care_scale keys.
        const planLabel = resolvePlan(planKey)?.name ?? "Essentiel";

        const { data: client } = await db.from("clients").insert({
          business: customerEmail ?? "Unknown",
          email: customerEmail,
          plan: planLabel.toLowerCase(),
          monthly_amount: amount,
          status: "active",
          customer_id: (session.customer as string) ?? null,
          subscription_id: (session.subscription as string) ?? null,
        }).select("id").single();

        // ── Open a build so delivery actually starts ──────────────────────
        // A self-serve subscriber has no build: they never went through the
        // scope flow. Without this they'd be an active paying client with
        // nothing in the pipeline, no intake, and no site ever generated.
        // Guarded on email so a client who DID come through the scope flow
        // (and already has a build) doesn't get a duplicate.
        const installationCents = Number(session.metadata?.installation_cents ?? 0);
        const installationPaid = Number.isFinite(installationCents) ? installationCents / 100 : 0;
        let buildOpened = false;
        if (customerEmail) {
          const { data: existingBuild } = await db.from("builds")
            .select("id").eq("email", customerEmail).maybeSingle();
          if (!existingBuild) {
            const { error: buildErr } = await db.from("builds").insert({
              business: "Pending intake",
              email: customerEmail,
              plan: SETUP_PLAN.key,
              plan_name: SETUP_PLAN.name,
              total_price: installationPaid,
              deposit_paid: installationPaid, // column name predates the model change
              balance_due: 0,
              status: "intake",
              customer_id: (session.customer as string) ?? null,
            });
            buildOpened = !buildErr;
          }
        }

        // Send them to the intake form — the build cannot start without it.
        if (customerEmail && buildOpened) {
          const firstName = customerEmail.split("@")[0];
          const emailLang = session.metadata?.lang === "fr" ? "fr" : "en";
          const tpl = installationPaidEmail(firstName, planLabel, installationPaid, emailLang);
          sendEmail(customerEmail, tpl.subject, tpl.html).catch(() => {});
        }

        // A subscriber who started as a lead must leave the pipeline's
        // "waiting" stages the moment they pay — the legacy-build branch
        // already does this; this (the main path) didn't, so paying
        // clients sat in awaiting_response and polluted every funnel number.
        if (customerEmail) {
          await db.from("leads")
            .update({ stage: "deposit_paid" })
            .eq("email", customerEmail)
            .in("stage", ["new", "audit_sent", "qualified"]);
        }

        const tgToken = process.env.TELEGRAM_BOT_TOKEN;
        const tgChatId = process.env.TELEGRAM_CHAT_ID;
        if (tgToken && tgChatId) {
          const billingLabel = session.metadata?.billing === "annual" ? "annual" : "monthly";
          const msg = `🔁 *New ${planLabel} subscriber — €${amount} ${billingLabel}*\n${customerEmail ?? "no email"}\n` +
                      `Installation collected: €${installationPaid.toLocaleString()}${billingLabel === "annual" ? " (waived — annual)" : ""}\n` +
                      (buildOpened ? "🧱 Build opened — waiting on their intake form\n" : "ℹ️ Existing build found — no new build opened\n") +
                      (client ? `\n[Open in CRM](https://servolia.com/admin/clients/${client.id})` : "");
          fetch(`https://api.telegram.org/bot${tgToken}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: tgChatId, text: msg, parse_mode: "Markdown" }),
          }).catch(() => {});
        }

        sendMetaCapiEvent({
          eventName: "Purchase",
          email: customerEmail,
          value: amount,
          currency: "EUR",
          eventSourceUrl: "https://servolia.com/pricing",
        });

        return NextResponse.json({ received: true });
      }

      // ── CUSTOM REQUEST branch: a one-off payment for personalized extra work.
      // Must run before the build-payment logic below, or it would be mistaken
      // for the installation payment on the client's original build.
      if (session.metadata?.kind === "custom_request") {
        const requestId = session.metadata?.requestId;
        const amount = (session.amount_total ?? 0) / 100;
        if (requestId) {
          try {
            await db.from("custom_requests")
              .update({ status: "paid", paid_at: new Date().toISOString() })
              .eq("id", requestId);
          } catch { /* table may not exist yet — never drop the webhook */ }
        }
        const tgToken = process.env.TELEGRAM_BOT_TOKEN;
        const tgChatId = process.env.TELEGRAM_CHAT_ID;
        if (tgToken && tgChatId) {
          const msg = `🧾 *Custom work paid — €${amount}*\n${session.customer_details?.email ?? "no email"}` +
            (session.metadata?.buildId ? `\n\n[Open build](https://servolia.com/admin/builds/${session.metadata.buildId})` : "");
          fetch(`https://api.telegram.org/bot${tgToken}/sendMessage`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: tgChatId, text: msg, parse_mode: "Markdown" }),
          }).catch(() => {});
        }
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
        let leadId = session.metadata?.lead_id || null;
        if (!leadId) {
          const { data: newLead } = await db.from("leads").insert({
            business: customerEmail ?? `Direct purchase · ${planLabel}`,
            email: customerEmail,
            source: "direct-purchase",
            stage: "deposit_paid",       // they have paid — this is not a guess
            plan_interest: planMeta,
            value_estimate: estimateLeadValue(null, planMeta),
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
        }).select("*").single();
        build = newBuild;
      } else {
        await db.from("builds").update({
          deposit_paid: amountPaid,
          status: "intake",
          email: customerEmail ?? build.email,
          customer_id: (session.customer as string) ?? null,
        }).eq("id", build.id);

        if (build.lead_id) {
          await db.from("leads").update({
            stage: "deposit_paid",
            email: customerEmail ?? undefined,
          }).eq("id", build.lead_id);
          await db.from("lead_activities").insert({
            lead_id: build.lead_id,
            type: "payment",
            description: `Installation paid — €${amountPaid.toLocaleString()} via Stripe`,
          });
        }
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
        const firstName = customerEmail.split("@")[0];
        const emailLang = session.metadata?.lang === "fr" ? "fr" : "en";
        const tpl = installationPaidEmail(firstName, build.plan_name ?? "system", amountPaid, emailLang);
        sendEmail(customerEmail, tpl.subject, tpl.html).catch(() => {});
      }

      // Meta Conversions API — real, confirmed revenue (fire and forget)
      sendMetaCapiEvent({
        eventName: "Purchase",
        email: customerEmail,
        value: amountPaid,
        currency: "EUR",
        eventSourceUrl: "https://servolia.com/pricing",
      });

      // Notify Telegram
      const tgToken = process.env.TELEGRAM_BOT_TOKEN;
      const tgChatId = process.env.TELEGRAM_CHAT_ID;
      if (tgToken && tgChatId) {
        const msg = `💰 *Payment received — €${amountPaid}*\n` +
                    `${customerEmail ?? "no email"}\n` +
                    `Plan: ${build?.plan_name ?? session.metadata?.plan ?? "?"}\n\n` +
                    (build ? `[Open build in CRM](https://servolia.com/admin/builds/${build.id})` : "");
        fetch(`https://api.telegram.org/bot${tgToken}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: tgChatId, text: msg, parse_mode: "Markdown" }),
        }).catch(() => {});
      }
    }

    // ── Recurring invoice failed: flag past_due, start grace, notify ──────
    if (event.type === "invoice.payment_failed") {
      const invoice = event.data.object as Stripe.Invoice & { subscription?: string | null };
      const subscriptionId = typeof invoice.subscription === "string" ? invoice.subscription : null;
      const customerId = typeof invoice.customer === "string" ? invoice.customer : null;
      const reason = invoice.last_finalization_error?.message ?? "Card declined or expired";

      const { data: existing } = await db.from("clients").select("id, past_due_since, business, email")
        .or([subscriptionId ? `subscription_id.eq.${subscriptionId}` : null, customerId ? `customer_id.eq.${customerId}` : null].filter(Boolean).join(","))
        .maybeSingle();

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

        const tgToken = process.env.TELEGRAM_BOT_TOKEN;
        const tgChatId = process.env.TELEGRAM_CHAT_ID;
        if (tgToken && tgChatId) {
          const msg = `🔴 *Payment failed*\n${existing.business ?? existing.email ?? "Unknown client"}\nGrace ends: ${new Date(suspendAt).toLocaleDateString()}\n\n[Open in CRM](https://servolia.com/admin/clients)`;
          fetch(`https://api.telegram.org/bot${tgToken}/sendMessage`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: tgChatId, text: msg, parse_mode: "Markdown" }),
          }).catch(() => {});
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
          if (!host.past_due_since && host.email && host.subscription_id) {
            const failedPlan = resolveHostingPlan(host.plan);
            const ctx = await subscriptionContext(host.subscription_id);
            const failLang = ctx?.lang ?? "en";
            const failCopy = failedPlan ? productCopy(failedPlan, failLang) : null;
            const portalUrl = await billingPortalUrl(host.subscription_id, {
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
            sendEmail(host.email, tpl.subject, tpl.html).catch(() => {});
          }

          // The site is NOT gated here. Stripe retries a failed card over
          // several days, and cutting a paid-up-until-yesterday client off the
          // moment one retry fails reads as sabotage. The grace deadline is
          // recorded; gating is a separate, later decision.
          const tgToken = process.env.TELEGRAM_BOT_TOKEN;
          const tgChatId = process.env.TELEGRAM_CHAT_ID;
          if (tgToken && tgChatId) {
            const msg = `🔴 *Hosting payment failed*\n${host.business}\nGrace ends: ${new Date(suspendAt).toLocaleDateString()}\n\n[Open](https://servolia.com/admin/hosting)`;
            fetch(`https://api.telegram.org/bot${tgToken}/sendMessage`, {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ chat_id: tgChatId, text: msg, parse_mode: "Markdown" }),
            }).catch(() => {});
          }
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
          .select("id, business, status, repo, branch, site_root, subscription_id")
          .or(filter).maybeSingle();

        await db.from("hosting_clients").update({
          status: "active",
          payment_status: "ok",
          past_due_since: null,
          suspend_at: null,
          open_invoice_url: null,
        }).or(filter);

        if (wasHost?.status === "suspended" && wasHost.subscription_id) {
          const ctx = await subscriptionContext(wasHost.subscription_id);
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
            sendTelegramMessage(
              `*PAID but NOT restored — ${wasHost.business}*\n` +
              `${outcome.reason}${outcome.detail ? ` (${outcome.detail})` : ""}\n` +
              `They have paid and their service is still off. Restore it by hand.`,
            ).catch(() => {});
          }
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
      if (churnedDomain?.status === "bought") {
        const res = await setDomainAutoRenew(churnedDomain.domain, false);
        sendTelegramMessage(
          `Hosting cancelled - ${churnedHost?.business ?? "client"}\n` +
          `Domain ${churnedDomain.domain}: auto-renew ${res.ok ? "switched OFF" : `NOT switched off (${res.code ?? res.status}) - do it in Vercel > Domains`}. ` +
          `It stays registered until it expires; transfer it to them if they ask.`,
          undefined,
          { plain: true },
        ).catch(() => {});
      }

      const tgToken = process.env.TELEGRAM_BOT_TOKEN;
      const tgChatId = process.env.TELEGRAM_CHAT_ID;
      if (tgToken && tgChatId) {
        const { data: client } = await db.from("clients").select("business, email").eq("subscription_id", sub.id).maybeSingle();
        const msg = `⚠️ *Subscription cancelled*\n${client?.business ?? client?.email ?? "Unknown client"}`;
        fetch(`https://api.telegram.org/bot${tgToken}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: tgChatId, text: msg, parse_mode: "Markdown" }),
        }).catch(() => {});
      }
    }
  } catch (err) {
    console.error("Webhook handler error:", err);
  }

  return NextResponse.json({ received: true });
}
