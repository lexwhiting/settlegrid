/**
 * P4.MKT2 — Public x402 facilitator landing page.
 *
 * Anchors the docs URL the announcement post links to. Pure server-
 * rendered prose — no auth, no analytics gates, just an honest
 * "here's what we run, here's how to call it" page.
 *
 * Day-one supported networks: Base mainnet + Base Sepolia. The
 * facilitator endpoints reject other networks at the boundary even
 * if the underlying USDC_ADDRESSES table includes them. See
 * `apps/web/src/app/api/x402/facilitator/v1/supported/route.ts`.
 */

import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'x402 facilitator — SettleGrid',
  description:
    'SettleGrid runs a public x402 facilitator at facilitator.settlegrid.ai. ' +
    'Verify and settle x402 payments on Base mainnet and Base Sepolia. ' +
    'No API key required; rate-limited per IP.',
  openGraph: {
    title: 'SettleGrid x402 facilitator — public verify + settle endpoints',
    description:
      'Public x402 facilitator running on Base mainnet and Base Sepolia. ' +
      'Endpoints: /v1/verify, /v1/settle, /v1/supported.',
  },
  alternates: {
    canonical: 'https://settlegrid.ai/protocols/x402/facilitator',
  },
}

const FACILITATOR_BASE = 'https://facilitator.settlegrid.ai'

const INCIDENTS_URL =
  'https://github.com/lexwhiting/settlegrid/issues?q=is%3Aopen+label%3Afacilitator'

/**
 * Status badge — server-rendered, env-gated. When
 * `UPTIMEROBOT_STATUS_URL` is set in the deployment env, render a
 * "Live status" link to the public UptimeRobot status page (founder
 * sets this up per Step 6 of docs/launch/x402-facilitator-dns-runbook.md).
 * When unset, fall back to the incidents-only placeholder so a fresh
 * deployment doesn't claim a status it can't verify.
 *
 * Why a link, not a fetched-and-rendered status JSON: UptimeRobot's
 * public status pages don't have a stable documented JSON API.
 * Fetching server-side adds latency + a fallback-render branch for
 * upstream errors; linking out is honest ("click for current status")
 * and uses UptimeRobot's own page as the source of truth.
 */
