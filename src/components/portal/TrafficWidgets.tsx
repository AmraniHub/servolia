/**
 * Presentational widgets for the portal Visitors tab, extracted from
 * PortalDashboard.tsx. Pure render — no hooks, no fetching.
 */


export function PStat({ icon, label, value, sub, accent }: {
  icon: React.ReactNode; label: string; value: number; sub?: string; accent?: boolean;
}) {
  return (
    <div className={`p-4 rounded-2xl border ${accent ? "border-[var(--p-accent)]/40 bg-[var(--p-accent)]/10" : "border-[var(--p-border)] bg-[var(--p-card)]"}`}>
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--p-muted)]">{label}</p>
        <span className={accent ? "text-[var(--p-accent)]" : "text-[var(--p-faint)]"}>{icon}</span>
      </div>
      <p className={`text-xl font-black mt-1 ${accent ? "text-[var(--p-accent)]" : "text-[var(--p-text)]"}`}>{value.toLocaleString()}</p>
      {sub && <p className="text-[10px] text-[var(--p-faint)] mt-0.5">{sub}</p>}
    </div>
  );
}

export function PPanel({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="bg-[var(--p-card)] border border-[var(--p-border)] rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-[var(--p-accent)]">{icon}</span>
        <h3 className="text-sm font-black text-[var(--p-text)]">{title}</h3>
      </div>
      {children}
    </div>
  );
}

export function PBars({ rows, total, accent, mono }: {
  rows: [string, number][]; total: number; accent?: boolean; mono?: boolean;
}) {
  if (rows.length === 0) return <p className="text-sm text-[var(--p-faint)] py-6 text-center">—</p>;
  const max = Math.max(...rows.map((r) => r[1]), 1);
  return (
    <div className="space-y-2.5 mt-3">
      {rows.map(([label, n]) => (
        <div key={label}>
          <div className="flex items-center justify-between text-xs mb-1 gap-3">
            <span className={`font-semibold text-[var(--p-text)] truncate ${mono ? "font-mono text-[11px]" : "capitalize"}`}>{label}</span>
            <span className="text-[var(--p-muted)] shrink-0">
              {n}{total > 0 && <span className="text-[var(--p-faint)]"> · {Math.round((n / total) * 100)}%</span>}
            </span>
          </div>
          <div className="h-2 rounded-full bg-[var(--p-raised)]">
            <div className={`h-full rounded-full ${accent ? "bg-[#BEF264]" : "bg-[var(--p-accent)]"}`}
              style={{ width: `${(n / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function PChart({ days }: { days: { label: string; views: number; visitors: number }[] }) {
  const max = Math.max(...days.map((d) => d.visitors), 1);
  const step = days.length > 45 ? 7 : days.length > 14 ? 3 : 1;
  return (
    <div className="flex items-end justify-between gap-[2px] h-36">
      {days.map((d, i) => (
        <div key={d.label + i} className="flex-1 flex flex-col items-center gap-1 group min-w-0">
          <span className="text-[10px] font-bold text-[var(--p-accent)] opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
            {d.visitors}
          </span>
          <div className="w-full rounded-t-sm bg-[var(--p-accent)] transition-all min-h-[2px] hover:opacity-75"
            style={{ height: `${Math.max((d.visitors / max) * 100, 2)}%` }} />
          <span className="text-[8px] text-[var(--p-faint)] whitespace-nowrap">{i % step === 0 ? d.label : ""}</span>
        </div>
      ))}
    </div>
  );
}
