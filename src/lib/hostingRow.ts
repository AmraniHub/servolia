import { supabaseAdmin } from "@/lib/supabase";
import { CLIENT_REFS, knownSiteUrl } from "@/lib/clientRefs";
import { excludeTest } from "@/lib/testContext";

/**
 * FINDING A CLIENT'S BILLING ROW, THE WAY THE REST OF THIS CODEBASE DOES.
 *
 * `hosting_clients` is keyed on EMAIL. There is no `client_ref` column — the
 * reference is ours, it lives in clientRefs.ts, and the email is the bridge
 * between the two. assistantTrial.ts and assistantAccess.ts have always done
 * it this way; this module exists so it is done once instead of four times.
 *
 * WHY THIS IS WORTH A FILE. A query on a column that does not exist does not
 * throw here — PostgREST answers with an error object and supabase-js hands
 * back `data: null`. Which reads exactly like "no such client". So a password
 * change silently did nothing, a copy request silently did nothing, and a
 * sign-in silently refused a correct password, all with the same shrug. The
 * editor kept working only because it falls back to an environment variable,
 * which hid the fault behind the one path that did not need the row.
 *
 * If a lookup here ever returns null for a client who certainly exists, check
 * the COLUMN NAMES before checking anything else.
 */

export interface HostingRow {
  id: string;
  email: string | null;
  business: string | null;
  plan: string | null;
  status: string | null;
  notes: string | null;
  subscription_id: string | null;
}

const COLUMNS = "id, email, business, plan, status, notes, subscription_id";

/** The client reference behind an email address, if we know one. */
export function refForEmail(email: string | null | undefined): string | null {
  const wanted = (email ?? "").trim().toLowerCase();
  if (!wanted) return null;
  for (const [ref, client] of Object.entries(CLIENT_REFS)) {
    if ((client.email ?? "").trim().toLowerCase() === wanted) return ref;
  }
  return null;
}

/** The billing row for one of our client references. */
export async function rowForRef(ref: string): Promise<HostingRow | null> {
  const email = CLIENT_REFS[ref.trim().toLowerCase()]?.email;
  if (!email) return null;
  const db = supabaseAdmin();
  if (!db) return null;
  // `is_test is not true`: a founder test row is never a client's billing row.
  const { data, error } = await excludeTest(db, (live) => live(db.from("hosting_clients").select(COLUMNS).ilike("email", email)).limit(2));
  if (error) {
    console.error("[hosting-row] lookup failed:", error.message);
    return null;
  }
  const rows = (data ?? []) as HostingRow[];
  // More than one row for an address is a data problem, not a client.
  return rows.length === 1 ? rows[0] : null;
}

/** The billing row behind a Stripe subscription. */
export async function rowForSubscription(subscriptionId: string): Promise<HostingRow | null> {
  const db = supabaseAdmin();
  if (!db) return null;
  const { data, error } = await db
    .from("hosting_clients")
    .select(COLUMNS)
    .eq("subscription_id", subscriptionId)
    .maybeSingle();
  if (error) {
    console.error("[hosting-row] lookup failed:", error.message);
    return null;
  }
  return (data as HostingRow) ?? null;
}

/**
 * Fill in a blank `site_url` from the address the client's reference already
 * carries. Runs on the daily pass; idempotent, and it never overwrites.
 *
 * WHY THIS IS A JOB AND NOT A FORM FIELD. site_url is typed in by hand when a
 * client is set up, so it is blank whenever anyone forgot — and that blank is
 * the link in the CRM and the address the client reads in their own
 * assistant-trial email. Both live clients had it blank while their domains
 * had been sitting in CLIENT_REFS since the day they were onboarded.
 *
 * It touches ONE column. `notes` carries the trial record, the invite marker
 * and the editor password hash, and the handover endpoint next door rebuilds
 * that column from scratch — which is exactly the mistake this must not copy.
 */
export async function backfillSiteUrls(): Promise<{ filled: string[]; errors: string[] }> {
  const filled: string[] = [];
  const errors: string[] = [];
  const db = supabaseAdmin();
  if (!db) return { filled, errors: ["no-db"] };

  const { data, error } = await db.from("hosting_clients").select("id, email, site_url");
  if (error) return { filled, errors: [error.message] };

  for (const row of (data ?? []) as { id: string; email: string | null; site_url: string | null }[]) {
    if (row.site_url && row.site_url.trim()) continue;
    const url = knownSiteUrl(refForEmail(row.email));
    if (!url) continue;
    const { error: bad } = await db.from("hosting_clients").update({ site_url: url }).eq("id", row.id);
    if (bad) errors.push(`${row.email}: ${bad.message}`);
    else filled.push(`${row.email} -> ${url}`);
  }
  return { filled, errors };
}

/** Replace a row's notes. Keyed on the row's own id, which always exists. */
export async function saveNotes(row: HostingRow, notes: string): Promise<string | null> {
  const db = supabaseAdmin();
  if (!db) return "no database";
  const { error } = await db.from("hosting_clients").update({ notes }).eq("id", row.id);
  return error ? error.message : null;
}
