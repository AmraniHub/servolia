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

/** Sent immediately when someone submits the free-audit form. */
export const auditConfirmationEmail = (firstName: string, lang: "en" | "fr" = "en") => {
  if (lang === "fr") {
    return {
      subject: "Votre audit Servolia est en préparation 🎯",
      html: wrapper(`
        <h1 style="margin:0 0 16px;font-size:22px;font-weight:900;">Nous avons bien reçu votre demande d'audit.</h1>
        <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#3F3F46;">Bonjour ${firstName},</p>
        <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#3F3F46;">
          Merci de votre confiance. Nous préparons un audit vidéo Loom personnalisé de 5 minutes sur votre présence en ligne, livré sous <strong>24 heures</strong>.
        </p>
        <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#3F3F46;">
          <strong>La suite :</strong>
        </p>
        <ul style="margin:0 0 16px;padding-left:20px;font-size:15px;line-height:1.7;color:#3F3F46;">
          <li>Nous étudions votre site + Google Maps + vos concurrents</li>
          <li>Nous enregistrons une vidéo montrant exactement ce qui vous fait perdre des clients</li>
          <li>Vous la regardez quand vous voulez — aucun appel nécessaire</li>
        </ul>
        <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#71717A;">
          Une question entre-temps ? Répondez simplement à cet email.
        </p>
        ${btn("https://servolia.com/fr/cas-clients", "Voir les cas clients →")}
      `, { preheader: "Votre audit vidéo de 5 minutes arrive sous 24 heures. Aucun appel requis.", lang: "fr" }),
    };
  }
  return {
    subject: "Your Servolia audit is on the way 🎯",
    html: wrapper(`
      <h1 style="margin:0 0 16px;font-size:22px;font-weight:900;">We received your audit request.</h1>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#3F3F46;">Hi ${firstName},</p>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#3F3F46;">
        Thanks for trusting Servolia. We'll record a personalized 5-minute Loom audit of your current online presence and send it within <strong>24 hours</strong>.
      </p>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#3F3F46;">
        <strong>What's next:</strong>
      </p>
      <ul style="margin:0 0 16px;padding-left:20px;font-size:15px;line-height:1.7;color:#3F3F46;">
        <li>We study your site + Google Maps + competitors</li>
        <li>We record a screen-share Loom showing exactly what's losing you clients</li>
        <li>You watch it on your time — no call needed</li>
      </ul>
      <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#71717A;">
        If you have questions in the meantime, just reply to this email.
      </p>
      ${btn("https://servolia.com/case-studies", "See case studies →")}
      `, { preheader: "Your 5-minute video audit lands within 24 hours. No call needed.", lang: "en" }),
  };
};

/** Sent 24h after audit request if no follow-up. Reminds them you're working on it. */
export const auditInProgressEmail = (firstName: string) => ({
  subject: "Working on your audit — quick question",
  html: wrapper(`
    <h1 style="margin:0 0 16px;font-size:22px;font-weight:900;">Quick update</h1>
    <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#3F3F46;">Hi ${firstName},</p>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#3F3F46;">
      Your audit is in progress. While I'm recording, one question helps me give you a sharper recommendation:
    </p>
    <p style="margin:0 0 16px;padding:16px;background:#FAFAF7;border-left:3px solid #36671E;font-size:15px;line-height:1.6;color:#18181B;">
      <strong>What's the #1 problem you'd want this AI system to solve in the next 90 days?</strong><br/>
      (Just reply with a sentence or two.)
    </p>
    <p style="margin:0;font-size:14px;line-height:1.6;color:#71717A;">
      Loom dropping in your inbox in the next 12–24 hours.
    </p>
      `, { preheader: "One quick detail and I can finish the recording today.", lang: "en" }),
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
          <li><strong>Jour 3–5 :</strong> Vous recevez une vidéo Loom présentant votre brouillon</li>
          <li><strong>Jour 5–7 :</strong> Votre validation → mise en ligne sous 24h</li>
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
        <li><strong>Day 3–5:</strong> You get a Loom walkthrough of your draft</li>
        <li><strong>Day 5–7:</strong> Your approval → we go live within 24 hours</li>
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
          <li>Les premières demandes arrivent en général sous 48 h</li>
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
        <li>First leads usually arrive within 48 hours</li>
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
}) => {
  const {
    productName, productNoun, siteLabel, amountUsd, period,
    nextChargeIso = null, monthlyUsd, restored = false, includes = [], lang = "en",
    upgradeUrl = null, portalUrl = null, setupUrl = null, reference = null,
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
    ? (restored ? `Votre ${productNoun} est de nouveau actif` : "Paiement reçu")
    : (restored ? `Your ${productNoun} is back on` : "Payment received");

  const opening = fr
    ? (restored
        ? `Merci — votre paiement a été validé et votre ${productNoun} a été réactivé${forSite}. Il fonctionne de nouveau ; vous n'avez rien à faire.`
        : `Merci — votre paiement a été validé et votre ${productNoun}${forSite} est actif. Rien d'autre à faire.`)
    : (restored
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
        preheader: restored
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
        preheader: restored
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
          <p style="margin:10px 0 0;font-size:14px;color:${MUTED};">${nextCharge ? L.renewsOn(nextCharge) : L.renewsEach}</p>
        </td></tr>
      </table>

      ${includes.length ? `
      <p style="margin:0 0 10px;font-size:15px;line-height:1.6;color:${BODY};"><strong>${L.covers}</strong></p>
      <ul style="margin:0 0 20px;padding-left:20px;font-size:15px;line-height:1.7;color:${BODY};">
        ${includes.map((line) => `<li>${line}</li>`).join("")}
      </ul>` : ""}

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
