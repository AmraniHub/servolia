import type { LocalBlock, LocalSource } from "./frLocal";

/**
 * /fr/clinique-esthetique/[ville] — sourced local blocks.
 *
 * France keeps no register of "médecins esthétiques", so the pages use honest
 * proxies (researched 2026-10-02):
 *  - Dermatologists: DREES, practising on 1 January 2026, by DÉPARTEMENT,
 *    with DREES's own density. National: 3 698, 5,35 per 100 000.
 *  - Plastic surgeons (chirurgie plastique, reconstructrice et esthétique):
 *    NOT published per area by DREES; counted from the public Annuaire Santé
 *    RPPS extract of 24/09/2026 — distinct doctors with a practice in the
 *    COMMUNE (a doctor in two communes counts in both; CHU sites outside the
 *    city limits are not included). The pages say so. National DREES count:
 *    1 163.
 *  - Hospital departments: the CHU's own page (or the FHF directory).
 *  - Décret n° 2024-490: since 1 July 2024 injectable hyaluronic acid is
 *    supplied only to doctors (and to dentists for medical use) or on
 *    prescription — the rule that took aesthetic injections away from
 *    unqualified injectors.
 */

const DREES: LocalSource = { label: "DREES, démographie des médecins au 1er janvier 2026", url: "https://data.drees.solidarites-sante.gouv.fr/explore/dataset/la-demographie-des-professionnels-de-sante-depuis-2012/information/" };
const RPPS: LocalSource = { label: "Annuaire Santé RPPS, extraction du 24/09/2026", url: "https://www.data.gouv.fr/datasets/annuaire-sante-extractions-des-donnees-en-libre-acces-des-professionnels-intervenant-dans-le-systeme-de-sante-rpps-format-zip" };
const DECRET: LocalSource = { label: "Décret n° 2024-490 (service-public.gouv.fr)", url: "https://www.service-public.gouv.fr/particuliers/actualites/A17436" };
const chu = (label: string, url: string): LocalSource => ({ label, url });

const stats = (dept: string, derm: string, density: string, plastic: string, plasticNote = "exerçant dans la commune, RPPS 2026") => [
  { label: "Dermatologues", value: derm, note: `${dept}, DREES 2026` },
  { label: "Dermatologues / 100 000 hab.", value: density, note: "France : 5,35 — DREES 2026" },
  { label: "Chirurgiens plasticiens", value: plastic, note: plasticNote },
];

