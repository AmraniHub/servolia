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
  }

  return <PortalDashboard email={email} builds={builds} subscription={subscription} />;
}
