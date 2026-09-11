import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import {
  attachDomainToProject, domainOrder, purchaseDomainForClient,
  readDomainRecord, writeDomainRecord,
} from "@/lib/domainSales";
import { nextChargeDate } from "@/lib/hosting";

export const runtime = "nodejs";

/**
 * The operator's hand on a client's domain: buy it (when the webhook could
 * not -- contact not configured, name taken at that moment, Vercel down),
 * attach it to the client's project, or read the order's status.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const db = supabaseAdmin();
  if (!db) return NextResponse.json({ error: "no-db" }, { status: 503 });

  const body = await req.json().catch(() => ({}));
  const action = typeof body?.action === "string" ? body.action : "";

  const { data: row } = await db.from("hosting_clients").select("id, notes, vercel_project, business, billing_period").eq("id", id).maybeSingle();
  if (!row) return NextResponse.json({ error: "not-found" }, { status: 404 });
  const rec = readDomainRecord(row.notes);
  if (!rec) return NextResponse.json({ error: "no-domain-on-record" }, { status: 400 });

  if (action === "buy") {
    if (rec.status === "bought") return NextResponse.json({ error: "already-bought", record: rec }, { status: 409 });
    const outcome = await purchaseDomainForClient(rec.domain, rec.retailUsd);
    const next = outcome.ok
      ? {
          ...rec, status: "bought" as const, orderId: outcome.orderId, boughtAt: new Date().toISOString().slice(0, 10), note: undefined,
          // A monthly plan's domain is charged yearly by the domain-billing cron.
          nextChargeAt: row.billing_period === "monthly" ? nextChargeDate(new Date(), "annual").toISOString().slice(0, 10) : undefined,
        }
      : { ...rec, status: "pending" as const, note: `${outcome.reason}${outcome.detail ? ` (${outcome.detail})` : ""}` };
    await db.from("hosting_clients").update({ notes: writeDomainRecord(row.notes, next) }).eq("id", id);
    return NextResponse.json({ ok: outcome.ok, outcome, record: next }, { status: outcome.ok ? 200 : 502 });
  }

  if (action === "attach") {
    if (rec.status !== "bought") return NextResponse.json({ error: "not-bought-yet" }, { status: 409 });
    if (!row.vercel_project) return NextResponse.json({ error: "no-vercel-project", hint: "Record the Vercel project first." }, { status: 400 });
    const res = await attachDomainToProject(row.vercel_project, rec.domain);
    if (!res.ok) return NextResponse.json({ ok: false, error: res.code ?? "attach-failed", detail: res.message }, { status: 502 });
    const next = { ...rec, attached: row.vercel_project };
    await db.from("hosting_clients").update({ notes: writeDomainRecord(row.notes, next) }).eq("id", id);
    return NextResponse.json({ ok: true, record: next });
  }

  if (action === "status") {
    if (!rec.orderId) return NextResponse.json({ error: "no-order" }, { status: 400 });
    const res = await domainOrder(rec.orderId);
    if (!res.ok) return NextResponse.json({ ok: false, error: res.code ?? res.status, detail: res.message }, { status: 502 });
    return NextResponse.json({ ok: true, order: res.data });
  }

  return NextResponse.json({ error: "unknown-action" }, { status: 400 });
}
