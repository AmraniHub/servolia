import type { Metadata } from "next";
import { notFound } from "next/navigation";
import SiteEditor from "@/components/SiteEditor";
import { editableSite } from "@/lib/siteEditor";
import { knownSiteUrl } from "@/lib/clientRefs";

/**
 * THE METADATA IS THE PART THAT LEAKS, BECAUSE NONE OF IT IS ON THE PAGE.
 *
 * Fixing the <title> was not enough. Everything not named here is INHERITED
 * from the root layout, and the root layout is Servolia's: paste this address
 * into WhatsApp and the preview card read "Servolia — AI Lead Systems for
 * Service Businesses" under the client's own domain. The client never opens a
 * page to see that; they see it the moment they send the link to someone, or
 * their staff do, which is worse than a leak on a page nobody shares.
 *
 * So og:title, og:description, og:siteName, og:url, the twitter card AND the
 * image are all overridden per client. The image especially: src/app/
 * opengraph-image.tsx is applied by file convention unless something says
 * otherwise, so an empty images array is load-bearing — without it the card
 * carries Servolia's artwork from servolia.com even with every string fixed.
 */
export async function generateMetadata(
  { params }: { params: Promise<{ ref: string }> },
): Promise<Metadata> {
  const { ref } = await params;
  const site = editableSite(ref);
  const name = site?.businessName ?? "your website";
  const shared = {
    title: "Edit your website",
    description: `Change the words and photos on ${name}.`,
  };
  return {
    /* ABSOLUTE, so the root layout's "%s | Servolia" template does not apply.
       It did, and the browser tab on a client's own /admin read "Edit your
       website | Servolia" — invisible to a check that reads the body text,
       because a title is not in the body. */
    title: { absolute: shared.title },
    description: shared.description,
    robots: { index: false, follow: false, nocache: true },
    /* Their favicon, not ours. Left to itself Next asks for /icon and
       /apple-icon, which are Servolia's — and on the client's domain those
       either 404 or, worse, put our mark on their browser tab. Naming
       /favicon.ico instead resolves to the one their own site already serves. */
    icons: { icon: "/favicon.ico" },
    openGraph: {
      ...shared,
      /* Their name and their address. metadataBase is servolia.com, so an
         unset url would resolve the card to our domain under their link. */
      siteName: name,
      url: knownSiteUrl(ref) ?? undefined,
      type: "website",
      images: [],
    },
    twitter: { ...shared, card: "summary", images: [] },
  };
}

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

  /* Their colours, not ours. Servolia's green and warm cream are a signature;
     on a page served at the client's own address they would quietly say whose
     software this is. Both come from the site's own entry.

     The <body> needs it too, not just this <main>. The root layout paints the
     body Servolia cream, and although <main> covers it at any normal height,
     the cream is what shows through an overscroll bounce on a phone — which is
     exactly where she will use this. A style element is the only way to reach
     <body> from a page, since the layout above owns that tag.

     The colour is ours, out of EDITABLE_SITES, never anything a request
     carried — but it is interpolated into CSS, so it is checked against a
     literal hex shape first rather than trusted for being close to home. */
  const surface = /^#[0-9A-Fa-f]{6}$/.test(site.surface) ? site.surface : "#FFFFFF";

  return (
    <main className="min-h-screen" style={{ background: surface }}>
      <style>{`body{background:${surface}}`}</style>
      <SiteEditor
        siteRef={site.ref}
        theme={{ accent: site.accent, surface, line: site.line }}
        uiLang={site.uiLang ?? "en"}
      />
    </main>
  );
}
