#!/usr/bin/env node
/**
 * Remove what founder test mode left behind — and NOTHING else.
 *
 *   node scripts/test-mode-cleanup.mjs            # dry run: prints every row it would delete
 *   node scripts/test-mode-cleanup.mjs --apply    # deletes exactly those rows
 *
 * Founder test mode (src/lib/testMode.ts) lets the admin buy any product on
 * the live site with a Stripe TEST card; every row those purchases write is
 * tagged is_test = true (supabase/2026-09-24-test-mode.sql). This script
 * deletes those rows once a walk-through is done.
 *
 * THE RULE IT IS BUILT AROUND: a real client's row is never touched.
 *   - Rows are selected ONLY by `is_test = true`. Never by email, name, date
 *     or anything else.
 *   - Every selected row is checked again in this process: if any one of them
 *     does not read is_test === true, the script refuses and deletes nothing.
 *   - The DELETE itself carries `is_test=eq.true` next to the ids, so even a
 *     wrong id could not delete a real row; the rows the database reports as
 *     deleted are checked the same way.
 *   - Dry run by default. `--apply` is required to delete.
 *
 * What the database does by itself when these rows go (the foreign keys in
 * supabase/schema.sql), printed in the dry run so nothing is a surprise:
 *   - scope_acceptances and lead_activities of a test lead: deleted (cascade)
 *   - custom_requests on a test build: deleted (cascade)
 *   - client_sites on a test build (its draft site, or the trial row a test
 *     receptionist purchase linked): KEPT, their build_id set to null. Remove
 *     a test site by hand at /admin/sites if you want it gone.
 *
 * Stripe's own TEST-mode objects (customers, subscriptions) are not touched:
 * delete them in the Stripe dashboard in test mode if you want a clean slate.
 *
 * Reads NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from the
 * environment, else .env.local / .env (process.env wins).
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const APPLY = process.argv.includes("--apply");

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
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
      if (!(key in env)) env[key] = val;
    }
  }
  return { ...env, ...process.env };
}

const ENV = loadEnv();
const URL_BASE = (ENV.NEXT_PUBLIC_SUPABASE_URL ?? "").trim().replace(/\/$/, "");
const KEY = (ENV.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
if (!URL_BASE || !KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (env or .env.local).");
  process.exit(1);
}

/** The tagged tables, in the order they are deleted (clients point at builds). */
export const TABLES = ["clients", "builds", "hosting_clients", "leads"];

async function rest(path, init = {}) {
  let last;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(`${URL_BASE}/rest/v1/${path}`, {
        ...init,
        headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
      });
      const text = await res.text();
      const body = text ? JSON.parse(text) : null;
      if (!res.ok) throw new Error(`${res.status} ${body?.message ?? text}`);
      return body;
    } catch (e) {
      last = e;
      if (String(e.message).match(/^\d{3} /)) break; // an answer, not a network drop
    }
  }
  throw last;
}

const label = (r) => r.business || r.email || r.name || "";
const ids = (rows) => rows.map((r) => r.id);
const inList = (list) => `in.(${list.join(",")})`;

async function main() {
  const selected = {};
  for (const t of TABLES) {
    let rows;
    try {
      rows = await rest(`${t}?is_test=eq.true&select=*&order=created_at.asc`);
    } catch (e) {
      console.error(`Could not read ${t}: ${e.message}`);
      if (/is_test/.test(e.message)) console.error("The is_test column does not exist yet: nothing can be a test row. Nothing to do.");
      process.exit(1);
    }
    // THE REFUSAL: anything not explicitly is_test === true stops the run.
    const wrong = rows.filter((r) => r.is_test !== true);
    if (wrong.length) {
      console.error(`REFUSED: ${t} returned ${wrong.length} row(s) whose is_test is not true (${ids(wrong).join(", ")}). Nothing was deleted.`);
      process.exit(2);
    }
    selected[t] = rows;
  }

  const total = TABLES.reduce((n, t) => n + selected[t].length, 0);
  console.log(`${APPLY ? "DELETING" : "DRY RUN — would delete"} ${total} test row(s):\n`);
  for (const t of TABLES) {
    console.log(`${t}: ${selected[t].length}`);
    for (const r of selected[t]) {
      console.log(`  - ${r.id}  ${label(r)}  ${r.status ?? r.stage ?? ""}  created ${String(r.created_at ?? "").slice(0, 19)}  is_test=${r.is_test}`);
    }
  }

  // What the foreign keys do on their own, listed so the dry run is complete.
  const leadIds = ids(selected.leads);
  const buildIds = ids(selected.builds);
  if (leadIds.length) {
    const sa = await rest(`scope_acceptances?lead_id=${inList(leadIds)}&select=id,lead_id`).catch(() => []);
    const la = await rest(`lead_activities?lead_id=${inList(leadIds)}&select=id,lead_id`).catch(() => []);
    console.log(`\nAlso removed by ON DELETE CASCADE with those leads: ${sa.length} scope_acceptances, ${la.length} lead_activities.`);
  }
  if (buildIds.length) {
    const cr = await rest(`custom_requests?build_id=${inList(buildIds)}&select=id,title`).catch(() => []);
    const cs = await rest(`client_sites?build_id=${inList(buildIds)}&select=id,slug,status`).catch(() => []);
    console.log(`Also removed by ON DELETE CASCADE with those builds: ${cr.length} custom_requests.`);
    if (cs.length) {
      console.log(`KEPT, build_id set to null by the database: ${cs.length} client_sites — ${cs.map((s) => `${s.slug} (${s.status})`).join(", ")}.`);
      console.log(`  Remove a test site by hand at /admin/sites if you want it gone.`);
    }
  }

  if (!APPLY) {
    console.log(`\nNothing deleted. Re-run with --apply to delete exactly the rows above.`);
    return;
  }

  for (const t of TABLES) {
    const list = ids(selected[t]);
    if (!list.length) continue;
    // Ids AND the tag: a row that is not a test row cannot match this filter.
    const gone = await rest(`${t}?id=${inList(list)}&is_test=eq.true`, {
      method: "DELETE",
      headers: { Prefer: "return=representation" },
    });
    const notTest = (gone ?? []).filter((r) => r.is_test !== true);
    if (notTest.length) {
      // Cannot happen with the filter above; said loudly if it ever does.
      console.error(`ALARM: ${t} deleted ${notTest.length} row(s) not tagged is_test: ${ids(notTest).join(", ")}`);
      process.exit(3);
    }
    console.log(`${t}: deleted ${(gone ?? []).length} of ${list.length}`);
  }
}

main().catch((e) => {
  console.error("Cleanup failed:", e.message);
  process.exit(1);
});
