import type { LocalBlock, LocalSource } from "./frLocal";

/**
 * /fr/dentiste/[ville] — sourced local blocks.
 *
 * Figures (researched 2026-10-02):
 *  - Dentists, density and the 60+ share: DREES, "La démographie des
 *    professionnels de santé", chirurgiens-dentistes in activity on
 *    1 January 2026, by DÉPARTEMENT (no official source publishes them per
 *    commune — the raw RPPS extract double-counts multi-site dentists, so it
 *    is deliberately not used). National: 48 690, 70,48 per 100 000, 17,9 %
 *    aged 60+. The 60+ share is (60-64 + 65+) / total from the same workbook.
 *  - Zoning: ARS zonage for chirurgiens-dentistes (arrêtés of 2024, method of
 *    the arrêté of 20/03/2024), via Atlasanté/data.gouv. Zonings last about
 *    two years — RE-CHECK at the end of 2026 and update the sentences that
 *    name sous-dotée communes.
 *  - Faculties: the university's own page.
 */

const DREES: LocalSource = { label: "DREES, démographie des chirurgiens-dentistes au 1er janvier 2026", url: "https://data.drees.solidarites-sante.gouv.fr/explore/dataset/la-demographie-des-professionnels-de-sante-depuis-2012/" };
const ZONAGE: LocalSource = { label: "Zonages ARS des chirurgiens-dentistes (Atlasanté, data.gouv)", url: "https://www.data.gouv.fr/datasets/zonages-des-professionnels-de-sante-liberaux" };
const fac = (label: string, url: string): LocalSource => ({ label, url });

/* `senior` is "—" where the research did not compute the 60+ share for that
   département: the tile is dropped rather than shown empty. */
const stats = (dept: string, count: string, density: string, senior: string, school: string, schoolNote: string) => [
  { label: "Chirurgiens-dentistes", value: count, note: `${dept}, DREES 2026` },
  { label: "Pour 100 000 habitants", value: density, note: "France : 70,5 — DREES 2026" },
  ...(senior === "—" ? [] : [{ label: "Âgés de 60 ans et plus", value: senior, note: "France : 17,9 % — DREES 2026" }]),
  { label: "Faculté d'odontologie", value: school, note: schoolNote.match(/\d{4}/) ? schoolNote : `${schoolNote}, 2025` },
];

