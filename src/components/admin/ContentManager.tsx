"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, XCircle, Loader2, Sparkles, FileText, Share2, BarChart3, Search } from "lucide-react";

export interface BlogDraftRow {
  id: string;
  title: string;
  excerpt: string;
  category: string;
  status: string;
  keyword_cluster: string | null;
  created_at: string;
}

export interface LinkedInDraftRow {
  id: string;
  topic: string;
  body: string;
  status: string;
  created_at: string;
}

const JOBS = [
  { key: "blog", label: "Generate blog post", icon: FileText },
  { key: "linkedin", label: "Generate LinkedIn post", icon: Share2 },
  { key: "stats", label: "Get daily stats", icon: BarChart3 },
  { key: "seo", label: "Get SEO report", icon: Search },
];

export default function ContentManager({
  blogDrafts,
  linkedinDrafts,
}: {
  blogDrafts: BlogDraftRow[];
  linkedinDrafts: LinkedInDraftRow[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function act(kind: "blog" | "linkedin", id: string, action: "publish" | "reject") {
    setBusy(id);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/content-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, id, action }),
      });
      const data = await res.json();
      setMsg(data.message ?? "Done");
      router.refresh();
    } catch {
      setMsg("Something went wrong");
    } finally {
      setBusy(null);
    }
  }

  async function trigger(job: string) {
    setBusy(job);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/trigger-content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ job }),
      });
      const data = await res.json();
      setMsg(data.ok ? "Triggered — check Telegram in a moment" : (data.reason ?? "Failed"));
      router.refresh();
    } catch {
      setMsg("Something went wrong");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-10">
      {msg && (
        <div className="p-3 rounded-lg bg-[#EEF5EA] border border-[#36671E]/30 text-[#36671E] text-sm">{msg}</div>
      )}

      {/* Manual triggers */}
      <div>
        <h2 className="text-base font-black text-[#18181B] mb-4">Run now</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {JOBS.map((j) => {
            const Icon = j.icon;
            return (
              <button
                key={j.key}
                onClick={() => trigger(j.key)}
                disabled={busy === j.key}
                className="flex items-center gap-2 p-4 rounded-xl bg-white border border-[#E8E6E0] hover:border-[#36671E]/40 hover:shadow-card transition-all text-sm font-semibold text-[#18181B] disabled:opacity-50"
              >
                {busy === j.key ? <Loader2 className="w-4 h-4 animate-spin" /> : <Icon className="w-4 h-4 text-[#36671E]" />}
                {j.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Blog drafts awaiting review */}
      <div>
        <h2 className="text-base font-black text-[#18181B] mb-1">Blog drafts</h2>
        <p className="text-xs text-[#71717A] mb-4">Generated Mon/Wed/Fri, or on demand. Review here or from Telegram — either works.</p>
        {blogDrafts.length === 0 ? (
          <div className="bg-white border border-[#E8E6E0] rounded-2xl p-8 text-center text-sm text-[#A1A1AA]">
            No drafts waiting. Click &quot;Generate blog post&quot; above to create one now.
          </div>
        ) : (
          <div className="space-y-3">
            {blogDrafts.map((d) => (
              <div key={d.id} className="bg-white border border-[#E8E6E0] rounded-2xl p-5">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="min-w-0">
                    <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-[#EEF5EA] text-[#36671E] uppercase tracking-widest">{d.category}</span>
                    <h3 className="font-black text-[#18181B] mt-1.5">{d.title}</h3>
                    <p className="text-sm text-[#71717A] mt-1">{d.excerpt}</p>
                    {d.keyword_cluster && <p className="text-xs text-[#A1A1AA] mt-1.5">🎯 {d.keyword_cluster}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-3">
                  <button
                    onClick={() => act("blog", d.id, "publish")}
                    disabled={busy === d.id}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#36671E] text-[#FAFAF7] text-xs font-semibold hover:bg-[#295115] transition-colors disabled:opacity-50"
                  >
                    {busy === d.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                    Publish
                  </button>
                  <button
                    onClick={() => act("blog", d.id, "reject")}
                    disabled={busy === d.id}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-[#E8E6E0] text-[#71717A] text-xs font-semibold hover:bg-[#F5F4EF] transition-colors disabled:opacity-50"
                  >
                    <XCircle className="w-3.5 h-3.5" /> Skip
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* LinkedIn drafts awaiting review */}
      <div>
        <h2 className="text-base font-black text-[#18181B] mb-1">LinkedIn drafts</h2>
        <p className="text-xs text-[#71717A] mb-4">Pure thought-leadership — never mentions pricing or sounds like an ad.</p>
        {linkedinDrafts.length === 0 ? (
          <div className="bg-white border border-[#E8E6E0] rounded-2xl p-8 text-center text-sm text-[#A1A1AA]">
            No drafts waiting. Click &quot;Generate LinkedIn post&quot; above to create one now.
          </div>
        ) : (
          <div className="space-y-3">
            {linkedinDrafts.map((d) => (
              <div key={d.id} className="bg-white border border-[#E8E6E0] rounded-2xl p-5">
                <p className="text-sm text-[#18181B] whitespace-pre-line leading-relaxed">{d.body}</p>
                <div className="flex items-center gap-2 mt-4">
                  <button
                    onClick={() => act("linkedin", d.id, "publish")}
                    disabled={busy === d.id}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#0A66C2] text-white text-xs font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    {busy === d.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                    Approve
                  </button>
                  <button
                    onClick={() => act("linkedin", d.id, "reject")}
                    disabled={busy === d.id}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-[#E8E6E0] text-[#71717A] text-xs font-semibold hover:bg-[#F5F4EF] transition-colors disabled:opacity-50"
                  >
                    <XCircle className="w-3.5 h-3.5" /> Skip
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
