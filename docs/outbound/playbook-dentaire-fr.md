# Playbook Outbound — Cabinets Dentaires France

**Objectif :** 2–3 premiers clients dentaires via audits Loom personnalisés. Destination du trafic : `servolia.com/fr/dentistes` → `servolia.com/fr/audit`.

**Constat terrain (vérifié le 10/07/2026, 12 sites analysés) : 0 cabinet sur 12 possède un chat ou une IA.** Plusieurs sont joignables uniquement par téléphone aux heures ouvrées. Certains cabinets d'implantologie (patients à 1 500–5 000 €) tournent sur des sites annuaire templétisés. Le marché est grand ouvert.

---

## 1. Scoring des prospects

| Score | Critères | Priorité |
|---|---|---|
| **HOT** | Pas de réservation en ligne + pas de chat. Bonus : site daté, HTTP non sécurisé, téléphone-seul, plusieurs numéros | Loom audit personnalisé immédiat |
| **WARM** | Doctolib/réservation présente mais pas de chat/IA, pas de suivi | Angle "Doctolib réserve mais ne répond pas" |
| **VERIFY** | Site inaccessible aux robots ou non vérifié | Vérif manuelle 2 min avant contact |

**Angles par profil :**
- *Site daté / templétisé* → « Vos concurrents encaissent les patients que votre site fait fuir. »
- *Site moderne sans réservation* → « Vous avez investi dans l'image, mais le patient de 21h ne peut rien faire d'autre qu'attendre demain. »
- *Doctolib sans chat* → « Doctolib prend le RDV du patient déjà décidé. Il ne répond pas au patient qui hésite sur un implant à 3 000 €, et il liste vos concurrents à côté de vous. »
- *Plusieurs numéros de téléphone* → « Trois numéros, zéro réponse après 19h. »

## 2. Comment passer de 23 à 200–500 prospects

1. **Motif annuaire** : les sites `*.chirurgiens-dentistes.fr` sont des pages templétisées de l'annuaire officiel — quasi toujours sans chat ni réservation propre. Google : `site:chirurgiens-dentistes.fr implantologie [ville]` → des dizaines de HOT prospects par ville.
2. **Google Maps** : chercher « implant dentaire [ville] », ouvrir chaque fiche → si « Prendre RDV » absent de la fiche ET du site = HOT. Villes : Lyon, Bordeaux, Toulouse, Nice, Strasbourg, Nantes, Montpellier, Lille, puis Bruxelles, Genève, Lausanne.
3. **Meta Ad Library** (facebook.com/ads/library) : chercher « implant dentaire », « invisalign », « facette dentaire » en France → cabinets qui PAYENT déjà pour du trafic sans système de conversion = les meilleurs prospects du marché.
4. **PagesJaunes** : « implantologie » par ville, croiser avec le site.

**Règle : 10 nouveaux prospects vérifiés par jour, 3 audits Loom par semaine minimum.**

## 3. Séquence de contact (email pro = opt-out en B2B, conforme CNIL ; toujours proposer la désinscription)

### Email 1 — le constat (J0)
> **Objet : Votre cabinet à 21h47**
>
> Bonjour Docteur [Nom],
>
> J'ai regardé le parcours d'un patient qui découvre [Cabinet] un soir après la fermeture : il ne peut ni poser sa question sur [implant/facette], ni réserver — il doit attendre le lendemain. La plupart ne rappellent jamais : ils prennent RDV chez le confrère qui répond en premier.
>
> J'ai enregistré une vidéo de 90 secondes qui montre exactement où ça fuit sur votre site et comment d'autres cabinets récupèrent ces patients automatiquement. Je vous l'envoie ?
>
> [Prénom] — Servolia
> *(Un mot et je ne vous recontacte plus.)*

### Email 2 — la vidéo (J+3, si réponse ou ouverture)
Envoyer le Loom + une ligne : « Voici la vidéo. Si un seul patient implant par mois vous échappe, cela représente ~[valeur] €/mois. L'audit complet est gratuit : servolia.com/fr/audit »

### Email 3 — le chiffre (J+7)
> Un cabinet qui manque 9 demandes hors horaires par mois, à 1 500 € par patient, laisse ~13 500 €/mois au concurrent d'à côté. Estimation illustrative — l'audit gratuit la calcule avec VOS chiffres : servolia.com/fr/audit

### Email 4 — rupture (J+14)
> Je classe le dossier — dernier lien vers l'audit si le sujet revient un jour : servolia.com/fr/audit. Bonne continuation Docteur.

**WhatsApp/appel** uniquement après une réponse email (respect + efficacité).

## 4. Script Loom audit (5 min max — l'actif de vente n°1)

1. **0:00–0:30** — Écran sur LEUR site : « Bonjour Docteur [Nom], je suis sur votre site, voilà ce que voit un patient ce soir… »
2. **0:30–2:00** — Les 2-3 fuites concrètes : pas de réponse après fermeture / pas de réservation / question implant sans réponse / formulaire sans suivi. Montrer, pas raconter.
3. **2:00–3:00** — Google Maps : leur fiche vs le concurrent local qui a « Prendre RDV ». « Le patient compare, il choisit celui qui répond. »
4. **3:00–4:00** — Le calcul avec LEURS chiffres (« même 4-5 demandes ratées/mois à 1 500 € = … »). Toujours dire « estimation ».
5. **4:00–5:00** — La solution en une phrase (réceptionniste IA + réservation + suivi, installé en 7 jours, prix fixe) + CTA : « L'audit écrit complet est gratuit : servolia.com/fr/audit — ou répondez à cet email. »

**Interdits (discipline Servolia) :** aucun chiffre inventé présenté comme réel, aucun faux témoignage, toujours « estimation illustrative ». Le RGPD est un argument de vente (« votre système sera conforme »), jamais un risque.

## 5. Suivi

Chaque prospect contacté = un lead dans le CRM `/admin/leads` (source : outbound-dentaire). Mesurer : emails envoyés → réponses → Looms envoyés → audits demandés → appels → devis → acomptes. L'objectif Phase 1 : **3 Looms/semaine**. Au-delà → déclencher Phase 2 (génération semi-automatique des scripts d'audit, voir growth plan).
