# Playbook Outbound — Centres Laser & Médecine Esthétique France

**Objectif :** rung 2 de l'échelle (docs/PRINCIPLES.md P2) — 2–3 premiers clients esthétique/laser via audits Loom personnalisés, une fois le rung 1 (dentaire) en cours de domination. Ne pas démarcher ce rung avant d'avoir des cas clients dentaires réels (P6 : le case study *est* le produit du mois 1).

**Constat terrain (vérifié le 15/07/2026, 7 sites analysés — Lyon, Toulouse, Nice, Strasbourg, Bordeaux) : 0 sur 7 possède un chat IA ou une qualification avant réservation. 1 sur 7 n'a aucun système de réservation en ligne.**

**Correction importante par rapport à la recherche externe (2026-07) : ce marché n'est PAS majoritairement Planity.** Sur l'échantillon vérifié, la réservation se répartit entre **Doctolib** (centres à dominante médecine esthétique — injectables, dermatologie) et **Planity** (centres à dominante institut/épilation). Toujours vérifier la plateforme réelle avant le premier contact — le prompt du réceptionniste IA (`clientPrompt.ts`) gère déjà les deux (`isDoctolib` / `isPlanity`).

---

## 1. Le secret à utiliser dans chaque approche (docs/PRINCIPLES.md P3)

> Le trafic est banalisé ; le vrai goulot d'étranglement, c'est le délai de réponse et l'absence totale de qualification avant réservation.

Doctolib et Planity sont des calendriers passifs — n'importe qui réserve un créneau sans aucune qualification médicale ou financière. Résultat : rendez-vous non honorés, consultations à 200-2000€ bloquées par des curieux, et surtout — **aucune réponse en dehors des horaires d'ouverture à la personne qui hésite encore entre trois centres.**

## 2. Scoring des prospects

| Score | Critères | Priorité |
|---|---|---|
| **HOT** | Aucun système de réservation en ligne (formulaire/téléphone seul) | Loom audit personnalisé immédiat |
| **WARM** | Doctolib ou Planity présent mais pas de chat/IA, pas de qualification avant RDV | Angle "réserve le décidé, perd l'hésitant" |
| **WARM+** | Widget WhatsApp/chat manuel présent (pas d'IA derrière) | Angle "vous payez déjà pour ce canal — personne ne répond après 19h" |
| **VERIFY** | Business sans site propre, 100% hébergé sur la page Planity | Vérifier la présence Instagram/pub avant contact |

**Angles par profil (vérifiés sur cas réels ci-dessus) :**
- *Doctolib sans chat* (ex. Centre Laser Lyon, Centre Laser Nice) → « Doctolib réserve le patient déjà décidé pour une épilation à 45€. Il ne répond rien à celui qui hésite pour un forfait injectables à 800€. »
- *Planity sans chat* (ex. Le Plénitude, Les Définitives) → « Votre consultation gratuite de 30 min est votre meilleur outil de conversion — mais elle se remplit au hasard de qui a le temps d'appeler, pas des patients les plus qualifiés. »
- *Chat WhatsApp manuel* (ex. Dermo Laser Lyon) → « Vous avez déjà le bon réflexe (WhatsApp), mais quelqu'un doit répondre à la main. On automatise la partie qualification — vous ne répondez qu'aux patients prêts à réserver. »
- *Aucune réservation en ligne* (ex. Centre Laser Matabiau) → « Zéro friction pour vos concurrents sur Doctolib/Planity ; chaque appel manqué chez vous part directement chez eux. »
- *Aucun site propre, 100% Planity* (ex. Aesthemedica) → « Vous ne possédez ni votre trafic ni votre marque — Planity décide qui vous voit. Un système à vous change ça. »

## 3. Comment passer de 7 à 200+ prospects

1. **Requêtes Planity ciblées** : `planity.com/institut-de-beaute/epilation-au-laser/[ville]` et `/epilation-definitive/[ville]` listent systématiquement les centres actifs par ville — chaque fiche indique si le centre a un site propre ou dépend entièrement de Planity (signal VERIFY).
2. **Recherche directe** : `"centre laser" [ville] épilation médecine esthétique` sur Google fait remonter les sites propres (meilleure cible que les fiches Planity seules — ils investissent déjà dans leur marque).
3. **Meta Ad Library** (facebook.com/ads/library) : chercher « épilation laser », « injectables », « botox », « acide hyaluronique » en France — centres qui PAYENT déjà pour du trafic sans système de conversion = meilleurs prospects.
4. **Instagram** : ce secteur vit sur Instagram (galeries avant/après). Repérer les comptes actifs avec DMs ouverts mais sans lien de réservation en bio = friction visible.
5. **Villes** : mêmes 5 villes que le rung dentaire (Lyon, Bordeaux, Toulouse, Nice, Strasbourg) — cohérence géographique, mêmes déplacements, même réseau de bouche-à-oreille (P4 network effects).
6. **Apify scrapers Doctolib/Planity** (`apify.com/anchor/doctolib`, `apify.com/figue/planity-salon-scraper`) — outil de volume pour la phase suivante, une fois le scoring manuel validé sur ~30-50 prospects. Ne pas industrialiser avant d'avoir confirmé le taux de conversion à la main.

**Règle : ce rung ne démarre qu'après domination du rung 1 (dentaire). Ne pas mélanger les deux dans une même semaine de prospection (P2 : chaque client hors-rung dilue le playbook).**

## 4. Séquence de contact (3 canaux, dans l'ordre)

1. **LinkedIn** — enrichir le nom du praticien/gérant (trouvé sur le site ou Planity) via recherche LinkedIn directe. Message court référençant leur centre par son nom exact.
2. **WhatsApp** — si un numéro mobile est public (souvent le cas pour la prise de RDV VIP). Message bref, direct, chiffré : « [Prénom], sur les 7 centres laser/esthétique qu'on a vérifiés cette semaine, aucun ne répond en dehors des horaires. On a construit un système spécifique pour ça — 2 min pour vous montrer ? »
3. **Instagram DM** — le canal le plus fort pour ce secteur. Envoyer une démo Loom personnalisée (générée via `/admin/demo`) montrant leur propre réceptionniste IA répondre en français à une question sur leurs services réels.

## 5. Tarification — spécificité de ce rung

Ce rung est le seul où le modèle **pay-per-consultation-réservée** peut être pilote (docs/PRINCIPLES.md P6) — **uniquement pour les centres non dirigés par un professionnel médical réglementé** (instituts, centres d'épilation gérés par des esthéticiennes/infirmières). Pour tout centre à dominante médecine esthétique dirigé par un médecin, rester sur le forfait fixe standard tant qu'un avocat français n'a pas confirmé le modèle pour cette catégorie.

---

*Prospects vérifiés le 15/07/2026 : voir `prospects-esthetique-fr.csv`. Méthodologie identique à `playbook-dentaire-fr.md` (vérification manuelle du site réel, pas de la seule fiche annuaire).*
