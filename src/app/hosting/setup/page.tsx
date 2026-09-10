import type { Metadata } from "next";
import Link from "next/link";
import SetupForm from "@/components/SetupForm";
import { readUpgradeToken, subscriptionContext, referenceFor } from "@/lib/upgrade";

export const metadata: Metadata = {
  title: "Set up your hosting",
  robots: { index: false, follow: false },
};

/**
 * THE STEP BETWEEN PAYING AND BEING HOSTED.
 *
 * Without it a self-serve payment tells us an amount and an email: the site is
 * on somebody else's server and the domain is at a registrar we cannot see, so
 * the money has bought a promise nobody can act on. Worse, the thank-you page
 * used to tell that buyer "nothing to switch over" — true for a client whose
 * site we already run, and a plain falsehood for one who has just arrived.
 *
 * It also gives both sides a reference. A client who pays and then hears
 * nothing has no way to connect the charge on their card to work happening on
 * their site, and "the hosting I bought" is not a thing either of us can look
 * up. SV-XXXXXX is.
 */
export default async function SetupPage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string }>;
}) {
  const { t: token = "" } = await searchParams;
  const subscriptionId = token ? await readUpgradeToken(token) : null;
  const ctx = subscriptionId ? await subscriptionContext(subscriptionId) : null;

  const fr = ctx?.lang === "fr";

  return (
    <main className="min-h-screen bg-[#FAFAF7] flex flex-col">
      <header className="px-5 py-6 border-b border-[#E8E6E0] bg-white">
        <div className="max-w-xl mx-auto">
          <Link href="/" className="inline-flex items-center">
            <span className="text-xl font-black tracking-tight text-[#18181B]">
              Serv<span className="gradient-text">olia</span>
            </span>
          </Link>
        </div>
      </header>

      <div className="flex-1 px-5 py-12 sm:py-16">
        <div className="max-w-xl mx-auto">
          {!subscriptionId || !ctx ? (
            <div className="rounded-2xl border border-[#E8E6E0] bg-white p-7 text-center">
              <h1 className="text-xl font-black text-[#18181B] mb-2">This link has expired</h1>
              <p className="text-sm text-[#52525B] leading-relaxed">
                Reply to your payment confirmation and we will send a fresh one.
              </p>
            </div>
          ) : (
            <>
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#36671E] mb-3">
                {fr ? "Étape 2 sur 2" : "Step 2 of 2"}
              </p>
              <h1 className="text-3xl sm:text-[34px] font-black text-[#161A15] tracking-tight mb-3">
                {fr ? "Où se trouve votre site ?" : "Where does your site live?"}
              </h1>
              <p className="text-[#52525B] leading-relaxed mb-2">
                {fr
                  ? "Votre paiement est bien reçu. Il nous manque seulement de savoir où se trouvent votre site et votre domaine aujourd'hui — c'est la seule chose qui nous empêche de commencer."
                  : "Your payment is in. All we need now is where your site and domain live today — it is the only thing standing between us and getting started."}
              </p>
              <p className="text-[13px] text-[#8A8A80] mb-8">
                {fr ? "Votre référence" : "Your reference"}{" "}
                <span className="font-bold text-[#5E6659] tabular-nums">{referenceFor(subscriptionId)}</span>
                {ctx.siteLabel ? <> · {ctx.siteLabel}</> : null}
              </p>

              <SetupForm
                token={token}
                reference={referenceFor(subscriptionId)}
                lang={ctx.lang}
                initialSiteUrl={ctx.siteLabel}
              />
            </>
          )}
        </div>
      </div>

      <footer className="px-5 py-8 border-t border-[#E8E6E0] bg-white">
        <div className="max-w-xl mx-auto text-center">
          <p className="text-xs text-[#8A8A80]">
            {fr ? "Fourni par " : "Provided by "}
            <span className="font-bold text-[#52525B]">Servolia LLC</span> · Wyoming, USA
          </p>
        </div>
      </footer>
    </main>
  );
}
