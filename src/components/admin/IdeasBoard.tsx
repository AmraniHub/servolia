"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Lightbulb, Pin, Hammer, CheckCircle2, Ban, Plus, Loader2, Trash2,
  Copy, Check, DownloadCloud,
} from "lucide-react";
import {
  BOARD_COLUMNS, IDEA_CATEGORIES, IDEA_PRIORITIES, PRIORITY_COLOR,
  buildClaudeBrief, type Idea, type IdeaStatus,
} from "@/lib/ideas";

/**
 * The founder's kanban. Cards move by button, not drag — a drag target on a
 * phone is fiddly and this board gets opened on a phone, and buttons also
 * announce themselves to a screen reader without extra work.
 *
 * The "Copy brief for Claude" button is the point of the whole page: Claude
 * works in the repo and cannot read Supabase, so a card moved to In progress
 * is invisible until it travels. That button turns the column into a pasteable
 * instruction, which is what closes the loop between "I want this" and "it's
 * built".
 */

const MOVE_ICON: Record<IdeaStatus, typeof Pin> = {
  idea: Lightbulb,
  planned: Pin,
  in_progress: Hammer,
  done: CheckCircle2,
  dropped: Ban,
};

const MOVE_LABEL: Record<IdeaStatus, string> = {
  idea: "Back to ideas",
  planned: "Plan it",
  in_progress: "Start it",
  done: "Mark done",
  dropped: "Drop it",
};

