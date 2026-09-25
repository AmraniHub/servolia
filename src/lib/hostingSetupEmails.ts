import { brandWrapper } from "@/lib/email";
import type { Checklist, Lang, Milestone } from "@/lib/hostingSetup";

/**
 * THE TWO SETUP MILESTONE EMAILS, AND THE FOUNDER'S COPY OF EACH.
 *
 * Kept out of src/lib/email.ts on purpose (another branch is editing it). They
 * reuse its brand frame, so they look like every other Servolia email.
 *
 * Each email states the measurement that triggered it, what is left and who
 * is doing it, and carries the client's own service page — the portal link is
 * in every milestone email, so the tracker is one click away from any of them.
 *
 * Sent only by src/lib/hostingSetupRun.ts, only after the milestone's stamp is
 * written, so each goes out once.
 */

const GREEN = "#36671E";
const INK = "#18181B";
const BODY = "#3F3F46";
const MUTED = "#71717A";
const LINE = "#E8E6E0";
const CREAM = "#FAFAF7";
const FONT = `-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif`;

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const button = (href: string, label: string) => `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:22px 0 4px;">
  <tr><td align="center" bgcolor="${GREEN}" style="background:${GREEN};border-radius:10px;">
    <a href="${esc(href)}" style="display:inline-block;padding:14px 28px;font-family:${FONT};font-size:15px;font-weight:700;color:${CREAM};text-decoration:none;border-radius:10px;">${esc(label)}</a>
  </td></tr>
</table>`;

const when = (iso: string, lang: Lang) =>
  new Date(iso).toLocaleString(lang === "fr" ? "fr-FR" : "en-GB", {
    day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "UTC",
  }) + " UTC";

export interface MilestoneEmailInput {
  milestone: Milestone;
  lang: Lang;
  host: string;
  business: string;
  reference: string | null;
  portalUrl: string | null;
  checkedAt: string;
  checklist: Checklist;
}

export function setupMilestoneEmail(input: MilestoneEmailInput): { subject: string; html: string } {
  const { milestone, lang, host, business, reference, portalUrl, checkedAt, checklist } = input;
  const fr = lang === "fr";
  const h = esc(host);
  const left = checklist.steps.filter((s) => s.state !== "done");

  const copy = milestone === "live"
    ? {
        subject: fr ? `Votre site est en ligne sur l'hébergement Servolia — ${host}` : `Your site is live on Servolia hosting — ${host}`,
        headline: fr ? "Votre site est en ligne chez nous" : "Your site is live on our hosting",
        body: fr
          ? `Le ${when(checkedAt, lang)}, <strong>https://${h}</strong> a répondu depuis notre hébergement, avec un certificat de sécurité valide. Vos visiteurs arrivent désormais sur nos serveurs.`
          : `At ${when(checkedAt, lang)}, <strong>https://${h}</strong> answered from our hosting with a valid security certificate. Your visitors now reach your site on our servers.`,
        preheader: fr ? "Vérifié à l'instant : votre adresse répond depuis notre hébergement." : "Checked just now: your address answers from our hosting.",
      }
    : {
        subject: fr ? `Votre domaine pointe maintenant vers nous — ${host}` : `Your domain now points to us — ${host}`,
        headline: fr ? "Votre domaine pointe vers nous" : "Your domain now points to us",
        body: fr
          ? `Le ${when(checkedAt, lang)}, <strong>${h}</strong> a répondu depuis nos serveurs. La suite est automatique : le certificat de sécurité, puis la mise en ligne. Nous vérifions toutes les 15 minutes et vous écrivons dès que le site répond.`
          : `At ${when(checkedAt, lang)}, <strong>${h}</strong> answered from our servers. What follows is automatic: the security certificate, then the site going live. We check every 15 minutes and email you the moment it answers.`,
        preheader: fr ? "Vérifié à l'instant : votre domaine répond depuis nos serveurs." : "Checked just now: your domain answers from our servers.",
      };

  const leftHtml = left.length
    ? `<p style="margin:0 0 8px;font-size:14px;font-weight:700;color:${INK};">${fr ? "Ce qu'il reste" : "What is left"} (${checklist.done}/${checklist.total})</p>
       <ul style="margin:0 0 18px;padding-left:20px;font-size:14px;line-height:1.7;color:${BODY};">
         ${left.map((s) => `<li>${esc(s.title)}${s.kind === "hand" ? ` — <span style="color:${MUTED};">${fr ? "nous nous en occupons" : "we're doing this"}</span>` : ""}</li>`).join("")}
       </ul>`
    : `<p style="margin:0 0 18px;font-size:14px;line-height:1.6;color:${BODY};">${fr ? "Toutes les étapes de la mise en place sont faites." : "Every setup step is done."}</p>`;

  const html = brandWrapper(`
    <h1 class="sv-h1" style="margin:0 0 14px;font-size:22px;font-weight:900;color:${INK};">${copy.headline}</h1>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:${BODY};">${copy.body}</p>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 18px;border:1px solid ${LINE};border-radius:12px;background:${CREAM};">
      <tr><td style="padding:16px 20px;font-family:${FONT};">
        <p style="margin:0 0 4px;font-size:11px;font-weight:900;letter-spacing:1px;text-transform:uppercase;color:${MUTED};">${fr ? "Votre hébergement" : "Your hosting"}</p>
        <p style="margin:0;font-size:16px;font-weight:800;color:${INK};">${esc(business || host)}</p>
        ${reference ? `<p style="margin:4px 0 0;font-size:13px;color:${MUTED};">${fr ? "Référence" : "Reference"} <strong style="color:${INK};font-family:ui-monospace,Menlo,Consolas,monospace;">${esc(reference)}</strong></p>` : ""}
      </td></tr>
    </table>
    ${leftHtml}
    ${portalUrl ? button(portalUrl, fr ? "Suivre la mise en place" : "Follow your setup") : ""}
    <p style="margin:18px 0 0;font-size:14px;line-height:1.6;color:${MUTED};">
      ${fr ? "Une question ? Répondez simplement à cet email — une personne lit chaque message." : "Any question — just reply to this email. A person reads every message."}
    </p>
  `, { preheader: copy.preheader, lang });

  return { subject: copy.subject, html };
}

/** The founder's copy: plain, everything in it, one link to the row. */
export function ownerSetupEmail(input: { subject: string; lines: string[] }): { subject: string; html: string } {
  const body = input.lines
    .map((l) => (l ? `<p style="margin:0 0 8px;font-size:14px;line-height:1.6;color:${BODY};">${esc(l).replace(/(https:\/\/[^\s<]+)/g, '<a href="$1">$1</a>')}</p>` : ""))
    .join("");
  return {
    subject: input.subject,
    html: brandWrapper(`<h1 style="margin:0 0 14px;font-size:19px;font-weight:900;color:${INK};">${esc(input.subject)}</h1>${body}`, {
      preheader: input.lines[0] ?? input.subject,
      lang: "en",
    }),
  };
}
