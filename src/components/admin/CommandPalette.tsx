"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Search, LayoutDashboard, Users, Hammer, UserCircle, MessageSquare,
  BarChart3, TrendingUp, Settings, Plus, ArrowRight, CornerDownLeft,
  Kanban, Loader2,
} from "lucide-react";

interface SearchResult {
  type: "lead" | "build" | "client";
  id: string;
  title: string;
  subtitle: string;
  href: string;
}

interface Command {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  keywords?: string;
}

const COMMANDS: Command[] = [
  { id: "dashboard", label: "Go to Dashboard", icon: LayoutDashboard, href: "/admin", keywords: "home overview" },
  { id: "leads", label: "Go to Leads", icon: Users, href: "/admin/leads", keywords: "contacts prospects" },
  { id: "pipeline", label: "Go to Pipeline board", icon: Kanban, href: "/admin/pipeline", keywords: "kanban stages drag" },
  { id: "builds", label: "Go to Builds", icon: Hammer, href: "/admin/builds", keywords: "projects work" },
  { id: "clients", label: "Go to Clients", icon: UserCircle, href: "/admin/clients", keywords: "customers subscriptions" },
  { id: "chat", label: "Go to Chat inbox", icon: MessageSquare, href: "/admin/chat", keywords: "messages solia conversations" },
  { id: "analytics", label: "Go to Analytics", icon: BarChart3, href: "/admin/analytics", keywords: "stats charts reports" },
  { id: "revenue", label: "Go to Revenue", icon: TrendingUp, href: "/admin/revenue", keywords: "money mrr arr income" },
  { id: "settings", label: "Go to Settings", icon: Settings, href: "/admin/settings", keywords: "config preferences" },
  { id: "new-lead", label: "Create new lead", icon: Plus, href: "/admin/leads/new", keywords: "add create lead" },
];

const TYPE_ICON = { lead: Users, build: Hammer, client: UserCircle } as const;
const TYPE_LABEL = { lead: "Lead", build: "Build", client: "Client" } as const;