export default function IdeasBoard() {
  const [items, setItems] = useState<Idea[]>([]);
  const [loading, setLoading] = useState(true);
  const [tableMissing, setTableMissing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [showDropped, setShowDropped] = useState(false);
  const [copied, setCopied] = useState(false);
  const [draft, setDraft] = useState({
    title: "", description: "", needs: "", category: "feature", priority: "medium",
  });

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/ideas");
      const d = await res.json();
      if (!res.ok) { setError(d.error ?? "Couldn't load the board."); return; }
      setItems(d.items ?? []);
      setTableMissing(!!d.tableMissing);
    } catch {
      setError("Network error — try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function create() {
    if (draft.title.trim().length < 3) { setError("Give it a title (3 characters minimum)."); return; }
    setBusy("new"); setError("");
    try {
      const res = await fetch("/api/admin/ideas", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const d = await res.json();
      if (!res.ok) { setError(d.error ?? "Couldn't save."); return; }
      setDraft({ title: "", description: "", needs: "", category: "feature", priority: "medium" });
      setShowForm(false);
      await load();
    } finally { setBusy(null); }
  }

  async function patch(id: string, fields: Record<string, unknown>) {
    setBusy(id); setError("");
    // Optimistic — moving a card should feel instant.
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...fields } as Idea : i)));
    try {
      const res = await fetch("/api/admin/ideas", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...fields }),
      });
      if (!res.ok) { setError("Couldn't save that move."); await load(); }
    } catch {
      setError("Network error."); await load();
    } finally { setBusy(null); }
  }

  async function remove(item: Idea) {
    if (!confirm(`Delete "${item.title}"? This can't be undone — use Drop if you might want it later.`)) return;
    setBusy(item.id);
    try {
      const res = await fetch("/api/admin/ideas", {
        method: "DELETE", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id }),
      });
      if (res.ok) setItems((prev) => prev.filter((i) => i.id !== item.id));
    } finally { setBusy(null); }
  }

  async function seed() {
    setBusy("seed"); setError("");
    try {
      const res = await fetch("/api/admin/ideas", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seed: true }),
      });
      const d = await res.json();
      if (!res.ok) setError(d.error ?? "Import failed.");
      else await load();
    } finally { setBusy(null); }
  }

  async function copyBrief() {
    try {
      await navigator.clipboard.writeText(buildClaudeBrief(items));
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setError("Couldn't reach the clipboard — select the In progress cards manually.");
    }
  }

  const inProgress = items.filter((i) => i.status === "in_progress").length;
  const dropped = items.filter((i) => i.status === "dropped");

  if (loading) {
    return <div className="flex items-center gap-2 text-sm text-[#71717A]"><Loader2 className="w-4 h-4 animate-spin" /> Loading the board…</div>;
  }

  if (tableMissing) {
    return (
      <div className="bg-white border border-[#E8E6E0] rounded-2xl p-8 max-w-2xl">
        <p className="text-sm font-black text-[#18181B] mb-2">The board has nowhere to store cards yet</p>
        <p className="text-sm text-[#71717A] leading-relaxed">
          Run <code className="px-1.5 py-0.5 rounded bg-[#FAFAF7] text-[#3F3F46]">supabase/pending-migration.sql</code> in
          the Supabase SQL editor — section 6 creates the <code className="px-1.5 py-0.5 rounded bg-[#FAFAF7] text-[#3F3F46]">ideas</code> table.
          Everything else on this page works the moment it exists.
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2 mb-5">
        <button onClick={() => setShowForm((v) => !v)}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#36671E] text-[#FAFAF7] text-sm font-black hover:bg-[#295115] transition-colors">
          <Plus className="w-4 h-4" /> New idea
        </button>

        <button onClick={copyBrief} disabled={inProgress === 0}
          title={inProgress === 0 ? "Move a card to In progress first" : "Copy the In progress column as a brief"}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-[#E8E6E0] bg-white text-sm font-bold text-[#18181B] hover:border-[#36671E] hover:text-[#36671E] transition-colors disabled:opacity-40 disabled:hover:border-[#E8E6E0] disabled:hover:text-[#18181B]">
          {copied ? <><Check className="w-4 h-4 text-[#059669]" /> Copied — paste it to Claude</> : <><Copy className="w-4 h-4" /> Copy brief for Claude ({inProgress})</>}
        </button>

        {items.length === 0 && (
          <button onClick={seed} disabled={busy === "seed"}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-[#E8E6E0] bg-white text-sm font-bold text-[#18181B] hover:border-[#36671E] transition-colors disabled:opacity-50">
            {busy === "seed" ? <Loader2 className="w-4 h-4 animate-spin" /> : <DownloadCloud className="w-4 h-4" />}
            Import everything from the roadmap
          </button>
        )}

        {dropped.length > 0 && (
          <button onClick={() => setShowDropped((v) => !v)}
            className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-bold text-[#71717A] hover:text-[#18181B] transition-colors">
            <Ban className="w-4 h-4" /> {showDropped ? "Hide" : "Show"} dropped ({dropped.length})
          </button>
        )}
      </div>

      {error && <p className="text-sm font-semibold text-[#B91C1C] mb-4">{error}</p>}

      {/* New idea form */}
      {showForm && (
        <div className="bg-white border border-[#E8E6E0] rounded-2xl p-5 mb-6 max-w-2xl">
          <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            placeholder="What's the idea?" aria-label="Idea title"
            className="w-full px-3.5 py-2.5 rounded-xl border border-[#E8E6E0] text-sm text-[#18181B] focus:outline-none focus:border-[#36671E] mb-3" />
          <textarea value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            placeholder="What it does and why — enough detail that Claude could build it without asking." rows={3} aria-label="Description"
            className="w-full px-3.5 py-2.5 rounded-xl border border-[#E8E6E0] text-sm text-[#18181B] focus:outline-none focus:border-[#36671E] mb-3 resize-y" />
          <input value={draft.needs} onChange={(e) => setDraft({ ...draft, needs: e.target.value })}
            placeholder="Waiting on anything? (an account, a key, a decision)" aria-label="Blocked on"
            className="w-full px-3.5 py-2.5 rounded-xl border border-[#E8E6E0] text-sm text-[#18181B] focus:outline-none focus:border-[#36671E] mb-3" />
          <div className="flex flex-wrap gap-3 mb-4">
            <select value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })}
              aria-label="Category" className="px-3 py-2 rounded-xl border border-[#E8E6E0] text-sm text-[#18181B] bg-white">
              {IDEA_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={draft.priority} onChange={(e) => setDraft({ ...draft, priority: e.target.value })}
              aria-label="Priority" className="px-3 py-2 rounded-xl border border-[#E8E6E0] text-sm text-[#18181B] bg-white">
              {IDEA_PRIORITIES.map((p) => <option key={p} value={p}>{p} priority</option>)}
            </select>
          </div>
          <button onClick={create} disabled={busy === "new"}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#36671E] text-[#FAFAF7] text-sm font-black hover:bg-[#295115] disabled:opacity-50">
            {busy === "new" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Add to board
          </button>
        </div>
      )}

      {/* Columns */}
      <div className="grid gap-4 lg:grid-cols-4 sm:grid-cols-2">
        {BOARD_COLUMNS.map((col) => {
          const cards = items.filter((i) => i.status === col.key);
          return (
            <div key={col.key} className="min-w-0">
              <div className="flex items-center justify-between gap-2 pb-2 mb-3 border-b-2"
                style={{ borderColor: col.key === "in_progress" ? "#F59E0B" : "#E8E6E0" }}>
                <div>
                  <p className="text-sm font-black text-[#18181B]">{col.label}</p>
                  <p className="text-[10px] text-[#A1A1AA]">{col.hint}</p>
                </div>
                <span className="text-sm font-black text-[#71717A] tabular-nums">{cards.length}</span>
              </div>
              <div className="space-y-3">
                {cards.length === 0 && <p className="text-xs text-[#A1A1AA] py-4 text-center">—</p>}
                {cards.map((item) => (
                  <Card key={item.id} item={item} busy={busy === item.id}
                    onMove={(s) => patch(item.id, { status: s })} onDelete={() => remove(item)} />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Dropped */}
      {showDropped && dropped.length > 0 && (
        <div className="mt-8">
          <p className="text-sm font-black text-[#18181B] mb-3">Dropped</p>
          <div className="grid gap-3 lg:grid-cols-4 sm:grid-cols-2">
            {dropped.map((item) => (
              <Card key={item.id} item={item} busy={busy === item.id}
                onMove={(s) => patch(item.id, { status: s })} onDelete={() => remove(item)} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Card({
  item, busy, onMove, onDelete,
}: {
  item: Idea; busy: boolean; onMove: (s: IdeaStatus) => void; onDelete: () => void;
}) {
  // Every destination except where the card already is.
  const targets = (["idea", "planned", "in_progress", "done", "dropped"] as IdeaStatus[])
    .filter((s) => s !== item.status);

  return (
    <div className={`bg-white border rounded-2xl p-4 transition-opacity ${busy ? "opacity-50" : ""} ${
      item.status === "in_progress" ? "border-[#F59E0B]/50" : "border-[#E8E6E0]"
    }`}>
      <div className="flex items-start gap-2 mb-1.5">
        <span className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ background: PRIORITY_COLOR[item.priority] }}
          title={`${item.priority} priority`} />
        <p className="text-sm font-black text-[#18181B] leading-snug">{item.title}</p>
      </div>

      {item.description && (
        <p className="text-xs text-[#52525B] leading-relaxed mb-2 line-clamp-6">{item.description}</p>
      )}
      {item.needs && (
        <p className="text-[11px] text-[#92400E] bg-[#FFFBEB] border border-[#FDE68A] rounded-lg px-2 py-1.5 mb-2">
          Waiting on: {item.needs}
        </p>
      )}

      <div className="flex items-center gap-1.5 flex-wrap mb-3">
        <span className="text-[10px] font-bold text-[#71717A] bg-[#F5F4EF] px-2 py-0.5 rounded-full">{item.category}</span>
        {item.source === "roadmap" && (
          <span className="text-[10px] font-bold text-[#5B21B6] bg-[#EDE9FE] px-2 py-0.5 rounded-full">roadmap</span>
        )}
      </div>

      <div className="flex items-center gap-1 pt-2 border-t border-[#F5F4EF]">
        {targets.map((s) => {
          const Icon = MOVE_ICON[s];
          return (
            <button key={s} onClick={() => onMove(s)} disabled={busy} title={MOVE_LABEL[s]} aria-label={MOVE_LABEL[s]}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-[#A1A1AA] hover:bg-[#FAFAF7] hover:text-[#36671E] transition-colors disabled:opacity-40">
              <Icon className="w-3.5 h-3.5" />
            </button>
          );
        })}
        <span className="flex-1" />
        <button onClick={onDelete} disabled={busy} title="Delete permanently" aria-label="Delete permanently"
          className="w-7 h-7 rounded-lg flex items-center justify-center text-[#A1A1AA] hover:bg-[#FEF2F2] hover:text-[#B91C1C] transition-colors disabled:opacity-40">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
