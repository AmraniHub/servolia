import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

type Subscriber = { email: string; source: string; language: string; status: string; consented_at: string; created_at: string };

function csvCell(value: unknown): string {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export async function GET(request: NextRequest) {
  if (!await isAdminAuthed()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = supabaseAdmin();
  if (!db) return NextResponse.json({ error: "DB not configured" }, { status: 503 });

  const { data, error } = await db.from("email_subscribers").select("email, source, language, status, consented_at, created_at").order("created_at", { ascending: false }).limit(1000);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const subscribers = (data ?? []) as Subscriber[];

  if (request.nextUrl.searchParams.get("format") === "csv") {
    const header = ["email", "source", "language", "status", "consented_at", "created_at"];
    const rows = subscribers.map((subscriber) => header.map((key) => csvCell(subscriber[key as keyof Subscriber])).join(","));
    return new NextResponse([header.join(","), ...rows].join("\n"), {
      headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": "attachment; filename=servolia-email-subscribers.csv" },
    });
  }

  return NextResponse.json({ subscribers });
}
