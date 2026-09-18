import Link from "next/link";

/**
 * THE SPINE OF THE CONTROL PANEL.
 *
 * One long scroll is what a receipt looks like. A hosting panel looks like
 * this: a fixed set of places, always in the same order, with the one you are
 * on marked — so a client learns where their files live once and never hunts
 * for them again. Vercel, GoDaddy and every host worth the name are the same
 * shape, and a client who has seen one recognises this in a second.
 *
 * Links, not tabs. Each section is a real address the client can bookmark,
 * send to their designer, or reopen tomorrow, and the back button behaves.
 *
 * The token rides along in the query where the client arrived on an emailed
 * link. A signed-in client has a cookie and needs nothing in the URL, which is
 * why it is appended only when it exists.
 */

export type DashPage = "overview" | "website" | "files" | "domains" | "services" | "billing";

export const DASH_PAGES: DashPage[] = ["overview", "website", "files", "domains", "services", "billing"];

const LABELS: Record<DashPage, { en: string; fr: string }> = {
  overview: { en: "Overview", fr: "Vue d'ensemble" },
  website: { en: "Website", fr: "Site web" },
  files: { en: "Files", fr: "Fichiers" },
  domains: { en: "Domains", fr: "Domaines" },
  services: { en: "Services", fr: "Services" },
  billing: { en: "Billing", fr: "Facturation" },
};

/** Small glyphs, drawn rather than imported, so the nav costs no extra bytes. */
function Glyph({ page }: { page: DashPage }) {
  const d: Record<DashPage, string> = {
    overview: "M3 3h7v7H3zM14 3h7v4h-7zM14 10h7v11h-7zM3 13h7v8H3z",
    website: "M3 5h18v3H3zM3 10h18v9H3z",
    files: "M3 6a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2z",
    domains: "M12 3a9 9 0 100 18 9 9 0 000-18zM3 12h18M12 3c2.5 3 2.5 15 0 18M12 3c-2.5 3-2.5 15 0 18",
    services: "M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 9.2l5.9-.9z",
    billing: "M3 6h18v12H3zM3 10h18",
  };
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.7"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d[page]} />
    </svg>
  );
}

export default function DashNav({
  active,
  lang,
  token,
  counts,
}: {
  active: DashPage;
  lang: "en" | "fr";
  token: string;
  counts?: Partial<Record<DashPage, number>>;
}) {
  const href = (p: DashPage) =>
    `/hosting/account?page=${p}${token ? `&t=${encodeURIComponent(token)}` : ""}`;

  return (
    <nav aria-label={lang === "fr" ? "Sections" : "Sections"} className="lg:w-56 shrink-0">
      {/* A scrolling row on a phone, a column on a laptop. Both keep the same
          order, so the muscle memory survives the change of device. */}
      <ul className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible -mx-5 px-5 lg:mx-0 lg:px-0 pb-1 lg:pb-0">
        {DASH_PAGES.map((p) => {
          const on = p === active;
          const n = counts?.[p];
          return (
            <li key={p} className="shrink-0">
              <Link
                href={href(p)}
                aria-current={on ? "page" : undefined}
                className={`group flex items-center gap-2.5 h-10 px-3 rounded-xl text-[14px] font-bold transition-colors ${
                  on
                    ? "bg-[#18181B] text-white"
                    : "text-[#52525B] hover:bg-white hover:text-[#18181B]"
                }`}
              >
                <span className={on ? "text-white" : "text-[#A8A8A0] group-hover:text-[#36671E]"}>
                  <Glyph page={p} />
                </span>
                <span className="whitespace-nowrap">{LABELS[p][lang]}</span>
                {typeof n === "number" && n > 0 ? (
                  <span
                    className={`ml-auto hidden lg:inline text-[11px] font-black tabular-nums px-1.5 py-0.5 rounded-md ${
                      on ? "bg-white/15 text-white" : "bg-[#EDEBE4] text-[#71717A]"
                    }`}
                  >
                    {n}
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function dashPageFrom(value: string | undefined): DashPage {
  const v = (value ?? "").toLowerCase();
  return (DASH_PAGES as string[]).includes(v) ? (v as DashPage) : "overview";
}

export function dashLabel(page: DashPage, lang: "en" | "fr"): string {
  return LABELS[page][lang];
}
