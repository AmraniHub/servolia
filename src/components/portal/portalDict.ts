/**
 * Portal i18n dictionary + date helpers, extracted from PortalDashboard.tsx
 * (which had grown past 1,300 lines). Pure data/functions — no React.
 */

export type Lang = "en" | "fr";

export const T = {
  en: {
    signOut: "Sign out", toggleTheme: "Toggle theme", toggleLang: "Switch to French",
    greeting: (n: string) => `Welcome back, ${n} 👋`,
    tabs: { overview: "Overview", leads: "My leads", traffic: "Visitors", reports: "Reports", messages: "Messages", account: "Account" },
    tf: {
      title: "Website visitors",
      subtitle: "Who is looking at your site, where they came from, and what they read.",
      visitors: "Visitors", views: "Pages viewed", visits: "Visits", enquiries: "Enquiries",
      perVisit: "pages per visit", bounced: "left after one page", ofVisitors: "of visitors enquired",
      funnel: "Your funnel", funnelNote: "Out of everyone who visited, this many got in touch.",
      perDay: "Visitors per day", topPages: "Most-read pages", sources: "Where they came from",
      countries: "Countries", devices: "Devices", direct: "Direct",
      empty: "No visits recorded yet.",
      emptyBody: "As soon as your site is live and someone opens it, their visit shows up here — usually within seconds.",
      loading: "Loading your visitors…",
      privacy: "Cookie-free and GDPR-friendly: we count visits without tracking anyone across the web.",
      last: (d: number) => `Last ${d} days`,
    },
    // subscription
    planSuffix: "plan", perMo: "/mo",
    subManageDesc: "Update payment method, download invoices, or change your plan.",
    billingTitle: "Billing & invoices", billingDesc: "Manage payment methods and download your invoices.",
    manageSub: "Manage subscription", opening: "Opening…",
    billingErr: "Could not open the billing portal.", connErr: "Connection error — please try again.",
    statusActive: "active", statusPaused: "paused",
    // payment dunning (Vercel-style)
    payTitle: "Payment failed",
    payPastDueBody: (d: number) =>
      d > 0
        ? `Pay any open invoices in the next ${d} day${d === 1 ? "" : "s"} — after that, your site and AI receptionist are suspended until payment clears.`
        : "Pay any open invoices before your account is shut down.",
    paySuspendedBody: "Your site and AI receptionist have been suspended for non-payment. Pay the open invoice to reactivate — it's usually restored within a minute.",
    payInvoicesBtn: "Pay open invoice",
    payManageBtn: "Manage billing",
    // stats
    stEnquiries: "Enquiries this month", stBookings: "Booking requests", stContacts: "Contacts captured",
    // lifetime value
    ltTitle: "Since you joined",
    ltSince: (d: string) => `Working for you since ${d}`,
    ltEnquiries: "enquiries captured",
    ltBookings: "booking requests",
    ltAfterHours: "came in outside opening hours",
    ltNote: "Every one of these reached you because your assistant was answering — including nights and weekends.",
    // build statuses
    stIntake: "Awaiting your intake", stBuilding: "In progress", stReview: "Ready for your review", stDelivered: "Delivered", stLive: "Live",
    paid: (a: string) => `€${a} paid`, dueOnDelivery: (a: string) => `€${a} due on delivery`,
    targetDelivery: (d: string) => `Target delivery: ${d}`, liveSince: (d: string) => `Live since ${d}`,
    needsScopeMsg: "Please review and confirm your project scope — what's included, the price, and the delivery deadline in writing.",
    confirmScope: "Confirm your scope",
    needsIntakeMsg: "One last step before we start building — tell us about your business, branding, and services. Takes about 8 minutes.",
    completeIntake: "Complete your intake form",
    viewLiveSite: "View my live site", previewSite: "Preview my site",
    // add-ons
    addonsTitle: "Add-ons", addonsDesc: "Extra managed modules. Enable the one-click ones instantly, or message us for the rest.",
    enable: "Enable", askUs: "Ask us", perYr: "yr", perMailbox: "mailbox", perMoShort: "mo",
    // leads
    yourLeads: "Your leads", yourLeadsSub: "— every enquiry your assistant handled", exportCsv: "Export", search: "Search…",
    leadStage: { new: "New", contacted: "Contacted", booked: "Booked", won: "Won", lost: "Lost" } as Record<string, string>,
    notePh: "Private note (only you see this)…", noteSave: "Save note", noteSaved: "Saved ✓",
    fAll: "All time", fMonth: "30 days", fWeek: "7 days",
    noLeads: "No enquiries captured yet — they'll appear here as they arrive.", noMatch: "No leads match your search.",
    booking: "Booking", enquiry: "Enquiry", fromAds: " · from your ads", conversation: "(conversation)",
    // reports
    monthlyReports: "Monthly reports", reportsSub: "— the same numbers we email you on the 1st",
    loading: "Loading…", noReports: "No reports yet — your first one lands after your first full month live.",
    emailed: (d: string) => `Emailed ${d}`,
    rEnq: "Enquiries", rBook: "Bookings", rAfter: "After-hours", rAds: "From ads", pipelineValue: "Estimated pipeline value:",
    // messages
    messageUs: "Message us", messageUsSub: "— we usually reply within a few hours", delete: "Delete",
    confirmDelete: "Delete this conversation? It'll disappear from your view — Servolia can still see and restore it if needed.",
    noMessages: "No messages yet — say hello 👋", imageReady: "Image ready — add a caption or just send.", typeMsg: "Type a message…",
    onlyImages: "Only JPEG, PNG, WEBP, or GIF images.", imgTooBig: "Image must be under 4MB.", uploadFailed: "Upload failed",
    // account
    // profile
    profileTitle: "Your profile", profileDesc: "How you appear to us, and how we reach you.",
    photo: "Profile photo", changePhoto: "Change photo", uploading: "Uploading…", photoHint: "JPEG, PNG, WEBP or GIF · max 4MB",
    displayName: "Your name", displayNamePh: "Dr. Marie Dupont",
    phoneLabel: "Phone", phonePh: "+33 6 12 34 56 78",
    marketingTitle: "Marketing emails", marketingDesc: "Get occasional tips and product news. We'll never share your address, and you can turn this off any time.",
    marketingOn: "You're subscribed", marketingOff: "You're not subscribed",
    saveProfile: "Save profile", savedProfile: "Profile saved ✅",
    yourAccount: "Your account", accountDesc: "This is your login and where we send your reports and receipts.",
    emailAddress: "Email address", changeEmailNote: "To change your email, message us from the Messages tab — we'll move your account over.",
    changePassword: "Change password", setPassword: "Set a password",
    changePwDesc: "Update the password you use to log in.", setPwDesc: "Optional — set a password so you can log in without the email link every time.",
    currentPw: "Current password", newPw: "New password", confirmPw: "Confirm new password", pwHint: "At least 8 characters",
    pwTooShort: "Password must be at least 8 characters.", pwMismatch: "Passwords don't match.",
    pwUpdated: "Password updated ✅", pwSet: "Password set ✅ — you can now log in with it.", pwSaveErr: "Could not save.",
    saving: "Saving…", updatePw: "Update password", setPwBtn: "Set password",
    resources: "Resources", resourcesDesc: "Quick answers before you message us.",
    resHow: "How the process works", resTerms: "Your delivery guarantee & terms", resPrivacy: "Privacy policy",
  },
  fr: {
    signOut: "Déconnexion", toggleTheme: "Changer le thème", toggleLang: "Passer en anglais",
    greeting: (n: string) => `Bon retour, ${n} 👋`,
    tabs: { overview: "Aperçu", leads: "Mes leads", traffic: "Visiteurs", reports: "Rapports", messages: "Messages", account: "Compte" },
    tf: {
      title: "Visiteurs du site",
      subtitle: "Qui consulte votre site, d'où ils viennent et ce qu'ils lisent.",
      visitors: "Visiteurs", views: "Pages vues", visits: "Visites", enquiries: "Demandes",
      perVisit: "pages par visite", bounced: "repartis après une page", ofVisitors: "des visiteurs vous ont contacté",
      funnel: "Votre tunnel", funnelNote: "Sur l'ensemble des visiteurs, voici combien vous ont contacté.",
      perDay: "Visiteurs par jour", topPages: "Pages les plus lues", sources: "D'où ils viennent",
      countries: "Pays", devices: "Appareils", direct: "Direct",
      empty: "Aucune visite enregistrée pour l'instant.",
      emptyBody: "Dès que votre site est en ligne et qu'une personne l'ouvre, sa visite apparaît ici — en quelques secondes.",
      loading: "Chargement de vos visiteurs…",
      privacy: "Sans cookie et conforme RGPD : nous comptons les visites sans suivre personne à travers le web.",
      last: (d: number) => `${d} derniers jours`,
    },
    planSuffix: "forfait", perMo: "/mois",
    subManageDesc: "Modifiez le moyen de paiement, téléchargez vos factures ou changez de forfait.",
    billingTitle: "Facturation & factures", billingDesc: "Gérez vos moyens de paiement et téléchargez vos factures.",
    manageSub: "Gérer l'abonnement", opening: "Ouverture…",
    billingErr: "Impossible d'ouvrir le portail de facturation.", connErr: "Erreur de connexion — réessayez.",
    statusActive: "actif", statusPaused: "en pause",
    payTitle: "Paiement échoué",
    payPastDueBody: (d: number) =>
      d > 0
        ? `Réglez les factures ouvertes dans les ${d} prochain${d === 1 ? "" : "s"} jour${d === 1 ? "" : "s"} — au-delà, votre site et votre assistant IA seront suspendus jusqu'au paiement.`
        : "Réglez les factures ouvertes avant la suspension de votre compte.",
    paySuspendedBody: "Votre site et votre assistant IA ont été suspendus pour impayé. Réglez la facture ouverte pour réactiver — la remise en service est immédiate.",
    payInvoicesBtn: "Payer la facture",
    payManageBtn: "Gérer la facturation",
    stEnquiries: "Demandes ce mois-ci", stBookings: "Demandes de RDV", stContacts: "Coordonnées captées",
    ltTitle: "Depuis votre arrivée",
    ltSince: (d: string) => `À votre service depuis le ${d}`,
    ltEnquiries: "demandes captées",
    ltBookings: "demandes de rendez-vous",
    ltAfterHours: "reçues en dehors des horaires d'ouverture",
    ltNote: "Chacune vous est parvenue parce que votre assistant répondait — y compris les soirs et les week-ends.",
    stIntake: "En attente de vos infos", stBuilding: "En cours", stReview: "Prêt pour votre relecture", stDelivered: "Livré", stLive: "En ligne",
    paid: (a: string) => `${a} € payés`, dueOnDelivery: (a: string) => `${a} € à la livraison`,
    targetDelivery: (d: string) => `Livraison prévue : ${d}`, liveSince: (d: string) => `En ligne depuis le ${d}`,
    needsScopeMsg: "Merci de relire et de confirmer le périmètre de votre projet — ce qui est inclus, le prix et le délai de livraison, par écrit.",
    confirmScope: "Confirmer le périmètre",
    needsIntakeMsg: "Une dernière étape avant de commencer — parlez-nous de votre activité, votre identité et vos services. Environ 8 minutes.",
    completeIntake: "Compléter le formulaire",
    viewLiveSite: "Voir mon site en ligne", previewSite: "Prévisualiser mon site",
    addonsTitle: "Modules", addonsDesc: "Modules gérés en plus. Activez les modules en un clic, ou écrivez-nous pour les autres.",
    enable: "Activer", askUs: "Nous demander", perYr: "an", perMailbox: "boîte", perMoShort: "mois",
    yourLeads: "Vos leads", yourLeadsSub: "— chaque demande traitée par votre assistant", exportCsv: "Exporter", search: "Rechercher…",
    leadStage: { new: "Nouveau", contacted: "Contacté", booked: "RDV fixé", won: "Gagné", lost: "Perdu" } as Record<string, string>,
    notePh: "Note privée (visible par vous seul)…", noteSave: "Enregistrer", noteSaved: "Enregistré ✓",
    fAll: "Tout", fMonth: "30 jours", fWeek: "7 jours",
    noLeads: "Aucune demande captée pour l'instant — elles apparaîtront ici dès leur arrivée.", noMatch: "Aucun lead ne correspond à votre recherche.",
    booking: "RDV", enquiry: "Demande", fromAds: " · via vos pubs", conversation: "(conversation)",
    monthlyReports: "Rapports mensuels", reportsSub: "— les mêmes chiffres que nous vous envoyons le 1er",
    loading: "Chargement…", noReports: "Pas encore de rapport — le premier arrive après votre premier mois complet en ligne.",
    emailed: (d: string) => `Envoyé le ${d}`,
    rEnq: "Demandes", rBook: "RDV", rAfter: "Hors horaires", rAds: "Via pubs", pipelineValue: "Valeur estimée du pipeline :",
    messageUs: "Écrivez-nous", messageUsSub: "— nous répondons généralement en quelques heures", delete: "Supprimer",
    confirmDelete: "Supprimer cette conversation ? Elle disparaîtra de votre vue — Servolia peut toujours la voir et la restaurer si besoin.",
    noMessages: "Aucun message — dites bonjour 👋", imageReady: "Image prête — ajoutez une légende ou envoyez.", typeMsg: "Écrivez un message…",
    onlyImages: "Uniquement des images JPEG, PNG, WEBP ou GIF.", imgTooBig: "L'image doit faire moins de 4 Mo.", uploadFailed: "Échec de l'envoi",
    profileTitle: "Votre profil", profileDesc: "Comment vous apparaissez et comment vous joindre.",
    photo: "Photo de profil", changePhoto: "Changer la photo", uploading: "Envoi…", photoHint: "JPEG, PNG, WEBP ou GIF · 4 Mo max",
    displayName: "Votre nom", displayNamePh: "Dr Marie Dupont",
    phoneLabel: "Téléphone", phonePh: "+33 6 12 34 56 78",
    marketingTitle: "Emails marketing", marketingDesc: "Recevez occasionnellement des conseils et des nouveautés. Nous ne partageons jamais votre adresse, et vous pouvez vous désinscrire à tout moment.",
    marketingOn: "Vous êtes inscrit", marketingOff: "Vous n'êtes pas inscrit",
    saveProfile: "Enregistrer le profil", savedProfile: "Profil enregistré ✅",
    yourAccount: "Votre compte", accountDesc: "C'est votre identifiant et l'adresse où nous envoyons vos rapports et reçus.",
    emailAddress: "Adresse email", changeEmailNote: "Pour changer d'email, écrivez-nous depuis l'onglet Messages — nous transférerons votre compte.",
    changePassword: "Changer le mot de passe", setPassword: "Définir un mot de passe",
    changePwDesc: "Mettez à jour le mot de passe que vous utilisez pour vous connecter.", setPwDesc: "Optionnel — définissez un mot de passe pour vous connecter sans le lien email à chaque fois.",
    currentPw: "Mot de passe actuel", newPw: "Nouveau mot de passe", confirmPw: "Confirmer le mot de passe", pwHint: "Au moins 8 caractères",
    pwTooShort: "Le mot de passe doit faire au moins 8 caractères.", pwMismatch: "Les mots de passe ne correspondent pas.",
    pwUpdated: "Mot de passe mis à jour ✅", pwSet: "Mot de passe défini ✅ — vous pouvez maintenant l'utiliser.", pwSaveErr: "Impossible d'enregistrer.",
    saving: "Enregistrement…", updatePw: "Mettre à jour", setPwBtn: "Définir le mot de passe",
    resources: "Ressources", resourcesDesc: "Des réponses rapides avant de nous écrire.",
    resHow: "Comment se déroule le processus", resTerms: "Votre garantie de livraison & CGV", resPrivacy: "Politique de confidentialité",
  },
};
export type Dict = typeof T["en"];

export const locale = (lang: Lang) => (lang === "fr" ? "fr-FR" : "en-GB");
export function formatDate(iso: string | null | undefined, lang: Lang) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(locale(lang), { day: "numeric", month: "short", year: "numeric" });
}
export function formatPeriod(period: string, lang: Lang) {
  const [y, m] = period.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString(locale(lang), { month: "long", year: "numeric" });
}
