import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { getClientSite } from "@/lib/clientSites";
import { isHiddenDraft } from "@/lib/draftGate";

export const dynamic = "force-dynamic";

/**
 * Per-client GDPR/privacy page — delivers the "GDPR pages included" promise
 * every plan carries. Auto-populated from the site config (business name,
 * city, contact email); bilingual by the site's language. No legal review
 * needed per client because it only states what the platform actually does:
 * form/chat data stored to run the service, no resale, CNIL/DPA rights via
 * the clinic's own contact email.
 */

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const c = await getClientSite(slug);
  if (!c) return { title: "Not found" };
  const fr = c.language === "fr";
  return {
    title: `${fr ? "Politique de confidentialité" : "Privacy policy"} — ${c.businessName}`,
    robots: { index: false, follow: false },
  };
}

export default async function ClientPrivacyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const c = await getClientSite(slug);
  if (!c) notFound();
  if (await isHiddenDraft(c)) notFound();

  const fr = c.language === "fr";
  const contact = c.email || null;

  const S = fr
    ? {
        title: "Politique de confidentialité",
        updated: "Dernière mise à jour",
        s1t: "1. Responsable du traitement",
        s1: `${c.businessName}${c.city ? `, ${c.city}` : ""}, est responsable du traitement des données collectées sur ce site.${contact ? ` Contact : ${contact}.` : ""}`,
        s2t: "2. Données collectées",
        s2: "Lorsque vous utilisez le formulaire de contact/rendez-vous ou l'assistant de discussion, nous collectons les informations que vous fournissez volontairement : nom, téléphone, email et le contenu de votre demande. Aucune donnée n'est collectée à votre insu.",
        s3t: "3. Finalité",
        s3: "Vos données servent uniquement à traiter votre demande et organiser votre rendez-vous. Elles ne sont jamais vendues ni transmises à des tiers à des fins commerciales.",
        s4t: "4. Hébergement & sous-traitance",
        s4: "Ce site est opéré par Servolia (servolia.com) pour le compte du responsable du traitement. Les données sont hébergées de manière sécurisée dans l'Union européenne / conformément au RGPD.",
        s5t: "5. Vos droits (RGPD)",
        s5: `Vous disposez d'un droit d'accès, de rectification, d'effacement et d'opposition sur vos données.${contact ? ` Pour l'exercer, écrivez à ${contact}.` : " Pour l'exercer, contactez le cabinet directement."} Vous pouvez également saisir la CNIL (cnil.fr).`,
        back: "← Retour au site",
      }
    : {
        title: "Privacy policy",
        updated: "Last updated",
        s1t: "1. Data controller",
        s1: `${c.businessName}${c.city ? `, ${c.city}` : ""}, is the controller for data collected on this site.${contact ? ` Contact: ${contact}.` : ""}`,
        s2t: "2. Data we collect",
        s2: "When you use the contact/booking form or the chat assistant, we collect the information you provide voluntarily: name, phone, email and the content of your enquiry. No data is collected without your knowledge.",
        s3t: "3. Purpose",
        s3: "Your data is used solely to handle your enquiry and arrange your appointment. It is never sold or shared with third parties for commercial purposes.",
        s4t: "4. Hosting & processing",
        s4: "This site is operated by Servolia (servolia.com) on behalf of the controller. Data is hosted securely in line with the GDPR.",
        s5t: "5. Your rights (GDPR)",
        s5: `You have the right to access, correct, delete and object to the processing of your data.${contact ? ` To exercise these rights, write to ${contact}.` : " To exercise these rights, contact the practice directly."}`,
        back: "← Back to the site",
      };

  return (
    <main className="min-h-screen bg-white text-[#18181B]">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-14">
        <Link href={`/sites/${c.slug}`} className="text-sm font-semibold text-[#71717A] hover:text-[#18181B]">{S.back}</Link>
        <h1 className="text-3xl font-black mt-4 mb-1">{S.title}</h1>
        <p className="text-sm text-[#A1A1AA] mb-8">{c.businessName} · {S.updated} {new Date().getFullYear()}</p>
        <div className="space-y-6 text-sm leading-relaxed text-[#3F3F46]">
          {[[S.s1t, S.s1], [S.s2t, S.s2], [S.s3t, S.s3], [S.s4t, S.s4], [S.s5t, S.s5]].map(([t, b]) => (
            <div key={t}>
              <h2 className="text-base font-black text-[#18181B] mb-2">{t}</h2>
              <p>{b}</p>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
