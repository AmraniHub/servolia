import { siteUrlFor } from "@/lib/siteHost";
import { redirect } from "next/navigation";
import { getClientEmail } from "@/lib/clientAuth";
import { supabaseAdmin, type Build, type Client } from "@/lib/supabase";
import PortalDashboard from "@/components/PortalDashboard";
import { paymentAlertFrom } from "@/lib/clientBilling";
import { complianceFor, type ComplianceReport } from "@/lib/zeroMiss";
import type { PortalDomain } from "@/components/portal/DomainPanel";
import { capStateForBuild } from "@/lib/conversationCap";
import { excludeTest } from "@/lib/testContext";
import { founderTestBrowser } from "@/lib/testMode";

export const dynamic = "force-dynamic";

export default async function PortalPage() {
  const email = await getClientEmail();
  if (!email) redirect("/portal/login");

  const db = supabaseAdmin();
  let builds: Build[] = [];
  let subscription: Client | null = null;
  let siteSlugs: Record<string, string> = {}; // build_id -> slug
  // build_id -> the address to open: her own domain once it serves the site (C2).
  const siteUrls: Record<string, string> = {};
  // C2: her own domain, from her site — the portal's "Your domain" panel.
  let domain: PortalDomain | null = null;
  let scopesByLeadId: Record<string, { token: string; accepted: boolean }> = {};

  if (db) {
    /* `is_test is not true`: a client never sees a founder test purchase made
       under her address. The founder's own test-mode browser does, so a test
       purchase can be walked through the portal. */
    const keepTest = await founderTestBrowser();
    const { data } = await excludeTest(db, (live) => live(db
      .from("builds")
      .select("*")
      .eq("email", email))
      .order("created_at", { ascending: false }), { keepTest });
    builds = (data as Build[]) ?? [];

    const { data: client } = await excludeTest(db, (live) => live(db
      .from("clients")
      .select("*")
      .eq("email", email))
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(), { keepTest });
    subscription = (client as Client) ?? null;

    const buildIds = builds.map((b) => b.id);
    if (buildIds.length) {
      const { data: sites } = await db.from("client_sites").select("slug, build_id, config").in("build_id", buildIds);
      for (const s of (sites ?? []) as { slug: string; build_id: string; config?: { customDomain?: string; domainLiveAt?: string } }[]) {
        siteSlugs[s.build_id] = s.slug;
        siteUrls[s.build_id] = siteUrlFor({ slug: s.slug, ...(s.config ?? {}) });
        if (!domain && s.config?.customDomain) domain = { name: s.config.customDomain, live: Boolean(s.config.domainLiveAt) };
      }
    }

    const leadIds = builds.map((b) => b.lead_id).filter((id): id is string => !!id);
    if (leadIds.length) {
      const { data: scopes } = await db.from("scope_acceptances").select("lead_id, token, accepted_at").in("lead_id", leadIds);
      for (const s of (scopes ?? []) as { lead_id: string; token: string; accepted_at: string | null }[]) {
        scopesByLeadId[s.lead_id] = { token: s.token, accepted: !!s.accepted_at };
      }
    }
  }

  const paymentAlert = paymentAlertFrom(subscription);

  // CGV 4 bis promises the client can consult their own response times here.
  // Read for their primary published site; skipped when they have none yet.
  const primarySlug = Object.values(siteSlugs)[0] ?? null;
  let zeroMiss: ComplianceReport | null = null;
  if (primarySlug) zeroMiss = await complianceFor(primarySlug);

  // CGV 7 bis: the client owns their domain. The panel proves it back to them.

  // The conversation meter: the number the plan is priced on, shown to the
  // person paying for it. Read for the build the subscription belongs to.
  const meterBuild = subscription?.build_id ?? builds[0]?.id ?? null;
  const cap = meterBuild ? await capStateForBuild(meterBuild) : null;
  const usage = cap ? { used: cap.used, included: cap.included, topups: cap.topups, pct: cap.pct, month: cap.month } : null;

  return <PortalDashboard email={email} builds={builds} subscription={subscription} siteSlugs={siteSlugs} siteUrls={siteUrls} scopesByLeadId={scopesByLeadId} paymentAlert={paymentAlert} zeroMiss={zeroMiss} domain={domain} usage={usage} />;
}
