import type Stripe from "stripe";
import { excludeTest } from "@/lib/testContext";

/**
 * ONE STRIPE CUSTOMER PER CLIENT, AND WHICH SUBSCRIPTION AN INVOICE IS FOR.
 *
 * Every checkout used to pass only `customer_email`, so Stripe created a new
 * Customer on each purchase: a client who paid twice had two customers, two
 * subscriptions, and a billing portal that could only ever open one of them.
 * The checkouts now ask here for the customer already on file for that
 * address and pass it as `customer`, so a second purchase lands on the same
 * account (one card, one portal, one invoice history).
 *
 * THE CURRENCY RULE. EUR checkouts (plans, add-ons, top-ups, receptionist,
 * installation) reuse a customer from `clients`; USD hosting checkouts reuse
 * one from `hosting_clients`. Never across the two: Stripe refuses to mix
 * currencies on one customer while a subscription or invoice item in the
 * other currency is open, and a refused checkout is a lost sale.
 *
 * THE MODE RULE. A founder test checkout only ever reuses a TEST row's
 * customer (it exists only under the test key); a live checkout never does.
 */

type Row = Record<string, unknown>;

/** The subscription an invoice belongs to, or null for a standalone invoice.
 *
 * From API version 2025-03-31 (basil) on, and so under the dahlia version the
 * SDK pins, an Invoice has NO top-level `subscription`: it is at
 * `parent.subscription_details.subscription`. Reading the old field yields
 * undefined, which made every subscription invoice look standalone (and the
 * failure email never went). Older payloads (a resent old event, the test
 * harness) still carry the top-level field, so both are read. Either may be
 * an id or an expanded object. */
export function invoiceSubscriptionId(inv: unknown): string | null {
  const i = inv as {
    parent?: { subscription_details?: { subscription?: string | { id?: string } | null } | null } | null;
    subscription?: string | { id?: string } | null;
  } | null;
  const raw = i?.parent?.subscription_details?.subscription ?? i?.subscription ?? null;
  if (!raw) return null;
  if (typeof raw === "string") return raw || null;
  return typeof raw.id === "string" && raw.id ? raw.id : null;
}

/** The customer id on an invoice / subscription / session, whatever its shape. */
export function customerIdOf(x: unknown): string | null {
  const c = (x as { customer?: string | { id?: string } | null } | null)?.customer;
  if (!c) return null;
  if (typeof c === "string") return c;
  return typeof c.id === "string" ? c.id : null;
}

/** Two addresses are the same mailbox: trimmed, case-insensitive, exact. */
export function sameEmail(a: unknown, b: unknown): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const x = a.trim().toLowerCase();
  return x !== "" && x === b.trim().toLowerCase();
}

const BACKSLASH = String.fromCharCode(92);

/** An address as an `ilike` pattern that matches only itself (case aside):
 *  `%` and `_` are wildcards there, so `marie_dubois@` would also match
 *  `marieXdubois@`. Escaped here, AND every caller filters the rows again
 *  with sameEmail, because PostgREST also reads `*` as a wildcard. */
export function exactLikePattern(email: string): string {
  let out = "";
  for (const ch of email.trim()) {
    out += ch === "%" || ch === "_" || ch === BACKSLASH ? BACKSLASH + ch : ch;
  }
  return out;
}

type Query = {
  select(cols: string): Query;
  ilike(col: string, v: string): Query;
  eq(col: string, v: unknown): Query;
  in(col: string, v: unknown[]): Query;
  order(col: string, o: { ascending: boolean }): Query;
  limit(n: number): PromiseLike<{ data: unknown; error: unknown }>;
};
type FromDb = { from(t: string): unknown };

/**
 * Rows of `table` whose `email` is exactly this address (case-insensitive),
 * newest first. `test` true: test rows only; false: never a test row.
 * `statuses` narrows to those statuses when given.
 */
export async function rowsForEmail<T extends Row = Row>(
  db: unknown,
  table: "clients" | "hosting_clients",
  cols: string,
  email: string | null | undefined,
  opts: { test: boolean; statuses?: string[] },
): Promise<T[]> {
  const addr = (email ?? "").trim();
  if (!db || !addr) return [];
  const { data } = await excludeTest(db, (live) => {
    let q = ((db as FromDb).from(table) as Query).select(cols.includes("email") ? cols : `${cols}, email`).ilike("email", exactLikePattern(addr));
    if (opts.statuses?.length) q = q.in("status", opts.statuses);
    q = opts.test ? q.eq("is_test", true) : live(q);
    return q.order("created_at", { ascending: false }).limit(25);
  });
  return ((Array.isArray(data) ? data : []) as T[]).filter((r) => sameEmail(r.email, addr));
}

/** Customer ids Stripe answered "No such customer" for, in this instance:
 *  never offered again (withStaleCustomerRetry). The rows are NOT rewritten —
 *  the same answer can come from a mode mismatch, and wiping a live id would
 *  be worse than one wasted call per cold start. */
