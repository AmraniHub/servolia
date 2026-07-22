"use client";
import { useState } from "react";

interface Props {
  plan: string;
  label: string;
  className?: string;
  /** Defaults to the one-time deposit checkout; pass "/api/checkout-subscription" for recurring plans. */
  endpoint?: string;
  /** Ties the Stripe checkout session (and the build it creates) back to an existing lead. */
  leadId?: string;
  /** For care-plan subscriptions: monthly (default) or annual (one month free). */
  billing?: "monthly" | "annual";
  /** Language of the page the buyer clicked from — drives the Stripe locale and the intake page they land on. */
  lang?: "en" | "fr";
}

export default function CheckoutButton({ plan, label, className, endpoint = "/api/checkout", leadId, billing, lang = "en" }: Props) {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, leadId, billing, lang }),
      });
      const data = await res.json() as { url?: string };
      if (data.url) window.location.href = data.url;
      else setLoading(false);
    } catch {
      setLoading(false);
    }
  }

  return (
    <button onClick={handleClick} disabled={loading} className={className}>
      {loading ? "Redirecting to Stripe…" : label}
    </button>
  );
}
