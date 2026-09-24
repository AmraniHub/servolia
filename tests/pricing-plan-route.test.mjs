/**
 * The /pricing plan route delivers what its receipt promises.
 *
 * Found 2026-09-24 by the Step 6 map (AUTOMATION-PLAN.md): a Essentiel /
 * Croissance / Performance buyer paid, was promised a draft "usually within
 * minutes", and never got one -- the webhook opened their build without the
 * checkout session id the intake looks it up by, and their clients row
 * without the build_id every per-client feature keys on. The receipt's own
 * intake button carried no session id either, and annual buyers read
 * "Your €0 payment".
 *
 *   node --import ./tests/register.mjs --test tests/pricing-plan-route.test.mjs
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const { installationPaidEmail } = await import("../src/lib/email.ts");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = (p) => readFileSync(path.join(ROOT, p), "utf8");

/** The subscription branch of the webhook, alone. */
function subscriptionBranch() {
  const w = src("src/app/api/webhooks/stripe/route.ts");
  const start = w.indexOf("// ── MONTHLY PLAN branch");
  const end = w.indexOf("// ── TOP-UP branch", start);
  assert.ok(start > 0 && end > start, "the branch markers moved");
  return w.slice(start, end);
}

test("the build the webhook opens carries the session id the intake looks it up by", () => {
  const b = subscriptionBranch();
  assert.match(b, /checkout_session_id: session\.id/);
  assert.match(src("src/app/api/contact/route.ts"), /\.eq\("checkout_session_id", sessionId\)/);
});

test("the clients row carries its build, and its monthly worth rather than the checkout total", () => {
  const b = subscriptionBranch();
  assert.match(b, /build_id: buildId/);
  assert.doesNotMatch(b, /monthly_amount: amount,/, "amount_total carried the installation into MRR");
  assert.match(b, /plan\.annualEur \/ 12 : plan\.monthlyEur/);
  // The build is opened BEFORE the client, so the id exists to write.
  assert.ok(b.indexOf('from("builds").insert(') < b.indexOf('from("clients").insert('));
});

test("a redelivered event opens no second client", () => {
  const b = subscriptionBranch();
  const guard = b.indexOf('.eq("subscription_id", subscriptionId)');
  assert.ok(guard > 0 && guard < b.indexOf('from("clients").insert('), "the replay guard runs before the insert");
});

test("an intake that beat the payment starts the build from the lead row", () => {
  const b = subscriptionBranch();
  assert.match(b, /\.eq\("raw_data->>sessionId", session\.id\)/);
  assert.match(b, /startBuildFromIntake\(/);
  // The intake form writes exactly those two keys onto the lead's raw_data.
  const form = src("src/components/OnboardingForm.tsx");
  assert.match(form, /type: "intake", sessionId/);
});

test("the receipt's intake button reaches the paid build", () => {
  const { html } = installationPaidEmail("amine", "Croissance", 690, "en", { sessionId: "cs_test_123", plan: "croissance", billing: "monthly" });
  assert.ok(html.includes("https://servolia.com/onboarding?plan=croissance&amp;session_id=cs_test_123")
    || html.includes("https://servolia.com/onboarding?plan=croissance&session_id=cs_test_123"), "session id on the link");
  const fr = installationPaidEmail("amine", "Croissance", 690, "fr", { sessionId: "cs_test_123", billing: "monthly" });
  assert.ok(fr.html.includes("/fr/demarrage?session_id=cs_test_123"));
  assert.match(subscriptionBranch(), /sessionId: session\.id, plan: planKey, billing/);
});

/* ── review of 2db729c ─────────────────────────────────────────────────── */

test("an intake starts a build only while it waits for one — a live site is never pulled back to draft", () => {
  const lib = src("src/lib/intakeBuild.ts");
  const update = lib.slice(lib.indexOf('from("builds").update('), lib.indexOf("if (updateErr"));
  assert.match(update, /\.eq\("status", "intake"\)/, "the status flip is the claim");
  assert.match(update, /\.select\("id"\)/, "and only a row that actually flipped schedules the draft");
  assert.match(lib, /!claimed\?\.length\) return false/);
  // The founder hears about an intake sent again; the site is not touched.
  assert.match(src("src/app/api/contact/route.ts"), /Intake sent AGAIN/);
});

test("a returning email never ties a new subscription to somebody's existing site", () => {
  const b = subscriptionBranch();
  const reuse = b.slice(b.indexOf("Reuse the newest build"), b.indexOf("if (!buildId) {"));
  assert.match(reuse, /\.eq\("build_id", c\.id\)/, "only a build no client owns");
  assert.match(reuse, /if \(owner\) continue;/);
  assert.doesNotMatch(reuse, /\.eq\("status", "intake"\)/, "by ownership, never by status: a scope client's built site is still hers");
});

/* ── review round 2 ────────────────────────────────────────────────────── */

test("a repeated scope-flow payment event writes and sends nothing", () => {
  const w = src("src/app/api/webhooks/stripe/route.ts");
  const found = w.slice(w.indexOf('.eq("checkout_session_id", sessionId)'), w.indexOf("Auto-create a scope acceptance"));
  assert.match(found, /\} else \{[\s\S]*return NextResponse\.json\(\{ received: true, already: true \}\);/);
  assert.doesNotMatch(found.slice(found.indexOf("} else {")), /status: "intake"/, "a live site is never sent back to intake");
});

