/**
 * "Next payments" on a hosting client's admin page.
 *   node --import ./tests/register.mjs --test tests/next-payments.test.mjs
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { nextPaymentsFrom } from "../src/lib/nextPayments.ts";

const ts = (d) => Date.parse(`${d}T21:21:17Z`) / 1000;
const sub = (over = {}) => ({
  status: "trialing", cancel_at_period_end: false, cancel_at: null, trial_end: ts("2026-10-09"),
  default_payment_method: "pm_1",
  items: { data: [{ current_period_end: ts("2026-10-09"), price: { unit_amount: 6600, currency: "usd", recurring: { interval: "year" } } }] },
  ...over,
});
// Ithar Digital's row, as written by the owned-domain hosting link (2026-09-25).
const ITHAR = "servolia-owned-domain: ithardigital.com | price: 27.90 | paid: 2026-09-25 | renews: 2027-09-18 | project: ithar-digital | bought: no (already ours)";

test("a free period: the first year on its end date, then the domain", () => {
  const list = nextPaymentsFrom(sub(), ITHAR, "Hosting Essential");
  assert.deepEqual(list.map((p) => [p.what, p.amount, p.currency, p.date]), [
    ["Hosting Essential: first year", 66, "USD", "2026-10-09"],
    ["Domain ithardigital.com: next year", 27.9, "USD", "2027-09-18"],
  ]);
  assert.match(list[0].note, /free period ends; charged automatically to the saved card/);
  assert.match(list[1].note, /on its own invoice/);
});

test("an active plan shows its renewal", () => {
  const [p] = nextPaymentsFrom(sub({ status: "active", trial_end: null, items: { data: [{ current_period_end: ts("2027-09-15"), price: { unit_amount: 8800, currency: "usd", recurring: { interval: "year" } } }] } }), "", "Hosting");
  assert.deepEqual([p.what, p.amount, p.date, p.kind], ["Hosting: renewal (per year)", 88, "2027-09-15", "hosting"]);
});

test("a plan set to cancel charges nothing, and neither does its domain after that", () => {
  const list = nextPaymentsFrom(sub({ status: "active", trial_end: null, cancel_at_period_end: true }), ITHAR, "Hosting Essential");
  assert.equal(list[0].kind, "ending");
  assert.equal(list[0].amount, null);
  assert.match(list[1].note, /not charged: the hosting ends first/);
});

test("an overdue plan says so", () => {
  const [p] = nextPaymentsFrom(sub({ status: "past_due" }), "", "Hosting");
  assert.equal(p.kind, "overdue");
  assert.match(p.note, /last charge failed/);
});

test("no subscription and no domain: nothing", () => {
  assert.deepEqual(nextPaymentsFrom(null, "", "Hosting"), []);
});
