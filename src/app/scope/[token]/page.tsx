import { notFound } from "next/navigation";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import ScopeAcceptForm from "@/components/ScopeAcceptForm";
import CheckoutButton from "@/components/CheckoutButton";
import { supabaseAdmin } from "@/lib/supabase";
import { BUILD_PLANS } from "@/lib/pricing";
import { CheckCircle } from "lucide-react";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Your Scope Document — Servolia", robots: { index: false, follow: false } };

export default async function ScopeAcceptancePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const db = supabaseAdmin();
  if (!db) notFound();

  const { data: scope } = await db.from("scope_acceptances").select("*").eq("token", token).maybeSingle();
  if (!scope) notFound();

  const plan = BUILD_PLANS[scope.plan_key as keyof typeof BUILD_PLANS];
  const planLabel = plan ? `${plan.name} — €${plan.totalEur.toLocaleString()}` : scope.plan_key;

  return (
    <>
      <Navbar />
      <main className="pt-28 pb-20 lg:pt-36 bg-[#FAFAF7] min-h-screen">
        <div className="max-w-2xl mx-auto px-4 sm:px-6">
          <p className="text-sm font-bold text-[#36671E] uppercase tracking-widest mb-2 text-center">Project Scope</p>
          <h1 className="text-2xl sm:text-3xl font-black text-[#18181B] text-center mb-8">{scope.business_name}</h1>

          <div className="bg-white border border-[#E8E6E0] rounded-2xl p-5 sm:p-6 mb-6">
            <pre className="whitespace-pre-wrap font-sans text-sm text-[#374151] leading-relaxed">{scope.scope_text}</pre>
          </div>

          {scope.accepted_at ? (
            <div className="bg-white border border-[#E8E6E0] rounded-2xl p-6 text-center">
              <CheckCircle className="w-10 h-10 text-[#36671E] mx-auto mb-3" />
              <h2 className="text-lg font-black text-[#18181B] mb-1">Already accepted</h2>
              <p className="text-sm text-[#71717A] mb-5">
                Accepted by {scope.accepted_name} on {new Date(scope.accepted_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}.
              </p>
              <CheckoutButton
                plan={scope.plan_key}
                leadId={scope.lead_id ?? undefined}
                label={`Pay deposit — ${planLabel}`}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-[#36671E] to-[#295115] text-white font-black hover:opacity-90 transition-opacity disabled:opacity-60"
              />
            </div>
          ) : (
            <ScopeAcceptForm token={token} planKey={scope.plan_key} leadId={scope.lead_id} planLabel={planLabel} />
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
