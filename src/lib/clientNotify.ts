import { supabaseAdmin } from "@/lib/supabase";
import { sendEmail } from "@/lib/email";
import type { ClientSiteConfig } from "@/lib/clientSites";

/**
 * Instant lead alerts to the CLIENT (the clinic owner) — the felt-value core
 * of what they bought: "your assistant just caught a patient, here's how to
 * reply in one tap."
 *
 * Delivers the pricing-page promises:
 *  - "Instant lead alerts" — in every monthly plan, from Essentiel up.
 *  - "WhatsApp lead notification" — the email carries a one-tap wa.me reply
 *    link to the LEAD's phone with a prefilled greeting, plus a tel: link.
 *    (True API-sent WhatsApp messages need the WhatsApp Business API —
 *    roadmap, via Twilio.)
 *  - "Google Sheets CRM integration" — when config.sheetsWebhookUrl is set,
 *    every lead is POSTed there as a JSON row (same Apps Script pattern as
 *    Servolia's own GOOGLE_SHEETS_WEBHOOK_URL).
 *
 * The UNIQUE angle: after-hours framing. Servolia's whole pitch is "we catch
 * the patients you miss while closed" — so when a lead lands outside typical
 * opening hours, the alert says so explicitly. That one line is the monthly
 * retention argument arriving in real time.
 *
 * Everything here is fire-and-forget: a notification failure must never block
 * the visitor's booking.
 */

export interface LeadAlert {
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  service?: string | null;
  when?: string | null;
  excerpt: string;                 // first line shown in the email body
  source: "form" | "chat";
}

/** Typical clinic hours heuristic (Europe/Paris): Mon–Sat 08:00–19:00. */
function isAfterHours(now = new Date()): boolean {
  const paris = new Date(now.toLocaleString("en-US", { timeZone: "Europe/Paris" }));
  const day = paris.getDay(); // 0 = Sunday
  const hour = paris.getHours();
  return day === 0 || hour < 8 || hour >= 19;
}

const digits = (s: string) => s.replace(/[^\d+]/g, "").replace(/^00/, "+");

/** Resolve where to send the alert: site config email → the build's email. */
async function resolveRecipient(config: ClientSiteConfig): Promise<string | null> {
  if (config.email) return config.email;
  const db = supabaseAdmin();
  if (!db) return null;
  const { data: site } = await db.from("client_sites").select("build_id").eq("slug", config.slug).maybeSingle();
  const buildId = (site as { build_id?: string } | null)?.build_id;
  if (!buildId) return null;
  const { data: build } = await db.from("builds").select("email").eq("id", buildId).maybeSingle();
  return (build as { email?: string } | null)?.email ?? null;
}

