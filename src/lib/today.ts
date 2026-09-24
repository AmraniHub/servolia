import { supabaseAdmin } from "@/lib/supabase";
import { computeLeadScore } from "@/lib/scoring";
import { HOSTING_TIERS } from "@/lib/hosting";
import { readDraftEmailed } from "@/lib/draftPreview";
import type { ReceptionistState } from "@/lib/clientSites";
import { mailDomainFor, mailState, whatIsOwed, hostingMailDomain, hostingMailboxOwed, type OwedSite, type MailState } from "@/lib/owedToPractice";

/**
 * TODAY — one list of what needs a human, assembled from everything that
 * would otherwise arrive as fourteen separate Telegram messages.
 *
 * Until 2026-09-22 the founder's "what do I do now" lived in the Telegram
 * scrollback: a lead alert, a draft-ready follow-up, a trial ending, a failed
 * card, an add-on to fulfil, a hosting client who paid and needs setup — each
 * from a different sender, none listed anywhere once it scrolled past. And
 * every founder view read the EUR tables only, so the three clients who
 * actually pay were invisible to it.
 *
 * This reads BOTH lines, decides who has to act (you, the client, or nobody
 * yet), and returns rows a page can render and a script can pull. It is the
 * same list the morning Telegram summarises, so the two can never disagree.
 * Read-only: nothing here writes.
 */

export type Owner = "me" | "client";

export interface TodayItem {
  /** stable kind for scripts: lead-sla, lead-hot, build-intake, build-building, draft-send, draft-go, trial-ending, payment-failed, needs-setup, prospect, request-unpaid, reception-not-installed, reception-ending, reception-ended, reception-running, domain-waiting, domain-owed, mailbox-owed, mailbox-unchecked, hosting-mailbox-owed, hosting-mailbox-unchecked */
  kind: string;
  title: string;
  detail?: string;
  href: string;
  owner: Owner;
  /** 2 = today, 1 = this week, 0 = when you get to it */
  urgency: 0 | 1 | 2;
  /** A public receptionist trial's slug — the page offers End / Remove on it. */
  trialSlug?: string;
  trialEnded?: boolean;
}

export interface TodaySection {
  key: string;
  label: string;
  items: TodayItem[];
}

export interface Today {
  generatedAt: string;
  sections: TodaySection[];
  counts: { me: number; client: number; urgent: number };
}

const ADMIN = "https://servolia.com/admin";
const hrsAgo = (iso: string | null | undefined, now: number) =>
  iso ? Math.round((now - new Date(iso).getTime()) / 3_600_000) : null;
const daysUntil = (iso: string | null | undefined, now: number) =>
  iso ? Math.ceil((new Date(iso).getTime() - now) / 86_400_000) : null;

function trialUntil(notes: string | null | undefined): string | null {
  const line = (notes ?? "").split("\n").find((l) => l.startsWith("servolia-trial:"));
  return line?.match(/until:\s*(\S+)/)?.[1] ?? null;
}

