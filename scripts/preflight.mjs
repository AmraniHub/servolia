#!/usr/bin/env node
/**
 * PRE-FLIGHT FROM THE TERMINAL — `npm run preflight`
 *
 * The same five questions as /admin/settings/launch, runnable without a
 * browser or an admin session. Live calls against each provider, because the
 * two failures that cost the most money both look fine on a presence check:
 * an Anthropic key that is set but out of credit, and a Stripe account with
 * live keys that cannot charge because KYC never finished.
 *
 * Deliberately dependency-free and written in plain ESM with raw REST rather
 * than the Stripe SDK: it must run with a bare `node scripts/preflight.mjs`
 * on a machine with no build step and no TypeScript runner.
 *
 *   npm run preflight              # reads .env.local, then process.env
 *   npm run preflight -- --json    # machine-readable
 *
 * Exit code 0 = clear to run ads. 1 = at least one blocker. So it can gate a
 * deploy script or a cron.
 *
 * PAIRED FILE: src/app/api/admin/preflight/route.ts checks PRODUCTION (it
 * reads Vercel's env at runtime). This one checks whatever environment you
 * run it in. Keep the two in step — same checks, same verdicts.
 */

import { readFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const JSON_OUT = process.argv.includes("--json");

// ── env ─────────────────────────────────────────────────────────────────────
// process.env wins, so `STRIPE_SECRET_KEY=sk_live_… npm run preflight` can
// check a key that is not in the file.
function loadEnv() {
  const env = {};
  for (const file of [".env.local", ".env"]) {
    const p = resolve(ROOT, file);
    if (!existsSync(p)) continue;
    for (const raw of readFileSync(p, "utf8").split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith("#")) continue;
      const eq = line.indexOf("=");
      if (eq < 1) continue;
      const key = line.slice(0, eq).trim();
      let val = line.slice(eq + 1).trim();
      // Strip matching quotes, but leave a stray apostrophe alone.
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!(key in env)) env[key] = val;
    }
  }
  return { ...env, ...process.env };
}

const ENV = loadEnv();
const get = (k) => (ENV[k] ?? "").trim() || null;

// ── helpers ─────────────────────────────────────────────────────────────────
/**
 * curl fallback — required on this machine, not a nicety.
 *
 * Measured 2026-08-16: curl returned clean responses from api.stripe.com,
 * api.anthropic.com and api.resend.com while Node fetch threw ETIMEDOUT on all
 * three in the same second. undici over this 4G link drops TLS in a way
 * Windows Schannel rides through. Since the whole point of this tool is to say
 * truthfully whether a provider is reachable, it must not report "blocked"
 * when the only thing broken is Node HTTP stack.
 */
function curlFetch(url, opts = {}) {
  const args = ["-s", "-S", "--max-time", "25", "-w", "|||%{http_code}"];
  if (opts.method) args.push("-X", opts.method);
  for (const [k, v] of Object.entries(opts.headers ?? {})) args.push("-H", `${k}: ${v}`);
  if (opts.body) args.push("--data-binary", opts.body);
  args.push(url);
  // execFileSync, not a shell: no quoting to get wrong.
  const out = execFileSync("curl", args, { encoding: "utf8", maxBuffer: 8_000_000 });
  const nl = out.lastIndexOf("|||");
  const status = Number.parseInt(out.slice(nl + 3).trim(), 10);
  const body = out.slice(0, nl);
  return {
    ok: status >= 200 && status < 300,
    status,
    viaCurl: true,
    text: async () => body,
    json: async () => JSON.parse(body),
  };
}

/**
 * Retries NETWORK failures only, never HTTP errors.
 *
 * An HTTP 401 is an answer and must be reported. A dropped TLS handshake is
 * not: Node fetch drops connections on a flaky link often enough that a single
 * attempt reported Stripe as BLOCKED while curl got a clean 401 three times in
 * a row. A readiness tool that cries wolf gets ignored, which is worse than
 * not having one.
 */
