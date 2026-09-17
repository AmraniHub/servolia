import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { getClientSite, slugify } from "@/lib/clientSites";
import { assistantEnabled, previewable } from "@/lib/assistantAccess";
import { clientRefFor } from "@/lib/clientRefs";
import { CLIENT_PRODUCTS } from "@/lib/hosting";
import PageLang from "@/components/PageLang";

export const metadata: Metadata = {
  title: "Try your assistant",
  robots: { index: false, follow: false },
};

/**
 * THE SHOWROOM — the client's REAL assistant, before they have paid for it.
 *
 * Servolia builds a hosting client's assistant from their own website the
 * moment they become a client (the briefs in assistantSites.ts). This page
 * is where they meet it: the same script, the same API, the same brief a
 * visitor to their site would meet, wearing their name and their colours.
 * They ask it what a customer would ask, and it answers as their business.
 *
 * Until 2026-09-17 this page said "if it does not appear, the subscription
 * is not active yet" — and for every unpaid client it did not appear. A
 * try page that shows nothing to the person it exists for is a link that
 * should never have been sent. Now the script is loaded with data-preview,
 * the API answers it from Servolia's own pages only, and the page says
 * plainly which of the two it is showing: a preview, or the live one.
 *
 * A preview conversation persists nothing and notifies nobody; the page
 * says so, because "on your site, this reaches your phone" is the promise
 * and the owner should not expect their own test to ring it.
 *
 * The script is pointed at THIS host rather than the hard-coded production
 * origin, so the page works on a preview deployment and on localhost.
 */
