"use client";

import { useMemo, useState } from "react";
import { Copy, Check, Link2 } from "lucide-react";

/**
 * Campaign link builder — the reason campaign data ever joins up.
 *
 * The whole attribution chain depends on ONE string being identical in two
 * places: the campaign name in Ads Manager, and utm_campaign in the ad's
 * destination URL. Typed by hand twice, they drift ("tours-dentists" vs
 * "Tours Dentists"), and /admin/traffic silently splits one campaign into
 * three rows that can never be re-joined.
 *
 * So the name is generated, never remembered: pick the parts, copy both
 * fields, paste. Existing campaign names are shown as chips because reusing
 * the exact previous name is what keeps a running campaign's history in one
 * row.
 */

const SITE = "https://servolia.com";

const PLATFORMS = [
  { key: "meta", label: "Meta ads (FB/IG)", source: "meta", medium: "paid" },
  { key: "google", label: "Google Ads", source: "google", medium: "cpc" },
  { key: "linkedin", label: "LinkedIn post", source: "linkedin", medium: "social" },
  { key: "email", label: "Email / outreach", source: "email", medium: "email" },
  { key: "print", label: "Flyer / QR code", source: "print", medium: "offline" },
] as const;

const PAGES = [
  { path: "/fr/dentistes", label: "FR — Dentistes (funnel)", hint: "dent" },
  { path: "/fr/esthetique", label: "FR — Esthétique (funnel)", hint: "esth" },
  { path: "/fr/audit", label: "FR — Audit gratuit", hint: "" },
  { path: "/fr/tarifs", label: "FR — Tarifs", hint: "" },
  { path: "/fr/exemples", label: "FR — Exemples", hint: "" },
  { path: "/fr", label: "FR — Accueil", hint: "" },
  { path: "/free-audit", label: "EN — Free audit", hint: "" },
  { path: "/pricing", label: "EN — Pricing", hint: "" },
  { path: "/examples", label: "EN — Examples", hint: "" },
  { path: "/", label: "EN — Home", hint: "" },
];

/** Lowercase, accent-free, hyphenated — so "Saint-Étienne" and "saint etienne"
 *  can never become two different campaigns. */
function slug(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function CopyField({ label, value, hint }: { label: string; value: string; hint: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div>
      <p className="text-xs font-black text-[#18181B] mb-1">{label}</p>
      <div className="flex items-stretch gap-2">
        <code className="flex-1 min-w-0 rounded-xl bg-[#FAFAF7] border border-[#E8E6E0] px-3 py-2.5 text-xs text-[#18181B] font-mono break-all">
          {value}
        </code>
        <button
          type="button"
          onClick={() => {
            navigator.clipboard?.writeText(value).then(
              () => { setCopied(true); setTimeout(() => setCopied(false), 1600); },
              () => {},
            );
          }}
          className={`px-3 rounded-xl text-xs font-bold whitespace-nowrap transition-colors ${
            copied ? "bg-[#DCFCE7] text-[#166534]" : "bg-[#36671E] text-[#FAFAF7] hover:bg-[#295115]"
          }`}
        >
          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
        </button>
      </div>
      <p className="text-[11px] text-[#71717A] mt-1">{hint}</p>
    </div>
  );
}

export default function CampaignLinkBuilder({ existing = [] }: { existing?: string[] }) {
  const [platform, setPlatform] = useState<string>("meta");
  const [page, setPage] = useState<string>("/fr/dentistes");
  const [city, setCity] = useState("");
  const [angle, setAngle] = useState("");
  // A reused name is taken verbatim — re-deriving it from the parts would
  // re-apply the page prefix and produce "dent-dent-tours".
  const [reused, setReused] = useState<string | null>(null);

  const p = PLATFORMS.find((x) => x.key === platform) ?? PLATFORMS[0];
  const pageDef = PAGES.find((x) => x.path === page) ?? PAGES[0];

  const generated = useMemo(() => {
    const parts = [pageDef.hint, slug(city), slug(angle)].filter(Boolean);
    return parts.length ? parts.join("-") : slug(pageDef.label);
  }, [pageDef, city, angle]);

  const campaign = reused ?? generated;

  const url = `${SITE}${page}?utm_source=${p.source}&utm_medium=${p.medium}&utm_campaign=${campaign}`;

  const field =
    "w-full rounded-xl border border-[#E8E6E0] bg-white px-3 py-2.5 text-sm text-[#18181B] focus:border-[#36671E] focus:outline-none";

  return (
    <div className="bg-white border border-[#E8E6E0] rounded-2xl overflow-hidden">
      <div className="px-5 py-3.5 bg-[#FAFAF7] border-b border-[#F5F4EF] flex items-center gap-2">
        <Link2 className="w-4 h-4 text-[#36671E]" />
        <div>
          <p className="text-xs font-black text-[#18181B] uppercase tracking-widest">Campaign link builder</p>
          <p className="text-[11px] text-[#71717A] mt-0.5">
            Never type a campaign name twice — generate it here, paste it in both places.
          </p>
        </div>
      </div>

      <div className="p-5 space-y-4">
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-bold text-[#52525B] block mb-1">Where the ad runs</label>
            <select value={platform} onChange={(e) => setPlatform(e.target.value)} className={field}>
              {PLATFORMS.map((x) => <option key={x.key} value={x.key}>{x.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-bold text-[#52525B] block mb-1">Page it sends people to</label>
            <select value={page} onChange={(e) => setPage(e.target.value)} className={field}>
              {PAGES.map((x) => <option key={x.path} value={x.path}>{x.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-bold text-[#52525B] block mb-1">City or area <span className="font-normal text-[#A1A1AA]">(optional)</span></label>
            <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Tours" className={field} />
          </div>
          <div>
            <label className="text-xs font-bold text-[#52525B] block mb-1">Angle <span className="font-normal text-[#A1A1AA]">(optional)</span></label>
            <input value={angle} onChange={(e) => setAngle(e.target.value)} placeholder="founding" className={field} />
          </div>
        </div>

        <div className="space-y-3 pt-1">
          <CopyField
            label="1 · Campaign NAME — paste as the campaign name in Ads Manager"
            value={campaign}
            hint="Exactly this, character for character. It is what joins spend to leads."
          />
          <CopyField
            label="2 · Destination URL — paste as the ad's link"
            value={url}
            hint="Carries the same name back to Servolia, so every lead records where it came from."
          />
        </div>

        {existing.length > 0 && (
          <div className="pt-1">
            <p className="text-xs font-bold text-[#52525B] mb-2">
              Already running — click to reuse a name instead of starting a new one
            </p>
            <div className="flex flex-wrap gap-1.5">
              {existing.map((name) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => { setCity(name); setAngle(""); }}
                  title="Reuse this campaign name"
                  className="px-2.5 py-1 rounded-lg bg-[#F5F4EF] hover:bg-[#EEF5EA] border border-[#E8E6E0] text-[11px] font-mono text-[#3F3F46]"
                >
                  {name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
