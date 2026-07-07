"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight, UserPlus } from "lucide-react";

const NICHES = ["dental","aesthetic","med-spa","real-estate","home-services","cosmetic-surgery","veterinary","law-firm","wealth-management","ivf","other"];
const SOURCES = ["cold-email","referral","linkedin","instagram","google","event","other"];
const STAGES = ["new","audit_sent","qualified","deposit_paid","live","lost"];

export default function NewLeadPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    business: "", name: "", email: "", phone: "", website: "", country: "", city: "",
    niche: "", source: "cold-email", stage: "new", plan_interest: "", notes: "",
  });

  const set = (k: keyof typeof form, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/admin/leads/create", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setSaving(false);
    if (data.lead_id) router.push(`/admin/leads/${data.lead_id}`);
  };

  const input = "w-full px-4 py-2.5 rounded-xl bg-white border border-[#E8E6E0] text-sm text-[#18181B] focus:outline-none focus:border-[#36671E] focus:ring-2 focus:ring-[#36671E]/10 transition-all";
  const label = "block text-xs font-bold text-[#71717A] uppercase tracking-widest mb-1.5";

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 lg:py-8 max-w-2xl mx-auto">
      <Link href="/admin/leads" className="inline-flex items-center gap-1.5 text-sm text-[#71717A] hover:text-[#18181B] mb-4">
        <ArrowLeft className="w-4 h-4" /> All leads
      </Link>

      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-[#36671E] flex items-center justify-center">
          <UserPlus className="w-5 h-5 text-[#FAFAF7]" />
        </div>
        <div>
          <h1 className="text-xl font-black text-[#18181B]">New lead</h1>
          <p className="text-sm text-[#71717A]">Add a lead from cold outreach, a referral, or a phone call</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-white border border-[#E8E6E0] rounded-2xl p-6 space-y-5">

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className={label}>Business name *</label>
            <input required value={form.business} onChange={(e) => set("business", e.target.value)} className={input} placeholder="Cabinet Dentaire Martin" />
          </div>
          <div>
            <label className={label}>Contact name</label>
            <input value={form.name} onChange={(e) => set("name", e.target.value)} className={input} placeholder="Dr. Sophie Martin" />
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className={label}>Email</label>
            <input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} className={input} placeholder="contact@cabinet.fr" />
          </div>
          <div>
            <label className={label}>Phone</label>
            <input value={form.phone} onChange={(e) => set("phone", e.target.value)} className={input} placeholder="+33 6 12 34 56 78" />
          </div>
        </div>

        <div>
          <label className={label}>Website</label>
          <input value={form.website} onChange={(e) => set("website", e.target.value)} className={input} placeholder="https://cabinet-martin.fr" />
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className={label}>City</label>
            <input value={form.city} onChange={(e) => set("city", e.target.value)} className={input} placeholder="Paris" />
          </div>
          <div>
            <label className={label}>Country</label>
            <input value={form.country} onChange={(e) => set("country", e.target.value)} className={input} placeholder="France" />
          </div>
        </div>

        <div className="grid sm:grid-cols-3 gap-4">
          <div>
            <label className={label}>Niche</label>
            <select value={form.niche} onChange={(e) => set("niche", e.target.value)} className={input}>
              <option value="">—</option>
              {NICHES.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div>
            <label className={label}>Source</label>
            <select value={form.source} onChange={(e) => set("source", e.target.value)} className={input}>
              {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className={label}>Stage</label>
            <select value={form.stage} onChange={(e) => set("stage", e.target.value)} className={input}>
              {STAGES.map(s => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className={label}>Plan interest</label>
          <input value={form.plan_interest} onChange={(e) => set("plan_interest", e.target.value)} className={input} placeholder="Booking System €990" />
        </div>

        <div>
          <label className={label}>Notes</label>
          <textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={3} className={`${input} resize-none`} placeholder="Met at conference. Wants to launch by Sept. Budget approved." />
        </div>

        <div className="flex gap-3 pt-2 border-t border-[#F5F4EF]">
          <Link href="/admin/leads" className="px-5 py-2.5 rounded-xl border border-[#E8E6E0] text-[#18181B] text-sm font-semibold hover:bg-[#F5F4EF]">Cancel</Link>
          <button type="submit" disabled={saving || !form.business}
            className="flex-1 px-5 py-2.5 rounded-xl bg-[#36671E] text-[#FAFAF7] text-sm font-semibold hover:bg-[#295115] disabled:opacity-50 flex items-center justify-center gap-2">
            {saving ? "Saving…" : <>Create lead <ArrowRight className="w-4 h-4" /></>}
          </button>
        </div>
      </form>
    </div>
  );
}
