import { supabaseAdmin, type Build } from "@/lib/supabase";
import { listClientSites, type ClientSiteConfig } from "@/lib/clientSites";
import ClientSitesManager, { type SiteRow, type GeneratableBuild } from "@/components/admin/ClientSitesManager";

export const dynamic = "force-dynamic";

interface ClientSiteDbRow {
  slug: string;
  business: string;
  niche?: string | null;
  status: string;
  build_id?: string | null;
  config: ClientSiteConfig;
}

export default async function AdminSitesPage() {
  const db = supabaseAdmin();

  let siteRows: SiteRow[] = [];
  const siteBuildIds = new Set<string>();

  if (db) {
    try {
      const { data } = await db
        .from("client_sites")
        .select("slug, business, niche, status, build_id, config")
        .order("created_at", { ascending: false });
      const rows = (data as ClientSiteDbRow[] | null) ?? [];
      siteRows = rows.map((r) => {
        if (r.build_id) siteBuildIds.add(r.build_id);
        return {
          slug: r.slug,
          businessName: r.business,
          niche: r.niche ?? r.config?.niche ?? "—",
          status: r.status,
          serviceCount: r.config?.services?.length ?? 0,
        };
      });
    } catch {
      // client_sites table not created yet — show bundled demo so the page still works
      const demos = await listClientSites();
      siteRows = demos.map((c) => ({
        slug: c.slug,
        businessName: c.businessName,
        niche: c.niche,
        status: c.status ?? "published",
        serviceCount: c.services.length,
      }));
    }
  } else {
    const demos = await listClientSites();
    siteRows = demos.map((c) => ({
      slug: c.slug,
      businessName: c.businessName,
      niche: c.niche,
      status: c.status ?? "published",
      serviceCount: c.services.length,
    }));
  }

  // Builds that could become sites (not already generated)
  let builds: GeneratableBuild[] = [];
  if (db) {
    const { data } = await db
      .from("builds")
      .select("id, business, plan_name, intake_data, status")
      .order("created_at", { ascending: false })
      .limit(40);
    const rows = (data as (Build & { intake_data?: unknown })[] | null) ?? [];
    builds = rows
      .filter((b) => !siteBuildIds.has(b.id))
      .map((b) => ({
        id: b.id,
        business: b.business,
        plan_name: b.plan_name ?? b.plan ?? "Build",
        hasIntake: !!b.intake_data,
      }));
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 lg:py-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-black text-[#18181B]">Client Sites</h1>
        <p className="text-sm text-[#71717A] mt-1">
          The delivery engine — turn a paid build into a live client site + trained AI receptionist.
        </p>
      </div>

      {!db && (
        <div className="mb-6 p-4 rounded-xl bg-[#FEF3C7] border border-[#D97706]/30 text-[#92400E] text-sm">
          <strong>Supabase not connected.</strong> Showing the bundled demo. Connect Supabase and run{" "}
          <code className="px-1 rounded bg-[#FDE68A]">supabase/schema.sql</code> to generate and store real client sites.
        </div>
      )}

      <ClientSitesManager sites={siteRows} builds={builds} />
    </div>
  );
}
