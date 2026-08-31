import { NextResponse } from "next/server";
import Stripe from "stripe";
import { isAdminAuthed } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { telegramConfigured } from "@/lib/telegram";
import { isLiveKey, isRestrictedKey } from "@/lib/stripeMode";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * PRE-FLIGHT — "can I spend money on ads today?"
 *
 * Deliberately NOT the question /admin/settings/integrations answers, which is
 * "is this secret set". A key can be set and out of credit; a Stripe account
 * can hold live keys and still be unable to charge because KYC never finished.
 * Both read green on a presence check and lose money on a real one.
 *
 * So every check here is a LIVE call against the provider:
 *   - Anthropic  a 1-token completion, which is what surfaces "credit balance
 *                is too low" — the failure that silently drops the receptionist
 *                to Llama and new site copy to the mechanical template
 *   - Stripe     the account's own charges_enabled / payouts_enabled flags,
 *                i.e. the real KYC verdict rather than the key prefix
 *   - Stripe     the webhook endpoint's enabled_events, so a missing
 *                invoice.payment_failed is visible before a renewal fails
 *   - Resend     verified sending domains
 *   - Supabase   a real select
 *
 * blocksAds = money spent on traffic today either cannot convert, or converts
 * into a client who receives less than what was sold.
 */

type Status = "ready" | "warn" | "blocked";

interface Check {
  id: string;
  label: string;
  status: Status;
  detail: string;
  fix?: string;
  blocksAds: boolean;
}

/** Never let one slow provider hang the whole page. */
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, rej) => setTimeout(() => rej(new Error(`timed out after ${ms}ms`)), ms)),
  ]);
}

/**
 * Retry NETWORK failures, never HTTP errors.
 *
 * A 401 is an answer and must be reported. A dropped connection is not — and
 * reporting "BLOCKED" for a transient blip on the one screen whose job is to
 * say truthfully whether you can launch would teach you to ignore it.
 */
async function retryFetch(url: string, init: RequestInit, ms = 12_000, attempts = 3): Promise<Response> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await withTimeout(fetch(url, init), ms);
    } catch (err) {
      lastErr = err;
      if (i < attempts - 1) await new Promise((r) => setTimeout(r, 300 * (i + 1)));
    }
  }
  throw new Error(`unreachable after ${attempts} attempts: ${lastErr instanceof Error ? lastErr.message : "unknown"}`);
}

/** Same idea for SDK calls, which do their own HTTP. */
async function retryCall<T>(fn: () => Promise<T>, ms = 12_000, attempts = 3): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await withTimeout(fn(), ms);
    } catch (err) {
      lastErr = err;
      // Stripe rejecting a key is an answer, not a blip — do not retry it.
      const msg = err instanceof Error ? err.message : "";
      if (/Invalid API Key|No such|authentication/i.test(msg)) throw err;
      if (i < attempts - 1) await new Promise((r) => setTimeout(r, 300 * (i + 1)));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("unknown error");
}

async function checkAnthropic(): Promise<Check> {
  const label = "Anthropic — AI receptionist & site copy";
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  if (!key) {
    return {
      id: "anthropic",
      label,
      status: "blocked",
      detail: "ANTHROPIC_API_KEY is not set. Every AI feature runs on the weaker fallback.",
      fix: "console.anthropic.com → API keys → create a key → add ANTHROPIC_API_KEY in Vercel.",
      blocksAds: true,
    };
  }

  try {
    const res = await retryFetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": key,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 1,
          messages: [{ role: "user", content: "ping" }],
        }),
      });

    if (res.ok) {
      return {
        id: "anthropic",
        label,
        status: "ready",
        detail: "Live call succeeded. Clients get Claude, not the Llama fallback.",
        blocksAds: false,
      };
    }

    const body = await res.text();
    const lowCredit = /credit balance|insufficient|quota|billing/i.test(body);
    return {
      id: "anthropic",
      label,
      status: "blocked",
      detail: lowCredit
        ? "Credit exhausted. The receptionist silently drops to Llama 3.1 8B and new site copy stays the mechanical template — the client pays full price for the degraded version."
        : `Live call failed (HTTP ${res.status}): ${body.slice(0, 160)}`,
      fix: "console.anthropic.com → Plans & Billing → top up.",
      blocksAds: true,
    };
  } catch (err) {
    return {
      id: "anthropic",
      label,
      status: "blocked",
      detail: `Could not reach Anthropic: ${err instanceof Error ? err.message : "unknown"}`,
      blocksAds: true,
    };
  }
}

