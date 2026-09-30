"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Globe, ExternalLink, Sparkles, Loader2, Eye, EyeOff, Trash2 } from "lucide-react";
import SiteDomainControl from "@/components/admin/SiteDomainControl";

export interface SiteRow {
  slug: string;
  businessName: string;
  niche: string;
  status: string;
  serviceCount: number;
  /** C2 — her own domain, when attached; live once it serves the site. */
  customDomain?: string;
  domainLiveAt?: string;
  /** The domain she gave at intake, offered as the default. */
  wantedDomain?: string;
  /** The DNS lines she was sent. */
  domainDns?: { type: string; name: string; value: string }[];
  /** A real generated site (not a demo, not an assistant-only config). */
  canHaveDomain?: boolean;
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
  // Two clicks to delete: the first arms this slug, the second deletes.
  const [armed, setArmed] = useState<string | null>(null);

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

  async function deleteSite(slug: string) {
    setBusy(slug);
    setErr(null);
    try {
      const res = await fetch("/api/admin/delete-site", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Failed to delete");
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to delete");
    } finally {
      setBusy(null);
      setArmed(null);
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
                  {s.canHaveDomain ? (
                    <SiteDomainControl slug={s.slug} customDomain={s.customDomain} domainLiveAt={s.domainLiveAt} wanted={s.wantedDomain} savedDns={s.domainDns} />
                  ) : null}
                  {/* Drafts only; the server refuses anything a client pays for (src/lib/siteDelete.ts). */}
                  {!published && s.canHaveDomain && !s.customDomain ? (
                    <div className="mt-3 flex items-center justify-end gap-2 text-xs">
                      {armed === s.slug ? (
                        <>
                          <span className="text-[#71717A]">Archived first, then deleted.</span>
                          <button onClick={() => setArmed(null)} disabled={busy === s.slug} className="px-2.5 py-1.5 rounded-lg border border-[#E8E6E0] text-[#52525B] font-semibold hover:bg-[#F5F4EF]">Keep</button>
                          <button onClick={() => deleteSite(s.slug)} disabled={busy === s.slug} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#DC2626] text-white font-semibold hover:bg-[#B91C1C] disabled:opacity-50">
                            {busy === s.slug ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />} Yes, delete draft
                          </button>
                        </>
                      ) : (
                        <button onClick={() => setArmed(s.slug)} disabled={busy === s.slug} className="flex items-center gap-1 text-[#A1A1AA] hover:text-[#DC2626] font-semibold">
                          <Trash2 className="w-3.5 h-3.5" /> Delete draft
                        </button>
                      )}
                    </div>
                  ) : null}
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
