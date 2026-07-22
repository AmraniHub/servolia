import type { Metadata } from "next";
import { supabaseAdmin } from "@/lib/supabase";
import { verifyUnsubscribeToken } from "@/lib/unsubscribe";
import { CheckCircle2, AlertCircle } from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Unsubscribe — Servolia",
  robots: { index: false, follow: false },
};

export default async function UnsubscribePage({
  searchParams,
}: { searchParams: Promise<{ e?: string; t?: string }> }) {
  const { e, t } = await searchParams;
  const email = (e ?? "").trim().toLowerCase();
  const ok = !!email && !!t && verifyUnsubscribeToken(email, t);

  if (ok) {
    const db = supabaseAdmin();
    if (db) {
      try {
        await db.from("email_subscribers")
          .update({ status: "unsubscribed", unsubscribed_at: new Date().toISOString() })
          .eq("email", email);
      } catch { /* table may not exist — still show confirmation */ }
    }
  }

  return (
    <main className="min-h-screen bg-[#FAFAF7] flex items-center justify-center px-4 py-24">
      <div className="max-w-md text-center">
        <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6 ${ok ? "bg-[#EEF5EA]" : "bg-[#FEF3C7]"}`}>
          {ok ? <CheckCircle2 className="w-8 h-8 text-[#36671E]" /> : <AlertCircle className="w-8 h-8 text-[#92400E]" />}
        </div>
        {ok ? (
          <>
            <h1 className="text-2xl font-black text-[#18181B] mb-3">You&apos;re unsubscribed</h1>
            <p className="text-[#52525B] leading-relaxed">
              We won&apos;t email <strong className="text-[#18181B]">{email}</strong> again.
              If this was a mistake, just reply to any earlier email and we&apos;ll add you back.
            </p>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-black text-[#18181B] mb-3">That link isn&apos;t valid</h1>
            <p className="text-[#52525B] leading-relaxed">
              The unsubscribe link looks incomplete or altered. Email{" "}
              <a href="mailto:hello@servolia.com" className="text-[#36671E] font-semibold hover:underline">hello@servolia.com</a>{" "}
              and we&apos;ll remove you straight away.
            </p>
          </>
        )}
      </div>
    </main>
  );
}