export default async function TryAssistantPage({
  searchParams,
}: {
  searchParams: Promise<{ site?: string; lang?: string }>;
}) {
  const { site = "", lang: rawLang = "" } = await searchParams;
  // Only the three literals: this value is written into an inline script.
  const lang = rawLang === "ar" || rawLang === "fr" || rawLang === "en" ? rawLang : "";
  const slug = slugify(site);
  const config = slug ? await getClientSite(slug) : undefined;
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "https";
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "servolia.com";
  const origin = `${proto}://${host}`;
  const fr = (lang || config?.language) === "fr";

  const live = config ? await assistantEnabled(config) : false;
  const preview = Boolean(config) && !live && previewable(config!);
  // A known client's pay page. For every client Servolia builds for, the
  // slug is their reference; a brief written through the settings page for
  // a paying client has no ref here, and then there is nothing to sell.
  const ref = config && !live ? clientRefFor(slug) : undefined;
  const payUrl = ref ? `/hosting?plan=chatbot&ref=${encodeURIComponent(slug)}` : null;
  const price = CLIENT_PRODUCTS.chatbot;

  return (
    <main className="min-h-screen bg-[#FAFAF7] flex flex-col" lang={lang || config?.language || "en"}>
      <header className="px-5 py-6 border-b border-[#E8E6E0] bg-white">
        <div className="max-w-xl mx-auto">
          <Link href="/" className="inline-flex items-center">
            <span className="text-xl font-black tracking-tight text-[#18181B]">
              Serv<span className="gradient-text">olia</span>
            </span>
          </Link>
        </div>
      </header>

      <div className="flex-1 px-5 py-16">
        <div className="max-w-xl mx-auto">
          {config && (live || preview) ? (
            <>
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#36671E] mb-3" data-testid="try-eyebrow">
                {live
                  ? (fr ? "Votre assistant, en ligne" : "Your assistant, live")
                  : (fr ? "Construit par Servolia pour vous" : "Built by Servolia for you")}
              </p>
              <h1 className="text-3xl font-black text-[#161A15] tracking-tight mb-3">
                {config.businessName}
              </h1>
              <p className="text-[#52525B] leading-relaxed" data-testid="try-lede">
                {live
                  ? (fr
                      ? "L'assistant est en bas de cette page — exactement celui que vos visiteurs rencontrent sur votre site. Posez-lui les questions qu'un client poserait."
                      : "The assistant is at the bottom of this page — exactly the one your visitors meet on your site. Ask it what a customer would.")
                  : (fr
                      ? "C'est votre assistant — le vrai, formé sur votre site, à votre nom et à vos couleurs. Il est en bas de cette page : posez-lui les questions qu'un client poserait, dans la langue que vous voulez."
                      : "This is your assistant — the real one, trained on your website, in your name and your colours. It is at the bottom of this page: ask it what a customer would, in whichever language you like.")}
              </p>

              {preview ? (
                <div className="mt-6 rounded-2xl border border-[#E8E6E0] bg-white p-5" data-testid="try-preview-note">
                  <p className="text-[13.5px] text-[#3F3F46] leading-relaxed">
                    {fr
                      ? "Ceci est un aperçu sur servolia.com : rien n'est enregistré et personne n'est prévenu. Sur votre site, chaque demande qu'il prend arrive sur votre téléphone, jour et nuit."
                      : "This is a preview on servolia.com: nothing is saved and nobody is alerted. On your site, every enquiry it takes reaches your phone, day and night."}
                  </p>
                  <p className="mt-2 text-[13.5px] text-[#3F3F46] leading-relaxed">
                    {fr
                      ? "Vous voulez qu'il dise, propose ou évite quelque chose ? Le lien vers sa page de réglages est dans votre email de Servolia et sur votre page de service."
                      : "Want it to say, offer or avoid something? The link to its settings page is in your email from Servolia and on your service page."}
                  </p>
                  {payUrl ? (
                    <div className="mt-4 flex flex-wrap items-center gap-3">
                      <Link
                        href={payUrl}
                        data-testid="try-activate"
                        className="inline-flex items-center justify-center h-11 px-6 rounded-xl bg-gradient-to-r from-[#36671E] to-[#295115] text-[#FAFAF7] text-[14px] font-bold hover:opacity-90 transition"
                      >
                        {fr ? "L'activer sur mon site →" : "Turn it on for my site →"}
                      </Link>
                      <span className="text-[12.5px] text-[#71717A]">
                        {fr
                          ? `${price.monthlyUsd} $/mois ou ${price.annualUsd} $/an · installé pour vous · résiliable à tout moment`
                          : `$${price.monthlyUsd}/month or $${price.annualUsd}/year · installed for you · cancel anytime`}
                      </span>
                    </div>
                  ) : null}
                </div>
              ) : null}

              <p className="mt-6 text-[13px] text-[#8A8A80]">
                {fr
                  ? "Astuce : changez la langue de la page pour le voir répondre en arabe, en français ou en anglais."
                  : "Tip: switch this page's language to see it answer in Arabic, French or English."}
                {" "}
                {(config.languages ?? ["ar", "fr", "en"]).map((l) => (
                  <Link key={l} href={`?site=${encodeURIComponent(slug)}&lang=${l}`} className="ml-2 font-bold text-[#36671E] hover:underline">
                    {l.toUpperCase()}
                  </Link>
                ))}
              </p>
            </>
          ) : config ? (
            <div className="rounded-2xl border border-[#E8E6E0] bg-white p-7 text-center">
              <h1 className="text-xl font-black text-[#18181B] mb-2">{config.businessName}</h1>
              <p className="text-sm text-[#52525B]">
                {fr ? "Cet assistant est désactivé." : "This assistant is switched off."}
              </p>
            </div>
          ) : (
            <div className="rounded-2xl border border-[#E8E6E0] bg-white p-7 text-center">
              <h1 className="text-xl font-black text-[#18181B] mb-2">No assistant here</h1>
              <p className="text-sm text-[#52525B]">This link names an assistant that does not exist.</p>
            </div>
          )}
        </div>
      </div>

      {config && (live || preview) ? (
        <>
          {/* The widget reads the page's language from <html lang>, which the
              root layout owns and sets to English. A client's real site sets
              it per language; this page imitates that so the ?lang= links
              above show the assistant in Arabic, French or English — after
              hydration, so the server HTML and the client agree. */}
          {lang ? <PageLang lang={lang} /> : null}
          <script
            defer
            src="/assistant.js"
            data-site={slug}
            data-origin={origin}
            data-position={config.widgetPosition ?? "right"}
            data-preview={preview ? "1" : undefined}
          />
        </>
      ) : null}
    </main>
  );
}
