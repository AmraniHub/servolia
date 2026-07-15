import { NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/auth";

/** Downloadable plain-text methodology note — drop straight into a diligence folder. */
export async function GET() {
  if (!(await isAdminAuthed())) return new NextResponse("Unauthorized", { status: 401 });

  const text = `SERVOLIA — DATA METHODOLOGY NOTE
Generated ${new Date().toISOString().slice(0, 10)}

This note documents the collection basis for every dataset Servolia holds, for
due-diligence purposes.

1. CLIENTS (table: clients)
   Contractual relationship. Every record is a paying customer with an active
   Stripe subscription, collected at checkout.

2. LEADS (table: leads)
   Inbound enquiries. Visitor-initiated contact via form, chat, or phone.
   Legitimate interest / pre-contractual basis under GDPR Art. 6(1)(b)/(f).
   NOT marketing-consented — do not use for email marketing.

3. EMAIL SUBSCRIBERS (table: email_subscribers)
   Explicit opt-in marketing consent under GDPR Art. 6(1)(a). Every record
   carries a consented_at timestamp, source (footer / exit-popup), and can be
   unsubscribed at any time. This is the ONLY dataset that should be referred
   to as a "marketing audience" or "email list" in any external context.

4. OUTBOUND PROSPECTS (table: prospects)
   A mapped, scored B2B target list built from public business directories
   (Doctolib, Google Maps, PagesJaunes) for cold outreach. Legitimate interest
   basis for initial B2B contact under GDPR Recital 47. This is a sales-
   pipeline asset, NOT a consented marketing list — it must never be merged
   with or counted as part of email_subscribers.

5. CASE STUDIES (table: case_studies)
   Internal content published with the named client's agreement. No personal-
   data concerns.

6. BUILDS (table: builds)
   One-time transaction records from Stripe checkout — deposit and balance
   history per delivered project.

For a buyer's legal review: datasets 1, 3, 5, and 6 carry clean consent/
contractual bases suitable for full transfer. Datasets 2 and 4 are standard
B2B pipeline data (enquiries and prospecting targets) and should be reviewed
under the buyer's own outbound-marketing policy before reuse beyond their
original purpose.
`;

  return new NextResponse(text, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="servolia-data-methodology-${new Date().toISOString().slice(0, 10)}.txt"`,
    },
  });
}
