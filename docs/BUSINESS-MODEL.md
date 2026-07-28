# Servolia — Business Model & Recurring Revenue

How Servolia stays out of the project-cash treadmill and owns the recurring
infrastructure + results layer for its niche. See `docs/PRINCIPLES.md` for the
beachhead strategy this sits on top of. Every number below is display copy —
`src/lib/pricing.ts` is the single source of truth.

## The core reframe

Selling **projects** was transactional: the cash arrived once, up front, while
the value and the costs were recurring. Income only existed while new clients
kept closing. The durable money is in becoming the **single vendor the client
pays every month for their entire digital presence** — and sitting in the middle
of every commodity input (domain, hosting, email, AI, ads, SMS) plus every euro
of results.

So the shape is now: **one modest installation fee, then the subscription IS the
product.** The build is the on-ramp, not the offer.

Two things make this a moat, not just markup:

- **Aggregation** — each service added raises switching cost. One vendor for
  site + domain + email + AI + ads + reviews + booking + reporting means leaving
  isn't "cancel," it's "rebuild everything."
- **The rails are ours** — DNS, hosting account, the AI, the ad pixel and the
  lead data all live on Servolia infrastructure.

## The offer

**Installation — €490 once, live in 7 days.** Site built, AI receptionist
trained on the clinic's own services, everything switched on. **Waived when the
client starts on an annual plan.** There is no deposit and no balance: nothing
is owed on delivery day, the monthly plan simply starts.

**The monthly plan, tiered by included AI conversations:**

| Tier | Monthly | Annual | Conversations / mo | Adds |
|---|---|---|---|---|
| Essentiel | €149 | €1,490 | 100 | the baseline below |
| **Croissance** (anchor) | €249 | €2,490 | 300 | lead pipeline, monthly ROI report, Google reviews automation, SMS reminders, traffic analytics |
| Performance | €449 | €4,490 | 800 | multi-practitioner, ads closed-loop tracking, custom AI training, quarterly strategy call |

Every tier includes the site, the 24/7 AI receptionist, instant lead alerts, the
client portal, and hosting + domain + SSL + professional email.

- **Over the included volume = an automatic move up a tier**, never a surprise
  overage invoice. Predictable for them, expansion revenue for us — the bill
  grows only when their business does.
- **Cancellation any time, 30 days notice.**
- **Delivery guarantee:** 10% of the price refunded per day late, capped at 50%.
  It does not apply to delays caused by the client.

### Why annual matters (pay 10, get 12)

Annual is priced at **ten months for twelve** — two months free, not one. It is
the highest-leverage lever in the whole model for a solo founder:

- **Cash** — a full year lands on day one, which is what funds the next client's
  tooling, ad tests and reseller accounts. On Croissance that's €2,490 in
  January instead of €2,988 dripping in over twelve months: we trade €498 of
  headline revenue for a year of float, and float is the constraint, not margin.
- **Churn** — the two free months buy a twelve-month commitment. Month-to-month
  clinics churn on the first quiet month; annual clients stay long enough for
  the AI to accumulate their conversation data and for the ROI report to prove
  itself, which is exactly when they stop being cancellable.
- **The installation waiver pays for itself** — giving away €490 to convert a
  monthly signup into an annual one is a rounding error against a €2,490 prepay
  and a locked year.

### Why the meter is conversations, not bookings

Charging per patient booked is a fee tied to patient volume, and French
**compérage** rules restrict exactly that kind of arrangement for regulated
health professions (Ordre des Chirurgiens-Dentistes / Ordre des Médecins). It is
the single thing that would make the dental beachhead unsellable.

Metering **AI conversations** sidesteps it cleanly: we are metering a technical
resource we actually pay for — ordinary SaaS, the same as any inbox or minutes
plan — not the clinical outcome. It still grows with the client's business (a
busier clinic has more conversations), it still forces the tier upgrade, and it
works in dental *and* aesthetic without two different price lists.

