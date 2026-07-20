# Servolia — Business Model & Recurring Revenue

How Servolia moves from one-time project cash to owning the recurring
infrastructure + results layer for its niche. See `docs/PRINCIPLES.md` for the
beachhead strategy this sits on top of.

## The core reframe

Selling **projects** (€290–990 one-time) is transactional. The durable money is
in becoming the **single vendor the client pays every month for their entire
digital presence** — and sitting in the middle of every commodity input (domain,
hosting, email, AI, ads, SMS) plus every euro of results.

Two things make this a moat, not just markup:

- **Aggregation** — each service added raises switching cost. One vendor for
  site + domain + email + AI + ads + reviews + booking + reporting means leaving
  isn't "cancel," it's "rebuild everything."
- **The rails are ours** — DNS, hosting account, the AI, the ad pixel and the
  lead data all live on Servolia infrastructure.

## Recurring revenue streams

| Stream | Our cost | We bill | Status |
|---|---|---|---|
| Care plans (all-in bundle) | ~near-zero marginal | €49 / €99 / €199 per mo | **live** (`CARE_PLANS`) |
| Annual prepay | — | 11× monthly (1 month free) | **live** (annual checkout) |
| AI receptionist | pennies/convo | inside Care tiers | live |
| Hosting | ~€0 (shared Vercel/Supabase) | inside Care | live |
| Domain + DNS mgmt | ~€8–10/yr (Cloudflare/OpenSRS reseller) | €39/yr add-on | **model live** (`ADDONS`), provisioning manual |
| Professional email | Workspace reseller ~€5/seat | €12/mo per mailbox | **model live**, provisioning manual |
| SMS / WhatsApp reminders | Twilio ~€0.04/msg | €19/mo pack | **model live**, provisioning manual |
| Google reviews automation | automation hooks | €39/mo | **model live**, provisioning manual |
| Ads Management | our time + Meta CAPI (built) | from €390/mo + 12% of spend | **model live** (`ADS_MANAGEMENT`) |
| Patient deposit collection | Stripe Connect fee | ~1% + flat per deposit | future |

**Packaging rule:** Care tiers are ALL-IN bundles — domain, hosting, email, AI
and reports are *included*, never itemized. Higher perceived value, and the
client never sees the €10 domain cost. Add-ons are à-la-carte on top.

## OPM (other people's money) — the legitimate plays

- **Annual prepay float** — a year of Care billed up front (1 month free) funds
  growth. Implemented in the subscription checkout.
- **Ad-spend leverage** — managing €X/mo of budget across many clinics = OPM
  flowing through us; we take retainer + 12% without risking our own capital.
- **B2B financing partner** (future) — "€0 upfront, €X/mo": a financier pays the
  build price today, the client pays them monthly. Cash now, lower barrier.
- **Deposits** — 50% upfront on builds (already live).

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
  **pay-per-booking pricing needs a French legal check before dental/medical**
  (see the micro-monopoly research note).
- **GDPR** — processing patient data across clinics needs a DPA per client.

## Where it lives in the code

- Prices & products: `src/lib/pricing.ts` (`CARE_PLANS` with `annualEur`,
  `ADS_MANAGEMENT`, `ADDONS`, `careAmountCents`).
- Annual checkout: `src/app/api/checkout-subscription/route.ts` (`billing`
  param → `interval: "year"`, amount = 11× monthly).
- Pricing UI: `src/components/CarePlansSection.tsx` (monthly/annual toggle,
  all-in inclusions, Ads Management card, add-ons row) on `/pricing` + `/fr/tarifs`.
- Portal: Add-ons card in `src/components/PortalDashboard.tsx` ("Message us to
  enable" — provisioning is manual until reseller APIs are wired).

## Next to build (highest leverage first)

1. Wire real reseller provisioning: Cloudflare Registrar (domains), Google
   Workspace reseller (email), Twilio (SMS) — turn the manual add-ons automatic.
2. Ads Management as a productized subscription (retainer via Stripe + spend
   reported in the monthly report).
3. B2B financing partner for builds.
4. White-label / multi-tenant for other agencies.
