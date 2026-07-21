"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Mail, ArrowRight, RefreshCw, CheckCircle2, MessageSquare, FileText, Clock, Lock, Languages } from "lucide-react";

type Lang = "en" | "fr";

const T = {
  en: {
    heroTitle: "Your Servolia account", heroSub: "Track your project and message us directly — no password needed.",
    checkEmail: "Check your email", sentTo: (e: string) => <>We sent a login link to <strong className="text-[#18181B]">{e}</strong>. Click it to open your account — it expires in 15 minutes.</>,
    login: "Log in", linkDesc: "Enter your email and we'll send you a one-click login link.", pwDesc: "Log in with your email and password.",
    emailLabel: "Email address", pwLabel: "Password", pwPlaceholder: "Your password",
    sending: "Sending…", loggingIn: "Logging in…", sendLink: "Send me a login link", logInBtn: "Log in",
    preferPw: "Prefer a password? Log in with password", useLink: "Use a one-click email link instead",
    chipTrack: "Track your project", chipMessage: "Message us directly", needHelp: "Need help right now?",
    errExpired: "That login link expired — request a new one below.", errMissing: "That login link was invalid — request a new one below.",
    errLogin: "Login failed.", errConn: "Connection error. Please try again.", errGeneric: "Something went wrong. Please try again.",
    errNoEmail: "We couldn't send the email right now — please write to hello@servolia.com and we'll log you in.",
    toggleLang: "Passer en français",
  },
  fr: {
    heroTitle: "Votre compte Servolia", heroSub: "Suivez votre projet et écrivez-nous directement — sans mot de passe.",
    checkEmail: "Vérifiez vos emails", sentTo: (e: string) => <>Nous avons envoyé un lien de connexion à <strong className="text-[#18181B]">{e}</strong>. Cliquez dessus pour ouvrir votre compte — il expire dans 15 minutes.</>,
    login: "Connexion", linkDesc: "Entrez votre email et nous vous enverrons un lien de connexion en un clic.", pwDesc: "Connectez-vous avec votre email et votre mot de passe.",
    emailLabel: "Adresse email", pwLabel: "Mot de passe", pwPlaceholder: "Votre mot de passe",
    sending: "Envoi…", loggingIn: "Connexion…", sendLink: "Envoyez-moi un lien", logInBtn: "Se connecter",
    preferPw: "Vous préférez un mot de passe ? Connectez-vous avec un mot de passe", useLink: "Utiliser plutôt un lien email en un clic",
    chipTrack: "Suivez votre projet", chipMessage: "Écrivez-nous directement", needHelp: "Besoin d'aide maintenant ?",
    errExpired: "Ce lien de connexion a expiré — demandez-en un nouveau ci-dessous.", errMissing: "Ce lien de connexion était invalide — demandez-en un nouveau ci-dessous.",
    errLogin: "Échec de la connexion.", errConn: "Erreur de connexion. Réessayez.", errGeneric: "Une erreur est survenue. Réessayez.",
    errNoEmail: "Nous n'avons pas pu envoyer l'email — écrivez à hello@servolia.com et nous vous connecterons.",
    toggleLang: "Switch to English",
  },
};