async function fetchWithTimeout(url, opts = {}, ms = 15000, attempts = 3) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), ms);
    try {
      return await fetch(url, { ...opts, signal: ac.signal });
    } catch (err) {
      lastErr = err;
      if (i < attempts - 1) await new Promise((r) => setTimeout(r, 400 * (i + 1)));
    } finally {
      clearTimeout(t);
    }
  }
  // Node HTTP stack gave up. Ask curl before blaming the provider.
  try {
    return curlFetch(url, opts);
  } catch (curlErr) {
    const e = new Error(
      `unreachable after ${attempts} node attempts and a curl retry: ${lastErr?.message ?? "unknown"}`,
    );
    e.isNetwork = true;
    e.curlError = curlErr?.message;
    throw e;
  }
}

/** Network failure means "could not verify", not "provider said no". */
const unverified = (err) => (err.isNetwork ? "Could not verify - " : "");

const check = (id, label, status, detail, fix, blocksAds) => ({ id, label, status, detail, fix, blocksAds });

// ── 1. Anthropic ────────────────────────────────────────────────────────────
async function checkAnthropic() {
  const L = "Anthropic - AI receptionist & site copy";
  const key = get("ANTHROPIC_API_KEY");
  if (!key) {
    return check("anthropic", L, "blocked", "ANTHROPIC_API_KEY is not set. Every AI feature runs on the weaker fallback.",
      "console.anthropic.com -> API keys", true);
  }
  try {
    const res = await fetchWithTimeout("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1,
        messages: [{ role: "user", content: "ping" }],
      }),
    });
    if (res.ok) {
      return check("anthropic", L, "ready", "Live call succeeded. Clients get Claude, not the Llama fallback.", null, false);
    }
    const body = await res.text();
    const lowCredit = /credit balance|insufficient|quota|billing/i.test(body);
    return check("anthropic", L, "blocked",
      lowCredit
        ? "Credit exhausted. The receptionist drops to Llama 3.1 8B and new site copy stays the mechanical template - full price, degraded product, no error anywhere."
        : `Live call failed (HTTP ${res.status}): ${body.slice(0, 160)}`,
      "console.anthropic.com -> Plans & Billing -> top up", true);
  } catch (err) {
    return check("anthropic", L, "blocked", `${unverified(err)}${err.message}`, null, true);
  }
}

