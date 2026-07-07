import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase";
import { ArrowLeft, Calendar, CreditCard, User } from "lucide-react";
import BuildStatusActions from "@/components/admin/BuildStatusActions";

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
        <Stat icon={<CreditCard className="w-4 h-4" />} label="Deposit paid"  value={`€${Number(build.deposit_paid).toLocaleString()}`} accent />
        <Stat icon={<CreditCard className="w-4 h-4" />} label="Balance due"   value={`€${Number(build.balance_due).toLocaleString()}`} />
        <Stat icon={<Calendar className="w-4 h-4" />}   label="Deadline"      value={build.deadline ? new Date(build.deadline).toLocaleDateString() : "Not set"} />
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
