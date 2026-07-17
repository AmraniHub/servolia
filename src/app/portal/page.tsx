import { redirect } from "next/navigation";
import { getClientEmail } from "@/lib/clientAuth";
import { supabaseAdmin, type Build, type Client } from "@/lib/supabase";
import PortalDashboard from "@/components/PortalDashboard";

export const dynamic = "force-dynamic";

export default async function PortalPage() {
  const email = await getClientEmail();
  if (!email) redirect("/portal/login");

  const db = supabaseAdmin();
  let builds: Build[] = [];
  let subscription: Client | null = null;
  let siteSlugs: Record<string, string> = {}; // build_id -> slug

  if (db) {
    const { data } = await db
      .from("builds")
      .select("*")
      .eq("email", email)
      .order("created_at", { ascending: false });
    builds = (data as Build[]) ?? [];

    const { data: client } = await db
      .from("clients")
      .select("*")
      .eq("email", email)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    subscription = (client as Client) ?? null;

    const buildIds = builds.map((b) => b.id);
    if (buildIds.length) {
      const { data: sites } = await db.from("client_sites").select("slug, build_id").in("build_id", buildIds);
      for (const s of (sites ?? []) as { slug: string; build_id: string }[]) siteSlugs[s.build_id] = s.slug;
    }
  }

  return <PortalDashboard email={email} builds={builds} subscription={subscription} siteSlugs={siteSlugs} />;
}
