"use client";

import { useState, useEffect } from "react";
import { Calendar, Clock, CheckCircle2, ArrowRight, ArrowLeft, Phone, RefreshCw } from "lucide-react";

/**
 * Discovery-call booking widget — branded slot picker (not a generic Calendly).
 * Step 1: pick a day + time. Step 2: enter details. Then confirmation.
 */

interface Day { key: string; label: string; slots: { iso: string; label: string }[] }

export default function BookingWidget({ lang = "en" }: { lang?: "en" | "fr" }) {
  const fr = lang === "fr";
  const [days, setDays] = useState<Day[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(true);
  const [activeDay, setActiveDay] = useState(0);
  const [slot, setSlot] = useState<{ iso: string; label: string; dayLabel: string } | null>(null);
  const [step, setStep] = useState<1 | 2>(1);
  const [form, setForm] = useState({ name: "", email: "", phone: "", business: "", message: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<{ when: string } | null>(null);

  useEffect(() => {
    fetch(`/api/book/slots?lang=${lang}`)
      .then((r) => r.json())
      .then((d) => setDays(d.days ?? []))
      .catch(() => setError("Could not load times"))
      .finally(() => setLoadingSlots(false));
  }, [lang]);

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function submit() {
    if (!form.name.trim() || !form.email.trim() || !slot || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, slot: slot.iso, lang }),
      });
      const data = await res.json();
      if (res.ok) setDone({ when: data.when });
      else setError(data.error ?? "Something went wrong");
    } catch {
      setError("Connection error");
    }
    setSubmitting(false);
  }

  const t = fr ? {
    kicker: "Appel découverte gratuit", h1: "Réservez 30 minutes avec nous",
    sub: "On vous montre exactement combien de demandes votre cabinet perd — et comment les récupérer. Sans engagement.",
    pickDay: "Choisissez un jour", pickTime: "Choisissez une heure", noSlots: "Aucun créneau disponible pour le moment — écrivez-nous à hello@servolia.com.",
    continue: "Continuer", back: "Retour", yourDetails: "Vos coordonnées",
    name: "Nom complet", email: "Email", phone: "Téléphone (optionnel)", business: "Cabinet / entreprise",
    msg: "Un mot sur votre situation ? (optionnel)", confirm: "Confirmer le rendez-vous",
    selected: "Créneau choisi", doneTitle: "C'est confirmé 🎉",
    doneSub: (w: string) => `Votre appel est réservé pour le ${w}. Un email de confirmation vient de partir.`,
  } : {
    kicker: "Free discovery call", h1: "Book 30 minutes with us",
    sub: "We'll show you exactly how many enquiries your clinic is losing — and how to recover them. No commitment.",
    pickDay: "Pick a day", pickTime: "Pick a time", noSlots: "No slots available right now — email us at hello@servolia.com.",
    continue: "Continue", back: "Back", yourDetails: "Your details",
    name: "Full name", email: "Email", phone: "Phone (optional)", business: "Clinic / business",
    msg: "A word about your situation? (optional)", confirm: "Confirm booking",
    selected: "Selected slot", doneTitle: "You're booked 🎉",
    doneSub: (w: string) => `Your call is confirmed for ${w}. A confirmation email just went out.`,
  };

  const day = days[activeDay];

  return (
    <section className="pt-28 pb-20 lg:pt-32">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        {/* Header */}
        <div className="text-center mb-8">
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#EEF5EA] text-[#36671E] text-xs font-black uppercase tracking-widest mb-4">
            <Phone className="w-3.5 h-3.5" /> {t.kicker}
          </span>
          <h1 className="text-3xl sm:text-4xl font-black text-[#18181B] mb-3">{t.h1}</h1>
          <p className="text-[#52525B] text-base max-w-xl mx-auto leading-relaxed">{t.sub}</p>
        </div>

        {done ? (
          <div className="bg-white border border-[#E8E6E0] rounded-3xl p-10 text-center shadow-card">
            <div className="w-16 h-16 rounded-2xl bg-[#EEF5EA] flex items-center justify-center mx-auto mb-5">
              <CheckCircle2 className="w-8 h-8 text-[#36671E]" />
            </div>
            <h2 className="text-2xl font-black text-[#18181B] mb-2">{t.doneTitle}</h2>
            <p className="text-[#52525B] leading-relaxed max-w-md mx-auto">{t.doneSub(done.when)}</p>
          </div>
        ) : (
          <div className="bg-white border border-[#E8E6E0] rounded-3xl overflow-hidden shadow-card">
            {/* Step indicator */}
            <div className="flex">
              {[1, 2].map((n) => (
                <div key={n} className={`flex-1 h-1 ${step >= n ? "bg-[#36671E]" : "bg-[#E8E6E0]"}`} />
              ))}
            </div>

            {step === 1 && (
              <div className="p-6 sm:p-8">
                {loadingSlots ? (
                  <div className="py-16 text-center text-[#A1A1AA]"><RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" /> …</div>
                ) : days.length === 0 ? (
                  <p className="py-12 text-center text-[#71717A]">{t.noSlots}</p>
                ) : (
                  <>
                    <p className="text-sm font-black text-[#18181B] flex items-center gap-2 mb-3">
                      <Calendar className="w-4 h-4 text-[#36671E]" /> {t.pickDay}
                    </p>
                    <div className="flex gap-2 overflow-x-auto pb-2 mb-6">
                      {days.map((d, i) => (
                        <button
                          key={d.key}
                          onClick={() => { setActiveDay(i); setSlot(null); }}
                          className={`flex-shrink-0 px-4 py-2.5 rounded-xl text-sm font-bold border transition-colors ${
                            i === activeDay ? "bg-[#36671E] text-white border-[#36671E]" : "bg-white text-[#52525B] border-[#E8E6E0] hover:border-[#36671E]/40"
                          }`}
                        >
                          {d.label}
                        </button>
                      ))}
                    </div>

                    <p className="text-sm font-black text-[#18181B] flex items-center gap-2 mb-3">
                      <Clock className="w-4 h-4 text-[#36671E]" /> {t.pickTime}
                    </p>
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                      {day?.slots.map((s) => (
                        <button
                          key={s.iso}
                          onClick={() => setSlot({ iso: s.iso, label: s.label, dayLabel: day.label })}
                          className={`py-2.5 rounded-xl text-sm font-bold border transition-colors ${
                            slot?.iso === s.iso ? "bg-[#36671E] text-white border-[#36671E]" : "bg-[#FAFAF7] text-[#18181B] border-[#E8E6E0] hover:border-[#36671E]/50"
                          }`}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>

                    <button
                      onClick={() => setStep(2)}
                      disabled={!slot}
                      className="mt-7 w-full py-3.5 rounded-xl bg-[#36671E] text-white font-black text-sm hover:bg-[#295115] transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
                    >
                      {t.continue} <ArrowRight className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>
            )}

            {step === 2 && slot && (
              <div className="p-6 sm:p-8">
                <div className="flex items-center justify-between mb-6">
                  <button onClick={() => setStep(1)} className="flex items-center gap-1.5 text-sm font-bold text-[#52525B] hover:text-[#18181B]">
                    <ArrowLeft className="w-4 h-4" /> {t.back}
                  </button>
                  <div className="px-3 py-1.5 rounded-lg bg-[#EEF5EA] text-[#36671E] text-xs font-black">
                    {t.selected}: {slot.dayLabel} · {slot.label}
                  </div>
                </div>

                <p className="text-sm font-black text-[#18181B] mb-4">{t.yourDetails}</p>
                <div className="grid sm:grid-cols-2 gap-3">
                  <input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder={t.name} className={inp} />
                  <input value={form.email} onChange={(e) => set("email", e.target.value)} placeholder={t.email} type="email" className={inp} />
                  <input value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder={t.phone} className={inp} />
                  <input value={form.business} onChange={(e) => set("business", e.target.value)} placeholder={t.business} className={inp} />
                </div>
                <textarea value={form.message} onChange={(e) => set("message", e.target.value)} placeholder={t.msg} rows={3} className={`${inp} w-full mt-3 resize-y`} />

                {error && <p className="text-sm text-[#B91C1C] mt-3">{error}</p>}

                <button
                  onClick={submit}
                  disabled={!form.name.trim() || !form.email.trim() || submitting}
                  className="mt-5 w-full py-3.5 rounded-xl bg-[#36671E] text-white font-black text-sm hover:bg-[#295115] transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
                >
                  {submitting ? (<><RefreshCw className="w-4 h-4 animate-spin" /> …</>) : (<>{t.confirm} <CheckCircle2 className="w-4 h-4" /></>)}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

const inp = "bg-[#FAFAF7] border border-[#E8E6E0] rounded-xl px-3.5 py-2.5 text-sm text-[#18181B] placeholder-[#A1A1AA] focus:outline-none focus:border-[#36671E]";