async function checkStripe(): Promise<Check[]> {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  const live = isLiveKey(key);

  if (!key) {
    return [
      {
        id: "stripe-key",
        label: "Stripe — can you take money",
        status: "blocked",
        detail: "STRIPE_SECRET_KEY is not set. Checkout returns 503.",
        fix: "dashboard.stripe.com → Developers → API keys.",
        blocksAds: true,
      },
    ];
  }

  const out: Check[] = [];
  const stripe = new Stripe(key);

  // A restricted key works, but only with the right permissions granted. It
  // fails per-endpoint rather than at auth, so the symptom is one broken
  // feature (portal, webhooks) rather than an obvious "bad key".
  if (isRestrictedKey(key)) {
    out.push({
      id: "stripe-restricted",
      label: "Stripe — restricted key in use",
      status: "warn",
      detail:
        "This is a restricted key (rk_). It needs WRITE on Checkout Sessions, Customers, Subscriptions, Webhook Endpoints and Billing Portal, plus READ on Account and Invoices. Missing a permission fails only the endpoint that needs it, so the damage shows up as one broken feature rather than a rejected key.",
      fix: "Simplest is a Standard secret key (sk_live_). Otherwise check the policy at dashboard.stripe.com → Developers → API keys.",
      blocksAds: false,
    });
  }

  // ── KYC: the flags Stripe itself uses, not the key prefix ────────────────
  try {
    const acct = await retryCall(() => stripe.accounts.retrieveCurrent());
    const charges = acct.charges_enabled === true;
    const payouts = acct.payouts_enabled === true;
    const due = acct.requirements?.currently_due ?? [];

    out.push({
      id: "stripe-account",
      label: "Stripe — account verification (KYC)",
      status: charges && payouts && live ? "ready" : "blocked",
      detail: !charges
        ? "Stripe will NOT accept charges on this account yet — verification is incomplete."
        : !payouts
          ? "Charges work, but payouts are disabled: money would be collected and then held."
          : live
            ? "Verified. Charges and payouts are both enabled."
            : "Account is verified, but the key in use is a TEST key — no real money can move.",
      fix:
        due.length > 0
          ? `Stripe still needs: ${due.slice(0, 6).join(", ")}${due.length > 6 ? "…" : ""} — dashboard.stripe.com → Settings → Business.`
          : !live
            ? "Toggle off Test mode in Stripe, copy the sk_live_ key, set STRIPE_SECRET_KEY in Vercel, redeploy."
            : undefined,
      blocksAds: !(charges && payouts && live),
    });
  } catch (err) {
    out.push({
      id: "stripe-account",
      label: "Stripe — account verification (KYC)",
      status: "blocked",
      detail: `Could not read the Stripe account: ${err instanceof Error ? err.message : "unknown"}`,
      blocksAds: true,
    });
  }

  // ── Webhook events: a missing invoice.* stays invisible until a renewal fails
  try {
    const eps = await retryCall(() => stripe.webhookEndpoints.list({ limit: 20 }));
    const enabled = new Set<string>();
    for (const ep of eps.data) {
      if (ep.status !== "enabled") continue;
      for (const e of ep.enabled_events ?? []) enabled.add(e);
    }
    const wildcard = enabled.has("*");
    const required = ["checkout.session.completed", "invoice.paid", "invoice.payment_failed"];
    const missing = wildcard ? [] : required.filter((e) => !enabled.has(e));
    const noEndpoint = eps.data.length === 0;
    const fatal = noEndpoint || missing.includes("checkout.session.completed");

    out.push({
      id: "stripe-webhook",
      label: "Stripe — webhook events",
      status: fatal ? "blocked" : missing.length ? "warn" : "ready",
      detail: noEndpoint
        ? "No webhook endpoint exists. Nothing would be written to the CRM when someone pays."
        : missing.length === 0
          ? `All required events enabled across ${eps.data.length} endpoint(s).`
          : `Missing: ${missing.join(", ")}. ${
              missing.includes("checkout.session.completed")
                ? "Payments would never reach the CRM."
                : "A failed renewal would be invisible — you would keep serving a client who stopped paying."
            }`,
      fix: missing.length
        ? "dashboard.stripe.com → Developers → Webhooks → your endpoint → Update details → add the events above."
        : undefined,
      blocksAds: fatal,
    });
  } catch (err) {
    out.push({
      id: "stripe-webhook",
      label: "Stripe — webhook events",
      status: "warn",
      detail: `Could not list webhook endpoints: ${err instanceof Error ? err.message : "unknown"}`,
      blocksAds: false,
    });
  }

  // ── Customer portal: a per-mode configuration that does NOT carry over ───
  // Switching to live keys leaves the live portal unconfigured, and the first
  // client who clicks "manage billing" gets an error. Day-30 problem, so a
  // warning rather than a blocker - but an invisible one until it bites.
  try {
    const cfgs = await retryCall(() => stripe.billingPortal.configurations.list({ limit: 20 }));
    const usable = cfgs.data.some((c) => c.is_default && c.active);
    out.push({
      id: "stripe-portal",
      label: "Stripe — customer billing portal",
      status: usable ? "ready" : "warn",
      detail: usable
        ? "A default portal configuration exists, so clients can manage their own billing."
        : "No default portal configuration in this mode. Clients clicking \"manage billing\" in their portal get an error — configurations do not carry over from test mode.",
      fix: usable ? undefined : "dashboard.stripe.com → Settings → Billing → Customer portal → Save (once, in LIVE mode).",
      blocksAds: false,
    });
  } catch (err) {
    out.push({
      id: "stripe-portal",
      label: "Stripe — customer billing portal",
      status: "warn",
      detail: `Could not read portal configurations: ${err instanceof Error ? err.message : "unknown"}`,
      blocksAds: false,
    });
  }

  if (!process.env.STRIPE_WEBHOOK_SECRET?.trim()) {
    out.push({
      id: "stripe-webhook-secret",
      label: "Stripe — webhook signing secret",
      status: "blocked",
      detail: "STRIPE_WEBHOOK_SECRET is not set, so incoming webhooks fail signature verification and are rejected.",
      fix: "Stripe → Webhooks → your endpoint → Signing secret → set STRIPE_WEBHOOK_SECRET in Vercel.",
      blocksAds: true,
    });
  }

  return out;
}

