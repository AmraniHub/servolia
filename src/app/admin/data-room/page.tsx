import { supabaseAdmin } from "@/lib/supabase";
import { Download, Database, ShieldCheck, FileText } from "lucide-react";

export const dynamic = "force-dynamic";

/**
 * Data Room — the diligence-ready export center. If Servolia is ever sold,
 * this page and its methodology note are what a buyer's lawyer asks for on
 * day one: clean, exportable data with a documented collection/consent basis
 * for each dataset. Never present prospects (cold outbound targets) or leads
 * (inbound enquiries) as "consented marketing audience" — only
 * email_subscribers carries GDPR marketing consent.
 */

interface Counts {
  clients: number; activeClients: number; mrr: number;
  leads: number; subscribers: number; prospects: number; caseStudies: number; publishedCaseStudies: number;
}

async function getCounts(): Promise<Counts> {
  const db = supabaseAdmin();
  if (!db) return { clients: 0, activeClients: 0, mrr: 0, leads: 0, subscribers: 0, prospects: 0, caseStudies: 0, publishedCaseStudies: 0 };

  const [clients, leads, subs, prospects, cases] = await Promise.all([
    db.from("clients").select("status, monthly_amount"),
    db.from("leads").select("id", { count: "exact", head: true }),
    db.from("email_subscribers").select("status"),
    db.from("prospects").select("id", { count: "exact", head: true }),
    db.from("case_studies").select("published"),
  ]);

  const clientRows = (clients.data ?? []) as { status: string; monthly_amount: number }[];
  const activeClients = clientRows.filter((c) => c.status === "active");
  const subRows = (subs.data ?? []) as { status: string }[];
  const caseRows = (cases.data ?? []) as { published: boolean }[];

  return {
    clients: clientRows.length,
    activeClients: activeClients.length,
    mrr: activeClients.reduce((s, c) => s + Number(c.monthly_amount), 0),
    leads: leads.count ?? 0,
    subscribers: subRows.filter((s) => s.status === "active").length,
    prospects: prospects.count ?? 0,
    caseStudies: caseRows.length,
    publishedCaseStudies: caseRows.filter((c) => c.published).length,
  };
}

const METHODOLOGY = [
  {
    dataset: "Clients", table: "clients",
    basis: "Contractual relationship. Every record is a paying customer with an active Stripe subscription — collected at checkout.",
    export: "/api/admin/export/clients",
  },
  {
    dataset: "Leads", table: "leads",
    basis: "Inbound enquiries. Visitor-initiated contact (form, chat, phone) — legitimate interest / pre-contractual basis under GDPR Art. 6(1)(b)/(f). Not marketing-consented.",
    export: "/api/admin/export/leads",
  },
  {
    dataset: "Email subscribers", table: "email_subscribers",
    basis: "Explicit opt-in marketing consent (GDPR Art. 6(1)(a)). Every record carries a consented_at timestamp and source. The only dataset that should ever be called a \"marketing audience\".",
    export: "/api/admin/subscribers?format=csv",
  },
  {
    dataset: "Outbound prospects", table: "prospects",
    basis: "B2B target list built from public business directories (Doctolib, Google Maps, PagesJaunes) for cold outreach — legitimate interest basis for initial B2B contact (GDPR Recital 47). NOT a consented marketing list — never merge with email_subscribers.",
    export: "/api/admin/export/prospects",
  },
  {
    dataset: "Case studies", table: "case_studies",
    basis: "Internal content, published with client agreement. No personal-data concerns.",
    export: "/api/admin/export/case-studies",
  },
  {
    dataset: "Builds (one-time revenue)", table: "builds",
    basis: "Transaction records from Stripe checkout — deposit/balance history per project.",
    export: "/api/admin/export/builds",
  },
] as const;

export default async function DataRoomPage() {
  const c = await getCounts();

  return (
    <div className="p-6 max-w-4xl">
      <h1 className="text-xl font-black text-[#18181B] mb-1 flex items-center gap-2">
        <Database className="w-5 h-5 text-[#36671E]" /> Data Room
      </h1>
      <p className="text-sm text-[#71717A] mb-6">
        Every dataset Servolia holds, exportable as clean CSVs with a documented collection basis for each — what a buyer&apos;s due-diligence checklist asks for first.
      </p>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
        <Stat label="Active clients" value={c.activeClients} sub={`${c.clients} total`} accent />
        <Stat label="MRR" value={`€${c.mrr.toLocaleString()}`} />
        <Stat label="Leads captured" value={c.leads} />
        <Stat label="Consented subscribers" value={c.subscribers} />
        <Stat label="Outbound prospects" value={c.prospects} />
        <Stat label="Case studies" value={c.publishedCaseStudies} sub={`${c.caseStudies} total`} />
      </div>

      {/* Methodology + downloads */}
      <div className="bg-white border border-[#E8E6E0] rounded-2xl overflow-hidden mb-6">
        <div className="px-5 py-4 border-b border-[#E8E6E0] bg-[#FAFAF7] flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-[#36671E]" />
          <h2 className="font-black text-[#18181B] text-sm">Collection basis, per dataset</h2>
        </div>
        <div className="divide-y divide-[#F5F4EF]">
          {METHODOLOGY.map((m) => (
            <div key={m.table} className="px-5 py-4 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-black text-[#18181B]">{m.dataset}</p>
                <p className="text-xs text-[#71717A] mt-1 leading-relaxed">{m.basis}</p>
              </div>
              <a
                href={m.export}
                className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#36671E] text-white text-xs font-bold hover:bg-[#295115] transition-colors"
              >
                <Download className="w-3.5 h-3.5" /> CSV
              </a>
            </div>
          ))}
        </div>
      </div>

      <a
        href="/api/admin/data-room/methodology"
        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#E8E6E0] text-[#52525B] text-sm font-bold hover:bg-[#F5F4EF] transition-colors"
      >
        <FileText className="w-4 h-4" /> Download methodology.txt
      </a>
    </div>
  );
}

function Stat({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent?: boolean }) {
  return (
    <div className={`rounded-2xl border p-4 ${accent ? "bg-[#EEF5EA] border-[#36671E]/20" : "bg-white border-[#E8E6E0]"}`}>
      <p className={`text-2xl font-black ${accent ? "text-[#36671E]" : "text-[#18181B]"}`}>{value}</p>
      <p className="text-[11px] text-[#71717A] mt-0.5">{label}</p>
      {sub && <p className="text-[10px] text-[#A1A1AA] mt-0.5">{sub}</p>}
    </div>
  );
}
