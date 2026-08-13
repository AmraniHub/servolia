"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Section nav for /admin/settings.
 *
 * The page used to be one 218-line scroll: alerts, 2FA, costs, secrets and the
 * roadmap stacked end to end. The roadmap is the part actually read daily and
 * it sat at the bottom. These are real routes, not client-side tabs, so each
 * section is a link you can bookmark and point at from docs.
 *
 * Badges carry the number that decides whether a tab is worth opening —
 * computed once in _data.ts, so a badge can't disagree with its page.
 */

export type SettingsTab = {
  label: string;
  href: string;
  badge?: number;
  /** Red badge = something is wrong. Otherwise it's just a count. */
  alert?: boolean;
};

export default function SettingsTabs({ tabs }: { tabs: SettingsTab[] }) {
  const pathname = usePathname();

  return (
    <div className="border-b border-[#E8E6E0] mb-6 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8">
      <nav className="flex gap-1 overflow-x-auto" aria-label="Settings sections">
        {tabs.map((t) => {
          // Exact match for the overview, prefix match for the rest — otherwise
          // /admin/settings would light up on every sub-page.
          const active = t.href === "/admin/settings" ? pathname === t.href : pathname.startsWith(t.href);
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={active ? "page" : undefined}
              className={`relative flex items-center gap-2 px-3.5 py-2.5 text-sm whitespace-nowrap border-b-2 transition-colors ${
                active
                  ? "border-[#36671E] text-[#36671E] font-bold"
                  : "border-transparent text-[#71717A] hover:text-[#18181B] font-semibold"
              }`}
            >
              {t.label}
              {t.badge !== undefined && t.badge > 0 && (
                <span
                  className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${
                    t.alert ? "bg-[#FEE2E2] text-[#B91C1C]" : "bg-[#F5F4EF] text-[#52525B]"
                  }`}
                >
                  {t.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
