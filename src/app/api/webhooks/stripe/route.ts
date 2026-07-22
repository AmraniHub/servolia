import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import Stripe from "stripe";
import { supabaseAdmin } from "@/lib/supabase";
import { sendEmail, depositReceivedEmail } from "@/lib/email";
import { sendMetaCapiEvent } from "@/lib/metaCapi";
import { generateScopeDocument } from "@/lib/scopeDocument";
import { BUILD_PLANS } from "@/lib/pricing";
import { provisionAddon } from "@/lib/provisioning";

export const runtime = "nodejs";

/**
 * Stripe webhook: auto-updates builds when payments clear.
 *
 * Setup:
 *   1. dashboard.stripe.com → Developers → Webhooks → Add endpoint
 *   2. URL: https://servolia.com/api/webhooks/stripe
 *   3. Events: checkout.session.completed, customer.subscription.deleted
 *   4. Copy "Signing secret" → STRIPE_WEBHOOK_SECRET env var
 */

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

      // ── CARE PLAN branch: recurring subscription, not a one-time deposit ──
      if (session.mode === "subscription") {
        const customerEmail = session.customer_details?.email ?? session.customer_email ?? null;
        const amount = (session.amount_total ?? 0) / 100;
        const planKey = session.metadata?.plan ?? "care";
        const planLabel = planKey === "care_growth" ? "Growth" : planKey === "care_scale" ? "Scale" : "Care";

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
      // Must run before the build-deposit logic below, or it would be mistaken
      // for a deposit on the client's original build.
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
          total_price: amountPaid * 2,        // assume 50% deposit
          deposit_paid: amountPaid,
          balance_due: amountPaid,
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
            description: `Deposit received — €${amountPaid.toLocaleString()} via Stripe`,
          });
        }
      }

      // Auto-create a scope acceptance if this build's lead doesn't already have
      // one. Direct /pricing purchases skip the audit funnel entirely, so
      // without this they'd pay a deposit having never seen or accepted a
      // written scope -- directly contradicting the pricing page's own
      // promised process ("02. Approve scope" before "03. 50% deposit"). This
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

      // Send deposit received email to client
      if (customerEmail && build) {
        const firstName = customerEmail.split("@")[0];
        const tpl = depositReceivedEmail(firstName, build.plan_name ?? "system", amountPaid);
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
        const msg = `💰 *Deposit received — €${amountPaid}*\n` +
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

    // ── Care plan cancelled (in Stripe or by the client) ──────────────────
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
        const msg = `⚠️ *Care plan cancelled*\n${client?.business ?? client?.email ?? "Unknown client"}`;
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