export async function notifyClientOfLead(config: ClientSiteConfig, lead: LeadAlert): Promise<void> {
  try {
    const to = await resolveRecipient(config);
    if (!to) return;

    const fr = config.language === "fr";
    const afterHours = isAfterHours();
    const leadPhone = lead.phone ? digits(lead.phone) : null;

    const waText = fr
      ? `Bonjour${lead.name ? ` ${lead.name}` : ""}, merci pour votre demande auprès de ${config.businessName} — quand puis-je vous appeler ?`
      : `Hi${lead.name ? ` ${lead.name}` : ""}, thanks for your enquiry with ${config.businessName} — when is a good time to call?`;
    const waLink = leadPhone ? `https://wa.me/${leadPhone.replace("+", "")}?text=${encodeURIComponent(waText)}` : null;

    const badge = afterHours
      ? (fr ? "🌙 Captée en dehors de vos horaires" : "🌙 Caught outside your opening hours")
      : (fr ? "☀️ Pendant vos horaires" : "☀️ During opening hours");

    const subject = afterHours
      ? (fr ? `🌙 Nouvelle demande captée pendant la fermeture${lead.name ? ` — ${lead.name}` : ""}` : `🌙 New enquiry caught while you were closed${lead.name ? ` — ${lead.name}` : ""}`)
      : (fr ? `Nouvelle demande${lead.name ? ` — ${lead.name}` : ""}` : `New enquiry${lead.name ? ` — ${lead.name}` : ""}`);

    const btn = (href: string, label: string, bg = "#36671E") =>
      `<a href="${href}" style="display:inline-block;background:${bg};color:#FFFFFF;text-decoration:none;padding:11px 20px;border-radius:10px;font-weight:700;font-size:14px;margin:4px 6px 4px 0;">${label}</a>`;

    const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const rows: string[] = [];
    if (lead.name) rows.push(`<strong>${fr ? "Nom" : "Name"} :</strong> ${esc(lead.name)}`);
    if (lead.phone) rows.push(`<strong>${fr ? "Téléphone" : "Phone"} :</strong> ${esc(lead.phone)}`);
    if (lead.email) rows.push(`<strong>Email :</strong> ${esc(lead.email)}`);
    if (lead.service) rows.push(`<strong>${fr ? "Demande" : "Request"} :</strong> ${esc(lead.service)}`);
    if (lead.when) rows.push(`<strong>${fr ? "Créneau souhaité" : "Preferred time"} :</strong> ${esc(lead.when)}`);

    const html = `
<!DOCTYPE html><html><head><meta charset="utf-8" /></head>
<body style="margin:0;padding:0;background:#FAFAF7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#18181B;">
  <div style="max-width:560px;margin:0 auto;padding:28px 20px;">
    <div style="background:#FFFFFF;border:1px solid #E8E6E0;border-radius:16px;padding:28px 24px;">
      <p style="margin:0 0 6px;font-size:11px;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:${afterHours ? "#7C3AED" : "#36671E"};">${badge}</p>
      <h1 style="margin:0 0 14px;font-size:20px;font-weight:900;">
        ${fr ? "Votre assistante vient de capter une demande." : "Your assistant just captured an enquiry."}
      </h1>
      <div style="padding:14px 16px;background:#FAFAF7;border-left:3px solid #36671E;border-radius:0 10px 10px 0;font-size:14px;line-height:1.7;color:#3F3F46;margin-bottom:16px;">
        ${rows.length ? rows.join("<br/>") : esc(lead.excerpt).slice(0, 400)}
      </div>
      <p style="margin:0 0 14px;font-size:13px;color:#71717A;">
        ${fr
          ? "Répondre vite fait toute la différence — une demande rappelée sous 5 minutes se transforme bien plus souvent en rendez-vous."
          : "Speed wins — an enquiry answered within 5 minutes converts far more often into a booked appointment."}
      </p>
      <div>
        ${waLink ? btn(waLink, fr ? "Répondre sur WhatsApp 💬" : "Reply on WhatsApp 💬", "#25D366") : ""}
        ${leadPhone ? btn(`tel:${leadPhone}`, fr ? "Appeler" : "Call") : ""}
        ${lead.email ? btn(`mailto:${lead.email}`, fr ? "Répondre par email" : "Reply by email", "#52525B") : ""}
      </div>
      <p style="margin:18px 0 0;font-size:12px;color:#A1A1AA;">
        ${fr ? "Toutes vos demandes :" : "All your enquiries:"} <a href="https://servolia.com/portal" style="color:#36671E;">servolia.com/portal</a>
      </p>
    </div>
    <p style="margin-top:16px;font-size:11px;color:#A1A1AA;text-align:center;">${config.businessName} · ${fr ? "propulsé par" : "powered by"} Servolia</p>
  </div>
</body></html>`;

    sendEmail(to, subject, html).catch(() => {});

    // Google Sheets CRM sync (per-client, optional) — same Apps Script webhook
    // pattern as Servolia's own sheet.
    if (config.sheetsWebhookUrl) {
      fetch(config.sheetsWebhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          timestamp: new Date().toISOString(),
          source: lead.source,
          name: lead.name ?? "",
          phone: lead.phone ?? "",
          email: lead.email ?? "",
          service: lead.service ?? "",
          when: lead.when ?? "",
          message: lead.excerpt.slice(0, 500),
          after_hours: afterHours ? "yes" : "no",
          site: config.slug,
        }),
      }).catch(() => {});
    }
  } catch {
    /* alerts are best-effort by contract */
  }
}
