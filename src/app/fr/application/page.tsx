import FrenchNav from "@/components/FrenchNav";
import FrenchFooter from "@/components/FrenchFooter";
import Link from "next/link";
import InstallApp from "@/components/InstallApp";
import { Bell, WifiOff, Smartphone, Lock } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Installer l’application Servolia — votre espace client sur votre téléphone",
  description:
    "Ajoutez votre espace client Servolia à votre écran d’accueil. Chaque demande patient en un geste — sans store, sans téléchargement.",
  alternates: {
    canonical: "https://servolia.com/fr/application",
    languages: { en: "https://servolia.com/install" },
  },
};

const POURQUOI = [
  { icon: Smartphone, title: "Un geste, sans navigateur", body: "Vos demandes s’ouvrent directement depuis l’écran d’accueil, en plein écran, sans barre d’adresse." },
  { icon: Bell, title: "Là où vous regardez déjà", body: "L’icône se place à côté de vos autres applications : vérifier une nouvelle demande devient un coup d’œil." },
  { icon: WifiOff, title: "Honnête hors ligne", body: "Sans réseau, un message clair plutôt qu’une erreur du navigateur. Rien n’est mis en cache : vous ne lisez jamais un chiffre périmé." },
  { icon: Lock, title: "Même connexion, même sécurité", body: "C’est votre espace client dans une fenêtre d’application — même lien de connexion, rien de nouveau à retenir." },
];

export default function InstallerPage() {
  return (
    <main className="flex flex-col bg-white">
      <FrenchNav />

      <section className="bg-[#FAFAF7] pt-28 pb-14">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-sm font-bold text-[#36671E] uppercase tracking-widest mb-3">Espace client</p>
          <h1 className="text-4xl font-black text-[#18181B] mb-3">Mettez Servolia sur votre téléphone</h1>
          <p className="text-[#52525B] text-lg max-w-xl">
            Votre espace client, sous forme d’icône. L’installation se fait depuis cette page en quelques secondes —
            aucun store, aucun téléchargement, aucune mise à jour à gérer.
          </p>

          <div className="mt-8">
            <InstallApp lang="fr" />
          </div>

          <p className="text-xs text-[#A1A1AA] mt-4">
            Pas encore client ? Commencez par l’
            <Link href="/fr/audit" className="underline font-semibold text-[#52525B]">
              audit gratuit
            </Link>
            .
          </p>
        </div>
      </section>

      <section className="py-14 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid sm:grid-cols-2 gap-5">
            {POURQUOI.map((w) => {
              const Icon = w.icon;
              return (
                <div key={w.title} className="rounded-xl border border-[#E8E6E0] p-5">
                  <Icon className="w-4 h-4 text-[#36671E] mb-2" />
                  <p className="text-sm font-black text-[#18181B] mb-1">{w.title}</p>
                  <p className="text-sm text-[#71717A] leading-relaxed">{w.body}</p>
                </div>
              );
            })}
          </div>

          <div className="mt-10 rounded-xl bg-[#FAFAF7] border border-[#E8E6E0] p-5">
            <p className="text-sm font-black text-[#18181B] mb-2">Est-ce une vraie application ?</p>
            <p className="text-sm text-[#71717A] leading-relaxed">
              C’est votre espace client, installé. Les navigateurs savent ajouter un site à l’écran d’accueil pour
              qu’il s’ouvre comme une application — même connexion, mêmes données, sans téléchargement séparé ni
              validation de store. Vous la retirez comme n’importe quelle application, sans rien laisser sur le
              téléphone.
            </p>
          </div>
        </div>
      </section>

      <FrenchFooter />
    </main>
  );
}
