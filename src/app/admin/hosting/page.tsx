import { supabaseAdmin } from "@/lib/supabase";
import { Server, ExternalLink, AlertTriangle } from "lucide-react";
import HostingCheckout from "@/components/admin/HostingCheckout";

export const dynamic = "force-dynamic";

/** Hosting is billed in USD, unlike Servolia's EUR plans. */
const usd = (n: number) => `$${Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

/**
 * Next renewal. Stripe is the authority on the real date, but storing the
 * period start and adding the interval gives an accurate-enough figure for a
 * list view without an API call per row.
 */
function nextRenewal(startedAt: string | null, period: string): string {
  if (!startedAt) return "—";
  const start = new Date(startedAt);
  if (Number.isNaN(start.getTime())) return "—";
  const next = new Date(start);
  const now = new Date();
  if (period === "annual") {
    next.setFullYear(next.getFullYear() + 1);
    while (next < now) next.setFullYear(next.getFullYear() + 1);
  } else {
    next.setMonth(next.getMonth() + 1);
    while (next < now) next.setMonth(next.getMonth() + 1);
  }
  return next.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

export default async function HostingPage() {
  const db = supabaseAdmin();
  const { data: rows, error } = db
    ? await db.from("hosting_clients").select("*").order("created_at", { ascending: false })
    : { data: [], error: null };

  const clients = rows ?? [];
  const active = clients.filter((c) => c.status === "active");
  // Annual rows already store the monthly equivalent, so this sums correctly
  // across both billing periods.
  const mrr = active.reduce((s, c) => s + Number(c.monthly_usd || 0), 0);

  // The table is missing until supabase/hosting-migration.sql is run. Say so
  // plainly rather than rendering an empty list that looks like "no clients".
  const tableMissing = !!error && /relation .* does not exist|could not find the table/i.test(error.message ?? "");

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 lg:py-8 max-w-7xl mx-auto">
      <div className="flex items-end justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-[#18181B] mb-1">Hosting</h1>
          <p className="text-sm text-[#71717A]">
            {clients.length} site{clients.length === 1 ? "" : "s"} · {usd(mrr)}/mo recurring
          </p>
        </div>
        <HostingCheckout />
      </div>

      {tableMissing ? (
        <div className="bg-white border border-[#FDE68A] rounded-2xl p-8 text-center">
          <AlertTriangle className="w-9 h-9 text-[#B45309] mx-auto mb-3" />
          <p className="text-sm font-bold text-[#92400E] mb-1">The hosting_clients table does not exist yet.</p>
          <p className="text-sm text-[#71717A]">
            Run <code className="font-mono text-xs bg-[#FAFAF7] px-1.5 py-0.5 rounded">supabase/hosting-migration.sql</code> in
            the Supabase SQL editor. It is safe to run on a live database and safe to re-run.
          </p>
        </div>
      ) : clients.length === 0 ? (
        <div className="bg-white border border-[#E8E6E0] rounded-2xl p-12 text-center">
          <Server className="w-10 h-10 text-[#A1A1AA] mx-auto mb-3" />
          <p className="text-sm text-[#71717A]">
            No hosting clients yet. Create a subscription link with{" "}
            <code className="font-mono text-xs">scripts/hosting-subscribe.mjs</code> — the row appears here once they pay.
          </p>
        </div>
      ) : (
        <div className="bg-white border border-[#E8E6E0] rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[#FAFAF7] border-b border-[#E8E6E0]">
              <tr className="text-left text-[10px] font-black text-[#71717A] uppercase tracking-widest">
                <th className="px-4 py-3">Business</th>
                <th className="px-4 py-3">Site</th>
                <th className="px-4 py-3">Plan</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Next renewal</th>
                <th className="px-4 py-3">Invoice</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => (
                <tr key={c.id} className="border-b border-[#F5F4EF] last:border-0 hover:bg-[#FAFAF7]">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-[#18181B]">{c.business}</div>
                    {c.email ? <div className="text-xs text-[#A1A1AA]">{c.email}</div> : null}
                  </td>
                  <td className="px-4 py-3">
                    {c.site_url ? (
                      <a
                        href={c.site_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[#2563EB] hover:underline"
                      >
                        {c.site_url.replace(/^https?:\/\//, "")}
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    ) : (
                      <span className="text-[#A1A1AA]">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-bold text-[#36671E]">{usd(c.monthly_usd)}</span>
                    <span className="text-[#A1A1AA]">/mo</span>
                    {c.billing_period === "annual" ? (
                      <span className="ml-1.5 text-[10px] font-black text-[#71717A] uppercase">annual</span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span
                        className={`text-xs font-bold px-2 py-1 rounded-full ${
                          c.status === "active"
                            ? "bg-[#D1FAE5] text-[#065F46]"
                            : c.status === "past_due"
                              ? "bg-[#FEF3C7] text-[#92400E]"
                              : c.status === "suspended"
                                ? "bg-[#7F1D1D] text-white"
                                : "bg-[#FEE2E2] text-[#991B1B]"
                        }`}
                      >
                        {String(c.status).toUpperCase()}
                      </span>
                      {c.payment_status?.startsWith("past_due") ? (
                        <span
                          title={c.suspend_at ? `Suspends ${new Date(c.suspend_at).toLocaleDateString()}` : "Payment failed"}
                          className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-1 rounded-full bg-[#FEE2E2] text-[#991B1B]"
                        >
                          <AlertTriangle className="w-3 h-3" />
                          PAST DUE
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[#52525B]">{nextRenewal(c.started_at, c.billing_period)}</td>
                  <td className="px-4 py-3">
                    {c.open_invoice_url ? (
                      <a
                        href={c.open_invoice_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[#B45309] font-semibold hover:underline"
                      >
                        Pay <ExternalLink className="w-3 h-3" />
                      </a>
                    ) : (
                      <span className="text-[#A1A1AA]">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
