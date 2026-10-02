"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * DNS for the domains a client bought through us, on their own account page.
 *
 * The point is ownership they can feel: the same rows a registrar shows, and
 * the same add / edit / delete. What keeps the site online is shown LOCKED with
 * the reason rather than hidden, so nothing looks missing and nothing can be
 * broken by accident. Rules live server-side in src/lib/clientDns.ts; this
 * component only mirrors them for a friendlier first error.
 */

type Rec = {
  id: string; type: string; name: string; value: string; ttl: number;
  mxPriority: number | null; locked: boolean; lockReason?: "system" | "hosting" | "type";
};
type Draft = { type: string; name: string; value: string; ttl: string; mxPriority: string };

const TYPES = ["A", "AAAA", "CNAME", "MX", "TXT"];
const TTLS = [
  { v: "3600", en: "1 hour", fr: "1 heure" },
  { v: "300", en: "5 minutes", fr: "5 minutes" },
  { v: "86400", en: "1 day", fr: "1 jour" },
  { v: "60", en: "1 minute", fr: "1 minute" },
];
const EMPTY: Draft = { type: "TXT", name: "", value: "", ttl: "3600", mxPriority: "10" };

const T = {
  en: {
    title: "DNS records",
    body: "You own these domains, and these are their DNS records: mail, verification codes for Google or Meta, subdomains. Changes usually work within minutes.",
    pick: "Domain",
    loading: "Loading records…",
    none: "No records of your own yet.",
    locked: "Managed for you",
    lockSystem: "Keeps your website and its HTTPS online.",
    lockHosting: "Your website is hosted here, so this name is managed for you.",
    lockType: "Ask us to change this type of record.",
    add: "Add a record",
    edit: "Edit",
    del: "Delete",
    confirmDel: "Yes, delete",
    cancel: "Cancel",
    save: "Save",
    saving: "Saving…",
    type: "Type",
    name: "Name",
    nameHint: "@ for the root, or a subdomain like mail",
    value: "Value",
    priority: "Priority",
    ttl: "TTL",
    saved: "Saved. It can take a few minutes to reach everyone.",
    deleted: "Deleted.",
    failed: "That did not work. Please try again.",
    sample: "Example records — this is a preview.",
  },
  fr: {
    title: "Enregistrements DNS",
    body: "Ces domaines vous appartiennent, et voici leurs enregistrements DNS : e-mail, codes de vérification Google ou Meta, sous-domaines. Les changements prennent effet en quelques minutes.",
    pick: "Domaine",
    loading: "Chargement…",
    none: "Aucun enregistrement personnel pour l'instant.",
    locked: "Géré pour vous",
    lockSystem: "Maintient votre site et son HTTPS en ligne.",
    lockHosting: "Votre site est hébergé ici : ce nom est géré pour vous.",
    lockType: "Demandez-nous pour modifier ce type d'enregistrement.",
    add: "Ajouter un enregistrement",
    edit: "Modifier",
    del: "Supprimer",
    confirmDel: "Oui, supprimer",
    cancel: "Annuler",
    save: "Enregistrer",
    saving: "Enregistrement…",
    type: "Type",
    name: "Nom",
    nameHint: "@ pour la racine, ou un sous-domaine comme mail",
    value: "Valeur",
    priority: "Priorité",
    ttl: "TTL",
    saved: "Enregistré. La propagation peut prendre quelques minutes.",
    deleted: "Supprimé.",
    failed: "Cela n'a pas fonctionné. Réessayez.",
    sample: "Exemples d'enregistrements — ceci est un aperçu.",
  },
};

const SAMPLE: Rec[] = [
  { id: "s1", type: "MX", name: "", value: "mx.zoho.eu", ttl: 3600, mxPriority: 10, locked: false },
  { id: "s2", type: "TXT", name: "", value: "v=spf1 include:zoho.eu ~all", ttl: 3600, mxPriority: null, locked: false },
  { id: "s3", type: "TXT", name: "_dmarc", value: "v=DMARC1; p=quarantine", ttl: 3600, mxPriority: null, locked: false },
  { id: "s4", type: "ALIAS", name: "", value: "cname.vercel-dns.com", ttl: 60, mxPriority: null, locked: true, lockReason: "system" },
];

