"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, Users, Hammer, UserCircle, MessageSquare,
  TrendingUp, Settings, LogOut, Menu, X, BarChart3, Kanban, Search, Globe, Sparkles, RefreshCcw, Wand2, CalendarClock, Target, Star, Bot, Sun, Moon,
} from "lucide-react";
import CommandPalette from "./CommandPalette";
import AutoRefresh from "@/components/AutoRefresh";
import Copilot from "./Copilot";

const nav = [
  { label: "Dashboard",   href: "/admin",           icon: LayoutDashboard },
  { label: "Leads",       href: "/admin/leads",     icon: Users },
  { label: "Pipeline",    href: "/admin/pipeline",  icon: Kanban },
  { label: "Prospects",   href: "/admin/prospects", icon: Target },
  { label: "Calls",       href: "/admin/bookings",  icon: CalendarClock },
  { label: "Builds",      href: "/admin/builds",    icon: Hammer },
  { label: "Client Sites", href: "/admin/sites",    icon: Globe },
  { label: "Demo Generator", href: "/admin/demo",  icon: Wand2 },
  { label: "Clients",     href: "/admin/clients",   icon: UserCircle },
  { label: "Messages",    href: "/admin/messages",  icon: MessageSquare },
  { label: "Chat inbox",  href: "/admin/chat",      icon: Bot },
  { label: "Campaigns",   href: "/admin/reactivation", icon: RefreshCcw },
  { label: "Case Studies", href: "/admin/case-studies", icon: Star },
  { label: "Content Engine", href: "/admin/content", icon: Sparkles },
  { label: "Analytics",   href: "/admin/analytics", icon: BarChart3 },
  { label: "Revenue",     href: "/admin/revenue",   icon: TrendingUp },
  { label: "Settings",    href: "/admin/settings",  icon: Settings },
];

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMac, setIsMac] = useState(true);
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    setIsMac(/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent));
    const saved = localStorage.getItem("servolia_admin_theme");
    if (saved === "dark" || saved === "light") setTheme(saved);
  }, []);

  const toggleTheme = () => setTheme((t) => {
    const next = t === "light" ? "dark" : "light";
    localStorage.setItem("servolia_admin_theme", next);
    return next;
  });

  const openPalette = () => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true, ctrlKey: true }));
  };

  const handleLogout = async () => {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
  };

  return (
    <div data-admin-theme={theme} className="min-h-screen bg-[#FAFAF7] flex transition-colors">
      <CommandPalette />
      <AutoRefresh />
      <Copilot />

      {/* === SIDEBAR (desktop) === */}
      <aside className="hidden lg:flex w-60 bg-white border-r border-[#E8E6E0] flex-col fixed inset-y-0 left-0 z-30">
        <div className="px-5 py-5 border-b border-[#E8E6E0]">
          <Link href="/admin" className="flex items-center">
            <span className="text-base font-black tracking-tight text-[#18181B]">
              Servolia <span className="text-[#36671E]">CRM</span>
            </span>
          </Link>
        </div>

        {/* Search trigger */}
        <div className="px-3 pt-3">
          <button onClick={openPalette}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-[#E8E6E0] bg-[#FAFAF7] text-[#A1A1AA] hover:border-[#36671E]/30 hover:text-[#71717A] transition-colors text-sm">
            <Search className="w-4 h-4" />
            <span className="flex-1 text-left">Search…</span>
            <kbd className="text-[10px] font-bold bg-white border border-[#E8E6E0] rounded px-1.5 py-0.5">{isMac ? "⌘" : "Ctrl"}K</kbd>
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {nav.map((item) => {
            const active = item.href === "/admin"
              ? pathname === "/admin"
              : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                  active
                    ? "bg-[#EEF5EA] text-[#36671E] font-semibold"
                    : "text-[#52525B] hover:bg-[#F5F4EF] hover:text-[#18181B]"
                }`}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-[#E8E6E0]">
          <div className="flex items-center gap-2 px-3 py-2 mb-1">
            <div className="w-8 h-8 rounded-full bg-[#36671E] flex items-center justify-center text-[#FAFAF7] text-xs font-black">
              A
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-[#18181B] truncate">Founder</p>
              <p className="text-xs text-[#71717A] truncate">Servolia</p>
            </div>
            <button onClick={toggleTheme} aria-label="Toggle theme"
              className="w-8 h-8 rounded-lg border border-[#E8E6E0] flex items-center justify-center text-[#71717A] hover:text-[#18181B] hover:bg-[#F5F4EF] transition-colors">
              {theme === "light" ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            </button>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-[#71717A] hover:bg-[#F5F4EF] hover:text-[#DC2626] transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>
      </aside>

      {/* === MOBILE TOPBAR === */}
      <div className="lg:hidden fixed top-0 inset-x-0 bg-white border-b border-[#E8E6E0] z-30 h-14 flex items-center justify-between px-4">
        <Link href="/admin" className="flex items-center">
          <span className="text-sm font-black text-[#18181B]">Servolia CRM</span>
        </Link>
        <div className="flex items-center gap-1">
          <button onClick={toggleTheme} aria-label="Toggle theme" className="w-9 h-9 flex items-center justify-center text-[#71717A]">
            {theme === "light" ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
          </button>
          <button onClick={() => setMobileOpen(true)} className="text-[#18181B]">
            <Menu className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* === MOBILE DRAWER === */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-black/40" onClick={() => setMobileOpen(false)}>
          <aside className="absolute left-0 top-0 bottom-0 w-72 bg-white p-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <span className="text-base font-black text-[#18181B]">Menu</span>
              <button onClick={() => setMobileOpen(false)}><X className="w-5 h-5" /></button>
            </div>
            <nav className="space-y-1">
              {nav.map((item) => {
                const active = pathname === item.href;
                const Icon = item.icon;
                return (
                  <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm ${active ? "bg-[#EEF5EA] text-[#36671E] font-semibold" : "text-[#52525B]"}`}>
                    <Icon className="w-4 h-4" /> {item.label}
                  </Link>
                );
              })}
              <button onClick={handleLogout}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-[#DC2626]">
                <LogOut className="w-4 h-4" /> Sign out
              </button>
            </nav>
          </aside>
        </div>
      )}

      {/* === MAIN === */}
      <main className="flex-1 lg:ml-60 pt-14 lg:pt-0 min-h-screen">
        {children}
      </main>
    </div>
  );
}
