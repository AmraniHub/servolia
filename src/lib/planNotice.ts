/**
 * "YOU ALREADY HAVE A PLAN" — the notice a client sees when the plan
 * checkout refuses a second subscription (src/app/api/checkout-subscription).
 *
 * One text, three places: the checkout's JSON answer, the portal banner
 * (?notice=has-plan) and the portal login page (the same parameter, for a
 * client who is not logged in yet). No imports: client components read it.
 */
export const HAS_PLAN_NOTICE = "has-plan";

/* A dentist with a second practice is a real case, not a mistake: the notice
   says how to add one (on its own account, set up by us) rather than only
   "you already have a plan". */
export const HAS_PLAN_TEXT = {
  en: "You already have a Servolia plan on this account — to change it, use Billing in your portal. Opening a second practice? Write to hello@servolia.com and we'll set it up on its own plan. Nothing was charged.",
  fr: "Vous avez déjà un abonnement Servolia sur ce compte — pour le modifier, passez par Facturation dans votre espace client. Vous ouvrez un second cabinet ? Écrivez à hello@servolia.com et nous le mettons en place avec son propre abonnement. Rien n'a été débité.",
} as const;

/** Where the refused buyer is sent: their portal, with the notice. */
export function hasPlanUrl(origin: string, lang: "en" | "fr"): string {
  return `${origin}/portal?notice=${HAS_PLAN_NOTICE}${lang === "fr" ? "&lang=fr" : ""}`;
}
