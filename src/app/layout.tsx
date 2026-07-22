import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import CookieBanner from "@/components/CookieBanner";
import Analytics from "@/components/Analytics";
import PageTracker from "@/components/PageTracker";
import ScrollToTop from "@/components/ScrollToTop";
import { OrgSchema, WebSiteSchema } from "@/components/StructuredData";

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
  verification: process.env.GOOGLE_SITE_VERIFICATION
    ? { google: process.env.GOOGLE_SITE_VERIFICATION }
    : undefined,
  other: {
    "facebook-domain-verification": "y91x60qk6fueqiuz3ncnb295oepldu",
  },
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
        <OrgSchema />
        <WebSiteSchema />
      </head>
      <body className="min-h-full flex flex-col">
        {children}
        <CookieBanner />
        <ScrollToTop />
        <Analytics />
        <PageTracker />
      </body>
    </html>
  );
}
