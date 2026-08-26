import { NextRequest, NextResponse } from "next/server";
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
} from "@/lib/email";

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
 *   /api/admin/email-preview                 → index of every template
 *   /api/admin/email-preview?t=live&lang=fr  → that template, rendered
 *   /api/admin/email-preview?t=live&raw=1    → the HTML source
 */

type Built = { subject: string; html: string };

function build(id: string, lang: "en" | "fr"): Built | null {
  switch (id) {
    case "audit-confirmation":
      return auditConfirmationEmail("Amine", lang);
    case "audit-in-progress":
      return auditInProgressEmail("Amine");
    case "installation-paid":
      return installationPaidEmail("Amine", "Croissance", 490, lang);
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

  if (url.searchParams.get("raw")) {
    return new NextResponse(built.html, { headers: { "content-type": "text/plain; charset=utf-8" } });
  }
  return new NextResponse(built.html, { headers: { "content-type": "text/html; charset=utf-8" } });
}
