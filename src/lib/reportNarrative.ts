import Anthropic from "@anthropic-ai/sdk";

/**
 * The few sentences at the top of her monthly report, written by Claude from
 * the month's real numbers and the questions her visitors actually asked.
 *
 * Until 2026-09-23 this lived in a second monthly email (/api/cron/client-
 * reports, on the 5th) that repeated the 1st's numbers with different labels.
 * One email now carries both: the numbers, then this. Best-effort — no key,
 * a failed call or unparseable output returns null and the report goes out
 * without it.
 */

const MODEL = "claude-haiku-4-5-20251001";

export interface ReportNarrative {
  narrative: string;
  /** One concrete suggestion. A suggestion, never "we will": nothing schedules it. */
  idea: string;
}

export async function writeReportNarrative(input: {
  businessName: string;
  niche: string;
  language: "en" | "fr";
  conversations: number;
  receptionistBookings: number;
  questions: string[];
}): Promise<ReportNarrative | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || input.conversations === 0) return null;
  const lang = input.language === "fr" ? "French" : "English";
  try {
    const client = new Anthropic({ apiKey });
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 400,
      messages: [{
        role: "user",
        content: `You write the monthly report for ${input.businessName} (${input.niche} business). Write in ${lang}.

Last month their AI receptionist had ${input.conversations} conversations, of which ${input.receptionistBookings} became booking requests (the visitor asked for an appointment and left contact details).
Sample visitor questions: ${input.questions.slice(0, 6).join(" | ") || "none recorded"}

Return ONLY JSON: {"narrative":"2-3 warm, factual sentences summarizing the month for the business owner — plain language, no hype, no numbers other than the two above","idea":"ONE concrete suggestion for next month based on the questions (e.g. add a price to a service, answer a frequent question on the site), one sentence, phrased as a suggestion to the owner"}`,
      }],
    });
    const text = res.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("");
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) return null;
    const parsed = JSON.parse(m[0]) as { narrative?: string; idea?: string };
    if (!parsed.narrative) return null;
    return { narrative: parsed.narrative.slice(0, 600), idea: (parsed.idea ?? "").slice(0, 300) };
  } catch {
    return null;
  }
}

/** The visitors' own questions, from the receptionist's conversations. */
export function visitorQuestions(rows: { messages?: { role: string; content: string }[] | null }[]): string[] {
  return rows
    .flatMap((c) => (c.messages ?? []).filter((m) => m.role === "user").map((m) => String(m.content ?? "")))
    .filter((q) => q.length > 8 && q.length < 160);
}
