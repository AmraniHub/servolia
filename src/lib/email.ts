import { Resend } from "resend";
import { businessWaLink } from "./whatsapp";

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

const FROM = process.env.EMAIL_FROM ?? "Servolia <hello@servolia.com>";

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