function FacilitatorStatusBadge() {
  const uptimeStatusUrl = process.env.UPTIMEROBOT_STATUS_URL?.trim()

  if (uptimeStatusUrl && /^https:\/\//.test(uptimeStatusUrl)) {
    return (
      <div
        className="mt-4 inline-flex items-center gap-2 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-300"
        role="status"
        aria-label="Facilitator status"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
        <a
          href={uptimeStatusUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-emerald-200"
        >
          Live status
        </a>
        <span className="text-emerald-500/60">·</span>
        <a
          href={INCIDENTS_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-emerald-200"
        >
          Incidents
        </a>
      </div>
    )
  }

  return (
    <div
      className="mt-4 inline-flex items-center gap-2 rounded-md border border-zinc-700 bg-zinc-900/60 px-3 py-1 text-xs text-zinc-300"
      role="status"
      aria-label="Facilitator incident tracker"
    >
      <span className="h-1.5 w-1.5 rounded-full bg-zinc-500" />
      <a
        href={INCIDENTS_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="underline hover:text-zinc-100"
      >
        Open incidents
      </a>
      <span className="text-zinc-600">· uptime widget pending</span>
    </div>
  )
}

const NETWORKS = [
  {
    id: 'eip155:8453',
    name: 'Base mainnet',
    asset: 'USDC',
    address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    status: 'production',
  },
  {
    id: 'eip155:84532',
    name: 'Base Sepolia',
    asset: 'USDC',
    address: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
    status: 'testnet',
  },
] as const

const ENDPOINTS = [
  {
    method: 'POST',
    path: '/v1/verify',
    summary:
      'Validate an x402 payment payload (signature, nonce, balance, time window) without settling.',
    example: `curl -sS -X POST ${FACILITATOR_BASE}/v1/verify \\
  -H "Content-Type: application/json" \\
  -d '{
    "paymentPayload": {
      "scheme": "exact",
      "network": "eip155:8453",
      "payload": { /* EIP-3009 transferWithAuthorization fields */ }
    }
  }'`,
  },
  {
    method: 'POST',
    path: '/v1/settle',
    summary:
      'Verify, then submit the settlement transaction on-chain via the SettleGrid gas wallet. Idempotent on payload SHA-256.',
    example: `curl -sS -X POST ${FACILITATOR_BASE}/v1/settle \\
  -H "Content-Type: application/json" \\
  -d '{
    "paymentPayload": {
      "scheme": "exact",
      "network": "eip155:8453",
      "payload": { /* ... */ }
    },
    "paymentIdentifier": "your-idempotency-key"
  }'`,
  },
  {
    method: 'GET',
    path: '/v1/supported',
    summary:
      'Return the facilitator capabilities envelope (schemes, networks, extensions) per the x402 v2 spec.',
    example: `curl -sS ${FACILITATOR_BASE}/v1/supported`,
  },
] as const

export default function X402FacilitatorPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16 text-zinc-100">
      <nav aria-label="Breadcrumb" className="mb-6 text-sm text-zinc-500">
        <ol className="flex flex-wrap gap-2">
          <li>
            <Link href="/" className="hover:text-zinc-300">
              SettleGrid
            </Link>
          </li>
          <li aria-hidden>/</li>
          <li>Protocols</li>
          <li aria-hidden>/</li>
          <li>x402</li>
          <li aria-hidden>/</li>
          <li className="text-zinc-300">Facilitator</li>
        </ol>
      </nav>

      <header className="mb-10">
        <h1 className="text-3xl font-bold tracking-tight text-white">
          SettleGrid x402 facilitator
        </h1>
        <p className="mt-3 text-zinc-400">
          Public x402 verify + settle endpoints, free to use, rate-limited per
          IP, no API key required.
        </p>
        <FacilitatorStatusBadge />
      </header>

      <section className="mb-10">
        <h2 className="text-xl font-semibold text-white">
          What is an x402 facilitator?
        </h2>
        <p className="mt-3 text-zinc-300">
          The{' '}
          <a
            href="https://www.x402.org/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-amber-400 hover:text-amber-300"
          >
            x402 protocol
          </a>{' '}
          turns HTTP 402 Payment Required into a real settlement primitive: a
          tool returns 402 with a payment offer, the buyer&apos;s client signs an
          EIP-3009 authorization, and a <em>facilitator</em> verifies the
          signature and broadcasts the on-chain transfer. SettleGrid runs one
          of these facilitators publicly — anyone can point their tool at{' '}
          <code className="rounded bg-zinc-800/60 px-1.5 py-0.5 text-sm text-zinc-200">
            {FACILITATOR_BASE}
          </code>{' '}
          and have x402 payments cleared without standing up their own gas
          wallet, RPC subscription, or signature-verification stack.
        </p>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-semibold text-white">Endpoints</h2>
        <p className="mt-3 text-zinc-300">
          Three endpoints under{' '}
          <code className="rounded bg-zinc-800/60 px-1.5 py-0.5 text-sm text-zinc-200">
            /v1
          </code>{' '}
          per the x402 v2 facilitator spec.
        </p>
        <ul className="mt-6 space-y-6">
          {ENDPOINTS.map((ep) => (
            <li key={ep.path}>
              <div className="mb-2 flex items-baseline gap-3">
                <span className="rounded bg-zinc-800 px-2 py-0.5 text-xs font-mono text-zinc-300">
                  {ep.method}
                </span>
                <code className="font-mono text-sm text-zinc-100">
                  {FACILITATOR_BASE}
                  {ep.path}
                </code>
              </div>
              <p className="mb-2 text-sm text-zinc-400">{ep.summary}</p>
              <pre className="overflow-x-auto rounded-md bg-zinc-900 p-4 text-xs text-zinc-200">
                <code>{ep.example}</code>
              </pre>
            </li>
          ))}
        </ul>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-semibold text-white">Supported networks</h2>
        <p className="mt-3 text-zinc-300">
          Base mainnet and Base Sepolia on day one. We will add networks only
          after running an end-to-end settle from outside our development
          environment — the supported list is a guarantee, not a roadmap.
        </p>
        <div className="mt-4 overflow-x-auto rounded-md border border-zinc-800">
          <table className="w-full text-sm">
            <thead className="bg-zinc-900 text-zinc-400">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Network</th>
                <th className="px-4 py-2 text-left font-medium">CAIP-2</th>
                <th className="px-4 py-2 text-left font-medium">Asset</th>
                <th className="px-4 py-2 text-left font-medium">USDC contract</th>
                <th className="px-4 py-2 text-left font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {NETWORKS.map((n) => (
                <tr key={n.id} className="text-zinc-300">
                  <td className="px-4 py-2">{n.name}</td>
                  <td className="px-4 py-2 font-mono text-xs">{n.id}</td>
                  <td className="px-4 py-2">{n.asset}</td>
                  <td className="px-4 py-2 font-mono text-xs">{n.address}</td>
                  <td className="px-4 py-2">{n.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-semibold text-white">
          Calling an x402-protected endpoint
        </h2>
        <p className="mt-3 text-zinc-300">
          On the consumer side, use{' '}
          <a
            href="https://www.npmjs.com/package/@settlegrid/client"
            target="_blank"
            rel="noopener noreferrer"
            className="text-amber-400 hover:text-amber-300"
          >
            <code>@settlegrid/client</code>
          </a>{' '}
          to call any x402-protected URL. The client intercepts the tool&apos;s 402
          response, constructs the EIP-3009 signature with your wallet, and
          retries — the tool&apos;s own backend is what calls the facilitator to
          verify and settle, so this URL doesn&apos;t appear in your code:
        </p>
        <pre className="mt-4 overflow-x-auto rounded-md bg-zinc-900 p-4 text-xs text-zinc-200">
          <code>{`import { createSettleGridClient } from '@settlegrid/client'

const client = createSettleGridClient({
  wallets: {
    x402: { /* viem wallet client on Base */ },
  },
  defaultMaxCostCents: 50,
})

const res = await client.call('https://api.example.com/some-tool', {
  method: 'POST',
  body: JSON.stringify({ query: 'hello' }),
})
console.log(await res.text())
`}</code>
        </pre>
        <p className="mt-4 text-sm text-zinc-400">
          On the tool-author side (the surface that <em>does</em> talk to the
          facilitator), point your <code>@settlegrid/mcp</code> wrap config at{' '}
          <code className="rounded bg-zinc-800/60 px-1.5 py-0.5 text-zinc-200">
            {`facilitatorUrl: '${FACILITATOR_BASE}'`}
          </code>{' '}
          when initializing the x402 adapter. See the{' '}
          <a
            href="https://github.com/lexwhiting/settlegrid/blob/main/apps/web/src/lib/settlement/adapters/x402.ts"
            target="_blank"
            rel="noopener noreferrer"
            className="text-amber-400 hover:text-amber-300"
          >
            adapter source
          </a>{' '}
          for the option shape.
        </p>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-semibold text-white">Report a bug</h2>
        <p className="mt-3 text-zinc-300">
          Open an issue at{' '}
          <a
            href="https://github.com/lexwhiting/settlegrid/issues/new?labels=facilitator"
            target="_blank"
            rel="noopener noreferrer"
            className="text-amber-400 hover:text-amber-300"
          >
            github.com/lexwhiting/settlegrid/issues
          </a>{' '}
          with the request body, the timestamp (UTC), and the network. We
          respond on weekdays within 24 hours; for outage reports, ping{' '}
          <a
            href="mailto:founder@settlegrid.ai"
            className="text-amber-400 hover:text-amber-300"
          >
            founder@settlegrid.ai
          </a>{' '}
          directly so it doesn&apos;t sit in the issue queue.
        </p>
      </section>

      <footer className="mt-16 border-t border-zinc-800 pt-6 text-sm text-zinc-500">
        <p>
          Nevermined runs the other major public x402 facilitator. The more
          facilitators in the network, the healthier the protocol — point your
          tools at whichever one fits your latency, country coverage, and
          retry-budget constraints.
        </p>
      </footer>
    </main>
  )
}
