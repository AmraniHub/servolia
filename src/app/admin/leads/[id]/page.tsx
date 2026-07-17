import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase";
import { ArrowLeft, Mail, Phone, Globe, MapPin, Clock, ExternalLink, StickyNote, PhoneCall, Send, FileText, MessageCircle } from "lucide-react";
import LeadActions from "@/components/admin/LeadActions";
import LeadStageSelect from "@/components/admin/LeadStageSelect";
import ScopeDocumentPanel from "@/components/admin/ScopeDocumentPanel";
import { computeLeadScore, scoreColors, scoreLabel } from "@/lib/scoring";
import { waLink } from "@/lib/whatsapp";

export const dynamic = "force-dynamic";

interface Activity {
  id: string;
  type: string;
  description: string;
  created_at: string;
}

const ACTIVITY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  note: StickyNote, call: PhoneCall, email: Mail, message: Send,
  created: FileText, stage_change: FileText, audit_sent: FileText, payment: FileText,
};

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = supabaseAdmin();
  if (!db) notFound();

  const { data: lead } = await db.from("leads").select("*").eq("id", id).maybeSingle();
  if (!lead) notFound();

  const { data: activities } = await db.from("lead_activities")
    .select("*").eq("lead_id", id).order("created_at", { ascending: false });

  const score = computeLeadScore(lead);
  const sc = scoreColors(score);

  const firstName = (lead.name || "").split(" ")[0];
  const waHref = waLink(
    lead.phone,
    `Hi${firstName ? " " + firstName : ""} 👋 It's Servolia — following up on your enquiry${lead.business ? ` for ${lead.business}` : ""}.`
  );

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 lg:py-8 max-w-6xl mx-auto">
      <Link href="/admin/leads" className="inline-flex items-center gap-1.5 text-sm text-[#71717A] hover:text-[#18181B] transition-colors mb-4">
        <ArrowLeft className="w-4 h-4" /> All leads
      </Link>

      <div className="grid lg:grid-cols-3 gap-6">

        {/* Main column */}
        <div className="lg:col-span-2 space-y-6">

          {/* Header card */}
          <div className="bg-white border border-[#E8E6E0] rounded-2xl p-6">
            <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
              <div className="min-w-0">
                <h1 className="text-xl font-black text-[#18181B] truncate">{lead.business || lead.name || "Unnamed lead"}</h1>
                <p className="text-sm text-[#71717A] mt-0.5">{lead.niche ?? "—"} · {lead.country ?? "?"}</p>
              </div>
              <LeadStageSelect leadId={lead.id} initialStage={lead.stage} />
            </div>

            <div className="grid sm:grid-cols-2 gap-3 mt-4">
              <Info icon={<Mail className="w-3.5 h-3.5" />}  label="Email"   value={lead.email} link={lead.email ? `mailto:${lead.email}` : undefined} />
              <Info icon={<Phone className="w-3.5 h-3.5" />} label="Phone"   value={lead.phone} link={lead.phone ? `tel:${lead.phone}` : undefined} />
              <Info icon={<Globe className="w-3.5 h-3.5" />} label="Website" value={lead.website} link={lead.website?.startsWith("http") ? lead.website : (lead.website ? `https://${lead.website}` : undefined)} />
              <Info icon={<MapPin className="w-3.5 h-3.5" />} label="Location" value={[lead.city, lead.country].filter(Boolean).join(", ")} />
            </div>

            {waHref && (
              <a href={waHref} target="_blank" rel="noopener noreferrer"
                className="mt-4 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#25D366] text-white font-bold text-sm hover:bg-[#1EBE57] transition-colors shadow-sm">
                <MessageCircle className="w-4 h-4" /> Message on WhatsApp
              </a>
            )}
          </div>

          {/* Lead score */}
          <div className={`border rounded-2xl p-5 ${sc.bg} ${sc.border}`}>
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className={`text-[10px] font-black uppercase tracking-widest ${sc.text}`}>Lead Score</p>
                <p className={`text-3xl font-black ${sc.text}`}>{score}<span className="text-base font-bold opacity-60">/100</span></p>
              </div>
              <span className={`text-sm font-black px-3 py-1 rounded-full border ${sc.bg} ${sc.text} ${sc.border}`}>
                {scoreLabel(score)}
              </span>
            </div>
            <div className="h-2 rounded-full bg-white/60 overflow-hidden">
              <div className={`h-full rounded-full ${sc.bar} transition-all`} style={{ width: `${score}%` }} />
            </div>
            <div className="grid grid-cols-2 gap-2 mt-3 text-[10px]">
              <ScoreFactor label="Niche value" ok={!!lead.niche} note={lead.niche ?? "unknown"} />
              <ScoreFactor label="Phone provided" ok={!!lead.phone} />
              <ScoreFactor label="Website provided" ok={!!lead.website} />
              <ScoreFactor label="Stage progress" ok={["qualified","deposit_paid","live"].includes(lead.stage)} note={lead.stage} />
            </div>
          </div>

          {/* Qualification */}
          <div className="bg-white border border-[#E8E6E0] rounded-2xl p-6">
            <h2 className="text-sm font-black text-[#18181B] uppercase tracking-widest mb-4">Qualification</h2>
            <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <Field label="Source"          value={lead.source} />
              <Field label="Plan interest"   value={lead.plan_interest} />
              <Field label="Client value"    value={lead.client_value} />
              <Field label="Value estimate"  value={`€${Number(lead.value_estimate ?? 0).toLocaleString()}`} />
              <Field label="Language"        value={lead.language} />
              <Field label="Created"         value={new Date(lead.created_at).toLocaleString()} />
              {lead.last_contacted_at && (
                <Field label="Last contacted" value={new Date(lead.last_contacted_at).toLocaleString()} />
              )}
            </dl>

            {Array.isArray(lead.problems) && lead.problems.length > 0 && (
              <div className="mt-4">
                <p className="text-xs font-bold text-[#71717A] uppercase tracking-widest mb-2">Problems mentioned</p>
                <div className="flex flex-wrap gap-1.5">
                  {lead.problems.map((p: string) => (
                    <span key={p} className="text-xs font-medium px-2.5 py-1 rounded-full bg-[#FEF3C7] text-[#92400E]">{p}</span>
                  ))}
                </div>
              </div>
            )}

            {lead.notes && (
              <div className="mt-4 pt-4 border-t border-[#F5F4EF]">
                <p className="text-xs font-bold text-[#71717A] uppercase tracking-widest mb-2">Notes (intake)</p>
                <p className="text-sm text-[#52525B] leading-relaxed whitespace-pre-wrap">{lead.notes}</p>
              </div>
            )}
          </div>

          {/* Activity timeline */}
          <div className="bg-white border border-[#E8E6E0] rounded-2xl p-6">
            <h2 className="text-sm font-black text-[#18181B] uppercase tracking-widest mb-4">Activity timeline</h2>
            {(activities ?? []).length === 0 ? (
              <p className="text-sm text-[#A1A1AA]">No activity yet.</p>
            ) : (
              <ol className="relative border-l-2 border-[#E8E6E0] ml-2 pl-5 space-y-5">
                {(activities ?? []).map((a: Activity) => {
                  const Icon = ACTIVITY_ICONS[a.type] ?? FileText;
                  return (
                    <li key={a.id} className="relative">
                      <span className="absolute -left-[28px] w-6 h-6 rounded-full bg-[#FAFAF7] border-2 border-[#36671E] flex items-center justify-center">
                        <Icon className="w-3 h-3 text-[#36671E]" />
                      </span>
                      <div className="flex items-center gap-2 text-xs text-[#71717A] mb-1">
                        <span className="font-bold uppercase tracking-widest">{a.type.replace(/_/g, " ")}</span>
                        <span>·</span>
                        <span>{ago(a.created_at)}</span>
                      </div>
                      <p className="text-sm text-[#18181B] whitespace-pre-wrap">{a.description}</p>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>

          {/* Raw data */}
          {lead.raw_data && (
            <details className="bg-white border border-[#E8E6E0] rounded-2xl p-6">
              <summary className="text-sm font-black text-[#18181B] uppercase tracking-widest cursor-pointer">Raw submission</summary>
              <pre className="mt-4 text-xs text-[#52525B] bg-[#FAFAF7] p-4 rounded-lg overflow-x-auto">
                {JSON.stringify(lead.raw_data, null, 2)}
              </pre>
            </details>
          )}
        </div>

        {/* Side: quick actions */}
        <aside className="space-y-4">
          <div>
            <h2 className="text-sm font-black text-[#18181B] uppercase tracking-widest mb-3">Quick actions</h2>
            <LeadActions leadId={lead.id} />
          </div>
          <ScopeDocumentPanel
            leadId={lead.id}
            businessName={lead.business || lead.name || "this client"}
            contactName={lead.name}
            email={lead.email}
            phone={lead.phone}
            suggestedPlan={lead.plan_interest}
          />
        </aside>
      </div>
    </div>
  );
}

function Info({ icon, label, value, link }: { icon: React.ReactNode; label: string; value?: string | null; link?: string }) {
  if (!value) return null;
  const inner = (
    <div className="flex items-center gap-2.5 p-3 rounded-lg bg-[#FAFAF7] border border-[#E8E6E0] hover:border-[#36671E]/30 transition-colors">
      <span className="text-[#36671E]">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-bold text-[#A1A1AA] uppercase tracking-widest">{label}</p>
        <p className="text-sm font-medium text-[#18181B] truncate flex items-center gap-1">{value} {link && <ExternalLink className="w-3 h-3 text-[#A1A1AA]" />}</p>
      </div>
    </div>
  );
  return link ? <a href={link} target="_blank" rel="noreferrer">{inner}</a> : inner;
}

function Field({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <>
      <dt className="text-xs font-bold text-[#71717A] uppercase tracking-widest">{label}</dt>
      <dd className="text-sm text-[#18181B] -mt-2 sm:mt-0">{value || "—"}</dd>
    </>
  );
}

function ago(ts: string): string {
  const diff = (Date.now() - new Date(ts).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return Math.floor(diff / 60) + "m ago";
  if (diff < 86400) return Math.floor(diff / 3600) + "h ago";
  if (diff < 86400 * 7) return Math.floor(diff / 86400) + "d ago";
  return new Date(ts).toLocaleDateString();
}

function ScoreFactor({ label, ok, note }: { label: string; ok: boolean; note?: string | null }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] font-black ${ok ? "bg-[#36671E] text-white" : "bg-white/70 text-[#A1A1AA]"}`}>
        {ok ? "✓" : "–"}
      </span>
      <span className="text-[#52525B] font-medium">{label}{note ? ` · ${note}` : ""}</span>
    </div>
  );
}

// Suppress unused warning for Clock icon (kept for potential future use)
void Clock;
