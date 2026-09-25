#!/usr/bin/env node
/**
 * Remove what founder test mode left behind — and NOTHING else.
 *
 *   node scripts/test-mode-cleanup.mjs            # dry run: prints every row it would delete
 *   node scripts/test-mode-cleanup.mjs --apply    # deletes exactly those rows
 *
 * The same logic runs behind the "Find test records" button at
 * /admin/settings (POST /api/admin/test-mode/cleanup), which needs no key on
 * this machine. Both use src/lib/testCleanup.ts — read its header for the
 * rules: rows are selected ONLY by is_test = true, every row is re-checked
 * and the run refused if one is not a test row, each DELETE carries
 * is_test=eq.true, a receptionist trial that a test purchase marked paid is
 * reverted, and Stripe and Vercel are never touched.
 *
 * Exit codes: 0 done, 1 could not run, 2 refused (nothing deleted),
 * 3 ALARM (a delete answered with a row that was not a selected test row).
 *
 * Reads NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from the
 * environment, else .env.local / .env (process.env wins).
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
// Plain node loads this .ts (Node 22 strips types); it has no imports of its own.
import { planCleanup, applyCleanup, restClient, CleanupRefused, TEST_TABLES } from "../src/lib/testCleanup.ts";

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
const URL_BASE = (ENV.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
const KEY = (ENV.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
if (!URL_BASE || !KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (env or .env.local).");
  console.error("No key on this machine? Use the button instead: /admin/settings > Test records > Find test records.");
  process.exit(1);
}

async function main() {
  const rest = restClient(URL_BASE, KEY);
  const plan = await planCleanup(rest);

  console.log(`${APPLY ? "DELETING" : "DRY RUN — would delete"} ${plan.total} test row(s):\n`);
  for (const t of TEST_TABLES) {
    const items = plan.items.filter((i) => i.table === t);
    console.log(`${t}: ${items.length}`);
    for (const i of items) {
      console.log(`  - ${i.id}  ${i.label}  ${i.state}  created ${i.createdAt}  is_test=true`);
      for (const m of i.carries) console.log(`      with it: ${m}`);
    }
  }

  const casc = (w) => plan.cascades.filter((c) => c.with === w).map((c) => `${c.count ?? "?"} ${c.table}`).join(", ");
  if (plan.selected.leads.length) console.log(`\nAlso removed by ON DELETE CASCADE with those leads: ${casc("leads")}.`);
  if (plan.selected.builds.length) console.log(`Also removed by ON DELETE CASCADE with those builds: ${casc("builds")}.`);
  for (const r of plan.reverts) {
    console.log(`REVERT receptionist trial ${r.slug} (${r.id}): paidAt ${r.paidAt} -> removed, plan ${r.plan ?? "-"} -> removed, status ${r.status} -> draft, build_id ${r.buildId} -> null.`);
  }
  if (plan.kept.length) {
    console.log(`KEPT, build_id set to null by the database: ${plan.kept.length} client_sites — ${plan.kept.map((s) => `${s.slug} (${s.status})`).join(", ")}.`);
    console.log(`  Remove a test site by hand at /admin/sites if you want it gone.`);
  }

  if (!APPLY) {
    console.log(`\nNothing deleted. Re-run with --apply to delete exactly the rows above.`);
    return;
  }

  const result = await applyCleanup(rest, plan);
  for (const r of result.reverted) {
    console.log(`client_sites ${r.slug}: ${r.ok ? "reverted to a running trial" : "NOT reverted (row changed since it was read)"}`);
  }
  for (const t of TEST_TABLES) {
    if (result.requested[t]) console.log(`${t}: deleted ${result.deleted[t]} of ${result.requested[t]}`);
  }
}

main().catch((e) => {
  if (e instanceof CleanupRefused) {
    console.error(e.message);
    process.exit(e.reason === "alarm" ? 3 : e.reason === "no-column" ? 1 : 2);
  }
  console.error("Cleanup failed:", e.message);
  process.exit(1);
});
