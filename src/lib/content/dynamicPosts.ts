/**
 * Merges the hand-written static posts (posts.ts) with AI-generated posts
 * stored in Supabase (blog_posts, status = 'published'). New AI posts show up
 * immediately — no rebuild needed, since these routes render dynamically.
 */

import { supabaseAdmin } from "@/lib/supabase";
import { POSTS as STATIC_POSTS, type Post } from "@/lib/content/posts";

interface BlogPostRow {
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  reading_minutes: number;
  meta_title: string;
  meta_description: string;
  cta_headline: string | null;
  cover_image_url: string | null;
  body: Post["body"];
  published_at: string | null;
  created_at: string;
}

function rowToPost(r: BlogPostRow): Post {
  return {
    slug: r.slug,
    title: r.title,
    excerpt: r.excerpt,
    category: r.category,
    readingMinutes: r.reading_minutes ?? 6,
    publishedAt: (r.published_at ?? r.created_at).slice(0, 10),
    metaTitle: r.meta_title,
    metaDescription: r.meta_description,
    ctaHeadline: r.cta_headline ?? "Ready to get started?",
    body: r.body,
    related: [],
    coverImageUrl: r.cover_image_url ?? undefined,
  };
}

async function fetchPublished(): Promise<Post[]> {
  const db = supabaseAdmin();
  if (!db) return [];
  try {
    const { data } = await db
      .from("blog_posts")
      .select("slug, title, excerpt, category, reading_minutes, meta_title, meta_description, cta_headline, cover_image_url, body, published_at, created_at")
      .eq("status", "published")
      .order("published_at", { ascending: false });
    return ((data as BlogPostRow[] | null) ?? []).map(rowToPost);
  } catch {
    return []; // table not migrated yet — static posts still work
  }
}

/** All posts (static + AI-generated), newest first. */
export async function getAllPosts(): Promise<Post[]> {
  const dynamic = await fetchPublished();
  return [...STATIC_POSTS, ...dynamic].sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );
}

/** A single post by slug — checks static first (fast), then Supabase. */
export async function getAnyPost(slug: string): Promise<Post | undefined> {
  const fromStatic = STATIC_POSTS.find((p) => p.slug === slug);
  if (fromStatic) return fromStatic;

  const db = supabaseAdmin();
  if (!db) return undefined;
  try {
    const { data } = await db
      .from("blog_posts")
      .select("slug, title, excerpt, category, reading_minutes, meta_title, meta_description, cta_headline, cover_image_url, body, published_at, created_at")
      .eq("slug", slug)
      .eq("status", "published")
      .maybeSingle();
    return data ? rowToPost(data as BlogPostRow) : undefined;
  } catch {
    return undefined;
  }
}

/** All slugs (static + published dynamic) — used by the sitemap. */
export async function getAllPostSlugs(): Promise<string[]> {
  const all = await getAllPosts();
  return all.map((p) => p.slug);
}
