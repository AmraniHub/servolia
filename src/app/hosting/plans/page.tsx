import { redirect } from "next/navigation";

/**
 * Folded into /hosting. The chooser used to live here while /hosting showed a
 * single plan to everyone, so the two URLs disagreed about what hosting cost.
 * Kept as a redirect so any link already sent keeps working.
 */
export default async function PlansRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) qs.set(k, v);
  const q = qs.toString();
  redirect(q ? `/hosting?${q}` : "/hosting");
}
