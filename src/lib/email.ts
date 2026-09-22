import { Resend } from "resend";
import { businessWaLink } from "./whatsapp";
import { sendTelegramMessage } from "@/lib/telegram";
import { rateLimited } from "@/lib/security";
// Aliased: this file already uses `money` and `usd` as local names in templates.
import { usd as usdFmt } from "@/lib/hosting";

/**
 * Email service — uses Resend (resend.com). Free up to 3,000 emails/month.
 *
 * Setup:
 *   1. Sign up at resend.com (free)
 *   2. Add servolia.com domain → verify DNS (SPF, DKIM)
 *   3. Generate API key
 *   4. Set RESEND_API_KEY env var in Vercel
 *   5. Set EMAIL_FROM env var (e.g. "Servolia <hello@servolia.com>")
 */

let _resend: Resend | null = null;
function client(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  if (_resend) return _resend;
  _resend = new Resend(key);
  return _resend;
}

const SAFE_FROM = "Servolia <hello@servolia.com>";

/** The only domain Servolia mail may leave from — plus its subdomains. */
const OWN_DOMAIN = "servolia.com";

/** Pull the address out of `Name <addr@host>`, or take it bare. */
export function fromAddress(value: string): string {
  const angled = value.match(/<([^>]+)>/);
  return (angled ? angled[1] : value).trim().toLowerCase();
}

export function fromDomainIsOurs(value: string): boolean {
  const domain = fromAddress(value).split("@")[1] ?? "";
  return domain === OWN_DOMAIN || domain.endsWith(`.${OWN_DOMAIN}`);
}

/**
 * SENDER GUARD — the one email mistake that cannot be walked back.
 *
 * The Resend account has more than one verified domain on it (servolia.com and
 * openx24.com). Verified means Resend will happily send from either, so a
 * single wrong character in EMAIL_FROM would deliver Servolia's client mail
 * from the Shopify agency's domain. A French dental clinic receiving their
 * go-live notice from a UK e-commerce brand reads as a phishing attempt, and
 * the spam complaint lands on the wrong domain's reputation.
 *
 * EMAIL_FROM is also marked Sensitive in Vercel, so its value cannot be read
 * back from the dashboard or the CLI — meaning a mistake there is invisible
 * from outside the running process. This check is the only place that can see
 * it, so it both corrects and reports.
 *
 * Correcting rather than refusing is deliberate: a hard failure would stop
 * every receipt and magic link. Mail keeps flowing from the safe address, and
 * the alert makes sure the misconfiguration does not stay quiet.
 */
function resolveFrom(): { from: string; corrected: string | null } {
  const configured = process.env.EMAIL_FROM?.trim();
  if (!configured) return { from: SAFE_FROM, corrected: null };
  if (fromDomainIsOurs(configured)) return { from: configured, corrected: null };
  return { from: SAFE_FROM, corrected: configured };
}

const { from: FROM, corrected: FROM_OVERRIDDEN } = resolveFrom();

/**
 * What mail will actually leave as, and where replies will land.
 *
 * EMAIL_FROM is marked Sensitive in Vercel, so its value cannot be read back
 * from the dashboard or the CLI — meaning the one thing a client sees first is
 * the one thing nobody can check from outside the running process. This
 * reports it to an authenticated admin, and reports the SAFE address when the
 * sender guard has overridden a misconfigured one, so a test send shows the
 * truth rather than the intention.
 */
export function currentFrom(): { from: string; overriddenFrom: string | null; replyTo: string | null } {
  return { from: FROM, overriddenFrom: FROM_OVERRIDDEN, replyTo: REPLY_TO };
}

/** Loud, throttled: a wrong sender is a brand incident, not a config nag. */
async function warnWrongSender(configured: string): Promise<void> {
  try {
    console.error(
      `[email] EMAIL_FROM is "${configured}" — not a ${OWN_DOMAIN} address. Sending as ${SAFE_FROM} instead.`,
    );
    if (await rateLimited("email-wrong-sender", 1, 3600)) return;
    await sendTelegramMessage(
      [
        "🚨 *EMAIL_FROM points at the wrong domain*",
        "",
        `Configured: ${configured}`,
        `Sending as ${SAFE_FROM} instead, so nothing leaves under another brand.`,
        "",
        `Fix: Vercel → Environment Variables → EMAIL_FROM (must be @${OWN_DOMAIN}).`,
      ].join("\n"),
    );
  } catch {
    /* an alert must never break the send it is watching */
  }
}

/**
 * Where replies actually land.
 *
 * Resend SENDS mail; it does not host a mailbox. So unless hello@servolia.com
 * is a real inbox somewhere (Workspace, Zoho, a forward), every reply to a
 * Servolia email is lost — and several templates say "just reply to this
 * email" in as many words. Set EMAIL_REPLY_TO to an address you actually read
 * and the promise becomes true without changing the visible From name.
 */
const REPLY_TO = process.env.EMAIL_REPLY_TO?.trim() || null;