// ── 2 & 3. Stripe ───────────────────────────────────────────────────────────
async function checkStripe() {
  const key = get("STRIPE_SECRET_KEY");
  const live = (key ?? "").startsWith("sk_live_");
  const out = [];

  if (!key) {
    return [check("stripe-key", "Stripe - can you take money", "blocked",
      "STRIPE_SECRET_KEY is not set. Checkout returns 503.", "dashboard.stripe.com -> Developers -> API keys", true)];
  }
  const auth = { Authorization: `Bearer ${key}` };

  // KYC: the flags Stripe itself uses, not the key prefix.
  try {
    const res = await fetchWithTimeout("https://api.stripe.com/v1/account", { headers: auth });
    const acct = await res.json();
    if (!res.ok) {
      out.push(check("stripe-account", "Stripe - account verification (KYC)", "blocked",
        `Stripe rejected the key: ${acct?.error?.message ?? res.status}`, null, true));
    } else {
      const charges = acct.charges_enabled === true;
      const payouts = acct.payouts_enabled === true;
      const due = acct.requirements?.currently_due ?? [];
      out.push(check("stripe-account", "Stripe - account verification (KYC)",
        charges && payouts && live ? "ready" : "blocked",
        !charges ? "Stripe will NOT accept charges yet - verification is incomplete."
          : !payouts ? "Charges work, but payouts are disabled: money would be collected and then held."
          : live ? "Verified. Charges and payouts are both enabled."
          : "Account is verified, but the key in use is a TEST key - no real money can move.",
        due.length ? `Stripe still needs: ${due.slice(0, 6).join(", ")}`
          : !live ? "Toggle off Test mode, copy the sk_live_ key into Vercel, redeploy" : null,
        !(charges && payouts && live)));
    }
  } catch (err) {
    out.push(check("stripe-account", "Stripe - account verification (KYC)", "blocked",
      `${unverified(err)}Stripe account: ${err.message}`, null, true));
  }

  // Webhook events: a missing invoice.* stays invisible until a renewal fails.
  try {
    const res = await fetchWithTimeout("https://api.stripe.com/v1/webhook_endpoints?limit=20", { headers: auth });
    const json = await res.json();
    if (!res.ok) throw new Error(json?.error?.message ?? `HTTP ${res.status}`);
    const eps = json.data ?? [];
    const enabled = new Set();
    for (const ep of eps) {
      if (ep.status !== "enabled") continue;
      for (const e of ep.enabled_events ?? []) enabled.add(e);
    }
    const required = ["checkout.session.completed", "invoice.paid", "invoice.payment_failed"];
    const missing = enabled.has("*") ? [] : required.filter((e) => !enabled.has(e));
    const noEndpoint = eps.length === 0;
    const fatal = noEndpoint || missing.includes("checkout.session.completed");

    out.push(check("stripe-webhook", "Stripe - webhook events",
      fatal ? "blocked" : missing.length ? "warn" : "ready",
      noEndpoint ? "No webhook endpoint exists. Nothing would be written to the CRM when someone pays."
        : missing.length === 0 ? `All required events enabled across ${eps.length} endpoint(s).`
        : `Missing: ${missing.join(", ")}. ${
            missing.includes("checkout.session.completed")
              ? "Payments would never reach the CRM."
              : "A failed renewal would be invisible - you would keep serving a client who stopped paying."}`,
      missing.length ? "Stripe -> Developers -> Webhooks -> your endpoint -> Update details" : null,
      fatal));
  } catch (err) {
    out.push(check("stripe-webhook", "Stripe - webhook events", "warn",
      `${unverified(err)}webhook endpoints: ${err.message}`, null, false));
  }

  // Portal configuration is per-mode and does not carry over from test.
  try {
    const res = await fetchWithTimeout("https://api.stripe.com/v1/billing_portal/configurations?limit=20", { headers: auth });
    const json = await res.json();
    if (!res.ok) throw new Error(json?.error?.message ?? `HTTP ${res.status}`);
    const usable = (json.data ?? []).some((c) => c.is_default && c.active);
    out.push(check("stripe-portal", "Stripe - customer billing portal", usable ? "ready" : "warn",
      usable ? "A default portal configuration exists, so clients can manage their own billing."
        : "No default portal configuration in this mode. Clients clicking manage billing get an error - configurations do not carry over from test mode.",
      usable ? null : "Stripe -> Settings -> Billing -> Customer portal -> Save (once, in LIVE mode)", false));
  } catch (err) {
    out.push(check("stripe-portal", "Stripe - customer billing portal", "warn",
      `${unverified(err)}portal configurations: ${err.message}`, null, false));
  }

  if (!get("STRIPE_WEBHOOK_SECRET")) {
    out.push(check("stripe-webhook-secret", "Stripe - webhook signing secret", "blocked",
      "STRIPE_WEBHOOK_SECRET is not set, so incoming webhooks fail signature verification and are rejected.",
      "Stripe -> Webhooks -> your endpoint -> Signing secret (the LIVE one differs from test)", true));
  }
  return out;
}

// ── 4. Resend ───────────────────────────────────────────────────────────────
async function checkResend() {
  const L = "Resend - every outbound email";
  const key = get("RESEND_API_KEY");
  if (!key) {
    return check("resend", L, "blocked",
      "RESEND_API_KEY is not set. Go-live emails, receipts and portal magic links all silently no-op.",
      "resend.com -> API Keys", true);
  }
  try {
    const res = await fetchWithTimeout("https://api.resend.com/domains", { headers: { Authorization: `Bearer ${key}` } });
    if (!res.ok) {
      const body = await res.text();
      return check("resend", L, "blocked",
        `Resend rejected the key (HTTP ${res.status}): ${body.slice(0, 120)}`,
        "Regenerate at resend.com -> API Keys", true);
    }
    const json = await res.json();
    const domains = json.data ?? [];
    const verified = domains.filter((d) => d.status === "verified");
    const decaying = domains.filter((d) => d.status === "temporary_failure");

    if (decaying.length) {
      return check("resend", L, "warn",
        `${decaying.map((d) => d.name).join(", ")} is in temporary_failure - the DNS record has gone missing. Mail still sends, but Resend fails the domain outright after 72h.`,
        "Re-add the missing DNS record before the 72h window closes", false);
    }
    return check("resend", L, verified.length ? "ready" : "blocked",
      verified.length ? `Verified sending domain(s): ${verified.map((d) => d.name).join(", ")}.`
        : domains.length ? `No VERIFIED domain. Found: ${domains.map((d) => `${d.name} (${d.status})`).join(", ")}.`
        : "No sending domain configured - a new client's first impression would be silence.",
      verified.length ? null : "resend.com -> Domains -> add servolia.com and complete the DNS records",
      !verified.length);
  } catch (err) {
    return check("resend", L, "warn", `${unverified(err)}Resend: ${err.message}`, null, false);
  }
}

