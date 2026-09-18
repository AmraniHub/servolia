import type { Metadata } from "next";
import { notFound } from "next/navigation";
import SiteEditor from "@/components/SiteEditor";
import { editableSite } from "@/lib/siteEditor";

export const metadata: Metadata = {
  title: "Edit your website",
  robots: { index: false, follow: false, nocache: true },
};

/**
 * THE CLIENT'S OWN PAGE EDITOR.
 *
 * Served at the CLIENT's domain, never at ours: their host rewrites
 * `/admin` to `/client-editor/<their-ref>` here, so the address bar, the
 * cookies and every request stay on their own website. Nothing on this page
 * names Servolia — the client asked for control of their pages, and being
 * sent to their supplier's website to change their own words is the opposite
 * of being given it.
 *
 * THE REF IS IN THE PATH AND THAT IS FINE. It says which site the form is
 * for; it grants nothing. The password is the gate, the session carries the
 * ref afterwards, and every read and write takes the site from that session
 * rather than from anything the browser sent. Someone who guesses another
 * client's ref reaches a password box and stops there.
 *
 * No navigation, no logo, no link out. It is a tool, opened to do one job.
 */
export default async function ClientEditorPage({
  params,
}: {
  params: Promise<{ ref: string }>;
}) {
  const { ref } = await params;
  const site = editableSite(ref);
  if (!site) notFound();

  return (
    <main className="min-h-screen bg-[#FAFAF7]">
      <SiteEditor siteRef={site.ref} />
    </main>
  );
}