test("an installation paid twice is flagged for a refund; a reused waiting build still gets its intake email", () => {
  const b = subscriptionBranch();
  assert.match(b, /INSTALLATION CHARGED TWICE/);
  assert.match(b, /buildOpened \|\| \(buildReused && reusedStatus === "intake"\)/);
});

test("the subscription's own intake finds a reused build through Stripe's record of the session", () => {
  const contact = src("src/app/api/contact/route.ts");
  assert.match(contact, /checkout\.sessions\.retrieve\(String\(sessionId\)\)/);
  assert.match(contact, /s\.status === "complete"/, "only a paid session");
  assert.match(contact, /s\.metadata\?\.kind === "care_plan"/, "only a plan session, never a top-up paid with her address");
  assert.match(contact, /s\.customer_details\?\.email/, "Stripe's email, never the form's");
});

test("the plan client's email is stored lowercase, as the portal login cookie is", () => {
  assert.match(subscriptionBranch(), /email: customerEmail \? customerEmail\.toLowerCase\(\) : null/);
});

test("the receipt's intake link tells the thank-you screen which plan terms apply", () => {
  const { html } = installationPaidEmail("amine", "Croissance", 1490, "en", { sessionId: "cs_test_9", billing: "annual" });
  assert.ok(/subscribed=1(&amp;|&)billing=annual/.test(html));
});

test("a lost race or a failed insert is answered so Stripe does the right thing", () => {
  const b = subscriptionBranch();
  assert.match(b, /clientErr\?\.code === "23505"/, "the parallel delivery won: 200, already");
  assert.match(b, /if \(buildOpened && buildId\) await db\.from\("builds"\)\.delete\(\)/, "our own build undone");
  assert.match(b, /status: 500/, "a real failure is retried, never answered 200");
  // Two rows with one session id must not drop the intake.
  const contact = src("src/app/api/contact/route.ts");
  const look = contact.slice(contact.indexOf('.eq("checkout_session_id", sessionId)'), contact.indexOf("if (build) {"));
  assert.match(look, /\.limit\(1\)/);
});

test("the monthly worth is stored to the cent", () => {
  assert.match(subscriptionBranch(), /Math\.round\(\(billing === "annual" \? plan\.annualEur \/ 12 : plan\.monthlyEur\) \* 100\) \/ 100/);
});

test("an annual buyer is never told they paid for an installation", () => {
  const annual = installationPaidEmail("amine", "Essentiel", 1490, "en", { billing: "annual" }).html;
  assert.doesNotMatch(annual, /installation is confirmed/i);
  assert.doesNotMatch(annual, /paid for my installation/i);
  const monthly = installationPaidEmail("amine", "Essentiel", 690, "en", { billing: "monthly" }).html;
  assert.match(monthly, /installation is confirmed/i);
});

test("the intake's thank-you screen says what the plan checkout did", () => {
  const form = src("src/components/OnboardingForm.tsx");
  assert.match(form, /params\.get\("subscribed"\) === "1"/);
  assert.match(form, /d\.planLine\[billing\]/);
  assert.match(form, /7 days after your payment/);
  assert.match(form, /7 jours après votre paiement/);
  assert.doesNotMatch(form, /nothing more to pay/);
  assert.doesNotMatch(form, /plus rien à régler"/);
});

test("every caller of /api/billing-portal has a handler for its method", () => {
  const route = src("src/app/api/billing-portal/route.ts");
  for (const f of ["src/components/PortalDashboard.tsx", "src/app/billing/page.tsx"]) {
    if (src(f).includes('fetch("/api/billing-portal", { method: "POST" })')) {
      assert.match(route, /export async function POST\(/, `${f} POSTs; without a POST handler every click answers 405`);
    }
  }
  assert.match(route, /export async function GET\(/, "the emailed link is a GET");
  // The logged-in client's email comes from the signed cookie, and is matched exactly.
  const post = route.slice(route.indexOf("export async function POST("));
  assert.match(post, /getClientEmail\(\)/);
  assert.doesNotMatch(post, /\.ilike\(/, "ilike treats _ as a wildcard: marie_dubois@ would match another client");
});

test("the receipt says what the checkout did: 7-day trial monthly, the year paid annually", () => {
  const monthly = installationPaidEmail("amine", "Essentiel", 690, "en", { billing: "monthly" }).html;
  assert.match(monthly, /starts 7 days after your payment/);
  assert.doesNotMatch(monthly, /once the site is live/);
  const annual = installationPaidEmail("amine", "Essentiel", 1490, "en", { billing: "annual" }).html;
  assert.match(annual, /€1,490 payment/);
  assert.match(annual, /Your year is paid for/);
  const annualFr = installationPaidEmail("amine", "Essentiel", 1490, "fr", { billing: "annual" }).html;
  assert.match(annualFr, /Votre année est réglée/);
  // The webhook passes what was charged, never the (waived) installation.
  assert.match(subscriptionBranch(), /installationPaidEmail\(firstName, planLabel, amount, emailLang/);
});