export default function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Toggle with ⌘K / Ctrl+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(o => !o);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Focus input + reset when opening
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 30);
    } else {
      setQuery("");
      setResults([]);
      setActive(0);
    }
  }, [open]);

  // Debounced server search
  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    if (query.trim().length < 1) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    debounce.current = setTimeout(async () => {
      try {
        const r = await fetch(`/api/admin/search?q=${encodeURIComponent(query)}`);
        const d = await r.json();
        setResults(d.results ?? []);
      } catch {
        setResults([]);
      }
      setLoading(false);
    }, 200);
    return () => { if (debounce.current) clearTimeout(debounce.current); };
  }, [query]);

  const filteredCommands = query.trim()
    ? COMMANDS.filter(c =>
        c.label.toLowerCase().includes(query.toLowerCase()) ||
        c.keywords?.toLowerCase().includes(query.toLowerCase()))
    : COMMANDS;

  // Flattened nav targets for keyboard selection: results first, then commands
  const flat = [
    ...results.map(r => ({ kind: "result" as const, href: r.href })),
    ...filteredCommands.map(c => ({ kind: "command" as const, href: c.href })),
  ];

  const go = useCallback((href: string) => {
    setOpen(false);
    router.push(href);
  }, [router]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive(a => Math.min(a + 1, flat.length - 1)); }
    if (e.key === "ArrowUp") { e.preventDefault(); setActive(a => Math.max(a - 1, 0)); }
    if (e.key === "Enter") { e.preventDefault(); if (flat[active]) go(flat[active].href); }
  };

  if (!open) return null;

  let idx = -1;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[12vh] px-4 bg-[#18181B]/30 backdrop-blur-sm"
      onClick={() => setOpen(false)}>
      <div
        className="w-full max-w-xl bg-white rounded-2xl shadow-elevated border border-[#E8E6E0] overflow-hidden animate-fade-in-up"
        onClick={(e) => e.stopPropagation()}>

        {/* Search input */}
        <div className="flex items-center gap-3 px-4 border-b border-[#E8E6E0]">
          {loading
            ? <Loader2 className="w-5 h-5 text-[#36671E] animate-spin shrink-0" />
            : <Search className="w-5 h-5 text-[#A1A1AA] shrink-0" />}
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setActive(0); }}
            onKeyDown={onKeyDown}
            placeholder="Search leads, clients, or jump to…"
            className="flex-1 py-4 text-[15px] text-[#18181B] bg-transparent focus:outline-none placeholder:text-[#A1A1AA]"
          />
          <kbd className="text-[10px] font-bold text-[#A1A1AA] bg-[#F5F4EF] border border-[#E8E6E0] rounded px-1.5 py-0.5 shrink-0">ESC</kbd>
        </div>

        <div className="max-h-[55vh] overflow-y-auto py-2">
          {/* Search results */}
          {results.length > 0 && (
            <div className="px-2 pb-1">
              <p className="text-[10px] font-black text-[#A1A1AA] uppercase tracking-widest px-3 py-1.5">Results</p>
              {results.map((r) => {
                idx++;
                const Icon = TYPE_ICON[r.type];
                const isActive = idx === active;
                return (
                  <button key={`${r.type}-${r.id}`} onClick={() => go(r.href)}
                    onMouseEnter={() => setActive(idx)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${isActive ? "bg-[#EEF5EA]" : "hover:bg-[#F5F4EF]"}`}>
                    <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isActive ? "bg-[#36671E] text-white" : "bg-[#F5F4EF] text-[#71717A]"}`}>
                      <Icon className="w-4 h-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-[#18181B] truncate">{r.title}</span>
                      {r.subtitle && <span className="block text-xs text-[#71717A] truncate">{r.subtitle}</span>}
                    </span>
                    <span className="text-[10px] font-bold text-[#A1A1AA] uppercase shrink-0">{TYPE_LABEL[r.type]}</span>
                    {isActive && <CornerDownLeft className="w-3.5 h-3.5 text-[#36671E] shrink-0" />}
                  </button>
                );
              })}
            </div>
          )}

          {/* Commands / navigation */}
          {filteredCommands.length > 0 && (
            <div className="px-2">
              <p className="text-[10px] font-black text-[#A1A1AA] uppercase tracking-widest px-3 py-1.5">
                {query.trim() ? "Actions" : "Jump to"}
              </p>
              {filteredCommands.map((c) => {
                idx++;
                const isActive = idx === active;
                const Icon = c.icon;
                return (
                  <button key={c.id} onClick={() => go(c.href)}
                    onMouseEnter={() => setActive(idx)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${isActive ? "bg-[#EEF5EA]" : "hover:bg-[#F5F4EF]"}`}>
                    <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isActive ? "bg-[#36671E] text-white" : "bg-[#F5F4EF] text-[#71717A]"}`}>
                      <Icon className="w-4 h-4" />
                    </span>
                    <span className="flex-1 text-sm font-medium text-[#18181B]">{c.label}</span>
                    {isActive
                      ? <CornerDownLeft className="w-3.5 h-3.5 text-[#36671E] shrink-0" />
                      : <ArrowRight className="w-3.5 h-3.5 text-[#D4D2CC] shrink-0" />}
                  </button>
                );
              })}
            </div>
          )}

          {/* Empty state */}
          {query.trim() && !loading && results.length === 0 && filteredCommands.length === 0 && (
            <p className="text-center text-sm text-[#A1A1AA] py-10">No results for &ldquo;{query}&rdquo;</p>
          )}
        </div>

        {/* Footer hint */}
        <div className="flex items-center gap-4 px-4 py-2.5 border-t border-[#E8E6E0] bg-[#FAFAF7] text-[10px] text-[#A1A1AA]">
          <span className="flex items-center gap-1"><kbd className="bg-white border border-[#E8E6E0] rounded px-1">↑</kbd><kbd className="bg-white border border-[#E8E6E0] rounded px-1">↓</kbd> navigate</span>
          <span className="flex items-center gap-1"><kbd className="bg-white border border-[#E8E6E0] rounded px-1">↵</kbd> open</span>
          <span className="flex items-center gap-1 ml-auto"><kbd className="bg-white border border-[#E8E6E0] rounded px-1">⌘</kbd><kbd className="bg-white border border-[#E8E6E0] rounded px-1">K</kbd> toggle</span>
        </div>
      </div>
    </div>
  );
}
