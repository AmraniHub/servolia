import { supabaseAdmin } from "@/lib/supabase";

/**
 * Case studies — real client results, shown at the top of /case-studies.
 * Starts empty (honest) and fills as clients produce numbers. Each real one
 * replaces an illustrative scenario as proof.
 */

export interface CaseMetric {
  label: string;
  value: string;
}

export interface CaseStudy {
  id: string;
  slug: string;
  published: boolean;
  featured: boolean;
  sort: number;
  business: string;
  niche?: string | null;
  city?: string | null;
  logoUrl?: string | null;
  accent: string;
  headline: string;
  summary?: string | null;
  challenge?: string | null;
  solution?: string | null;
  metrics: CaseMetric[];
  quote?: string | null;
  quoteAuthor?: string | null;
  plan?: string | null;
}

interface Row {
  id: string; slug: string; published: boolean; featured: boolean; sort: number;
  business: string; niche: string | null; city: string | null; logo_url: string | null;
  accent: string | null; headline: string; summary: string | null;
  challenge: string | null; solution: string | null; metrics: CaseMetric[] | null;
  quote: string | null; quote_author: string | null; plan: string | null;
}

function fromRow(r: Row): CaseStudy {
  return {
    id: r.id, slug: r.slug, published: r.published, featured: r.featured, sort: r.sort ?? 0,
    business: r.business, niche: r.niche, city: r.city, logoUrl: r.logo_url,
    accent: r.accent || "#36671E", headline: r.headline, summary: r.summary,
    challenge: r.challenge, solution: r.solution,
    metrics: Array.isArray(r.metrics) ? r.metrics : [],
    quote: r.quote, quoteAuthor: r.quote_author, plan: r.plan,
  };
}

/** Published case studies for the public page (empty until the first real client). */
export async function getPublishedCaseStudies(): Promise<CaseStudy[]> {
  const db = supabaseAdmin();
  if (!db) return [];
  try {
    const { data } = await db
      .from("case_studies")
      .select("*")
      .eq("published", true)
      .order("sort", { ascending: true })
      .order("created_at", { ascending: false });
    return ((data as Row[] | null) ?? []).map(fromRow);
  } catch {
    return [];
  }
}

/** All case studies (admin). */
export async function listCaseStudies(): Promise<CaseStudy[]> {
  const db = supabaseAdmin();
  if (!db) return [];
  try {
    const { data } = await db
      .from("case_studies")
      .select("*")
      .order("sort", { ascending: true })
      .order("created_at", { ascending: false });
    return ((data as Row[] | null) ?? []).map(fromRow);
  } catch {
    return [];
  }
}
