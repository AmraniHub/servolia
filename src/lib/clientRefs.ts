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
}

export const CLIENT_REFS: Record<string, ClientRef> = {
  goodscochina: { label: "goodscochina.com" },
  excellenceagency: { label: "excellenceagency.ma" },
  temghid: { label: "temghid.ma" },
};

export function clientRefFor(ref: string | undefined): ClientRef | undefined {
  if (!ref) return undefined;
  return CLIENT_REFS[ref.toLowerCase()];
}

export function siteLabelFor(ref: string | undefined): string {
  return clientRefFor(ref)?.label ?? "";
}
