import { NextRequest, NextResponse } from "next/server";
import { readUpgradeToken } from "@/lib/upgrade";
import { clientSession } from "@/lib/clientAreaAuth";
import { rowForSubscription } from "@/lib/hostingRow";
import { rateLimited } from "@/lib/security";
import { sameOriginRequest } from "@/lib/sameOrigin";
import { sendTelegramMessage } from "@/lib/telegram";
import {
  clientDomains, listDnsRecords, validateDnsInput, lockReasonFor,
  createDnsRecord, updateDnsRecord, deleteDnsRecord, MAX_CLIENT_RECORDS,
} from "@/lib/clientDns";

/**
 * The client's DNS panel (src/components/client/DnsManager.tsx).
 *
 * One POST, `action` = list | create | update | delete. The caller is the
 * signed-in hosting client (session cookie) or the holder of their emailed
 * account link (`t`), exactly as on /hosting/account. Every call:
 *   1. refuses a cross-site request (a form on another site cannot rewrite a
 *      client's MX records behind their back),
 *   2. recomputes which domains this client owns (src/lib/clientDns.ts) and
 *      refuses any other — the domain in the body is a choice, never proof,
 *   3. for update/delete, re-reads the record from Vercel and refuses a locked
 *      one, so a crafted id cannot reach the hosting's own ALIAS.
 * Every change is announced on Telegram with the record before and after.
 */

const json = (body: unknown, status = 200) => NextResponse.json(body, { status });

export async function POST(req: NextRequest) {
  if (!sameOriginRequest(req.headers)) return json({ ok: false, error: "Cross-origin request refused" }, 403);

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const token = typeof body.t === "string" ? body.t : "";
  const subId = (token ? await readUpgradeToken(token) : null) || (await clientSession());
  if (!subId) return json({ ok: false, error: "Please sign in again." }, 401);
  const row = await rowForSubscription(subId);
  if (!row) return json({ ok: false, error: "Please sign in again." }, 401);

  const action = String(body.action ?? "list");
  const writing = action === "create" || action === "update" || action === "delete";
  /* Every call costs Vercel API requests on the token our own purchases and
     renewals depend on, and every write is a Telegram message to the
     founder: a loop must hit a wall long before either is in trouble.
     Writes are counted separately, per client, per day. */
  if (await rateLimited(`client-dns:${subId}`, 120, 600)) {
    return json({ ok: false, error: "Too many requests. Please wait a few minutes." }, 429);
  }
  if (writing && (await rateLimited(`client-dns-write:${subId}`, 40, 86400))) {
    return json({ ok: false, error: "That is a lot of DNS changes for one day. Reply to any email from us if you need more." }, 429);
  }

  const domains = await clientDomains(row);

  if (action === "domains") return json({ ok: true, domains });

  const domain = String(body.domain ?? "").trim().toLowerCase();
  if (!domains.includes(domain)) {
    return json({ ok: false, error: "That domain is not one you bought through Servolia." }, 403);
  }

  const listed = await listDnsRecords(domain);
  if (!listed.ok) return json({ ok: false, error: listed.error }, 502);
  if (action === "list") return json({ ok: true, records: listed.records });

  const who = row.business || row.email || "a client";

  if (action === "create") {
    const v = validateDnsInput((body.record ?? {}) as Record<string, unknown>, domain);
    if (!v.ok) return json({ ok: false, error: v.error }, 400);
    if (listed.records.filter((r) => !r.locked).length >= MAX_CLIENT_RECORDS) {
      return json({ ok: false, error: `A domain can hold ${MAX_CLIENT_RECORDS} of your own records here. Remove one first, or reply to any email from us.` }, 400);
    }
    const out = await createDnsRecord(domain, v.value);
    if (!out.ok) return json({ ok: false, error: out.error }, 502);
    await announce(`DNS added by ${who} on ${domain}: ${line(v.value)}`);
    return json({ ok: true });
  }

  if (action === "update" || action === "delete") {
    const id = String(body.id ?? "");
    const current = listed.records.find((r) => r.id === id);
    if (!current) return json({ ok: false, error: "That record no longer exists. Refresh the page." }, 404);
    if (current.locked || lockReasonFor({ type: current.type, name: current.name })) {
      return json({ ok: false, error: "This record keeps your website online, so it is managed for you." }, 403);
    }
    if (action === "delete") {
      const out = await deleteDnsRecord(domain, id);
      if (!out.ok) return json({ ok: false, error: out.error }, 502);
      await announce(`DNS deleted by ${who} on ${domain}: ${line(current)}`);
      return json({ ok: true });
    }
    const v = validateDnsInput((body.record ?? {}) as Record<string, unknown>, domain);
    if (!v.ok) return json({ ok: false, error: v.error }, 400);
    const out = await updateDnsRecord(id, v.value);
    if (!out.ok) return json({ ok: false, error: out.error }, 502);
    await announce(`DNS changed by ${who} on ${domain}:\nwas ${line(current)}\nnow ${line(v.value)}`);
    return json({ ok: true });
  }

  return json({ ok: false, error: "Unknown action" }, 400);
}

function line(r: { type: string; name: string; value: string; mxPriority?: number | null }): string {
  const value = r.value.length > 120 ? `${r.value.slice(0, 117)}...` : r.value;
  return `${r.type} ${r.name || "@"} ${r.type === "MX" && r.mxPriority != null ? `${r.mxPriority} ` : ""}${value}`;
}

async function announce(text: string): Promise<void> {
  try {
    // plain: record values carry underscores (_dmarc, DKIM keys) that Markdown would choke on.
    await sendTelegramMessage(text, undefined, { plain: true });
  } catch (e) {
    console.error("[client-dns] telegram failed:", e instanceof Error ? e.message : e);
  }
}
