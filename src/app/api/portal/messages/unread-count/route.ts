import { NextResponse } from "next/server";
import { getClientEmail } from "@/lib/clientAuth";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

/** Read-only count for the Messages tab badge — never marks anything as read. */
export async function GET() {
  const email = await getClientEmail();
  if (!email) return NextResponse.json({ count: 0 });

  const db = supabaseAdmin();
  if (!db) return NextResponse.json({ count: 0 });

  const { count } = await db
    .from("client_messages")
    .select("id", { count: "exact", head: true })
    .eq("email", email)
    .eq("sender", "admin")
    .eq("read_by_client", false)
    .is("deleted_by_client_at", null);

  return NextResponse.json({ count: count ?? 0 });
}