export default function DnsManager({
  token, lang, domains, sample = false,
}: { token: string; lang: "en" | "fr"; domains: string[]; sample?: boolean }) {
  const t = T[lang];
  const [domain, setDomain] = useState(domains[0] ?? "");
  const [records, setRecords] = useState<Rec[] | null>(sample ? SAMPLE : null);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<string | null>(null); // record id, or "new"
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [deleting, setDeleting] = useState<string | null>(null);

  const call = useCallback(async (payload: Record<string, unknown>) => {
    const res = await fetch("/api/client-dns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ t: token, domain, ...payload }),
    });
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; records?: Rec[] };
    return { ok: Boolean(res.ok && data.ok), data };
  }, [token, domain]);

  const load = useCallback(async () => {
    if (sample || !domain) return;
    setRecords(null);
    setError("");
    const { ok, data } = await call({ action: "list" });
    if (ok) setRecords(data.records ?? []);
    else setError(data.error || t.failed);
  }, [call, domain, sample, t.failed]);

  useEffect(() => { void load(); }, [load]);

  if (!domains.length && !sample) return null;

  const startEdit = (r: Rec | null) => {
    setNote("");
    setError("");
    setDeleting(null);
    if (!r) {
      setDraft(EMPTY);
      setEditing("new");
    } else {
      setDraft({
        type: r.type, name: r.name === "" ? "@" : r.name, value: r.value,
        ttl: String(r.ttl), mxPriority: String(r.mxPriority ?? 10),
      });
      setEditing(r.id);
    }
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sample) return;
    setBusy(true);
    setError("");
    const record = {
      type: draft.type, name: draft.name, value: draft.value, ttl: Number(draft.ttl),
      ...(draft.type === "MX" ? { mxPriority: Number(draft.mxPriority) } : {}),
    };
    const { ok, data } = await call(editing === "new" ? { action: "create", record } : { action: "update", id: editing, record });
    setBusy(false);
    if (!ok) { setError(data.error || t.failed); return; }
    setEditing(null);
    setNote(t.saved);
    await load();
  };

  const remove = async (id: string) => {
    if (sample) return;
    setBusy(true);
    setError("");
    const { ok, data } = await call({ action: "delete", id });
    setBusy(false);
    setDeleting(null);
    if (!ok) { setError(data.error || t.failed); return; }
    setNote(t.deleted);
    await load();
  };

  const lockText = (r: Rec) =>
    r.lockReason === "hosting" ? t.lockHosting : r.lockReason === "type" ? t.lockType : t.lockSystem;

  const form = (
    <form onSubmit={save} className="mt-3 rounded-xl border border-[#E2E6DD] bg-[#FAFAF7] p-4 space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <label className="text-[12px] font-bold text-[#52525B]">
          {t.type}
          <select
            value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value })}
            disabled={editing !== "new"}
            className="mt-1 w-full h-10 px-2 rounded-lg border border-[#E2E6DD] bg-white text-[14px] font-normal"
          >
            {TYPES.map((x) => <option key={x} value={x}>{x}</option>)}
          </select>
        </label>
        <label className="text-[12px] font-bold text-[#52525B] col-span-1 sm:col-span-2">
          {t.name}
          <div className="mt-1 flex items-center rounded-lg border border-[#E2E6DD] bg-white">
            <input
              value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder="@" spellCheck={false} autoCapitalize="none"
              className="min-w-0 flex-1 h-10 px-2 rounded-lg text-[14px] font-normal outline-none"
            />
            <span className="pr-2 text-[12px] font-normal text-[#8A8A80] truncate max-w-[45%]">.{domain}</span>
          </div>
        </label>
        <label className="text-[12px] font-bold text-[#52525B]">
          {t.ttl}
          <select
            value={draft.ttl} onChange={(e) => setDraft({ ...draft, ttl: e.target.value })}
            className="mt-1 w-full h-10 px-2 rounded-lg border border-[#E2E6DD] bg-white text-[14px] font-normal"
          >
            {TTLS.map((x) => <option key={x.v} value={x.v}>{x[lang]}</option>)}
            {TTLS.some((x) => x.v === draft.ttl) ? null : <option value={draft.ttl}>{draft.ttl}s</option>}
          </select>
        </label>
      </div>
      <p className="text-[12px] text-[#8A8A80] -mt-1">{t.nameHint}</p>
      <div className="flex gap-2">
        {draft.type === "MX" ? (
          <label className="text-[12px] font-bold text-[#52525B] w-24 shrink-0">
            {t.priority}
            <input
              value={draft.mxPriority} onChange={(e) => setDraft({ ...draft, mxPriority: e.target.value })}
              inputMode="numeric"
              className="mt-1 w-full h-10 px-2 rounded-lg border border-[#E2E6DD] bg-white text-[14px] font-normal"
            />
          </label>
        ) : null}
        <label className="text-[12px] font-bold text-[#52525B] flex-1 min-w-0">
          {t.value}
          <textarea
            value={draft.value} onChange={(e) => setDraft({ ...draft, value: e.target.value })}
            rows={draft.type === "TXT" ? 3 : 1} spellCheck={false} autoCapitalize="none"
            className="mt-1 w-full px-2 py-2 rounded-lg border border-[#E2E6DD] bg-white text-[14px] font-normal font-mono break-all"
          />
        </label>
      </div>
      <div className="flex gap-2">
        <button type="submit" disabled={busy || sample || !draft.value.trim()}
          className="h-10 px-4 rounded-lg bg-[#36671E] text-white text-[13.5px] font-bold disabled:opacity-40">
          {busy ? t.saving : t.save}
        </button>
        <button type="button" onClick={() => setEditing(null)}
          className="h-10 px-4 rounded-lg border border-[#E2E6DD] bg-white text-[13.5px] font-bold text-[#52525B]">
          {t.cancel}
        </button>
      </div>
    </form>
  );

  return (
    <div className="rounded-2xl border border-[#E8E6E0] bg-white p-7 mb-5">
      <p className="text-[10px] font-black text-[#8A8A80] uppercase tracking-widest mb-2">{t.title}</p>
      <p className="text-[14px] text-[#52525B] leading-relaxed mb-4">{t.body}</p>
      {sample ? <p className="text-[12.5px] text-[#8A8A80] mb-3">{t.sample}</p> : null}

      {domains.length > 1 ? (
        <label className="block text-[12px] font-bold text-[#52525B] mb-4">
          {t.pick}
          <select
            value={domain} onChange={(e) => { setDomain(e.target.value); setEditing(null); setNote(""); }}
            className="mt-1 w-full h-10 px-2 rounded-lg border border-[#E2E6DD] bg-white text-[14px] font-normal"
          >
            {domains.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </label>
      ) : (
        <p className="text-[15px] font-bold text-[#18181B] mb-3 break-all">{domain || "example.com"}</p>
      )}

      {records === null && !error ? <p className="text-[13.5px] text-[#8A8A80]">{t.loading}</p> : null}
      {records && !records.some((r) => !r.locked) ? <p className="text-[13.5px] text-[#8A8A80] mb-2">{t.none}</p> : null}

      {records?.length ? (
        <ul className="divide-y divide-[#F0EEE8] border-y border-[#F0EEE8]">
          {records.map((r) => (
            <li key={r.id} className="py-3">
              <div className="flex items-start gap-3">
                <span className="shrink-0 w-14 text-[11px] font-black tracking-wide text-[#36671E] bg-[#F1F7EC] rounded px-1.5 py-1 text-center">{r.type}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-bold text-[#18181B] break-all">
                    {r.name === "" ? "@" : r.name}
                    {r.type === "MX" && r.mxPriority != null ? <span className="font-normal text-[#8A8A80]"> · {t.priority} {r.mxPriority}</span> : null}
                  </p>
                  <p className="text-[13px] text-[#52525B] font-mono break-all">{r.value}</p>
                  {r.locked ? <p className="mt-1 text-[12px] text-[#8A8A80]">🔒 {t.locked} — {lockText(r)}</p> : null}
                </div>
                {!r.locked ? (
                  <div className="shrink-0 flex flex-col items-end gap-1">
                    {deleting === r.id ? (
                      <>
                        <button onClick={() => remove(r.id)} disabled={busy}
                          className="text-[12.5px] font-bold text-[#B91C1C] hover:underline disabled:opacity-40">{t.confirmDel}</button>
                        <button onClick={() => setDeleting(null)}
                          className="text-[12.5px] text-[#52525B] hover:underline">{t.cancel}</button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => startEdit(r)} disabled={busy}
                          className="text-[12.5px] font-bold text-[#36671E] hover:underline disabled:opacity-40">{t.edit}</button>
                        <button onClick={() => { setEditing(null); setDeleting(r.id); }} disabled={busy}
                          className="text-[12.5px] text-[#B91C1C] hover:underline disabled:opacity-40">{t.del}</button>
                      </>
                    )}
                  </div>
                ) : null}
              </div>
              {editing === r.id ? form : null}
            </li>
          ))}
        </ul>
      ) : null}

      {editing === "new" ? form : (
        <button onClick={() => startEdit(null)} disabled={busy || records === null}
          className="mt-4 h-10 px-4 rounded-lg bg-[#36671E] text-white text-[13.5px] font-bold disabled:opacity-40">
          + {t.add}
        </button>
      )}

      {error ? <p className="mt-3 text-[13.5px] text-[#B45309]">{error}</p> : null}
      {note && !error ? <p className="mt-3 text-[13.5px] text-[#36671E]">{note}</p> : null}
    </div>
  );
}
