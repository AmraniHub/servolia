import TwoFactorPanel from "@/components/admin/TwoFactorPanel";
import { Lock, Gauge, KeyRound } from "lucide-react";

export const dynamic = "force-dynamic";

/**
 * Security section. The 2FA panel is the only interactive part; the rest
 * documents what is already enforced, so the founder can see the door is
 * locked without reading the code.
 */
export default function SecuritySettings() {
  const facts = [
    {
      icon: Lock,
      title: "Admin login",
      body: "Password compared in constant time, so response timing gives nothing away. Wrong password and wrong code return the identical error — no clue which factor failed.",
    },
    {
      icon: Gauge,
      title: "Rate limits",
      body: "8 password attempts and 8 code attempts per 15 minutes per IP, counted separately so a mistyped code can't spend your password budget. Shared across all serverless instances via the rate_limits table.",
    },
    {
      icon: KeyRound,
      title: "Sessions",
      body: "Signed JWTs in httpOnly, secure, sameSite cookies. The signing secret fails closed in production — rotating ADMIN_JWT_SECRET invalidates every admin and client session at once, which is the emergency logout lever.",
    },
  ];

  return (
    <>
      <TwoFactorPanel />

      <div className="mt-8 space-y-3">
        {facts.map((f) => {
          const Icon = f.icon;
          return (
            <div key={f.title} className="flex items-start gap-3 p-5 rounded-xl bg-white border border-[#E8E6E0]">
              <Icon className="w-4 h-4 text-[#36671E] mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-black text-[#18181B] mb-1">{f.title}</p>
                <p className="text-xs text-[#71717A] leading-relaxed">{f.body}</p>
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-[11px] text-[#A1A1AA] mt-6">
        Full detail — including the portal door, security headers and the contact-form spam gate — lives in{" "}
        <a href="/admin/system" className="underline font-semibold text-[#52525B]">System guide → Security model</a>.
      </p>
    </>
  );
}
