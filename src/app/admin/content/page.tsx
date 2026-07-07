import { supabaseAdmin } from "@/lib/supabase";
import ContentManager, { type BlogDraftRow, type LinkedInDraftRow } from "@/components/admin/ContentManager";

export const dynamic = "force-dynamic";

export default async function AdminContentPage() {
  const db = supabaseAdmin();

  let blogDrafts: BlogDraftRow[] = [];
  let linkedinDrafts: LinkedInDraftRow[] = [];

  if (db) {
    try {
      const { data } = await db
        .from("blog_posts")
        .select("id, title, excerpt, category, status, keyword_cluster, created_at")
        .eq("status", "draft")
        .order("created_at", { ascending: false });
      blogDrafts = (data as BlogDraftRow[] | null) ?? [];
    } catch { /* table not migrated yet */ }

    try {
      const { data } = await db
        .from("linkedin_drafts")
        .select("id, topic, body, status, created_at")
        .eq("status", "draft")
        .order("created_at", { ascending: false });
      linkedinDrafts = (data as LinkedInDraftRow[] | null) ?? [];
    } catch { /* table not migrated yet */ }
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 lg:py-8 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-black text-[#18181B]">Content Engine</h1>
        <p className="text-sm text-[#71717A] mt-1">
          AI-generated blog posts + LinkedIn content, approved here or via Telegram — nothing publishes automatically.
        </p>
      </div>

      {!db && (
        <div className="mb-6 p-4 rounded-xl bg-[#FEF3C7] border border-[#D97706]/30 text-[#92400E] text-sm">
          <strong>Supabase not connected.</strong> Connect it and run <code className="px-1 rounded bg-[#FDE68A]">supabase/schema.sql</code> to enable the content engine.
        </div>
      )}

      <ContentManager blogDrafts={blogDrafts} linkedinDrafts={linkedinDrafts} />
    </div>
  );
}
