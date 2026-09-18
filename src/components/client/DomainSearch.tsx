"use client";

import { useState } from "react";

/**
 * A client adding another domain to their hosting.
 *
 * The price is real and comes from the registrar before they see it — the same
 * quote the checkout uses — so nobody is quoted one figure and invoiced
 * another. A name that is taken comes back as taken, with alternatives, rather
 * than as a form that accepts anything and disappoints later.
 *
 * Asking is not buying. It records the request and tells him; he completes the
 * purchase. That is not caution for its own sake: a domain is bought from a
 * registrar the instant it is ordered and cannot be returned, so the one
 * irreversible thing on this page is the one thing that goes past a person.
 */

const T = {
  en: {
    title: "Add another domain",
    body: "Search for a name. If it is free we will tell you the yearly price, and it goes on your existing invoice — no new card, no second account.",
    placeholder: "yourname.com",
    search: "Check this name",
    searching: "Checking…",
    free: (d: string, p: string) => `${d} is available — ${p} a year.`,
    taken: (d: string) => `${d} is already taken.`,
    unsupported: "We do not offer that ending yet.",
    tooDear: "That ending costs more than we can pass on at this price.",
    notOffered: "Domains are not on sale at the moment.",
    tryOthers: "These are free:",
    add: "Add this domain",
    adding: "Sending…",
    waiting: (d: string) => `We have your request for ${d}. We will confirm by email before anything is charged.`,
    failed: "That did not go through. Reply to any email from us.",
    invalid: "That does not look like a domain name.",
  },
  fr: {
    title: "Ajouter un autre domaine",
    body: "Cherchez un nom. S'il est libre nous vous indiquons le prix annuel, et il s'ajoute à votre facture existante — pas de nouvelle carte, pas de second compte.",
    placeholder: "votrenom.com",
    search: "Vérifier ce nom",
    searching: "Vérification…",
    free: (d: string, p: string) => `${d} est disponible — ${p} par an.`,
    taken: (d: string) => `${d} est déjà pris.`,
    unsupported: "Nous ne proposons pas encore cette extension.",
    tooDear: "Cette extension coûte plus que ce que nous pouvons répercuter à ce prix.",
    notOffered: "Les domaines ne sont pas proposés pour le moment.",
    tryOthers: "Ceux-ci sont libres :",
    add: "Ajouter ce domaine",
    adding: "Envoi…",
    waiting: (d: string) => `Nous avons votre demande pour ${d}. Nous confirmons par email avant tout prélèvement.`,
    failed: "Cela n'a pas abouti. Répondez à l'un de nos emails.",
    invalid: "Cela ne ressemble pas à un nom de domaine.",
  },
};

interface Quote {
  domain: string;
  sellable: boolean;
  reason: string | null;
  yearlyUsd: number;
  alternatives: { domain: string; yearlyUsd: number }[];
}

export default function DomainSearch({
  token,
  lang,
  pending,
  sample = false,
}: {
  token: string;
  lang: "en" | "fr";
  pending?: string | null;
  sample?: boolean;
}) {
  const t = T[lang];
  const money = (n: number) => (lang === "fr" ? `${n} $` : `$${n}`);
  const [name, setName] = useState("");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [asked, setAsked] = useState<string | null>(pending ?? null);

  if (asked) {
    return (
      <div className="rounded-2xl border border-[#CBE3BC] bg-[#F7FBF4] p-7">
        <p className="text-[10px] font-black text-[#36671E] uppercase tracking-widest mb-2">{t.title}</p>
        <p className="text-[14px] text-[#3F3F46] leading-relaxed">{t.waiting(asked)}</p>
      </div>
    );
  }

  async function search(e: React.FormEvent) {
    e.preventDefault();
    if (sample) return;
    setBusy(true);
    setNote(null);
    setQuote(null);
    try {
      const r = await fetch(`/api/domain-quote?name=${encodeURIComponent(name.trim())}`);
      const d = await r.json();
      if (!d.ok) {
        setNote(d.reason === "not-offered" ? t.notOffered : t.invalid);
        return;
      }
      setQuote(d as Quote);
    } catch {
      setNote(t.failed);
    } finally {
      setBusy(false);
    }
  }

  async function add(domain: string, yearlyUsd: number) {
    setBusy(true);
    setNote(null);
    try {
      const r = await fetch("/api/client-area?do=request-domain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ t: token, domain, yearlyUsd }),
      });
      const d = await r.json();
      if (!d.ok) {
        setNote(d.error || t.failed);
        return;
      }
      setAsked(domain);
    } catch {
      setNote(t.failed);
    } finally {
      setBusy(false);
    }
  }

  const why =
    quote && !quote.sellable
      ? quote.reason === "taken"
        ? t.taken(quote.domain)
        : quote.reason === "unsupported"
          ? t.unsupported
          : quote.reason === "too-expensive"
            ? t.tooDear
            : t.notOffered
      : null;

  return (
    <div className="rounded-2xl border border-[#E8E6E0] bg-white p-7">
      <p className="text-[10px] font-black text-[#8A8A80] uppercase tracking-widest mb-2">{t.title}</p>
      <p className="text-[14px] text-[#52525B] leading-relaxed mb-4">{t.body}</p>

      <form onSubmit={search} className="flex gap-2">
        <input
          type="text" value={name} onChange={(e) => setName(e.target.value)}
          placeholder={t.placeholder} disabled={sample} spellCheck={false} autoCapitalize="none"
          className="flex-1 min-w-0 h-11 px-3 rounded-lg border border-[#E2E6DD] bg-white text-[15px]"
        />
        <button
          type="submit" disabled={sample || busy || name.trim().length < 3}
          className="shrink-0 h-11 px-4 rounded-lg bg-[#36671E] text-white text-[13.5px] font-bold disabled:opacity-40"
        >
          {busy ? t.searching : t.search}
        </button>
      </form>

      {quote?.sellable ? (
        <div className="mt-4 rounded-xl border border-[#CBE3BC] bg-[#F7FBF4] px-4 py-3">
          <p className="text-[14px] font-bold text-[#18181B]">{t.free(quote.domain, money(quote.yearlyUsd))}</p>
          <button
            onClick={() => add(quote.domain, quote.yearlyUsd)} disabled={busy}
            className="mt-3 h-10 px-4 rounded-lg bg-[#36671E] text-white text-[13.5px] font-bold disabled:opacity-40"
          >
            {busy ? t.adding : t.add}
          </button>
        </div>
      ) : null}

      {why ? <p className="mt-4 text-[13.5px] text-[#B45309]">{why}</p> : null}

      {quote?.alternatives?.length ? (
        <div className="mt-3">
          <p className="text-[13px] text-[#52525B] mb-2">{t.tryOthers}</p>
          <ul className="space-y-1.5">
            {quote.alternatives.map((a) => (
              <li key={a.domain} className="flex items-center justify-between gap-3 text-[14px]">
                <span className="truncate text-[#18181B]">{a.domain}</span>
                <button
                  onClick={() => add(a.domain, a.yearlyUsd)} disabled={busy}
                  className="shrink-0 text-[13px] font-bold text-[#36671E] hover:underline disabled:opacity-40"
                >
                  {money(a.yearlyUsd)}/yr · {t.add}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {note ? <p className="mt-3 text-[13.5px] text-[#B45309]">{note}</p> : null}
    </div>
  );
}
