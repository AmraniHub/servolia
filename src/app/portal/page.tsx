import { redirect } from "next/navigation";
import { getClientEmail } from "@/lib/clientAuth";
import { supabaseAdmin, type Build } from "@/lib/supabase";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import PortalDashboard from "@/components/PortalDashboard";

export const dynamic = "force-dynamic";

export default async function PortalPage() {
  const email = await getClientEmail();
  if (!email) redirect("/portal/login");

  const db = supabaseAdmin();
  let builds: Build[] = [];
  if (db) {
    const { data } = await db
      .from("builds")
      .select("*")
      .eq("email", email)
      .order("created_at", { ascending: false });
    builds = (data as Build[]) ?? [];
  }

  return (
    <main className="min-h-screen bg-[#FAFAF7]">
      <Navbar />
      <PortalDashboard email={email} builds={builds} />
      <Footer />
    </main>
  );
}
