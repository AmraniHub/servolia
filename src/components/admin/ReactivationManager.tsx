"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCcw, Star, Upload, MessageCircle, Check, X } from "lucide-react";
import { waLink } from "@/lib/whatsapp";

/**
 * Reactivation & review campaigns — import a client's dormant contacts (CSV),
 * message them via one-click WhatsApp links, and track pending → contacted →
 * booked (with € value) so each campaign's recovered revenue is visible.
 */

interface SiteOption {
  slug: string;
  businessName: string;
  language: "en" | "fr";
  googleReviewUrl: string | null;
}

interface Contact {
  id: string;
  campaign: "reactivation" | "review";
  name: string | null;
  phone: string | null;
  email: string | null;
  last_visit: string | null;
  treatment: string | null;
  status: "pending" | "contacted" | "replied" | "booked" | "opted_out";
  booked_value: number;
}

type Campaign = "reactivation" | "review";

function buildMessage(site: SiteOption, campaign: Campaign, contact: Contact): string {
  const name = contact.name?.split(" ")[0] ?? "";
  if (campaign === "review") {
    const url = site.googleReviewUrl ?? "";
    return site.language === "fr"
      ? `Bonjour${name ? ` ${name}` : ""} ! C'est ${site.businessName}. Merci pour votre visite 💛 Si vous avez 30 secondes, un petit avis Google nous aiderait énormément : ${url}`
      : `Hi${name ? ` ${name}` : ""}! It's ${site.businessName}. Thank you for your visit 💛 If you have 30 seconds, a quick Google review would help us a lot: ${url}`;
  }
  return site.language === "fr"
    ? `Bonjour${name ? ` ${name}` : ""} ! C'est ${site.businessName}. Cela fait un moment${contact.treatment ? ` depuis votre ${contact.treatment}` : ""} — nous avons de nouvelles disponibilités cette semaine. Souhaitez-vous un rendez-vous ? Répondez ici et on s'occupe de tout 😊`
    : `Hi${name ? ` ${name}` : ""}! It's ${site.businessName}. It's been a while${contact.treatment ? ` since your ${contact.treatment}` : ""} — we have new openings this week. Would you like an appointment? Just reply here and we'll take care of it 😊`;
}

const STATUS_STYLE: Record<Contact["status"], { label: string; bg: string; color: string }> = {
  pending:   { label: "Pending",    bg: "#F5F4EF", color: "#71717A" },
  contacted: { label: "Contacted",  bg: "#DBEAFE", color: "#1D4ED8" },
  replied:   { label: "Replied",    bg: "#FEF3C7", color: "#92400E" },
  booked:    { label: "Booked",     bg: "#DCFCE7", color: "#166534" },
  opted_out: { label: "Opted out",  bg: "#FEE2E2", color: "#B91C1C" },
};

