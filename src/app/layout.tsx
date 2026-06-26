import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import WhatsAppButton from "@/components/WhatsAppButton";
import CookieBanner from "@/components/CookieBanner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Servolia — AI Lead Systems for Service Businesses",
  description:
    "Servolia builds AI-powered websites, booking systems, chatbots, and lead funnels for service businesses in Europe and the US. Fixed price. 7-day delivery. Real results.",
  keywords: [
    "AI website",
    "AI receptionist",
    "lead generation",
    "booking system",
    "dental clinic website",
    "service business automation",
    "France Belgium Switzerland",
    "site web professionnel",
  ],
  openGraph: {
    title: "Servolia — AI Lead Systems for Service Businesses",
    description:
      "We build AI websites, chatbots, and lead systems for clinics, dentists, real estate, and home services. Fixed price. 7-day delivery.",
    type: "website",
    locale: "en_US",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased scroll-smooth`}>
      <body className="min-h-full flex flex-col">
        {children}
        <WhatsAppButton />
        <CookieBanner />
      </body>
    </html>
  );
}
