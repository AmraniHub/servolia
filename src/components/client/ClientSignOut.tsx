"use client";

/**
 * Leaving the service page.
 *
 * Only shown to a client who signed in with a password — someone who arrived
 * on an emailed link has no session to end, and a "sign out" that does nothing
 * visible is worse than none. Clearing the cookie is the whole job; the link
 * in their email keeps working afterwards, which is the point of having two
 * ways in.
 */
export default function ClientSignOut({ lang }: { lang: "en" | "fr" }) {
  return (
    <button
      onClick={async () => {
        await fetch("/api/client-area?do=signout", { method: "POST" });
        window.location.href = "/hosting/account";
      }}
      className="text-[13px] text-[#71717A] hover:underline shrink-0"
    >
      {lang === "fr" ? "Se déconnecter" : "Sign out"}
    </button>
  );
}
