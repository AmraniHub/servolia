import type { LocalBlock } from "./frLocal";

/**
 * /fr/services-a-domicile/[ville] — sourced local blocks.
 *
 * Figures (researched 2026-10-02):
 *  - Establishments: INSEE Sirene register, ACTIVE establishments in the
 *    commune, NAF 2008 codes 43.22A (eau et gaz) + 43.22B (thermique et
 *    climatisation) = "plombiers-chauffagistes", 43.21A = "électriciens".
 *    Read from Opendatasoft's mirror of Sirene, refreshed 2026-08-01. Counts
 *    include micro-entrepreneurs; Paris, Marseille and Lyon are summed over
 *    their arrondissements.
 *  - Housing and heating: INSEE dossier complet of each commune, 2023
 *    census (tables LOG T1, LOG T8, LOG T11M). "Avant 1971" because INSEE's
 *    age bands end in 1970. "Gaz ou réseau de chaleur" is INSEE's own
 *    combined category.
 * "Résidences par entreprise" = résidences principales / (43.22A + 43.22B),
 * rounded — a measure of how many homes each plumbing/heating firm serves.
 */

const SIRENE = { label: "Répertoire Sirene, établissements actifs (copie Opendatasoft, août 2026)", url: "https://public.opendatasoft.com/explore/dataset/economicref-france-sirene-v3/" };
const insee = (name: string, code: string) => ({ label: `INSEE, dossier complet ${name} (recensement 2023)`, url: `https://www.insee.fr/fr/statistiques/2011101?geo=COM-${code}` });

const stats = (plumb: string, elec: string, homes: string, old: string) => [
  { label: "Plombiers-chauffagistes", value: plumb, note: "établissements actifs, Sirene 2026" },
  { label: "Électriciens", value: elec, note: "établissements actifs, Sirene 2026" },
  { label: "Résidences principales", value: homes, note: "INSEE, recensement 2023" },
  { label: "Logements d'avant 1971", value: old, note: "INSEE, recensement 2023" },
];

