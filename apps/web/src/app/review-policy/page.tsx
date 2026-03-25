import Link from 'next/link'
import type { Metadata } from 'next'
import { SettleGridLogo } from '@/components/ui/logo'

export const metadata: Metadata = {
  title: 'Review Policy | SettleGrid',
  description: 'Guidelines for submitting and moderating reviews on SettleGrid.',
  alternates: { canonical: 'https://settlegrid.ai/review-policy' },
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="text-xl font-bold text-indigo dark:text-gray-100 mb-3">{title}</h2>
      {children}
    </section>
  )
}

export default function ReviewPolicyPage() {
  return (
    <div className="dark min-h-screen flex flex-col bg-[#0F1117] text-gray-100">
      {/* ---- Header ---- */}
      <header className="border-b border-gray-200 dark:border-[#2E3148] px-6 py-4 dark:bg-[#1A1D2E]">
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
          <h1 className="text-4xl font-bold text-indigo dark:text-gray-100 mb-2">Review Policy</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-10">Last updated: March 24, 2026</p>

          <div className="text-gray-600 dark:text-gray-400 leading-relaxed space-y-0">
            <p className="mb-8">
              Reviews on SettleGrid help developers and consumers make informed decisions about MCP tools.
              To maintain a trustworthy marketplace, all reviews must follow these guidelines.
            </p>

            <Section title="Who Can Review">
              <ul className="list-disc pl-6 space-y-2">
                <li>You must have an active SettleGrid consumer account.</li>
                <li>You must have used the tool at least once (verified by invocation history).</li>
                <li>You may submit one review per tool. To change your review, edit your existing one.</li>
              </ul>
            </Section>

            <Section title="What&rsquo;s Allowed">
              <ul className="list-disc pl-6 space-y-2">
                <li>Honest feedback about your experience using the tool &mdash; positive or negative.</li>
                <li>Specific details about reliability, performance, pricing, documentation, or support.</li>
                <li>Constructive criticism, including identifying bugs or limitations.</li>
                <li>Comparisons with other tools, when based on your direct experience.</li>
              </ul>
            </Section>

            <Section title="What&rsquo;s Prohibited">
              <ul className="list-disc pl-6 space-y-2">
                <li>
                  <strong>Profanity, slurs, hate speech, or threats</strong> &mdash; reviews containing
                  abusive language will be automatically blocked.
                </li>
                <li>
                  <strong>Personal information</strong> &mdash; do not include email addresses, phone numbers,
                  physical addresses, or full names of individuals.
                </li>
                <li>
                  <strong>Spam or promotional content</strong> &mdash; reviews must reflect genuine experience,
                  not advertise products or services.
                </li>
                <li>
                  <strong>Fake or misleading reviews</strong> &mdash; reviews must be based on your actual use
                  of the tool. Fabricated experiences are prohibited.
                </li>
                <li>
                  <strong>Incentivized reviews</strong> &mdash; reviews written in exchange for payment, credits,
                  free access, or other compensation are prohibited, whether positive or negative.
                </li>
                <li>
                  <strong>Conflict of interest</strong> &mdash; developers may not review their own tools or
                  competitors&rsquo; tools. Reviews by employees or affiliates of the tool developer are prohibited.
                </li>
                <li>
                  <strong>Review manipulation</strong> &mdash; coordinating review campaigns, using multiple
                  accounts, or any form of rating manipulation is prohibited.
                </li>
                <li>
                  <strong>Off-topic content</strong> &mdash; reviews must relate to the tool being reviewed.
                  Grievances about SettleGrid policies, unrelated products, or personal disputes belong in
                  support tickets, not reviews.
                </li>
                <li>
                  <strong>Illegal content</strong> &mdash; reviews must not contain or link to content that
                  violates applicable law.
                </li>
              </ul>
            </Section>

            <Section title="Developer Responses">
              <ul className="list-disc pl-6 space-y-2">
                <li>Tool developers may post one public response to each review.</li>
                <li>Developer responses must be professional and constructive.</li>
                <li>Developers may not threaten, coerce, or pressure reviewers to change or remove reviews.</li>
                <li>Developers may not condition service quality, support access, or pricing on review content.</li>
              </ul>
            </Section>

            <Section title="How We Moderate">
              <ul className="list-disc pl-6 space-y-2">
                <li>
                  <strong>Automated filtering</strong> &mdash; reviews are scanned for profanity, spam signals,
                  and policy violations before publication. Reviews that clearly violate our policy are blocked
                  automatically.
                </li>
                <li>
                  <strong>Community reporting</strong> &mdash; both consumers and developers can report reviews
                  they believe violate this policy.
                </li>
                <li>
                  <strong>Manual review</strong> &mdash; flagged reviews are reviewed by the SettleGrid team
                  within 48 hours.
                </li>
                <li>
                  <strong>Verified usage</strong> &mdash; reviews are only accepted from consumers who have
                  used the tool at least once, verified by invocation history.
                </li>
              </ul>
            </Section>

            <Section title="Enforcement Actions">
              <p className="mb-3">
                We take the following actions based on the severity and frequency of violations:
              </p>
              <ol className="list-decimal pl-6 space-y-2">
                <li>
                  <strong>Block</strong> &mdash; review is prevented from being published (automated filter).
                </li>
                <li>
                  <strong>Hide</strong> &mdash; review is removed from public view. The reviewer is notified
                  with the reason.
                </li>
                <li>
                  <strong>Remove</strong> &mdash; review is permanently removed for egregious violations.
                </li>
              </ol>
            </Section>

            <Section title="Transparency">
              <p>
                Every moderation action is logged with a reason. Consumers whose reviews are hidden or removed
                will be notified with the specific reason for the action. We believe transparency builds trust
                and is committed to fair, consistent enforcement of these guidelines.
              </p>
            </Section>

            <Section title="Contact Us">
              <p>
                If you have questions about this policy or believe a moderation decision was made in error,
                contact us at{' '}
                <a href="mailto:support@settlegrid.ai" className="text-brand hover:underline">
                  support@settlegrid.ai
                </a>.
              </p>
            </Section>
          </div>
        </div>
      </main>

      {/* ---- Footer ---- */}
      <footer className="border-t border-gray-200 dark:border-[#2E3148] px-6 py-8">
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
