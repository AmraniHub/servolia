import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { isAdminAuthed } from "@/lib/auth";

export async function GET(req: NextRequest) {
  if (!await isAdminAuthed()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = supabaseAdmin();
  if (!db) return NextResponse.json({ results: [] });

  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length < 1) return NextResponse.json({ results: [] });

  const like = `%${q}%`;

  const [leadsRes, buildsRes, clientsRes] = await Promise.all([
    db.from("leads")
      .select("id, business, name, email, niche, stage")
      .or(`business.ilike.${like},name.ilike.${like},email.ilike.${like},niche.ilike.${like}`)
      .limit(6),
    db.from("builds")
      .select("id, business, plan_name, status")
      .or(`business.ilike.${like},plan_name.ilike.${like}`)
      .limit(4),
    db.from("clients")
      .select("id, business, plan, status")
      .ilike("business", like)
      .limit(4),
  ]);

  const results = [
    ...(leadsRes.data ?? []).map(l => ({
      type: "lead" as const,
      id: l.id,
      title: l.business || l.name || l.email || "Unnamed lead",
      subtitle: [l.niche, l.stage?.replace(/_/g, " ")].filter(Boolean).join(" · "),
      href: `/admin/leads/${l.id}`,
    })),
    ...(buildsRes.data ?? []).map(b => ({
      type: "build" as const,
      id: b.id,
      title: b.business,
      subtitle: [b.plan_name, b.status].filter(Boolean).join(" · "),
      href: `/admin/builds/${b.id}`,
    })),
    ...(clientsRes.data ?? []).map(c => ({
      type: "client" as const,
      id: c.id,
      title: c.business,
      subtitle: [c.plan, c.status].filter(Boolean).join(" · "),
      href: `/admin/clients`,
    })),
  ];

  return NextResponse.json({ results });
}
