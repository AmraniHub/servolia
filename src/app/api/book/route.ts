import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, estimateLeadValue } from "@/lib/supabase";
import { isValidSlot, formatSlot } from "@/lib/booking";
import { sendEmail, callBookingEmail } from "@/lib/email";
import { sendTelegramMessage } from "@/lib/telegram";
import { sendMetaCapiEvent } from "@/lib/metaCapi";

export const runtime = "nodejs";

/** Public: book a discovery call. Creates a booking + a qualified lead, notifies founder. */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as {
    name?: string; email?: string; phone?: string;
    business?: string; city?: string; message?: string;
    slot?: string; lang?: string; niche?: string;
  };

  const name = (body.name ?? "").trim();
  const email = (body.email ?? "").trim();
  const slot = (body.slot ?? "").trim();
  const lang = body.lang === "en" ? "en" : "fr";

  if (!name || !/^[\w.+-]+@[\w-]+\.[\w.-]+$/.test(email)) {
    return NextResponse.json({ error: "Name and a valid email are required" }, { status: 400 });
  }
  if (!isValidSlot(slot)) {
    return NextResponse.json({ error: "That time slot is no longer available — pick another" }, { status: 400 });
  }

  const db = supabaseAdmin();
  let leadId: string | null = null;

  if (db) {
    // Double-book guard
    const { data: clash } = await db
      .from("bookings")
      .select("id")
      .eq("slot_start", new Date(slot).toISOString())
      .neq("status", "cancelled")
      .maybeSingle();
    if (clash) {
      return NextResponse.json({ error: "Someone just took that slot — please pick another" }, { status: 409 });
    }

    // Create a qualified lead so the call lands in the CRM pipeline
    const { data: lead } = await db.from("leads").insert({
      name, email, phone: body.phone || null,
      business: body.business || null,
      city: body.city || null,
      niche: body.niche || "dental",
      source: "contact",
      stage: "qualified",
      value_estimate: estimateLeadValue(body.niche ?? "dental"),
      notes: `Booked a discovery call for ${formatSlot(slot, lang)}${body.message ? `\n\n"${body.message}"` : ""}`,
    }).select("id").single();
    leadId = lead?.id ?? null;

    const { error } = await db.from("bookings").insert({
      name, email, phone: body.phone || null,
      business: body.business || null, city: body.city || null,
      message: body.message || null,
      slot_start: new Date(slot).toISOString(),
      status: "confirmed", source: "website", lead_id: leadId,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Confirmation email to the prospect
  const when = formatSlot(slot, lang);
  const tpl = callBookingEmail(name.split(" ")[0], when, lang);
  await sendEmail(email, tpl.subject, tpl.html);

  // Founder alert
  sendTelegramMessage(
    `📞 *Discovery call booked*\n*${name}*${body.business ? ` — ${body.business}` : ""}\n🗓 ${when}\n📧 ${email}${body.phone ? `\n📱 ${body.phone}` : ""}${body.message ? `\n\n"${body.message}"` : ""}` +
    (leadId ? `\n\n[Open lead](https://servolia.com/admin/leads/${leadId})` : ""),
  ).catch(() => {});

  sendMetaCapiEvent({
    eventName: "Lead",
    email, phone: body.phone,
    eventSourceUrl: "https://servolia.com/call",
    req,
  });

  return NextResponse.json({ ok: true, when });
}
