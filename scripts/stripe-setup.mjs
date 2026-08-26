#!/usr/bin/env node
/**
 * STRIPE GO-LIVE FROM THE TERMINAL — `npm run stripe:setup`
 *
 * Reports, and on `--apply` creates, the two things that do NOT carry over
 * when you switch from test keys to live keys:
 *
 *   1. The webhook endpoint (and its signing secret, which is DIFFERENT from
 *      the test one — miss it and every live payment is rejected as unsigned,
 *      so checkout succeeds, money arrives, and the CRM stays empty).
 *   2. The customer portal configuration, without which every client who
 *      clicks "manage billing" gets an error.
 *
 * It also reads the account's real KYC verdict rather than guessing from the
 * key prefix.
 *
 *   npm run stripe:setup              # report only, changes nothing
 *   npm run stripe:setup -- --apply   # create whatever is missing
 *
 * Idempotent: re-running finds what already exists and leaves it alone.
 *
 * SECRETS: the key is read from the environment and never printed. The webhook
 * signing secret IS printed once, because it only exists at creation time and
 * you need it — copy it straight into Vercel and close the terminal.
 *
 * Dependency-free plain ESM with raw REST, same as scripts/preflight.mjs, so
 * it runs with a bare `node` and no build step.
 */

import { readFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const APPLY = process.argv.includes("--apply");
const ALLOW_TEST = process.argv.includes("--allow-test");

const SITE = process.env.SITE_URL || "https://servolia.com";
const WEBHOOK_URL = `${SITE}/api/webhooks/stripe`;
const EVENTS = [
  "checkout.session.completed",
  "invoice.paid",
  "invoice.payment_succeeded",
  "invoice.payment_failed",
  "customer.subscription.deleted",
];

// ── env ─────────────────────────────────────────────────────────────────────
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
      const k = line.slice(0, eq).trim();
      let v = line.slice(eq + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      if (!(k in env)) env[k] = v;
    }
  }
  return { ...env, ...process.env };
}
const ENV = loadEnv();
const KEY = (ENV.STRIPE_SECRET_KEY ?? "").trim();

// ── output ──────────────────────────────────────────────────────────────────
const COLOR = process.stdout.isTTY && !process.env.NO_COLOR;
const c = (code, s) => (COLOR ? `[${code}m${s}[0m` : s);
const ok = (s) => console.log(`  ${c(32, "[ OK    ]")} ${s}`);
const warn = (s) => console.log(`  ${c(33, "[ TODO  ]")} ${s}`);
const bad = (s) => console.log(`  ${c(31, "[ FAIL  ]")} ${s}`);
const note = (s) => console.log(`            ${c(90, s)}`);
const did = (s) => console.log(`  ${c(36, "[ MADE  ]")} ${s}`);

// ── HTTP: curl fallback, because Node fetch is unreliable on this link ───────
function curlFetch(url, opts = {}) {
  const args = ["-s", "-S", "--max-time", "30", "-w", "|||%{http_code}"];
  if (opts.method) args.push("-X", opts.method);
  for (const [k, v] of Object.entries(opts.headers ?? {})) args.push("-H", `${k}: ${v}`);
  if (opts.body) args.push("--data-binary", opts.body);
  args.push(url);
  const out = execFileSync("curl", args, { encoding: "utf8", maxBuffer: 8_000_000 });
  const i = out.lastIndexOf("|||");
  return { status: Number.parseInt(out.slice(i + 3).trim(), 10), body: out.slice(0, i) };
}

async function api(path, { method = "GET", form } = {}) {
  const url = `https://api.stripe.com/v1/${path}`;
  const headers = { Authorization: `Bearer ${KEY}` };
  const opts = { method, headers };
  if (form) {
    headers["Content-Type"] = "application/x-www-form-urlencoded";
    opts.body = form;
  }
  let status, body;
  try {
    const res = await fetch(url, opts);
    status = res.status;
    body = await res.text();
  } catch {
    ({ status, body } = curlFetch(url, opts));
  }
  let json;
  try {
    json = JSON.parse(body);
  } catch {
    throw new Error(`Stripe returned non-JSON (HTTP ${status}): ${body.slice(0, 160)}`);
  }
  if (status >= 400) throw new Error(json?.error?.message ?? `HTTP ${status}`);
  return json;
}