async function checkResend(): Promise<Check> {
  const label = "Resend — every outbound email";
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) {
    return {
      id: "resend",
      label,
      status: "blocked",
      detail: "RESEND_API_KEY is not set. Go-live emails, receipts and portal magic links all silently no-op.",
      fix: "resend.com → API Keys.",
      blocksAds: true,
    };
  }

  try {
    const res = await retryFetch(
      "https://api.resend.com/domains", { headers: { Authorization: `Bearer ${key}` } });
    if (!res.ok) {
      return {
        id: "resend",
        label,
        status: "blocked",
        detail: `Resend rejected the key (HTTP ${res.status}).`,
        fix: "Regenerate the key at resend.com → API Keys.",
        blocksAds: true,
      };
    }
    const json = (await res.json()) as { data?: { name: string; status: string }[] };
    const domains = json.data ?? [];
    const verified = domains.filter((d) => d.status === "verified");
    // A previously-verified domain whose DNS record has gone missing. Mail
    // still sends today; Resend rechecks for 72h and then fails it outright.
    // Worth its own message because "not verified" reads like a setup task
    // when it is actually a clock running down on live email.
    const decaying = domains.filter((d) => d.status === "temporary_failure");

    return {
      id: "resend",
      label,
      status: decaying.length ? "warn" : verified.length ? "ready" : "blocked",
      detail: decaying.length
        ? `${decaying.map((d) => d.name).join(", ")} is in temporary_failure — the DNS record has gone missing. Mail still sends, but Resend fails the domain outright after 72h.`
        : verified.length
        ? `Verified sending domain(s): ${verified.map((d) => d.name).join(", ")}.`
        : domains.length
          ? `No VERIFIED domain. Found: ${domains.map((d) => `${d.name} (${d.status})`).join(", ")}. Mail will bounce or land in spam.`
          : "No sending domain configured — a new client's first impression would be silence.",
      fix: decaying.length
        ? "Re-add the missing DNS record at your registrar before the 72h window closes."
        : verified.length
          ? undefined
          : "resend.com → Domains → add servolia.com and complete the DNS records.",
      blocksAds: !verified.length,
    };
  } catch (err) {
    return {
      id: "resend",
      label,
      status: "warn",
      detail: `Could not reach Resend: ${err instanceof Error ? err.message : "unknown"}`,
      blocksAds: false,
    };
  }
}