function LoginForm() {
  const params = useSearchParams();
  const urlError = params.get("error"); // "expired" | "missing" | null

  const [lang, setLang] = useState<Lang>("en");
  const t = T[lang];

  useEffect(() => {
    const saved = localStorage.getItem("servolia_portal_lang");
    if (saved === "fr" || saved === "en") setLang(saved);
    else if (navigator.language?.toLowerCase().startsWith("fr")) setLang("fr");
  }, []);
  const toggleLang = () => setLang((v) => {
    const nx: Lang = v === "en" ? "fr" : "en";
    localStorage.setItem("servolia_portal_lang", nx);
    return nx;
  });

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"link" | "password">("link");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  // URL error is shown in the current language until a live action sets its own.
  const urlErrorMsg = urlError === "expired" ? t.errExpired : urlError === "missing" ? t.errMissing : "";
  const shownError = error || urlErrorMsg;

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/portal/login-password", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (res.ok) {
        window.location.href = "/portal";
      } else {
        const data = await res.json();
        setError(data.error ?? t.errLogin);
      }
    } catch {
      setError(t.errConn);
    }
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/portal/request-link", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? t.errGeneric);
      } else if (data.emailSent === false) {
        setError(t.errNoEmail);
      } else {
        setSent(true);
      }
    } catch {
      setError(t.errConn);
    }
    setLoading(false);
  };

  return (
    <main className="min-h-screen bg-[#FAFAF7]">
      <Navbar />
      <section className="pt-28 pb-20 lg:pt-36">
        <div className="max-w-lg mx-auto px-4 sm:px-6">
          <div className="text-center mb-10">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#36671E] to-[#295115] flex items-center justify-center mx-auto mb-5 shadow-lg shadow-[#36671E]/15">
              <MessageSquare className="w-7 h-7 text-[#FAFAF7]" />
            </div>
            <h1 className="text-3xl font-black text-[#18181B] mb-3">{t.heroTitle}</h1>
            <p className="text-[#52525B] text-sm leading-relaxed">{t.heroSub}</p>
          </div>

          <div className="bg-[#F5F4EF] border border-[#D4D2CC] rounded-2xl p-8">
            {/* Language toggle */}
            <div className="flex justify-end mb-2">
              <button onClick={toggleLang} title={t.toggleLang}
                className="flex items-center gap-1.5 text-xs font-black text-[#52525B] hover:text-[#36671E] transition-colors">
                <Languages className="w-3.5 h-3.5" /> {lang === "en" ? "FR" : "EN"}
              </button>
            </div>
            {sent ? (
              <div className="text-center py-4">
                <CheckCircle2 className="w-10 h-10 text-[#36671E] mx-auto mb-4" />
                <h2 className="text-[#18181B] font-black mb-2">{t.checkEmail}</h2>
                <p className="text-[#71717A] text-sm leading-relaxed">{t.sentTo(email)}</p>
              </div>
            ) : (
              <>
                <h2 className="text-[#18181B] font-black mb-1">{t.login}</h2>
                <p className="text-[#71717A] text-sm mb-6">{mode === "link" ? t.linkDesc : t.pwDesc}</p>

                <form onSubmit={mode === "link" ? handleSubmit : handlePasswordLogin} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-[#52525B] uppercase tracking-widest mb-2">{t.emailLabel}</label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-[#A1A1AA] absolute left-4 top-1/2 -translate-y-1/2" />
                      <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@yourbusiness.com" autoComplete="email"
                        className="w-full pl-11 pr-4 py-3 rounded-xl bg-white border border-[#D4D2CC] text-[#18181B] placeholder:text-[#A1A1AA] focus:outline-none focus:border-[#36671E]/60 focus:ring-1 focus:ring-[#36671E]/30 text-sm transition-all" />
                    </div>
                  </div>

                  {mode === "password" && (
                    <div>
                      <label className="block text-xs font-bold text-[#52525B] uppercase tracking-widest mb-2">{t.pwLabel}</label>
                      <div className="relative">
                        <Lock className="w-4 h-4 text-[#A1A1AA] absolute left-4 top-1/2 -translate-y-1/2" />
                        <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
                          placeholder={t.pwPlaceholder} autoComplete="current-password"
                          className="w-full pl-11 pr-4 py-3 rounded-xl bg-white border border-[#D4D2CC] text-[#18181B] placeholder:text-[#A1A1AA] focus:outline-none focus:border-[#36671E]/60 focus:ring-1 focus:ring-[#36671E]/30 text-sm transition-all" />
                      </div>
                    </div>
                  )}

                  {shownError && (
                    <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm">{shownError}</div>
                  )}

                  <button type="submit" disabled={loading}
                    className="w-full py-3.5 rounded-xl bg-gradient-to-r from-[#36671E] to-[#295115] text-[#FAFAF7] font-black text-sm hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                    {loading
                      ? (<><RefreshCw className="w-4 h-4 animate-spin" /> {mode === "link" ? t.sending : t.loggingIn}</>)
                      : mode === "link"
                        ? (<>{t.sendLink} <ArrowRight className="w-4 h-4" /></>)
                        : (<>{t.logInBtn} <ArrowRight className="w-4 h-4" /></>)}
                  </button>
                </form>

                <button onClick={() => { setMode(mode === "link" ? "password" : "link"); setError(""); }}
                  className="mt-4 w-full text-center text-xs font-bold text-[#36671E] hover:underline">
                  {mode === "link" ? t.preferPw : t.useLink}
                </button>
              </>
            )}
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3">
            {[
              { icon: <FileText className="w-4 h-4" />, label: t.chipTrack },
              { icon: <Clock className="w-4 h-4" />, label: t.chipMessage },
            ].map((item, i) => (
              <div key={i} className="flex flex-col items-center gap-2 p-4 rounded-xl bg-white border border-[#E8E6E0] text-center">
                <div className="text-[#36671E]">{item.icon}</div>
                <p className="text-xs text-[#71717A] font-medium">{item.label}</p>
              </div>
            ))}
          </div>

          <p className="text-center text-xs text-[#A1A1AA] mt-6">
            {t.needHelp}{" "}
            <a href="mailto:hello@servolia.com" className="text-[#36671E] hover:underline">hello@servolia.com</a>
          </p>
        </div>
      </section>
      <Footer />
    </main>
  );
}

export default function PortalLoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
