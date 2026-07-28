import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import Stripe from "stripe";
import { supabaseAdmin } from "@/lib/supabase";
import { sendEmail, installationPaidEmail } from "@/lib/email";
import { sendMetaCapiEvent } from "@/lib/metaCapi";
import { generateScopeDocument } from "@/lib/scopeDocument";
import { BUILD_PLANS, resolvePlan } from "@/lib/pricing";
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

        const tgToken = process.env.TELEGRAM_BOT_TOKEN;
        const tgChatId = process.env.TELEGRAM_CHAT_ID;
        if (tgToken && tgChatId) {
          const msg = `🔁 *New ${planLabel} plan subscriber — €${amount}/mo*\n${customerEmail ?? "no email"}\n\n` +
                      (client ? `[Open in CRM](https://servolia.com/admin/clients/${client.id})` : "");
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

      // ── PAY-PER-BOOKING branch: setup fee paid in full → active per-booking
      // client. The monthly-invoice cron bills attended bookings from here on.
      if (session.metadata?.kind === "ppb_setup") {
        const customerEmail = session.customer_details?.email ?? session.customer_email ?? null;
        const amount = (session.amount_total ?? 0) / 100;
        const rate = Number(session.metadata?.per_booking_rate) || 60;

        const { data: ppbBuild } = await db.from("builds")
          .select("id, lead_id").eq("checkout_session_id", session.id).maybeSingle();
        if (ppbBuild) {
          await db.from("builds").update({
            deposit_paid: amount,
            balance_due: 0,
            email: customerEmail,
            customer_id: (session.customer as string) ?? null,
          }).eq("id", ppbBuild.id);
          if (ppbBuild.lead_id) {
            await db.from("leads").update({ stage: "deposit_paid", email: customerEmail ?? undefined }).eq("id", ppbBuild.lead_id);
            await db.from("lead_activities").insert({
              lead_id: ppbBuild.lead_id, type: "payment",
              description: `Pay-per-booking setup paid — €${amount.toLocaleString()} (then €${rate}/attended booking)`,
            });
          }
        }

        await db.from("clients").insert({
          build_id: ppbBuild?.id ?? null,
          business: customerEmail ?? "Unknown",
          email: customerEmail,
          plan: "pay_per_booking",
          monthly_amount: 0,
          billing_mode: "per_booking",
          per_booking_rate_eur: rate,
          status: "active",
          customer_id: (session.customer as string) ?? null,
        });

        const tgToken = process.env.TELEGRAM_BOT_TOKEN;
        const tgChatId = process.env.TELEGRAM_CHAT_ID;
        if (tgToken && tgChatId) {
          const msg = `🎯 *Pay-per-booking setup paid — €${amount}*\n${customerEmail ?? "no email"}\nRate: €${rate}/attended booking` +
                      (ppbBuild ? `\n\n[Open build](https://servolia.com/admin/builds/${ppbBuild.id})` : "");
          fetch(`https://api.telegram.org/bot${tgToken}/sendMessage`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: tgChatId, text: msg, parse_mode: "Markdown" }),
          }).catch(() => {});
        }

        sendMetaCapiEvent({
          eventName: "Purchase", email: customerEmail, value: amount, currency: "EUR",
          eventSourceUrl: "https://servolia.com/pricing",
        });

        if (customerEmail) {
          const firstName = customerEmail.split("@")[0];
          const emailLang = session.metadata?.lang === "fr" ? "fr" : "en";
          const tpl = installationPaidEmail(firstName, "Pay-per-booking", amount, emailLang);
          sendEmail(customerEmail, tpl.subject, tpl.html).catch(() => {});
        }
        return NextResponse.json({ received: true });
      }

      const sessionId = session.id;
      const customerEmail = session.customer_details?.email ?? session.customer_email ?? null;
      const amountPaid = (session.amount_total ?? 0) / 100;

      // Find the matching build (was created when checkout started)
      let { data: build } = await db
        .from("builds")
        .select("*")
        .eq("checkout_session_id", sessionId)
        .maybeSingle();

      // Resilience: if the pre-checkout build creation failed for some reason,
      // create the build now so the payment is never lost from the CRM.
      // Status stays "intake" here — paying doesn't mean intake is done. The
      // /onboarding submission (see src/app/api/contact/route.ts, type "intake")
      // is what flips this to "building", once we actually have their answers.
      if (!build) {
        const planMeta = session.metadata?.plan ?? "unknown";
        const { data: newBuild } = await db.from("builds").insert({
          business: customerEmail ?? "Unknown",
          email: customerEmail,
          plan: planMeta,
          plan_name: planMeta,
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
      // process ("02. Approve scope" before "03. €490 installation"). This
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
      }

      // Settle the pay-per-booking ledger row this Stripe invoice belongs to,
      // if any (table may not exist until the founder runs the schema block).
      try {
        await db.from("pay_per_booking_invoices")
          .update({ status: "paid" })
          .eq("stripe_invoice_id", invoice.id);
      } catch { /* ledger table not created yet — never drop the webhook */ }
    }

    // ── Subscription cancelled (in Stripe or by the client) ───────────────
    if (event.type === "customer.subscription.deleted") {
      const sub = event.data.object as Stripe.Subscription;
      await db.from("clients").update({
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
