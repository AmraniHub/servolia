import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase";
import { ArrowLeft, Calendar, CreditCard, User, Check, AlertTriangle, Clock } from "lucide-react";
import { loadProgressFacts, buildProgress, type BuildLike } from "@/lib/buildProgress";
import BuildStatusActions from "@/components/admin/BuildStatusActions";
import ClientMessageThread from "@/components/admin/ClientMessageThread";
import CustomRequests from "@/components/admin/CustomRequests";
import OpenInClaudeCode from "@/components/admin/OpenInClaudeCode";

/** Where the repo lives on the founder's laptop (for the Claude Code command). */
const LOCAL_PROJECT_PATH =
  process.env.NEXT_PUBLIC_LOCAL_PROJECT_PATH || "C:\\Users\\Elamr\\Music\\APPS\\servolia";

export const dynamic = "force-dynamic";

export default async function BuildDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = supabaseAdmin();
  if (!db) notFound();

  const { data: build } = await db.from("builds").select("*").eq("id", id).maybeSingle();
  if (!build) notFound();

  const { data: lead } = build.lead_id
    ? await db.from("leads").select("id, business, email").eq("id", build.lead_id).maybeSingle()
    : { data: null };

  // Delivery checklist, derived from the same source the builds board uses.
  const facts = await loadProgressFacts([build as BuildLike]);
  const progress = buildProgress(build as BuildLike, facts);

  // The generated site for this build (if any) — used to scope the local edit command.
  let siteSlug: string | null = null;
  try {
    const { data: site } = await db.from("client_sites").select("slug").eq("build_id", build.id).maybeSingle();
    siteSlug = (site as { slug?: string } | null)?.slug ?? null;
  } catch { /* table may not exist yet */ }

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 lg:py-8 max-w-4xl mx-auto">
      <Link href="/admin/builds" className="inline-flex items-center gap-1.5 text-sm text-[#71717A] hover:text-[#18181B] mb-4">
        <ArrowLeft className="w-4 h-4" /> All builds
      </Link>

      <div className="bg-white border border-[#E8E6E0] rounded-2xl p-6 mb-6">
        <div className="flex items-start justify-between gap-3 mb-2 flex-wrap">
          <h1 className="text-xl font-black text-[#18181B]">{build.business}</h1>
          <span className="text-xs text-[#71717A]">Started {new Date(build.created_at).toLocaleDateString()}</span>
        </div>
        <p className="text-sm text-[#71717A] mb-6">{build.plan_name} · €{Number(build.total_price).toLocaleString()} total</p>

        <p className="text-xs font-black text-[#71717A] uppercase tracking-widest mb-3">Status</p>
        <BuildStatusActions buildId={build.id} currentStatus={build.status} />
      </div>

      <div className="grid sm:grid-cols-3 gap-4 mb-6">
        <Stat icon={<CreditCard className="w-4 h-4" />} label="Installation paid" value={`€${Number(build.deposit_paid).toLocaleString()}`} accent />
        {/* Nothing is owed on delivery any more, so this only earns its tile for
            builds sold under the retired 50/50 model. */}
        <Stat
          icon={<CreditCard className="w-4 h-4" />}
          label={Number(build.balance_due) > 0 ? "Balance due (legacy)" : "Owed on delivery"}
          value={Number(build.balance_due) > 0 ? `€${Number(build.balance_due).toLocaleString()}` : "Nothing"}
        />
        <Stat icon={<Calendar className="w-4 h-4" />}   label="Deadline"      value={build.deadline ? new Date(build.deadline).toLocaleDateString() : "Not set"} />
      </div>

      {/* DELIVERY CHECKLIST — derived from the data, never hand-ticked. */}
      <div className="bg-white border border-[#E8E6E0] rounded-2xl p-6 mb-6">
        <div className="flex items-center justify-between gap-3 mb-1 flex-wrap">
          <h2 className="text-sm font-black text-[#18181B] uppercase tracking-widest">Delivery checklist</h2>
          <span className="text-xs font-bold text-[#71717A]">{progress.doneCount}/{progress.total} done</span>
        </div>
        <p className="text-xs text-[#71717A] mb-4">
          Filled in automatically from your data — nothing to tick by hand.
        </p>

        <div className="h-1.5 rounded-full bg-[#F0EFEA] overflow-hidden mb-5">
          <div className="h-full rounded-full bg-[#36671E] transition-all"
            style={{ width: `${Math.round((progress.doneCount / progress.total) * 100)}%` }} />
        </div>

        <ol className="space-y-1">
          {progress.steps.map((s) => {
            const isCurrent = progress.current?.key === s.key;
            return (
              <li key={s.key}
                className={`flex items-start gap-3 rounded-xl px-3 py-2.5 ${isCurrent ? (s.owner === "client" ? "bg-[#FEF3C7]" : "bg-[#EEF5EA]") : ""}`}>
                <span className={`mt-0.5 w-4 h-4 shrink-0 rounded-full flex items-center justify-center ${
                  s.done ? "bg-[#36671E]" : isCurrent ? "bg-white border-2 border-[#D97706]" : "bg-[#F0EFEA]"
                }`}>
                  {s.done && <Check className="w-2.5 h-2.5 text-white" strokeWidth={4} />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`block text-sm ${s.done ? "text-[#A1A1AA] line-through" : "font-bold text-[#18181B]"}`}>
                    {s.label}
                  </span>
                  {isCurrent && (
                    <span className={`block text-xs mt-0.5 ${s.owner === "client" ? "text-[#92400E]" : "text-[#36671E]"}`}>
                      {s.hint}
                    </span>
                  )}
                </span>
                {!s.done && (
                  <span className={`shrink-0 text-[9px] font-black px-1.5 py-0.5 rounded-full ${
                    s.owner === "client" ? "bg-[#FDE68A] text-[#92400E]" : "bg-[#D6E2CF] text-[#36671E]"
                  }`}>
                    {s.owner === "client" ? "CLIENT" : "YOU"}
                  </span>
                )}
              </li>
            );
          })}
        </ol>

        {progress.atRiskEur > 0 && (
          <div className="mt-4 flex items-start gap-2 p-3 rounded-xl bg-[#FEE2E2] border border-[#B91C1C]/20">
            <AlertTriangle className="w-4 h-4 text-[#B91C1C] shrink-0 mt-0.5" />
            <p className="text-xs text-[#B91C1C]">
              <strong>€{progress.atRiskEur.toLocaleString()} refund risk</strong> — {progress.daysLate} day
              {progress.daysLate > 1 ? "s" : ""} past the promised date, and the ball is in your court.
              The CGV owe 10% per day late, capped at 50%.
            </p>
          </div>
        )}
        {progress.waitingOnClient && progress.daysLate > 0 && (
          <div className="mt-4 flex items-start gap-2 p-3 rounded-xl bg-[#F5F4EF] border border-[#E8E6E0]">
            <Clock className="w-4 h-4 text-[#71717A] shrink-0 mt-0.5" />
            <p className="text-xs text-[#52525B]">
              {progress.daysLate} day{progress.daysLate > 1 ? "s" : ""} past target, but you&apos;re waiting on
              the client — the delivery guarantee is paused (CGV: client-caused delays don&apos;t extend it).
            </p>
          </div>
        )}
      </div>

      <div className="bg-white border border-[#E8E6E0] rounded-2xl p-6 mb-6">
        <h2 className="text-sm font-black text-[#18181B] uppercase tracking-widest mb-4">Details</h2>
        <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
          <Field label="Email"           value={build.email} />
          <Field label="Plan"            value={build.plan} />
          <Field label="Stripe customer" value={build.customer_id} />
          <Field label="Checkout session" value={build.checkout_session_id ? `${build.checkout_session_id.slice(0,16)}…` : null} />
          <Field label="Started"         value={build.started_at ? new Date(build.started_at).toLocaleString() : null} />
          <Field label="Delivered"       value={build.delivered_at ? new Date(build.delivered_at).toLocaleString() : null} />
          <Field label="Live since"      value={build.live_at ? new Date(build.live_at).toLocaleString() : null} />
        </dl>
      </div>

      {lead && (
        <div className="bg-white border border-[#E8E6E0] rounded-2xl p-6 mb-6">
          <p className="text-xs font-black text-[#71717A] uppercase tracking-widest mb-3">Originating lead</p>
          <Link href={`/admin/leads/${lead.id}`}
            className="flex items-center gap-3 p-3 rounded-lg bg-[#FAFAF7] border border-[#E8E6E0] hover:border-[#36671E]/30 transition-colors">
            <div className="w-8 h-8 rounded-full bg-[#EEF5EA] flex items-center justify-center text-[#36671E]">
              <User className="w-4 h-4" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[#18181B]">{lead.business}</p>
              <p className="text-xs text-[#71717A]">{lead.email ?? "no email"}</p>
            </div>
          </Link>
        </div>
      )}

      <div className="mb-6">
        <CustomRequests buildId={build.id} />
      </div>

      <div className="mb-6">
        <OpenInClaudeCode
          buildId={build.id}
          business={build.business}
          slug={siteSlug}
          projectPath={LOCAL_PROJECT_PATH}
        />
      </div>

      {build.email && (
        <div className="mb-6">
          <p className="text-xs font-black text-[#71717A] uppercase tracking-widest mb-3">Client conversation</p>
          <ClientMessageThread email={build.email} buildId={build.id} />
        </div>
      )}

      {build.intake_data && (
        <details className="bg-white border border-[#E8E6E0] rounded-2xl p-6">
          <summary className="text-sm font-black text-[#18181B] uppercase tracking-widest cursor-pointer">Intake form</summary>
          <pre className="mt-4 text-xs text-[#52525B] bg-[#FAFAF7] p-4 rounded-lg overflow-x-auto">
            {JSON.stringify(build.intake_data, null, 2)}
          </pre>
        </details>
      )}
    </div>
  );
}

function Stat({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent?: boolean }) {
  return (
    <div className={`p-4 rounded-xl border ${accent ? "bg-[#EEF5EA] border-[#36671E]/30" : "bg-white border-[#E8E6E0]"}`}>
      <div className="flex items-center gap-2 mb-2">
        <span className={accent ? "text-[#36671E]" : "text-[#A1A1AA]"}>{icon}</span>
        <span className={`text-xs font-bold uppercase tracking-widest ${accent ? "text-[#36671E]" : "text-[#71717A]"}`}>{label}</span>
      </div>
      <p className={`text-lg font-black ${accent ? "text-[#36671E]" : "text-[#18181B]"}`}>{value}</p>
    </div>
  );
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <>
      <dt className="text-xs font-bold text-[#71717A] uppercase tracking-widest">{label}</dt>
      <dd className="text-sm text-[#18181B] font-medium -mt-2 sm:mt-0">{value || "—"}</dd>
    </>
  );
}
