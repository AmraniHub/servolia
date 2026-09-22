import { notFound } from "next/navigation";
import type { Metadata } from "next";
import ClientSite from "@/components/ClientSite";
import ClientAnalytics from "@/components/ClientAnalytics";
import { getClientSite } from "@/lib/clientSites";
import { draftAccess, DraftPreviewRibbon } from "@/lib/draftGate";
import { supabaseAdmin } from "@/lib/supabase";
import { paymentAlertFrom } from "@/lib/clientBilling";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const c = await getClientSite(slug);
  if (!c) return { title: "Site not found" };
  return {
    title: `${c.businessName}${c.city ? ` · ${c.city}` : ""}`,
    description: c.heroSub || c.about,
    // Client sites are hosted here on a platform subpath — the real site lives on
    // the client's own domain, so we don't want servolia.com/sites/* indexed.
    robots: { index: false, follow: false },
    openGraph: {
      title: c.businessName,
      description: c.heroSub || c.about,
      type: "website",
    },
  };
}

export default async function ClientSitePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ preview?: string }>;
}) {
  const { slug } = await params;
  const { preview } = await searchParams;
  const config = await getClientSite(slug);
  if (!config) notFound();
  // A config that exists only for the assistant add-on has no site to render:
  // the client's real site is on their own domain and we never built one.
  // Rendering a template from a brief would put a fake Excellence Agency
  // homepage on servolia.com, indexed or not.
  if (config.assistantOnly) notFound();
  // Unpublished drafts are private — to an admin, or to the client it was
  // built for through their signed preview link (query string or cookie).
  const access = await draftAccess(config, preview);
  if (access === "hidden") notFound();

  // Suspended for non-payment: the site goes offline until the invoice clears.
  // Vercel-style — banner in the portal comes first (14-day grace), this shutoff
  // is only reached after the grace deadline has passed.
  const db = supabaseAdmin();
  if (db) {
    const { data: site } = await db.from("client_sites").select("build_id").eq("slug", slug).maybeSingle();
    const buildId = (site as { build_id?: string } | null)?.build_id ?? null;
    let client: { payment_status?: string; suspend_at?: string | null; suspended_at?: string | null; last_payment_failure_reason?: string | null; open_invoice_url?: string | null } | null = null;
    if (buildId) {
      const { data } = await db.from("clients")
        .select("payment_status, suspend_at, suspended_at, last_payment_failure_reason, open_invoice_url")
        .eq("build_id", buildId).order("created_at", { ascending: false }).limit(1).maybeSingle();
      client = data as typeof client;
    }
    const alert = paymentAlertFrom(client as never);
    if (alert?.level === "suspended") {
      const fr = config.language === "fr";
      return (
        <main className="min-h-screen flex items-center justify-center bg-[#0B0B0F] text-white px-6">
          <div className="max-w-md text-center">
            <p className="text-xs font-black tracking-widest uppercase text-red-400 mb-3">
              {fr ? "Site temporairement indisponible" : "Site temporarily unavailable"}
            </p>
            <h1 className="text-2xl sm:text-3xl font-black mb-3">{config.businessName}</h1>
            <p className="text-sm text-white/70 leading-relaxed">
              {fr
                ? "Ce site est momentanément hors ligne. Le propriétaire a été informé — il sera rétabli dès que possible."
                : "This site is temporarily offline. The owner has been notified — it will be back up as soon as possible."}
            </p>
          </div>
        </main>
      );
    }
  }

  const viewer = access === "client" ? "client" : access === "admin" ? "admin" : null;
  return (
    <>
      {viewer && <DraftPreviewRibbon lang={config.language === "fr" ? "fr" : "en"} viewer={viewer} />}
      <ClientSite config={config} />
      {/* A draft being reviewed is not traffic. The client's own GA4 and pixel
          ids come from the intake, and firing them here would write our
          servolia.com/sites/* preview views into their property before launch. */}
      {!viewer && <ClientAnalytics ga4Id={config.ga4Id} metaPixelId={config.metaPixelId} />}
    </>
  );
}
