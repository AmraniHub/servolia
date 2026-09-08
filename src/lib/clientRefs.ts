/**
 * Known clients, so a payment link can name what is being paid for, and can
 * collect an outstanding balance alongside the first charge.
 *
 * A payment page that names nothing looks like a phishing link -- the buyer
 * has to take on faith that a generic form is really about their business.
 *
 * The ref is a DISPLAY key only and is never trusted for an amount: arrears
 * are defined HERE, server-side, precisely so a URL cannot set what someone
 * is charged. An unknown ref shows no name and no arrears rather than
 * erroring, so a new client can be sent a link before this map is updated.
 *
 * Named clientRefs, not clientSites: src/lib/clientSites.ts already exists and
 * holds the generated-site config types.
 */

export interface ClientRef {
  /** Shown on the card, e.g. "goodscochina.com". */
  label: string;
  /**
   * Unpaid balance to collect once, on the first invoice only. Leave undefined
   * for a client who owes nothing -- which is every client who has never
   * fallen behind, so undefined is the normal case.
   */
  arrearsUsd?: number;
  /** What the client sees this charge called. Be specific: "outstanding
   *  balance" on a receipt with no explanation causes a support email. */
  arrearsLabel?: string;

  /* Where the gate lives, so a payment can restore the service by itself.
   * Held server-side rather than passed through the browser: these decide
   * which repository gets written to. */
  /** e.g. "AmraniHub/temghid-theme" */
  repo?: string;
  branch?: string;
  /** Subfolder the site deploys from; omit when it is the repo root. */
  siteRoot?: string;
  /** Shopify snippet pair to flip, e.g. "chatbot" <-> "chatbot-suspended". */
  gateWidget?: string;

  /**
   * The language this client is spoken to in. Defaults to English.
   *
   * A PROPERTY OF THE CLIENT, NOT OF THE LINK. Temghid's suspended notice is
   * written in French and sends the owner to /chatbot?ref=temghid; before this
   * existed he crossed from a French storefront to an English payment page, an
   * English Stripe form and an English receipt, to reactivate a service whose
   * own notice had just addressed him in French. Deciding it here means every
   * link to that client is in the right language without anyone remembering to
   * append a parameter.
   */
  lang?: "en" | "fr";
}

export const CLIENT_REFS: Record<string, ClientRef> = {
  goodscochina: {
    label: "goodscochina.com",
    repo: "AmraniHub/yiwugoodsco-com",
    branch: "main",
    /* The site deploys from web/, not the repo root, so the gate files live
       there too. Get this wrong and site-status.js lands somewhere Vercel
       never serves: the write succeeds, the site keeps running, and the
       suspension is recorded as done. */
    siteRoot: "web",
    // No gateWidget: this is a whole Vercel site, not a Shopify add-on, so it
    // gates through site-status.js + middleware rather than a snippet swap.
  },
  excellenceagency: { label: "excellenceagency.ma" },
  temghid: {
    label: "temghid.ma",
    repo: "AmraniHub/temghid-theme",
    branch: "main",
    gateWidget: "chatbot",
    lang: "fr",
  },
};

export function clientRefFor(ref: string | undefined): ClientRef | undefined {
  if (!ref) return undefined;
  return CLIENT_REFS[ref.toLowerCase()];
}

export function siteLabelFor(ref: string | undefined): string {
  return clientRefFor(ref)?.label ?? "";
}

/**
 * Which language to speak to this client in.
 *
 * `fallback` carries an explicit ?lang= from the URL, used only when the ref is
 * unknown. A known client's own setting always wins: a link someone forwards
 * with the wrong parameter must not switch the language of a page that is
 * about a specific business.
 */
export function langFor(
  ref: string | undefined,
  fallback?: string | null,
): "en" | "fr" {
  const known = clientRefFor(ref)?.lang;
  if (known) return known;
  return fallback === "fr" ? "fr" : "en";
}
