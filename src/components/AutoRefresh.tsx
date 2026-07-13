"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/**
 * Keeps a page's server-fetched data fresh without a manual reload.
 * Calls router.refresh() (re-runs the server component data fetch) on a gentle
 * interval, whenever the tab regains focus, and when the network comes back.
 * Drop it once into a layout/shell — it covers every page under it.
 */
export default function AutoRefresh({ intervalMs = 25000 }: { intervalMs?: number }) {
  const router = useRouter();
  const busy = useRef(false);

  useEffect(() => {
    const refresh = () => {
      if (busy.current || document.visibilityState === "hidden") return;
      busy.current = true;
      router.refresh();
      // small guard so rapid focus/interval overlaps don't stack refreshes
      setTimeout(() => { busy.current = false; }, 1500);
    };

    const id = setInterval(refresh, intervalMs);
    const onVisible = () => { if (document.visibilityState === "visible") refresh(); };

    window.addEventListener("focus", refresh);
    window.addEventListener("online", refresh);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearInterval(id);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("online", refresh);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [router, intervalMs]);

  return null;
}
