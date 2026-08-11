import { ROADMAP, type RoadmapItem } from "@/lib/roadmap";

/**
 * IDEAS BOARD — the founder's kanban of everything discussed but not built.
 *
 * Why this exists alongside roadmap.ts: that file is CODE. It is the honest
 * record of what shipped and what's blocked, and only I can edit it. This
 * board is DATA — the founder moves a card to "In progress" themselves, with
 * no commit, and that becomes the instruction for what to build next.
 *
 * The two are deliberately linked rather than duplicated: `seedFromRoadmap()`
 * imports the outstanding roadmap items once, so nothing already tracked has
 * to be retyped, and `externalKey` stops a second import creating duplicates.
 *
 * THE PART THAT MAKES IT WORK: I cannot read the founder's database. A card
 * moved to "In progress" is invisible to me unless it is handed over. So the
 * board can render its in-progress column as a plain-text brief the founder
 * copies into a message — see buildClaudeBrief(). Without that this is a
 * pretty board that changes nothing about how work actually reaches me.
 */

export const IDEA_STATUSES = ["idea", "planned", "in_progress", "done", "dropped"] as const;
export type IdeaStatus = (typeof IDEA_STATUSES)[number];

export const IDEA_PRIORITIES = ["low", "medium", "high"] as const;
export type IdeaPriority = (typeof IDEA_PRIORITIES)[number];

export const IDEA_CATEGORIES = ["feature", "integration", "content", "ops", "growth", "legal"] as const;
export type IdeaCategory = (typeof IDEA_CATEGORIES)[number];

export interface Idea {
  id: string;
  created_at: string;
  updated_at: string;
  title: string;
  description: string | null;
  category: IdeaCategory;
  status: IdeaStatus;
  priority: IdeaPriority;
  /** "roadmap" for imported items, "founder" for ones typed on the board. */
  source: string;
  /** What it's waiting on — an account, a key, a decision. */
  needs: string | null;
  notes: string | null;
  sort_order: number;
  /** Set only on cards imported from roadmap.ts (`roadmap:<slug>`); null for
   *  hand-typed ones. Links a card back to its roadmap item so the board can
   *  drop it once that item is marked done in code. */
  external_key?: string | null;
}

/** Columns shown on the board, in order. `dropped` is hidden behind a toggle. */
export const BOARD_COLUMNS: { key: IdeaStatus; label: string; hint: string }[] = [
  { key: "idea", label: "Idea", hint: "Raised, not committed to" },
  { key: "planned", label: "Planned", hint: "Decided — waiting for a slot" },
  { key: "in_progress", label: "In progress", hint: "Hand this to Claude" },
  // Drop a card here to archive it: the row is kept, but the board stops
  // showing it, so shipped work can never be picked up a second time.
  { key: "done", label: "Done", hint: "Shipped — leaves the board" },
];

export const STATUS_COLOR: Record<IdeaStatus, string> = {
  idea: "#94A3B8",
  planned: "#8B5CF6",
  in_progress: "#F59E0B",
  done: "#059669",
  dropped: "#B91C1C",
};

export const PRIORITY_COLOR: Record<IdeaPriority, string> = {
  high: "#B91C1C",
  medium: "#D97706",
  low: "#71717A",
};

/* ─────────────────────── roadmap.ts → board rows ─────────────────────── */

/** Stable key per roadmap item so re-importing can never duplicate a card. */
export function roadmapKey(item: RoadmapItem): string {
  return `roadmap:${item.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 80)}`;
}

/** Map a roadmap priority (1–3) onto the board's three levels. */
function toPriority(p: 1 | 2 | 3): IdeaPriority {
  return p === 1 ? "high" : p === 2 ? "medium" : "low";
}

/** Roadmap statuses don't map 1:1 — "blocked" is a real thing there. */
function toStatus(s: RoadmapItem["status"]): IdeaStatus {
  if (s === "done") return "done";
  if (s === "in_progress") return "in_progress";
  // "blocked" is planned work waiting on something external, not a new idea.
  if (s === "blocked") return "planned";
  return "idea";
}

