import Link from 'next/link'
import type { Metadata } from 'next'
import { SettleGridLogo } from '@/components/ui/logo'

export const metadata: Metadata = {
  title: 'Terms of Service | SettleGrid',
  description: 'Terms and conditions for using the SettleGrid platform.',
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="text-xl font-bold text-indigo dark:text-gray-100 mb-3">{title}</h2>
      {children}
    </section>
  )
}

export default function TermsPage() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* ---- Header ---- */}
      <header className="border-b border-gray-200 dark:border-[#2E3148] px-6 py-4">
        <nav className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/">
            <SettleGridLogo variant="horizontal" size={32} />
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/docs" className="text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-indigo dark:text-gray-100 transition-colors">
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
          <h1 className="text-4xl font-bold text-indigo dark:text-gray-100 mb-2">Terms of Service</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-10">Last updated: March 11, 2026</p>

          <div className="text-gray-600 dark:text-gray-400 leading-relaxed space-y-0">
            <Section title="1. Acceptance of Terms">
              <p>
                By accessing or using the SettleGrid platform, SDK, API, and marketplace
                (collectively, the &quot;Service&quot;), you agree to be bound by these Terms of
                Service (&quot;Terms&quot;). If you do not agree, do not use the Service. We may
                update these Terms from time to time; continued use after changes constitutes
                acceptance.
              </p>
            </Section>

            <Section title="2. Account Registration">
              <p className="mb-3">To use the Service you must:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Be at least 16 years of age (or the age of majority in your jurisdiction).</li>
                <li>Provide accurate and complete registration information.</li>
                <li>Maintain the security of your account credentials and API keys.</li>
                <li>Promptly notify us of any unauthorized access to your account.</li>
              </ul>
              <p className="mt-3">
                You are responsible for all activity that occurs under your account.
              </p>
            </Section>

            <Section title="3. Developer Terms">
              <p className="mb-3">If you publish tools on SettleGrid as a developer:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>
                  You must complete Stripe Connect onboarding and comply with Stripe&rsquo;s terms of
                  service for receiving payouts.
                </li>
                <li>
                  You retain all intellectual property rights in your tools. By publishing, you grant
                  SettleGrid a non-exclusive license to list, display, and facilitate access to your
                  tools through the marketplace.
                </li>
                <li>
                  SettleGrid retains a 15% platform fee on each transaction (or as otherwise agreed
                  for Enterprise plans). Payout schedules and minimums are detailed in your dashboard.
                </li>
                <li>
                  You are solely responsible for the accuracy, legality, and quality of your tools and
                  any data they process.
                </li>
              </ul>
            </Section>

            <Section title="4. Consumer Terms">
              <p className="mb-3">If you purchase credits and use tools as a consumer:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>
                  Credits are prepaid and non-refundable except where required by applicable law or
                  in cases of Service malfunction attributable to SettleGrid.
                </li>
                <li>
                  Each tool call deducts credits at the rate published on the tool&rsquo;s storefront
                  page at the time of the call.
                </li>
                <li>
                  Auto-refill, if enabled, will automatically purchase additional credits when your
                  balance falls below your configured threshold.
                </li>
                <li>
                  API keys must be kept confidential. You are responsible for all usage incurred
                  through your keys.
                </li>
              </ul>
            </Section>

            <Section title="5. API and SDK Usage">
              <ul className="list-disc pl-6 space-y-2">
                <li>
                  You may use our SDK and API in accordance with the documentation. Rate limits apply
                  per your plan tier and are enforced automatically.
                </li>
                <li>
                  You must not reverse-engineer, decompile, or attempt to extract the source code of
                  the Service (except as permitted by law).
                </li>
                <li>
                  Sandbox mode is provided for testing only. Test-mode transactions do not incur real
                  charges and must not be used for production workloads.
                </li>
              </ul>
            </Section>

            <Section title="6. Prohibited Conduct">
              <p className="mb-3">You agree not to:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Use the Service for any unlawful purpose or in violation of any applicable law.</li>
                <li>
                  Publish tools that distribute malware, facilitate fraud, or violate third-party
                  intellectual property rights.
                </li>
                <li>
                  Attempt to circumvent rate limiting, billing, authentication, or security controls.
                </li>
                <li>
                  Interfere with or disrupt the Service, servers, or networks connected to it.
                </li>
                <li>Scrape, data-mine, or systematically extract data from the marketplace.</li>
                <li>
                  Impersonate another person or entity, or misrepresent your affiliation with any
                  person or entity.
                </li>
                <li>
                  Submit fraudulent reviews, ratings, or artificially inflate tool usage metrics.
                </li>
              </ul>
            </Section>

            <Section title="7. Billing and Payments">
              <p>
                All payments are processed through Stripe. Prices are listed in US dollars unless
                otherwise stated. You agree to pay all applicable fees and taxes. We reserve the right
                to change pricing with 30 days&rsquo; advance notice. Enterprise plan terms are
                governed by separate agreements.
              </p>
            </Section>

            <Section title="8. Intellectual Property">
              <p>
                The Service, including its design, code, trademarks, and documentation, is owned by
                SettleGrid and protected by intellectual property laws. These Terms do not grant you
                any rights to our trademarks, logos, or branding. The SettleGrid SDK is provided under
                the license specified in its package distribution.
              </p>
            </Section>

            <Section title="9. Termination">
              <p className="mb-3">
                We may suspend or terminate your access to the Service at any time if you violate
                these Terms or engage in conduct that we reasonably believe is harmful to the platform,
                other users, or third parties. You may close your account at any time through your
                dashboard settings. Upon termination:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Developers will receive any outstanding payouts for completed transactions.</li>
                <li>
                  Remaining consumer credits may be refunded at our discretion, minus any applicable
                  processing fees.
                </li>
                <li>
                  Your published tools will be unpublished and removed from the marketplace.
                </li>
              </ul>
            </Section>

            <Section title="10. Disclaimer of Warranties">
              <p>
                THE SERVICE IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; WITHOUT
                WARRANTIES OF ANY KIND, WHETHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO
                IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND
                NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED,
                ERROR-FREE, OR SECURE.
              </p>
            </Section>

            <Section title="11. Limitation of Liability">
              <p>
                TO THE MAXIMUM EXTENT PERMITTED BY LAW, SETTLEGRID SHALL NOT BE LIABLE FOR ANY
                INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF
                PROFITS OR REVENUES, WHETHER INCURRED DIRECTLY OR INDIRECTLY. OUR TOTAL AGGREGATE
                LIABILITY FOR ANY CLAIMS ARISING FROM OR RELATED TO THE SERVICE SHALL NOT EXCEED THE
                GREATER OF (A) THE AMOUNTS YOU PAID TO US IN THE 12 MONTHS PRECEDING THE CLAIM OR
                (B) ONE HUNDRED US DOLLARS ($100).
              </p>
            </Section>

            <Section title="12. Indemnification">
              <p>
                You agree to indemnify, defend, and hold harmless SettleGrid and its officers,
                directors, employees, and agents from any claims, liabilities, damages, losses, or
                expenses (including reasonable attorneys&rsquo; fees) arising from your use of the
                Service, violation of these Terms, or infringement of any third-party rights.
              </p>
            </Section>

            <Section title="13. Governing Law">
              <p>
                These Terms are governed by the laws of the State of Delaware, United States, without
                regard to conflict-of-law principles. Any disputes arising under these Terms shall be
                resolved in the state or federal courts located in Delaware, and you consent to the
                personal jurisdiction of those courts.
              </p>
            </Section>

            <Section title="14. Contact Us">
              <p>
                If you have questions about these Terms, contact us at{' '}
                <a href="mailto:legal@settlegrid.com" className="text-brand hover:underline">
                  legal@settlegrid.com
                </a>.
              </p>
            </Section>
          </div>
        </div>
      </main>

      {/* ---- Footer ---- */}
      <footer className="border-t border-gray-200 dark:border-[#2E3148] px-6 py-8">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <SettleGridLogo variant="compact" size={24} />
          <div className="flex items-center gap-6 text-sm text-gray-500 dark:text-gray-400">
            <Link href="/tools" className="hover:text-indigo dark:text-gray-100 transition-colors">Marketplace</Link>
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