export const FR_LOCAL_HOME: Record<string, LocalBlock> = {
  paris: {
    heading: "Les artisans du bâtiment à Paris",
    stats: stats("4 498", "4 709", "1 124 522", "68,7 %"),
    paragraphs: [
      "Paris compte 4 498 établissements actifs de plomberie et de chauffage et 4 709 d'installation électrique, pour 1 124 522 résidences principales : environ 250 logements par entreprise de plomberie-chauffage. C'est l'un des marchés les plus serrés de France, et chaque arrondissement a ses propres recherches « plombier Paris 11 », « électricien Paris 15 ».",
      "Le parc est ancien : 68,7 % des résidences principales datent d'avant 1971, la part la plus élevée des quinze villes de cette page. Colonnes d'eau, canalisations en plomb, tableaux électriques à reprendre — les urgences arrivent le soir et le week-end, et souvent via un syndic ou un locataire pressé.",
      "Côté chauffage, 54,3 % des logements sont au gaz ou raccordés à un réseau de chaleur et 42 % à l'électricité. Dans une ville où le client compare trois artisans en dix minutes, celui qui répond le premier, même à 22 h, prend le chantier.",
    ],
    faq: {
      q: "Combien de plombiers et d'électriciens sont installés à Paris ?",
      a: "Le répertoire Sirene recense 4 498 établissements actifs de plomberie et de chauffage (codes 43.22A et 43.22B) et 4 709 d'installation électrique (43.21A) dans les vingt arrondissements, en août 2026, micro-entrepreneurs compris.",
    },
    sources: [SIRENE, insee("Paris", "75056")],
  },
  marseille: {
    heading: "Les artisans du bâtiment à Marseille",
    stats: stats("1 699", "2 040", "418 682", "56,7 %"),
    paragraphs: [
      "Marseille réunit 1 699 établissements actifs de plomberie et de chauffage et 2 040 électriciens, pour 418 682 résidences principales — environ 246 logements par entreprise de plomberie-chauffage, une densité comparable à celle de Paris.",
      "Ici l'électricité domine : 52,7 % des logements se chauffent à l'électrique, contre 41,1 % au gaz ou en réseau de chaleur. La climatisation réversible et la pompe à chaleur font une grande partie de l'activité des chauffagistes, avec un pic de demandes dès les premières chaleurs.",
      "Plus de la moitié du parc (56,7 %) date d'avant 1971. Entre les fuites dans l'ancien et les installations de clim en été, les demandes arrivent par vagues — et un client qui n'obtient pas de réponse rappelle simplement l'entreprise suivante dans les résultats Google.",
    ],
    faq: {
      q: "Les Marseillais se chauffent-ils plutôt au gaz ou à l'électricité ?",
      a: "À l'électricité : 52,7 % des résidences principales, contre 41,1 % au gaz de ville ou en réseau de chaleur et 3,2 % au fioul, selon le recensement INSEE 2023.",
    },
    sources: [SIRENE, insee("Marseille", "13055")],
  },
  lyon: {
    heading: "Les artisans du bâtiment à Lyon",
    stats: stats("537", "685", "271 968", "45,5 %"),
    paragraphs: [
      "Lyon intra-muros compte 537 établissements actifs de plomberie et de chauffage et 685 électriciens pour 271 968 résidences principales, soit environ 506 logements par entreprise de plomberie-chauffage — deux fois moins concurrentiel que Paris ou Marseille.",
      "Le gaz et les réseaux de chaleur chauffent 57,2 % des logements, l'électricité 39,8 %. L'entretien et le remplacement de chaudières restent donc un gros volume, surtout à l'approche de l'hiver, quand tout le monde appelle la même semaine.",
      "Près d'un logement sur deux (45,5 %) date d'avant 1971. Avec moins de concurrents par logement, un artisan lyonnais qui capte systématiquement les demandes du soir et du week-end peut remplir son planning sans dépenser plus en publicité.",
    ],
    faq: {
      q: "Y a-t-il beaucoup de concurrence entre plombiers à Lyon ?",
      a: "Moins qu'à Paris : environ 506 résidences principales par établissement de plomberie-chauffage à Lyon (537 établissements actifs pour 271 968 résidences), contre environ 250 à Paris. Sources : Sirene 2026, INSEE 2023.",
    },
    sources: [SIRENE, insee("Lyon", "69123")],
  },
  toulouse: {
    heading: "Les artisans du bâtiment à Toulouse",
    stats: stats("540", "787", "283 576", "34,3 %"),
    paragraphs: [
      "Toulouse compte 540 établissements actifs de plomberie et de chauffage et 787 électriciens, pour 283 576 résidences principales — environ 525 logements par entreprise de plomberie-chauffage.",
      "Le parc toulousain est jeune : seulement 34,3 % des logements datent d'avant 1971. Les demandes portent donc moins sur la réparation de vieilles installations que sur l'équipement — pompes à chaleur, climatisation, mise aux normes électriques dans les logements neufs et récents.",
      "Le chauffage se partage presque à égalité entre le gaz ou le réseau de chaleur (49,8 %) et l'électricité (47,9 %). Pour un artisan, cela veut dire deux clientèles aux questions différentes ; un assistant qui répond précisément à chacune transforme plus de demandes en devis.",
    ],
    faq: {
      q: "Le logement toulousain est-il ancien ?",
      a: "Plutôt récent : 34,3 % des résidences principales datent d'avant 1971 (recensement INSEE 2023), contre 68,7 % à Paris. Une large part de l'activité concerne donc l'équipement plutôt que la rénovation lourde.",
    },
    sources: [SIRENE, insee("Toulouse", "31555")],
  },
  nice: {
    heading: "Les artisans du bâtiment à Nice",
    stats: stats("953", "1 100", "177 829", "53,3 %"),
    paragraphs: [
      "Nice compte 953 établissements actifs de plomberie et de chauffage et 1 100 électriciens pour 177 829 résidences principales : environ 187 logements par entreprise de plomberie-chauffage, le marché le plus concurrentiel des quinze villes de cette page.",
      "Particularité niçoise : 9,9 % des logements se chauffent encore au fioul, la part la plus élevée de ces quinze villes. Le remplacement des chaudières fioul par une pompe à chaleur ou une autre énergie est un vrai gisement de chantiers.",
      "Avec 53,3 % de logements d'avant 1971 et une clientèle qui compte beaucoup de résidents secondaires et d'étrangers, les demandes arrivent à toute heure et parfois en anglais ou en italien. Dans un marché aussi dense, répondre vite et dans la bonne langue fait la différence.",
    ],
    faq: {
      q: "Combien de logements se chauffent encore au fioul à Nice ?",
      a: "9,9 % des résidences principales, selon le recensement INSEE 2023 — la part la plus élevée parmi les quinze grandes villes couvertes par cette page.",
    },
    sources: [SIRENE, insee("Nice", "06088")],
  },
  nantes: {
    heading: "Les artisans du bâtiment à Nantes",
    stats: stats("203", "313", "174 484", "36,5 %"),
    paragraphs: [
      "Nantes ne compte que 203 établissements actifs de plomberie et de chauffage et 313 électriciens pour 174 484 résidences principales, soit environ 860 logements par entreprise de plomberie-chauffage. Il y a beaucoup de foyers pour peu d'artisans.",
      "Le gaz et les réseaux de chaleur chauffent 59,1 % des logements, l'électricité 38,4 %. Les contrats d'entretien et les dépannages de chaudière forment le cœur de la demande, avec une forte saisonnalité à l'automne.",
      "Quand l'offre est rare, le problème n'est pas de trouver des clients mais de ne pas les perdre : un artisan nantais débordé qui ne décroche pas laisse partir des chantiers qu'il aurait pu planifier. Un assistant qui prend les coordonnées et le motif à toute heure permet de rappeler dans l'ordre.",
    ],
    faq: {
      q: "Est-il difficile de trouver un plombier à Nantes ?",
      a: "L'offre est réduite : 203 établissements actifs de plomberie et de chauffage pour 174 484 résidences principales, soit environ 860 logements par entreprise (Sirene 2026, INSEE 2023), bien plus qu'à Paris ou Marseille.",
    },
    sources: [SIRENE, insee("Nantes", "44109")],
  },
  montpellier: {
    heading: "Les artisans du bâtiment à Montpellier",
    stats: stats("513", "735", "165 313", "29,8 %"),
    paragraphs: [
      "Montpellier compte 513 établissements actifs de plomberie et de chauffage et 735 électriciens pour 165 313 résidences principales — environ 322 logements par entreprise de plomberie-chauffage.",
      "C'est la ville la plus « électrique » de cette page : 56,3 % des logements se chauffent à l'électricité. C'est aussi la plus jeune : seulement 29,8 % du parc date d'avant 1971. La demande porte sur la climatisation, les pompes à chaleur et les installations électriques plus que sur la rénovation de vieilles canalisations.",
      "Dans une métropole qui gagne des habitants chaque année, beaucoup de clients découvrent la ville et cherchent leur artisan sur Google. Ceux qui obtiennent une réponse immédiate, avec un créneau, réservent ; les autres continuent de chercher.",
    ],
    faq: {
      q: "Comment se chauffent les logements à Montpellier ?",
      a: "Majoritairement à l'électricité : 56,3 % des résidences principales, contre 40,3 % au gaz ou en réseau de chaleur (recensement INSEE 2023).",
    },
    sources: [SIRENE, insee("Montpellier", "34172")],
  },
  strasbourg: {
    heading: "Les artisans du bâtiment à Strasbourg",
    stats: stats("248", "367", "142 329", "46,4 %"),
    paragraphs: [
      "Strasbourg compte 248 établissements actifs de plomberie et de chauffage et 367 électriciens pour 142 329 résidences principales, soit environ 574 logements par entreprise de plomberie-chauffage.",
      "C'est la seule des quinze villes où les spécialistes du chauffage et de la climatisation (138 établissements en 43.22B) sont plus nombreux que les plombiers « eau et gaz » (110 en 43.22A). Le chauffage y pèse lourd : 62,5 % des logements sont au gaz ou en réseau de chaleur, et 5,9 % encore au fioul.",
      "Les hivers alsaciens concentrent les pannes de chauffage sur quelques semaines. Les clients appellent tous en même temps, souvent le soir en rentrant dans un logement froid ; celui qui répond et fixe un rendez-vous le premier garde le client, parfois pour un contrat d'entretien de plusieurs années.",
    ],
    faq: {
      q: "Pourquoi y a-t-il autant de chauffagistes à Strasbourg ?",
      a: "Le chauffage y est un marché central : 62,5 % des logements sont chauffés au gaz ou par réseau de chaleur (INSEE 2023), et les entreprises de chauffage-climatisation (138) y dépassent les plombiers eau et gaz (110), un cas unique parmi les quinze villes étudiées (Sirene 2026).",
    },
    sources: [SIRENE, insee("Strasbourg", "67482")],
  },
  bordeaux: {
    heading: "Les artisans du bâtiment à Bordeaux",
    stats: stats("342", "425", "148 377", "51,1 %"),
    paragraphs: [
      "Bordeaux compte 342 établissements actifs de plomberie et de chauffage et 425 électriciens pour 148 377 résidences principales, soit environ 434 logements par entreprise de plomberie-chauffage.",
      "Le chauffage y est partagé presque exactement en deux : 48,8 % au gaz ou en réseau de chaleur, 48,7 % à l'électricité. Un artisan bordelais doit donc savoir répondre aussi bien sur une chaudière que sur une pompe à chaleur ou un radiateur électrique.",
      "Plus de la moitié des logements (51,1 %) datent d'avant 1971, et beaucoup sont rénovés pièce par pièce. Ce sont des chantiers qui commencent par une simple demande de devis, souvent envoyée le soir : la vitesse de réponse décide qui sera rappelé.",
    ],
    faq: {
      q: "À Bordeaux, chauffage au gaz ou électrique ?",
      a: "Les deux à parts presque égales : 48,8 % des résidences principales au gaz ou en réseau de chaleur et 48,7 % à l'électricité, selon le recensement INSEE 2023.",
    },
    sources: [SIRENE, insee("Bordeaux", "33063")],
  },
  lille: {
    heading: "Les artisans du bâtiment à Lille",
    stats: stats("242", "330", "129 359", "49,9 %"),
    paragraphs: [
      "Lille compte 242 établissements actifs de plomberie et de chauffage et 330 électriciens pour 129 359 résidences principales, soit environ 535 logements par entreprise de plomberie-chauffage.",
      "La moitié du parc (49,9 %) date d'avant 1971, avec beaucoup de maisons de ville et d'immeubles anciens divisés en appartements. Le gaz et les réseaux de chaleur chauffent 52,7 % des logements, l'électricité 44,5 %.",
      "La clientèle lilloise compte de nombreux étudiants et jeunes actifs locataires : la demande arrive souvent par téléphone ou par message le soir, après le travail ou les cours, et attend une réponse rapide. Un artisan qui y répond en dehors de ses heures de chantier capte ces demandes avant ses concurrents.",
    ],
    faq: {
      q: "Le parc de logements de Lille est-il ancien ?",
      a: "Oui pour moitié : 49,9 % des résidences principales datent d'avant 1971 (recensement INSEE 2023), ce qui alimente une demande régulière de rénovation de plomberie, de chauffage et d'électricité.",
    },
    sources: [SIRENE, insee("Lille", "59350")],
  },
  rennes: {
    heading: "Les artisans du bâtiment à Rennes",
    stats: stats("97", "159", "122 334", "35,3 %"),
    paragraphs: [
      "Rennes ne compte que 97 établissements actifs de plomberie et de chauffage et 159 électriciens pour 122 334 résidences principales : environ 1 261 logements par entreprise de plomberie-chauffage, le plus fort ratio des quinze villes de cette page.",
      "Le gaz et les réseaux de chaleur chauffent 69,3 % des logements. Avec si peu d'entreprises pour autant de foyers, les plannings se remplissent vite à chaque hiver, et les clients attendent parfois plusieurs jours un simple rappel.",
      "Pour un artisan rennais, l'enjeu n'est pas de trouver du travail mais de l'organiser : qualifier chaque demande (urgence ou devis, adresse, type d'installation) avant de rappeler fait gagner des heures chaque semaine. C'est exactement ce que fait une réceptionniste IA.",
    ],
    faq: {
      q: "Pourquoi est-il difficile d'obtenir un rendez-vous de plombier à Rennes ?",
      a: "Parce que l'offre est très réduite : 97 établissements actifs de plomberie et de chauffage pour 122 334 résidences principales, soit environ 1 261 logements par entreprise (Sirene 2026, INSEE 2023), le ratio le plus élevé des quinze grandes villes étudiées.",
    },
    sources: [SIRENE, insee("Rennes", "35238")],
  },
  reims: {
    heading: "Les artisans du bâtiment à Reims",
    stats: stats("196", "261", "92 893", "41,1 %"),
    paragraphs: [
      "Reims compte 196 établissements actifs de plomberie et de chauffage et 261 électriciens pour 92 893 résidences principales, soit environ 474 logements par entreprise de plomberie-chauffage.",
      "Le gaz et les réseaux de chaleur chauffent 68,4 % des logements rémois, l'électricité 28,4 %. Entretien annuel, dépannage et remplacement de chaudières forment l'essentiel de l'activité des chauffagistes, avec un pic marqué dès les premiers froids.",
      "Dans une ville de taille moyenne, la réputation se joue beaucoup sur les avis Google. Les avis négatifs les plus fréquents ne parlent pas de la qualité du travail mais du fait que « personne ne rappelle » : répondre à chaque demande, même le soir, protège directement la note de l'entreprise.",
    ],
    faq: {
      q: "Quel est le mode de chauffage le plus courant à Reims ?",
      a: "Le gaz de ville ou le réseau de chaleur, pour 68,4 % des résidences principales (recensement INSEE 2023), devant l'électricité (28,4 %).",
    },
    sources: [SIRENE, insee("Reims", "51454")],
  },
  "saint-etienne": {
    heading: "Les artisans du bâtiment à Saint-Étienne",
    stats: stats("221", "340", "86 762", "52,4 %"),
    paragraphs: [
      "Saint-Étienne compte 221 établissements actifs de plomberie et de chauffage et 340 électriciens pour 86 762 résidences principales, soit environ 393 logements par entreprise de plomberie-chauffage.",
      "C'est la ville la plus dépendante du gaz et des réseaux de chaleur de cette page : 71,6 % des logements, contre 21,6 % à l'électricité et 4 % au fioul. Plus de la moitié du parc (52,4 %) date d'avant 1971.",
      "Ce parc ancien chauffé au gaz est au cœur des aides à la rénovation énergétique : les propriétaires qui changent de chaudière ou isolent cherchent un artisan qualifié et comparent plusieurs devis. Celui qui répond vite, explique clairement et propose un rendez-vous gagne souvent le chantier.",
    ],
    faq: {
      q: "Saint-Étienne est-elle une ville chauffée au gaz ?",
      a: "Oui : 71,6 % des résidences principales sont chauffées au gaz de ville ou par réseau de chaleur, la part la plus élevée parmi les quinze villes étudiées (recensement INSEE 2023).",
    },
    sources: [SIRENE, insee("Saint-Étienne", "42218")],
  },
  toulon: {
    heading: "Les artisans du bâtiment à Toulon",
    stats: stats("320", "378", "90 433", "60,1 %"),
    paragraphs: [
      "Toulon compte 320 établissements actifs de plomberie et de chauffage et 378 électriciens pour 90 433 résidences principales : environ 283 logements par entreprise de plomberie-chauffage, l'un des marchés les plus concurrentiels de cette page.",
      "Le parc est ancien : 60,1 % des logements datent d'avant 1971, la deuxième part la plus élevée après Paris. Le chauffage électrique (48,8 %) devance le gaz ou le réseau de chaleur (41,7 %), et 6,1 % des logements sont encore au fioul.",
      "Entre dégâts des eaux dans l'ancien et climatisation en été, la demande est forte mais la concurrence aussi. Dans ces conditions, la différence se fait sur la rapidité de réponse et la clarté du premier échange, bien avant le prix.",
    ],
    faq: {
      q: "Les logements de Toulon sont-ils anciens ?",
      a: "Majoritairement : 60,1 % des résidences principales datent d'avant 1971, selon le recensement INSEE 2023 — la deuxième part la plus élevée des quinze grandes villes étudiées, après Paris.",
    },
    sources: [SIRENE, insee("Toulon", "83137")],
  },
  grenoble: {
    heading: "Les artisans du bâtiment à Grenoble",
    stats: stats("178", "243", "84 099", "50,7 %"),
    paragraphs: [
      "Grenoble compte 178 établissements actifs de plomberie et de chauffage et 243 électriciens pour 84 099 résidences principales, soit environ 472 logements par entreprise de plomberie-chauffage.",
      "Le gaz et les réseaux de chaleur chauffent 64,5 % des logements, l'électricité 32,6 %, et le fioul ne pèse plus que 1,1 %. Avec la moitié du parc (50,7 %) construit avant 1971 et des hivers de montagne, l'entretien et la modernisation du chauffage occupent une large part de l'activité.",
      "La clientèle grenobloise, nombreuse dans les métiers de la recherche et de la technologie, a l'habitude de tout réserver en ligne. Un artisan qui propose une prise de demande simple, à toute heure, avec une réponse immédiate, correspond exactement à ses attentes.",
    ],
    faq: {
      q: "Comment se chauffent les logements à Grenoble ?",
      a: "Surtout au gaz de ville ou par réseau de chaleur : 64,5 % des résidences principales, contre 32,6 % à l'électricité (recensement INSEE 2023).",
    },
    sources: [SIRENE, insee("Grenoble", "38185")],
  },
};
