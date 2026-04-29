/**
 * P3.PROT1 — Mastercard Verifiable Intent rollout landing page.
 *
 * Backs the URL emitted in the kernel adapter's 503 detection-stub
 * response (``settlegrid.ai/protocols/mastercard-vi``). When a buyer's
 * client receives the 503 with ``message`` referencing this URL, the
 * developer who follows the link reads the rollout context here and
 * can leave their email for a notify-me ping when validation ships.
 *
 * The page is server-rendered prose plus a client-side form
 * (``./notify-form``) — no auth, no analytics gates, just an honest
 * "here's what's coming" pointer.
 */

import type { Metadata } from 'next'
import Link from 'next/link'
import { NotifyMeForm } from './notify-form'

export const metadata: Metadata = {
  title: 'Mastercard Verifiable Intent — SettleGrid',
  description:
    'SettleGrid detects Mastercard Verifiable Intent (MVI) requests today and surfaces a 503 ' +
    '"protocol detected, validation pending" response. Full validation lands when Mastercard ' +
    "ships the public Verifiable Intent API (target: 2026-Q3). Drop your email to be notified.",
  openGraph: {
    title: 'Mastercard Verifiable Intent — SettleGrid',
    description:
      'Detection stub live; full validation lands 2026-Q3. Get notified when Mastercard VI goes GA on SettleGrid.',
  },
  alternates: {
    canonical: 'https://settlegrid.ai/protocols/mastercard-vi',
  },
}

const EXPECTED_AT = '2026-Q3'

export default function MastercardVILandingPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16 text-zinc-100">
      <nav aria-label="Breadcrumb" className="mb-6 text-sm text-zinc-500">
        {/*
          Hostile-review fix: "Protocols" was previously rendered as a link
          to ``/protocols``, but no index page exists at that path — only
          ``/protocols/mastercard-vi``. The link 404'd. Render it as
          plain (non-link) text until an index page lands, so the
          breadcrumb is informative without dangling.
        */}
        <ol className="flex flex-wrap gap-2">
          <li>
            <Link href="/" className="hover:text-zinc-300">
              SettleGrid
            </Link>
          </li>
          <li aria-hidden>/</li>
          <li>Protocols</li>
          <li aria-hidden>/</li>
          <li className="text-zinc-300">Mastercard Verifiable Intent</li>
        </ol>
      </nav>

      <header className="mb-10">
        <p className="mb-2 text-sm font-medium uppercase tracking-wider text-amber-400">
          Detection stub · Validation pending
        </p>
        <h1 className="text-4xl font-semibold tracking-tight">
          Mastercard Verifiable Intent on SettleGrid
        </h1>
        <p className="mt-4 text-lg text-zinc-400">
          SettleGrid&apos;s kernel detects Mastercard Verifiable Intent (MVI) envelopes today
          and refuses them cleanly with a structured 503 response. Full validation lands
          when Mastercard ships the public Verifiable Intent API.
        </p>
      </header>

      <section aria-labelledby="status" className="mb-10">
        <h2 id="status" className="mb-3 text-xl font-semibold">
          Current status
        </h2>
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
            <dt className="text-xs font-medium uppercase tracking-wider text-zinc-500">
              Detection
            </dt>
            <dd className="mt-1 text-sm text-zinc-200">
              <span className="rounded bg-emerald-950/60 px-2 py-0.5 text-emerald-300">
                Live
              </span>{' '}
              MVI envelopes are recognized via SD-JWT issuer + AP2 claim parsing.
            </dd>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
            <dt className="text-xs font-medium uppercase tracking-wider text-zinc-500">
              End-to-end validation
            </dt>
            <dd className="mt-1 text-sm text-zinc-200">
              <span className="rounded bg-amber-950/60 px-2 py-0.5 text-amber-300">
                Pending
              </span>{' '}
              Target: <strong className="text-zinc-100">{EXPECTED_AT}</strong>, aligned with
              Mastercard&apos;s public Verifiable Intent API GA.
            </dd>
          </div>
        </dl>
      </section>

      <section aria-labelledby="why" className="mb-10">
        <h2 id="why" className="mb-3 text-xl font-semibold">
          Why a stub, not a fake validator
        </h2>
        <p className="mb-3 text-sm text-zinc-300">
          Mastercard VI is rolling out as the AP2-interoperable identity layer for card-rail
          agent payments. Rather than silently accept MVI envelopes today (which would
          accept unverified payments — looks like a bug to the buyer&apos;s client), the
          SettleGrid kernel returns a 503 with a structured envelope:
        </p>
        <pre className="overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-950 p-4 text-xs text-zinc-300">
          {`{
  "status":      "protocol_detected",
  "protocol":    "mastercard-vi",
  "message":     "Mastercard Verifiable Intent detected. Full validation lands in ${EXPECTED_AT}. See settlegrid.ai/protocols/mastercard-vi.",
  "expected_at": "${EXPECTED_AT}"
}`}
        </pre>
        <p className="mt-3 text-sm text-zinc-400">
          A well-behaved buyer client treats the 503 as a transient signal, backs off, and
          retries once the rollout date passes. The structured fields (
          <code className="rounded bg-zinc-900 px-1 text-zinc-200">protocol</code>,{' '}
          <code className="rounded bg-zinc-900 px-1 text-zinc-200">expected_at</code>) let
          tooling distinguish this rollout-pending state from a generic outage.
        </p>
      </section>

      <section aria-labelledby="notify" className="mb-12">
        <h2 id="notify" className="mb-3 text-xl font-semibold">
          Get notified when validation ships
        </h2>
        <p className="mb-4 text-sm text-zinc-400">
          We&apos;ll email you once when MVI validation goes live on SettleGrid. No
          marketing, no follow-ups — one ping at GA.
        </p>
        <NotifyMeForm />
      </section>

      <footer className="border-t border-zinc-800 pt-6 text-xs text-zinc-500">
        <p>
          Track other emerging-protocol rollouts on the{' '}
          <a href="/changelog" className="underline hover:text-zinc-300">
            SettleGrid changelog
          </a>
          .
        </p>
      </footer>
    </main>
  )
}