const staleCustomers = new Set<string>();

/** Tests only. */
export function __forgetStaleCustomersForTests(): void {
  staleCustomers.clear();
}

/** The Stripe customer already on file for this address in `table`, or null.
 *  The newest row that carries one wins (a returning client's latest account). */
export async function knownStripeCustomer(
  db: unknown,
  table: "clients" | "hosting_clients",
  email: string | null | undefined,
  test: boolean,
): Promise<string | null> {
  try {
    const rows = await rowsForEmail<{ customer_id?: string | null }>(db, table, "id, customer_id, created_at", email, { test });
    const hit = rows.find((r) => typeof r.customer_id === "string" && r.customer_id.startsWith("cus_") && !staleCustomers.has(r.customer_id));
    return hit?.customer_id ?? null;
  } catch {
    // A lookup that fails must not cost the sale: Stripe makes a customer as before.
    return null;
  }
}

/**
 * Who pays, as Checkout wants it: the existing customer when there is one
 * (`customer_update` lets Checkout save the billing name, address and tax ID
 * it collects onto that customer, which Stripe requires with tax ID
 * collection), else the address, else nothing (Stripe asks).
 */
export function buyerFields(customerId: string | null, email: string | null | undefined): Pick<Stripe.Checkout.SessionCreateParams, "customer" | "customer_email" | "customer_update"> {
  if (customerId) return { customer: customerId, customer_update: { name: "auto", address: "auto" } };
  const addr = (email ?? "").trim();
  return addr ? { customer_email: addr } : {};
}

/** Stripe's answer for a customer id it does not have (deleted, or another mode). */
export function isMissingCustomer(err: unknown): boolean {
  const e = err as { code?: string; param?: string; message?: string; raw?: { code?: string; param?: string } } | null;
  const code = e?.code ?? e?.raw?.code;
  const param = e?.param ?? e?.raw?.param;
  return code === "resource_missing" && (param === "customer" || /no such customer/i.test(String(e?.message ?? "")));
}

type SessionsApi = { checkout: { sessions: { create(params: Stripe.Checkout.SessionCreateParams, options?: Stripe.RequestOptions): Promise<Stripe.Response<Stripe.Checkout.Session>> } } };

/**
 * The same Stripe client, except that a checkout naming a stored customer
 * Stripe no longer has ("No such customer", resource_missing) is retried ONCE
 * as a new customer — with `fallbackEmail` prefilled — and that id is not
 * offered again in this instance. Without it, one deleted customer in Stripe
 * would make that client's every checkout fail. Anything else is rethrown.
 * Call sites keep their literal `stripe.checkout.sessions.create({...})`.
 */
export function withStaleCustomerRetry(stripe: SessionsApi, fallbackEmail: string | null | undefined): SessionsApi {
  return {
    checkout: {
      sessions: {
        async create(params, options) {
          try {
            return await stripe.checkout.sessions.create(params, options);
          } catch (err) {
            if (!params.customer || !isMissingCustomer(err)) throw err;
            staleCustomers.add(params.customer);
            console.warn(`[checkout] stored Stripe customer ${params.customer} is missing in Stripe: retrying as a new customer`);
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { customer, customer_update, ...rest } = params;
            const addr = (fallbackEmail ?? "").trim();
            return stripe.checkout.sessions.create({
              ...rest,
              ...(addr ? { customer_email: addr } : {}),
              ...(rest.mode === "payment" ? { customer_creation: "always" as const } : {}),
            }, options);
          }
        },
      },
    },
  };
}

/**
 * B2B VAT, Servolia LLC being a non-EU seller to businesses (mostly French):
 * the buyer can give their VAT number (reverse charge — they account for the
 * VAT, src/lib/vat.ts), which needs a billing address. A payment-mode
 * session also gets a real Stripe INVOICE (a receipt is not an invoice), and
 * a real customer so the next purchase can reuse it. Deliberately NOT
 * automatic_tax and NOT Managed Payments: no VAT is charged by Stripe.
 */
export function businessTaxFields(mode: "payment" | "subscription", hasCustomer: boolean): Pick<Stripe.Checkout.SessionCreateParams, "tax_id_collection" | "billing_address_collection" | "invoice_creation" | "customer_creation"> {
  return {
    tax_id_collection: { enabled: true },
    billing_address_collection: "required",
    ...(mode === "payment"
      ? { invoice_creation: { enabled: true }, ...(hasCustomer ? {} : { customer_creation: "always" as const }) }
      : {}),
  };
}

/** Subscription statuses that still bill (or are about to). */
export const LIVE_SUB_STATUSES = new Set(["active", "trialing", "past_due", "unpaid", "incomplete"]);
/** Row statuses that mean "we think this client is paying". */
export const LIVE_ROW_STATUSES = ["active", "past_due", "paused", "suspended"];