export default function ReactivationManager({ sites }: { sites: SiteOption[] }) {
  const [siteSlug, setSiteSlug] = useState(sites[0]?.slug ?? "");
  const [campaign, setCampaign] = useState<Campaign>("reactivation");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [csv, setCsv] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const site = sites.find((s) => s.slug === siteSlug);

  const load = useCallback(async () => {
    if (!siteSlug) return;
    const res = await fetch(`/api/admin/reactivation?siteSlug=${encodeURIComponent(siteSlug)}`);
    const data = await res.json();
    setContacts(data.contacts ?? []);
  }, [siteSlug]);

  useEffect(() => { load(); }, [load]);

  async function importCsv() {
    if (!csv.trim() || busy) return;
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch("/api/admin/reactivation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteSlug, campaign, csv }),
      });
      const data = await res.json();
      if (res.ok) {
        setNotice(`✅ Imported ${data.imported} contacts`);
        setCsv("");
        load();
      } else {
        setNotice(`⚠️ ${data.error}`);
      }
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(c: Contact, status: Contact["status"]) {
    let booked_value: number | undefined;
    if (status === "booked") {
      const v = prompt("Booked value in € (treatment total):", "300");
      booked_value = v ? Number(v.replace(/[^\d.]/g, "")) || 0 : 0;
    }
    await fetch("/api/admin/reactivation", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: c.id, status, booked_value }),
    });
    load();
  }

  const visible = contacts.filter((c) => c.campaign === campaign);
  const booked = visible.filter((c) => c.status === "booked");
  const bookedValue = booked.reduce((sum, c) => sum + Number(c.booked_value || 0), 0);

  return (
    <div className="p-6 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-black text-[#18181B]">Campaigns</h1>
          <p className="text-sm text-[#71717A]">Reactivate dormant clients & collect Google reviews — zero ad spend.</p>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <select
          value={siteSlug}
          onChange={(e) => setSiteSlug(e.target.value)}
          className="bg-white border border-[#E8E6E0] rounded-lg px-3 py-2 text-sm font-semibold text-[#18181B]"
        >
          {sites.map((s) => (
            <option key={s.slug} value={s.slug}>{s.businessName}</option>
          ))}
        </select>
        <div className="flex rounded-lg border border-[#E8E6E0] overflow-hidden">
          {([
            { key: "reactivation", label: "Reactivation", icon: RefreshCcw },
            { key: "review", label: "Google reviews", icon: Star },
          ] as const).map((t) => (
            <button
              key={t.key}
              onClick={() => setCampaign(t.key)}
              className={`flex items-center gap-1.5 px-3.5 py-2 text-sm font-bold transition-colors ${
                campaign === t.key ? "bg-[#36671E] text-[#FAFAF7]" : "bg-white text-[#52525B] hover:bg-[#F5F4EF]"
              }`}
            >
              <t.icon className="w-3.5 h-3.5" /> {t.label}
            </button>
          ))}
        </div>
        {campaign === "review" && site && !site.googleReviewUrl && (
          <span className="text-xs font-semibold text-[#B45309] bg-[#FEF3C7] px-3 py-1.5 rounded-full">
            Set googleReviewUrl in this client&apos;s site config for the review link
          </span>
        )}
      </div>

      {/* Import */}
      <div className="bg-white border border-[#E8E6E0] rounded-2xl p-5 mb-6">
        <p className="text-sm font-bold text-[#18181B] mb-1 flex items-center gap-1.5">
          <Upload className="w-4 h-4 text-[#36671E]" /> Import contacts (CSV)
        </p>
        <p className="text-xs text-[#71717A] mb-3">
          Paste rows: <code className="bg-[#F5F4EF] px-1.5 py-0.5 rounded">name, phone, email, last visit, treatment</code> — header row optional, phone or email required.
        </p>
        <textarea
          value={csv}
          onChange={(e) => setCsv(e.target.value)}
          rows={5}
          placeholder={"Amina B, +33612345678, amina@mail.com, 2025-11, Détartrage\nSophie L, +33698765432, , 2025-09, Blanchiment"}
          className="w-full bg-[#FAFAF7] border border-[#E8E6E0] rounded-xl px-3 py-2.5 text-sm font-mono text-[#18181B] placeholder-[#A1A1AA] focus:outline-none focus:border-[#36671E] resize-y"
        />
        <div className="flex items-center gap-3 mt-3">
          <button
            onClick={importCsv}
            disabled={!csv.trim() || busy}
            className="px-4 py-2 rounded-lg bg-[#36671E] text-[#FAFAF7] text-sm font-bold disabled:opacity-40 hover:bg-[#295115] transition-colors"
          >
            {busy ? "Importing…" : `Import as ${campaign === "review" ? "review requests" : "reactivation"}`}
          </button>
          {notice && <span className="text-sm text-[#52525B]">{notice}</span>}
        </div>
      </div>

      {/* Stats */}
      <div className="flex gap-3 mb-4 text-sm">
        <span className="px-3 py-1.5 rounded-full bg-white border border-[#E8E6E0] font-semibold text-[#52525B]">
          {visible.length} contacts
        </span>
        <span className="px-3 py-1.5 rounded-full bg-white border border-[#E8E6E0] font-semibold text-[#52525B]">
          {visible.filter((c) => c.status === "contacted").length} contacted
        </span>
        <span className="px-3 py-1.5 rounded-full bg-[#EEF5EA] border border-[#36671E]/20 font-black text-[#36671E]">
          {booked.length} booked · €{bookedValue.toLocaleString()}
        </span>
      </div>

      {/* Contact list */}
      <div className="bg-white border border-[#E8E6E0] rounded-2xl overflow-hidden">
        {visible.length === 0 ? (
          <p className="text-sm text-[#A1A1AA] text-center py-10">No contacts in this campaign yet — import a CSV above.</p>
        ) : (
          <div className="divide-y divide-[#F5F4EF]">
            {visible.map((c) => {
              const s = STATUS_STYLE[c.status];
              const wa = site && c.phone ? waLink(c.phone, buildMessage(site, campaign, c)) : null;
              return (
                <div key={c.id} className="px-4 py-3 flex items-center gap-3">
                  <span className="text-[10px] font-black px-2 py-1 rounded-full whitespace-nowrap" style={{ background: s.bg, color: s.color }}>
                    {s.label}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-[#18181B] truncate">{c.name ?? "—"}</p>
                    <p className="text-[11px] text-[#71717A] truncate">
                      {[c.phone, c.email, c.last_visit, c.treatment].filter(Boolean).join(" · ")}
                      {c.status === "booked" && c.booked_value > 0 ? ` · €${Number(c.booked_value).toLocaleString()}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {wa && (
                      <a
                        href={wa}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => { if (c.status === "pending") setStatus(c, "contacted"); }}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#25D366] text-white text-xs font-bold hover:opacity-90 transition-opacity"
                        title="Open WhatsApp with a pre-written message"
                      >
                        <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                      </a>
                    )}
                    {c.status !== "booked" && c.status !== "opted_out" && (
                      <button
                        onClick={() => setStatus(c, "booked")}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[#36671E]/30 text-[#36671E] text-xs font-bold hover:bg-[#EEF5EA] transition-colors"
                      >
                        <Check className="w-3.5 h-3.5" /> Booked
                      </button>
                    )}
                    {c.status === "pending" && (
                      <button
                        onClick={() => setStatus(c, "opted_out")}
                        className="p-1.5 rounded-lg text-[#A1A1AA] hover:text-[#B91C1C] hover:bg-[#FEE2E2] transition-colors"
                        title="Opted out"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
