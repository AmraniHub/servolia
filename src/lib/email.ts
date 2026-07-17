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

export async function sendEmail(to: string, subject: string, html: string, text?: string): Promise<boolean> {
  const r = client();
  if (!r) {
    console.warn("Resend not configured — skipping email to", to);
    return false;
  }
  try {
    const { error } = await r.emails.send({ from: FROM, to, subject, html, text: text ?? stripHtml(html) });
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

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

// ============================================================================
// EMAIL TEMPLATES
// ============================================================================

const wrapper = (body: string) => `
<!DOCTYPE html>
<html><head><meta charset="utf-8" /></head>
<body style="margin:0;padding:0;background:#FAFAF7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#18181B;">
  <div style="max-width:560px;margin:0 auto;padding:32px 24px;">
    <div style="margin-bottom:32px;">
      <span style="display:inline-block;width:32px;height:32px;background:#36671E;border-radius:8px;text-align:center;line-height:32px;color:#FAFAF7;font-weight:900;font-size:18px;">S</span>
      <span style="margin-left:8px;font-size:20px;font-weight:900;color:#18181B;">Servolia</span>
    </div>
    <div style="background:#FFFFFF;border:1px solid #E8E6E0;border-radius:16px;padding:32px 28px;">
      ${body}
    </div>
    <p style="margin-top:24px;font-size:12px;color:#A1A1AA;text-align:center;">
      Servolia · AI Lead Systems for Service Businesses<br/>
      <a href="https://servolia.com" style="color:#36671E;text-decoration:none;">servolia.com</a> · hello@servolia.com
    </p>
  </div>
</body></html>`;

const btn = (href: string, label: string) =>
  `<a href="${href}" style="display:inline-block;background:#36671E;color:#FAFAF7;text-decoration:none;padding:12px 24px;border-radius:10px;font-weight:600;font-size:14px;margin-top:16px;">${label}</a>`;

const waBtn = (href: string, label: string) =>
  `<a href="${href}" style="display:inline-block;background:#25D366;color:#FFFFFF;text-decoration:none;padding:12px 24px;border-radius:10px;font-weight:600;font-size:14px;margin-top:12px;margin-left:8px;">${label}</a>`;

/** Sent immediately when someone submits the free-audit form. */
export const auditConfirmationEmail = (firstName: string) => ({
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
  `),
});

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
  `),
});

/** Sent post-payment, immediately after Stripe checkout completes. */
export const depositReceivedEmail = (firstName: string, planName: string, amount: number) => {
  const wa = businessWaLink(`Hi, I just paid my deposit for the ${planName} — excited to get started!`);
  return {
  subject: `Deposit received — your ${planName} is being built`,
  html: wrapper(`
    <h1 style="margin:0 0 16px;font-size:22px;font-weight:900;">Welcome to Servolia 🎉</h1>
    <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#3F3F46;">Hi ${firstName},</p>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#3F3F46;">
      Your €${amount.toLocaleString()} deposit for the <strong>${planName}</strong> just cleared. The build officially starts now.
    </p>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#3F3F46;">
      <strong>Your timeline:</strong>
    </p>
    <ul style="margin:0 0 16px;padding-left:20px;font-size:15px;line-height:1.7;color:#3F3F46;">
      <li><strong>Day 1 (today):</strong> Complete your 8-minute intake form (link below)</li>
      <li><strong>Day 3–5:</strong> You get a Loom walkthrough of your draft</li>
      <li><strong>Day 5–7:</strong> Final payment → we go live within 24 hours</li>
    </ul>
    ${btn("https://servolia.com/onboarding", "Complete intake form →")}
    ${wa ? waBtn(wa, "Chat on WhatsApp 💬") : ""}
    <p style="margin:24px 0 0;font-size:14px;line-height:1.6;color:#71717A;">
      Questions? Reply directly${wa ? " or message us on WhatsApp" : ""} — I read every message.
    </p>
  `),
  };
};

/** Sent when a client requests to log into their portal (magic link). */
export const portalLoginEmail = (loginUrl: string) => ({
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
  `),
});

/** Sent to a client when the founder replies to their portal message. */
export const newPortalMessageEmail = (firstName: string, preview: string) => ({
  subject: "New reply from Servolia",
  html: wrapper(`
    <h1 style="margin:0 0 16px;font-size:22px;font-weight:900;">You have a new message</h1>
    <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#3F3F46;">Hi ${firstName},</p>
    <p style="margin:0 0 16px;padding:16px;background:#FAFAF7;border-left:3px solid #36671E;font-size:15px;line-height:1.6;color:#18181B;">
      ${preview}
    </p>
    ${btn("https://servolia.com/portal", "View & reply →")}
  `),
});

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
    `),
  };
};

/** Sent to a prospect when they book a discovery call from /call. */
export const callBookingEmail = (firstName: string, when: string, lang: "en" | "fr" = "fr") => {
  const fr = lang === "fr";
  return {
    subject: fr ? `Votre appel Servolia est confirmé — ${when}` : `Your Servolia call is confirmed — ${when}`,
    html: wrapper(`
      <h1 style="margin:0 0 16px;font-size:22px;font-weight:900;">${fr ? "C'est noté 🗓" : "You're booked 🗓"}</h1>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#3F3F46;">${fr ? `Bonjour ${firstName},` : `Hi ${firstName},`}</p>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#3F3F46;">
        ${fr
          ? `Votre appel découverte de 30 minutes est confirmé pour le <strong>${when}</strong>. Je vous appellerai à l'heure convenue — préparez vos questions.`
          : `Your 30-minute discovery call is confirmed for <strong>${when}</strong>. I'll call you at that time — bring your questions.`}
      </p>
      <p style="margin:0 0 16px;padding:16px;background:#FAFAF7;border-left:3px solid #36671E;font-size:15px;line-height:1.6;color:#18181B;">
        ${fr
          ? "Avant l'appel, réfléchissez à : combien de demandes recevez-vous par mois, et combien deviennent des rendez-vous ? C'est là que nous allons vous faire gagner."
          : "Before the call, think about: how many enquiries do you get per month, and how many become appointments? That's where we'll win for you."}
      </p>
      <p style="margin:0;font-size:14px;line-height:1.6;color:#71717A;">${fr ? "Besoin de replanifier ? Répondez à cet email." : "Need to reschedule? Just reply to this email."}</p>
    `),
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
    `),
  };
};

/** Sent to client when their build goes live. */
export const liveEmail = (firstName: string, url: string) => ({
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
      <li>Watch the dashboard — first leads usually arrive within 48 hours</li>
      <li>If anything looks off, just reply to this email</li>
    </ul>
    ${btn(url, "View your live system →")}
  `),
});
