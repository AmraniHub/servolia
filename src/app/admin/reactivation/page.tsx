import { listClientSites } from "@/lib/clientSites";
import ReactivationManager from "@/components/admin/ReactivationManager";

export const dynamic = "force-dynamic";

export default async function ReactivationPage() {
  const sites = (await listClientSites()).map((s) => ({
    slug: s.slug,
    businessName: s.businessName,
    language: s.language,
    googleReviewUrl: s.googleReviewUrl ?? null,
  }));

  return <ReactivationManager sites={sites} />;
}
