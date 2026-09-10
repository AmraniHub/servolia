"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, AlertTriangle } from "lucide-react";

/**
 * Where the operator records how a client's site is actually hosted, which is
 * the write that arms the gate for anyone who bought from the plans page.
 *
 * The save is refused if the repo cannot be gated -- see the API. `force`
 * exists for the one honest exception: a site the operator has decided to run
 * without a gate, recorded so the list stops saying "needs setup".
 */
export default function HostingSetupForm({
  id,
  initial,
}: {
  id: string;
  initial: {
    repo: string | null; branch: string | null; site_root: string | null;
    vercel_project: string | null; site_url: string | null; notes: string | null;
  };
}) {
  const router = useRouter();
  const [repo, setRepo] = useState(initial.repo ?? "");
  const [branch, setBranch] = useState(initial.branch ?? "main");
  const [siteRoot, setSiteRoot] = useState(initial.site_root ?? "");
  const [vercelProject, setVercelProject] = useState(initial.vercel_project ?? "");
  const [siteUrl, setSiteUrl] = useState(initial.site_url ?? "");
  const [notes, setNotes] = useState(initial.notes ?? "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function save(force = false) {
    setBusy(true); setMsg(null);
    try {
      const res = await fetch(`/api/admin/hosting/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repo, branch, siteRoot, vercelProject, siteUrl, notes, force }),
      });
      const data = await res.json();
      if (res.status === 409) {
        setMsg({ ok: false, text: `Gate not reachable: ${data.detail}. ${data.hint}` });
        return;
      }
      if (!res.ok) throw new Error(data.error || "save failed");
      setMsg({ ok: true, text: `Saved. ${data.gate?.detail ?? ""}` });
      router.refresh();
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : "Save failed" });
    } finally {
      setBusy(false);
    }
  }

  const field = "w-full h-10 px-3 text-sm border border-[#E4E4E7] rounded-lg bg-white focus:outline-none focus:border-[#36671E] font-mono";
  const label = "block text-[11px] font-bold text-[#71717A] uppercase tracking-wider mb-1";

  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className={label} htmlFor="h-repo">GitHub repo</label>
          <input id="h-repo" value={repo} onChange={(e) => setRepo(e.target.value)} placeholder="AmraniHub/client-site" className={field} />
          <p className="mt-1 text-[11px] text-[#A1A1AA]">Must contain site-status.js and middleware.js. GH_TOKEN must reach it.</p>
        </div>
        <div>
          <label className={label} htmlFor="h-branch">Branch</label>
          <input id="h-branch" value={branch} onChange={(e) => setBranch(e.target.value)} placeholder="main" className={field} />
        </div>
        <div>
          <label className={label} htmlFor="h-root">Site root (subfolder)</label>
          <input id="h-root" value={siteRoot} onChange={(e) => setSiteRoot(e.target.value)} placeholder="web  (leave empty for repo root)" className={field} />
          <p className="mt-1 text-[11px] text-[#A1A1AA]">Wrong root = the gate writes where Vercel never serves.</p>
        </div>
        <div>
          <label className={label} htmlFor="h-vp">Vercel project</label>
          <input id="h-vp" value={vercelProject} onChange={(e) => setVercelProject(e.target.value)} placeholder="client-site" className={field} />
        </div>
        <div className="sm:col-span-2">
          <label className={label} htmlFor="h-url">Live URL</label>
          <input id="h-url" value={siteUrl} onChange={(e) => setSiteUrl(e.target.value)} placeholder="https://client.com" className={field} />
        </div>
        <div className="sm:col-span-2">
          <label className={label} htmlFor="h-notes">Notes (handover from the client lands here)</label>
          <textarea id="h-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={5}
                    className="w-full px-3 py-2 text-sm border border-[#E4E4E7] rounded-lg bg-white focus:outline-none focus:border-[#36671E] resize-y" />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button onClick={() => save(false)} disabled={busy}
                className="h-10 px-5 rounded-lg bg-[#18181B] text-white text-sm font-bold hover:bg-[#27272A] disabled:opacity-50">
          {busy ? "Checking gate…" : "Save & verify gate"}
        </button>
        {msg && !msg.ok ? (
          <button onClick={() => save(true)} disabled={busy}
                  className="h-10 px-4 rounded-lg border border-[#E4E4E7] text-sm text-[#71717A] hover:text-[#18181B]">
            Save without gate
          </button>
        ) : null}
      </div>

      {msg ? (
        <div className={`flex gap-2 items-start rounded-lg p-3 text-sm ${msg.ok ? "bg-[#F3F9EE] text-[#36671E]" : "bg-[#FEF3C7] text-[#92400E]"}`}>
          {msg.ok ? <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" /> : <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />}
          <span>{msg.text}</span>
        </div>
      ) : null}
    </div>
  );
}
