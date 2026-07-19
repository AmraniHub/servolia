"use client";

import { useState } from "react";
import { CheckCircle2, Loader2, Send } from "lucide-react";
import type { ClientService } from "@/lib/clientSites";

const T = {
  fr: {
    name: "Nom complet", namePh: "Votre nom",
    phone: "Téléphone", email: "Email",
    service: "Motif de votre visite", serviceDefault: "— Sélectionnez —", serviceOther: "Autre / je ne sais pas encore",
    when: "Jour ou horaire préféré", whenPh: "ex. jeudi matin, ou après 17h",
    message: "Votre message (facultatif)", messagePh: "Décrivez brièvement votre besoin…",
    submit: "Envoyer ma demande", sending: "Envoi…",
    successTitle: "Merci", successBody: "Votre demande a bien été envoyée. Le cabinet vous recontacte très vite pour confirmer votre rendez-vous.",
    another: "Envoyer une autre demande",
    demoNote: "Aperçu de démonstration — aucune donnée n'est réellement envoyée.",
    errName: "Merci d'indiquer votre nom.",
    errContact: "Laissez un téléphone ou un email pour qu'on puisse vous répondre.",
  },
  en: {
    name: "Full name", namePh: "Your name",
    phone: "Phone", email: "Email",
    service: "Reason for your visit", serviceDefault: "— Select —", serviceOther: "Other / not sure yet",
    when: "Preferred day or time", whenPh: "e.g. Thursday morning, or after 5pm",
    message: "Your message (optional)", messagePh: "Briefly describe what you need…",
    submit: "Send my request", sending: "Sending…",
    successTitle: "Thank you", successBody: "Your request has been sent. The practice will get back to you very soon to confirm your appointment.",
    another: "Send another request",
    demoNote: "Demo preview — no data is actually sent.",
    errName: "Please enter your name.",
    errContact: "Leave a phone or email so we can reply.",
  },
};

export default function BookingForm({
  slug, services, accent, accentDark, language, demo,
}: {
  slug: string; services: ClientService[]; accent: string; accentDark: string;
  language: "en" | "fr"; demo?: boolean;
}) {
  const t = T[language === "fr" ? "fr" : "en"];
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [service, setService] = useState("");
  const [when, setWhen] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const inputCls = "w-full rounded-xl border border-[#E4E4E7] bg-white px-3.5 py-2.5 text-sm text-[#18181B] placeholder-[#A1A1AA] focus:outline-none focus:ring-2 transition-shadow";
  const labelCls = "block text-xs font-bold text-[#52525B] mb-1.5";
  const focusRing = { ["--tw-ring-color" as string]: `${accent}55` } as React.CSSProperties;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!name.trim()) { setError(t.errName); return; }
    if (!phone.trim() && !email.trim()) { setError(t.errContact); return; }
    setBusy(true);

    // Demo sites never send anywhere — it just looks and feels real.
    if (demo) {
      await new Promise((r) => setTimeout(r, 650));
      setBusy(false); setDone(true);
      return;
    }

    try {
      await fetch(`/api/sites/${slug}/lead`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(), phone: phone.trim(), email: email.trim(),
          service, when: when.trim(), message: message.trim(),
          pageUrl: typeof window !== "undefined" ? window.location.href : undefined,
        }),
      });
    } catch { /* best-effort — the visitor still sees confirmation */ }
    setBusy(false); setDone(true);
  }

  if (done) {
    return (
      <div className="bg-white rounded-[24px] p-8 sm:p-10 text-center max-w-2xl mx-auto">
        <div className="w-14 h-14 rounded-full mx-auto flex items-center justify-center mb-4" style={{ background: `${accent}14` }}>
          <CheckCircle2 className="w-7 h-7" style={{ color: accent }} />
        </div>
        <h3 className="text-2xl font-black" style={{ color: accentDark }}>{t.successTitle}{name ? `, ${name.split(" ")[0]}` : ""} 🎉</h3>
        <p className="text-[#52525B] mt-3 leading-relaxed max-w-md mx-auto">{t.successBody}</p>
        {demo && <p className="text-xs text-[#A1A1AA] mt-4">{t.demoNote}</p>}
        <button
          onClick={() => { setDone(false); setName(""); setPhone(""); setEmail(""); setService(""); setWhen(""); setMessage(""); }}
          className="mt-6 text-sm font-bold hover:opacity-70 transition-opacity" style={{ color: accent }}>
          {t.another}
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="bg-white rounded-[24px] p-6 sm:p-8 max-w-2xl mx-auto text-left" noValidate>
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label className={labelCls} htmlFor="bf-name">{t.name} *</label>
          <input id="bf-name" value={name} onChange={(e) => setName(e.target.value)} placeholder={t.namePh} className={inputCls} style={focusRing} autoComplete="name" />
        </div>
        <div>
          <label className={labelCls} htmlFor="bf-phone">{t.phone}</label>
          <input id="bf-phone" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputCls} style={focusRing} inputMode="tel" autoComplete="tel" />
        </div>
        <div>
          <label className={labelCls} htmlFor="bf-email">{t.email}</label>
          <input id="bf-email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} style={focusRing} inputMode="email" autoComplete="email" />
        </div>
        {services.length > 0 && (
          <div className="sm:col-span-2">
            <label className={labelCls} htmlFor="bf-service">{t.service}</label>
            <select id="bf-service" value={service} onChange={(e) => setService(e.target.value)} className={inputCls} style={focusRing}>
              <option value="">{t.serviceDefault}</option>
              {services.map((s, i) => <option key={i} value={s.name}>{s.name}</option>)}
              <option value="__other">{t.serviceOther}</option>
            </select>
          </div>
        )}
        <div className="sm:col-span-2">
          <label className={labelCls} htmlFor="bf-when">{t.when}</label>
          <input id="bf-when" value={when} onChange={(e) => setWhen(e.target.value)} placeholder={t.whenPh} className={inputCls} style={focusRing} />
        </div>
        <div className="sm:col-span-2">
          <label className={labelCls} htmlFor="bf-msg">{t.message}</label>
          <textarea id="bf-msg" value={message} onChange={(e) => setMessage(e.target.value)} placeholder={t.messagePh} rows={3} className={`${inputCls} resize-none`} style={focusRing} />
        </div>
      </div>

      {error && <p className="text-sm text-[#DC2626] mt-3">{error}</p>}

      <button type="submit" disabled={busy}
        className="mt-5 w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-white font-black text-base hover:opacity-90 transition-opacity disabled:opacity-60"
        style={{ background: accent }}>
        {busy ? <><Loader2 className="w-4 h-4 animate-spin" /> {t.sending}</> : <><Send className="w-4 h-4" /> {t.submit}</>}
      </button>
    </form>
  );
}
