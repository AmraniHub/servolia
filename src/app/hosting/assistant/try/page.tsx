import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { getClientSite, slugify } from "@/lib/clientSites";

export const metadata: Metadata = {
  title: "Try your assistant",
  robots: { index: false, follow: false },
};

/**
 * A bare page that loads the REAL widget for one slug — the same script, the
 * same API, the same brief a visitor to the client's site would meet.
 *
 * Exists so a client can talk to their assistant before it is on their site
 * (or before their developer has added the line), and so the operator can
 * check a brief without opening the client's website. There is nothing to
 * protect: the widget only draws when /api/assistant says the slug is paid
 * for, and servolia.com is always an allowed origin.
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
          {config ? (
            <>
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#36671E] mb-3">
                {fr ? "Essai" : "Test drive"}
              </p>
              <h1 className="text-3xl font-black text-[#161A15] tracking-tight mb-3">
                {config.businessName}
              </h1>
              <p className="text-[#52525B] leading-relaxed">
                {fr
                  ? "L'assistant est en bas de cette page — exactement celui que vos visiteurs verront sur votre site. Posez-lui les questions qu'un client poserait. S'il ne s'affiche pas, l'abonnement n'est pas encore actif."
                  : "The assistant is at the bottom of this page — exactly the one your visitors will meet on your site. Ask it what a customer would. If it does not appear, the subscription is not active yet."}
              </p>
              <p className="mt-6 text-[13px] text-[#8A8A80]">
                {fr
                  ? "Astuce : changez la langue de la page pour le voir répondre en arabe, en français ou en anglais."
                  : "Tip: switch this page's language to see it answer in Arabic, French or English."}
                {" "}
                {(["ar", "fr", "en"] as const).map((l) => (
                  <Link key={l} href={`?site=${encodeURIComponent(slug)}&lang=${l}`} className="ml-2 font-bold text-[#36671E] hover:underline">
                    {l.toUpperCase()}
                  </Link>
                ))}
              </p>
            </>
          ) : (
            <div className="rounded-2xl border border-[#E8E6E0] bg-white p-7 text-center">
              <h1 className="text-xl font-black text-[#18181B] mb-2">No assistant here</h1>
              <p className="text-sm text-[#52525B]">This link names an assistant that does not exist.</p>
            </div>
          )}
        </div>
      </div>

      {config ? (
        <>
          {/* The widget reads the page's language from <html lang>, which the
              root layout owns and sets to English. A client's real site sets
              it per language; this page imitates that so the ?lang= links
              above show the assistant in Arabic, French or English. */}
          {lang ? (
            <script
              dangerouslySetInnerHTML={{
                __html: `document.documentElement.lang=${JSON.stringify(lang)};document.documentElement.dir=${JSON.stringify(lang === "ar" ? "rtl" : "ltr")};`,
              }}
            />
          ) : null}
          <script defer src="/assistant.js" data-site={slug} data-origin={origin} data-position={config.widgetPosition ?? "right"} />
        </>
      ) : null}
    </main>
  );
}
