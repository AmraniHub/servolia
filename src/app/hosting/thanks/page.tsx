import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";

export const metadata: Metadata = {
  title: "Thank you",
  robots: { index: false, follow: false },
};

/**
 * Shared by every client-services payment: hosting, the AI assistant, and a
 * one-off arrears charge.
 *
 * IT USED TO SAY ONE THING TO ALL THREE — "Your hosting is active… your site
 * keeps running exactly as it is." Someone who had just paid $12 to switch
 * their AI assistant back on was told about their hosting, and someone
 * clearing an old balance was told the same. That is the confirmation for a
 * different purchase, arriving at the exact moment a buyer is deciding whether
 * the payment worked — which is when they email to ask.
 *
 * `product` is display only. It picks wording and nothing else; it never
 * decides an amount, so a hand-edited URL can mislabel a page and do no harm.
 */
interface Copy {
  title: string;
  body: string;
  /** Used instead, when this payment brought a suspended service back. */
  restoredTitle?: string;
  restoredBody?: string;
}

const COPY: Record<string, Copy> = {
  hosting: {
    title: "Your hosting is active",
    body:
      "Your site keeps running exactly as it is — same address, same forms, nothing to switch over.",
    restoredTitle: "Your site is back online",
    restoredBody:
      "Hosting is active again and your site is being served as normal. That happens automatically, so there is nothing for you to do.",
  },
  chatbot: {
    title: "Your assistant is live",
    body:
      "It is now answering customers on your site, day and night, in their own language. Nothing to install.",
    restoredTitle: "Your assistant is back on",
    restoredBody:
      "It has been switched back on and is answering customers on your site again. That happens automatically, so there is nothing for you to do.",
  },
  arrears: {
    title: "That's settled",
    body:
      "Your balance is clear and nothing is outstanding. This was a one-off charge — it will not repeat.",
  },
};

const FALLBACK: Copy = {
  title: "You're all set",
  body: "Your payment went through and your service is active. Nothing else to do.",
};

export default async function HostingThanks({
  searchParams,
}: {
  searchParams: Promise<{ product?: string; restored?: string }>;
}) {
  const { product = "", restored = "" } = await searchParams;

  /* A first purchase and a reinstatement need different words, and the
     difference is within a product rather than between two. Telling a
     first-time buyer their assistant is "back on" invents a suspension that
     never happened; telling a reinstated client it is "now live" ignores the
     week it was off. Falls back to the plain wording when a product has no
     restored variant. */
  const entry = COPY[product];
  const isRestore = restored === "1";
  const copy: Copy = entry
    ? {
        title: (isRestore && entry.restoredTitle) || entry.title,
        body: (isRestore && entry.restoredBody) || entry.body,
      }
    : FALLBACK;

  return (
    <main className="min-h-screen bg-[#FAFAF7] flex flex-col">
      <header className="px-5 py-6 border-b border-[#E8E6E0] bg-white">
        <div className="max-w-md mx-auto">
          <Link href="/" className="inline-flex items-center">
            <span className="text-xl font-black tracking-tight text-[#18181B]">
              Serv<span className="gradient-text">olia</span>
            </span>
          </Link>
        </div>
      </header>

      <div className="flex-1 px-5 py-20">
        <div className="max-w-md mx-auto text-center">
          <CheckCircle2 className="w-14 h-14 text-[#16A34A] mx-auto mb-5" />
          <h1 className="text-2xl font-black text-[#18181B] mb-3">{copy.title}</h1>
          <p className="text-[#52525B] leading-relaxed mb-6">{copy.body}</p>

          {/* This promise is now kept by our own webhook rather than by a
              Stripe dashboard toggle nobody can see — see
              clientServicePaidEmail in src/lib/email.ts. */}
          <p className="text-sm text-[#71717A] leading-relaxed mb-8">
            A confirmation is on its way to your inbox, with what you paid and
            when it renews. Stripe sends a separate receipt for your records.
          </p>

          <Link
            href="/"
            className="inline-flex items-center justify-center h-11 px-6 rounded-xl bg-[#18181B] text-white font-bold hover:bg-[#27272A]"
          >
            Back to Servolia
          </Link>
        </div>
      </div>

      <footer className="px-5 py-8 border-t border-[#E8E6E0] bg-white">
        <div className="max-w-md mx-auto text-center">
          <p className="text-xs text-[#8A8A80]">
            Billed by <span className="font-bold text-[#52525B]">Servolia</span> · Payments processed by Stripe
          </p>
        </div>
      </footer>
    </main>
  );
}
