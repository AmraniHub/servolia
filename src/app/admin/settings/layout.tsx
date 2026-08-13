import SettingsTabs, { type SettingsTab } from "@/components/admin/SettingsTabs";
import { integrationStatus, openRoadmap, stripeMode } from "./_data";

export const dynamic = "force-dynamic";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const { requiredMissing } = integrationStatus();
  const roadmap = openRoadmap();
  const stripe = stripeMode();

  // The overview badge counts things that need a decision, not things that
  // exist: a test-mode Stripe key and any missing REQUIRED secret.
  const overviewAlerts = (stripe !== "live" ? 1 : 0) + requiredMissing.length;

  const tabs: SettingsTab[] = [
    { label: "Overview", href: "/admin/settings", badge: overviewAlerts, alert: overviewAlerts > 0 },
    { label: "Security", href: "/admin/settings/security" },
    { label: "Integrations", href: "/admin/settings/integrations", badge: requiredMissing.length, alert: requiredMissing.length > 0 },
    { label: "Costs", href: "/admin/settings/costs" },
    { label: "What's left", href: "/admin/settings/roadmap", badge: roadmap.length },
  ];

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 lg:py-8 max-w-3xl mx-auto">
      <h1 className="text-2xl font-black text-[#18181B] mb-1">Settings</h1>
      <p className="text-sm text-[#71717A] mb-5">Setup status, secrets, costs, and the live roadmap.</p>
      <SettingsTabs tabs={tabs} />
      {children}
    </div>
  );
}
