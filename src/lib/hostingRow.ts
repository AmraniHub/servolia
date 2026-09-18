import { supabaseAdmin } from "@/lib/supabase";
import { CLIENT_REFS } from "@/lib/clientRefs";

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
  const { data, error } = await db.from("hosting_clients").select(COLUMNS).ilike("email", email).limit(2);
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

/** Replace a row's notes. Keyed on the row's own id, which always exists. */
export async function saveNotes(row: HostingRow, notes: string): Promise<string | null> {
  const db = supabaseAdmin();
  if (!db) return "no database";
  const { error } = await db.from("hosting_clients").update({ notes }).eq("id", row.id);
  return error ? error.message : null;
}
