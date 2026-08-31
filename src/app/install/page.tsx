import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Link from "next/link";
import InstallApp from "@/components/InstallApp";
import { Bell, WifiOff, Smartphone, Lock } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Install the Servolia app — client portal on your phone",
  description:
    "Add your Servolia client portal to your home screen. Every patient enquiry, one tap away — no app store, nothing to download.",
  alternates: { canonical: "https://servolia.com/install", languages: { fr: "https://servolia.com/fr/application" } },
};

const WHY = [
  { icon: Smartphone, title: "One tap, no browser", body: "Your enquiries open straight from your home screen, full screen, with no address bar in the way." },
  { icon: Bell, title: "Where you already look", body: "The icon sits next to your other apps, so checking for a new enquiry is a glance rather than a task." },
  { icon: WifiOff, title: "Honest when offline", body: "No signal shows a clear message instead of a browser error. Nothing is cached, so you never read a stale number." },
  { icon: Lock, title: "Same login, same security", body: "It is your existing portal in an app window — same magic-link sign-in, nothing new to remember." },
];

export default function InstallPage() {
  return (
    <main className="flex flex-col bg-white">
      <Navbar />

      <section className="bg-[#FAFAF7] pt-28 pb-14">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-sm font-bold text-[#36671E] uppercase tracking-widest mb-3">Client portal</p>
          <h1 className="text-4xl font-black text-[#18181B] mb-3">Put Servolia on your phone</h1>
          <p className="text-[#52525B] text-lg max-w-xl">
            Your client portal, as an app icon. It installs from this page in a couple of seconds — there is no app
            store, no download, and nothing to update.
          </p>

          <div className="mt-8">
            <InstallApp lang="en" />
          </div>

          <p className="text-xs text-[#A1A1AA] mt-4">
            Not a client yet? Start with the{" "}
            <Link href="/free-audit" className="underline font-semibold text-[#52525B]">
              free audit
            </Link>
            .
          </p>
        </div>
      </section>

      <section className="py-14 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid sm:grid-cols-2 gap-5">
            {WHY.map((w) => {
              const Icon = w.icon;
              return (
                <div key={w.title} className="rounded-xl border border-[#E8E6E0] p-5">
                  <Icon className="w-4 h-4 text-[#36671E] mb-2" />
                  <p className="text-sm font-black text-[#18181B] mb-1">{w.title}</p>
                  <p className="text-sm text-[#71717A] leading-relaxed">{w.body}</p>
                </div>
              );
            })}
          </div>

          <div className="mt-10 rounded-xl bg-[#FAFAF7] border border-[#E8E6E0] p-5">
            <p className="text-sm font-black text-[#18181B] mb-2">Is this a real app?</p>
            <p className="text-sm text-[#71717A] leading-relaxed">
              It is your portal, installed. Browsers can add a website to your home screen so it opens like an app —
              same login, same data, no separate download and no store review. Remove it the way you remove any
              app; nothing is left behind on your phone.
            </p>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