/** Stripe wants form-encoded nested params: features[invoice_history][enabled]=true */
function encode(obj, prefix = "", out = []) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}[${k}]` : k;
    if (v === undefined || v === null) continue;
    if (Array.isArray(v)) v.forEach((item) => out.push(`${encodeURIComponent(`${key}[]`)}=${encodeURIComponent(item)}`));
    else if (typeof v === "object") encode(v, key, out);
    else out.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(v))}`);
  }
  return out.join("&");
}

// ── run ─────────────────────────────────────────────────────────────────────
console.log("");
console.log(c(1, "  STRIPE GO-LIVE") + c(90, `  ${APPLY ? "apply" : "report only — pass --apply to make changes"}`));
console.log(c(90, "  " + "-".repeat(74)));

if (!KEY) {
  bad("STRIPE_SECRET_KEY is not set.");
  note("Run as:  STRIPE_SECRET_KEY=sk_live_... npm run stripe:setup -- --apply");
  process.exit(1);
}
// Restricted keys are rk_live_, not sk_live_. Treating one as a test key
// would refuse to run against a key that charges real customers.
const LIVE = /^(sk|rk)_live_/.test(KEY);
const RESTRICTED = KEY.startsWith("rk_");
if (!LIVE && !ALLOW_TEST) {
  bad("This is a TEST key. Re-run with the live key, or pass --allow-test to rehearse.");
  process.exit(1);
}
console.log(`  Mode: ${LIVE ? c(32, "LIVE") : c(33, "TEST")}${RESTRICTED ? c(33, " (restricted key)") : ""}   Webhook target: ${WEBHOOK_URL}`);
if (RESTRICTED) {
  note("Restricted key: needs WRITE on Webhook Endpoints and Billing Portal for --apply to work,");
  note("plus READ on Account. A missing permission fails only that step, not the whole run.");
}
console.log("");

let failures = 0;

// 1 ── KYC ──────────────────────────────────────────────────────────────────
try {
  const acct = await api("account");
  const charges = acct.charges_enabled === true;
  const payouts = acct.payouts_enabled === true;
  const due = acct.requirements?.currently_due ?? [];
  if (charges && payouts) ok(`Account verified — charges and payouts both enabled (${acct.id}).`);
  else {
    failures++;
    bad(`Account NOT ready — charges:${charges} payouts:${payouts}`);
    if (due.length) note(`Stripe still wants: ${due.join(", ")}`);
    note("dashboard.stripe.com → Settings → Business");
  }
} catch (err) {
  failures++;
  bad(`Could not read the account: ${err.message}`);
}