export async function buildToday(now = Date.now()): Promise<Today> {
  const sections: TodaySection[] = [];
  const db = supabaseAdmin();
  const empty: Today = { generatedAt: new Date(now).toISOString(), sections: [], counts: { me: 0, client: 0, urgent: 0 } };
  if (!db) return empty;

  const [leadsRes, buildsRes, sitesRes, hostRes, clientsRes, prospectsRes, requestsRes, receptionRes, domainRes] = await Promise.all([
    db.from("leads").select("id, business, email, niche, stage, created_at, last_contacted_at, value_estimate, source, problems, client_value, plan_interest")
      .not("stage", "in", '("live","lost")').eq("status", "active"),
    db.from("builds").select("id, business, email, status, deadline, created_at, started_at").not("status", "in", '("live","delivered")'),
    db.from("client_sites").select("slug, business, status, notes, build_id, updated_at").eq("status", "draft").not("build_id", "is", null),
    db.from("hosting_clients").select("id, business, email, plan, status, notes, site_url, repo, suspend_at, payment_status"),
    db.from("clients").select("id, business, email, plan, status, payment_status, suspend_at, build_id, started_at").in("status", ["active", "paused"]),
    db.from("prospects").select("id, business, city, niche, status, next_action_at, touch_count, demo_slug")
      .eq("status", "to_contact").order("next_action_at", { ascending: true, nullsFirst: true }).limit(3),
    db.from("custom_requests").select("id, title, email, amount_eur, created_at, build_id").eq("status", "quoted"),
    db.from("client_sites").select("slug, config").like("notes", "%servolia-receptionist:%"),
    db.from("client_sites").select("slug, config").eq("status", "published").not("config->>customDomain", "is", null),
  ]);

  /* ── C2: a practice's own domain that is not answering yet ────────────
     Attached a day ago and still not serving her site: her DNS lines were
     not added, or were added wrong. A nudge from a person fixes it. */
  const domains: TodayItem[] = [];
  for (const s of (domainRes.data ?? []) as Array<{ slug: string; config: { businessName?: string; customDomain?: string; domainAttachedAt?: string; domainLiveAt?: string } }>) {
    const c = s.config ?? {};
    if (!c.customDomain || c.domainLiveAt) continue;
    const waited = hrsAgo(c.domainAttachedAt, now) ?? 0;
    if (waited < 24) continue;
    domains.push({
      kind: "domain-waiting", title: `${c.businessName ?? s.slug} (${c.customDomain})`,
      detail: `attached ${Math.round(waited / 24)}d ago, not serving her site yet — check her DNS lines`,
      href: `${ADMIN}/sites`, owner: "me", urgency: waited >= 72 ? 2 : 1,
    });
  }
  if (domains.length) sections.push({ key: "domains", label: "Domains not answering", items: domains });

  /* ── What a paying practice was promised and does not have yet ───────
     Every plan says "your domain (a new one is on us) and 1 pro email
     address". src/lib/owedToPractice.ts decides what is still owed; the row
     clears itself the day her domain answers and publishes MX records. */
  const owed: TodayItem[] = [];
  const paying = ((clientsRes.data ?? []) as Array<{ business: string; status: string; build_id?: string | null; started_at?: string | null }>)
    .filter((c) => c.status === "active" && c.build_id);
  if (paying.length) {
    const { data: paidSites } = await db.from("client_sites")
      .select("slug, status, config, build_id").in("build_id", paying.map((c) => c.build_id as string));
    const rows = (paidSites ?? []) as Array<OwedSite & { build_id: string }>;
    const mail = new Map<string, MailState>();
    await Promise.all(rows.map(async (s) => {
      const d = mailDomainFor(s);
      if (d) mail.set(s.slug, await mailState(d));
    }));
    for (const s of rows) {
      const o = whatIsOwed(s, mail.get(s.slug));
      if (!o) continue;
      const c = paying.find((x) => x.build_id === s.build_id);
      const days = Math.floor((hrsAgo(c?.started_at, now) ?? 0) / 24);
      const name = s.config?.businessName ?? c?.business ?? s.slug;
      if (o.kind === "domain-owed") {
        owed.push({
          kind: "domain-owed", title: name,
          detail: `paying ${days}d, site still at servolia.com/sites/${s.slug} — attach her own domain on /admin/sites, or register a new one for her (fees on us, CGV 7 bis)`,
          href: `${ADMIN}/sites`, owner: "me", urgency: days >= 3 ? 2 : 1,
        });
      } else if (o.kind === "mailbox-owed") {
        owed.push({
          kind: "mailbox-owed", title: `${name} (${o.domain})`,
          detail: `her 1 pro email address is owed — ${o.domain} has no MX records. Create the mailbox (e.g. contact@${o.domain}) and send her the MX lines`,
          href: `${ADMIN}/sites`, owner: "me", urgency: days >= 3 ? 2 : 1,
        });
      } else {
        owed.push({
          kind: "mailbox-unchecked", title: `${name} (${o.domain})`,
          detail: "could not read the domain's MX records this time — her pro email is unverified, not missing",
          href: `${ADMIN}/sites`, owner: "me", urgency: 0,
        });
      }
    }
  }
  if (owed.length) sections.push({ key: "owed", label: "Owed to a paying practice", items: owed });

  /* ── Practices trying the receptionist on their own site ─────────────
     The public trial (receptionistTrial.ts). The three moments a human
     changes the outcome: the line is still not on their site, the week is
     nearly over, the week ended without a payment. */
  const trials: TodayItem[] = [];
  for (const s of (receptionRes.data ?? []) as Array<{ slug: string; config: { businessName?: string; receptionist?: ReceptionistState } }>) {
    const r = s.config?.receptionist;
    /* THE FIRST REAL PAYMENT IS THE PROOF (decided 2026-09-23). No live-mode
       purchase has ever gone through this path — Stripe's livemode gate makes
       test purchases create nothing. So for two weeks after any practice pays,
       the checklist of what that payment must have done sits here, where he
       looks every morning, until he has seen each item with his own eyes. */
    if (r?.paidAt) {
      const paidDays = Math.floor((hrsAgo(r.paidAt, now) ?? 0) / 24);
      if (paidDays <= 14) {
        trials.push({
          kind: "reception-paid-check", title: `PAID — verify the payment path: ${s.config.businessName ?? s.slug} (${r.domain})`,
          detail: "① Telegram said 'NEW CLIENT … Linked' ② she got the 'Elle reste en ligne' email ③ the widget still answers on her site after her trial date ④ /portal with her email shows her enquiries and the conversation meter ⑤ Stripe shows ONE subscription for her",
          href: `${ADMIN}/clients`, owner: "me", urgency: paidDays <= 1 ? 2 : 1,
        });
      }
      continue;
    }
    if (!r?.started || r.closedBy) continue;
    const title = `${s.config.businessName ?? s.slug} (${r.domain})`;
    const href = `${ADMIN}/sites`;
    const act = { trialSlug: s.slug, trialEnded: Boolean(r.ended) };
    const left = daysUntil(r.until, now);
    const since = hrsAgo(r.started, now) ?? 0;
    if (r.ended) {
      const endedDays = Math.floor((hrsAgo(r.ended, now) ?? 0) / 24);
      if (endedDays <= 14) trials.push({ kind: "reception-ended", title, detail: `trial ended ${endedDays}d ago, not paid — ${r.email ?? "?"}`, href, owner: "me", urgency: endedDays <= 2 ? 1 : 0, ...act });
    } else if (!r.installedAt && since >= 24) {
      trials.push({ kind: "reception-not-installed", title, detail: `started ${Math.round(since / 24)}d ago, line NOT on their site — offer to help (${r.email ?? "?"})`, href, owner: "me", urgency: since >= 72 ? 2 : 1, ...act });
    } else if (left !== null && left <= 2) {
      trials.push({ kind: "reception-ending", title, detail: `trial ends in ${Math.max(left, 0)}d — ${r.email ?? "?"}`, href, owner: "me", urgency: left <= 1 ? 2 : 1, ...act });
    } else {
      // Quiet, but visible: every running trial can be seen, and ended, from here.
      trials.push({ kind: "reception-running", title, detail: `trial running${r.installedAt ? ", on their site" : ""} — ends in ${left ?? "?"}d · ${r.email ?? "?"}`, href, owner: "client", urgency: 0, ...act });
    }
  }
  if (trials.length) sections.push({ key: "trials", label: "Trials on their own site", items: trials });

  /* ── Leads: answer them ─────────────────────────────────────────────── */
  const leads: TodayItem[] = [];
  for (const l of (leadsRes.data ?? []) as Array<Record<string, unknown>>) {
    const ref = (l.last_contacted_at as string | null) ?? (l.created_at as string);
    const silent = hrsAgo(ref, now) ?? 0;
    const score = computeLeadScore(l as never);
    const name = String(l.business || l.email || "Unknown");
    if (silent > 48 && l.stage !== "deposit_paid") {
      leads.push({ kind: "lead-sla", title: name, detail: `${silent}h without contact — SLA is 48h`, href: `${ADMIN}/leads/${l.id}`, owner: "me", urgency: 2 });
    } else if (score >= 60) {
      leads.push({ kind: "lead-hot", title: name, detail: `score ${score} · ${String(l.stage).replace(/_/g, " ")}${l.niche ? ` · ${l.niche}` : ""}`, href: `${ADMIN}/leads/${l.id}`, owner: "me", urgency: 1 });
    }
  }
  if (leads.length) sections.push({ key: "leads", label: "Leads to answer", items: leads });

  /* ── Builds and drafts: whose move is it ────────────────────────────── */
  const delivery: TodayItem[] = [];
  const sitesByBuild = new Map<string, { slug: string; notes: string | null; updated_at: string }>();
  for (const s of (sitesRes.data ?? []) as Array<{ slug: string; notes: string | null; build_id: string; updated_at: string }>) {
    sitesByBuild.set(s.build_id, s);
  }
  for (const b of (buildsRes.data ?? []) as Array<{ id: string; business: string; status: string; deadline: string | null; started_at: string | null; created_at: string }>) {
    const site = sitesByBuild.get(b.id);
    const due = daysUntil(b.deadline, now);
    const late = due !== null && due < 0;
    if (b.status === "intake") {
      const waited = hrsAgo(b.created_at, now) ?? 0;
      delivery.push({ kind: "build-intake", title: b.business, detail: `paid, no intake yet — ${Math.round(waited / 24)}d${waited > 72 ? " · send a nudge" : ""}`, href: `${ADMIN}/builds/${b.id}`, owner: "client", urgency: waited > 72 ? 1 : 0 });
      continue;
    }
    if (site) {
      const emailed = readDraftEmailed(site.notes);
      /* C3: she asked for a change from the draft itself (/sites/<slug>/go).
         Her words, here, until the draft is regenerated or she says go. */
      const change = (site.notes ?? "").split("\n").find((l) => l.startsWith("servolia-change-request:"));
      if (change) {
        const [at, ...rest] = change.slice("servolia-change-request:".length).trim().split(" | ");
        const waited = hrsAgo(at, now) ?? 0;
        delivery.push({ kind: "draft-change", title: b.business, detail: `she asked for a change ${Math.round(waited)}h ago: "${rest.join(" | ").slice(0, 160)}"`, href: `${ADMIN}/builds/${b.id}`, owner: "me", urgency: 2 });
        continue;
      }
      if (!emailed) {
        delivery.push({ kind: "draft-send", title: b.business, detail: "draft exists, client has NOT been sent it — press Regenerate", href: `${ADMIN}/builds/${b.id}`, owner: "me", urgency: 2 });
      } else {
        const since = hrsAgo(emailed.at, now) ?? 0;
        delivery.push({ kind: "draft-go", title: b.business, detail: `draft sent ${Math.round(since / 24)}d ago — waiting for their go${since > 72 ? " · chase" : ""}`, href: `https://servolia.com/sites/${site.slug}`, owner: since > 72 ? "me" : "client", urgency: since > 72 ? 1 : 0 });
      }
      continue;
    }
    if (b.status === "building") {
      delivery.push({ kind: "build-building", title: b.business, detail: late ? `LATE by ${-due!}d — CGV refund exposure` : due !== null ? `in build · due in ${due}d` : "in build · no deadline set", href: `${ADMIN}/builds/${b.id}`, owner: "me", urgency: late ? 2 : 1 });
    } else if (b.status === "review") {
      delivery.push({ kind: "build-review", title: b.business, detail: "in review — waiting on the client", href: `${ADMIN}/builds/${b.id}`, owner: "client", urgency: 0 });
    }
  }
  if (delivery.length) sections.push({ key: "delivery", label: "Builds and drafts", items: delivery });

  /* ── Money and hosting: both lines ──────────────────────────────────── */
  const money: TodayItem[] = [];
  for (const h of (hostRes.data ?? []) as Array<{ id: string; business: string; plan: string; status: string; notes: string | null; site_url: string | null; repo: string | null; suspend_at: string | null }>) {
    if (h.status === "trial") {
      const until = trialUntil(h.notes);
      const d = daysUntil(until, now);
      if (d !== null && d <= 2) money.push({ kind: "trial-ending", title: h.business, detail: d <= 0 ? "trial ended — ask if it earned its place" : `assistant trial ends in ${d}d — ask before it goes quiet`, href: `${ADMIN}/hosting/${h.id}`, owner: "me", urgency: d <= 1 ? 2 : 1 });
    }
    if (h.status === "past_due") {
      const d = daysUntil(h.suspend_at, now);
      money.push({ kind: "payment-failed", title: h.business, detail: `card failed — ${d !== null ? `suspends in ${d}d` : "grace running"} (hosting, USD)`, href: `${ADMIN}/hosting/${h.id}`, owner: "me", urgency: d !== null && d <= 3 ? 2 : 1 });
    }
    if (h.status === "active" && HOSTING_TIERS.includes(h.plan) && !h.site_url && !h.repo) {
      money.push({ kind: "needs-setup", title: h.business, detail: "paid for hosting — not hosted yet, no site on record", href: `${ADMIN}/hosting/${h.id}`, owner: "me", urgency: 2 });
    }
  }
  /* Hosting Business: "1 mailbox included" is created by hand. Owed until the
     client's domain publishes MX records (owedToPractice.ts, same rule as a
     practice's mailbox), so the row clears the morning the mailbox exists. */
  const hostRows = (hostRes.data ?? []) as Array<{ id: string; business: string; plan: string; status: string; site_url: string | null }>;
  const hostMail = new Map<string, MailState>();
  await Promise.all(hostRows.map(async (h) => {
    const d = hostingMailDomain(h);
    if (d) hostMail.set(h.id, await mailState(d));
  }));
  for (const h of hostRows) {
    const o = hostingMailboxOwed(h, hostMail.get(h.id));
    if (!o || o.kind === "domain-owed") continue;
    money.push(o.kind === "mailbox-owed"
      ? { kind: "hosting-mailbox-owed", title: `${h.business} (${o.domain})`, detail: `Hosting Business — their 1 included mailbox is owed: ${o.domain} has no MX records. Create it by hand (Zoho), with SPF/DKIM/DMARC, and send them the login`, href: `${ADMIN}/hosting/${h.id}`, owner: "me", urgency: 2 }
      : { kind: "hosting-mailbox-unchecked", title: `${h.business} (${o.domain})`, detail: "could not read the domain's MX records this time — their Business mailbox is unverified, not missing", href: `${ADMIN}/hosting/${h.id}`, owner: "me", urgency: 0 });
  }
  for (const c of (clientsRes.data ?? []) as Array<{ id: string; business: string; payment_status?: string | null; suspend_at: string | null }>) {
    if (c.payment_status === "past_due" || c.payment_status === "past_due_final") {
      const d = daysUntil(c.suspend_at, now);
      money.push({ kind: "payment-failed", title: c.business, detail: `card failed — ${d !== null ? `suspends in ${d}d` : "grace running"} (plan, EUR)`, href: `${ADMIN}/clients/${c.id}`, owner: "me", urgency: d !== null && d <= 3 ? 2 : 1 });
    }
  }
  for (const r of (requestsRes.data ?? []) as Array<{ id: string; title: string; email: string | null; amount_eur: number; build_id: string | null }>) {
    money.push({ kind: "request-unpaid", title: r.title, detail: `€${r.amount_eur} quoted to ${r.email ?? "?"} — unpaid`, href: r.build_id ? `${ADMIN}/builds/${r.build_id}` : `${ADMIN}/builds`, owner: "client", urgency: 0 });
  }
  if (money.length) sections.push({ key: "money", label: "Money and hosting", items: money });

  /* ── Sell: three to invite ──────────────────────────────────────────── */
  const sell: TodayItem[] = [];
  for (const p of (prospectsRes.data ?? []) as Array<{ id: string; business: string; city: string | null; niche: string | null; touch_count: number | null; demo_slug: string | null }>) {
    sell.push({
      kind: "prospect", title: p.business,
      detail: `${p.niche ?? "practice"}${p.city ? ` · ${p.city}` : ""}${p.demo_slug ? " · demo ready" : ""}${p.touch_count ? ` · touched ${p.touch_count}×` : ""}`,
      href: `${ADMIN}/prospects`, owner: "me", urgency: 0,
    });
  }
  if (sell.length) sections.push({ key: "sell", label: "Three to invite", items: sell });

  for (const s of sections) s.items.sort((a, b) => b.urgency - a.urgency);
  const all = sections.flatMap((s) => s.items);
  return {
    generatedAt: new Date(now).toISOString(),
    sections,
    counts: {
      me: all.filter((i) => i.owner === "me").length,
      client: all.filter((i) => i.owner === "client").length,
      urgent: all.filter((i) => i.urgency === 2).length,
    },
  };
}

/** The Telegram summary of the same list — top items only, silent when empty. */
export function todayAsTelegram(t: Today, dateStr: string): string | null {
  if (!t.sections.length) return null;
  const lines: string[] = [`Servolia - ${dateStr}`, `${t.counts.me} for you, ${t.counts.client} waiting on clients${t.counts.urgent ? `, ${t.counts.urgent} today` : ""}`, ""];
  for (const s of t.sections) {
    lines.push(s.label.toUpperCase());
    for (const i of s.items.slice(0, 4)) lines.push(`${i.urgency === 2 ? "! " : "- "}${i.title}${i.detail ? ` - ${i.detail}` : ""}`);
    if (s.items.length > 4) lines.push(`  +${s.items.length - 4} more`);
    lines.push("");
  }
  lines.push(`${ADMIN}/today`);
  return lines.join("\n");
}
