import { isSupabaseConfigured } from "@/lib/supabase";
import { CheckCircle2, AlertCircle } from "lucide-react";

export const dynamic = "force-dynamic";

export default function SettingsPage() {
  const checks = [
    { name: "NEXT_PUBLIC_SUPABASE_URL",   ok: !!process.env.NEXT_PUBLIC_SUPABASE_URL,   desc: "Supabase project URL" },
    { name: "SUPABASE_SERVICE_ROLE_KEY",  ok: !!process.env.SUPABASE_SERVICE_ROLE_KEY,  desc: "Server-side DB key (secret)" },
    { name: "ANTHROPIC_API_KEY",          ok: !!process.env.ANTHROPIC_API_KEY,          desc: "Powers the Solia chatbot" },
    { name: "STRIPE_SECRET_KEY",          ok: !!process.env.STRIPE_SECRET_KEY,          desc: "For checkout + billing portal" },
    { name: "ADMIN_PASSWORD",             ok: !!process.env.ADMIN_PASSWORD,             desc: "This admin's password" },
    { name: "ADMIN_JWT_SECRET",           ok: !!process.env.ADMIN_JWT_SECRET,           desc: "Signs your admin session cookie (32+ chars)" },
    { name: "TELEGRAM_BOT_TOKEN",         ok: !!process.env.TELEGRAM_BOT_TOKEN,         desc: "Optional · instant lead alerts + content approval" },
    { name: "TELEGRAM_CHAT_ID",           ok: !!process.env.TELEGRAM_CHAT_ID,           desc: "Optional · your Telegram chat ID" },
    { name: "TELEGRAM_WEBHOOK_SECRET",    ok: !!process.env.TELEGRAM_WEBHOOK_SECRET,    desc: "Optional · verifies inbound button taps are really Telegram" },
    { name: "CRON_SECRET",                ok: !!process.env.CRON_SECRET,                desc: "Authenticates the content-engine GitHub Actions" },
    { name: "GOOGLE_SHEETS_WEBHOOK_URL",  ok: !!process.env.GOOGLE_SHEETS_WEBHOOK_URL,  desc: "Optional · backup to Google Sheets" },
    { name: "GOOGLE_SERVICE_ACCOUNT_KEY", ok: !!process.env.GOOGLE_SERVICE_ACCOUNT_KEY, desc: "Optional · powers Daily Stats + Weekly SEO (GA4 Data API)" },
    { name: "GA4_PROPERTY_ID",            ok: !!process.env.GA4_PROPERTY_ID,            desc: "Optional · numeric GA4 property id, pairs with the key above" },
    { name: "LINKEDIN_ACCESS_TOKEN",      ok: !!process.env.LINKEDIN_ACCESS_TOKEN,      desc: "Optional · auto-posts approved LinkedIn drafts" },
    { name: "LINKEDIN_ORGANIZATION_URN",  ok: !!process.env.LINKEDIN_ORGANIZATION_URN,  desc: "Optional · Servolia Company Page URN, pairs with the token above" },
    { name: "META_CAPI_ACCESS_TOKEN",     ok: !!process.env.META_CAPI_ACCESS_TOKEN,     desc: "Optional · server-side ad conversion tracking (Meta Conversions API)" },
  ];

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 lg:py-8 max-w-3xl mx-auto">
      <h1 className="text-2xl font-black text-[#18181B] mb-1">Settings</h1>
      <p className="text-sm text-[#71717A] mb-8">System health check</p>

      <div className="bg-white border border-[#E8E6E0] rounded-2xl overflow-hidden">
        {checks.map(c => (
          <div key={c.name} className="px-5 py-4 border-b border-[#F5F4EF] last:border-0 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <code className="text-sm font-mono font-bold text-[#18181B]">{c.name}</code>
              <p className="text-xs text-[#71717A] mt-0.5">{c.desc}</p>
            </div>
            {c.ok ? (
              <div className="flex items-center gap-1.5 text-[#36671E] text-xs font-bold whitespace-nowrap">
                <CheckCircle2 className="w-4 h-4" /> SET
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-[#D97706] text-xs font-bold whitespace-nowrap">
                <AlertCircle className="w-4 h-4" /> MISSING
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-6 p-5 rounded-xl bg-[#EEF5EA] border border-[#36671E]/20">
        <p className="text-xs font-black text-[#36671E] uppercase tracking-widest mb-2">Database status</p>
        <p className="text-sm text-[#18181B]">
          {isSupabaseConfigured() ? "✓ Supabase is connected. CRM is fully operational." : "⚠ Supabase not configured — leads still hit Telegram + Sheets but can't be tracked here."}
        </p>
      </div>

      <details className="mt-6 bg-white border border-[#E8E6E0] rounded-2xl">
        <summary className="px-5 py-4 cursor-pointer text-sm font-black text-[#18181B]">Setup instructions</summary>
        <div className="px-5 pb-5 text-sm text-[#52525B] space-y-3">
          <p><strong className="text-[#18181B]">1. Create a Supabase project</strong> at <a href="https://supabase.com" className="text-[#36671E] hover:underline">supabase.com</a> (free tier).</p>
          <p><strong className="text-[#18181B]">2. Run the schema:</strong> open SQL editor → paste contents of <code className="bg-[#FAFAF7] px-1.5 py-0.5 rounded">supabase/schema.sql</code> → run.</p>
          <p><strong className="text-[#18181B]">3. Copy your keys</strong> from Project Settings → API.</p>
          <p><strong className="text-[#18181B]">4. Set Vercel env vars</strong> at vercel.com → your project → Settings → Environment Variables.</p>
          <p><strong className="text-[#18181B]">5. Get an Anthropic API key</strong> at console.anthropic.com to power the chatbot.</p>
          <p><strong className="text-[#18181B]">6. Redeploy.</strong></p>
        </div>
      </details>
    </div>
  );
}