⚠️ This distinction has **not** yet been confirmed by a French avocat. It is the
reasoning we build on, not a legal opinion; see `src/lib/roadmap.ts`.

### Pay-per-booking — the aesthetic-only close

**€990 setup + €60 per attended consultation**, kept alive as the
**risk-reversal close** for a skeptical aesthetic / med-spa prospect ("prove it
first"), never as the main model.

It is gated to **non-physician-run aesthetic and med-spa businesses only** —
the same compérage rules above block it for dental and medical. `PAY_PER_BOOKING`
and `payPerBookingEligible()` in `src/lib/pricing.ts` are the single gate; never
quote it without checking, and never bypass it inline.

## Recurring revenue streams

| Stream | Our cost | We bill | Status |
|---|---|---|---|
| Subscription tiers (all-in bundle) | AI inference + ~€0 infra | €149 / €249 / €449 per mo | **live** (`PLANS`) |
| Annual prepay | — | 10× monthly (two months free) | **live** (annual checkout) |
| Installation | founder time, 7 days | €490 once — waived on annual | **live** (`SETUP_PLAN`) |
| AI receptionist | pennies/convo | metered inside the tier (100 / 300 / 800) | live |
| Hosting + SSL | ~€0 (shared Vercel/Supabase) | inside every tier | live |
| Domain + DNS mgmt | ~€8–10/yr (Cloudflare/OpenSRS reseller) | inside every tier | included; fulfilment = founder task ("Ask us") until Cloudflare connected |
| Professional email | Workspace reseller ~€5/seat | first mailbox inside every tier; €12/mo per extra | sold; fulfilment = founder task until Workspace reseller connected |
| SMS / WhatsApp reminders | Twilio ~€0.04/msg | included from Croissance; €19/mo pack on Essentiel | **self-serve** (one-click Stripe); auto-provisions when Twilio connected |
| Google reviews automation | automation hooks | included from Croissance; €39/mo on Essentiel | **self-serve** (one-click Stripe); provisioned in-system |
| Pay-per-booking (aesthetic only) | AI inference | €990 setup + €60 per attended consultation | live, gated (`payPerBookingEligible`) |
| Patient deposit collection | Stripe Connect fee | ~1% + flat per deposit | future |

**Bundling rule — never unbundle.** Domain, hosting, SSL, email, AI and reports
are *included* in every tier and never itemized. Higher perceived value, the
client never sees the €10 domain cost, and — the real reason — **leaving has to
mean losing the whole presence**, not cancelling one line item. The moment the
domain is its own line on the invoice, it becomes its own decision, and the
client can walk away from us while keeping everything that matters to them. The
remaining à-la-carte add-ons are upgrades for Essentiel clients only; each one
sold is really a nudge to move up a tier.

## OPM (other people's money) — the legitimate plays

- **Annual prepay float** — a year of subscription billed up front (two months
  free) funds growth. Implemented in the subscription checkout; this is the main
  play, not a side one.
- **Installation paid in full, before the work** — €490 arrives at signup, not
  on delivery day. Small, but it means no build is ever financed out of pocket.
- **B2B financing partner** (future) — "€0 upfront, €X/mo". Much less relevant
  now that the up-front number is €490 rather than a four-figure build; kept
  only for the rare prospect who wants literally zero up-front.

⚠️ Hard line: float is *our own* revenue timing. Client escrow (ad budgets,
patient deposits) is never spent on anything else — that's fraud, not OPM.

## The monopoly / aggregation layer

1. **Niche data moat** — closed-loop ads data across every clinic in the
   beachhead compounds: better results → more clients → more data → better
   results. Competitors can't catch up.
2. **Picks-and-shovels (future)** — white-label the whole platform (generator +
   portal + AI + reporting) to *other* agencies who run their clients on our
   rails. Sell to everyone who sells to clinics.
3. **Referral network effect** — in a tight niche, "the system everyone uses"
   becomes self-marketing.

## Guardrails

- **Transparency over gouging** — reselling infra with reasonable markup as a
  bundle is normal and expected. Hidden per-item gouging kills trust in a
  referral-driven niche. Bundle, don't nickel-and-dime.
- **French/EU legal** — reselling infra is fine; medical/dental advertising is
  regulated (Code de la santé publique); VAT applies to resold services;
  **pay-per-booking stays aesthetic-only until a French avocat clears it**, and
  the conversation-meter/compérage argument above wants the same sign-off before
  it carries weight in public copy (see the micro-monopoly research note).
- **GDPR** — processing patient data across clinics needs a DPA per client.
- **Never quote a retired product.** The €290/€590/€990 build ladder, Ads
  Landing, Web App, Mobile App and the whole Care plan family (€49/99/199) are
  gone. They survive in `pricing.ts` with `retired: true` only so historical
  builds and leads still render a real name.

## Where it lives in the code

- Prices & products: `src/lib/pricing.ts` (`SETUP_PLAN`, `PLANS` with
  `annualEur` + `conversations`, `PLAN_ORDER`, `ADDONS`, `PAY_PER_BOOKING`,
  `planAmountCents`, `planForConversations`, `payPerBookingEligible`).
  `CARE_PLANS` / `careAmountCents` remain as deprecated aliases — don't use them
  in new code.
- Annual checkout: `src/app/api/checkout-subscription/route.ts` (`billing`
  param → `interval: "year"`, amount = `planAmountCents(plan, "annual")` = 10×
  monthly).
- Installation checkout: `src/app/api/checkout/route.ts`.
- Pay-per-booking checkout: `src/app/api/checkout-ppb/route.ts`.
- Pricing UI: `src/components/CarePlansSection.tsx` (monthly/annual toggle,
  all-in inclusions, add-ons row) on `/pricing` + `/fr/tarifs`.
- Add-on billing: `src/app/api/checkout-addon/route.ts` (self-serve recurring
  Stripe subscription per add-on).
- Provisioning dispatch: `src/lib/provisioning.ts` (`provisionAddon` +
  `PROVIDERS` readiness checks) — auto when a provider is connected, else a
  structured founder task via Telegram. Called from the Stripe webhook's
  `kind: "addon"` branch.
- Portal: Add-ons card in `src/components/PortalDashboard.tsx` — self-serve
  add-ons show "Enable" (one-click Stripe), the rest show "Ask us".
- Bot pricing script: `pricingPromptLines()` in `pricing.ts`. The Cloudflare
  fallback bot (`cf-worker/src/index.ts`) is a separate deploy that **cannot
  import** it — its prompt hardcodes the same numbers and must be updated by
  hand whenever prices move.

## Next to build (highest leverage first)

1. **Connect the reseller accounts** to flip the bundled domain/email fulfilment
   from founder-task to fully automatic. Each is just env keys + a small adapter
   in `provisioning.ts` (`PROVIDERS`):
   - Twilio (`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`) → SMS auto-provisions.
   - Cloudflare Registrar (`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`) → domains.
   - Google Workspace reseller (`GOOGLE_WORKSPACE_RESELLER_TOKEN`, needs partner
     approval) → mailboxes.
2. **Conversation metering in the portal** — the tier is sold on a number the
   client can't currently see. Show usage against the included volume so the
   upgrade is their idea, not our invoice.
3. **French avocat sign-off** on the conversation-meter argument (and on
   pay-per-booking for dental), so the reasoning above can be used in public copy.
4. B2B financing partner for builds.
5. White-label / multi-tenant for other agencies.

---

*Last updated: 2026-07-28 — rewritten for the installation + metered-subscription
model (€490 setup, €149/249/449 per month, pay 10 get 12). Replaces the €290–990
build ladder and the €49/99/199 Care plans, which are retired.*
