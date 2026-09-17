import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { supabaseAdmin } from "@/lib/supabase";
import { referenceFor } from "@/lib/upgrade";
import { resolveHostingPlan } from "@/lib/hosting";
import HostingSetupForm from "@/components/admin/HostingSetupForm";
import DomainActions from "@/components/admin/DomainActions";
import { readDomainRecord } from "@/lib/domainSales";
import { isAssistantPlan, conversationCount, hasAssistantSubscription } from "@/lib/assistantAccess";
import { ASSISTANT_SITES } from "@/lib/assistantSites";
import { HOSTING_TIERS } from "@/lib/hosting";
import AssistantInvite from "@/components/admin/AssistantInvite";
import { assistantSlugFor } from "@/lib/assistant";
import { assistantInstalled } from "@/lib/assistantInstall";
import { getClientSite } from "@/lib/clientSites";
import { clientRefFor, refKeyForEmail } from "@/lib/clientRefs";

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

  /* For an assistant row: which brief answers, whether the tag is really on
     the client's home page (read from the repo now, not from a past webhook),
     and whether anyone has talked to it. */
  let assistant: { slug: string; brief: string | null; installed: boolean | null; conversations: number } | null = null;
  if (isAssistantPlan(c.plan)) {
    const refKey = refKeyForEmail(c.email);
    const ref = clientRefFor(refKey);
    const slug = assistantSlugFor(refKey, c.site_url || c.business);
    const config = await getClientSite(slug);
    const target = ref?.repo && !ref.gateWidget
      ? { repo: ref.repo, branch: ref.branch, siteRoot: ref.siteRoot ?? null }
      : c.repo ? { repo: c.repo, branch: c.branch, siteRoot: c.site_root } : null;
    const installed = target ? await assistantInstalled(target) : null;
    assistant = {
      slug,
      brief: config ? `${config.businessName} (${config.services.length} services, ${config.faqs.length} Q&A, ${(config.languages ?? [config.language]).join("/")})` : null,
      installed,
      conversations: await conversationCount(slug),
    };
  }
  /* THE INVITE, for a hosting-tier client whose assistant we have written a
     brief for and who does not pay for one yet. `servolia-invited:` in the
     row's notes is the record that it has already gone — the route writes it
     only after Resend accepts. */
  let invite: { refKey: string; business: string; email: string; brief: string; invitedAt: string | null } | null = null;
  if (HOSTING_TIERS.includes(String(c.plan ?? "").toLowerCase()) && c.email) {
    const refKey = refKeyForEmail(c.email);
    const brief = refKey ? ASSISTANT_SITES[refKey] : undefined;
    const paysForOne = await hasAssistantSubscription(c.email);
    if (refKey && brief && !paysForOne) {
      const line = String(c.notes ?? "").split("\n").find((l) => l.startsWith("servolia-invited:"));
      invite = {
        refKey,
        business: brief.businessName,
        email: c.email,
        brief: `${brief.businessName} — ${brief.services.length} services, ${brief.faqs.length} Q&A, ${(brief.languages ?? [brief.language]).join("/")}`,
        invitedAt: line ? line.slice("servolia-invited:".length).trim() : null,
      };
    }
  }

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
            {domainRec.nextChargeAt ? ` · next yearly charge on the invoice: ${domainRec.nextChargeAt}` : ""}
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

      {/* A HOSTING client whose assistant is built but not yet offered. This
          is the one place the invite can be sent from: the route is admin-only
          (it emails a real client in Servolia's name), so there is no curl
          command for it — and the address it would reach is printed before
          the click that sends it. */}
      {invite ? (
        <div className="rounded-2xl border border-[#CBE3BC] bg-[#F7FBF4] p-6 mb-6">
          <h2 className="text-base font-black text-[#18181B] mb-1">Their assistant is built — not yet offered</h2>
          <p className="text-sm text-[#52525B] leading-relaxed">
            {invite.brief} · showroom{" "}
            <a href={`/hosting/assistant/try?site=${encodeURIComponent(invite.refKey)}`} target="_blank" rel="noreferrer" className="font-bold text-[#36671E] hover:underline">
              open it
            </a>
          </p>
          <AssistantInvite
            refKey={invite.refKey}
            business={invite.business}
            email={invite.email}
            invitedAt={invite.invitedAt}
          />
        </div>
      ) : null}

      {assistant ? (
        <div className={`rounded-2xl border bg-white p-6 mb-6 ${assistant.installed === false ? "border-[#FDE68A]" : "border-[#E4E4E7]"}`}>
          <h2 className="text-base font-black text-[#18181B] mb-1">AI assistant</h2>
          <p className="text-sm text-[#52525B] leading-relaxed">
            slug <span className="font-mono font-bold text-[#18181B]">{assistant.slug}</span>
            {" · "}
            {assistant.brief ? `brief: ${assistant.brief}` : "NO BRIEF — answers generically until the client (or you) writes one"}
            {" · "}
            {assistant.installed === true ? "installed on the home page"
              : assistant.installed === false ? "NOT on the home page — install failed or site not hosted"
              : "install state unknown (no repo, or GitHub unreadable)"}
            {" · "}
            {assistant.conversations} conversation{assistant.conversations === 1 ? "" : "s"} in 30 days
          </p>
          <div className="flex flex-wrap gap-3 mt-3 text-sm">
            <a href={`/hosting/assistant/try?site=${encodeURIComponent(assistant.slug)}`} target="_blank" rel="noreferrer"
               className="inline-flex items-center gap-1 text-[#36671E] hover:underline">
              Try it <ExternalLink className="w-3.5 h-3.5" />
            </a>
            <Link href="/admin/sites" className="text-[#36671E] hover:underline">Client sites</Link>
          </div>
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
