import { NextRequest, NextResponse } from "next/server";
import { SETUP_PLAN } from "@/lib/pricing";
import { isAdminAuthed } from "@/lib/auth";
import {
  auditConfirmationEmail,
  auditInProgressEmail,
  installationPaidEmail,
  portalLoginEmail,
  newPortalMessageEmail,
  scopeAcceptedEmail,
  monthlyReportEmail,
  liveEmail,
  clientServicePaidEmail,
  balanceSettledEmail,
  upgradeLinkEmail,
  upgradeDoneEmail,
  reactivateEmail,
  sendEmail,
  currentFrom,
} from "@/lib/email";
import { CLIENT_PRODUCTS, nextChargeDate, productCopy } from "@/lib/hosting";
import { CLIENT_REFS } from "@/lib/clientRefs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Render any transactional email in the browser, with sample data.
 *
 * Email is the one surface you cannot check by looking at the app: it is
 * assembled server-side, sent once, and seen first by the person whose
 * opinion matters most. Previously the only way to see a template was to
 * trigger the real event.
 *
 *   /api/admin/email-preview                        → index of every template
 *   /api/admin/email-preview?t=live&lang=fr         → that template, rendered
 *   /api/admin/email-preview?t=live&raw=1           → the HTML source
 *   /api/admin/email-preview?t=X&send=you@mail.com  → actually SEND it
 *
 * The send mode exists because rendering proves the markup and nothing else.
 * What a client sees first is the FROM line, and that is exactly the part no
 * preview can show: EMAIL_FROM is marked Sensitive in Vercel, so its value
 * cannot be read back from the dashboard or the CLI. A real send through the
 * real transport is the only way to see what leaves.
 *
 * It cannot be used to test the payment path any other way, either: the Stripe
 * webhook drops every test-mode event before it reaches an email, so a test
 * card produces silence by design.
 */

type Built = { subject: string; html: string };

function build(id: string, lang: "en" | "fr"): Built | null {
  switch (id) {
    case "audit-confirmation":
      return auditConfirmationEmail("Amine", lang);
    case "audit-in-progress":
      return auditInProgressEmail("Amine");
    case "installation-paid":
      return installationPaidEmail("Amine", "Croissance", SETUP_PLAN.totalEur, lang);
    case "portal-login":
      return portalLoginEmail("https://servolia.com/portal/login?token=sample", lang);
    case "portal-message":
      return newPortalMessageEmail("Amine", "Bonjour, votre nouvelle page est prete a relire.", lang);
    case "scope-accepted":
      return scopeAcceptedEmail("Cabinet Dentaire Metay", "Dr Metay", new Date().toISOString(), "Site 5 pages + standard IA");
    case "monthly-report":
      return monthlyReportEmail({
        businessName: "Cabinet Dentaire Metay",
        period: "July 2026",
        lang,
        enquiries: 148,
        bookings: 37,
        afterHours: 52,
        fromAds: 19,
        estValue: 7400,
      });
    case "live":
      return liveEmail("Amine", "https://servolia.com/sites/cabinet-metay", lang);
    /* The client-services line (USD). Three variants because the wording
       genuinely differs: an annual buyer is shown a saving, and a client whose
       suspended add-on has just come back is told so. */
    case "hosting-paid": {
      const c = productCopy(CLIENT_PRODUCTS.hosting, lang);
      return clientServicePaidEmail({
        lang,
        productName: c.heading,
        productNoun: c.sentenceName,
        siteLabel: "goodscochina.com",
        amountUsd: CLIENT_PRODUCTS.hosting.annualUsd,
        period: "annual",
        nextChargeIso: nextChargeDate(new Date(), "annual").toISOString(),
        monthlyUsd: CLIENT_PRODUCTS.hosting.monthlyUsd,
        includes: c.includes,
      });
    }
    case "chatbot-restored": {
      const c = productCopy(CLIENT_PRODUCTS.chatbot, lang);
      return clientServicePaidEmail({
        lang,
        productName: c.heading,
        productNoun: c.sentenceName,
        siteLabel: "temghid.ma",
        amountUsd: CLIENT_PRODUCTS.chatbot.monthlyUsd,
        period: "monthly",
        nextChargeIso: nextChargeDate(new Date(), "monthly").toISOString(),
        monthlyUsd: CLIENT_PRODUCTS.chatbot.monthlyUsd,
        restored: true,
        includes: c.includes,
      });
    }
    case "balance-settled":
      return balanceSettledEmail({
        lang,
        siteLabel: "excellenceagency.ma",
        amountUsd: 15,
        label: lang === "fr" ? "Hébergement impayé — juillet et août" : "Unpaid hosting — July and August",
      });
    case "upgrade-offer": {
      const c = productCopy(CLIENT_PRODUCTS.chatbot, lang);
      return upgradeLinkEmail({
        lang,
        url: "https://servolia.com/hosting/upgrade?t=sample",
        productName: c.heading,
        siteLabel: "temghid.ma",
        monthlyUsd: CLIENT_PRODUCTS.chatbot.monthlyUsd,
        annualUsd: CLIENT_PRODUCTS.chatbot.annualUsd,
        savingUsd: CLIENT_PRODUCTS.chatbot.monthlyUsd * 12 - CLIENT_PRODUCTS.chatbot.annualUsd,
      });
    }
    case "upgrade-done": {
      const c = productCopy(CLIENT_PRODUCTS.chatbot, lang);
      return upgradeDoneEmail({
        lang,
        productName: c.heading,
        productNoun: c.sentenceName,
        siteLabel: "temghid.ma",
        annualUsd: CLIENT_PRODUCTS.chatbot.annualUsd,
        savingUsd: CLIENT_PRODUCTS.chatbot.monthlyUsd * 12 - CLIENT_PRODUCTS.chatbot.annualUsd,
      });
    }
    /* The real reactivation nudge for Temghid: a live link, not sample data,
       because this template exists to be SENT rather than looked at. */
    case "reactivate-temghid": {
      const c = productCopy(CLIENT_PRODUCTS.chatbot, "fr");
      return reactivateEmail({
        lang: "fr",
        productNoun: c.sentenceName,
        siteLabel: CLIENT_REFS.temghid.label,
        url: "https://servolia.com/chatbot?ref=temghid&billing=monthly",
        monthlyUsd: CLIENT_PRODUCTS.chatbot.monthlyUsd,
      });
    }
    default:
      return null;
  }
}