// ── 5. Supabase ─────────────────────────────────────────────────────────────
async function checkSupabase() {
  const L = "Supabase - the CRM itself";
  const url = get("NEXT_PUBLIC_SUPABASE_URL");
  const key = get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) {
    return check("supabase", L, "blocked",
      "Not configured. Nothing can be recorded: no leads, no builds, no clients.",
      "Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY", true);
  }
  try {
    const res = await fetchWithTimeout(`${url.replace(/\/$/, "")}/rest/v1/builds?select=id&limit=1`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    if (!res.ok) {
      const body = await res.text();
      return check("supabase", L, "blocked", `Query failed (HTTP ${res.status}): ${body.slice(0, 140)}`,
        "Run supabase/schema.sql, then supabase/pending-migration.sql", true);
    }
    return check("supabase", L, "ready", "Connected, and the builds table responds.", null, false);
  } catch (err) {
    return check("supabase", L, "blocked", `${unverified(err)}Supabase: ${err.message}`, null, true);
  }
}

// ── 6 & 7. Local-only config ────────────────────────────────────────────────
function checkAlerts() {
  const ok = !!get("TELEGRAM_BOT_TOKEN") && !!get("TELEGRAM_CHAT_ID");
  return check("telegram", "Telegram - how you find out", ok ? "ready" : "warn",
    ok ? "Connected. New leads, payments and AI-degradation alerts reach your phone."
       : "Not configured. A lead could sit unread - and you would never be told the AI dropped to the fallback.",
    ok ? null : "Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID", false);
}

function checkAds() {
  const ok = !!get("META_CAPI_ACCESS_TOKEN");
  return check("meta-capi", "Meta Conversions API - ad optimization", ok ? "ready" : "warn",
    ok ? "Server-side Purchase events are sent, so Meta can optimize on real payments."
       : "Not set. The pixel still fires in-browser, but iOS and ad-blockers hide conversions - Meta optimizes on partial data and your CPA reads worse than it is.",
    ok ? null : "Meta Events Manager -> your dataset -> Settings -> Generate access token", false);
}

// ── output ──────────────────────────────────────────────────────────────────
// ASCII tags, not symbols: this console is cp1252 and mangles anything else.
const COLOR = process.stdout.isTTY && !process.env.NO_COLOR;
const c = (code, s) => (COLOR ? `[${code}m${s}[0m` : s);
const TAG = { ready: () => c(32, "[ OK    ]"), warn: () => c(33, "[ WARN  ]"), blocked: () => c(31, "[ BLOCK ]") };

const results = (await Promise.all([checkSupabase(), checkStripe(), checkAnthropic(), checkResend()])).flat();
const checks = [...results, checkAlerts(), checkAds()];
const blockers = checks.filter((x) => x.blocksAds);

if (JSON_OUT) {
  console.log(JSON.stringify({ checkedAt: new Date().toISOString(), canRunAds: blockers.length === 0, blockerCount: blockers.length, checks }, null, 2));
} else {
  console.log("");
  console.log(c(1, "  SERVOLIA PRE-FLIGHT") + c(90, "  - can I spend money on ads today?"));
  console.log(c(90, "  " + "-".repeat(72)));
  for (const x of checks) {
    console.log(`  ${TAG[x.status]()} ${c(1, x.label)}${x.blocksAds ? c(31, "  BLOCKS ADS") : ""}`);
    console.log(c(90, `            ${x.detail}`));
    if (x.fix) console.log(c(36, `            -> ${x.fix}`));
  }
  console.log(c(90, "  " + "-".repeat(72)));
  console.log(
    blockers.length === 0
      ? c(32, "  CLEAR TO RUN ADS") + c(90, " - money can be collected, and a paying client gets what was sold.")
      : c(31, `  ${blockers.length} BLOCKER(S) - do not spend on traffic yet.`),
  );
  console.log("");
}

process.exit(blockers.length === 0 ? 0 : 1);
