/**
 * The niche of a business that never named one.
 *
 * A plan buyer's intake (OnboardingForm) has no niche field, so their build
 * arrived with none and the draft fell back to the generic "service"
 * template: a "Cabinet Dentaire" got no dental pages, FAQs, receptionist
 * guidance or photos, and its highlight blocks drew empty colour boxes where
 * the niche photos should have been.
 *
 * The isXNiche() tests read a niche LABEL and are deliberately loose
 * ("artisan", "implant"). On free text they would misfire: an artisan bakery
 * is not a plumber, and hair implants are not dentistry. So this uses
 * stricter word lists, and trusts the business name before the services.
 * The strings returned are ones the isXNiche() tests accept.
 *
 * Word edges are Unicode letters (the u flag with p{L}), not the ASCII word
 * boundary, which treats "É" as a non-letter so "Électricien" never matched.
 */

const RULES: [niche: string, re: RegExp][] = [
  ["dental", /(?<!\p{L})(?:dentist\p{L}*|dentaire\p{L}*|dental|orthodont\p{L}*|stomatolog\p{L}*)(?!\p{L})/iu],
  ["aesthetic", /(?<!\p{L})(?:esth[ée]tique|aesthetics?|med[- ]?spa|m[ée]decine esth\p{L}*|skin clinic|botox)(?!\p{L})/iu],
  ["home-services", /(?<!\p{L})(?:plomb\p{L}*|plumb\p{L}*|chauffag\p{L}*|hvac|[ée]lectricien\p{L}*|electricians?|couvreur\p{L}*|roofing|roofers?|climatisation)(?!\p{L})/iu],
];

export function inferNiche(businessName?: string | null, services?: string | null): string | null {
  for (const text of [businessName, services]) {
    if (!text) continue;
    for (const [niche, re] of RULES) if (re.test(text)) return niche;
  }
  return null;
}
