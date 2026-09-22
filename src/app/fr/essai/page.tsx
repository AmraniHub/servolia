import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { loadReceptionist, receptionistPhase, takeoverOpen, RECEPTIONIST_TRIAL_DAYS } from "@/lib/receptionistTrial";
import { slugify } from "@/lib/clientSites";
import PageLang from "@/components/PageLang";
import { DraftForm, RequestForm } from "@/components/ReceptionistTrial";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Essayez votre réceptionniste IA sur votre site — 7 jours gratuits",
  description:
    "Tapez l'adresse de votre site : votre réceptionniste IA apparaît à votre nom et à vos couleurs. Parlez-lui, puis mettez-la sur votre site 7 jours, gratuitement et sans carte.",
  alternates: { canonical: "https://servolia.com/fr/essai" },
};

/**
 * THE FRONT DOOR — where a practice that has never heard of Servolia meets
 * its own receptionist (src/lib/receptionistTrial.ts).
 *
 * Without ?site: one field, her website. With ?site=<slug>: the receptionist
 * we just drafted from her homepage, answering at the bottom of this page in
 * preview (nothing saved, nobody alerted — the same showroom rule as the
 * hosting try page), and one more field, her email, which is the only way on
 * to her own site.
 *
 * The widget is pointed at THIS host so the page works on a preview
 * deployment and on localhost, exactly like /hosting/assistant/try.
 */
export default async function EssaiPage({ searchParams }: { searchParams: Promise<{ site?: string }> }) {
  const { site = "" } = await searchParams;
  const row = site ? await loadReceptionist(slugify(site)) : null;
  const config = row?.config;
  const r = config?.receptionist;
  // A trial someone started but never put on the site in 48 h is open again.
  const realPhase = receptionistPhase(r);
  const phase = takeoverOpen(r) ? "draft" : realPhase;
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("x-forwarded-host") ?? h.get("host") ?? "servolia.com"}`;

  return (
    <main className="min-h-screen bg-[#FAFAF7] flex flex-col" lang="fr">
      <header className="px-5 py-5 border-b border-[#E8E6E0] bg-white">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <Link href="/fr" className="text-xl font-black tracking-tight text-[#18181B]">
            Serv<span className="gradient-text">olia</span>
          </Link>
          <Link href="/fr/tarifs" className="text-[13px] font-semibold text-[#52525B] hover:text-[#18181B]">Tarifs</Link>
        </div>
      </header>

      <div className="flex-1 px-5 py-14">
        <div className="max-w-2xl mx-auto">
          {!row || !config || !r ? (
            <>
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#36671E] mb-3">
                {RECEPTIONIST_TRIAL_DAYS} jours gratuits · sans carte · sans engagement
              </p>
              <h1 className="text-3xl sm:text-4xl font-black text-[#161A15] tracking-tight leading-tight">
                Voyez votre réceptionniste IA répondre à vos patients — avant de décider quoi que ce soit.
              </h1>
              <p className="mt-4 text-[16px] text-[#52525B] leading-relaxed">
                Tapez l&apos;adresse de votre site. Nous lisons votre page d&apos;accueil et votre réceptionniste apparaît à votre nom, à vos couleurs,
                avec les soins que votre site mentionne. Parlez-lui comme le ferait un patient. Si elle vous plaît, une ligne à coller la met sur votre site
                pour {RECEPTIONIST_TRIAL_DAYS} jours.
              </p>
              {site ? (
                <p className="mt-4 text-[13.5px] text-[#B42318]" role="alert">Ce lien ne correspond à aucune réceptionniste. Recommencez ci-dessous.</p>
              ) : null}
              <DraftForm lang="fr" />
              <ul className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-3 text-[13.5px] text-[#3F3F46]">
                <li className="rounded-xl bg-white border border-[#E8E6E0] p-4"><strong className="block text-[#18181B]">Elle ne donne jamais de prix</strong>ni d&apos;avis médical : elle prend les coordonnées et le cabinet rappelle.</li>
                <li className="rounded-xl bg-white border border-[#E8E6E0] p-4"><strong className="block text-[#18181B]">Chaque demande vous arrive</strong>par email, avec le nom et le téléphone du patient, même à 23h.</li>
                <li className="rounded-xl bg-white border border-[#E8E6E0] p-4"><strong className="block text-[#18181B]">Rien à désinstaller</strong>À la fin de l&apos;essai elle se retire toute seule, sauf si vous la gardez.</li>
              </ul>
            </>
          ) : (
            <>
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#36671E] mb-3" data-testid="essai-eyebrow">
                {phase === "draft" ? "Construite à partir de votre site" : phase === "ended" ? "Essai terminé" : "Déjà en ligne"}
              </p>
              <h1 className="text-3xl font-black text-[#161A15] tracking-tight" data-testid="essai-name">{config.businessName}</h1>
              <p className="mt-3 text-[15.5px] text-[#52525B] leading-relaxed">
                {phase === "draft"
                  ? "C'est votre réceptionniste : elle est en bas à droite de cette page. Posez-lui les questions d'un patient — un rendez-vous, une urgence, un tarif. Ceci est un aperçu : rien n'est enregistré, personne n'est prévenu."
                  : phase === "ended"
                    ? `L'essai sur ${r.domain} est terminé. Vous pouvez encore lui parler ici ; le lien pour la garder est dans l'email reçu à la fin de l'essai.`
                    : `Cette réceptionniste est déjà en ligne sur ${r.domain}. La page de suivi est dans la boîte mail de la personne qui l'a lancée.`}
              </p>
              {phase === "draft" ? (
                <>
                  <div className="mt-6 rounded-2xl bg-white border border-[#E8E6E0] p-5 text-[13.5px] text-[#3F3F46]" data-testid="essai-knows">
                    <p className="font-bold text-[#18181B] mb-1.5">Ce qu&apos;elle a lu sur {r.domain}</p>
                    <ul className="list-disc pl-5 space-y-0.5">
                      <li>Nom : {config.businessName}</li>
                      {config.phone ? <li>Téléphone : {config.phone}</li> : null}
                      <li>
                        {config.services.length
                          ? `Soins mentionnés : ${config.services.map((s) => s.name).join(", ")}`
                          : "Aucun soin repéré sur la page d'accueil — elle demandera au patient ce dont il a besoin."}
                      </li>
                    </ul>
                    <p className="mt-2 text-[12.5px] text-[#71717A]">Horaires, adresse, lien Doctolib : vous les ajoutez en un instant à l&apos;étape suivante.</p>
                  </div>
                  <RequestForm slug={row.slug} lang="fr" domain={r.domain} />
                  <p className="mt-6 text-[13px] text-[#71717A]">
                    Pas le bon site ? <Link href="/fr/essai" className="font-bold text-[#36671E] hover:underline">Essayer une autre adresse</Link>
                  </p>
                </>
              ) : null}
            </>
          )}
        </div>
      </div>

      {/* Preview only: a draft, or an ended trial. A live one is NOT drawn on
          this public page — here anyone with the slug could send real
          enquiries into the practice's inbox; its place is her own site. */}
      {row && config && (realPhase === "draft" || realPhase === "ended") ? (
        <>
          <PageLang lang="fr" />
          <script defer src="/assistant.js" data-site={row.slug} data-origin={origin} data-position="right" data-preview="1" />
        </>
      ) : null}
    </main>
  );
}
