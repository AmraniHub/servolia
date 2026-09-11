import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { supabaseAdmin } from "@/lib/supabase";
import { referenceFor } from "@/lib/upgrade";
import { resolveHostingPlan } from "@/lib/hosting";
import HostingSetupForm from "@/components/admin/HostingSetupForm";
import DomainActions from "@/components/admin/DomainActions";
import { readDomainRecord } from "@/lib/domainSales";

export const dynamic = "force-dynamic";

/**
 * One hosting client: what they bought, what they told us, and the fields
 * that make the automation work for them.
 *
 * "Set up" means we know where the site is hosted (a repo or a Vercel project
 * recorded). It is inferred from those columns rather than stored as a flag,
 * so it cannot say "set up" for a client whose gate points at nothing.
 */
export default async function HostingClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = supabaseAdmin();
  if (!db) notFound();
  const { data: c } = await db.from("hosting_clients").select("*").eq("id", id).maybeSingle();
  if (!c) notFound();

  const plan = resolveHostingPlan(c.plan);
  const reference = c.subscription_id ? referenceFor(c.subscription_id) : "—";
  const setUp = Boolean(c.repo || c.vercel_project);
  const domainRec = readDomainRecord(c.notes);
  const period = c.billing_period === "annual" ? "yearly" : "monthly";
  const usd = (n: number) => `$${Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 lg:py-8 max-w-4xl mx-auto">
      <Link href="/admin/hosting" className="inline-flex items-center gap-1.5 text-sm text-[#71717A] hover:text-[#18181B] mb-5">
        <ArrowLeft className="w-4 h-4" /> Hosting
      </Link>

      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-black text-[#18181B]">{c.business}</h1>
          <p className="text-sm text-[#71717A] mt-1">
            {c.email ?? "no email"} · ref <span className="font-mono font-bold text-[#18181B]">{reference}</span>
          </p>
        </div>
        <span className={`shrink-0 text-[11px] font-bold px-2.5 py-1 rounded-full border ${
          setUp ? "bg-[#F3F9EE] text-[#36671E] border-[#CBE3BC]" : "bg-[#FEF3C7] text-[#92400E] border-[#FDE68A]"
        }`}>
          {setUp ? "SET UP" : "NEEDS SETUP"}
        </span>
      </div>

      <div className="grid sm:grid-cols-3 gap-3 mb-6">
        {[
          ["Plan", plan ? `${plan.name} · ${usd(period === "yearly" ? plan.annualUsd : plan.monthlyUsd)} / ${period}` : c.plan],
          ["Status", String(c.status).toUpperCase() + (c.payment_status?.startsWith("past_due") ? " · past due" : "")],
          ["Since", c.started_at ? new Date(c.started_at).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" }) : "—"],
        ].map(([k, v]) => (
          <div key={k} className="rounded-xl border border-[#E4E4E7] bg-white p-4">
            <p className="text-[10px] font-bold text-[#A1A1AA] uppercase tracking-wider">{k}</p>
            <p className="text-sm font-semibold text-[#18181B] mt-1">{v}</p>
          </div>
        ))}
      </div>

      {c.site_url ? (
        <p className="text-sm text-[#52525B] mb-6">
          Site:{" "}
          <a href={c.site_url.startsWith("http") ? c.site_url : `https://${c.site_url}`} target="_blank" rel="noreferrer"
             className="inline-flex items-center gap-1 text-[#36671E] hover:underline">
            {c.site_url} <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </p>
      ) : null}

      {!setUp ? (
        <div className="rounded-xl border border-[#FDE68A] bg-[#FFFBEB] p-4 mb-6 text-sm text-[#78350F] leading-relaxed">
          <strong>This client cannot be paused or restored yet.</strong> Until a repo (or Vercel project)
          is recorded below, the gate points at nothing: a missed payment would alert you but do nothing,
          and a later payment could not switch anything back on. Read their handover in Notes, do the
          setup, then record it here — the save verifies the gate is reachable before it accepts.
        </div>
      ) : null}

      {domainRec ? (
        <div className={`rounded-2xl border bg-white p-6 mb-6 ${domainRec.status === "bought" ? "border-[#E4E4E7]" : "border-[#FDE68A]"}`}>
          <h2 className="text-base font-black text-[#18181B] mb-1">Domain bought through Servolia</h2>
          <p className="text-sm text-[#52525B] leading-relaxed">
            <span className="font-mono font-bold text-[#18181B]">{domainRec.domain}</span>
            {" · "}
            {domainRec.status === "bought"
              ? `bought ${domainRec.boughtAt ?? ""} · order ${domainRec.orderId ?? "?"}`
              : `NOT bought yet${domainRec.note ? ` — ${domainRec.note}` : ""}`}
            {" · "}
            {domainRec.attached ? `attached to ${domainRec.attached}` : "not attached to a project yet"}
            {" · "}client pays ${domainRec.retailUsd}/yr
          </p>
          <DomainActions
            id={c.id}
            status={domainRec.status}
            hasOrder={Boolean(domainRec.orderId)}
            attached={domainRec.attached ?? null}
            vercelProject={c.vercel_project ?? null}
          />
        </div>
      ) : null}

      <div className="rounded-2xl border border-[#E4E4E7] bg-white p-6">
        <h2 className="text-base font-black text-[#18181B] mb-4">Hosting setup</h2>
        <HostingSetupForm
          id={c.id}
          initial={{
            repo: c.repo, branch: c.branch, site_root: c.site_root,
            vercel_project: c.vercel_project, site_url: c.site_url, notes: c.notes,
          }}
        />
      </div>
    </div>
  );
}
