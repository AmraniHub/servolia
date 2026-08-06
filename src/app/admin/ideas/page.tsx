import IdeasBoard from "@/components/admin/IdeasBoard";
import { Lightbulb } from "lucide-react";

export const dynamic = "force-dynamic";

/**
 * Ideas & roadmap — the founder's board.
 *
 * roadmap.ts stays the code-side record (what shipped, what's blocked, why).
 * This is the part the founder drives: move a card to "In progress", copy the
 * brief, paste it to Claude. That copy step exists because Claude works in the
 * repo and cannot read Supabase — without it, moving a card would change
 * nothing about how work actually reaches me.
 */
export default function IdeasPage() {
  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 lg:py-8 max-w-[1400px] mx-auto">
      <div className="flex items-center gap-2 mb-1">
        <Lightbulb className="w-5 h-5 text-[#36671E]" />
        <h1 className="text-2xl font-black text-[#18181B]">Ideas &amp; roadmap</h1>
      </div>
      <p className="text-sm text-[#71717A] mb-6 max-w-3xl leading-relaxed">
        Everything discussed but not yet built lives here — nothing gets lost in a conversation.
        Move a card to <strong>In progress</strong>, hit <strong>Copy brief for Claude</strong>, and paste it
        into a message. That&apos;s the whole handover.
      </p>
      <IdeasBoard />
    </div>
  );
}
