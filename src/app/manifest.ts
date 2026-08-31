import type { MetadataRoute } from "next";

/**
 * Web app manifest — what makes Servolia installable.
 *
 * start_url is the CLIENT PORTAL, not the marketing home page. Someone who
 * installs this is a client checking whether a patient enquiry came in, not a
 * visitor reading the pricing page. Opening the app on marketing copy they
 * already bought from would be a small insult every time.
 *
 * Chrome's install prompt needs all of: HTTPS, name, short_name, start_url,
 * display standalone, background_color, theme_color, a 512px icon, AND a
 * registered service worker with a fetch handler (see public/sw.js). Miss any
 * one and beforeinstallprompt simply never fires, with no error to explain it.
 *
 * Both plain and maskable icons are listed. Android crops icons to a circle
 * and keeps only the middle ~80%, so the maskable pair is inset; without them
 * the mark loses its corners on most Android launchers.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Servolia — Espace client",
    short_name: "Servolia",
    description:
      "Vos demandes patients, vos rendez-vous et vos rapports — en un seul endroit, sur votre téléphone.",
    start_url: "/portal",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#FAFAF7",
    theme_color: "#36671E",
    categories: ["business", "productivity"],
    lang: "fr",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      {
        name: "Mes demandes",
        short_name: "Demandes",
        description: "Voir les demandes reçues",
        url: "/portal",
      },
    ],
  };
}
