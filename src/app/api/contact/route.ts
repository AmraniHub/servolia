import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, email, business, industry, plan, website, problem, type } = body;

    const msg =
      `🔔 *New ${type === "free-audit" ? "Free Audit" : "Contact"} — servolia.com*\n\n` +
      `*Name:* ${name || body.businessName || "—"}\n` +
      `*Email:* ${email}\n` +
      `*Business:* ${business || body.businessName || "—"}\n` +
      `*Industry:* ${industry || body.niche || "—"}\n` +
      `*Country:* ${body.country || "—"}\n` +
      `*Client value:* ${body.clientValue || "—"}\n` +
      `*Plan interest:* ${plan || "—"}\n` +
      `*Website:* ${website || body.websiteUrl || "none"}\n` +
      `*Problems:* ${Array.isArray(body.problems) ? body.problems.join(", ") : (problem || "—")}\n` +
      `*Language:* ${body.language || "—"}`;

    const tgToken = process.env.TELEGRAM_BOT_TOKEN;
    const tgChatId = process.env.TELEGRAM_CHAT_ID;
    if (tgToken && tgChatId) {
      await fetch(`https://api.telegram.org/bot${tgToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: tgChatId, text: msg, parse_mode: "Markdown" }),
      }).catch(() => {});
    }

    const sheetsUrl = process.env.GOOGLE_SHEETS_WEBHOOK_URL;
    if (sheetsUrl) {
      await fetch(sheetsUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, timestamp: new Date().toISOString(), source: "servolia.com" }),
      }).catch(() => {});
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
