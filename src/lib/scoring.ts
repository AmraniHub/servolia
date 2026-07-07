export interface Scoreable {
  niche?: string | null;
  phone?: string | null;
  website?: string | null;
  stage?: string | null;
  source?: string | null;
  value_estimate?: number | null;
}

export function computeLeadScore(lead: Scoreable): number {
  let score = 0;

  const nicheScores: Record<string, number> = {
    dental: 25, aesthetic: 25, "med-spa": 25, ivf: 25,
    "law-firm": 22, "wealth-management": 22, "real-estate": 20,
    veterinary: 15, "home-services": 12, restaurant: 8,
  };
  score += nicheScores[lead.niche ?? ""] ?? 5;

  if (lead.phone) score += 15;
  if (lead.website) score += 10;

  const stageScores: Record<string, number> = {
    new: 0, audit_sent: 10, qualified: 18, deposit_paid: 25, live: 25, lost: 0,
  };
  score += stageScores[lead.stage ?? "new"] ?? 0;

  const sourceScores: Record<string, number> = {
    referral: 15, "direct-purchase": 15, chatbot: 10, "free-audit": 8,
    contact: 8, "cold-email": 5, organic: 5, intake: 5,
  };
  score += sourceScores[lead.source ?? ""] ?? 3;

  const val = Number(lead.value_estimate ?? 0);
  if (val >= 2000) score += 10;
  else if (val >= 1000) score += 5;

  return Math.min(100, score);
}

export function scoreColors(score: number) {
  if (score >= 80) return { bg: "bg-[#EEF5EA]", text: "text-[#36671E]", border: "border-[#36671E]/30", bar: "bg-[#36671E]" };
  if (score >= 60) return { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200", bar: "bg-blue-500" };
  if (score >= 40) return { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200", bar: "bg-amber-400" };
  return { bg: "bg-[#F5F4EF]", text: "text-[#71717A]", border: "border-[#E8E6E0]", bar: "bg-[#A1A1AA]" };
}

export function scoreLabel(score: number): string {
  if (score >= 80) return "Hot";
  if (score >= 60) return "Warm";
  if (score >= 40) return "Cool";
  return "Cold";
}