export const FR_LOCAL_AESTHETIC: Record<string, LocalBlock> = {
  paris: {
    heading: "La médecine esthétique à Paris",
    stats: stats("Paris (75)", "558", "27,3", "303"),
    paragraphs: [
      "Paris concentre une offre sans équivalent en France : 558 dermatologues en activité, soit 27,3 pour 100 000 habitants, cinq fois la moyenne nationale (5,35), et 303 chirurgiens plasticiens exerçant dans la ville selon l'annuaire RPPS. L'AP-HP compte à elle seule deux services de chirurgie plastique, reconstructrice et esthétique, à Saint-Louis et à Tenon.",
      "Pour une clinique parisienne, la concurrence est donc maximale. Les patientes comparent les praticiens, les avant-après, les avis et la clarté des tarifs avant de demander une consultation — souvent depuis leur téléphone, le soir ou le week-end.",
      "Depuis le 1er juillet 2024, l'acide hyaluronique injectable n'est plus délivré qu'aux médecins (décret n° 2024-490), pour écarter les injecteurs illégaux. Afficher clairement qui pratique, avec quelle qualification, et répondre aussitôt aux questions est devenu un argument de confiance autant que de conversion.",
    ],
    faq: {
      q: "Combien de dermatologues et de chirurgiens plasticiens à Paris ?",
      a: "558 dermatologues en activité au 1er janvier 2026, soit 27,3 pour 100 000 habitants contre 5,35 en France (DREES), et 303 chirurgiens plasticiens exerçant dans la commune selon l'annuaire RPPS de septembre 2026.",
    },
    sources: [DREES, RPPS, DECRET, chu("AP-HP Saint-Louis, chirurgie plastique, reconstructrice et esthétique", "https://www.aphp.fr/saint-louis/service-de-chirurgie-plastique-reconstructrice-et-esthetique-et-traitement-chirurgical")],
  },
  marseille: {
    heading: "La médecine esthétique à Marseille",
    stats: stats("Bouches-du-Rhône (13)", "179", "8,45", "62"),
    paragraphs: [
      "Les Bouches-du-Rhône comptent 179 dermatologues en activité, soit 8,45 pour 100 000 habitants (5,35 en France), et 62 chirurgiens plasticiens exercent à Marseille même selon l'annuaire RPPS. L'AP-HM dispose d'un service de chirurgie plastique, reconstructrice et esthétique à l'hôpital de la Conception.",
      "Le marché marseillais est large et très visuel : une grande partie des patientes découvre les cliniques sur Instagram, puis vérifie sur Google avant d'écrire. Le moment où elles posent leur première question, souvent tard le soir, décide de la suite.",
      "Une clinique qui répond immédiatement aux questions sur les soins, la consultation préalable et le praticien, puis propose un créneau, transforme beaucoup plus de ces demandes en rendez-vous qu'une messagerie qui répond le lendemain.",
    ],
    faq: {
      q: "Y a-t-il beaucoup de chirurgiens esthétiques à Marseille ?",
      a: "62 chirurgiens plasticiens (spécialité chirurgie plastique, reconstructrice et esthétique) exercent dans la commune selon l'annuaire RPPS de septembre 2026, et les Bouches-du-Rhône comptent 8,45 dermatologues pour 100 000 habitants contre 5,35 en France (DREES 2026).",
    },
    sources: [DREES, RPPS, chu("AP-HM, chirurgie plastique (hôpital de la Conception)", "https://fr.ap-hm.fr/category/disciplines/chirurgie-plastique")],
  },
  lyon: {
    heading: "La médecine esthétique à Lyon",
    stats: stats("Rhône (69)", "134", "6,92", "60"),
    paragraphs: [
      "Le Rhône compte 134 dermatologues en activité (6,92 pour 100 000 habitants, 5,35 en France), et 60 chirurgiens plasticiens exercent à Lyon selon l'annuaire RPPS. Le service de chirurgie plastique, reconstructrice et esthétique des HCL, à l'hôpital de la Croix-Rousse, opère plus de 1 000 patients et reçoit plus de 3 500 consultations par an.",
      "Avec une offre hospitalière solide et un secteur libéral dense, les patientes lyonnaises sont exigeantes : elles veulent savoir qui les traite, avec quelle formation, et à quoi s'attendre avant de se déplacer.",
      "Une clinique lyonnaise qui répond à ces questions précisément, à toute heure, et rappelle le cadre (consultation préalable, délai de réflexion, praticien diplômé) inspire confiance dès le premier échange. C'est ce qui fait passer de la curiosité à la prise de rendez-vous.",
    ],
    faq: {
      q: "Où se faire opérer en chirurgie esthétique à Lyon ?",
      a: "Dans le secteur libéral (60 chirurgiens plasticiens exercent à Lyon selon l'annuaire RPPS 2026) ou au service de chirurgie plastique, reconstructrice et esthétique des HCL à l'hôpital de la Croix-Rousse, qui opère plus de 1 000 patients par an.",
    },
    sources: [DREES, RPPS, chu("HCL, chirurgie plastique à l'hôpital de la Croix-Rousse", "https://www.chu-lyon.fr/10-ans-de-chirurgie-plastique-reconstructrice-et-esthetique-lhopital")],
  },
  toulouse: {
    heading: "La médecine esthétique à Toulouse",
    stats: stats("Haute-Garonne (31)", "119", "7,83", "33"),
    paragraphs: [
      "La Haute-Garonne compte 119 dermatologues en activité, soit 7,83 pour 100 000 habitants (5,35 en France), et 33 chirurgiens plasticiens exercent à Toulouse selon l'annuaire RPPS. Le CHU de Toulouse dispose d'un service de chirurgie plastique, reconstructrice et esthétique à l'hôpital Rangueil.",
      "Toulouse est une métropole jeune et en croissance, avec beaucoup de cadres et d'étudiants. La demande en médecine esthétique non chirurgicale (injections, laser, peau) y est forte, et les patientes choisissent souvent sur la base d'une première réponse rapide et rassurante.",
      "Une clinique toulousaine qui répond à toute heure aux questions sur les soins, les tarifs indicatifs et le déroulé de la consultation, puis propose un créneau, convertit davantage de ces demandes avant qu'elles ne partent chez un concurrent.",
    ],
    faq: {
      q: "Combien de dermatologues en Haute-Garonne ?",
      a: "119 dermatologues en activité au 1er janvier 2026, soit 7,83 pour 100 000 habitants contre 5,35 en moyenne nationale (DREES).",
    },
    sources: [DREES, RPPS, chu("CHU de Toulouse, chirurgie plastique, reconstructrice et esthétique", "https://www.chu-toulouse.fr/-chirurgie-plastique-reconstructrice-et-esthetique-")],
  },
  nice: {
    heading: "La médecine esthétique à Nice",
    stats: stats("Alpes-Maritimes (06)", "119", "10,31", "47"),
    paragraphs: [
      "Les Alpes-Maritimes ont la plus forte densité de dermatologues des quinze départements de cette page hors Paris : 10,31 pour 100 000 habitants, presque le double de la moyenne nationale (5,35). 47 chirurgiens plasticiens exercent à Nice selon l'annuaire RPPS.",
      "Le service de chirurgie réparatrice et esthétique du CHU de Nice (hôpital Pasteur 2) prend en charge la chirurgie comme la médecine esthétique. Le marché niçois est donc dense, avec une clientèle locale, des résidents étrangers et une forte saisonnalité.",
      "Les demandes arrivent en français, en anglais ou en italien, à toute heure. Une clinique niçoise qui répond immédiatement dans la langue de la patiente, avec des informations claires, se distingue nettement dans un marché aussi concurrentiel.",
    ],
    faq: {
      q: "La Côte d'Azur compte-t-elle beaucoup de dermatologues ?",
      a: "Oui : 10,31 dermatologues pour 100 000 habitants dans les Alpes-Maritimes, contre 5,35 en France (DREES 2026), et 47 chirurgiens plasticiens exercent à Nice même selon l'annuaire RPPS de septembre 2026.",
    },
    sources: [DREES, RPPS, chu("CHU de Nice, chirurgie réparatrice et esthétique", "https://institut-universitaire-locomoteur.chu-nice.fr/nos-specialites-en-chirurgie-orthopedique-et-reparatrice/chirurgie-reparatrice-esthetique-main/le-service/")],
  },
  nantes: {
    heading: "La médecine esthétique à Nantes",
    stats: stats("Loire-Atlantique (44)", "79", "5,19", "23"),
    paragraphs: [
      "La Loire-Atlantique compte 79 dermatologues en activité, soit 5,19 pour 100 000 habitants, légèrement sous la moyenne nationale (5,35). 23 chirurgiens plasticiens exercent à Nantes selon l'annuaire RPPS, et le CHU de Nantes dispose d'un service de chirurgie plastique, reconstructrice et esthétique.",
      "Une densité de dermatologues inférieure à la moyenne, c'est des délais de rendez-vous plus longs et des patientes qui se tournent vers les cliniques de médecine esthétique pour les soins de la peau et du visage.",
      "Pour une clinique nantaise, ces demandes arrivent nombreuses et sous forme de questions : quel soin, quel praticien, quel délai, quel prix. Une assistante qui y répond sur-le-champ et oriente vers une consultation évite de les perdre faute de temps pour répondre.",
    ],
    faq: {
      q: "Est-il difficile de consulter un dermatologue à Nantes ?",
      a: "La Loire-Atlantique compte 5,19 dermatologues pour 100 000 habitants, un peu sous la moyenne nationale de 5,35 (DREES 2026), ce qui se traduit souvent par des délais de rendez-vous plus longs.",
    },
    sources: [DREES, RPPS, chu("CHU de Nantes, chirurgie plastique, reconstructrice et esthétique", "https://www.chu-nantes.fr/chirurgie-plastique-reconstructrice-et-esthetique-1")],
  },
  montpellier: {
    heading: "La médecine esthétique à Montpellier",
    stats: stats("Hérault (34)", "114", "9,01", "26"),
    paragraphs: [
      "L'Hérault compte 114 dermatologues en activité, soit 9,01 pour 100 000 habitants (5,35 en France), et 26 chirurgiens plasticiens exercent à Montpellier selon l'annuaire RPPS. Le CHU de Montpellier dispose d'un service de chirurgie plastique, reconstructrice et esthétique à l'hôpital Lapeyronie.",
      "Ville universitaire et médicale, Montpellier attire une population jeune et active, très présente sur les réseaux sociaux, où se jouent la découverte des cliniques et la comparaison des résultats.",
      "La différence se fait ensuite sur la réponse : une patiente qui écrit le soir et reçoit tout de suite des informations claires et une proposition de consultation réserve ; celle qui attend le lendemain a souvent déjà écrit à une autre clinique.",
    ],
    faq: {
      q: "Combien de chirurgiens plasticiens à Montpellier ?",
      a: "26 chirurgiens plasticiens exercent dans la commune selon l'annuaire RPPS de septembre 2026, et l'Hérault compte 9,01 dermatologues pour 100 000 habitants contre 5,35 en France (DREES 2026).",
    },
    sources: [DREES, RPPS, chu("CHU de Montpellier, chirurgie plastique (hôpital Lapeyronie)", "https://etablissements.fhf.fr/annuaire/service/structure795-service51654")],
  },
  strasbourg: {
    heading: "La médecine esthétique à Strasbourg",
    stats: stats("Bas-Rhin (67)", "81", "6,90", "21"),
    paragraphs: [
      "Le Bas-Rhin compte 81 dermatologues en activité, soit 6,90 pour 100 000 habitants (5,35 en France), et 21 chirurgiens plasticiens exercent à Strasbourg selon l'annuaire RPPS. Les Hôpitaux universitaires de Strasbourg disposent d'un service de chirurgie plastique, reconstructrice et esthétique à Hautepierre.",
      "Comme le rappellent les HUS, la chirurgie reconstructrice est prise en charge par l'Assurance maladie, mais la chirurgie et la médecine esthétiques restent entièrement à la charge de la patiente. Les questions de prix et de déroulé arrivent donc très tôt dans l'échange.",
      "À Strasbourg, une partie de la clientèle est internationale ou frontalière et écrit en allemand ou en anglais. Une clinique qui répond à toute heure, dans la bonne langue et avec des réponses claires sur le parcours et les tarifs, convertit plus de demandes.",
    ],
    faq: {
      q: "La chirurgie esthétique est-elle remboursée à Strasbourg ?",
      a: "Non : comme partout en France, la chirurgie esthétique est entièrement à la charge du patient, seule la chirurgie reconstructrice étant prise en charge par l'Assurance maladie, comme le précisent les Hôpitaux universitaires de Strasbourg.",
    },
    sources: [DREES, RPPS, chu("Hôpitaux universitaires de Strasbourg, chirurgie plastique", "https://www.chru-strasbourg.fr/service/chirurgie-plastique-reconstructrice-et-esthetique/")],
  },
  bordeaux: {
    heading: "La médecine esthétique à Bordeaux",
    stats: stats("Gironde (33)", "141", "8,12", "46"),
    paragraphs: [
      "La Gironde compte 141 dermatologues en activité, soit 8,12 pour 100 000 habitants (5,35 en France), et 46 chirurgiens plasticiens exercent à Bordeaux selon l'annuaire RPPS. Le CHU de Bordeaux dispose d'un service de chirurgie plastique, reconstructrice et esthétique à l'hôpital Pellegrin, avec des unités dédiées à la chirurgie du sein et à la chirurgie dermatologique.",
      "Bordeaux est l'une des villes où l'offre libérale en chirurgie plastique est la plus dense rapportée à sa population. Les patientes y comparent beaucoup : praticiens, techniques, avant-après et rapidité de réponse.",
      "Dans ce contexte, une clinique bordelaise gagne à rendre son premier échange irréprochable : répondre immédiatement, présenter le praticien et sa qualification, expliquer la consultation préalable, puis proposer un créneau.",
    ],
    faq: {
      q: "Combien de chirurgiens plasticiens exercent à Bordeaux ?",
      a: "46 chirurgiens plasticiens exercent dans la commune selon l'annuaire RPPS de septembre 2026, auxquels s'ajoute le service de chirurgie plastique du CHU de Bordeaux à l'hôpital Pellegrin.",
    },
    sources: [DREES, RPPS, chu("CHU de Bordeaux, chirurgie plastique (hôpital Pellegrin)", "https://www.chu-bordeaux.fr/Les-services/Service-de-Chirurgie-plastique,-reconstructrice-et-esth%C3%A9tique-Br%C3%BBl%C3%A9s-Chirurgie-de-la-main/")],
  },
  lille: {
    heading: "La médecine esthétique à Lille",
    stats: stats("Nord (59)", "124", "4,74", "20"),
    paragraphs: [
      "Le Nord compte 124 dermatologues en activité, soit 4,74 pour 100 000 habitants : l'un des deux seuls départements de cette page sous la moyenne nationale (5,35), avec la Loire. 20 chirurgiens plasticiens exercent à Lille selon l'annuaire RPPS, et le CHU de Lille dispose d'un service de chirurgie plastique et reconstructrice à l'hôpital Roger Salengro.",
      "Moins de dermatologues, c'est des délais plus longs pour les soins de la peau et du visage, et une demande qui se reporte vers les cliniques de médecine esthétique de la métropole.",
      "Ces patientes posent beaucoup de questions avant de se décider. Une clinique lilloise qui y répond à toute heure, clairement, puis propose une consultation, capte une demande que les cabinets saturés ne peuvent pas absorber.",
    ],
    faq: {
      q: "Y a-t-il assez de dermatologues dans le Nord ?",
      a: "Le Nord compte 4,74 dermatologues pour 100 000 habitants, sous la moyenne nationale de 5,35 (DREES 2026), ce qui allonge souvent les délais de rendez-vous.",
    },
    sources: [DREES, RPPS, chu("CHU de Lille, chirurgie plastique et reconstructrice", "https://www.chu-lille.fr/services/chirurgie-plastique-et-reconstructive/")],
  },
  rennes: {
    heading: "La médecine esthétique à Rennes",
    stats: stats("Ille-et-Vilaine (35)", "65", "5,66", "14"),
    paragraphs: [
      "L'Ille-et-Vilaine compte 65 dermatologues en activité, soit 5,66 pour 100 000 habitants, proche de la moyenne nationale (5,35). 14 chirurgiens plasticiens exercent à Rennes selon l'annuaire RPPS, et le CHU de Rennes dispose d'un service de chirurgie plastique et reconstructrice à l'hôpital Sud.",
      "Au niveau national, le nombre de chirurgiens plasticiens est passé de 808 en 2012 à 1 163 en 2026 selon la DREES, mais cette croissance profite d'abord aux grandes métropoles. L'offre libérale rennaise reste resserrée, et les patientes qui cherchent un soin esthétique prennent le temps de s'informer, souvent en ligne et en dehors des heures de bureau.",
      "Une clinique rennaise qui leur répond au moment où elles écrivent, avec des informations précises sur les soins et la consultation, devient naturellement celle qu'elles choisissent dans un marché où l'offre est limitée.",
    ],
    faq: {
      q: "Combien de dermatologues en Ille-et-Vilaine ?",
      a: "65 dermatologues en activité au 1er janvier 2026, soit 5,66 pour 100 000 habitants contre 5,35 en France (DREES).",
    },
    sources: [DREES, RPPS, chu("CHU de Rennes, chirurgie plastique (hôpital Sud)", "https://etablissements.fhf.fr/annuaire/service/structure806-service33569")],
  },
  reims: {
    heading: "La médecine esthétique à Reims",
    stats: stats("Marne (51)", "35", "6,28", "8"),
    paragraphs: [
      "La Marne compte 35 dermatologues en activité, soit 6,28 pour 100 000 habitants (5,35 en France), et 8 chirurgiens plasticiens exercent à Reims selon l'annuaire RPPS. Le CHU de Reims dispose d'une unité de chirurgie plastique, reconstructrice et esthétique à l'hôpital Maison Blanche.",
      "L'offre libérale y est réduite : une poignée de praticiens pour toute une agglomération et ses environs. Depuis le 1er juillet 2024, seuls les médecins peuvent se procurer l'acide hyaluronique injectable (décret n° 2024-490), ce qui pousse les patientes vers des cabinets identifiés et qualifiés. Les patientes viennent parfois de loin et veulent tout savoir avant de se déplacer.",
      "Pour une clinique rémoise, répondre immédiatement à ces questions — soins proposés, praticien, déroulé, délais — et proposer un rendez-vous, c'est capter une patientèle qui n'a pas beaucoup d'alternatives sur place.",
    ],
    faq: {
      q: "Y a-t-il des chirurgiens esthétiques à Reims ?",
      a: "8 chirurgiens plasticiens exercent dans la commune selon l'annuaire RPPS de septembre 2026, et le CHU de Reims dispose d'une unité de chirurgie plastique, reconstructrice et esthétique à l'hôpital Maison Blanche.",
    },
    sources: [DREES, RPPS, DECRET, chu("CHU de Reims, chirurgie plastique (Maison Blanche)", "https://www.chu-reims.fr/offre-de-soins/prises-en-charge/service/unite-chirurgie-plastique-reconstructrice-reparatrice/consultation-et-hospitalisation")],
  },
  "saint-etienne": {
    heading: "La médecine esthétique à Saint-Étienne",
    stats: stats("Loire (42)", "32", "4,12", "7", "dans la Loire, RPPS 2026"),
    paragraphs: [
      "La Loire compte 32 dermatologues en activité, soit 4,12 pour 100 000 habitants : la plus faible densité des quinze départements de cette page, bien sous la moyenne nationale (5,35). L'annuaire RPPS recense 7 chirurgiens plasticiens dans le département.",
      "Le service de chirurgie maxillo-faciale et plastique du CHU de Saint-Étienne réalise plus de 12 000 consultations et 2 000 interventions par an, chirurgie esthétique du visage comprise. Mais l'offre libérale reste rare, et les délais pour un dermatologue sont longs.",
      "Dans un tel marché, une clinique de médecine esthétique stéphanoise est sollicitée bien au-delà de ce qu'elle peut traiter au téléphone. Une assistante qui répond, informe et qualifie chaque demande permet de servir plus de patientes sans saturer l'équipe.",
    ],
    faq: {
      q: "Pourquoi est-il difficile de voir un dermatologue à Saint-Étienne ?",
      a: "La Loire compte 4,12 dermatologues pour 100 000 habitants, la plus faible densité des quinze grandes villes étudiées, contre 5,35 en France (DREES 2026).",
    },
    sources: [DREES, RPPS, chu("CHU de Saint-Étienne, chirurgie maxillo-faciale et plastique", "https://www.chu-st-etienne.fr/Offre_De_Soins/Chirurgie_Stomatologie/Presentation")],
  },
  toulon: {
    heading: "La médecine esthétique à Toulon",
    stats: stats("Var (83)", "66", "5,75", "9"),
    paragraphs: [
      "Le Var compte 66 dermatologues en activité, soit 5,75 pour 100 000 habitants (5,35 en France), et 9 chirurgiens plasticiens exercent à Toulon selon l'annuaire RPPS. Il n'y a pas de CHU : l'hôpital Sainte-Musse (CHITS) dispose d'une unité de chirurgie plastique et reconstructrice.",
      "Le Var reste proche de la moyenne nationale en dermatologues, mais l'offre en chirurgie plastique se concentre à Toulon même, à Marseille et à Nice. La clientèle toulonnaise mêle actifs, retraités et vacanciers en été. Les demandes de soins esthétiques non chirurgicaux augmentent avant la saison, et beaucoup arrivent en dehors des heures d'ouverture.",
      "Une clinique toulonnaise qui répond immédiatement, explique le soin et la consultation préalable, puis propose un créneau, capte ces demandes saisonnières avant qu'elles ne partent vers Marseille ou Nice.",
    ],
    faq: {
      q: "Où trouver un chirurgien plasticien à Toulon ?",
      a: "9 chirurgiens plasticiens exercent dans la commune selon l'annuaire RPPS de septembre 2026 ; à l'hôpital, l'unité de chirurgie plastique et reconstructrice se trouve à Sainte-Musse (CHITS), Toulon n'ayant pas de CHU.",
    },
    sources: [DREES, RPPS, chu("CHITS Sainte-Musse, chirurgie plastique et reconstructrice", "https://etablissements.fhf.fr/annuaire/service/structure2284-establishment2219-service44455")],
  },
  grenoble: {
    heading: "La médecine esthétique à Grenoble",
    stats: stats("Isère (38)", "61", "4,63", "7"),
    paragraphs: [
      "L'Isère compte 61 dermatologues en activité, soit 4,63 pour 100 000 habitants, sous la moyenne nationale (5,35). 7 chirurgiens plasticiens exercent à Grenoble même selon l'annuaire RPPS, et le CHU Grenoble Alpes dispose d'un service de chirurgie plastique, reconstructrice et esthétique sur son site Nord à La Tronche.",
      "Avec peu de dermatologues et une offre libérale réduite en ville, les délais sont longs et une partie de la demande en soins de la peau et du visage se reporte vers les cliniques de médecine esthétique.",
      "La clientèle grenobloise, habituée aux services en ligne, attend une réponse rapide et précise. Une clinique qui répond à toute heure et propose directement une consultation transforme cette demande en rendez-vous plutôt qu'en liste d'attente.",
    ],
    faq: {
      q: "Combien de dermatologues en Isère ?",
      a: "61 dermatologues en activité au 1er janvier 2026, soit 4,63 pour 100 000 habitants contre 5,35 en France (DREES).",
    },
    sources: [DREES, RPPS, chu("CHU Grenoble Alpes, chirurgie plastique (site Nord)", "https://www.chu-grenoble.fr/patients-et-accompagnants/offre-de-soin/pr-jean-philippe-giot")],
  },
};
