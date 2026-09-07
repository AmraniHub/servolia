#!/usr/bin/env node
/**
 * Create a hosting subscription checkout link for one client.
 *
 * Deliberately a script rather than a public route: hosting is sold by the
 * operator, not self-serve. Adding it to /api/checkout-subscription would mean
 * touching the live purchase path that Servolia's own customers use, for a
 * flow no visitor will ever hit.
 *
 * The link is one-time-use and expires; send it to the client, they pay by
 * card, and Stripe bills them from then on. The webhook writes the
 * hosting_clients row when they pay — nothing is inserted up front, so an
 * abandoned checkout leaves no half-client behind.
 *
 * Usage:
 *   node scripts/hosting-subscribe.mjs \
 *     --business "GoodsCoChina" \
 *     --email samiramousa88@gmail.com \
 *     --contact "Samira Mousa" \
 *     --site https://www.goodscochina.com \
 *     --repo AmraniHub/yiwugoodsco-com \
 *     --site-root web \
 *     --vercel-project yiwugoodsco \
 *     --period monthly            # or annual
 *
 * Needs STRIPE_SECRET_KEY in the environment (.env.local is read if present).
 */

import Stripe from "stripe";
import fs from "node:fs";
import path from "node:path";

// ── read .env.local without a dotenv dependency ─────────────────────────────
const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    // A value pasted from cmd.exe can carry its quotes; strip them or the key
    // is silently wrong and every Stripe call 401s.
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (!process.env[m[1]]) process.env[m[1]] = v;
  }
}

const args = {};
for (let i = 2; i < process.argv.length; i += 2) {
  args[process.argv[i].replace(/^--/, "")] = process.argv[i + 1];
}

const KEY = process.env.STRIPE_SECRET_KEY;
if (!KEY) {
  console.error("Missing STRIPE_SECRET_KEY (env or .env.local).");
  process.exit(1);
}

// Prices live in src/lib/hosting.ts. Duplicated here as numbers because this
// script is plain .mjs and cannot import the TypeScript module; keep in sync.
const PLAN = { key: "hosting", monthlyUsd: 8, annualUsd: 96 };

const business = args.business;
const email = args.email;
if (!business || !email) {
  console.error("--business and --email are required.");
  process.exit(1);
}

const period = args.period === "annual" ? "annual" : "monthly";
const usd = period === "annual" ? PLAN.annualUsd : PLAN.monthlyUsd;
const origin = args.origin || "https://servolia.com";

const stripe = new Stripe(KEY);

const session = await stripe.checkout.sessions.create({
  mode: "subscription",
  customer_email: email,
  line_items: [
    {
      price_data: {
        currency: "usd",
        product_data: {
          name: `Website hosting — ${business}`,
          description:
            "Hosting, SSL, domain renewal, DNS, and keeping the site's forms " +
            "and tracking connected.",
        },
        unit_amount: Math.round(usd * 100),
        recurring: { interval: period === "annual" ? "year" : "month" },
      },
      quantity: 1,
    },
  ],
  // The webhook routes on kind; without it this lands in `clients` and shows
  // up in Servolia's MRR.
  metadata: {
    kind: "hosting",
    plan: PLAN.key,
    period,
    business,
    contact_name: args.contact || "",
    site_url: args.site || "",
    repo: args.repo || "",
    branch: args.branch || "main",
    site_root: args["site-root"] || "",
    vercel_project: args["vercel-project"] || "",
  },
  success_url: `${origin}/portal?hosting=active`,
  cancel_url: `${origin}/`,
});

console.log("");
console.log("  client   :", business, `<${email}>`);
console.log("  plan     :", `$${usd} / ${period === "annual" ? "year" : "month"}`);
console.log("  mode     :", KEY.startsWith("sk_live") ? "LIVE" : "TEST");
console.log("");
console.log("  Send this link:");
console.log(" ", session.url);
console.log("");