// 2 ── Webhook endpoint ─────────────────────────────────────────────────────
try {
  const list = await api("webhook_endpoints?limit=100");
  const existing = (list.data ?? []).find((e) => e.url === WEBHOOK_URL);

  if (existing) {
    const have = new Set(existing.enabled_events ?? []);
    const missing = have.has("*") ? [] : EVENTS.filter((e) => !have.has(e));
    if (existing.status !== "enabled") {
      failures++;
      bad(`Webhook exists but is ${existing.status}. Re-enable it in the dashboard.`);
    } else if (missing.length === 0) {
      ok(`Webhook endpoint exists with all ${EVENTS.length} events (${existing.id}).`);
    } else if (APPLY) {
      await api(`webhook_endpoints/${existing.id}`, {
        method: "POST",
        form: encode({ enabled_events: [...have].filter((e) => e !== "*").concat(missing) }),
      });
      did(`Added missing events: ${missing.join(", ")}`);
    } else {
      warn(`Webhook is missing events: ${missing.join(", ")}`);
      note("Re-run with --apply to add them.");
    }
    note("Signing secret is only shown at creation — if you never saved it, delete this endpoint and re-run --apply.");
  } else if (APPLY) {
    const created = await api("webhook_endpoints", {
      method: "POST",
      form: encode({ url: WEBHOOK_URL, enabled_events: EVENTS, description: "Servolia production" }),
    });
    did(`Created webhook endpoint ${created.id}`);
    console.log("");
    console.log(c(1, "  >>> COPY THIS INTO VERCEL AS  STRIPE_WEBHOOK_SECRET  <<<"));
    console.log(c(33, `      ${created.secret}`));
    console.log(c(90, "      Shown once, now. It is different from your test secret."));
    console.log("");
  } else {
    failures++;
    warn(`No webhook endpoint for ${WEBHOOK_URL}`);
    note("Re-run with --apply to create it and print the signing secret.");
  }
} catch (err) {
  failures++;
  bad(`Webhook step failed: ${err.message}`);
}

// 3 ── Customer portal configuration ────────────────────────────────────────
try {
  const list = await api("billing_portal/configurations?limit=100");
  const def = (list.data ?? []).find((x) => x.is_default && x.active);

  if (def) {
    ok(`Customer portal configured (${def.id}).`);
    const upd = def.features?.customer_update;
    if (upd?.enabled && (upd.allowed_updates ?? []).includes("email")) {
      warn("Portal allows customers to change their EMAIL.");
      note("The app finds a client's billing by their session email (customers.list({email})).");
      note("If they change it in Stripe, that lookup stops matching and they lock themselves out.");
    }
  } else if (APPLY) {
    // Settings chosen against the real contract and the real code:
    //  - no "email" in allowed_updates: the app looks a customer up BY email,
    //    so letting them change it there locks them out of their own billing
    //  - cancel at_period_end, not immediately: CGV section 9 sells the plan
    //    with 30 days notice, and a one-click instant cancel would quietly
    //    override the contract the client agreed to
    //  - no plan switching: checkout builds charges from inline price_data,
    //    so there are no Price objects in the catalog for the portal to offer
    const created = await api("billing_portal/configurations", {
      method: "POST",
      form: encode({
        business_profile: {
          headline: "Servolia — manage your plan and invoices",
          privacy_policy_url: `${SITE}/legal/privacy`,
          terms_of_service_url: `${SITE}/legal/cgv`,
        },
        default_return_url: `${SITE}/portal`,
        features: {
          invoice_history: { enabled: true },
          payment_method_update: { enabled: true },
          customer_update: { enabled: true, allowed_updates: ["address", "phone", "tax_id", "name"] },
          subscription_cancel: {
            enabled: true,
            mode: "at_period_end",
            cancellation_reason: { enabled: true, options: ["too_expensive", "missing_features", "switched_service", "unused", "other"] },
          },
        },
      }),
    });
    did(`Created default portal configuration ${created.id}`);
    note("Invoices + payment method + address/phone/VAT updates ON. Email updates OFF (would break billing lookup).");
    note("Cancellation is at period end, matching CGV section 9 (30 days notice).");
  } else {
    failures++;
    warn("No default customer portal configuration in this mode.");
    note("Without it, every client who clicks 'manage billing' gets an error.");
    note("Re-run with --apply to create one wired to your CGV and privacy pages.");
  }
} catch (err) {
  failures++;
  bad(`Portal step failed: ${err.message}`);
}

console.log("");
console.log(c(90, "  " + "-".repeat(74)));
if (failures === 0) {
  console.log(c(32, "  Stripe is set up.") + c(90, "  Next: confirm with `npm run preflight`."));
} else {
  console.log(c(33, `  ${failures} item(s) still to do.`) + c(90, APPLY ? "" : "  Re-run with --apply to fix what can be automated."));
}
console.log("");
process.exit(failures === 0 ? 0 : 1);
