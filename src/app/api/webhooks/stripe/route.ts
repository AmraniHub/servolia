import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import Stripe from "stripe";
import { supabaseAdmin, estimateLeadValue } from "@/lib/supabase";
import {
  sendEmail,
  installationPaidEmail,
  clientServicePaidEmail,
  balanceSettledEmail,
} from "@/lib/email";
import { sendMetaCapiEvent } from "@/lib/metaCapi";
import { generateScopeDocument } from "@/lib/scopeDocument";
import { BUILD_PLANS, SETUP_PLAN, resolvePlan } from "@/lib/pricing";
import {
  HOSTING_METADATA_KIND,
  resolveHostingPlan,
  nextChargeDate,
  productCopy,
} from "@/lib/hosting";
import { setShopifyGate } from "@/lib/hostingGate";
import { upgradeLinkFor } from "@/lib/upgrade";
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
        const amount = (session.amount_total ?? 0) / 100;
        const period = session.metadata?.period === "annual" ? "annual" : "monthly";
        // An annual charge is a year of the monthly rate; store the monthly
        // figure either way so the column means one thing.
        const monthlyUsd = period === "annual" ? amount / 12 : amount;

        const { error: hostErr } = await db.from("hosting_clients").insert({
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
        });
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
            console.error("[stripe] chatbot restore failed:", e?.message);
            return false;
          });
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
          const tpl = clientServicePaidEmail({
            productName: copy?.heading ?? "Website hosting",
            productNoun: copy?.sentenceName ?? "hosting",
            siteLabel: session.metadata?.business || session.metadata?.ref || "",
            amountUsd: amount,
            period,
            nextChargeIso: nextChargeDate(new Date(event.created * 1000), period).toISOString(),
            monthlyUsd: product?.monthlyUsd,
            restored,
            includes: copy?.includes ?? [],
            lang: emailLang,
            upgradeUrl,
          });
          sendEmail(customerEmail, tpl.subject, tpl.html).catch(() => {});
        }

        /* And tell the operator. Every other branch here notifies Telegram;
         * this one did not, so a hosting client could pay and nobody would
         * know until the Stripe balance was next opened. */
        const hostTgToken = process.env.TELEGRAM_BOT_TOKEN;
        const hostTgChatId = process.env.TELEGRAM_CHAT_ID;
        if (hostTgToken && hostTgChatId && !alreadySeen) {
          const msg = `🌐 *${product?.name ?? "Hosting"} paid — $${amount} ${period}*\n` +
                      `${session.metadata?.business || session.metadata?.ref || "unnamed site"}\n` +
                      `${customerEmail ?? "no email"}\n` +
                      (restored ? `♻️ ${session.metadata?.gate_widget} switched back on\n` : "") +
                      `\n[Open](https://servolia.com/admin/hosting)`;
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
          .select("id, past_due_since, business, repo, branch, site_root")
          .or(filter).maybeSingle();

        if (host) {
          const now = new Date();
          const pastDueSince = host.past_due_since ?? now.toISOString();
          const suspendAt = new Date(new Date(pastDueSince).getTime() + GRACE_DAYS * 86400000).toISOString();
          await db.from("hosting_clients").update({
            status: "past_due",
            payment_status: "past_due",
            past_due_since: pastDueSince,
            suspend_at: suspendAt,
            open_invoice_url: invoice.hosted_invoice_url ?? null,
          }).eq("id", host.id);

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

        // Hosting equivalent. Restores status to active so a client who was
        // suspended for non-payment comes back on the next successful charge.
        await db.from("hosting_clients").update({
          status: "active",
          payment_status: "ok",
          past_due_since: null,
          suspend_at: null,
          open_invoice_url: null,
        }).or(filter);
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
      await db.from("hosting_clients").update({
        status: "churned",
        churned_at: new Date().toISOString(),
      }).eq("subscription_id", sub.id);

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