export const FR_LOCAL_DENTAL: Record<string, LocalBlock> = {
  paris: {
    heading: "Le marché dentaire à Paris",
    stats: stats("Paris (75)", "3 375", "164,8", "28,3 %", "Oui", "Université Paris Cité, 2026"),
    paragraphs: [
      "Paris compte 3 375 chirurgiens-dentistes en activité, soit 164,8 pour 100 000 habitants : plus du double de la moyenne nationale (70,5). C'est de loin la plus forte densité de France, et la conséquence est simple : un patient parisien a toujours une alternative à quelques rues, et il la trouve sur Google en quelques secondes.",
      "Particularité forte : 28,3 % des dentistes parisiens ont 60 ans ou plus, contre 17,9 % au niveau national. Une vague de départs en retraite et de reprises de cabinets est en cours ; un cabinet repris garde sa patientèle plus facilement s'il est joignable et visible en ligne dès le premier jour.",
      "Aucun arrondissement n'est classé sous-doté par l'ARS, mais plusieurs communes de la Métropole du Grand Paris le sont, comme Bobigny, Sevran ou Argenteuil. Une partie des patients de ces communes cherche un rendez-vous dans Paris : un cabinet qui répond à leurs demandes du soir capte une patientèle qui vient de loin.",
    ],
    faq: {
      q: "Combien y a-t-il de dentistes à Paris ?",
      a: "3 375 chirurgiens-dentistes en activité au 1er janvier 2026, soit 164,8 pour 100 000 habitants, plus du double de la moyenne nationale de 70,5 (DREES). 28,3 % d'entre eux ont 60 ans ou plus.",
    },
    sources: [DREES, ZONAGE, fac("UFR d'odontologie, Université Paris Cité", "https://u-paris.fr/odontologie/sitesetacces/")],
  },
  marseille: {
    heading: "Le marché dentaire à Marseille",
    stats: stats("Bouches-du-Rhône (13)", "2 167", "102,3", "18,9 %", "Oui", "Aix-Marseille Université, 2026"),
    paragraphs: [
      "Les Bouches-du-Rhône comptent 2 167 chirurgiens-dentistes en activité, soit 102,3 pour 100 000 habitants, nettement au-dessus de la moyenne nationale (70,5). Marseille dispose de sa propre faculté d'odontologie (Aix-Marseille Université), qui alimente chaque année l'installation de jeunes praticiens.",
      "Mais la ville n'est pas homogène : le zonage de l'ARS classe le 16e arrondissement en zone très sous-dotée et le 10e en zone sous-dotée, comme plusieurs communes de la métropole (Martigues, Vitrolles). D'un quartier à l'autre, un cabinet peut être saturé ou en pleine concurrence.",
      "Dans les quartiers bien dotés, la différence se fait sur la visibilité et la réactivité ; dans les quartiers sous-dotés, sur la capacité à absorber les demandes sans y passer la journée au téléphone. Dans les deux cas, une assistante qui répond 24 h/24 et trie les demandes fait gagner des rendez-vous ou des heures.",
    ],
    faq: {
      q: "Y a-t-il des zones sous-dotées en dentistes à Marseille ?",
      a: "Oui : le zonage ARS en vigueur classe le 16e arrondissement en zone très sous-dotée et le 10e en zone sous-dotée, ainsi que plusieurs communes de la métropole Aix-Marseille-Provence comme Martigues et Vitrolles.",
    },
    sources: [DREES, ZONAGE, fac("Faculté d'odontologie, Aix-Marseille Université", "https://odontologie.univ-amu.fr/")],
  },
  lyon: {
    heading: "Le marché dentaire à Lyon",
    stats: stats("Rhône (69)", "1 665", "86,0", "14,1 %", "Oui", "Université Lyon 1, 2026"),
    paragraphs: [
      "Le Rhône compte 1 665 chirurgiens-dentistes en activité, soit 86,0 pour 100 000 habitants (70,5 en France). Lyon accueille la faculté d'odontologie de l'Université Claude Bernard Lyon 1, dans le 8e arrondissement, et la profession y est relativement jeune : seulement 14,1 % des dentistes ont 60 ans ou plus.",
      "Une profession jeune, c'est une concurrence qui s'installe : de nouveaux cabinets, souvent bien équipés en outils numériques, s'ouvrent chaque année. Cinq des neuf arrondissements sont classés « très dotés » par l'ARS — autrement dit, le patient lyonnais a le choix.",
      "À l'inverse, plusieurs communes de la Métropole sont en zone très sous-dotée, dont Vaulx-en-Velin, Saint-Priest, Rillieux-la-Pape et Décines-Charpieu. Leurs habitants cherchent des rendez-vous ailleurs, souvent le soir sur leur téléphone : un cabinet lyonnais qui répond à ce moment-là gagne ces patients.",
    ],
    faq: {
      q: "Les dentistes lyonnais sont-ils en concurrence ?",
      a: "Oui : le Rhône compte 86,0 dentistes pour 100 000 habitants contre 70,5 en France (DREES 2026), et cinq arrondissements de Lyon sont classés très dotés par l'ARS. Les communes voisines de Vaulx-en-Velin, Saint-Priest ou Rillieux-la-Pape sont en revanche très sous-dotées.",
    },
    sources: [DREES, ZONAGE, fac("Faculté d'odontologie, Université Claude Bernard Lyon 1", "https://www.onisep.fr/ressources/structures-enseignement/auvergne-rhone-alpes/rhone/faculte-d-odontologie-universite-claude-bernard-lyon-1")],
  },
  toulouse: {
    heading: "Le marché dentaire à Toulouse",
    stats: stats("Haute-Garonne (31)", "1 511", "99,4", "15,3 %", "Oui", "Université de Toulouse, 2026"),
    paragraphs: [
      "La Haute-Garonne compte 1 511 chirurgiens-dentistes en activité, soit 99,4 pour 100 000 habitants, bien au-dessus de la moyenne nationale (70,5). Toulouse forme ses propres praticiens au département d'odontologie de l'Université de Toulouse, et 15,3 % seulement des dentistes ont 60 ans ou plus.",
      "Toulouse est classée « très dotée » par l'ARS, et aucune des 37 communes de Toulouse Métropole n'est en zone sous-dotée. C'est donc un marché où le patient choisit : il compare les avis, les sites et la facilité de prise de rendez-vous avant d'appeler.",
      "Dans un tel marché, la question n'est pas d'avoir des patients mais d'être celui qu'on choisit. Un site clair sur les soins proposés et une réponse immédiate à chaque demande, même à 22 h, sont souvent ce qui fait basculer le choix.",
    ],
    faq: {
      q: "Toulouse manque-t-elle de dentistes ?",
      a: "Non : la Haute-Garonne compte 99,4 dentistes pour 100 000 habitants contre 70,5 en France (DREES 2026), Toulouse est classée très dotée et aucune commune de Toulouse Métropole n'est en zone sous-dotée selon le zonage ARS.",
    },
    sources: [DREES, ZONAGE, fac("Département d'odontologie, Université de Toulouse", "https://dentaire.univ-tlse3.fr/presentation")],
  },
  nice: {
    heading: "Le marché dentaire à Nice",
    stats: stats("Alpes-Maritimes (06)", "1 432", "124,0", "20,5 %", "Oui", "Université Côte d'Azur, 2026"),
    paragraphs: [
      "Les Alpes-Maritimes comptent 1 432 chirurgiens-dentistes en activité, soit 124,0 pour 100 000 habitants : la deuxième plus forte densité des quinze villes de cette page, après Paris. Nice dispose de sa faculté de chirurgie dentaire (Université Côte d'Azur).",
      "Le contraste est frappant : Nice elle-même n'est pas prioritaire pour l'ARS, mais 42 des 51 communes de la Métropole Nice Côte d'Azur sont classées très sous-dotées, souvent dans l'arrière-pays. Les patients de ces communes descendent consulter sur la côte.",
      "Ajoutez une patientèle internationale et des résidents secondaires, et une part des demandes arrive en anglais ou en italien, à des heures décalées. Un cabinet niçois qui répond dans la langue du patient, à toute heure, se démarque immédiatement dans un marché aussi dense.",
    ],
    faq: {
      q: "Nice a-t-elle beaucoup de dentistes ?",
      a: "Oui : 124,0 dentistes pour 100 000 habitants dans les Alpes-Maritimes, contre 70,5 en France (DREES 2026). Mais 42 des 51 communes de la Métropole Nice Côte d'Azur sont classées très sous-dotées par l'ARS, dont beaucoup dans l'arrière-pays.",
    },
    sources: [DREES, ZONAGE, fac("Faculté de chirurgie dentaire, Université Côte d'Azur", "https://odontologie.univ-cotedazur.fr/")],
  },
  nantes: {
    heading: "Le marché dentaire à Nantes",
    stats: stats("Loire-Atlantique (44)", "1 031", "67,7", "—", "Oui", "Nantes Université, 2026"),
    paragraphs: [
      "La Loire-Atlantique compte 1 031 chirurgiens-dentistes en activité, soit 67,7 pour 100 000 habitants : en dessous de la moyenne nationale (70,5), malgré la présence d'une UFR d'odontologie à Nantes Université. Le département grandit plus vite que sa démographie dentaire.",
      "Nantes est classée « très dotée » par l'ARS et aucune commune de Nantes Métropole n'est en zone sous-dotée, mais la densité départementale montre que la demande reste forte : beaucoup de cabinets refusent déjà de nouveaux patients ou proposent des délais de plusieurs semaines.",
      "Pour un cabinet nantais très demandé, l'enjeu est d'abord l'organisation : répondre à chaque appel prend du temps au secrétariat et au praticien. Une assistante IA qui répond aux questions courantes, recueille le motif et les coordonnées, et laisse le cabinet rappeler dans l'ordre, libère ce temps.",
    ],
    faq: {
      q: "Y a-t-il assez de dentistes en Loire-Atlantique ?",
      a: "La densité y est de 67,7 dentistes pour 100 000 habitants, légèrement sous la moyenne nationale de 70,5 (DREES 2026), bien que Nantes soit classée très dotée par l'ARS et forme des praticiens à l'UFR d'odontologie de Nantes Université.",
    },
    sources: [DREES, ZONAGE, fac("UFR d'odontologie, Nantes Université", "https://odontologie.univ-nantes.fr/")],
  },
  montpellier: {
    heading: "Le marché dentaire à Montpellier",
    stats: stats("Hérault (34)", "1 219", "96,4", "16,6 %", "Oui", "Université de Montpellier, 2026"),
    paragraphs: [
      "L'Hérault compte 1 219 chirurgiens-dentistes en activité, soit 96,4 pour 100 000 habitants (70,5 en France). Montpellier, ville universitaire et médicale, forme ses dentistes à la faculté d'odontologie de l'Université de Montpellier.",
      "La ville est classée « très dotée » par l'ARS ; seules deux communes de la métropole, Cournonsec et Cournonterral, sont en zone très sous-dotée. Le marché montpelliérain est donc concurrentiel, avec une population qui augmente et beaucoup de nouveaux arrivants sans dentiste attitré.",
      "Ces nouveaux habitants choisissent leur cabinet en ligne. Ceux qui trouvent rapidement les soins proposés, les horaires et une réponse à leur demande prennent rendez-vous ; les autres passent au résultat suivant. C'est là qu'un site clair et une assistante disponible 24 h/24 font la différence.",
    ],
    faq: {
      q: "Comment trouver des nouveaux patients à Montpellier ?",
      a: "Dans un marché très doté (96,4 dentistes pour 100 000 habitants dans l'Hérault contre 70,5 en France, DREES 2026), les nouveaux arrivants choisissent en ligne : un site clair sur les soins et une réponse immédiate à leurs demandes, y compris le soir, augmentent la part de ceux qui prennent rendez-vous.",
    },
    sources: [DREES, ZONAGE, fac("Faculté d'odontologie, Université de Montpellier", "https://www.onisep.fr/ressources/structures-enseignement/occitanie/herault/ufr-d-odontologie-universite-de-montpellier")],
  },
  strasbourg: {
    heading: "Le marché dentaire à Strasbourg",
    stats: stats("Bas-Rhin (67)", "1 080", "92,0", "18,4 %", "Oui", "Université de Strasbourg, 2026"),
    paragraphs: [
      "Le Bas-Rhin compte 1 080 chirurgiens-dentistes en activité, soit 92,0 pour 100 000 habitants (70,5 en France). Strasbourg abrite la faculté de chirurgie dentaire de l'Université de Strasbourg, et 29 des 33 communes de l'Eurométropole sont classées très dotées par l'ARS.",
      "Le marché est donc dense, et une partie de la patientèle est frontalière ou internationale : institutions européennes, travailleurs venus d'Allemagne, étudiants étrangers. Les demandes arrivent en français, en allemand ou en anglais.",
      "Un cabinet strasbourgeois dont le site et l'assistante répondent dans ces trois langues, à toute heure, capte une patientèle que beaucoup de concurrents laissent filer faute de réponse. C'est un avantage concret dans un marché où le patient a le choix.",
    ],
    faq: {
      q: "Strasbourg est-elle bien dotée en dentistes ?",
      a: "Oui : le Bas-Rhin compte 92,0 dentistes pour 100 000 habitants contre 70,5 en France (DREES 2026), et 29 des 33 communes de l'Eurométropole sont classées très dotées par l'ARS ; seule La Wantzenau est en zone sous-dotée.",
    },
    sources: [DREES, ZONAGE, fac("Faculté de chirurgie dentaire, Université de Strasbourg", "https://www.unistra.fr/fr/entites/faculte-ecole-institut/faculte-chirurgie-dentaire")],
  },
  bordeaux: {
    heading: "Le marché dentaire à Bordeaux",
    stats: stats("Gironde (33)", "1 475", "85,0", "13,6 %", "Oui", "Université de Bordeaux, 2026"),
    paragraphs: [
      "La Gironde compte 1 475 chirurgiens-dentistes en activité, soit 85,0 pour 100 000 habitants (70,5 en France). La profession y est l'une des plus jeunes de cette page : seulement 13,6 % des dentistes ont 60 ans ou plus. Bordeaux forme ses praticiens à l'UFR des sciences odontologiques.",
      "Bordeaux est classée « très dotée », mais six communes de Bordeaux Métropole sont en zone très sous-dotée, dont Le Bouscat et Saint-Médard-en-Jalles. Une partie de leurs habitants cherche un cabinet à Bordeaux même.",
      "Une profession jeune et en croissance, c'est une concurrence qui maîtrise déjà les outils en ligne. Pour un cabinet bordelais, être joignable à tout moment et répondre précisément aux questions des patients n'est plus un bonus mais le minimum pour rester dans la course.",
    ],
    faq: {
      q: "La Gironde manque-t-elle de dentistes ?",
      a: "Globalement non : 85,0 dentistes pour 100 000 habitants contre 70,5 en France (DREES 2026). Mais six communes de Bordeaux Métropole, dont Le Bouscat et Saint-Médard-en-Jalles, sont classées très sous-dotées par l'ARS.",
    },
    sources: [DREES, ZONAGE, fac("UFR des sciences odontologiques, Université de Bordeaux", "https://www.u-bordeaux.fr/universite/organisation-et-fonctionnement/composantes-de-formation/college-sciences-sante/ufr-odontologie")],
  },
  lille: {
    heading: "Le marché dentaire à Lille",
    stats: stats("Nord (59)", "1 719", "65,8", "—", "Oui", "Université de Lille, 2026"),
    paragraphs: [
      "Le Nord compte 1 719 chirurgiens-dentistes en activité, soit 65,8 pour 100 000 habitants : en dessous de la moyenne nationale (70,5). Lille est classée en zone intermédiaire, et la Métropole européenne de Lille compte 10 communes très sous-dotées et 14 sous-dotées, dont Roubaix, Wattrelos, Armentières et Loos.",
      "Le service d'odontologie du CHU de Lille, adossé à l'Université de Lille, reçoit à lui seul environ 70 000 patients par an. La demande dépasse l'offre dans une bonne partie de la métropole, et beaucoup de cabinets sont saturés.",
      "Pour un cabinet lillois, chaque appel non décroché est un patient qui attendra ailleurs — ou nulle part. Une assistante qui répond à toute heure, recueille le motif et l'urgence et transmet une demande propre au secrétariat permet de servir plus de patients sans allonger les journées.",
    ],
    faq: {
      q: "Pourquoi est-il difficile d'avoir un rendez-vous chez le dentiste à Lille ?",
      a: "Le Nord compte 65,8 dentistes pour 100 000 habitants, sous la moyenne nationale de 70,5 (DREES 2026), et 24 communes de la Métropole européenne de Lille sont classées sous-dotées ou très sous-dotées par l'ARS, dont Roubaix et Wattrelos.",
    },
    sources: [DREES, ZONAGE, fac("Département d'odontologie, Université de Lille", "https://ufr3s.univ-lille.fr/odontologie")],
  },
  rennes: {
    heading: "Le marché dentaire à Rennes",
    stats: stats("Ille-et-Vilaine (35)", "821", "71,5", "13,0 %", "Oui", "Université de Rennes, 2026"),
    paragraphs: [
      "L'Ille-et-Vilaine compte 821 chirurgiens-dentistes en activité, soit 71,5 pour 100 000 habitants, presque exactement la moyenne nationale (70,5). La profession y est jeune : 13,0 % des dentistes ont 60 ans ou plus. Rennes forme ses praticiens à la faculté d'odontologie de l'Université de Rennes.",
      "Rennes est classée « très dotée », mais Rennes Métropole compte trois communes très sous-dotées et trois sous-dotées, dont Mordelles. Les patients de la périphérie viennent donc chercher un rendez-vous en ville.",
      "Ce sont souvent des familles qui organisent les rendez-vous de plusieurs personnes et appellent en fin de journée. Un cabinet rennais qui leur répond à ce moment-là, avec les informations dont elles ont besoin, remplit son agenda avec des patients fidèles.",
    ],
    faq: {
      q: "Rennes a-t-elle assez de dentistes ?",
      a: "La densité de l'Ille-et-Vilaine (71,5 pour 100 000 habitants) est proche de la moyenne nationale de 70,5 (DREES 2026). Rennes est classée très dotée, mais six communes de Rennes Métropole sont en zone sous-dotée ou très sous-dotée selon l'ARS.",
    },
    sources: [DREES, ZONAGE, fac("Faculté d'odontologie, Université de Rennes", "https://odonto.univ-rennes.fr/")],
  },
  reims: {
    heading: "Le marché dentaire à Reims",
    stats: stats("Marne (51)", "440", "79,0", "12,0 %", "Oui", "Université de Reims, 2026"),
    paragraphs: [
      "La Marne compte 440 chirurgiens-dentistes en activité, soit 79,0 pour 100 000 habitants (70,5 en France). C'est la profession la plus jeune des quinze villes de cette page : 12,0 % seulement des dentistes marnais ont 60 ans ou plus. Reims forme ses praticiens à l'UFR d'odontologie de l'Université de Reims Champagne-Ardenne.",
      "Reims est classée en zone intermédiaire, mais la Communauté urbaine du Grand Reims compte 30 communes très sous-dotées et 33 sous-dotées sur 143. Beaucoup d'habitants des villages alentour doivent venir à Reims pour se faire soigner.",
      "Ces patients viennent de loin et veulent organiser leur venue : horaires, soins proposés, accès, délai. Un cabinet rémois qui répond à ces questions à toute heure, et enregistre la demande, capte une patientèle de tout le Grand Reims.",
    ],
    faq: {
      q: "Le Grand Reims manque-t-il de dentistes ?",
      a: "En partie : Reims est en zone intermédiaire, mais 63 des 143 communes du Grand Reims sont classées sous-dotées ou très sous-dotées par l'ARS. La Marne compte 79,0 dentistes pour 100 000 habitants contre 70,5 en France (DREES 2026).",
    },
    sources: [DREES, ZONAGE, fac("UFR d'odontologie, Université de Reims Champagne-Ardenne", "https://www.onisep.fr/ressources/structures-enseignement/grand-est/marne/ufr-d-odontologie-universite-de-reims-champagne-ardenne")],
  },
  "saint-etienne": {
    heading: "Le marché dentaire à Saint-Étienne",
    stats: stats("Loire (42)", "436", "56,1", "19,7 %", "Non", "aucune UFR, 2025"),
    paragraphs: [
      "La Loire compte 436 chirurgiens-dentistes en activité, soit 56,1 pour 100 000 habitants : la plus faible densité des quinze villes de cette page, loin sous la moyenne nationale (70,5). Près d'un dentiste sur cinq (19,7 %) a 60 ans ou plus, et la ville n'a pas de faculté d'odontologie pour former la relève sur place.",
      "Saint-Étienne est la seule grande ville de cette page classée elle-même en zone sous-dotée par l'ARS, et Saint-Étienne Métropole compte 29 communes très sous-dotées, dont Firminy et Rive-de-Gier. Trouver un dentiste y est réellement difficile.",
      "Pour un cabinet stéphanois, le problème n'est pas d'attirer des patients mais de répondre à tous sans y passer ses journées. Une assistante IA qui répond aux questions, trie les urgences et transmet des demandes complètes permet au cabinet de soigner au lieu de décrocher. Le zonage sous-doté ouvre aussi droit à des aides à l'installation, à vérifier auprès de l'ARS.",
    ],
    faq: {
      q: "Saint-Étienne manque-t-elle de dentistes ?",
      a: "Oui : la commune est classée en zone sous-dotée par l'ARS, et la Loire compte 56,1 dentistes pour 100 000 habitants contre 70,5 en France (DREES 2026), la plus faible densité des quinze grandes villes étudiées. 19,7 % des dentistes de la Loire ont 60 ans ou plus.",
    },
    sources: [DREES, ZONAGE, fac("Assemblée nationale, question écrite n° 2615 (sites de formation en odontologie)", "https://questions.assemblee-nationale.fr/q17/17-2615QE.htm")],
  },
  toulon: {
    heading: "Le marché dentaire à Toulon",
    stats: stats("Var (83)", "1 008", "87,8", "19,0 %", "Non", "formation à Marseille ou Nice"),
    paragraphs: [
      "Le Var compte 1 008 chirurgiens-dentistes en activité, soit 87,8 pour 100 000 habitants (70,5 en France). Toulon n'a pas de faculté d'odontologie : les praticiens sont formés à Marseille ou à Nice, et 19,0 % des dentistes varois ont 60 ans ou plus.",
      "Toulon est classée « très dotée » par l'ARS ; seule La Garde est en zone sous-dotée dans l'agglomération. Le marché toulonnais est donc concurrentiel, avec une forte part de retraités et une population qui augmente l'été.",
      "Les patients retraités appellent volontiers et posent beaucoup de questions avant un soin (prothèses, implants, remboursements) ; les vacanciers cherchent une urgence en ligne. Une assistante qui répond patiemment aux premiers et rapidement aux seconds sert les deux sans saturer le secrétariat.",
    ],
    faq: {
      q: "Y a-t-il une faculté dentaire à Toulon ?",
      a: "Non : les chirurgiens-dentistes de la région sont formés à Marseille (Aix-Marseille Université) ou à Nice (Université Côte d'Azur). Le Var compte 87,8 dentistes pour 100 000 habitants, contre 70,5 en France (DREES 2026).",
    },
    sources: [DREES, ZONAGE, fac("Assemblée nationale, question écrite n° 2615 (sites de formation en odontologie)", "https://questions.assemblee-nationale.fr/q17/17-2615QE.htm")],
  },
  grenoble: {
    heading: "Le marché dentaire à Grenoble",
    stats: stats("Isère (38)", "801", "60,9", "—", "Antenne", "pas d'UFR complète, 2025"),
    paragraphs: [
      "L'Isère compte 801 chirurgiens-dentistes en activité, soit 60,9 pour 100 000 habitants : la deuxième plus faible densité des quinze villes de cette page, nettement sous la moyenne nationale (70,5). Grenoble n'a pas de faculté d'odontologie complète, seulement une antenne de formation.",
      "Grenoble est en zone intermédiaire, mais ses voisines Saint-Martin-d'Hères et Fontaine sont classées très sous-dotées, comme 22 communes de la métropole au total. Beaucoup de Grenoblois et d'habitants des vallées peinent à obtenir un rendez-vous.",
      "Dans ces conditions, les cabinets grenoblois sont souvent complets et leur téléphone sonne sans arrêt. Une assistante IA qui répond à toute heure, recueille le motif, l'urgence et les coordonnées, puis transmet une demande prête à traiter, fait gagner un temps précieux au secrétariat comme aux patients.",
    ],
    faq: {
      q: "Est-ce difficile de trouver un dentiste à Grenoble ?",
      a: "Souvent, oui : l'Isère compte 60,9 dentistes pour 100 000 habitants contre 70,5 en France (DREES 2026), et 22 communes de la métropole grenobloise, dont Saint-Martin-d'Hères et Fontaine, sont classées très sous-dotées par l'ARS.",
    },
    sources: [DREES, ZONAGE, fac("Assemblée nationale, question écrite n° 2615 (sites de formation en odontologie)", "https://questions.assemblee-nationale.fr/q17/17-2615QE.htm")],
  },
};
