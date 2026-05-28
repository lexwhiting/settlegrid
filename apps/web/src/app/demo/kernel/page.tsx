/**
 * P4.K1 — public cross-protocol kernel demo at /demo/kernel.
 *
 * Server-component shell. Loads the adapter inventory from the
 * `@settlegrid/mcp` registry at render time and hands it to the
 * client component, so the protocol picker tracks whatever the
 * kernel actually knows about. Adding an adapter to the registry
 * automatically surfaces it here — no demo-side rework needed.
 *
 * The page is statically rendered at build time (the protocol
 * registry's `list()` is a pure function over the in-memory
 * registry, no I/O). The /api/demo/kernel route does the actual
 * dispatch on each visitor click.
 */

import type { Metadata } from 'next'
import Link from 'next/link'
import { Navbar } from '@/components/marketing/navbar'
import { Footer } from '@/components/marketing/footer'
import {
  KERNEL_SOURCE_URL,
  KERNEL_DISPATCHED_PROTOCOLS,
  listAdapters,
} from '@/lib/demo-kernel-config'
import DemoKernelClient from './_client'

export const metadata: Metadata = {
  title: 'Cross-Protocol Kernel Demo · SettleGrid',
  description:
    'Live, interactive demo of the SettleGrid cross-protocol settlement kernel. Pick a protocol, send a request, and watch the routing decision step-by-step. Sandbox-isolated — no real money is touched.',
  alternates: { canonical: 'https://settlegrid.ai/demo/kernel' },
  openGraph: {
    title: 'Cross-Protocol Kernel Demo · SettleGrid',
    description:
      'Live demo of the SettleGrid kernel. 14 protocols detected, 4 settled end-to-end, sandbox-isolated.',
    type: 'article',
    siteName: 'SettleGrid',
    url: 'https://settlegrid.ai/demo/kernel',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Cross-Protocol Kernel Demo · SettleGrid',
    description:
      'Pick a protocol, send a request, watch the kernel route it. Sandbox-isolated.',
  },
}

export default function DemoKernelPage() {
  const adapters = listAdapters()
  const settledCount = adapters.filter(
    (a) => a.dispatchPath !== '402-manifest',
  ).length
  const detectedOnlyCount = adapters.length - settledCount

  return (
    <div className="dark min-h-screen flex flex-col bg-[#0C0E14] text-gray-100">
      <Navbar />

      <main className="flex-1 px-6 py-16 pt-14">
        <div className="max-w-6xl mx-auto">
          <section className="mb-10">
            <p className="text-sm font-semibold uppercase tracking-wider text-amber-400 mb-4">
              Live demo · sandbox-isolated
            </p>
            <h1 className="text-4xl md:text-5xl font-bold text-gray-100 mb-6 leading-tight">
              Cross-protocol kernel, in your browser
            </h1>
            <p className="text-xl text-gray-400 leading-relaxed max-w-3xl">
              Build a request on the left. Click send. The kernel runs the
              same dispatch pipeline that ships in{' '}
              <Link
                href="https://www.npmjs.com/package/@settlegrid/mcp"
                target="_blank"
                rel="noopener noreferrer"
                className="text-amber-400 hover:text-amber-300 underline underline-offset-2"
              >
                @settlegrid/mcp
              </Link>{' '}
              against {adapters.length} registered protocol adapters. The
              right pane shows the routing decision step-by-step plus the
              raw HTTP response.
            </p>
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl">
              <Stat
                label="Protocols detected"
                value={String(adapters.length)}
                detail="Registered in protocolRegistry"
              />
              <Stat
                label="Settled end-to-end"
                value={String(settledCount)}
                detail={
                  KERNEL_DISPATCHED_PROTOCOLS.map((p) => p.toUpperCase()).join(
                    ' · ',
                  )
                }
              />
              <Stat
                label="402-manifest only"
                value={String(detectedOnlyCount)}
                detail="Phase-2 adapters; dispatch lands in a future kernel phase"
              />
            </div>
          </section>

          <DemoKernelClient adapters={adapters} />

          <section className="mt-12 text-xs text-gray-500 leading-relaxed max-w-3xl space-y-3">
            <p>
              <strong className="text-gray-300">No real money is touched.</strong>{' '}
              Every kernel-issued network call routes to a sandbox endpoint at{' '}
              <code className="font-mono text-amber-400">
                /api/demo/sandbox
              </code>{' '}
              that returns deterministic stubs. Stripe, on-chain settlement,
              and Lightning code paths are never reached.
            </p>
            <p>
              <strong className="text-gray-300">Same kernel build as production.</strong>{' '}
              The route imports{' '}
              <code className="font-mono text-amber-400">
                createDispatchKernel
              </code>{' '}
              directly from{' '}
              <Link
                href={KERNEL_SOURCE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-amber-400 hover:text-amber-300 underline underline-offset-2"
              >
                packages/mcp/src/kernel.ts
              </Link>
              . Only the configuration we hand{' '}
              <code className="font-mono text-amber-400">
                settlegrid.init()
              </code>{' '}
              differs (sandbox URLs and a sandbox tool slug).
            </p>
            <p>
              <strong className="text-gray-300">Rate limited.</strong> 30
              requests per IP per hour. Limit fails open if Upstash is
              unreachable — anti-abuse, not auth.
            </p>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  )
}

function Stat({
  label,
  value,
  detail,
}: {
  label: string
  value: string
  detail: string
}) {
  return (
    <div className="bg-[#161822] border border-[#2A2D3E] rounded-xl p-4">
      <div className="text-3xl font-bold text-amber-400">{value}</div>
      <div className="text-xs font-semibold uppercase tracking-wider text-gray-300 mt-1">
        {label}
      </div>
      <div className="text-xs text-gray-500 mt-1 leading-relaxed">{detail}</div>
    </div>
  )
}
