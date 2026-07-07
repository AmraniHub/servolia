/**
 * Shared publish/reject logic for AI-generated content — called from both the
 * Telegram webhook (button taps) and the CRM's browser UI, so there's one
 * source of truth for what "publish" actually does.
 */

import { supabaseAdmin } from "@/lib/supabase";

const BASE = "https://servolia.com";

export async function publishBlogPost(id: string): Promise<{ ok: boolean; message: string }> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, message: "Supabase not configured" };

  const { data: post } = await db.from("blog_posts").select("slug, title").eq("id", id).maybeSingle();
  if (!post) return { ok: false, message: "Post not found" };

  await db.from("blog_posts").update({ status: "published", published_at: new Date().toISOString() }).eq("id", id);
  return { ok: true, message: `Published: ${post.title} → ${BASE}/blog/${post.slug}` };
}

export async function rejectBlogPost(id: string): Promise<{ ok: boolean; message: string }> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, message: "Supabase not configured" };
  await db.from("blog_posts").update({ status: "rejected" }).eq("id", id);
  return { ok: true, message: "Post rejected" };
}

export async function postLinkedInDraft(id: string): Promise<{ ok: boolean; message: string }> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, message: "Supabase not configured" };

  const { data: draft } = await db.from("linkedin_drafts").select("body, topic").eq("id", id).maybeSingle();
  if (!draft) return { ok: false, message: "Draft not found" };

  await db.from("linkedin_drafts").update({ status: "posted", posted_at: new Date().toISOString() }).eq("id", id);

  const accessToken = process.env.LINKEDIN_ACCESS_TOKEN;
  const organizationUrn = process.env.LINKEDIN_ORGANIZATION_URN; // e.g. "urn:li:organization:12345678"
  if (!accessToken || !organizationUrn) {
    return { ok: true, message: "Approved — LinkedIn API not connected, copy the text and post manually." };
  }

  try {
    const res = await fetch("https://api.linkedin.com/v2/ugcPosts", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "X-Restli-Protocol-Version": "2.0.0",
      },
      body: JSON.stringify({
        author: organizationUrn, // posts as the Servolia Company Page, not a personal profile
        lifecycleState: "PUBLISHED",
        specificContent: {
          "com.linkedin.ugc.ShareContent": { shareCommentary: { text: draft.body }, shareMediaCategory: "NONE" },
        },
        visibility: { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" },
      }),
    });
    if (!res.ok) throw new Error(await res.text());
    return { ok: true, message: "Posted to LinkedIn" };
  } catch (err) {
    return { ok: true, message: `Approved, but LinkedIn API call failed — post manually. (${String(err).slice(0, 120)})` };
  }
}

export async function rejectLinkedInDraft(id: string): Promise<{ ok: boolean; message: string }> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, message: "Supabase not configured" };
  await db.from("linkedin_drafts").update({ status: "rejected" }).eq("id", id);
  return { ok: true, message: "Draft rejected" };
}
