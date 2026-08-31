import { isAdminAuthed } from "@/lib/auth";
import { redirect } from "next/navigation";
import AdminShell from "@/components/admin/AdminShell";
import { headers } from "next/headers";

/**
 * The admin installs as its OWN app, separate from the client one.
 *
 * A per-route manifest overrides the site-wide one, so /admin advertises
 * admin.webmanifest: name "Servolia Admin", start_url and scope /admin, and a
 * visibly different icon. Two reasons that beats adding an admin shortcut to
 * the client manifest:
 *
 *   1. A dentist long-pressing THEIR Servolia icon should not find an "Admin"
 *      entry. It is not a security hole - /admin/login is guessable and sits
 *      behind a password and 2FA - but it is their app, and it should look
 *      like it.
 *   2. Installed separately, the two live side by side on one home screen and
 *      open where each is meant to: clients at /portal, you at /admin.
 *
 * scope /admin keeps the installed admin window inside the panel, so a stray
 * marketing link opens in the browser instead of hijacking the app.
 */
export const metadata = { manifest: "/admin.webmanifest" };

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const hdrs = await headers();
  const pathname = hdrs.get("x-pathname") ?? hdrs.get("x-invoke-path") ?? "";
  const isLoginPage = pathname.endsWith("/admin/login") || pathname === "/admin/login";

  const authed = await isAdminAuthed();

  if (!authed && !isLoginPage) {
    redirect("/admin/login");
  }
  if (authed && isLoginPage) {
    redirect("/admin");
  }

  if (isLoginPage) {
    return <div className="min-h-screen bg-[#FAFAF7]">{children}</div>;
  }

  return <AdminShell>{children}</AdminShell>;
}
