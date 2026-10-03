import type { Metadata } from "next";

/* The page is a client component; its canonical lives here. */
export const metadata: Metadata = {
  alternates: { canonical: "https://servolia.com/billing" },
};

export default function BillingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
