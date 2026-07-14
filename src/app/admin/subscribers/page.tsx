"use client";

import { useEffect, useState } from "react";
import { Download, Mail, Search } from "lucide-react";

type Subscriber = { email: string; source: string; language: string; status: string; consented_at: string; created_at: string };

export default function SubscribersPage() {
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/subscribers").then((response) => response.json()).then((data) => setSubscribers(data.subscribers ?? [])).finally(() => setLoading(false));
  }, []);

  const visible = subscribers.filter(({ email }) => email.includes(search.trim().toLowerCase()));

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-[#18181B]">Email audience</h1>
          <p className="mt-1 text-sm text-[#71717A]">{subscribers.length} opted-in contacts for campaigns and marketing.</p>
        </div>
        <a href="/api/admin/subscribers?format=csv" download className="flex items-center gap-1.5 rounded-lg bg-[#36671E] px-4 py-2.5 text-sm font-semibold text-[#FAFAF7] hover:bg-[#295115]">
          <Download className="h-4 w-4" /> Export CSV
        </a>
      </div>

      <div className="mb-5 max-w-md">
        <label className="relative block">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#A1A1AA]" />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search email…" className="w-full rounded-xl border border-[#E8E6E0] bg-white py-2.5 pl-9 pr-4 text-sm focus:border-[#36671E] focus:outline-none" />
        </label>
      </div>

      <div className="overflow-hidden rounded-2xl border border-[#E8E6E0] bg-white">
        {loading ? <p className="p-8 text-center text-sm text-[#A1A1AA]">Loading…</p> : visible.length === 0 ? <p className="p-8 text-center text-sm text-[#A1A1AA]">No subscribers yet.</p> : (
          <div className="divide-y divide-[#F5F4EF]">
            {visible.map((subscriber) => (
              <div key={subscriber.email} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#EEF5EA] text-[#36671E]"><Mail className="h-4 w-4" /></span>
                  <div className="min-w-0"><p className="truncate text-sm font-semibold text-[#18181B]">{subscriber.email}</p><p className="text-xs text-[#71717A]">Opted in {new Date(subscriber.consented_at ?? subscriber.created_at).toLocaleDateString()}</p></div>
                </div>
                <div className="flex items-center gap-2 text-xs font-semibold text-[#52525B]"><span className="rounded-full bg-[#F5F4EF] px-2.5 py-1">{subscriber.source}</span><span className="rounded-full bg-[#F5F4EF] px-2.5 py-1 uppercase">{subscriber.language}</span></div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
