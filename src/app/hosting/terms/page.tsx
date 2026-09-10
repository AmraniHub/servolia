import type { Metadata } from "next";
import Link from "next/link";
import { CLIENT_PRODUCTS } from "@/lib/hosting";

export const metadata: Metadata = {
  title: "Hosting — what you get",
  description:
    "What the Servolia hosting plan covers, what it costs, and how to take your site elsewhere.",
  robots: { index: true, follow: true },
};

/**
 * THE PAGE A CLIENT ASKS FOR BEFORE THEY PAY.
 *
 * Written after a client replied to a payment link with nine reasonable
 * questions — who actually hosts it, what is covered, what it renews at, and
 * whether she can leave. Every one of those is a question a real hosting
 * company answers on a page, not in a WhatsApp message that neither side can
 * find in six months.
 *
 * Two rules held throughout:
 *
 *  1. NOTHING HERE IS VAGUER THAN THE TRUTH. The infrastructure is named,
 *     because the client can read `Server: Vercel` in her own browser and see
 *     `ns1.vercel-dns.com` in a public WHOIS. A supplier who is coy about
 *     something the customer can verify in thirty seconds has told them
 *     exactly how much to trust everything else.
 *  2. PRICES ARE IMPORTED, never typed. A terms page that quotes a figure the
 *     checkout no longer charges is worse than no terms page, because the
 *     client keeps a copy.
 */

const HOSTING = CLIENT_PRODUCTS.hosting;

function Section({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-[#E8E6E0] pt-7">
      <div className="flex items-baseline gap-3 mb-3">
        <span className="text-[11px] font-black text-[#A8A8A0] tabular-nums">{n}</span>
        <h2 className="text-[17px] font-black text-[#18181B] tracking-tight">{title}</h2>
      </div>
      <div className="space-y-3 text-[15px] leading-relaxed text-[#52525B]">{children}</div>
    </section>
  );
}

export default function HostingTerms() {
  return (
    <main className="min-h-screen bg-[#FAFAF7] flex flex-col">
      <header className="px-5 py-6 border-b border-[#E8E6E0] bg-white">
        <div className="max-w-2xl mx-auto">
          <Link href="/" className="inline-flex items-center">
            <span className="text-xl font-black tracking-tight text-[#18181B]">
              Serv<span className="gradient-text">olia</span>
            </span>
          </Link>
        </div>
      </header>

      <div className="flex-1 px-5 py-12 sm:py-16">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-3xl sm:text-[36px] font-black text-[#18181B] tracking-tight mb-3">
            Website hosting — what you get
          </h1>
          <p className="text-[#52525B] leading-relaxed mb-10">
            Everything the plan covers, what it costs, and how to take your site
            somewhere else if you ever want to. If anything here is unclear, reply
            to any email from us and ask.
          </p>

          <div className="space-y-8">
            <Section n="01" title="Who provides it, and on what">
              <p>
                The service is provided by <strong className="text-[#18181B]">Servolia LLC</strong> (Wyoming, USA).
                Your site runs on <strong className="text-[#18181B]">Vercel&apos;s</strong> global network, on
                infrastructure we operate and pay for.
              </p>
              <p>
                We name the infrastructure because you can verify it yourself: your
                browser reports <code className="text-[13px] bg-white border border-[#E8E6E0] rounded px-1.5 py-0.5">Server: Vercel</code> on
                every page, and a public WHOIS shows your nameservers.
              </p>
            </Section>

            <Section n="02" title="What is included">
              <ul className="space-y-2">
                {HOSTING.includes.map((line) => (
                  <li key={line} className="flex gap-2.5">
                    <span className="text-[#36671E] font-bold">·</span>
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
              <p>
                On security specifically: HTTPS is enforced site-wide with HSTS, the
                certificate renews automatically and never expires on you, and the
                site is served from a global CDN so it loads quickly wherever your
                customers are.
              </p>
              <p>
                <strong className="text-[#18181B]">On backups</strong> — every version of your site is stored in
                version control, and every deployment we have ever made is kept and
                can be restored in about a minute. That is stronger than a nightly
                snapshot: we can put back any previous version, not just last
                night&apos;s.
              </p>
            </Section>

            <Section n="03" title="Price, term and renewal">
              <p>
                <strong className="text-[#18181B]">${HOSTING.annualUsd} per year</strong>, or{" "}
                <strong className="text-[#18181B]">${HOSTING.monthlyUsd} per month</strong> if you prefer to pay
                monthly. The yearly price is the cheaper of the two.
              </p>
              <p>
                Cover runs for twelve months from the day you pay, and renews at the
                same price on the same date. <strong className="text-[#18181B]">We will not raise the price
                without telling you first</strong>, and any change applies from a renewal,
                never mid-term.
              </p>
              <p>
                Payment is handled by Stripe. A proper invoice is issued
                automatically for every payment, and you can download all of them at
                any time from your billing page.
              </p>
            </Section>

            <Section n="04" title="What is not included">
              <p>
                Content changes, new pages, redesigns and new features are quoted
                separately — the plan keeps the site you have running, rather than
                buying a set number of changes.
              </p>
              <p>
                Email hosting on your domain is separate, and paid advertising is
                separate.
              </p>
            </Section>

            <Section n="05" title="What you own, and leaving">
              <p>
                <strong className="text-[#18181B]">The domain and the website are yours.</strong> Not ours,
                and not conditional on staying with us.
              </p>
              <p>
                You can move to another provider or another developer whenever you
                want. On request we transfer the domain to any registrar account you
                name, hand over the complete source code, and give your new
                developer whatever they need to take over. There is no exit fee and
                no notice period.
              </p>
              <p className="text-[14px] bg-white border border-[#E8E6E0] rounded-xl p-4">
                <strong className="text-[#18181B]">One timing rule we do not control:</strong> ICANN forbids
                transferring any <code className="text-[13px]">.com</code> to a different registrar for
                <strong className="text-[#18181B]"> 60 days after it is first registered</strong>. That is a rule of the
                domain system itself, not a condition of ours, and it applies wherever
                the domain is held. Once that window has passed, a transfer is
                whenever you ask.
              </p>
            </Section>

            <Section n="06" title="Support and account">
              <p>
                Reply to any email from us. We watch uptime and you hear about a
                problem from us before you notice it yourself.
              </p>
              <p>
                Your account is held under the email address you give at checkout,
                and everything to do with billing — invoices, card, cancelling — is
                yours to control directly from your billing page. You do not need to
                ask us to cancel.
              </p>
            </Section>

            <Section n="07" title="Cancelling">
              <p>
                Cancel any time, from your billing page, without contacting anyone.
                Your site stays up until the end of the period you have already paid
                for. We do not bill in arrears and we never charge a cancellation
                fee.
              </p>
            </Section>
          </div>

          <p className="mt-12 text-[13px] text-[#8A8A80] leading-relaxed">
            Servolia LLC · Wyoming, USA · These terms sit alongside our{" "}
            <Link href="/legal/terms" className="text-[#36671E] hover:underline">general terms</Link> and{" "}
            <Link href="/legal/privacy" className="text-[#36671E] hover:underline">privacy policy</Link>.
            Where they differ on hosting, this page applies.
          </p>
        </div>
      </div>

      <footer className="px-5 py-8 border-t border-[#E8E6E0] bg-white">
        <div className="max-w-2xl mx-auto text-center">
          <p className="text-xs text-[#8A8A80]">
            Billed by <span className="font-bold text-[#52525B]">Servolia</span> · Payments processed by Stripe
          </p>
        </div>
      </footer>
    </main>
  );
}