async function checkSupabase(): Promise<Check> {
  const label = "Supabase — the CRM itself";
  const db = supabaseAdmin();
  if (!db) {
    return {
      id: "supabase",
      label,
      status: "blocked",
      detail: "Not configured. Nothing can be recorded: no leads, no builds, no clients.",
      fix: "Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Vercel.",
      blocksAds: true,
    };
  }
  const { error } = await db.from("builds").select("id", { count: "exact", head: true }).limit(1);
  return {
    id: "supabase",
    label,
    status: error ? "blocked" : "ready",
    detail: error ? `Query failed: ${error.message}` : "Connected, and the builds table responds.",
    fix: error ? "Run supabase/schema.sql, then supabase/pending-migration.sql." : undefined,
    blocksAds: !!error,
  };
}

function checkAlerts(): Check {
  const ok = telegramConfigured();
  return {
    id: "telegram",
    label: "Telegram — how you find out",
    status: ok ? "ready" : "warn",
    detail: ok
      ? "Connected. New leads, payments and AI-degradation alerts reach your phone."
      : "Not configured. A lead could arrive and sit unread — and you would never be told the AI dropped to the fallback.",
    fix: ok ? undefined : "Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in Vercel.",
    blocksAds: false,
  };
}

function checkPush(): Check {
  const pub = !!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
  const priv = !!process.env.VAPID_PRIVATE_KEY?.trim();
  const subj = !!process.env.VAPID_SUBJECT?.trim();
  const all = pub && priv && subj;
  const some = pub || priv || subj;

  return {
    id: "web-push",
    label: "Web Push — client notifications",
    status: all ? "ready" : some ? "warn" : "warn",
    detail: all
      ? "Configured. A client who opts in gets a notification the moment a patient enquires."
      : some
        ? "Partly configured — push needs ALL THREE of NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY and VAPID_SUBJECT. With one missing it silently does nothing."
        : "Not set up. Clients can install the app but will not receive notifications.",
    fix: all
      ? undefined
      : "Run npm run vapid, put the three values in Vercel, and run section 9 of pending-migration.sql.",
    // Never blocks a launch: no client exists to notify yet, and the lead
    // email carries the promise on its own.
    blocksAds: false,
  };
}

function checkAds(): Check {
  const capi = !!process.env.META_CAPI_ACCESS_TOKEN?.trim();
  return {
    id: "meta-capi",
    label: "Meta Conversions API — ad optimization",
    status: capi ? "ready" : "warn",
    detail: capi
      ? "Server-side Purchase events are sent, so Meta can optimize on real payments."
      : "META_CAPI_ACCESS_TOKEN is not set. The pixel still fires in-browser, but iOS and ad-blockers hide conversions — Meta optimizes on partial data and your CPA reads worse than it is.",
    fix: capi ? undefined : "Meta Events Manager → your dataset → Settings → Generate access token.",
    blocksAds: false,
  };
}

export async function GET() {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [anthropic, stripe, resend, supabase] = await Promise.all([
    checkAnthropic(),
    checkStripe(),
    checkResend(),
    checkSupabase(),
  ]);

  const checks: Check[] = [supabase, ...stripe, anthropic, resend, checkAlerts(), checkPush(), checkAds()];
  const blockers = checks.filter((c) => c.blocksAds);

  return NextResponse.json({
    checkedAt: new Date().toISOString(),
    canRunAds: blockers.length === 0,
    blockerCount: blockers.length,
    checks,
  });
}
