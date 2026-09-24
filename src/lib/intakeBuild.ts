import { after } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { generateSiteForBuild } from "@/lib/generateSite";
import { notifyDraftReady, type NotifyOutcome } from "@/lib/draftPreview";
import { sendTelegramMessage, telegramConfigured } from "@/lib/telegram";

/**
 * The client's intake answers land on the build they paid for, and the draft
 * site is generated from them -- then the client is emailed their preview.
 *
 * Two doors reach this, and both must: the intake form (src/app/api/contact,
 * the usual order) and the Stripe webhook (src/app/api/webhooks/stripe) for
 * the rarer order where the client finished the form BEFORE Stripe's event
 * arrived. Without the second door those answers sat only on a lead row, the
 * build waited in "intake" forever, and the "draft within minutes" email was
 * a promise nothing kept.
 *
 * Returns false when the build was not waiting for an intake, or could not
 * be updated (nothing is scheduled either way).
 * The generation runs AFTER the response (next/server after()), so the caller
 * never waits on the 10-50s copywriting call; generateSiteForBuild returns
 * null rather than throwing, and the try/catch is belt-and-braces.
 *
 * THEN THE CLIENT IS TOLD. The moment the draft exists they get the signed
 * preview link by email (src/lib/draftPreview.ts) -- the same function the
 * admin's Regenerate button calls, once per site. The silent Telegram
 * follow-up says whether that email went, in words that name the next action
 * when it did not.
 */
export async function startBuildFromIntake(a: {
  buildId: string;
  leadId?: string | null;
  intake: Record<string, unknown>;
  business?: string | null;
}): Promise<boolean> {
  const db = supabaseAdmin();
  if (!db) return false;
  /* ONLY A BUILD STILL WAITING FOR ITS INTAKE. The flip from "intake" to
     "building" is the claim: one caller wins it, so the form and the webhook
     arriving together start ONE draft, and an intake sent again later -- the
     receipt's button carries the session id, and the contact route is public
     -- can never pull a published site back to draft (generateSiteForBuild
     writes status "draft") or rewrite its copy. Redoing a draft is the
     admin's Regenerate button. (Review of 2db729c, 2026-09-24.) */
  const { data: claimed, error: updateErr } = await db.from("builds").update({
    intake_data: a.intake,
    business: a.business || undefined,
    status: "building",
    started_at: new Date().toISOString(),
  }).eq("id", a.buildId).eq("status", "intake").select("id");
  if (updateErr || !claimed?.length) return false;

  if (a.leadId) {
    await db.from("lead_activities").insert({
      lead_id: a.leadId,
      type: "note",
      description: "✅ Intake form completed — build started",
    });
  }

  const buildId = a.buildId;
  after(async () => {
    let draftSite: Awaited<ReturnType<typeof generateSiteForBuild>> = null;
    try {
      draftSite = await generateSiteForBuild(buildId);
    } catch {
      draftSite = null;
    }
    let notified: NotifyOutcome | null = null;
    if (draftSite) {
      notified = await notifyDraftReady({
        buildId, slug: draftSite.slug, config: draftSite.config, ai: draftSite.ai,
      }).catch(() => ({ sent: false, reason: "send-failed" }) as NotifyOutcome);
    }
    if (telegramConfigured()) {
      /* PLAIN, not Markdown. The client's address is in this message,
         and one underscore in it (marie_dubois@…) opens an italic run
         Telegram cannot close: a 400, swallowed, and the ONE message
         that says "the client was not emailed" is the one that dies.
         src/lib/telegram.ts documents exactly this trap. */
      const text = draftSite
        ? `Draft site ready\nhttps://servolia.com/sites/${draftSite.slug}\n` +
          (notified?.sent
            ? `Client emailed their preview link: ${notified.to}${notified.recorded ? "" : " (NOT recorded - a retry may send it again)"}\n`
            : `CLIENT NOT EMAILED - ${notified?.reason ?? "unknown"}${notified?.detail ? ` (${notified.detail})` : ""}. Press Regenerate on the build page to send it.\n`) +
          `Admin: https://servolia.com/admin/sites`
        : `DRAFT GENERATION FAILED for the new intake - generate it from the build page: https://servolia.com/admin/builds/${buildId}`;
      await sendTelegramMessage(text, undefined, { silent: true, plain: true }); // follow-up to the intake alert — no second buzz
    }
  });
  return true;
}
