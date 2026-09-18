/**
 * THE SETTINGS A CLIENT'S PHONE NEEDS, READ OFF THEIR OWN DOMAIN.
 *
 * Samira's email stopped working on her phone (2026-09-18). Nothing was
 * broken: MX, SPF, DKIM and DMARC were all present and correct. Her mailbox
 * simply lives in Zoho's JAPAN data centre — `mx.zoho.jp`, `include:zohomail.jp`
 * — and a phone set up against `imap.zoho.com` connects to a perfectly healthy
 * server that has never heard of her account.
 *
 * WHY THAT IS SO HARD TO DIAGNOSE. The wrong-region server is UP. It answers,
 * the TLS handshake succeeds, and then the login is refused — so the phone says
 * "the password for info@goodscochina.com is incorrect". The one thing it is
 * not is the password, and the client retypes it for a week.
 *
 * WHY THIS READS DNS INSTEAD OF A TABLE. A hand-kept list of which client is
 * in which region is a list that goes stale the first time an account moves,
 * and the symptom of a stale entry here is a client being told to type
 * something that cannot work. The MX record is the account's region, live, and
 * it is the same record the rest of the internet uses to find them.
 */

export interface MailHost {
  host: string;
  port: number;
  security: "SSL/TLS" | "STARTTLS";
}

export interface MailSettings {
  /** What to call the provider when telling a person about it. */
  provider: string;
  /** Where they read their mail in a browser. */
  webmail: string;
  incoming: MailHost;
  outgoing: MailHost;
  /** The username is nearly always the full address, but say so explicitly. */
  username: "full email address";
  /**
   * True where the provider refuses a normal password from a mail app once
   * two-factor is on, and needs an app-specific one instead. This is the
   * SECOND cause of "it says my password is wrong", and it looks exactly like
   * the first, so it is never left for the client to guess.
   */
  appPasswordIfTwoFactor: boolean;
  /** Where to generate that app password, when the provider needs one. */
  appPasswordUrl?: string;
}

/* Zoho runs separate data centres and an account exists in exactly one. The
   MX suffix names it, and every hostname the client needs follows from it. */
const ZOHO_REGIONS: Record<string, string> = {
  "zoho.com": "zoho.com",
  "zohomail.com": "zoho.com",
  "zoho.eu": "zoho.eu",
  "zohomail.eu": "zoho.eu",
  "zoho.in": "zoho.in",
  "zohomail.in": "zoho.in",
  "zoho.jp": "zoho.jp",
  "zohomail.jp": "zoho.jp",
  "zoho.com.au": "zoho.com.au",
  "zohomail.com.au": "zoho.com.au",
  "zoho.ca": "zoho.ca",
  "zohomail.ca": "zoho.ca",
  "zoho.sa": "zoho.sa",
  "zohomail.sa": "zoho.sa",
  "zoho.uk": "zoho.uk",
  "zohomail.uk": "zoho.uk",
};

/**
 * Work out the settings from the mail hosts a domain points at.
 *
 * Pure, so the mapping can be tested against real MX strings without a
 * network. Returns null rather than a guess when the provider is not one we
 * know: half-right mail settings waste more of a client's evening than none.
 */
export function settingsFromMx(mxHosts: string[]): MailSettings | null {
  const hosts = mxHosts.map((h) => h.toLowerCase().replace(/\.$/, ""));

  for (const [suffix, region] of Object.entries(ZOHO_REGIONS)) {
    if (hosts.some((h) => h === suffix || h.endsWith(`.${suffix}`))) {
      return {
        provider: `Zoho Mail (${region})`,
        webmail: `https://mail.${region}`,
        incoming: { host: `imappro.${region}`, port: 993, security: "SSL/TLS" },
        outgoing: { host: `smtppro.${region}`, port: 465, security: "SSL/TLS" },
        username: "full email address",
        appPasswordIfTwoFactor: true,
        appPasswordUrl: `https://accounts.${region}/home#security/apppassword`,
      };
    }
  }

  if (hosts.some((h) => h.endsWith("google.com") || h.endsWith("googlemail.com"))) {
    return {
      provider: "Google Workspace",
      webmail: "https://mail.google.com",
      incoming: { host: "imap.gmail.com", port: 993, security: "SSL/TLS" },
      outgoing: { host: "smtp.gmail.com", port: 465, security: "SSL/TLS" },
      username: "full email address",
      // Google refuses plain passwords from mail apps outright now.
      appPasswordIfTwoFactor: true,
      appPasswordUrl: "https://myaccount.google.com/apppasswords",
    };
  }

  if (hosts.some((h) => h.endsWith("outlook.com") || h.endsWith("protection.outlook.com"))) {
    return {
      provider: "Microsoft 365",
      webmail: "https://outlook.office.com/mail/",
      incoming: { host: "outlook.office365.com", port: 993, security: "SSL/TLS" },
      outgoing: { host: "smtp.office365.com", port: 587, security: "STARTTLS" },
      username: "full email address",
      appPasswordIfTwoFactor: false,
    };
  }

  return null;
}

/** The mail hosts a domain publishes, newest answer from a public resolver. */
export async function mxFor(domain: string): Promise<string[]> {
  const clean = domain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/^www\./, "");
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(clean)) return [];
  try {
    const r = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(clean)}&type=MX`, {
      headers: { Accept: "application/dns-json" },
      // The answer changes about once a year; a day of cache is generous.
      next: { revalidate: 86_400 },
    });
    if (!r.ok) return [];
    const d = (await r.json()) as { Answer?: { type: number; data: string }[] };
    return (d.Answer ?? [])
      .filter((a) => a.type === 15)
      // "10 mx.zoho.jp." — drop the preference, keep the host.
      .map((a) => a.data.replace(/^\d+\s+/, "").trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

/** The settings for one domain, or null when we cannot say for certain. */
export async function mailSettingsFor(domain: string): Promise<MailSettings | null> {
  const mx = await mxFor(domain);
  return mx.length ? settingsFromMx(mx) : null;
}
