import type { Metadata } from "next";
import Link from "next/link";
import AssistantTryYours from "@/components/AssistantTryYours";

/**
 * SERVOLIA'S OWN PAGE FOR THE ASSISTANT — servolia.com/assistant.
 *
 * Until this existed the assistant could only be seen through a link built
 * for one named client, which made the product look like a favour from a
 * developer rather than a thing a company sells. This is the company
 * surface: anyone types a domain and watches the assistant wearing that
 * business's name, colours and languages — no ref, no brief, no admin.
 *
 * Indexed on purpose: it is a public product page about no client at all,
 * unlike the ?ref= pay pages, which stay private.
 */

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>;
}): Promise<Metadata> {
  const { lang = "" } = await searchParams;
  const fr = lang === "fr";
  return {
    title: fr ? "Assistant IA pour votre site" : "AI assistant for your website",
    description: fr
      ? "Un assistant qui répond à vos visiteurs jour et nuit, en arabe, en français et en anglais, et vous envoie chaque demande. Tapez votre domaine et voyez-le à vos couleurs."
      : "An assistant that answers your visitors day and night, in Arabic, French and English, and sends you every enquiry. Type your domain and see it in your colours.",
    robots: { index: true, follow: true },
  };
}

export default async function AssistantPage({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>;
}) {
  const { lang = "" } = await searchParams;
  const l: "en" | "fr" = lang === "fr" ? "fr" : "en";
  const fr = l === "fr";

  return (
    <main className="min-h-screen bg-[#FAFAF7] flex flex-col">
      <header className="px-5 py-6 border-b border-[#E8E6E0] bg-white">
        <div className="max-w-3xl mx-auto flex items-baseline justify-between">
          <Link href={fr ? "/fr" : "/"} className="inline-flex items-center">
            <span className="text-xl font-black tracking-tight text-[#18181B]">
              Serv<span className="gradient-text">olia</span>
            </span>
          </Link>
          <Link href={fr ? "/assistant" : "/assistant?lang=fr"} className="text-[13px] font-semibold text-[#71717A] hover:text-[#18181B]">
            {fr ? "English" : "Français"}
          </Link>
        </div>
      </header>

      <div className="flex-1 px-5 py-12 sm:py-16">
        <div className="max-w-2xl mx-auto text-center mb-10">
          <h1 className="text-3xl sm:text-[38px] font-black text-[#18181B] tracking-tight mb-4">
            {fr ? "Un assistant qui répond pour vous, jour et nuit" : "An assistant that answers for you, day and night"}
          </h1>
          <p className="text-[#52525B] leading-relaxed max-w-xl mx-auto">
            {fr
              ? "Il répond à vos visiteurs dans leur langue — arabe, français, anglais — prend leurs coordonnées, et vous envoie chaque demande sur votre téléphone. Une ligne à ajouter à votre site ; nous l'installons pour vous."
              : "It answers your visitors in their language — Arabic, French, English — takes their details, and sends every enquiry to your phone. One line added to your site; we install it for you."}
          </p>
        </div>

        <AssistantTryYours lang={l} />

        {/* What the money buys, in the same plain register as /hosting. */}
        <div className="max-w-[560px] mx-auto mt-14 grid sm:grid-cols-3 gap-3 text-center">
          {(fr
            ? [
                ["24h/24", "Répond instantanément, même à 2h du matin"],
                ["3 langues", "Arabe, français et anglais — celle du visiteur"],
                ["Chaque demande", "Arrive par email, avec réponse WhatsApp en un clic"],
              ]
            : [
                ["24/7", "Replies instantly, even at 2am"],
                ["3 languages", "Arabic, French and English — the visitor's own"],
                ["Every enquiry", "Lands in your email, with a one-tap WhatsApp reply"],
              ]
          ).map(([k, v]) => (
            <div key={k} className="rounded-2xl border border-[#E8E6E0] bg-white px-4 py-5">
              <p className="text-[17px] font-black text-[#18181B] mb-1">{k}</p>
              <p className="text-[13px] text-[#71717A] leading-relaxed">{v}</p>
            </div>
          ))}
        </div>
      </div>

      <footer className="px-5 py-8 border-t border-[#E8E6E0] bg-white">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-xs text-[#8A8A80]">
            {fr ? "Facturé par " : "Billed by "}
            <span className="font-bold text-[#52525B]">Servolia</span>
            {fr ? " · Paiement traité par Stripe" : " · Payments processed by Stripe"}
          </p>
        </div>
      </footer>
    </main>
  );
}