export async function sendEmail(to: string, subject: string, html: string, text?: string): Promise<boolean> {
  const r = client();
  if (FROM_OVERRIDDEN) await warnWrongSender(FROM_OVERRIDDEN);
  if (!r) {
    console.warn("Resend not configured — skipping email to", to);
    return false;
  }
  try {
    const { error } = await r.emails.send({
      from: FROM,
      to,
      subject,
      html,
      text: text ?? stripHtml(html),
      ...(REPLY_TO ? { replyTo: REPLY_TO } : {}),
    });
    if (error) {
      console.error("Resend error:", error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("Email send failed:", err);
    return false;
  }
}

/**
 * HTML to a readable plain-text alternative.
 *
 * Every email is sent multipart; this builds the text half. The old version
 * was one regex that removed TAGS but kept their CONTENT, which was harmless
 * until the template grew a <style> block — then the plain-text part opened
 * with a wall of CSS. That is ugly to anyone reading text, and worse than
 * ugly to a spam filter, which compares the two parts and treats a mismatch
 * as cloaking.
 *
 * It also keeps link targets. A text alternative whose call to action is a
 * bare word with no URL gives the reader nothing to act on.
 */
function stripHtml(html: string): string {
  return (
    html
      // Machinery, content and all.
      .replace(/<(script|style|head|title)\b[^>]*>[\s\S]*?<\/\1>/gi, "")
      // The hidden preheader would otherwise appear twice.
      .replace(/<div[^>]*display:none[\s\S]*?<\/div>/gi, "")
      // Keep where a link goes, not just its label.
      .replace(/<a\b[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, (_m, href, label) => {
        const text = label.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
        // An image-only link (the logo) carries no words, so in text it would
        // print as a bare URL that says nothing. Drop it.
        if (!text) return "";
        // A label that IS its own href should not print twice; compare
        // without scheme or trailing slash so servolia.com/portal matches
        // https://servolia.com/portal.
        const bare = (u: string) => u.replace(/^https?:\/\//, "").replace(/\/$/, "");
        if (href.startsWith("mailto:") || bare(text) === bare(href)) return text;
        return `${text}: ${href}`;
      })
      // Block boundaries become line breaks so the result has shape.
      .replace(/<(br|\/p|\/h[1-6]|\/li|\/tr|\/div|\/table)\b[^>]*>/gi, "\n")
      .replace(/<li\b[^>]*>/gi, "- ")
      .replace(/<[^>]*>/g, "")
      // Entities the templates actually use.
      .replace(/&nbsp;/gi, " ")
      .replace(/&middot;/gi, "\u00b7")
      .replace(/&zwnj;|&#847;/gi, "")
      .replace(/&amp;/gi, "&")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&quot;/gi, '"')
      .replace(/&#39;|&apos;/gi, "'")
      // Tidy: trim each line, collapse runs of blank lines.
      .split("\n")
      .map((l) => l.replace(/[ \t]+/g, " ").trim())
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}

// ============================================================================
// EMAIL TEMPLATES
// ============================================================================

/**
 * BRAND CHROME — the frame every Servolia email is rendered in.
 *
 * Rebuilt 2026-08-16. The old wrapper was a <div> with max-width and a CSS
 * <span> pretending to be a logo. Both look fine in a browser and neither
 * survives Outlook, which renders mail with Word's engine: max-width is
 * ignored (the layout goes full-bleed) and border-radius is dropped (the
 * "logo" became a hard green square with a letter floating off-centre).
 *
 * What this fixes, in the order it matters:
 *
 *   1. REAL LOGO, HOSTED. public/email-logo.png, referenced by absolute URL.
 *      NOT the data URI from logoAsset.ts — Gmail strips base64 images, so
 *      the mark would vanish for most recipients. The wordmark also stays
 *      live HTML text beside it, because images are blocked by default in
 *      many clients and a brand that disappears is worse than no image.
 *   2. TABLE LAYOUT with role="presentation" — the only layout Outlook and
 *      Gmail both honour.
 *   3. PREHEADER — the grey line the inbox shows after the subject. Left
 *      unset, clients scrape the first body words, which reads like a glitch.
 *   4. BULLETPROOF BUTTON — colour on the <td>, padding on the <a>, so the
 *      button is a button even where <a> padding is dropped.
 *   5. DARK MODE — declared, with explicit colours everywhere, so clients
 *      that auto-invert do not turn the card into unreadable mud.
 *   6. LEGAL FOOTER — the operating entity, because real companies say who
 *      they are and it helps deliverability.
 *
 * Note on logo.png: it is a different brand from logo-icon.png (glossy
 * blue-green gradient, baked-in background) and clashes with the site's
 * green. The icon mark is the one used here on purpose.
 */

const SITE = "https://servolia.com";
const LOGO = `${SITE}/email-logo.png`;

const GREEN = "#36671E";
const CREAM = "#FAFAF7";
const INK = "#18181B";
const BODY = "#3F3F46";
const MUTED = "#71717A";
const FAINT = "#A1A1AA";
const LINE = "#E8E6E0";

const FONT = `-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif`;

interface WrapOptions {
  /** The grey line the inbox shows next to the subject. Always set one. */
  preheader?: string;
  lang?: "en" | "fr";
  /** Present only on marketing mail — transactional mail must not offer it. */
  unsubscribeHtml?: string;
}

export const brandWrapper = (body: string, opts: WrapOptions = {}) => wrapper(body, opts);

const wrapper = (body: string, opts: WrapOptions = {}) => {
  const { preheader = "", lang = "en", unsubscribeHtml = "" } = opts;
  const tagline =
    lang === "fr"
      ? "Sites et standards IA pour cabinets et artisans"
      : "AI websites and receptionists for service businesses";

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="${lang}">
<head>
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="x-apple-disable-message-reformatting" />
<meta name="color-scheme" content="light dark" />
<meta name="supported-color-schemes" content="light dark" />
<title>Servolia</title>
<!--[if mso]>
<noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
<![endif]-->
<style>
  /* Phones: let the card breathe edge to edge. */
  @media only screen and (max-width:600px){
    .sv-pad{padding-left:16px !important;padding-right:16px !important;}
    .sv-card{padding:24px 20px !important;}
    .sv-h1{font-size:20px !important;}
  }
  /* Clients that auto-invert: keep our own contrast rather than theirs. */
  @media (prefers-color-scheme:dark){
    .sv-bg{background:#0F1410 !important;}
    .sv-card{background:#171C18 !important;border-color:#2A322C !important;}
    .sv-ink,.sv-h1{color:#F4F4F2 !important;}
    .sv-body{color:#C9CCC7 !important;}
    .sv-muted,.sv-faint{color:#9BA097 !important;}
  }
  a{color:${GREEN};}
</style>
</head>
<body class="sv-bg" style="margin:0;padding:0;background:${CREAM};-webkit-font-smoothing:antialiased;">

<div style="display:none;font-size:1px;color:${CREAM};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${preheader}&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="sv-bg" style="background:${CREAM};">
<tr><td align="center" class="sv-pad" style="padding:32px 24px;">

  <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="width:560px;max-width:560px;">

    <!-- Header: mark + wordmark. The wordmark is text, so the brand survives blocked images. -->
    <tr><td style="padding:0 0 24px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
        <td style="vertical-align:middle;">
          <a href="${SITE}" style="text-decoration:none;">
            <img src="${LOGO}" width="44" height="44" alt="Servolia" style="display:block;width:44px;height:44px;border:0;outline:none;text-decoration:none;" />
          </a>
        </td>
        <td style="vertical-align:middle;padding-left:12px;">
          <a href="${SITE}" class="sv-ink" style="font-family:${FONT};font-size:21px;font-weight:800;color:${INK};text-decoration:none;letter-spacing:-0.3px;">Servolia</a>
        </td>
      </tr></table>
    </td></tr>

    <!-- Card -->
    <tr><td>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="sv-card" style="background:#FFFFFF;border:1px solid ${LINE};border-radius:16px;">
        <!-- Brand accent: a td with a background renders everywhere. -->
        <tr><td style="background:${GREEN};height:4px;line-height:4px;font-size:0;border-radius:16px 16px 0 0;">&nbsp;</td></tr>
        <tr><td class="sv-card" style="padding:32px 28px;font-family:${FONT};">
          ${body}
        </td></tr>
      </table>
    </td></tr>

    <!-- Footer -->
    <tr><td style="padding:24px 8px 0;font-family:${FONT};text-align:center;">
      <p class="sv-muted" style="margin:0 0 6px;font-size:12px;line-height:1.6;color:${MUTED};">
        <strong style="color:${MUTED};">Servolia</strong> &middot; ${tagline}
      </p>
      <p style="margin:0 0 6px;font-size:12px;line-height:1.6;">
        <a href="${SITE}" style="color:${GREEN};text-decoration:none;">servolia.com</a>
        <span class="sv-faint" style="color:${FAINT};">&middot;</span>
        <a href="mailto:hello@servolia.com" style="color:${GREEN};text-decoration:none;">hello@servolia.com</a>
      </p>
      <p class="sv-faint" style="margin:0;font-size:11px;line-height:1.6;color:${FAINT};">
        Servolia LLC &middot; Wyoming, USA
      </p>
      ${unsubscribeHtml}
    </td></tr>

  </table>

</td></tr>
</table>
</body></html>`;
};

/**
 * Bulletproof CTA. The colour lives on the <td> and the padding on the <a>,
 * so it still reads as a button in clients that drop padding from links.
 */
const btn = (href: string, label: string) => `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0 4px;">
  <tr><td align="center" bgcolor="${GREEN}" style="background:${GREEN};border-radius:10px;">
    <a href="${href}" style="display:inline-block;padding:14px 28px;font-family:${FONT};font-size:15px;font-weight:700;color:${CREAM};text-decoration:none;border-radius:10px;">${label}</a>
  </td></tr>
</table>`;

const waBtn = (href: string, label: string) => `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 4px;">
  <tr><td align="center" bgcolor="#25D366" style="background:#25D366;border-radius:10px;">
    <a href="${href}" style="display:inline-block;padding:14px 28px;font-family:${FONT};font-size:15px;font-weight:700;color:#FFFFFF;text-decoration:none;border-radius:10px;">${label}</a>
  </td></tr>
</table>`;

/**
 * Sent immediately when someone submits the free-audit or contact form.
 *
 * It used to promise "a personalised 5-minute video within 24 hours". Nothing
 * recorded one — the follow-up cron sent a nudge two days later and that
 * was all. What is true: the audit page scores their site on screen in
 * about 20 seconds (/api/audit), and a person reads every request and
 * replies within one working day, with the SLA clock on /admin/today. That
 * is what this says.
 */
export const auditConfirmationEmail = (firstName: string, lang: "en" | "fr" = "en") => {
  if (lang === "fr") {
    return {
      subject: "Bien reçu — nous vous répondons sous un jour ouvré",
      html: wrapper(`
        <h1 style="margin:0 0 16px;font-size:22px;font-weight:900;">Nous avons bien reçu votre demande.</h1>
        <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#3F3F46;">Bonjour ${firstName},</p>
        <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#3F3F46;">
          Merci. Une personne — pas un robot — lit votre demande et vous répond sous <strong>un jour ouvré</strong>, avec ce que nous corrigerions sur votre présence en ligne et pourquoi.
        </p>
        <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#3F3F46;">
          En attendant, si vous voulez les chiffres tout de suite : l'audit gratuit note votre site à l'écran en 20 secondes environ.
        </p>
        ${btn("https://servolia.com/fr/audit", "Noter mon site maintenant →")}
        <p style="margin:24px 0 0;font-size:14px;line-height:1.6;color:#71717A;">
          Une question entre-temps ? Répondez simplement à cet email.
        </p>
      `, { preheader: "Une personne vous repond sous un jour ouvre. Aucun appel requis.", lang: "fr" }),
    };
  }
  return {
    subject: "Received — a personal reply within one working day",
    html: wrapper(`
      <h1 style="margin:0 0 16px;font-size:22px;font-weight:900;">We received your request.</h1>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#3F3F46;">Hi ${firstName},</p>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#3F3F46;">
        Thank you. A person — not a bot — reads your request and replies within <strong>one working day</strong>, with what we would fix about your online presence and why.
      </p>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#3F3F46;">
        If you want the numbers right now: the free audit scores your site on screen in about 20 seconds.
      </p>
      ${btn("https://servolia.com/free-audit", "Score my site now →")}
      <p style="margin:24px 0 0;font-size:14px;line-height:1.6;color:#71717A;">
        Questions in the meantime? Just reply to this email.
      </p>
      `, { preheader: "A person replies within one working day. No call needed.", lang: "en" }),
  };
};

/** Sent a day after an audit request with no reply from us. Asks the one
 *  question that sharpens the answer — and promises only the reply. */
export const auditInProgressEmail = (firstName: string) => ({
  subject: "Working on your audit — quick question",
  html: wrapper(`
    <h1 style="margin:0 0 16px;font-size:22px;font-weight:900;">Quick update</h1>
    <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#3F3F46;">Hi ${firstName},</p>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#3F3F46;">
      I'm writing your reply. One question helps me make it sharper:
    </p>
    <p style="margin:0 0 16px;padding:16px;background:#FAFAF7;border-left:3px solid #36671E;font-size:15px;line-height:1.6;color:#18181B;">
      <strong>What's the #1 problem you'd want this AI system to solve in the next 90 days?</strong><br/>
      (Just reply with a sentence or two.)
    </p>
    <p style="margin:0;font-size:14px;line-height:1.6;color:#71717A;">
      My reply follows within the working day either way.
    </p>
      `, { preheader: "One quick detail and I can send you a sharper answer.", lang: "en" }),
});

/**
 * Sent post-payment, immediately after Stripe checkout completes.
 *
 * The installation is charged in full at checkout — there is no balance and no
 * "final payment" step. What starts on day 7 is the monthly plan, so the
 * timeline ends at go-live, not at another invoice.
 */
export const installationPaidEmail = (firstName: string, planName: string, amount: number, lang: "en" | "fr" = "en") => {
  const wa = businessWaLink(
    lang === "fr"
      ? `Bonjour, je viens de régler ma mise en place — hâte de commencer !`
      : `Hi, I just paid for my installation — excited to get started!`
  );
  const intakeUrl = lang === "fr" ? "https://servolia.com/fr/demarrage" : "https://servolia.com/onboarding";

  if (lang === "fr") {
    return {
      subject: `Paiement reçu — votre ${planName} démarre`,
      html: wrapper(`
        <h1 style="margin:0 0 16px;font-size:22px;font-weight:900;">Bienvenue chez Servolia 🎉</h1>
        <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#3F3F46;">Bonjour ${firstName},</p>
        <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#3F3F46;">
          Votre paiement de ${amount.toLocaleString()} € (<strong>${planName}</strong>) vient d'être validé. La création démarre maintenant — et rien ne sera dû le jour de la livraison.
        </p>
        <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#3F3F46;">
          <strong>Votre planning :</strong>
        </p>
        <ul style="margin:0 0 16px;padding-left:20px;font-size:15px;line-height:1.7;color:#3F3F46;">
          <li><strong>Jour 1 (aujourd'hui) :</strong> Complétez le formulaire d'intake en 8 minutes (lien ci-dessous)</li>
          <li><strong>Juste après :</strong> Votre première version arrive par email — un lien pour la voir, généralement en quelques minutes</li>
          <li><strong>Jour 1–3 :</strong> Vous nous dites quoi changer ; vous dites go, nous mettons en ligne</li>
          <li><strong>Ensuite :</strong> Votre abonnement mensuel démarre, une fois le site en ligne</li>
        </ul>
        ${btn(intakeUrl, "Compléter le formulaire →")}
        ${wa ? waBtn(wa, "Discuter sur WhatsApp 💬") : ""}
        <p style="margin:24px 0 0;font-size:14px;line-height:1.6;color:#71717A;">
          Des questions ? Répondez directement à cet email${wa ? " ou écrivez-nous sur WhatsApp" : ""} — je lis chaque message.
        </p>
      `, { preheader: "Votre installation est confirmee. Voici ce qui se passe maintenant.", lang: "fr" }),
    };
  }

  return {
    subject: `Payment received — your ${planName} is under way`,
    html: wrapper(`
      <h1 style="margin:0 0 16px;font-size:22px;font-weight:900;">Welcome to Servolia 🎉</h1>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#3F3F46;">Hi ${firstName},</p>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#3F3F46;">
        Your €${amount.toLocaleString()} payment for the <strong>${planName}</strong> just cleared. The build officially starts now — and nothing will be owed on delivery day.
      </p>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#3F3F46;">
        <strong>Your timeline:</strong>
      </p>
      <ul style="margin:0 0 16px;padding-left:20px;font-size:15px;line-height:1.7;color:#3F3F46;">
        <li><strong>Day 1 (today):</strong> Complete your 8-minute intake form (link below)</li>
        <li><strong>Right after:</strong> Your first draft arrives by email — a link to look at, usually within minutes</li>
        <li><strong>Day 1–3:</strong> You tell us what to change; you say go, we take it live</li>
        <li><strong>Then:</strong> Your monthly plan starts, once the site is live</li>
      </ul>
      ${btn(intakeUrl, "Complete intake form →")}
      ${wa ? waBtn(wa, "Chat on WhatsApp 💬") : ""}
      <p style="margin:24px 0 0;font-size:14px;line-height:1.6;color:#71717A;">
        Questions? Reply directly${wa ? " or message us on WhatsApp" : ""} — I read every message.
      </p>
      `, { preheader: "Your installation is confirmed. Here is what happens next.", lang: "en" }),
  };
};

/**
 * "Your first draft is ready" — sent by src/lib/draftPreview.ts the moment
 * the generated site exists, never by a human, once per site.
 *
 * It promises only what code or a person will actually do: look at it, reply
 * with changes, and "we take it live when you say so" — which today the
 * founder does from the admin, and step 2 of the automation plan makes
 * automatic. Nothing here mentions the client's own domain until that path
 * exists. Mechanical copy (the AI call fell back) is called a first pass, and
 * what the intake did not give is named so the client can send it, rather
 * than found on day three.
 */
export const draftReadyEmail = (o: {
  businessName: string;
  previewUrl: string;
  missing: string[];
  aiWritten: boolean;
  lang: "en" | "fr";
}) => {
  const items = (list: string[]) => list.map((m) => `<li>${escapeHtml(m)}</li>`).join("");
  const P = `style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#3F3F46;"`;

  if (o.lang === "fr") {
    return {
      subject: `Votre première version est prête — ${o.businessName}`,
      html: wrapper(`
        <h1 style="margin:0 0 16px;font-size:22px;font-weight:900;">Votre brouillon est prêt</h1>
        <p ${P}>Bonjour,</p>
        <p ${P}>
          Nous avons pris vos réponses et en avons fait une première version de votre site. C'est un aperçu sur notre adresse — regardez-le tranquillement, sur téléphone comme sur ordinateur.
        </p>
        ${btn(o.previewUrl, "Voir mon brouillon →")}
        ${o.aiWritten ? "" : `<p ${P}>Les textes sont une première passe ; nous les affinons avec vous avant la mise en ligne.</p>`}
        ${o.missing.length ? `
        <p ${P}><strong>Pour le terminer, il nous manque encore :</strong></p>
        <ul style="margin:0 0 16px;padding-left:20px;font-size:15px;line-height:1.7;color:#3F3F46;">${items(o.missing)}</ul>
        <p ${P}>Répondez simplement à cet email avec ces éléments.</p>` : ""}
        <p ${P}>
          <strong>Et maintenant ?</strong> Répondez à cet email avec tout ce que vous souhaitez modifier — un mot, une couleur, une photo. Quand la version vous convient, dites-le-nous et nous la mettons en ligne.
        </p>
        <p style="margin:24px 0 0;font-size:14px;line-height:1.6;color:#71717A;">
          Ce lien reste valable 90 jours et n'ouvre que votre brouillon.
        </p>
      `, { preheader: "Votre site, premiere version. Regardez, puis dites-nous quoi changer.", lang: "fr" }),
    };
  }

  return {
    subject: `Your first draft is ready — ${o.businessName}`,
    html: wrapper(`
      <h1 style="margin:0 0 16px;font-size:22px;font-weight:900;">Your draft is ready</h1>
      <p ${P}>Hello,</p>
      <p ${P}>
        We took your answers and turned them into a first version of your site. It's a preview on our address — take your time with it, on your phone as well as your computer.
      </p>
      ${btn(o.previewUrl, "See my draft →")}
      ${o.aiWritten ? "" : `<p ${P}>The wording is a first pass; we refine it with you before it goes live.</p>`}
      ${o.missing.length ? `
      <p ${P}><strong>To finish it, we still need:</strong></p>
      <ul style="margin:0 0 16px;padding-left:20px;font-size:15px;line-height:1.7;color:#3F3F46;">${items(o.missing)}</ul>
      <p ${P}>Just reply to this email with them.</p>` : ""}
      <p ${P}>
        <strong>What happens next?</strong> Reply to this email with anything you'd like changed — a word, a colour, a photo. When it's right, tell us and we take it live.
      </p>
      <p style="margin:24px 0 0;font-size:14px;line-height:1.6;color:#71717A;">
        This link works for 90 days and opens only your draft.
      </p>
      `, { preheader: "Your site, first version. Have a look, then tell us what to change.", lang: "en" }),
  };
};

/**
 * The conversation meter, when it matters: once at 80 % and once at 100 % a
 * month (src/lib/conversationCap.ts). Never a cut-off — the receptionist
 * keeps answering their patients. Two honest ways forward: a one-off pack,
 * or the next tier, which the pricing page already promises.
 */
export const conversationsEmail = (o: {
  businessName: string;
  level: 80 | 100;
  used: number;
  allowance: number;
  planName: string;
  nextPlan: { name: string; monthlyEur: number } | null;
  topupUrl: string;
  lang: "en" | "fr";
}) => {
  const P = `style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#3F3F46;"`;
  const at100 = o.level === 100;
  if (o.lang === "fr") {
    return {
      subject: at100
        ? `Vos ${o.allowance} conversations du mois sont utilisées — ${o.businessName}`
        : `${o.used} conversations sur ${o.allowance} ce mois-ci — ${o.businessName}`,
      html: wrapper(`
        <h1 style="margin:0 0 16px;font-size:22px;font-weight:900;">${at100 ? "Votre assistante a été très sollicitée ce mois-ci" : "Votre assistante travaille bien"}</h1>
        <p ${P}>Bonjour,</p>
        <p ${P}>
          Votre formule <strong>${o.planName}</strong> inclut ${o.allowance} conversations par mois, et vos patients en ont déjà eu <strong>${o.used}</strong>.
          ${at100 ? "Rien ne s'arrête : votre assistante continue de répondre à chaque patient." : "Au rythme actuel, vous atteindrez la limite avant la fin du mois."}
        </p>
        <p ${P}><strong>Deux options, au choix :</strong></p>
        <ul style="margin:0 0 16px;padding-left:20px;font-size:15px;line-height:1.7;color:#3F3F46;">
          <li>Un pack de conversations en plus pour ce mois — paiement unique, depuis votre espace.</li>
          ${o.nextPlan ? `<li>Passer à la formule <strong>${o.nextPlan.name}</strong> (${o.nextPlan.monthlyEur} €/mois) — c'est ce que nous vous proposerons de toute façon si le rythme se confirme, jamais de facture surprise.</li>` : `<li>Vous êtes déjà sur la formule la plus large — répondez à cet email et nous regardons ensemble.</li>`}
        </ul>
        ${btn(o.topupUrl, "Voir mon compteur →")}
        <p style="margin:24px 0 0;font-size:14px;line-height:1.6;color:#71717A;">Une question ? Répondez simplement à cet email.</p>
      `, { preheader: at100 ? "Rien ne s'arrete. Deux options pour la suite." : "Vous approchez de la limite du mois.", lang: "fr" }),
    };
  }
  return {
    subject: at100
      ? `Your ${o.allowance} conversations this month are used — ${o.businessName}`
      : `${o.used} of ${o.allowance} conversations this month — ${o.businessName}`,
    html: wrapper(`
      <h1 style="margin:0 0 16px;font-size:22px;font-weight:900;">${at100 ? "Your receptionist has been busy this month" : "Your receptionist is working"}</h1>
      <p ${P}>Hello,</p>
      <p ${P}>
        Your <strong>${o.planName}</strong> plan includes ${o.allowance} conversations a month, and your patients have already had <strong>${o.used}</strong>.
        ${at100 ? "Nothing stops: your receptionist keeps answering every patient." : "At this pace you will reach the limit before the month ends."}
      </p>
      <p ${P}><strong>Two options, your choice:</strong></p>
      <ul style="margin:0 0 16px;padding-left:20px;font-size:15px;line-height:1.7;color:#3F3F46;">
        <li>A pack of extra conversations for this month — one-off payment, from your portal.</li>
        ${o.nextPlan ? `<li>Move to the <strong>${o.nextPlan.name}</strong> plan (€${o.nextPlan.monthlyEur}/month) — which is what we'd suggest anyway if this pace holds; never a surprise bill.</li>` : `<li>You are already on the widest plan — reply to this email and we'll look at it together.</li>`}
      </ul>
      ${btn(o.topupUrl, "See my meter →")}
      <p style="margin:24px 0 0;font-size:14px;line-height:1.6;color:#71717A;">Questions? Just reply to this email.</p>
      `, { preheader: at100 ? "Nothing stops. Two options for what's next." : "You are approaching this month's limit.", lang: "en" }),
  };
};

/** The receipt for a bought pack — says what was added and to which month. */
export const topupReceiptEmail = (o: { businessName: string; conversations: number; priceEur: number; month: string; lang: "en" | "fr" }) => {
  const P = `style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#3F3F46;"`;
  if (o.lang === "fr") {
    return {
      subject: `+${o.conversations} conversations ajoutées — ${o.businessName}`,
      html: wrapper(`
        <h1 style="margin:0 0 16px;font-size:22px;font-weight:900;">C'est ajouté</h1>
        <p ${P}>Bonjour,</p>
        <p ${P}><strong>${o.conversations} conversations</strong> ont été ajoutées à votre compteur pour ${o.month}. Paiement unique de ${o.priceEur} €, déjà réglé — rien d'autre ne change sur votre formule.</p>
        ${btn("https://servolia.com/portal", "Ouvrir mon espace →")}
      `, { preheader: `${o.conversations} conversations ajoutees pour ${o.month}.`, lang: "fr" }),
    };
  }
  return {
    subject: `+${o.conversations} conversations added — ${o.businessName}`,
    html: wrapper(`
      <h1 style="margin:0 0 16px;font-size:22px;font-weight:900;">Added</h1>
      <p ${P}>Hello,</p>
      <p ${P}><strong>${o.conversations} conversations</strong> have been added to your meter for ${o.month}. One-off payment of €${o.priceEur}, already settled — nothing else on your plan changes.</p>
      ${btn("https://servolia.com/portal", "Open my portal →")}
    `, { preheader: `${o.conversations} conversations added for ${o.month}.`, lang: "en" }),
  };
};

/**
 * A one-off service on the hosting line (today: the multilingual search
 * setup). Until 2026-09-22 this sale fell into the ARREARS branch of the
 * webhook and the buyer was told they had settled an "outstanding balance".
 * This says what they bought and what happens next — the work is done by a
 * person, so the promise is a date range, not an hour.
 */
export const oneOffServicePaidEmail = (o: { productName: string; amountUsd: number; siteLabel: string; whatHappens: string; lang: "en" | "fr" }) => {
  const P = `style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#3F3F46;"`;
  if (o.lang === "fr") {
    return {
      subject: `Paiement reçu — ${o.productName}`,
      html: wrapper(`
        <h1 style="margin:0 0 16px;font-size:22px;font-weight:900;">Paiement reçu, merci</h1>
        <p ${P}>Bonjour,</p>
        <p ${P}>Nous avons bien reçu <strong>${o.amountUsd} $</strong> pour <strong>${o.productName}</strong>${o.siteLabel ? ` sur ${o.siteLabel}` : ""}. Paiement unique — rien de récurrent.</p>
        <p ${P}><strong>La suite :</strong> ${o.whatHappens}</p>
        <p style="margin:24px 0 0;font-size:14px;line-height:1.6;color:#71717A;">Une question ? Répondez simplement à cet email.</p>
      `, { preheader: `${o.productName} : paiement recu, voici la suite.`, lang: "fr" }),
    };
  }
  return {
    subject: `Payment received — ${o.productName}`,
    html: wrapper(`
      <h1 style="margin:0 0 16px;font-size:22px;font-weight:900;">Payment received, thank you</h1>
      <p ${P}>Hello,</p>
      <p ${P}>We received <strong>$${o.amountUsd}</strong> for <strong>${o.productName}</strong>${o.siteLabel ? ` on ${o.siteLabel}` : ""}. One-off — nothing recurring.</p>
      <p ${P}><strong>What happens next:</strong> ${o.whatHappens}</p>
      <p style="margin:24px 0 0;font-size:14px;line-height:1.6;color:#71717A;">Questions? Just reply to this email.</p>
    `, { preheader: `${o.productName}: payment received, here is what happens next.`, lang: "en" }),
  };
};

/** Sent when a client requests to log into their portal (magic link). */
export const portalLoginEmail = (loginUrl: string, lang: "en" | "fr" = "en") => {
  if (lang === "fr") {
    return {
      subject: "Votre lien de connexion Servolia",
      html: wrapper(`
        <h1 style="margin:0 0 16px;font-size:22px;font-weight:900;">Connectez-vous à votre espace</h1>
        <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#3F3F46;">
          Cliquez ci-dessous pour vous connecter en toute sécurité — sans mot de passe. Ce lien expire dans 15 minutes.
        </p>
        ${btn(loginUrl, "Me connecter à Servolia →")}
        <p style="margin:24px 0 0;font-size:13px;line-height:1.6;color:#71717A;">
          Vous n'êtes pas à l'origine de cette demande ? Ignorez simplement cet email.
        </p>
      `, { preheader: "Votre lien expire dans 15 minutes, pour votre securite.", lang: "fr" }),
    };
  }
  return {
    subject: "Your Servolia login link",
    html: wrapper(`
      <h1 style="margin:0 0 16px;font-size:22px;font-weight:900;">Log in to your portal</h1>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#3F3F46;">
        Click below to securely log in — no password needed. This link expires in 15 minutes.
      </p>
      ${btn(loginUrl, "Log in to Servolia →")}
      <p style="margin:24px 0 0;font-size:13px;line-height:1.6;color:#71717A;">
        Didn't request this? You can safely ignore this email.
      </p>
      `, { preheader: "Your link expires in 15 minutes, for your security.", lang: "en" }),
  };
};

/** Sent to a client when the founder replies to their portal message. */
export const newPortalMessageEmail = (firstName: string, preview: string, lang: "en" | "fr" = "en") => {
  if (lang === "fr") {
    return {
      subject: "Nouvelle réponse de Servolia",
      html: wrapper(`
        <h1 style="margin:0 0 16px;font-size:22px;font-weight:900;">Vous avez un nouveau message</h1>
        <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#3F3F46;">Bonjour ${firstName},</p>
        <p style="margin:0 0 16px;padding:16px;background:#FAFAF7;border-left:3px solid #36671E;font-size:15px;line-height:1.6;color:#18181B;">
          ${preview}
        </p>
        ${btn("https://servolia.com/portal", "Voir et répondre →")}
      `, { preheader: "Ouvrez votre espace client pour lire et repondre.", lang: "fr" }),
    };
  }
  return {
    subject: "New reply from Servolia",
    html: wrapper(`
      <h1 style="margin:0 0 16px;font-size:22px;font-weight:900;">You have a new message</h1>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#3F3F46;">Hi ${firstName},</p>
      <p style="margin:0 0 16px;padding:16px;background:#FAFAF7;border-left:3px solid #36671E;font-size:15px;line-height:1.6;color:#18181B;">
        ${preview}
      </p>
      ${btn("https://servolia.com/portal", "View & reply →")}
      `, { preheader: "Open your client portal to read it and reply.", lang: "en" }),
  };
};

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Sent to the client (and a copy to the founder) right after they accept a scope document — their receipt/copy of what they agreed to. */
export const scopeAcceptedEmail = (businessName: string, acceptedName: string, acceptedAtIso: string, scopeText: string) => {
  const when = new Date(acceptedAtIso).toLocaleString("en-GB", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
  return {
    subject: `Scope accepted — ${businessName}`,
    html: wrapper(`
      <h1 style="margin:0 0 16px;font-size:22px;font-weight:900;">Scope accepted ✓</h1>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#3F3F46;">
        This confirms <strong>${escapeHtml(acceptedName)}</strong> accepted the scope below on behalf of <strong>${escapeHtml(businessName)}</strong>, on ${when}.
      </p>
      <pre style="margin:16px 0;padding:16px;background:#FAFAF7;border:1px solid #E8E6E0;border-radius:10px;font-family:inherit;font-size:13px;line-height:1.6;color:#18181B;white-space:pre-wrap;word-wrap:break-word;">${escapeHtml(scopeText)}</pre>
      <p style="margin:16px 0 0;font-size:13px;line-height:1.6;color:#71717A;">Keep this email as your copy of the agreed scope.</p>
      `, { preheader: "Signed and timestamped. Delivery starts now.", lang: "en" }),
  };
};

/** Monthly ROI report sent to each live client — the retention weapon. */
export const monthlyReportEmail = (input: {
  businessName: string;
  period: string; // "June 2026"
  lang: "en" | "fr";
  enquiries: number;
  bookings: number;
  afterHours: number;
  fromAds: number;
  estValue: number;
}) => {
  const fr = input.lang === "fr";
  const stat = (label: string, value: string, highlight = false) => `
    <td style="padding:14px 10px;text-align:center;background:${highlight ? "#EEF5EA" : "#FAFAF7"};border-radius:12px;">
      <div style="font-size:24px;font-weight:900;color:${highlight ? "#36671E" : "#18181B"};">${value}</div>
      <div style="font-size:11px;color:#71717A;margin-top:4px;">${label}</div>
    </td>`;
  return {
    subject: fr
      ? `${input.businessName} — votre rapport Servolia de ${input.period}`
      : `${input.businessName} — your Servolia report for ${input.period}`,
    html: wrapper(`
      <h1 style="margin:0 0 16px;font-size:22px;font-weight:900;">${fr ? `Votre mois en chiffres — ${input.period}` : `Your month in numbers — ${input.period}`}</h1>
      <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#3F3F46;">
        ${fr
          ? `Voici ce que votre assistant Servolia a capté pour <strong>${input.businessName}</strong> ce mois-ci :`
          : `Here's what your Servolia assistant captured for <strong>${input.businessName}</strong> this month:`}
      </p>
      <table style="width:100%;border-collapse:separate;border-spacing:6px;margin:0 0 20px;">
        <tr>
          ${stat(fr ? "Demandes traitées" : "Enquiries handled", String(input.enquiries))}
          ${stat(fr ? "Demandes de RDV" : "Booking requests", String(input.bookings), true)}
        </tr>
        <tr>
          ${stat(fr ? "Hors horaires d'ouverture" : "After business hours", String(input.afterHours))}
          ${stat(fr ? "Venant de vos publicités" : "From your ads", String(input.fromAds))}
        </tr>
      </table>
      ${input.estValue > 0 ? `
      <div style="background:#0A1F14;border-radius:12px;padding:20px;text-align:center;margin:0 0 20px;">
        <div style="font-size:12px;color:#ABDF90;font-weight:700;text-transform:uppercase;letter-spacing:1px;">${fr ? "Valeur estimée des RDV captés" : "Estimated value of captured bookings"}</div>
        <div style="font-size:32px;font-weight:900;color:#FAFAF7;margin-top:6px;">€${input.estValue.toLocaleString()}</div>
      </div>` : ""}
      <p style="margin:0;font-size:14px;line-height:1.6;color:#71717A;">
        ${fr
          ? "Une question sur ces chiffres ? Répondez simplement à cet email."
          : "Questions about these numbers? Just reply to this email."}
      </p>
      `, { preheader: "Your numbers for the month, in one page.", lang: "en" }),
  };
};

/** Sent to client when their build goes live.
 *  Wired 2026-08-12: fires exactly once on the build's transition to "live"
 *  (PATCH /api/admin/builds/[id]). */
export const liveEmail = (firstName: string, url: string, lang: "en" | "fr" = "en") => {
  if (lang === "fr") {
    return {
      subject: "🚀 Votre système est en ligne",
      html: wrapper(`
        <h1 style="margin:0 0 16px;font-size:22px;font-weight:900;">Vous êtes en ligne.</h1>
        <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#3F3F46;">Bonjour ${firstName},</p>
        <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#3F3F46;">
          Votre système IA est en ligne sur <a href="${url}" style="color:#36671E;">${url}</a> et reçoit déjà du trafic.
        </p>
        <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#3F3F46;">
          <strong>À faire aujourd'hui :</strong>
        </p>
        <ul style="margin:0 0 16px;padding-left:20px;font-size:15px;line-height:1.7;color:#3F3F46;">
          <li>Partagez l'adresse sur Instagram, Google Maps et votre signature email</li>
          <li><strong>Votre espace client :</strong> <a href="https://servolia.com/portal" style="color:#36671E;">servolia.com/portal</a> — connectez-vous avec cette adresse email, un lien de connexion vous arrive aussitôt. Toutes vos demandes, vos statistiques et vos rapports y sont.</li>
          <li>Chaque demande qui arrive vous est signalée aussitôt, et apparaît dans votre espace</li>
          <li>Quelque chose ne va pas ? Répondez simplement à cet email</li>
        </ul>
        ${btn(url, "Voir mon système en ligne →")}
      `, { preheader: "Votre site est en ligne. Voici le lien et la suite.", lang: "fr" }),
    };
  }
  return {
    subject: "🚀 Your system is live",
    html: wrapper(`
      <h1 style="margin:0 0 16px;font-size:22px;font-weight:900;">You're live.</h1>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#3F3F46;">Hi ${firstName},</p>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#3F3F46;">
        Your AI system is live at <a href="${url}" style="color:#36671E;">${url}</a> and already accepting traffic.
      </p>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#3F3F46;">
        <strong>What to do today:</strong>
      </p>
      <ul style="margin:0 0 16px;padding-left:20px;font-size:15px;line-height:1.7;color:#3F3F46;">
        <li>Share the URL on Instagram, Google Maps, your email signature</li>
        <li><strong>Your client portal:</strong> <a href="https://servolia.com/portal" style="color:#36671E;">servolia.com/portal</a> — log in with this email address and a sign-in link arrives instantly. Every enquiry, your traffic and your reports live there.</li>
        <li>Every enquiry that lands is flagged to you at once, and appears in your portal</li>
        <li>If anything looks off, just reply to this email</li>
      </ul>
      ${btn(url, "View your live system →")}
      `, { preheader: "Your site is live. Here is the link and what comes next.", lang: "en" }),
  };
};

// ============================================================================
// CLIENT SERVICES (hosting, AI assistant) — the USD line, not the Servolia
// subscription. Kept apart from installationPaidEmail: that one is EUR, opens
// a build, and sends the buyer to an intake form. These clients already have a
// finished site and are buying it kept running, so an intake link would be
// nonsense and the currency would be wrong.
// ============================================================================

/**
 * Sent by the Stripe webhook the moment a hosting or assistant payment clears.
 *
 * WHY THIS EXISTS AT ALL. Stripe's own receipt only goes out if "Successful
 * payments" is switched on in the dashboard — a toggle that lives outside this
 * repository, cannot be read back through the API, and can be turned off by
 * anyone with dashboard access. /hosting/thanks tells the buyer a receipt is
 * coming, so leaving that promise resting on a setting we cannot see meant it
 * could quietly stop being true. This email is ours, so it is not a promise we
 * have to hope someone else keeps.
 *
 * It does not replace the Stripe receipt, which is the tax document. Leave that
 * setting on.
 */
export const clientServicePaidEmail = (input: {
  /** "Website hosting" / "AI assistant" — the headline form. */
  productName: string;
  /** The same thing written mid-sentence: "hosting", "AI assistant". Never
   *  derived by lowercasing productName — that yields "ai assistant". */
  productNoun: string;
  /** e.g. "goodscochina.com". Empty when the ref was unknown. */
  siteLabel: string;
  amountUsd: number;
  period: "monthly" | "annual";
  /** Next charge, ISO. Omitted rather than guessed if it could not be worked out. */
  nextChargeIso?: string | null;
  /** The monthly rate, so an annual buyer can see what the year bought. */
  monthlyUsd?: number;
  /** True when this payment switched a suspended add-on back on. */
  restored?: boolean;
  /** True when this payment lifted the notice on a site waiting to go live. */
  activated?: boolean;
  /** A few lines of what the money covers. */
  includes?: string[];
  lang?: "en" | "fr";
  /**
   * Signed link to switch this subscription to yearly. Shown only to monthly
   * payers, and only when there is a real saving.
   *
   * It lives HERE, in the receipt, rather than in a separate campaign: this is
   * the one message about their hosting they are guaranteed to open, and a
   * client who is happy enough to have just paid is the client most likely to
   * pay for the year. No second email has to be sent, and nothing has to be
   * remembered.
   */
  upgradeUrl?: string | null;
  /**
   * Stripe's billing portal — card, invoices, cancel.
   *
   * Standing in every receipt so a client never has to ask for it, and never
   * has to find an old email when their card expires. The link is to OUR
   * route, which mints the Stripe session at click time: a portal session
   * minted now would be long expired by the time anyone needed it.
   */
  portalUrl?: string | null;
  /**
   * The handover form, for a client who bought from the plans page.
   *
   * This is the step that connects their payment to their website: until they
   * say where the site lives, nothing can be hosted. The thank-you page
   * offers it once; this is the copy that survives — the email is the thing
   * they open again on Monday when they meant to do it on Friday. Null for a
   * client we already host, who has nothing to hand over.
   */
  setupUrl?: string | null;
  /** The reference to quote, shown beside the setup step. */
  reference?: string | null;
  /** A domain bought with the plan, and whether the registration went through. */
  domainName?: string | null;
  domainRegistered?: boolean;
  /** Renews with a yearly plan, or is charged each year on a monthly plan's invoice. */
  domainBilling?: "with-plan" | "yearly-invoice";
  /** Everything charged today, when it differs from the plan's own price. */
  totalPaidUsd?: number | null;
  /** The domain's yearly price, when one was bought with the plan. */
  domainUsd?: number | null;
  /** A one-time line on the first payment (Business: mailbox setup). */
  oneTimeUsd?: number | null;
  /**
   * The AI assistant, when that is what was bought. `installed` is the real
   * outcome of the webhook's commit to a site we host — never assumed.
   * `snippet` is the line a client whose site lives elsewhere adds
   * themselves, and `briefUrl` is where either kind of client tells the
   * assistant about their business.
   */
  assistant?: {
    installed: boolean;
    snippet: string | null;
    briefUrl: string | null;
  } | null;
}) => {
  const {
    productName, productNoun, siteLabel, amountUsd, period,
    nextChargeIso = null, monthlyUsd, restored = false, activated = false, includes = [], lang = "en",
    upgradeUrl = null, portalUrl = null, setupUrl = null, reference = null,
    domainName = null, domainRegistered = false, domainBilling = "with-plan",
    totalPaidUsd = null, domainUsd = null, oneTimeUsd = null, assistant = null,
  } = input;

  const fr = lang === "fr";
  const forSite = siteLabel ? (fr ? ` pour ${siteLabel}` : ` for ${siteLabel}`) : "";
  const term = fr
    ? (period === "annual" ? "an" : "mois")
    : (period === "annual" ? "year" : "month");
  const nextCharge = nextChargeIso
    ? new Date(nextChargeIso).toLocaleDateString(fr ? "fr-FR" : "en-GB", {
        day: "numeric", month: "long", year: "numeric", timeZone: "UTC",
      })
    : null;
  /* USD written the French way: "12 $", space before the sign. Getting this
     wrong is a small thing that makes a payment page read as machine output. */
  const money = (n: number) => (fr ? `${usdFmt(n)}&nbsp;$` : `$${usdFmt(n)}`);

  /* An annual buyer is told what they saved, but only when there is a saving.
     Claiming one that does not exist is the kind of small lie that costs more
     than the discount is worth. */
  const saving = period === "annual" && monthlyUsd
    ? monthlyUsd * 12 - amountUsd
    : 0;

  const headline = fr
    ? (activated ? "Votre site est en ligne" : restored ? `Votre ${productNoun} est de nouveau actif` : "Paiement reçu")
    : (activated ? "Your site is live" : restored ? `Your ${productNoun} is back on` : "Payment received");

  const opening = fr
    ? (activated
        ? `Merci — votre paiement a été validé et votre site${forSite} est maintenant en ligne. Rien d'autre à faire.`
        : restored
        ? `Merci — votre paiement a été validé et votre ${productNoun} a été réactivé${forSite}. Il fonctionne de nouveau ; vous n'avez rien à faire.`
        : `Merci — votre paiement a été validé et votre ${productNoun}${forSite} est actif. Rien d'autre à faire.`)
    : (activated
        ? `Thank you — your payment cleared and your site${forSite} is now live. Nothing else to do.`
        : restored
        ? `Thank you — your payment cleared and your ${productNoun} has been switched back on${forSite}. It is live again now; you do not need to do anything.`
        : `Thank you — your payment cleared and your ${productNoun}${forSite} is active. Nothing else to do.`);

  const L = fr
    ? {
        subject: `Paiement reçu — ${productName}${siteLabel ? ` pour ${siteLabel}` : ""}`,
        paidFor: "Ce que vous avez payé",
        per: `par ${term}`,
        saved: `vous économisez ${saving}&nbsp;$ par rapport au mensuel`,
        renewsOn: (d: string) =>
          `Renouvellement automatique le <strong style="color:${BODY};">${d}</strong> au même prix. Vous pouvez résilier à tout moment avant cette date.`,
        renewsEach: `Renouvellement automatique chaque ${term} au même prix. Vous pouvez résilier à tout moment.`,
        covers: "Ce que cela comprend :",
        receipt:
          "Stripe vous a envoyé un reçu séparé pour vos archives. Si vous avez besoin d'une facture à en-tête de votre société, répondez à cet email et je vous l'envoie.",
        questions: `Une question sur votre ${productNoun} ? Répondez simplement ici — une personne lit chaque message.`,
        preheader: activated
          ? "Votre site est en ligne. Voici ce que vous avez payé et la date de renouvellement."
          : restored
          ? `Votre ${productNoun} fonctionne de nouveau. Voici ce que vous avez payé et la date de renouvellement.`
          : "C'est confirmé. Voici ce que vous avez payé et la date de renouvellement.",
      }
    : {
        subject: `Payment received — ${productName}${siteLabel ? ` for ${siteLabel}` : ""}`,
        paidFor: "What you paid for",
        per: `per ${term}`,
        saved: `you saved $${saving} against paying monthly`,
        renewsOn: (d: string) =>
          `Renews automatically on <strong style="color:${BODY};">${d}</strong> at the same price. You can cancel any time before then.`,
        renewsEach: `Renews automatically each ${term} at the same price. You can cancel any time.`,
        covers: "What this covers:",
        receipt:
          "Stripe has emailed you a separate receipt for your records. If you need an invoice with your company details on it, reply to this email and I will send one.",
        questions: `Any question about your ${productNoun} — just reply here. A person reads every message.`,
        preheader: activated
          ? "Your site is live. Here is what you paid and when it renews."
          : restored
          ? `Your ${productNoun} is live again. Here is what you paid and when it renews.`
          : "Confirmed. Here is what you paid and when it renews.",
      };

  /* Offered only to a monthly payer, and only when the caller minted a link.
     Whether the year is actually cheaper is the CALLER's decision, not a sum
     done here: this template is given what was paid, never the annual price,
     so any comparison it tried to make would be invented. An annual buyer has
     nothing to upgrade to, and inviting them to "save" would be nonsense. */
  const upsell = upgradeUrl && period === "monthly"
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
              style="margin:0 0 22px;border:1px dashed ${LINE};border-radius:12px;">
         <tr><td style="padding:16px 20px;font-family:${FONT};">
           <p style="margin:0 0 6px;font-size:15px;font-weight:700;color:${INK};">
             ${fr ? "Vous préférez payer une fois par an ?" : "Rather pay once a year?"}
           </p>
           <p style="margin:0 0 10px;font-size:14px;line-height:1.6;color:${BODY};">
             ${fr
               ? "Le tarif annuel revient moins cher que douze mensualités, et il n'y a plus qu'un seul prélèvement. Les jours déjà payés ce mois-ci sont crédités."
               : "The yearly price works out cheaper than twelve monthly payments, and there is only one charge to think about. The days you have already paid for this month are credited."}
           </p>
           <a href="${upgradeUrl}" style="font-size:14px;font-weight:700;color:${GREEN};text-decoration:none;">
             ${fr ? "Voir le montant exact &rarr;" : "See the exact amount &rarr;"}
           </a>
         </td></tr>
       </table>`
    : "";

  return {
    subject: L.subject,
    html: wrapper(`
      <h1 style="margin:0 0 16px;font-size:22px;font-weight:900;">${headline}</h1>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:${BODY};">${opening}</p>

      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
             style="margin:0 0 20px;border:1px solid ${LINE};border-radius:12px;background:${CREAM};">
        <tr><td style="padding:18px 20px;font-family:${FONT};">
          <p style="margin:0 0 6px;font-size:11px;font-weight:900;letter-spacing:1px;text-transform:uppercase;color:${MUTED};">${L.paidFor}</p>
          <p style="margin:0 0 2px;font-size:17px;font-weight:800;color:${INK};">${productName}${siteLabel ? ` &middot; ${siteLabel}` : ""}</p>
          <p style="margin:0;font-size:15px;color:${BODY};">
            <strong>${money(amountUsd)}</strong> ${L.per}${saving > 0 ? ` &middot; ${L.saved}` : ""}
          </p>
          ${domainUsd ? `<p style="margin:4px 0 0;font-size:14px;color:${BODY};">+ ${money(domainUsd)} ${fr ? "par an" : "per year"} &middot; ${fr ? "domaine" : "domain"}${domainName ? ` ${domainName}` : ""}</p>` : ""}
          ${oneTimeUsd ? `<p style="margin:4px 0 0;font-size:14px;color:${BODY};">+ ${money(oneTimeUsd)} ${fr ? "une fois" : "once"} &middot; ${fr ? "mise en place des boîtes email" : "mailbox setup"}</p>` : ""}
          ${totalPaidUsd && Math.abs(totalPaidUsd - amountUsd) > 0.005 ? `<p style="margin:8px 0 0;font-size:14px;font-weight:700;color:${INK};">${fr ? "Total prélevé aujourd'hui" : "Total charged today"} : ${money(totalPaidUsd)}</p>` : ""}
          <p style="margin:10px 0 0;font-size:14px;color:${MUTED};">${nextCharge ? L.renewsOn(nextCharge) : L.renewsEach}</p>
          ${domainName ? `<p style="margin:12px 0 0;padding-top:12px;border-top:1px solid ${LINE};font-size:14px;line-height:1.6;color:${BODY};">
            ${fr ? "Domaine" : "Domain"} <strong style="color:${INK};">${domainName}</strong> —
            ${domainRegistered
              ? (fr
                  ? (domainBilling === "yearly-invoice"
                      ? "enregistré par Servolia pour vous, payé pour un an, puis renouvelé chaque année sur votre facture. Il vous appartient ; nous vous le transférons sur simple demande."
                      : "enregistré par Servolia pour vous et renouvelé avec votre formule. Il vous appartient ; nous vous le transférons sur simple demande.")
                  : (domainBilling === "yearly-invoice"
                      ? "registered by Servolia for you, paid for one year, then renewed each year on your invoice. It is yours; we transfer it to you on request."
                      : "registered by Servolia for you and renewed with your plan. It is yours; we transfer it to you on request."))
              : (fr
                  ? "nous l'enregistrons pour vous en ce moment et vous le confirmons par email."
                  : "we are registering it for you now and will confirm by email.")}
          </p>` : ""}
        </td></tr>
      </table>

      ${includes.length ? `
      <p style="margin:0 0 10px;font-size:15px;line-height:1.6;color:${BODY};"><strong>${L.covers}</strong></p>
      <ul style="margin:0 0 20px;padding-left:20px;font-size:15px;line-height:1.7;color:${BODY};">
        ${includes.map((line) => `<li>${line}</li>`).join("")}
      </ul>` : ""}

      ${assistant ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
              style="margin:0 0 22px;border:2px solid ${GREEN};border-radius:12px;">
         <tr><td style="padding:18px 20px;font-family:${FONT};">
           <p style="margin:0 0 6px;font-size:11px;font-weight:900;letter-spacing:1px;text-transform:uppercase;color:${GREEN};">
             ${assistant.installed ? (fr ? "Votre assistant est en ligne" : "Your assistant is live") : (fr ? "Dernière étape" : "Last step")}
           </p>
           ${assistant.installed
             ? `<p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:${BODY};">
                  ${fr
                    ? "Il a été ajouté à votre site automatiquement et répond dès maintenant à vos visiteurs, dans leur langue. Ouvrez sa fiche pour affiner ce qu'il sait — services, horaires, réponses types — et vérifier où arrivent les demandes."
                    : "It has been added to your site automatically and is answering your visitors now, in their language. Open its page to refine what it knows — services, hours, standard answers — and check where enquiries are sent."}
                </p>`
             : `<p style="margin:0 0 10px;font-size:14px;line-height:1.6;color:${BODY};">
                  ${fr
                    ? "Ajoutez cette ligne à votre site, juste avant <code>&lt;/body&gt;</code> — ou transmettez-la à la personne qui gère votre site :"
                    : "Add this line to your site, just before <code>&lt;/body&gt;</code> — or pass it to whoever looks after your site:"}
                </p>
                <p style="margin:0 0 12px;padding:10px 12px;background:${CREAM};border:1px solid ${LINE};border-radius:8px;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12px;line-height:1.5;color:${INK};word-break:break-all;">${(assistant.snippet ?? "").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>
                <p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:${BODY};">
                  ${fr
                    ? "Puis dites-lui ce qu'il doit savoir sur votre activité — deux minutes, et il répond juste."
                    : "Then tell it what it needs to know about your business — two minutes, and it answers correctly."}
                </p>`}
           ${assistant.briefUrl ? btn(assistant.briefUrl, assistant.installed
             ? (fr ? "Régler mon assistant" : "Set up my assistant")
             : (fr ? "Décrire mon activité" : "Describe my business")) : ""}
           ${reference ? `<p style="margin:12px 0 0;font-size:13px;color:${MUTED};">
             ${fr ? "Votre référence" : "Your reference"}: <strong style="color:${INK};font-family:ui-monospace,Menlo,Consolas,monospace;">${reference}</strong>
           </p>` : ""}
         </td></tr>
       </table>` : ""}
      ${setupUrl ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
              style="margin:0 0 22px;border:2px solid ${GREEN};border-radius:12px;">
         <tr><td style="padding:18px 20px;font-family:${FONT};">
           <p style="margin:0 0 6px;font-size:11px;font-weight:900;letter-spacing:1px;text-transform:uppercase;color:${GREEN};">
             ${fr ? "Prochaine étape" : "Next step"}
           </p>
           <p style="margin:0 0 6px;font-size:15px;font-weight:700;color:${INK};">
             ${fr ? "Dites-nous où se trouve votre site" : "Tell us where your site lives"}
           </p>
           <p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:${BODY};">
             ${fr
               ? "Deux minutes : l'adresse actuelle, la plateforme, et comment nous y accéder. Nous ne demandons jamais de mot de passe — un accès délégué suffit. La mise en place commence dès réception."
               : "Two minutes: the current address, the platform, and how to reach it. We never ask for a password — delegated access is enough. Setup starts as soon as it arrives."}
           </p>
           ${btn(setupUrl, fr ? "Compléter la mise en place" : "Complete setup")}
           ${reference ? `<p style="margin:12px 0 0;font-size:13px;color:${MUTED};">
             ${fr ? "Votre référence" : "Your reference"}: <strong style="color:${INK};font-family:ui-monospace,Menlo,Consolas,monospace;">${reference}</strong>
             ${fr ? " — indiquez-la dans tout échange." : " — quote it in any message."}
           </p>` : ""}
         </td></tr>
       </table>` : ""}
      ${upsell}
      <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:${BODY};">${L.receipt}</p>
      ${portalUrl ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
              style="margin:0 0 20px;border:1px solid ${LINE};border-radius:12px;">
         <tr><td style="padding:16px 20px;font-family:${FONT};">
           <p style="margin:0 0 4px;font-size:15px;font-weight:700;color:${INK};">
             ${fr ? "Votre page de service" : "Your service page"}
           </p>
           <p style="margin:0 0 10px;font-size:14px;line-height:1.6;color:${BODY};">
             ${fr
               ? "Ce que couvre votre formule, la date de renouvellement, vos factures, votre carte, et la résiliation — tout au même endroit, sans mot de passe."
               : "What your plan covers, when it renews, your invoices, your card, and cancelling — all in one place, no password."}
           </p>
           <a href="${portalUrl}" style="font-size:14px;font-weight:700;color:${GREEN};text-decoration:none;">
             ${fr ? "Ouvrir ma page &rarr;" : "Open my page &rarr;"}
           </a>
         </td></tr>
       </table>` : ""}
      <p style="margin:0;font-size:14px;line-height:1.6;color:${MUTED};">${L.questions}</p>
      `, { preheader: L.preheader, lang }),
  };
};

/**
 * Sent when a client settles an old unpaid balance — a one-off charge, not a
 * subscription. Deliberately says nothing about renewals: this is the last
 * time they will be charged for it, and implying otherwise on a debt someone
 * has just cleared is the wrong note to end on.
 */
export const balanceSettledEmail = (input: {
  siteLabel: string;
  amountUsd: number;
  label: string;
  lang?: "en" | "fr";
}) => {
  const { siteLabel, amountUsd, label, lang = "en" } = input;
  const fr = lang === "fr";
  const money = fr ? `${amountUsd}&nbsp;$` : `$${amountUsd}`;
  const L = fr
    ? {
        subject: `Paiement reçu — solde réglé${siteLabel ? ` pour ${siteLabel}` : ""}`,
        headline: "C'est réglé",
        body: `Merci — votre paiement de <strong>${money}</strong> a été validé${siteLabel ? ` pour ${siteLabel}` : ""}. Votre compte est à jour et il ne reste rien à payer.`,
        forWhat: "Objet du paiement",
        once: "Il s'agissait d'un paiement unique. Il ne se répétera pas.",
        receipt:
          "Stripe vous a envoyé un reçu. Besoin d'une facture à en-tête de votre société ? Répondez simplement ici.",
        preheader: "Votre solde est réglé. Rien ne reste dû.",
      }
    : {
        subject: `Payment received — balance cleared${siteLabel ? ` for ${siteLabel}` : ""}`,
        headline: "That's settled",
        body: `Thank you — your payment of <strong>${money}</strong> has cleared${siteLabel ? ` for ${siteLabel}` : ""}. Your account is now up to date and there is nothing outstanding.`,
        forWhat: "What this was for",
        once: "This was a one-off charge. It will not repeat.",
        receipt:
          "Stripe has emailed you a receipt. Need an invoice with your company details? Just reply here.",
        preheader: "Your balance is clear. Nothing outstanding.",
      };
  /* The label is operator-written and already carries its own capitals and
     punctuation ("Unpaid hosting — July and August"). It is therefore printed
     verbatim and kept out of the subject line: dropped in there it produced
     "Payment received — Unpaid hosting — July and August for x.ma", two dashes
     deep and unreadable in an inbox list. */
  return {
    subject: L.subject,
    html: wrapper(`
      <h1 style="margin:0 0 16px;font-size:22px;font-weight:900;">${L.headline}</h1>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:${BODY};">${L.body}</p>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
             style="margin:0 0 20px;border:1px solid ${LINE};border-radius:12px;background:${CREAM};">
        <tr><td style="padding:16px 20px;font-family:${FONT};">
          <p style="margin:0 0 4px;font-size:11px;font-weight:900;letter-spacing:1px;text-transform:uppercase;color:${MUTED};">${L.forWhat}</p>
          <p style="margin:0;font-size:15px;color:${INK};">${label}</p>
        </td></tr>
      </table>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:${BODY};">${L.once}</p>
      <p style="margin:0;font-size:14px;line-height:1.6;color:${MUTED};">${L.receipt}</p>
      `, { preheader: L.preheader, lang }),
  };
};

/**
 * "Switch to yearly" — sent when a client asks for the link again.
 *
 * The offer also rides in every monthly payment confirmation, so this exists
 * for the client who has deleted that email and wants to upgrade in month
 * five. Deliberately plain: the saving is the argument, and dressing it up
 * reads as a sales email rather than a service one.
 */
export const upgradeLinkEmail = (input: {
  url: string;
  productName: string;
  siteLabel: string;
  monthlyUsd: number;
  annualUsd: number;
  savingUsd: number;
  lang?: "en" | "fr";
}) => {
  const { url, productName, siteLabel, monthlyUsd, annualUsd, savingUsd, lang = "en" } = input;
  const fr = lang === "fr";
  const money = (n: number) => (fr ? `${n}&nbsp;$` : `$${n}`);
  const forSite = siteLabel ? (fr ? ` pour ${siteLabel}` : ` for ${siteLabel}`) : "";

  if (fr) {
    return {
      subject: `Passer à l'année — ${productName}${siteLabel ? ` pour ${siteLabel}` : ""}`,
      html: wrapper(`
        <h1 style="margin:0 0 16px;font-size:22px;font-weight:900;">Payer à l'année et économiser ${money(savingUsd)}</h1>
        <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:${BODY};">
          Votre ${productName}${forSite} est actuellement facturé <strong>${money(monthlyUsd)} par mois</strong>, soit ${money(monthlyUsd * 12)} sur l'année. En annuel, c'est <strong>${money(annualUsd)}</strong> — un seul paiement, ${money(savingUsd)} de moins.
        </p>
        <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:${BODY};">
          Rien d'autre ne change : même service, résiliable à tout moment. Les jours déjà payés ce mois-ci vous sont crédités, vous ne payez donc pas deux fois.
        </p>
        ${btn(url, "Voir le montant exact →")}
        <p style="margin:20px 0 0;font-size:14px;line-height:1.6;color:${MUTED};">
          Le lien vous montre d'abord le montant exact à payer aujourd'hui. Rien n'est débité tant que vous n'avez pas confirmé.
        </p>
      `, { preheader: `Économisez ${savingUsd} $ en passant à l'année.`, lang: "fr" }),
    };
  }

  return {
    subject: `Switch to yearly — ${productName}${siteLabel ? ` for ${siteLabel}` : ""}`,
    html: wrapper(`
      <h1 style="margin:0 0 16px;font-size:22px;font-weight:900;">Pay yearly and save ${money(savingUsd)}</h1>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:${BODY};">
        Your ${productName}${forSite} is billed <strong>${money(monthlyUsd)} a month</strong> — ${money(monthlyUsd * 12)} over a year. Yearly is <strong>${money(annualUsd)}</strong>: one payment, ${money(savingUsd)} less.
      </p>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:${BODY};">
        Nothing else changes — same service, cancel any time. The days you have already paid for this month are credited, so you are not charged twice.
      </p>
      ${btn(url, "See the exact amount →")}
      <p style="margin:20px 0 0;font-size:14px;line-height:1.6;color:${MUTED};">
        The link shows you exactly what you would pay today first. Nothing is charged until you confirm.
      </p>
    `, { preheader: `Save $${savingUsd} by paying for the year.`, lang: "en" }),
  };
};

/** Sent once the switch has actually gone through. */
export const upgradeDoneEmail = (input: {
  productName: string;
  productNoun: string;
  siteLabel: string;
  annualUsd: number;
  savingUsd: number;
  lang?: "en" | "fr";
}) => {
  const { productName, productNoun, siteLabel, annualUsd, savingUsd, lang = "en" } = input;
  const fr = lang === "fr";
  const money = (n: number) => (fr ? `${n}&nbsp;$` : `$${n}`);
  const nextYear = new Date();
  nextYear.setUTCFullYear(nextYear.getUTCFullYear() + 1);
  const when = nextYear.toLocaleDateString(fr ? "fr-FR" : "en-GB", {
    day: "numeric", month: "long", year: "numeric", timeZone: "UTC",
  });

  if (fr) {
    return {
      subject: `Vous êtes passé à l'année — ${productName}${siteLabel ? ` pour ${siteLabel}` : ""}`,
      html: wrapper(`
        <h1 style="margin:0 0 16px;font-size:22px;font-weight:900;">C'est fait — vous êtes en annuel</h1>
        <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:${BODY};">
          Votre ${productNoun}${siteLabel ? ` pour ${siteLabel}` : ""} est désormais facturé <strong>${money(annualUsd)} par an</strong> au lieu du mensuel. Vous économisez ${money(savingUsd)} sur l'année, et il n'y a plus de prélèvement mensuel.
        </p>
        <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:${BODY};">
          Prochain paiement : <strong>${when}</strong>. Les jours déjà réglés ce mois-ci ont été déduits du montant d'aujourd'hui.
        </p>
        <p style="margin:0;font-size:14px;line-height:1.6;color:${MUTED};">
          Le service n'a pas été interrompu une seconde. Une question ? Répondez simplement ici.
        </p>
      `, { preheader: `Facturation annuelle active. Prochain paiement le ${when}.`, lang: "fr" }),
    };
  }

  return {
    subject: `You're on the yearly plan — ${productName}${siteLabel ? ` for ${siteLabel}` : ""}`,
    html: wrapper(`
      <h1 style="margin:0 0 16px;font-size:22px;font-weight:900;">Done — you're on yearly</h1>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:${BODY};">
        Your ${productNoun}${siteLabel ? ` for ${siteLabel}` : ""} is now billed <strong>${money(annualUsd)} a year</strong> instead of monthly. That saves you ${money(savingUsd)} over the year, and the monthly charge has stopped.
      </p>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:${BODY};">
        Next payment: <strong>${when}</strong>. The days you had already paid for this month were taken off today's amount.
      </p>
      <p style="margin:0;font-size:14px;line-height:1.6;color:${MUTED};">
        The service did not stop for a second. Any questions, just reply here.
      </p>
    `, { preheader: `Yearly billing is active. Next payment ${when}.`, lang: "en" }),
  };
};

/**
 * CARD DECLINED — the email that decides whether this client stays.
 *
 * Involuntary churn is the expensive kind: the client did not choose to leave,
 * their card expired. Until this existed the webhook recorded past_due, opened
 * a grace period and messaged the operator on Telegram — and told the CLIENT
 * nothing. They found out when their site or assistant stopped, which is the
 * moment a small subscription stops being worth the bother.
 *
 * Written as a heads-up, not a demand. Nothing has been lost yet, the service
 * is still running, and the fix is thirty seconds of their time. `attempt`
 * changes the urgency but never the tone: the second one names the date the
 * service stops, because by then that is the useful fact.
 */
export const paymentFailedEmail = (input: {
  productName: string;
  productNoun: string;
  siteLabel: string;
  /** Stripe's hosted portal, where the card is actually replaced. Null when a
   *  session could not be created — the email still goes, without the button. */
  portalUrl?: string | null;
  /** Stripe's own invoice page, as a second route to paying. */
  invoiceUrl?: string | null;
  /** When the service stops if nothing changes. */
  graceEndsIso?: string | null;
  attempt?: "first" | "final";
  lang?: "en" | "fr";
}) => {
  const {
    productName, productNoun, siteLabel, portalUrl = null,
    invoiceUrl = null, graceEndsIso = null, attempt = "first", lang = "en",
  } = input;

  const fr = lang === "fr";
  const final = attempt === "final";
  const forSite = siteLabel ? (fr ? ` pour ${siteLabel}` : ` for ${siteLabel}`) : "";
  const deadline = graceEndsIso
    ? new Date(graceEndsIso).toLocaleDateString(fr ? "fr-FR" : "en-GB", {
        day: "numeric", month: "long", timeZone: "UTC",
      })
    : null;

  const L = fr
    ? {
        subject: final
          ? `Action requise — votre ${productNoun}${siteLabel ? ` pour ${siteLabel}` : ""} va s'arrêter`
          : `Votre carte a été refusée — ${productName}${siteLabel ? ` pour ${siteLabel}` : ""}`,
        headline: final ? "Votre carte n'a toujours pas été mise à jour" : "Votre carte a été refusée",
        opening: final
          ? `Nous n'avons toujours pas pu débiter votre carte pour votre ${productNoun}${forSite}. Le service fonctionne encore${deadline ? `, mais il s'arrêtera le <strong>${deadline}</strong> si rien ne change` : ""}.`
          : `Le paiement de votre ${productNoun}${forSite} n'est pas passé. Cela arrive presque toujours pour une raison banale : une carte expirée, remplacée, ou un plafond atteint.`,
        reassure: final
          ? "Il n'y a rien à réactiver ensuite : dès que le paiement passe, tout continue normalement."
          : "Votre service continue de fonctionner normalement. Rien n'est interrompu, et nous réessaierons automatiquement.",
        cta: "Mettre à jour ma carte",
        invoice: "Ou régler la facture directement",
        help: "Si vous préférez qu'on s'en occupe, répondez simplement à cet email.",
        preheader: final
          ? `Le service s'arrête${deadline ? ` le ${deadline}` : " bientôt"} si la carte n'est pas mise à jour.`
          : "Rien n'est interrompu. Il suffit de mettre la carte à jour.",
      }
    : {
        subject: final
          ? `Action needed — your ${productNoun}${siteLabel ? ` for ${siteLabel}` : ""} is about to stop`
          : `Your card was declined — ${productName}${siteLabel ? ` for ${siteLabel}` : ""}`,
        headline: final ? "Your card still hasn't been updated" : "Your card was declined",
        opening: final
          ? `We still haven't been able to charge your card for your ${productNoun}${forSite}. The service is still running${deadline ? `, but it will stop on <strong>${deadline}</strong> if nothing changes` : ""}.`
          : `The payment for your ${productNoun}${forSite} didn't go through. It is almost always something ordinary — a card that expired, was replaced, or hit a limit.`,
        reassure: final
          ? "There is nothing to reactivate afterwards: the moment the payment clears, everything carries on."
          : "Your service is still running as normal. Nothing has stopped, and we will retry automatically.",
        cta: "Update my card",
        invoice: "Or pay the invoice directly",
        help: "If you would rather we handled it, just reply to this email.",
        preheader: final
          ? `The service stops${deadline ? ` on ${deadline}` : " soon"} unless the card is updated.`
          : "Nothing has stopped. The card just needs updating.",
      };

  return {
    subject: L.subject,
    html: wrapper(`
      <h1 style="margin:0 0 16px;font-size:22px;font-weight:900;">${L.headline}</h1>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:${BODY};">${L.opening}</p>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:${BODY};">${L.reassure}</p>
      ${portalUrl ? btn(portalUrl, L.cta) : ""}
      ${invoiceUrl ? `<p style="margin:${portalUrl ? "14px" : "24px"} 0 0;font-size:14px;line-height:1.6;">
        <a href="${invoiceUrl}" style="color:${GREEN};text-decoration:none;font-weight:600;">${L.invoice} &rarr;</a>
      </p>` : ""}
      <p style="margin:24px 0 0;font-size:14px;line-height:1.6;color:${MUTED};">${L.help}</p>
      `, { preheader: L.preheader, lang }),
  };
};

/**
 * "Your assistant is paused — here is how to switch it back on."
 *
 * Sent by hand from /admin, not by a schedule: this is the one-off nudge for a
 * client whose service was already suspended before any of the automatic
 * dunning existed, so no card failed and no grace period is running.
 *
 * The payment page needs no token. It takes money rather than granting access,
 * so a forwarded link costs the recipient nothing and lets the client pay from
 * whichever device they read this on.
 */
/**
 * Sent when a client's site is in place behind the neutral notice and only
 * the hosting payment stands between it and being live -- a new client, or
 * an existing one moving to a new domain.
 *
 * Says plainly what visitors see meanwhile, because the owner will open the
 * new address before opening this email and needs to know the "temporarily
 * unavailable" page is expected, not a broken DNS change.
 */
export const activateEmail = (input: {
  siteLabel: string;
  url: string;
  productName: string;
  monthlyUsd: number;
  annualUsd: number;
  includes: string[];
  lang?: "en" | "fr";
}) => {
  const { siteLabel, url, productName, monthlyUsd, annualUsd, includes, lang = "en" } = input;
  const fr = lang === "fr";
  const money = (n: number) => (fr ? `${usdFmt(n)}&nbsp;$` : `$${usdFmt(n)}`);
  const saving = monthlyUsd * 12 - annualUsd;

  const L = fr
    ? {
        subject: `Votre site est prêt à passer en ligne — ${siteLabel}`,
        headline: "Votre site est prêt à passer en ligne",
        p1: `Le domaine <strong>${siteLabel}</strong> est connecté et votre site est en place. Il reste une étape : activer l'hébergement.`,
        p2: "Dès que le paiement est validé, le site passe en ligne automatiquement — en une minute environ. Vous n'avez rien d'autre à faire.",
        plan: "Votre formule",
        price: `${money(monthlyUsd)} par mois, ou ${money(annualUsd)} par an${saving > 0 ? ` (vous économisez ${money(saving)})` : ""}. Résiliable à tout moment.`,
        covers: "Ce que cela comprend :",
        cta: "Activer l'hébergement",
        meanwhile: "En attendant, les visiteurs voient une page d'attente neutre — « site temporairement indisponible » — sans aucune mention de paiement.",
        questions: "Une question ? Répondez simplement à cet email — une personne lit chaque message.",
        preheader: "Une étape : activer l'hébergement, et le site passe en ligne automatiquement.",
      }
    : {
        subject: `Your site is ready to go live — ${siteLabel}`,
        headline: "Your site is ready to go live",
        p1: `The domain <strong>${siteLabel}</strong> is connected and your site is in place. One step remains: activating the hosting.`,
        p2: "The moment payment clears, the site goes live automatically — within about a minute. Nothing else to do.",
        plan: "Your plan",
        price: `${money(monthlyUsd)} a month, or ${money(annualUsd)} a year${saving > 0 ? ` (saving ${money(saving)})` : ""}. Cancel anytime.`,
        covers: "What this covers:",
        cta: "Activate hosting",
        meanwhile: "Until then, visitors see a neutral holding page — \"temporarily unavailable\" — with no mention of payment.",
        questions: "Any question — just reply to this email. A person reads every message.",
        preheader: "One step: activate the hosting, and the site goes live by itself.",
      };

  return {
    subject: L.subject,
    html: wrapper(`
      <h1 style="margin:0 0 16px;font-size:22px;font-weight:900;">${L.headline}</h1>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:${BODY};">${L.p1}</p>
      <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:${BODY};">${L.p2}</p>

      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
             style="margin:0 0 20px;border:1px solid ${LINE};border-radius:12px;background:${CREAM};">
        <tr><td style="padding:18px 20px;font-family:${FONT};">
          <p style="margin:0 0 6px;font-size:11px;font-weight:900;letter-spacing:1px;text-transform:uppercase;color:${MUTED};">${L.plan}</p>
          <p style="margin:0 0 4px;font-size:17px;font-weight:800;color:${INK};">${productName}</p>
          <p style="margin:0;font-size:14px;line-height:1.6;color:${BODY};">${L.price}</p>
        </td></tr>
      </table>

      ${includes.length ? `
      <p style="margin:0 0 10px;font-size:15px;line-height:1.6;color:${BODY};"><strong>${L.covers}</strong></p>
      <ul style="margin:0 0 8px;padding-left:20px;font-size:15px;line-height:1.7;color:${BODY};">
        ${includes.map((line) => `<li>${line}</li>`).join("")}
      </ul>` : ""}

      ${btn(url, L.cta)}

      <p style="margin:20px 0 12px;font-size:14px;line-height:1.6;color:${MUTED};">${L.meanwhile}</p>
      <p style="margin:0;font-size:14px;line-height:1.6;color:${MUTED};">${L.questions}</p>
      `, { preheader: L.preheader, lang }),
  };
};

/**
 * The service-page link, resent on request from the client's own /hosting
 * page. Short on purpose: the person asked for one thing.
 */
export const accountLinkEmail = (input: { url: string; siteLabel: string; lang?: "en" | "fr" }) => {
  const { url, siteLabel, lang = "en" } = input;
  const fr = lang === "fr";
  const forSite = siteLabel ? (fr ? ` pour ${siteLabel}` : ` for ${siteLabel}`) : "";
  const L = fr
    ? {
        subject: `Votre page de service${forSite} — Servolia`,
        headline: "Votre page de service",
        body: `Voici le lien vers votre page de service${forSite} : ce que couvre votre formule, la date de renouvellement, vos factures, votre carte et la résiliation — sans mot de passe. Gardez cet email ; le lien reste valable un an.`,
        cta: "Ouvrir ma page",
        ignore: "Vous n'avez rien demandé ? Ignorez simplement cet email — personne ne peut utiliser ce lien sans y avoir accès.",
        preheader: "Le lien vers votre page de service, comme demandé.",
      }
    : {
        subject: `Your service page${forSite} — Servolia`,
        headline: "Your service page",
        body: `Here is the link to your service page${forSite}: what your plan covers, when it renews, your invoices, your card and cancelling — no password. Keep this email; the link works for a year.`,
        cta: "Open my page",
        ignore: "Didn't ask for this? Just ignore it — nobody can use the link without access to this email.",
        preheader: "The link to your service page, as requested.",
      };
  return {
    subject: L.subject,
    html: wrapper(`
      <h1 style="margin:0 0 16px;font-size:22px;font-weight:900;">${L.headline}</h1>
      <p style="margin:0 0 8px;font-size:15px;line-height:1.6;color:${BODY};">${L.body}</p>
      ${btn(url, L.cta)}
      <p style="margin:20px 0 0;font-size:13px;line-height:1.6;color:${MUTED};">${L.ignore}</p>
      `, { preheader: L.preheader, lang }),
  };
};

/* ── THE ASSISTANT, FROM SERVOLIA TO ITS OWN HOSTING CLIENT ─────────────────
 *
 * Three moments, one voice: the company that hosts the client's site telling
 * them what it built, what it did, and what it costs to keep. Every claim in
 * these is one the code performs — the try page answers, the settings page
 * saves, the trial row switches the widget on and off — and the price is the
 * live one from CLIENT_PRODUCTS, never typed in.
 *
 * Marketing mail from the brand to a paying customer about the brand's own
 * product; sent by hand, one client at a time, never on a schedule.
 */

const money = (usd: number, fr: boolean) => (fr ? `${usd}&nbsp;$` : `$${usd}`);

/** "We built your assistant" — the invitation to the showroom. */
export const assistantBuiltEmail = (input: {
  business: string;
  siteLabel: string;
  tryUrl: string;
  settingsUrl: string;
  trialUrl: string;
  payUrl: string;
  monthlyUsd: number;
  annualUsd: number;
  lang?: "en" | "fr";
}) => {
  const { business, siteLabel, tryUrl, settingsUrl, trialUrl, payUrl, monthlyUsd, annualUsd, lang = "en" } = input;
  const fr = lang === "fr";
  const L = fr
    ? {
        subject: `Nous avons construit l'assistant de ${business} — essayez-le`,
        preheader: `Votre assistant IA est prêt : à votre nom, à vos couleurs, formé sur ${siteLabel}. Sans carte.`,
        headline: `Votre assistant est prêt`,
        p1: `Nous avons construit un assistant IA pour <strong>${business}</strong>, à partir de votre site ${siteLabel} : il porte votre nom et vos couleurs, il connaît vos services et il répond à vos visiteurs dans leur langue, jour et nuit.`,
        p2: `Il n'est pas encore sur votre site. Vous pouvez d'abord lui parler ici, comme le ferait un client :`,
        cta: "Essayer mon assistant",
        p3: `Vous voulez qu'il dise, propose ou évite quelque chose ? Dites-le-lui — cela s'applique dès la conversation suivante :`,
        settings: "Lui dire quoi dire →",
        p4: `Et si vous préférez le voir travailler pour de vrai : une semaine d'essai sur votre site, gratuite, sans carte. Chaque demande qu'il prend arrive sur votre téléphone. Au bout de sept jours il se retire de lui-même, sauf si vous le gardez.`,
        trial: "Lancer 7 jours d'essai sur mon site →",
        p5: `Pour le garder : ${money(monthlyUsd, fr)}/mois ou ${money(annualUsd, fr)}/an, résiliable à tout moment. Nous l'installons pour vous.`,
        pay: "L'activer →",
        close: `Rien ne change sur votre site tant que vous ne le décidez pas.`,
      }
    : {
        subject: `We built ${business}'s assistant — try it`,
        preheader: `Your AI assistant is ready: your name, your colours, trained on ${siteLabel}. No card.`,
        headline: `Your assistant is ready`,
        p1: `We built an AI assistant for <strong>${business}</strong> from your website ${siteLabel}: it carries your name and your colours, it knows your services, and it answers your visitors in their language, day and night.`,
        p2: `It is not on your site yet. First, talk to it here the way a customer would:`,
        cta: "Try my assistant",
        p3: `Want it to say, offer or avoid something? Tell it — it applies from the next conversation:`,
        settings: "Tell it what to say →",
        p4: `And if you would rather see it work for real: one week on your site, free, no card. Every enquiry it takes reaches your phone. After seven days it steps back on its own unless you keep it.`,
        trial: "Start a 7-day trial on my site →",
        p5: `To keep it: ${money(monthlyUsd, fr)}/month or ${money(annualUsd, fr)}/year, cancel anytime. We install it for you.`,
        pay: "Turn it on →",
        close: `Nothing changes on your site until you decide.`,
      };
  const link = (href: string, label: string) =>
    `<a href="${href}" style="font-weight:700;color:${GREEN};text-decoration:none;">${label}</a>`;
  return {
    subject: L.subject,
    html: wrapper(`
      <h1 style="margin:0 0 16px;font-size:22px;font-weight:900;">${L.headline}</h1>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:${BODY};">${L.p1}</p>
      <p style="margin:0 0 4px;font-size:15px;line-height:1.6;color:${BODY};">${L.p2}</p>
      ${btn(tryUrl, L.cta)}
      <p style="margin:24px 0 6px;font-size:15px;line-height:1.6;color:${BODY};">${L.p3}</p>
      <p style="margin:0 0 20px;font-size:15px;line-height:1.6;">${link(settingsUrl, L.settings)}</p>
      <p style="margin:0 0 6px;font-size:15px;line-height:1.6;color:${BODY};">${L.p4}</p>
      <p style="margin:0 0 20px;font-size:15px;line-height:1.6;">${link(trialUrl, L.trial)}</p>
      <p style="margin:0 0 6px;font-size:15px;line-height:1.6;color:${BODY};">${L.p5}</p>
      <p style="margin:0 0 20px;font-size:15px;line-height:1.6;">${link(payUrl, L.pay)}</p>
      <p style="margin:0;font-size:13px;line-height:1.6;color:${MUTED};">${L.close}</p>
      `, { preheader: L.preheader, lang }),
  };
};

/** The trial began: it is on their site, and here is when it ends. */
export const assistantTrialStartedEmail = (input: {
  business: string;
  siteUrl: string;
  untilIso: string;
  settingsUrl: string;
  payUrl: string;
  monthlyUsd: number;
  installed: boolean | null;
  lang?: "en" | "fr";
}) => {
  const { business, siteUrl, untilIso, settingsUrl, payUrl, monthlyUsd, installed, lang = "en" } = input;
  const fr = lang === "fr";
  const until = new Date(untilIso).toLocaleDateString(fr ? "fr-FR" : "en-GB", { day: "numeric", month: "long", year: "numeric" });
  const site = siteUrl.replace(/^https?:\/\//, "");
  const L = fr
    ? {
        subject: `Votre assistant est en ligne sur ${site} — jusqu'au ${until}`,
        preheader: `Sept jours d'essai ont commencé. Chaque demande arrive sur votre téléphone.`,
        headline: `Il est en ligne sur votre site`,
        p1: installed === false
          ? `Votre essai a commencé, mais nous n'avons pas pu ajouter la ligne à vos pages automatiquement. Elle est sur votre page de réglages ci-dessous, prête à coller — ou répondez à cet email et nous le faisons.`
          : `L'assistant de <strong>${business}</strong> répond maintenant aux visiteurs de ${site}, dans leur langue, jour et nuit. Chaque demande qu'il prend arrive sur votre téléphone.`,
        p2: `L'essai se termine le <strong>${until}</strong>. Ce jour-là il se retire de lui-même — rien à faire, rien à payer — sauf si vous le gardez.`,
        settings: "Ajuster ce qu'il dit →",
        p3: `Pour le garder après l'essai : ${money(monthlyUsd, fr)}/mois, résiliable à tout moment.`,
        pay: "Le garder →",
      }
    : {
        subject: `Your assistant is live on ${site} — until ${until}`,
        preheader: `Your seven-day trial has started. Every enquiry reaches your phone.`,
        headline: `It is live on your site`,
        p1: installed === false
          ? `Your trial has started, but we could not add the line to your pages automatically. It is on your settings page below, ready to paste — or reply to this email and we will do it.`
          : `<strong>${business}</strong>'s assistant is now answering visitors on ${site}, in their language, day and night. Every enquiry it takes reaches your phone.`,
        p2: `The trial ends on <strong>${until}</strong>. That day it steps back on its own — nothing to do, nothing to pay — unless you keep it.`,
        settings: "Adjust what it says →",
        p3: `To keep it after the trial: ${money(monthlyUsd, fr)}/month, cancel anytime.`,
        pay: "Keep it →",
      };
  return {
    subject: L.subject,
    html: wrapper(`
      <h1 style="margin:0 0 16px;font-size:22px;font-weight:900;">${L.headline}</h1>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:${BODY};">${L.p1}</p>
      <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:${BODY};">${L.p2}</p>
      <p style="margin:0 0 20px;font-size:15px;line-height:1.6;"><a href="${settingsUrl}" style="font-weight:700;color:${GREEN};text-decoration:none;">${L.settings}</a></p>
      <p style="margin:0 0 4px;font-size:15px;line-height:1.6;color:${BODY};">${L.p3}</p>
      ${btn(payUrl, L.pay)}
      `, { preheader: L.preheader, lang }),
  };
};

/**
 * Two days left. Two quite different emails, because one of them would be
 * insulting in the other's situation:
 *
 *  - IT HAS WORKED. Lead with what it did for them; the date is a footnote.
 *    A deadline-first email invites an early no, which is the reason there
 *    was no nudge at all until he asked for one.
 *  - IT HAS BEEN QUIET. Then "N = 0 visitors, two days left, pay $12" is a
 *    terrible email. It becomes a HELPFUL one instead: nobody has written
 *    yet, here is the link to check it is really showing on your site —
 *    which is also how we find out an install silently failed. No price, no
 *    ask. The day-7 email can do the closing honestly either way.
 */
export const assistantTrialNudgeEmail = (input: {
  business: string;
  siteLabel: string;
  conversations: number;
  untilIso: string;
  tryUrl: string;
  settingsUrl: string;
  payUrl: string;
  monthlyUsd: number;
  lang?: "en" | "fr";
}) => {
  const { business, siteLabel, conversations: n, untilIso, tryUrl, settingsUrl, payUrl, monthlyUsd, lang = "en" } = input;
  const fr = lang === "fr";
  const until = new Date(untilIso).toLocaleDateString(fr ? "fr-FR" : "en-GB", { day: "numeric", month: "long" });
  const link = (href: string, label: string) =>
    `<a href="${href}" style="font-weight:700;color:${GREEN};text-decoration:none;">${label}</a>`;

  if (n === 0) {
    const L = fr
      ? {
          subject: `Votre assistant attend encore son premier visiteur`,
          preheader: `Personne ne lui a écrit pour l'instant — vérifions qu'il s'affiche bien.`,
          headline: `Personne ne lui a encore écrit`,
          p1: `L'assistant de <strong>${business}</strong> est en ligne sur ${siteLabel} depuis cinq jours, et aucun visiteur ne lui a encore écrit. C'est parfois normal — et parfois le signe qu'il ne s'affiche pas là où il devrait.`,
          p2: `Vérifiez en trente secondes : ouvrez votre site et cherchez la bulle en bas de page. S'il n'y est pas, répondez à cet email et nous nous en occupons aujourd'hui.`,
          cta: "Voir mon assistant",
          p3: `Vous pouvez aussi ajuster ce qu'il dit, ou ce qu'il propose en premier :`,
          settings: "Lui dire quoi dire →",
          close: `Votre essai se termine le ${until}. Il n'y a rien à payer et rien à annuler.`,
        }
      : {
          subject: `Your assistant is still waiting for its first visitor`,
          preheader: `Nobody has written to it yet — let's check it is showing.`,
          headline: `Nobody has written to it yet`,
          p1: `<strong>${business}</strong>'s assistant has been live on ${siteLabel} for five days, and no visitor has written to it yet. Sometimes that is simply a quiet week — and sometimes it means it is not showing where it should.`,
          p2: `Thirty seconds to check: open your site and look for the bubble at the bottom. If it is not there, reply to this email and we will sort it today.`,
          cta: "See my assistant",
          p3: `You can also adjust what it says, or what it offers first:`,
          settings: "Tell it what to say →",
          close: `Your trial ends on ${until}. There is nothing to pay and nothing to cancel.`,
        };
    return {
      subject: L.subject,
      html: wrapper(`
        <h1 style="margin:0 0 16px;font-size:22px;font-weight:900;">${L.headline}</h1>
        <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:${BODY};">${L.p1}</p>
        <p style="margin:0 0 4px;font-size:15px;line-height:1.6;color:${BODY};">${L.p2}</p>
        ${btn(tryUrl, L.cta)}
        <p style="margin:24px 0 6px;font-size:15px;line-height:1.6;color:${BODY};">${L.p3}</p>
        <p style="margin:0 0 20px;font-size:15px;line-height:1.6;">${link(settingsUrl, L.settings)}</p>
        <p style="margin:0;font-size:13px;line-height:1.6;color:${MUTED};">${L.close}</p>
        `, { preheader: L.preheader, lang }),
    };
  }

  const L = fr
    ? {
        subject: `${n} personne${n > 1 ? "s ont" : " a"} écrit à votre assistant`,
        preheader: `Voici ce qu'il a fait pendant que vous étiez occupé. Il reste deux jours.`,
        headline: n > 1 ? `${n} conversations, jusqu'ici` : `Une première conversation`,
        p1: `Depuis qu'il est en ligne sur ${siteLabel}, l'assistant de <strong>${business}</strong> a tenu ${n} conversation${n > 1 ? "s" : ""} avec vos visiteurs — y compris en dehors de vos horaires.`,
        p2: `Votre essai se termine le <strong>${until}</strong>. Ce jour-là il se retire de lui-même : il n'y a rien à annuler et rien à payer si vous préférez vous arrêter là.`,
        p3: `Si vous voulez le garder — mêmes réglages, rien à réinstaller : ${money(monthlyUsd, fr)}/mois, résiliable à tout moment.`,
        cta: "Le garder",
        settings: "Ajuster ce qu'il dit →",
      }
    : {
        subject: `${n} ${n > 1 ? "people have" : "person has"} written to your assistant`,
        preheader: `Here is what it did while you were busy. Two days left.`,
        headline: n > 1 ? `${n} conversations so far` : `A first conversation`,
        p1: `Since it went live on ${siteLabel}, <strong>${business}</strong>'s assistant has held ${n} conversation${n > 1 ? "s" : ""} with your visitors — including outside your hours.`,
        p2: `Your trial ends on <strong>${until}</strong>. That day it steps back on its own: there is nothing to cancel and nothing to pay if you would rather stop there.`,
        p3: `If you want to keep it — same settings, nothing to reinstall: ${money(monthlyUsd, fr)}/month, cancel anytime.`,
        cta: "Keep it",
        settings: "Adjust what it says →",
      };
  return {
    subject: L.subject,
    html: wrapper(`
      <h1 style="margin:0 0 16px;font-size:22px;font-weight:900;">${L.headline}</h1>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:${BODY};">${L.p1}</p>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:${BODY};">${L.p2}</p>
      <p style="margin:0 0 4px;font-size:15px;line-height:1.6;color:${BODY};">${L.p3}</p>
      ${btn(payUrl, L.cta)}
      <p style="margin:20px 0 0;font-size:15px;line-height:1.6;">${link(settingsUrl, L.settings)}</p>
      `, { preheader: L.preheader, lang }),
  };
};

/** The week is over: what it did, and the one line to keep it. */
export const assistantTrialEndedEmail = (input: {
  business: string;
  siteLabel: string;
  conversations: number;
  payUrl: string;
  monthlyUsd: number;
  annualUsd: number;
  lang?: "en" | "fr";
}) => {
  const { business, siteLabel, conversations, payUrl, monthlyUsd, annualUsd, lang = "en" } = input;
  const fr = lang === "fr";
  const n = conversations;
  const L = fr
    ? {
        subject: n > 0
          ? `Votre assistant a répondu à ${n} visiteur${n > 1 ? "s" : ""} cette semaine`
          : `Votre semaine d'essai est terminée`,
        preheader: `L'essai sur ${siteLabel} est terminé. Le garder prend une minute.`,
        headline: n > 0 ? `${n} conversation${n > 1 ? "s" : ""} en sept jours` : `La semaine est passée`,
        p1: n > 0
          ? `Pendant son essai sur ${siteLabel}, l'assistant de <strong>${business}</strong> a tenu ${n} conversation${n > 1 ? "s" : ""} avec vos visiteurs — y compris quand vous n'étiez pas là. Il est maintenant en pause.`
          : `L'assistant de <strong>${business}</strong> a veillé sur ${siteLabel} pendant sept jours. Peu de visiteurs lui ont écrit cette semaine ; il est maintenant en pause.`,
        p2: `Pour le remettre en ligne — même réglages, mêmes couleurs, rien à réinstaller : ${money(monthlyUsd, fr)}/mois ou ${money(annualUsd, fr)}/an, résiliable à tout moment.`,
        cta: "Le remettre en ligne",
        close: `Si vous préférez vous en passer, il n'y a rien à faire.`,
      }
    : {
        subject: n > 0
          ? `Your assistant answered ${n} visitor${n > 1 ? "s" : ""} this week`
          : `Your trial week is over`,
        preheader: `The trial on ${siteLabel} has ended. Keeping it takes a minute.`,
        headline: n > 0 ? `${n} conversation${n > 1 ? "s" : ""} in seven days` : `The week has passed`,
        p1: n > 0
          ? `During its trial on ${siteLabel}, <strong>${business}</strong>'s assistant held ${n} conversation${n > 1 ? "s" : ""} with your visitors — including while you were away. It is now paused.`
          : `<strong>${business}</strong>'s assistant kept watch on ${siteLabel} for seven days. Few visitors wrote to it this week; it is now paused.`,
        p2: `To put it back — same settings, same colours, nothing to reinstall: ${money(monthlyUsd, fr)}/month or ${money(annualUsd, fr)}/year, cancel anytime.`,
        cta: "Put it back",
        close: `If you would rather do without it, there is nothing to do.`,
      };
  return {
    subject: L.subject,
    html: wrapper(`
      <h1 style="margin:0 0 16px;font-size:22px;font-weight:900;">${L.headline}</h1>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:${BODY};">${L.p1}</p>
      <p style="margin:0 0 4px;font-size:15px;line-height:1.6;color:${BODY};">${L.p2}</p>
      ${btn(payUrl, L.cta)}
      <p style="margin:20px 0 0;font-size:13px;line-height:1.6;color:${MUTED};">${L.close}</p>
      `, { preheader: L.preheader, lang }),
  };
};

export const reactivateEmail = (input: {
  /** Mid-sentence form only -- this template never uses the headline form. */
  productNoun: string;
  siteLabel: string;
  url: string;
  monthlyUsd: number;
  lang?: "en" | "fr";
}) => {
  const { productNoun, siteLabel, url, monthlyUsd, lang = "en" } = input;
  const fr = lang === "fr";
  const money = fr ? `${monthlyUsd}&nbsp;$` : `$${monthlyUsd}`;
  const forSite = siteLabel ? (fr ? ` sur ${siteLabel}` : ` on ${siteLabel}`) : "";

  if (fr) {
    return {
      subject: `Votre ${productNoun} est en pause — réactivation immédiate`,
      html: wrapper(`
        <h1 style="margin:0 0 16px;font-size:22px;font-weight:900;">Votre ${productNoun} est en pause</h1>
        <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:${BODY};">
          Bonjour,
        </p>
        <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:${BODY};">
          Votre ${productNoun}${forSite} est actuellement désactivé. Vos clients ne reçoivent donc plus de réponse automatique, de jour comme de nuit — et une question sans réponse est souvent une vente perdue.
        </p>
        <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:${BODY};">
          Pour le réactiver, c'est <strong>${money} par mois</strong>, résiliable à tout moment. Le paiement est traité par Stripe, et <strong>le service revient automatiquement</strong> dès réception — vous n'avez rien d'autre à faire.
        </p>
        ${btn(url, "Réactiver mon assistant →")}
        <p style="margin:22px 0 0;font-size:14px;line-height:1.6;color:${MUTED};">
          La page vous montre le montant exact avant tout paiement. Une question ? Répondez simplement à cet email.
        </p>
      `, { preheader: `Réactivation en une minute — ${monthlyUsd} $ par mois, le service revient tout seul.`, lang: "fr" }),
    };
  }

  return {
    subject: `Your ${productNoun} is paused — switch it back on`,
    html: wrapper(`
      <h1 style="margin:0 0 16px;font-size:22px;font-weight:900;">Your ${productNoun} is paused</h1>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:${BODY};">Hello,</p>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:${BODY};">
        Your ${productNoun}${forSite} is currently switched off, so your customers are no longer getting an instant answer day or night — and an unanswered question is usually a lost sale.
      </p>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:${BODY};">
        Switching it back on is <strong>${money} a month</strong>, cancel any time. Payment is handled by Stripe, and <strong>the service returns automatically</strong> the moment it clears — there is nothing else for you to do.
      </p>
      ${btn(url, "Switch my assistant back on →")}
      <p style="margin:22px 0 0;font-size:14px;line-height:1.6;color:${MUTED};">
        The page shows you the exact amount before anything is charged. Any questions, just reply to this email.
      </p>
      `, { preheader: `Back on in a minute — ${monthlyUsd} a month, and it restores itself.`, lang: "en" }),
  };
};
