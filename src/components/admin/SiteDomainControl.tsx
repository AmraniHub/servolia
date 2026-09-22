"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface DnsLine { type: string; name: string; value: string }

/**
 * C2 on /admin/sites: put one generated site on the practice's own domain.
 * Attach → Vercel knows the domain → the DNS lines she (or her webmaster)
 * must add are shown right here, ready to copy into an email. The go-live
 * email is not sent from here: /api/cron/domain-live sends it the first time
 * her domain serves the site.
 */
export default function SiteDomainControl({
  slug, customDomain, domainLiveAt, wanted,
}: { slug: string; customDomain?: string; domainLiveAt?: string; wanted?: string }) {
  const router = useRouter();
  const [domain, setDomain] = useState(customDomain ?? wanted ?? "");
  const [busy, setBusy] = useState(false);
  const [dns, setDns] = useState<DnsLine[] | null>(null);
  const [error, setError] = useState("");

  async function call(action: "attach" | "detach") {
    if (action === "detach" && !window.confirm(`Take the site off ${customDomain}? It goes back to servolia.com/sites/${slug}.`)) return;
    setBusy(true);
    setError("");
    const res = await fetch("/api/admin/site-domain", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, domain, action }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      const why: Record<string, string> = {
        invalid: "Not a domain.", ours: "That is one of ours.", platform: "A shared platform (Doctolib, Google…) — she needs her own domain.",
        taken: "Another site here already has that domain.", "in-use-elsewhere": "Attached to another Vercel account — she must release it there, or add the TXT line Vercel asks for.",
        "not-configured": "VERCEL_TOKEN / VERCEL_TEAM_ID missing.", vercel: `Vercel refused: ${json.detail ?? ""}`,
      };
      setError(why[json.reason] ?? "Failed — try again.");
      return;
    }
    if (action === "attach") setDns(json.dns ?? []);
    router.refresh();
  }

  return (
    <div className="mt-3 pt-3 border-t border-[#F1F0EC] text-xs" data-testid="site-domain">
      {customDomain ? (
        <p className="mb-2">
          <span className="font-mono text-[#18181B]">{customDomain}</span>{" "}
          <span className={domainLiveAt ? "font-bold text-[#36671E]" : "font-bold text-[#B45309]"}>
            {domainLiveAt ? "· live" : "· waiting for her DNS"}
          </span>
        </p>
      ) : null}
      {!customDomain ? (
        <div className="flex gap-2">
          <input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="her-domain.fr"
            className="flex-1 min-w-0 h-8 px-2 rounded-lg border border-[#E8E6E0] font-mono" />
          <button type="button" disabled={busy || !domain.trim()} onClick={() => call("attach")}
            className="h-8 px-3 rounded-lg bg-[#18181B] text-white font-bold disabled:opacity-50">
            {busy ? "…" : "Attach"}
          </button>
        </div>
      ) : (
        <button type="button" disabled={busy} onClick={() => call("detach")}
          className="text-[#71717A] underline underline-offset-2 hover:text-[#B91C1C] disabled:opacity-50">
          Detach
        </button>
      )}
      {dns?.length ? (
        <div className="mt-2 p-2 rounded-lg bg-[#FAFAF7] border border-[#E8E6E0]">
          <p className="font-bold text-[#18181B] mb-1">Send her these DNS lines:</p>
          {dns.map((d) => (
            <p key={`${d.type}-${d.name}`} className="font-mono">{d.type} · {d.name} · {d.value}</p>
          ))}
        </div>
      ) : null}
      {error ? <p className="mt-2 text-[#B91C1C]" role="alert">{error}</p> : null}
    </div>
  );
}
