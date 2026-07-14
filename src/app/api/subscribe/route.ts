import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SOURCES = new Set(["footer", "exit-popup"]);
const LANGUAGES = new Set(["en", "fr"]);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const source = typeof body.source === "string" && SOURCES.has(body.source) ? body.source : "footer";
    const language = typeof body.language === "string" && LANGUAGES.has(body.language) ? body.language : "en";

    if (!EMAIL_PATTERN.test(email) || body.consent !== true) {
      return NextResponse.json({ error: "A valid email and marketing consent are required." }, { status: 400 });
    }

    const db = supabaseAdmin();
    if (!db) return NextResponse.json({ error: "Subscriptions are temporarily unavailable." }, { status: 503 });

    const { error } = await db.from("email_subscribers").upsert({
      email,
      source,
      language,
      status: "active",
      consented_at: new Date().toISOString(),
      unsubscribed_at: null,
    }, { onConflict: "email" });

    if (error) {
      console.error("Email subscription error:", error);
      return NextResponse.json({ error: "Could not save subscription." }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
}
