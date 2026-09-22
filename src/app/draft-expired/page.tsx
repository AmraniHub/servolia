import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Lien expiré · Link expired — Servolia",
  robots: { index: false, follow: false },
};

/**
 * Where a draft-preview link lands when its token no longer verifies —
 * expired after 90 days, minted before a secret rotation, or not ours.
 *
 * The person arriving here paid for a site and clicked the link we emailed
 * them. A homepage full of pricing tiers at that moment says "we lost you";
 * a 404 says "we are broken". This says what happened and the one thing
 * that fixes it, in both languages, because an invalid token carries no
 * language to choose by. "Reply to the email" is a promise a person keeps.
 */
export default function DraftExpiredPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-[#F7F6F2] text-[#18181B] px-6">
      <div className="max-w-md w-full">
        <section className="mb-10">
          <p className="text-xs font-black tracking-widest uppercase text-[#71717A] mb-3">Votre brouillon</p>
          <h1 className="text-2xl font-black mb-3">Ce lien n'est plus valable</h1>
          <p className="text-sm leading-relaxed text-[#3F3F46]">
            Le lien vers votre brouillon a expiré ou a été remplacé. Votre site est toujours là — répondez simplement à
            l'email que nous vous avons envoyé, ou écrivez-nous à{" "}
            <a href="mailto:hello@servolia.com" className="font-bold underline">hello@servolia.com</a>, et nous vous
            renvoyons un lien neuf dans la journée.
          </p>
        </section>
        <section>
          <p className="text-xs font-black tracking-widest uppercase text-[#71717A] mb-3">Your draft</p>
          <h2 className="text-2xl font-black mb-3">This link is no longer valid</h2>
          <p className="text-sm leading-relaxed text-[#3F3F46]">
            The link to your draft has expired or been replaced. Your site is still here — just reply to the email we
            sent you, or write to{" "}
            <a href="mailto:hello@servolia.com" className="font-bold underline">hello@servolia.com</a>, and we will send
            you a fresh link the same day.
          </p>
        </section>
      </div>
    </main>
  );
}
