import { notFound } from "next/navigation";
import type { Metadata } from "next";
import DemoDashboard from "@/components/DemoDashboard";
import { getClientSite } from "@/lib/clientSites";

export const dynamic = "force-dynamic";

// A public, view-only preview of the client dashboard/CRM that ships with the
// system — shown to prospects on a demo site so they can see the whole product
// (site + AI receptionist + leads + reports), not just the marketing pages.
// Demo sites only.
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const c = await getClientSite(slug);
  if (!c || !c.isDemo) return { title: "Not found" };
  return {
    title: `${c.businessName} — ${c.language === "fr" ? "Tableau de bord" : "Dashboard"}`,
    robots: { index: false, follow: false },
  };
}

export default async function DemoDashboardPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const config = await getClientSite(slug);
  // The demo dashboard is only meaningful for prospect demo sites.
  if (!config || !config.isDemo) notFound();
  return <DemoDashboard config={config} />;
}
