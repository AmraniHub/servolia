import type { Client } from "@/lib/supabase";

export type PaymentAlertLevel = "past_due" | "suspended";

export interface PaymentAlert {
  level: PaymentAlertLevel;
  suspendAt: string | null;        // ISO — deadline to pay before shutoff
  daysLeft: number | null;         // whole days remaining in grace, floor
  reason: string | null;
  invoiceUrl: string | null;       // Stripe hosted invoice, if we have it
}

/**
 * Read a client row and return the current payment alert, if any.
 * Also promotes past_due → suspended when the grace window has expired,
 * so any surface reading this gets the fresh state without a cron.
 */
export function paymentAlertFrom(client: Pick<Client, "payment_status" | "suspend_at" | "suspended_at" | "last_payment_failure_reason" | "open_invoice_url"> | null | undefined): PaymentAlert | null {
  if (!client) return null;
  const status = client.payment_status ?? "ok";
  if (status === "ok") return null;

  const suspendAt = client.suspend_at ?? null;
  const now = Date.now();
  const suspendedByGrace = !!suspendAt && new Date(suspendAt).getTime() <= now;
  const level: PaymentAlertLevel = status === "suspended" || suspendedByGrace ? "suspended" : "past_due";
  const daysLeft = suspendAt
    ? Math.max(0, Math.floor((new Date(suspendAt).getTime() - now) / 86400000))
    : null;

  return {
    level,
    suspendAt,
    daysLeft,
    reason: client.last_payment_failure_reason ?? null,
    invoiceUrl: client.open_invoice_url ?? null,
  };
}
