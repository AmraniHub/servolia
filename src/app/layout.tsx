import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import SiteChrome from "@/components/SiteChrome";
import ServoliaHead from "@/components/ServoliaOnly";
import { editorMountPaths } from "@/lib/siteEditor";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL("https://servolia.com"),
  title: {
    default: "Servolia — AI Lead Systems for Service Businesses",
    template: "%s | Servolia",
  },
  description:
    "Servolia builds AI-powered websites, booking systems, chatbots, and lead funnels for service businesses in Europe and the US. Fixed price. 7-day delivery. Real results.",
  keywords: ["AI website", "AI receptionist", "lead generation", "booking system", "dental clinic website", "aesthetic clinic", "real estate", "home services", "France Belgium Switzerland US"],
  authors: [{ name: "Servolia" }],
  openGraph: {
    title: "Servolia — AI Lead Systems for Service Businesses",
    description: "Fixed-price AI websites, chatbots, and lead systems for service businesses. 7-day delivery, monthly support.",
    type: "website",
    locale: "en_US",
    url: "https://servolia.com",
    siteName: "Servolia",
  },
  twitter: {
    card: "summary_large_image",
    title: "Servolia — AI Lead Systems for Service Businesses",
    description: "Fixed-price AI websites and lead systems. 7-day delivery.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 },
  },
  /* No google-site-verification here (removed 2026-09-22): root metadata is
     merged into every page, a practice's own domain included, and the same
     token on every client domain would tie them all to Servolia. It was never
     set in production; verify Search Console by DNS TXT if it is ever needed. */
  // facebook-domain-verification lives in ServoliaHead: metadata here is
  // merged into every page, a practice's own site included (C2).
  alternates: {
    canonical: "https://servolia.com",
    languages: {
      "en-US": "https://servolia.com",
      "fr-FR": "https://servolia.com/fr",
      "x-default": "https://servolia.com",
    },
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased scroll-smooth`}>
      <head>
        {/* Not on a practice's generated site: at her own domain (C2) it
            would name Servolia in her page source. */}
        <ServoliaHead />
      </head>
      <body className="min-h-full flex flex-col">
        {children}
        {/* Not rendered on a page served at a client's own domain — see
            SiteChrome. A consent banner over the Save button of a tool the
            client was given a password for is the wrong furniture entirely. */}
        {/* Computed HERE, on the server: SiteChrome receives only the paths,
            never the client configs they come from. */}
        <SiteChrome editorPaths={editorMountPaths()} />
      </body>
    </html>
  );
}
