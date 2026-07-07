import { isAdminAuthed } from "@/lib/auth";
import { redirect } from "next/navigation";
import AdminShell from "@/components/admin/AdminShell";
import { headers } from "next/headers";

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
