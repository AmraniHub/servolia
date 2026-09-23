/**
 * C4 — the number that renews her: booking requests taken by the
 * receptionist, counted apart from the site form's requests, identically in
 * the 1st's email, the 5th's narrative and her portal.
 *
 *   node --import ./tests/register.mjs --test tests/report-metrics.test.mjs
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { reportMetrics, isAfterHours, isFormRequest } from "../src/lib/reportMetrics.ts";
import { monthlyReportEmail } from "../src/lib/email.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = (p) => readFileSync(path.join(ROOT, p), "utf8");
const code = (p) => src(p).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

// Tuesday 2026-08-11, 10:00 UTC = 12:00 Paris = 11:00 Casablanca.
const DAY = "2026-08-11T10:00:00.000Z";
// Tuesday 2026-08-11, 17:30 UTC = 19:30 Paris (closed) = 18:30 Casablanca (open).
const EVENING = "2026-08-11T17:30:00.000Z";
// Sunday 2026-08-16, 10:00 UTC.
const SUNDAY = "2026-08-16T10:00:00.000Z";

const chat = (id, at, qualified, utm = null) => ({ session_id: id, created_at: at, qualified, utm });

test("a form request is never counted as a booking by the receptionist", () => {
  const m = reportMetrics([
    chat("abc", DAY, true),
    chat("def", DAY, false),
    chat("form_cabinet_1", DAY, true),
    chat("form_cabinet_2", DAY, true),
  ]);
  assert.equal(m.receptionistBookings, 1);
  assert.equal(m.conversations, 2);
  assert.equal(m.formRequests, 2);
  assert.equal(m.bookings, 3, "the old total survives for older readers");
  assert.equal(m.enquiries, 4);
  assert.ok(isFormRequest({ session_id: "form_x" }) && !isFormRequest({ session_id: null }));
});

test("after hours is judged in her own zone, Sundays included", () => {
  assert.equal(isAfterHours(new Date(EVENING), "Europe/Paris"), true);
  assert.equal(isAfterHours(new Date(EVENING), "Africa/Casablanca"), false);
  assert.equal(isAfterHours(new Date(DAY), "Europe/Paris"), false);
  assert.equal(isAfterHours(new Date(SUNDAY), "Europe/Paris"), true);
  const rows = [chat("a", EVENING, false), chat("b", DAY, false), chat("form_c", EVENING, true)];
  assert.equal(reportMetrics(rows, { timeZone: "Europe/Paris" }).afterHours, 1, "form requests are not the receptionist's after-hours work");
  assert.equal(reportMetrics(rows, { timeZone: "Africa/Casablanca" }).afterHours, 0);
});

test("the euro line is what covers her plan, never requests times a treatment value", () => {
  const m = reportMetrics([chat("a", DAY, true)], { planEur: 249, niche: "dental" });
  assert.equal(m.perClient, 800);
  assert.equal(m.perClientIsHers, false);
  assert.equal(m.coverNeeded, 1);
  const own = reportMetrics([], { planEur: 449, avgTreatmentValue: 150 });
  assert.equal(own.coverNeeded, 3);
  assert.equal(own.perClientIsHers, true);
  assert.equal(reportMetrics([], {}).coverNeeded, null, "no plan, no cover line");
  assert.ok(!("estValue" in m));
});

test("her email leads with the receptionist's number, in her language", () => {
  const m = reportMetrics([chat("a", DAY, true), chat("b", DAY, true), chat("form_1", DAY, true)], { planEur: 249, niche: "dental" });
  const fr = monthlyReportEmail({ businessName: "Cabinet <Test>", period: "août 2026", lang: "fr", metrics: m });
  assert.match(fr.subject, /2 demandes de rendez-vous prises par votre réceptionniste en août 2026/);
  assert.ok(fr.html.includes('lang="fr"'), "the French email is marked French");
  assert.ok(fr.html.includes("2 demandes de rendez-vous prises par votre réceptionniste."), "preheader in French");
  assert.ok(fr.html.includes("Cabinet &lt;Test&gt;"), "her business name is escaped");
  assert.ok(!/Valeur estimée/.test(fr.html), "no invented euro value");
  assert.ok(fr.html.includes("il suffit de <strong>1 nouveau patient</strong>"));
  const en = monthlyReportEmail({ businessName: "Clinic", period: "August 2026", lang: "en", metrics: { ...m, receptionistBookings: 1 } });
  assert.match(en.subject, /1 booking request taken by your receptionist/);
  const none = monthlyReportEmail({ businessName: "Clinic", period: "August 2026", lang: "en", metrics: { ...m, receptionistBookings: 0 } });
  assert.equal(none.subject, "Clinic — your report for August 2026");
});

test("one definition for the 1st, the 5th and the alert badge", () => {
  const first = code("src/app/api/cron/monthly-report/route.ts");
  assert.ok(first.includes("reportMetrics(sessions,") && first.includes('.select("session_id, created_at, qualified, utm")'));
  assert.ok(first.includes("timeZone: site.timezone"));
  assert.ok(!first.includes("getUTCHours"), "no more UTC+1 guess");
  const fifth = code("src/app/api/cron/client-reports/route.ts");
  assert.ok(fifth.includes("reportMetrics(rows,") && fifth.includes("qualified: m.receptionistBookings"));
  assert.ok(!fifth.includes("Amélioration prévue"), "a suggestion is not a promised change");
  assert.ok(code("src/lib/clientNotify.ts").includes('import { isAfterHours } from "@/lib/reportMetrics"'));
});

test("a booking stays a booking when the patient writes again", () => {
  const r = code("src/app/api/chat/route.ts");
  assert.ok(r.includes("qualified: isBooking || !!(existing as { qualified?: boolean } | null)?.qualified"));
  assert.ok(!/qualified: isBooking,/.test(r), "no write that can un-count a booking");
});

test("her portal shows the same split", () => {
  const ui = src("src/components/PortalDashboard.tsx");
  assert.ok(ui.includes("t.rReception, value: r.metrics.receptionistBookings"));
  assert.ok(ui.includes("t.coverLine("));
});
