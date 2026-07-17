"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Globe, ExternalLink, Sparkles, Loader2, Eye, EyeOff } from "lucide-react";

export interface SiteRow {
  slug: string;
  businessName: string;
  niche: string;
  status: string;
  serviceCount: number;
}

export interface GeneratableBuild {
  id: string;
  business: string;
  plan_name: string;
  hasIntake: boolean;
}

export default function ClientSitesManager({
  sites,
  builds,
}: {
  sites: SiteRow[];
  builds: GeneratableBuild[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // Faster local refresh on top of the global 25s poll — this page is watched
  // right after a client completes intake, so a quick "is it here yet" cadence
  // matters more here than on most admin pages.
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible" && !busy) router.refresh();
    }, 8000);
    return () => clearInterval(id);
  }, [router, busy]);

  async function generate(buildId: string) {
    setBusy(buildId);
    setErr(null);
    try {
      const res = await fetch("/api/admin/generate-site", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ buildId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to generate");
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to generate");
    } finally {
      setBusy(null);
    }
  }

  async function setStatus(slug: string, status: "draft" | "published") {
    setBusy(slug);
    setErr(null);
    try {
      const res = await fetch("/api/admin/set-site-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, status }),
      });
      if (!res.ok) throw new Error("Failed to update");
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to update");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-10">
      {err && (
        <div className="p-3 rounded-lg bg-[#FEE2E2] border border-[#DC2626]/30 text-[#991B1B] text-sm">{err}</div>
      )}

      {/* Live / draft sites */}
      <div>
        <h2 className="text-base font-black text-[#18181B] mb-4">Client sites</h2>
        {sites.length === 0 ? (
          <div className="bg-white border border-[#E8E6E0] rounded-2xl p-8 text-center text-sm text-[#A1A1AA]">
            No client sites yet. Generate one from a build below.
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {sites.map((s) => {
              const published = s.status === "published";
              return (
                <div key={s.slug} className="bg-white border border-[#E8E6E0] rounded-2xl p-5 flex flex-col">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h3 className="font-black text-[#18181B] leading-tight">{s.businessName}</h3>
                    <span className={`text-[9px] font-black px-2 py-1 rounded-full whitespace-nowrap ${published ? "bg-[#EEF5EA] text-[#36671E]" : "bg-[#FEF3C7] text-[#92400E]"}`}>
                      {published ? "LIVE" : "DRAFT"}
                    </span>
                  </div>
                  <p className="text-xs text-[#71717A] mb-1">{s.niche} · {s.serviceCount} services</p>
                  <p className="text-xs text-[#A1A1AA] font-mono mb-4">/sites/{s.slug}</p>
                  <div className="mt-auto flex items-center gap-2">
                    <a
                      href={`/sites/${s.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[#36671E] text-[#FAFAF7] text-xs font-semibold hover:bg-[#295115] transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5" /> View
                    </a>
                    <button
                      onClick={() => setStatus(s.slug, published ? "draft" : "published")}
                      disabled={busy === s.slug}
                      className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-[#E8E6E0] text-[#52525B] text-xs font-semibold hover:bg-[#F5F4EF] transition-colors disabled:opacity-50"
                    >
                      {busy === s.slug ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : published ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      {published ? "Unpublish" : "Publish"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Generate from builds */}
      <div>
        <h2 className="text-base font-black text-[#18181B] mb-1">Generate from a build</h2>
        <p className="text-xs text-[#71717A] mb-4">Turns a paid build&apos;s intake answers into a draft client site + AI receptionist. Review, then publish.</p>
        {builds.length === 0 ? (
          <div className="bg-white border border-[#E8E6E0] rounded-2xl p-8 text-center text-sm text-[#A1A1AA]">
            No builds ready. When a client pays and completes intake, they&apos;ll appear here.
          </div>
        ) : (
          <div className="bg-white border border-[#E8E6E0] rounded-2xl overflow-hidden">
            {builds.map((b) => (
              <div key={b.id} className="flex items-center justify-between gap-3 p-4 border-b border-[#E8E6E0] last:border-0">
                <Link href={`/admin/builds/${b.id}`} className="min-w-0 flex-1 group">
                  <p className="text-sm font-semibold text-[#18181B] truncate group-hover:text-[#36671E] group-hover:underline transition-colors">{b.business}</p>
                  <p className="text-xs text-[#71717A]">
                    {b.plan_name}
                    {!b.hasIntake && <span className="text-[#D97706]"> · no intake yet (basic draft)</span>}
                  </p>
                </Link>
                <button
                  onClick={() => generate(b.id)}
                  disabled={busy === b.id}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#36671E] text-[#FAFAF7] text-xs font-semibold hover:bg-[#295115] transition-colors disabled:opacity-50 shrink-0"
                >
                  {busy === b.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  Generate site
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Demo hint */}
      <div className="flex items-start gap-2 p-4 rounded-xl bg-[#EEF5EA] border border-[#36671E]/20">
        <Globe className="w-4 h-4 text-[#36671E] mt-0.5 shrink-0" />
        <p className="text-sm text-[#18181B] leading-relaxed">
          See the system live:{" "}
          <a href="/sites/demo-dental" target="_blank" rel="noopener noreferrer" className="text-[#36671E] font-bold underline">
            /sites/demo-dental
          </a>{" "}
          — a full generated client site with its own trained AI receptionist.
        </p>
      </div>
    </div>
  );
}
