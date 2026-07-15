import { NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/auth";
import { listCaseStudies } from "@/lib/caseStudies";
import { toCsv, csvResponse } from "@/lib/csv";

/** CSV export of all case studies — proof-of-results asset. */
export async function GET() {
  if (!(await isAdminAuthed())) return new NextResponse("Unauthorized", { status: 401 });

  const studies = await listCaseStudies();
  const headers = ["slug", "business", "niche", "city", "published", "headline", "summary", "plan", "metrics", "quote", "quoteAuthor"];
  const rows = studies.map((s) => ({
    slug: s.slug, business: s.business, niche: s.niche ?? "", city: s.city ?? "",
    published: s.published ? "yes" : "no", headline: s.headline, summary: s.summary ?? "",
    plan: s.plan ?? "", metrics: JSON.stringify(s.metrics), quote: s.quote ?? "", quoteAuthor: s.quoteAuthor ?? "",
  }));
  const csv = toCsv(headers, rows);
  return csvResponse("case-studies", csv);
}
