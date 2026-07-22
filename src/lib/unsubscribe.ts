import { createHmac, timingSafeEqual } from "crypto";

/**
 * Signed unsubscribe links.
 *
 * Every bulk email must carry a working one-click unsubscribe (GDPR / e-privacy
 * and basic deliverability hygiene). The token is an HMAC of the address, so a
 * link can't be forged and nobody can unsubscribe someone else by guessing a
 * URL — but it never expires, which is what you want for an opt-out.
 */

const secret = () => process.env.ADMIN_JWT_SECRET ?? "servolia-dev-unsubscribe-secret";

export function unsubscribeToken(email: string): string {
  return createHmac("sha256", secret())
    .update(email.trim().toLowerCase())
    .digest("hex")
    .slice(0, 32);
}

export function verifyUnsubscribeToken(email: string, token: string): boolean {
  const expected = unsubscribeToken(email);
  if (!token || token.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(token));
  } catch {
    return false;
  }
}

export function unsubscribeUrl(email: string, origin = "https://servolia.com"): string {
  const e = encodeURIComponent(email.trim().toLowerCase());
  return `${origin}/unsubscribe?e=${e}&t=${unsubscribeToken(email)}`;
}

/** Appended to every broadcast so the opt-out is always present. */
export function unsubscribeFooterHtml(email: string, origin?: string, lang: "en" | "fr" = "en"): string {
  const url = unsubscribeUrl(email, origin);
  const txt = lang === "fr"
    ? `Vous recevez cet email car vous êtes en contact avec Servolia. <a href="${url}" style="color:#71717A">Se désabonner</a>.`
    : `You're receiving this because you're in touch with Servolia. <a href="${url}" style="color:#71717A">Unsubscribe</a>.`;
  return `<hr style="border:none;border-top:1px solid #E8E6E0;margin:32px 0 16px" />
    <p style="font-size:12px;color:#A1A1AA;line-height:1.6;margin:0">${txt}</p>`;
}