/**
 * Best-guess category, from the TITLE only. Matching the detail text as well
 * looked smarter and was worse: nearly every detail mentions the CGV or a
 * price, so two thirds of the board came back "legal" or "growth". The title
 * is what the founder actually scans, so it's also the honest thing to sort by.
 */
function guessCategory(item: RoadmapItem): IdeaCategory {
  const t = item.title.toLowerCase();
  if (/lawyer|cgv|legal|gdpr|dpa|compérage|comperage/.test(t)) return "legal";
  if (/stripe|twilio|cloudflare|linkedin|google|resend|api key|oauth|workspace/.test(t)) return "integration";
  if (/blog|content|seo|case stud|review|testimonial/.test(t)) return "content";
  if (/sql|cron|secret|env|key|verify|enable|run /.test(t)) return "ops";
  if (/client|pricing|outbound|prospect|financ|white-label|data-room/.test(t)) return "growth";
  return "feature";
}

export interface SeedRow {
  external_key: string;
  title: string;
  description: string | null;
  category: IdeaCategory;
  status: IdeaStatus;
  priority: IdeaPriority;
  source: string;
  needs: string | null;
}

/**
 * Every roadmap item as a board row. Includes DONE items so the board reflects
 * reality on first load — a Done column that starts empty makes it look like
 * nothing has ever shipped, which is both wrong and demoralising.
 */
/** Keys of every roadmap item that has since been marked done in code.
 *  The board hides these: work that shipped must stop appearing as work, or
 *  it eventually gets done twice. roadmap.ts is the source of truth for
 *  completion — a card imported from it dies when its roadmap item dies. */
export function completedRoadmapKeys(): Set<string> {
  return new Set(ROADMAP.filter((i) => i.status === "done").map(roadmapKey));
}

export function seedFromRoadmap(): SeedRow[] {
  // Only outstanding work is importable — seeding done items would recreate
  // the very cards the board is meant to clear.
  return ROADMAP.filter((item) => item.status !== "done").map((item) => ({
    external_key: roadmapKey(item),
    title: item.title,
    description: item.detail ?? null,
    category: guessCategory(item),
    status: toStatus(item.status),
    priority: toPriority(item.priority),
    source: "roadmap",
    needs: item.needs ?? null,
  }));
}

/* ────────────────────────── hand-off to Claude ────────────────────────── */

/**
 * Render the in-progress column as a brief the founder can paste to Claude.
 *
 * This is the bridge across the gap that would otherwise make the board
 * decorative: Claude works in the repo and cannot see Supabase, so moving a
 * card only means something if the card can travel. Ordered by priority so
 * the first line is the most important thing.
 */
export function buildClaudeBrief(ideas: Idea[]): string {
  const rank: Record<IdeaPriority, number> = { high: 0, medium: 1, low: 2 };
  const active = ideas
    .filter((i) => i.status === "in_progress")
    .sort((a, b) => rank[a.priority] - rank[b.priority]);

  if (!active.length) {
    return "Nothing is in progress. Move a card to the In progress column first.";
  }

  const lines = active.map((i, n) => {
    const parts = [`${n + 1}. ${i.title}  [${i.priority} · ${i.category}]`];
    if (i.description) parts.push(`   ${i.description.replace(/\s+/g, " ").trim()}`);
    if (i.needs) parts.push(`   Waiting on: ${i.needs}`);
    if (i.notes) parts.push(`   Note: ${i.notes.replace(/\s+/g, " ").trim()}`);
    return parts.join("\n");
  });

  return [
    `Work these ${active.length} item${active.length === 1 ? "" : "s"} from the Servolia ideas board, in order:`,
    "",
    ...lines,
    "",
    "For each: build it properly, verify it, and tell me which ones you finished so I can move the cards to Done.",
  ].join("\n");
}
