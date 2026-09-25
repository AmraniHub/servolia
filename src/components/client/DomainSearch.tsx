"use client";

import { useState } from "react";
import { usd } from "@/lib/hosting";

/**
 * A client adding another domain to their hosting.
 *
 * The price is real and comes from the registrar before they see it — the same
 * quote the checkout uses — so nobody is quoted one figure and invoiced
 * another. A name that is taken comes back as taken, with alternatives, rather
 * than as a form that accepts anything and disappoints later.
 *
 * Buying happens here, on the card they already have with us. The charge is
 * for the first year; the renewal joins their invoice a year later, so an
 * extra domain never becomes a second Stripe relationship with one supplier.
 *
 * The price in the button is what the server quoted a moment ago, and the
 * server quotes the registrar AGAIN before it creates the session. A figure
 * that reached this component from anywhere never becomes a charge.
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
    add: "Buy this domain",
    adding: "Opening payment…",
    payNote: "You pay for the first year now, on the card you already have with us. It renews on your invoice each year unless you tell us to stop.",
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
    add: "Acheter ce domaine",
    adding: "Ouverture du paiement…",
    payNote: "Vous payez la première année maintenant, sur la carte déjà enregistrée. Il se renouvelle ensuite chaque année sur votre facture, sauf avis contraire.",
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
  sample = false,
}: {
  token: string;
  lang: "en" | "fr";
  sample?: boolean;
}) {
  const t = T[lang];
  const money = (n: number) => (lang === "fr" ? `${usd(n)} $` : `$${usd(n)}`);
  const [name, setName] = useState("");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

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

  /* Straight to Stripe. The price in the button is what the server quoted a
     moment ago, and the server quotes the registrar again before it creates
     the session — the browser's figure never becomes a charge. */
  async function add(domain: string) {
    setBusy(true);
    setNote(null);
    try {
      const r = await fetch("/api/client-area?do=buy-domain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ t: token, domain }),
      });
      const d = await r.json();
      if (!d.ok || !d.url) {
        setNote(d.error || t.failed);
        return;
      }
      window.location.href = d.url;
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
          <p className="mt-1.5 text-[13px] text-[#52525B] leading-relaxed">{t.payNote}</p>
          <button
            onClick={() => add(quote.domain)} disabled={busy}
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
                  onClick={() => add(a.domain)} disabled={busy}
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
