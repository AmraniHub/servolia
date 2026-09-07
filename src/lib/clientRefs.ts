/**
 * Known clients, so a payment link can name what is being paid for.
 *
 * A payment page that names nothing looks like a phishing link -- the buyer
 * has to take on faith that a generic form is really about their business.
 *
 * The ref is a DISPLAY LABEL only and is never trusted for anything: an
 * unknown ref shows no name rather than erroring, so a new client can be sent
 * a link before this map is updated.
 *
 * Named clientRefs, not clientSites: src/lib/clientSites.ts already exists and
 * holds the generated-site config types.
 */
export const CLIENT_REFS: Record<string, string> = {
  goodscochina: "goodscochina.com",
  excellenceagency: "excellenceagency.ma",
  temghid: "temghid.ma",
};

export function siteLabelFor(ref: string | undefined): string {
  if (!ref) return "";
  return CLIENT_REFS[ref.toLowerCase()] ?? "";
}
