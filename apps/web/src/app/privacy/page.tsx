import Link from 'next/link'
import type { Metadata } from 'next'
import { SettleGridLogo } from '@/components/ui/logo'

export const metadata: Metadata = {
  title: 'Privacy Policy | SettleGrid',
  description: 'How SettleGrid collects, uses, and protects your data.',
  alternates: { canonical: 'https://settlegrid.ai/privacy' },
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="text-xl font-bold text-indigo dark:text-gray-100 mb-3">{title}</h2>
      {children}
    </section>
  )
}

export default function PrivacyPage() {
  return (
    <div className="dark min-h-screen flex flex-col bg-[#0C0E14] text-gray-100">
      {/* ---- Header ---- */}
      <header className="border-b border-gray-200 dark:border-[#2A2D3E] px-6 py-4 dark:bg-[#161822]">
        <nav className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/">
            <SettleGridLogo variant="horizontal" size={32} />
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/docs" className="text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-indigo dark:hover:text-gray-100 transition-colors">
              Docs
            </Link>
            <Link href="/register" className="text-sm font-medium bg-brand text-white px-4 py-2 rounded-lg hover:bg-brand-dark transition-colors">
              Get Started
            </Link>
          </div>
        </nav>
      </header>

      <main className="flex-1 px-6 py-16">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-4xl font-bold text-indigo dark:text-gray-100 mb-2">Privacy Policy</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-10">Last updated: March 11, 2026</p>

          <div className="text-gray-600 dark:text-gray-400 leading-relaxed space-y-0">
            <Section title="1. Introduction">
              <p>
                SettleGrid (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) operates the settlegrid.ai
                platform and related services. This Privacy Policy explains how we collect, use,
                disclose, and safeguard your information when you use our platform, SDK, API, and
                tool showcase (collectively, the &quot;Service&quot;). By using the Service you agree to
                the practices described below.
              </p>
            </Section>

            <Section title="2. Information We Collect">
              <p className="mb-3">We collect the following categories of information:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>
                  <strong>Account information</strong> &mdash; name, email address, and password when
                  you register. Developers also provide Stripe Connect onboarding details (handled by
                  Stripe).
                </li>
                <li>
                  <strong>Billing data</strong> &mdash; credit purchases, payout history, and
                  transaction records. Payment card details are processed and stored exclusively by
                  Stripe; we never see or store full card numbers.
                </li>
                <li>
                  <strong>Usage data</strong> &mdash; API call logs, method names, timestamps, latency
                  metrics, error codes, and IP addresses used for rate limiting and security.
                </li>
                <li>
                  <strong>Device and browser data</strong> &mdash; browser type, operating system,
                  referral URLs, and pages visited, collected automatically through server logs.
                </li>
                <li>
                  <strong>Cookies</strong> &mdash; session cookies for authentication and CSRF
                  protection. We do not use third-party advertising cookies.
                </li>
              </ul>
            </Section>

            <Section title="3. How We Use Your Information">
              <ul className="list-disc pl-6 space-y-2">
                <li>Provide, operate, and maintain the Service.</li>
                <li>Process transactions, calculate payouts, and prevent fraud.</li>
                <li>Enforce rate limits, detect abuse, and protect platform security.</li>
                <li>Generate analytics dashboards and usage reports for your account.</li>
                <li>Send transactional emails (receipts, payout confirmations, security alerts).</li>
                <li>Improve the Service through aggregated, anonymized usage analysis.</li>
                <li>Comply with legal obligations and respond to lawful requests.</li>
              </ul>
            </Section>

            <Section title="4. Information Sharing">
              <p className="mb-3">We do not sell your personal information. We share data only in these circumstances:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>
                  <strong>Service providers</strong> &mdash; Stripe (payments), Resend (email), Vercel
                  (hosting), and Sentry (error monitoring) receive data necessary to perform their
                  services under contractual data-protection obligations.
                </li>
                <li>
                  <strong>Developer&ndash;consumer relationship</strong> &mdash; when a consumer calls a
                  developer&rsquo;s tool, the developer receives the consumer&rsquo;s display name and
                  usage metadata. No email addresses or billing details are shared.
                </li>
                <li>
                  <strong>Legal requirements</strong> &mdash; we may disclose information when required
                  by law, regulation, or valid legal process.
                </li>
                <li>
                  <strong>Business transfers</strong> &mdash; in connection with a merger, acquisition,
                  or sale of assets, your information may be transferred as part of that transaction.
                </li>
              </ul>
            </Section>

            <Section title="5. Cookies and Tracking">
              <p>
                We use strictly necessary cookies for session management and CSRF protection. We use
                PostHog for product analytics with anonymized identifiers. You can disable analytics
                cookies in your browser settings without affecting core Service functionality.
              </p>
            </Section>

            <Section title="6. Data Security">
              <p>
                We implement industry-standard security measures including API key hashing (SHA-256),
                HMAC-signed webhooks, encrypted data in transit (TLS 1.2+), CSRF protection, and
                role-based access controls. While we strive to protect your information, no method of
                electronic transmission or storage is completely secure, and we cannot guarantee
                absolute security.
              </p>
            </Section>

            <Section title="7. Data Retention">
              <p>
                Account data is retained for as long as your account is active. API call logs and
                usage data are retained for 90 days for analytics and debugging purposes, then
                aggregated and anonymized. Billing records are retained as required by applicable tax
                and financial regulations. You may request deletion of your account and associated
                data at any time by contacting us.
              </p>
            </Section>

            <Section title="8. Your Rights">
              <p className="mb-3">Depending on your jurisdiction, you may have the right to:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Access and receive a copy of your personal data.</li>
                <li>Correct inaccurate or incomplete information.</li>
                <li>Request deletion of your personal data.</li>
                <li>Object to or restrict certain processing activities.</li>
                <li>Data portability &mdash; receive your data in a structured, machine-readable format.</li>
                <li>Withdraw consent where processing is based on consent.</li>
              </ul>
              <p className="mt-3">
                To exercise any of these rights, contact us at{' '}
                <a href="mailto:privacy@settlegrid.ai" className="text-brand hover:underline">
                  privacy@settlegrid.ai
                </a>.
              </p>
            </Section>

            <Section title="9. International Transfers">
              <p>
                Our Service is hosted in the United States. If you access the Service from outside the
                United States, your information may be transferred to and processed in the United
                States. We ensure appropriate safeguards are in place for any international data
                transfers in accordance with applicable data protection laws.
              </p>
            </Section>

            <Section title="10. Children">
              <p>
                The Service is not directed to individuals under 16 years of age. We do not knowingly
                collect personal information from children. If we become aware that we have collected
                data from a child, we will take steps to delete it promptly.
              </p>
            </Section>

            <Section title="11. Changes to This Policy">
              <p>
                We may update this Privacy Policy from time to time. We will notify you of material
                changes by posting the updated policy on this page and updating the &quot;Last
                updated&quot; date. Your continued use of the Service after changes constitutes
                acceptance of the revised policy.
              </p>
            </Section>

            <Section title="12. Contact Us">
              <p>
                If you have questions about this Privacy Policy, contact us at{' '}
                <a href="mailto:privacy@settlegrid.ai" className="text-brand hover:underline">
                  privacy@settlegrid.ai
                </a>.
              </p>
            </Section>
          </div>
        </div>
      </main>

      {/* ---- Footer ---- */}
      <footer className="border-t border-gray-200 dark:border-[#2A2D3E] px-6 py-8">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <SettleGridLogo variant="compact" size={32} />
          <div className="flex items-center gap-6 text-sm text-gray-500 dark:text-gray-400">
            <Link href="/tools" className="hover:text-indigo dark:text-gray-100 transition-colors">Showcase</Link>
            <Link href="/docs" className="hover:text-indigo dark:text-gray-100 transition-colors">Documentation</Link>
            <Link href="/privacy" className="hover:text-indigo dark:text-gray-100 transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-indigo dark:text-gray-100 transition-colors">Terms</Link>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            &copy; {new Date().getFullYear()} SettleGrid. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  )
}