const TEMPLATES: { id: string; label: string; bilingual: boolean }[] = [
  { id: "audit-confirmation", label: "Audit requested — confirmation", bilingual: true },
  { id: "audit-in-progress", label: "Audit in progress — nudge", bilingual: false },
  { id: "installation-paid", label: "Payment received", bilingual: true },
  { id: "portal-login", label: "Portal magic link", bilingual: true },
  { id: "portal-message", label: "New portal message", bilingual: true },
  { id: "scope-accepted", label: "Scope accepted", bilingual: false },
  { id: "monthly-report", label: "Monthly client report", bilingual: true },
  { id: "live", label: "Site is live", bilingual: true },
  { id: "hosting-paid", label: "Hosting paid — yearly", bilingual: true },
  { id: "chatbot-restored", label: "Assistant paid — switched back on", bilingual: true },
  { id: "balance-settled", label: "Old balance settled", bilingual: true },
  { id: "upgrade-offer", label: "Switch to yearly — the offer", bilingual: true },
  { id: "upgrade-done", label: "Switch to yearly — confirmed", bilingual: true },
  { id: "reactivate-temghid", label: "Temghid — reactivate the assistant (REAL link, FR)", bilingual: false },
];

export async function GET(req: NextRequest) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const id = url.searchParams.get("t");
  const lang = url.searchParams.get("lang") === "fr" ? "fr" : "en";

  if (!id) {
    const rows = TEMPLATES.map(
      (t) =>
        `<li style="margin:0 0 10px;">
           <a href="?t=${t.id}">${t.label}</a>
           ${t.bilingual ? `<a href="?t=${t.id}&lang=fr" style="margin-left:8px;font-size:12px;">FR</a>` : `<span style="margin-left:8px;font-size:12px;color:#999;">EN only</span>`}
           <a href="?t=${t.id}&raw=1" style="margin-left:8px;font-size:12px;color:#999;">source</a>
         </li>`,
    ).join("");
    return new NextResponse(
      `<!doctype html><meta charset="utf-8"><title>Email previews</title>
       <body style="font-family:system-ui,sans-serif;max-width:640px;margin:48px auto;padding:0 24px;color:#18181B;">
       <h1 style="font-size:20px;">Email previews</h1>
       <p style="color:#71717A;font-size:14px;">Rendered with sample data. The logo loads from the deployed site, so it only appears in production.</p>
       <ul style="line-height:1.6;padding-left:18px;">${rows}</ul></body>`,
      { headers: { "content-type": "text/html; charset=utf-8" } },
    );
  }

  const built = build(id, lang);
  if (!built) return NextResponse.json({ error: `Unknown template: ${id}` }, { status: 404 });

  /* SEND IT FOR REAL. Requires an explicit address — never a default, so a
     stray click on a bookmarked URL cannot mail a client. */
  const send = url.searchParams.get("send");
  if (send) {
    const sender = currentFrom();
    if (!/.+@.+\..+/.test(send)) {
      return NextResponse.json({ error: "send must be an email address" }, { status: 400 });
    }
    const ok = await sendEmail(send, built.subject, built.html);
    return NextResponse.json({
      sent: ok,
      to: send,
      template: id,
      lang,
      subject: built.subject,
      // What the recipient will see in their client, and where a reply goes.
      from: sender.from,
      replyTo: sender.replyTo ?? `${sender.from} (no EMAIL_REPLY_TO set, so replies go to the From address)`,
      senderGuardOverrode: sender.overriddenFrom,
      note: ok
        ? "Check the inbox, then check the From line and hit reply to prove the address receives."
        : "Resend refused or is not configured — check RESEND_API_KEY and the Vercel function log.",
    });
  }

  if (url.searchParams.get("raw")) {
    return new NextResponse(built.html, { headers: { "content-type": "text/plain; charset=utf-8" } });
  }
  return new NextResponse(built.html, { headers: { "content-type": "text/html; charset=utf-8" } });
}
