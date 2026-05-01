'use client'

/**
 * P4.K1 — response viewer for the kernel demo.
 *
 * Renders three sections:
 *   1. The routing decision (steps with ✓/-- markers).
 *   2. The HTTP response (status, headers, body).
 *   3. Footer actions: view-in-source link + copy-as-markdown
 *      transcript export.
 *
 * The viewer is protocol-agnostic: every shape it renders is derived
 * from `inspectRouting()` + the kernel's actual response. New
 * adapters that land in the registry appear automatically.
 */

import { useMemo, useState } from 'react'
import type { ProtocolName } from '@settlegrid/mcp'
import {
  adapterSourceUrl,
  KERNEL_SOURCE_URL,
  type RoutingDecision,
  type RoutingDecisionStep,
} from '@/lib/demo-kernel-config'
import type { RequestSpec } from './DemoRequestBuilder'

export interface DemoResponse {
  routingDecision: RoutingDecision
  response: {
    status: number
    statusText: string
    headers: Record<string, string>
    body: unknown
    bodyText: string
  }
  rateLimit: {
    limit: number
    remaining: number
    reset: number
  }
}

interface Props {
  request: RequestSpec
  result: DemoResponse | null
  error: string | null
}

export default function DemoResponseViewer({ request, result, error }: Props) {
  const [copied, setCopied] = useState(false)

  // Build the markdown transcript whenever the result changes.
  const transcript = useMemo(
    () => (result ? buildTranscript(request, result) : null),
    [request, result],
  )

  if (error) {
    return (
      <div className="bg-[#161822] border border-red-500/40 rounded-xl p-5 text-sm text-red-300 leading-relaxed">
        <div className="font-semibold mb-1">Demo error</div>
        <div className="font-mono text-xs whitespace-pre-wrap">{error}</div>
      </div>
    )
  }

  if (!result) {
    return (
      <div className="bg-[#161822] border border-[#2A2D3E] rounded-xl p-8 text-center text-sm text-gray-500">
        Build a request on the left and click <span className="text-amber-400">Send through kernel</span> to see the routing decision and response.
      </div>
    )
  }

  const detectedProtocol = result.routingDecision.detected.protocol
  const sourceUrl = detectedProtocol
    ? adapterSourceUrl(detectedProtocol)
    : KERNEL_SOURCE_URL
  const sourceLabel = detectedProtocol
    ? `View ${result.routingDecision.detected.displayName ?? detectedProtocol} adapter source`
    : 'View kernel source (no adapter matched)'

  return (
    <div className="flex flex-col gap-4">
      <RoutingDecisionPanel
        decision={result.routingDecision}
        responseStatus={result.response.status}
      />

      <ResponsePanel response={result.response} />

      <div className="flex flex-wrap gap-3 items-center">
        <a
          href={sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-xs text-amber-400 hover:text-amber-300 underline underline-offset-2"
        >
          {sourceLabel} →
        </a>
        {transcript ? (
          <button
            type="button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(transcript)
                setCopied(true)
                window.setTimeout(() => setCopied(false), 2000)
              } catch {
                // Clipboard unavailable — fall through silently. The
                // visitor can still see the transcript by inspecting
                // the page source if they really need it.
              }
            }}
            className="text-xs text-gray-300 border border-[#2A2D3E] rounded-md px-3 py-1.5 hover:border-amber-400 hover:text-amber-300 transition-colors"
          >
            {copied ? 'Copied!' : 'Copy transcript as markdown'}
          </button>
        ) : null}
        <span className="text-xs text-gray-500">
          Rate limit: {result.rateLimit.remaining}/{result.rateLimit.limit}{' '}
          remaining
        </span>
      </div>
    </div>
  )
}

function RoutingDecisionPanel({
  decision,
  responseStatus,
}: {
  decision: RoutingDecision
  responseStatus: number
}) {
  // Once we have the response, "pending" steps that succeeded should
  // render as success (kernel returned 200 → all steps ran). If the
  // response is a 402, the kernel returned the manifest path — pending
  // steps mean "skipped because 402 was returned." Non-200 / non-402
  // means an error or non-success outcome — leave pending steps
  // ambiguous.
  const finalizedSteps = useMemo(
    () => finalizeSteps(decision.steps, responseStatus, decision.dispatchPath),
    [decision.steps, responseStatus, decision.dispatchPath],
  )

  return (
    <div className="bg-[#161822] border border-[#2A2D3E] rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-amber-400">
            Routing decision
          </div>
          <div className="text-sm text-gray-200 mt-1">
            {decision.detected.protocol === null ? (
              <>No protocol detected → 402 manifest</>
            ) : (
              <>
                Detected{' '}
                <span className="font-semibold text-amber-300">
                  {decision.detected.displayName ?? decision.detected.protocol}
                </span>{' '}
                → {labelPath(decision.dispatchPath)}
              </>
            )}
          </div>
        </div>
        <StatusBadge status={responseStatus} />
      </div>
      <ol className="space-y-2 mt-2">
        {finalizedSteps.map((step, idx) => (
          <li key={`${step.label}-${idx}`} className="flex gap-3 items-start">
            <StepIcon state={step.state} />
            <div className="flex-1">
              <div className="text-sm text-gray-200">{step.label}</div>
              {step.detail ? (
                <div className="text-xs text-gray-500 leading-relaxed">
                  {step.detail}
                </div>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}

function ResponsePanel({
  response,
}: {
  response: DemoResponse['response']
}) {
  return (
    <div className="bg-[#161822] border border-[#2A2D3E] rounded-xl p-5">
      <div className="text-xs font-semibold uppercase tracking-wider text-amber-400 mb-3">
        HTTP response
      </div>
      <div className="text-sm text-gray-200 mb-3 font-mono">
        {response.status} {response.statusText}
      </div>

      <details className="text-xs mb-3" open>
        <summary className="cursor-pointer text-gray-400 hover:text-amber-300">
          Headers ({Object.keys(response.headers).length})
        </summary>
        <div className="mt-2 max-h-40 overflow-auto bg-[#0C0E14] border border-[#2A2D3E] rounded-md p-3 font-mono text-xs">
          {Object.entries(response.headers).map(([k, v]) => (
            <div key={k} className="text-gray-400">
              <span className="text-amber-400">{k}</span>: {v}
            </div>
          ))}
        </div>
      </details>

      <details className="text-xs" open>
        <summary className="cursor-pointer text-gray-400 hover:text-amber-300">
          Body
        </summary>
        <pre className="mt-2 max-h-96 overflow-auto bg-[#0C0E14] border border-[#2A2D3E] rounded-md p-3 font-mono text-xs text-gray-300 whitespace-pre-wrap">
          {formatBody(response.body, response.bodyText)}
        </pre>
      </details>
    </div>
  )
}

function StatusBadge({ status }: { status: number }) {
  const tone =
    status >= 200 && status < 300
      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
      : status === 402
        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
        : status === 429
          ? 'bg-orange-500/20 text-orange-300 border-orange-500/40'
          : 'bg-red-500/20 text-red-300 border-red-500/40'
  return (
    <span
      className={`text-xs font-mono font-semibold border rounded px-2 py-1 ${tone}`}
      aria-label={`HTTP status ${status}`}
    >
      {status}
    </span>
  )
}

function StepIcon({ state }: { state: RoutingDecisionStep['state'] }) {
  if (state === 'success') {
    return (
      <span className="text-emerald-400 mt-0.5" aria-hidden="true">
        ✓
      </span>
    )
  }
  if (state === 'failure') {
    return (
      <span className="text-red-400 mt-0.5" aria-hidden="true">
        ✗
      </span>
    )
  }
  if (state === 'skipped') {
    return (
      <span className="text-gray-600 mt-0.5" aria-hidden="true">
        —
      </span>
    )
  }
  return (
    <span className="text-gray-500 mt-0.5" aria-hidden="true">
      •
    </span>
  )
}

function labelPath(path: RoutingDecision['dispatchPath']): string {
  if (path === 'sg-balance') return 'sg-balance pipeline'
  if (path === 'facilitator') return 'facilitator pipeline'
  return '402 manifest'
}

/**
 * Finalize routing-decision steps based on the kernel's actual
 * response. The pre-call inspection marks steps as 'pending'; once
 * we know the kernel returned 200 (settled) or 402 (manifest), we
 * resolve those into ✓ or — accordingly.
 */
function finalizeSteps(
  steps: RoutingDecisionStep[],
  status: number,
  dispatchPath: RoutingDecision['dispatchPath'],
): RoutingDecisionStep[] {
  if (dispatchPath === '402-manifest') {
    // 402-manifest path runs no pipeline steps. Already correctly
    // marked as skipped/success during pre-inspection.
    return steps
  }
  if (status >= 200 && status < 300) {
    // Settled successfully — every previously-pending step ran.
    return steps.map((s) =>
      s.state === 'pending' ? { ...s, state: 'success' } : s,
    )
  }
  if (status === 402 || status === 401 || status === 403) {
    // Verification or authorization failed somewhere; we don't know
    // exactly which step from the response alone, so leave the rest
    // pending (visitor reads the body for the cause).
    return steps
  }
  // 4xx or 5xx other than the above: mark first pending step as failure.
  let failed = false
  return steps.map((s) => {
    if (failed) return s
    if (s.state === 'pending') {
      failed = true
      return { ...s, state: 'failure' }
    }
    return s
  })
}

function formatBody(body: unknown, fallback: string): string {
  if (typeof body === 'string') return body
  if (body === null || body === undefined) return fallback
  try {
    return JSON.stringify(body, null, 2)
  } catch {
    return fallback
  }
}

/**
 * Build a self-contained markdown transcript a visitor can paste
 * into a bug report or share with a teammate. Includes the request
 * spec, the routing decision, and the response.
 */
export function buildTranscript(
  request: RequestSpec,
  result: DemoResponse,
): string {
  const headerLines = Object.entries(request.headers)
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n')

  const respHeaderLines = Object.entries(result.response.headers)
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n')

  const stepLines = result.routingDecision.steps
    .map(
      (s) =>
        `- ${stepGlyph(s.state)} ${s.label}${
          s.detail ? `\n   _${s.detail}_` : ''
        }`,
    )
    .join('\n')

  return `# SettleGrid kernel demo transcript

## Request
\`\`\`
${request.method} ${request.url}
${headerLines || '(no visitor headers)'}

${request.body || '(empty body)'}
\`\`\`

## Routing decision
**Detected:** ${
    result.routingDecision.detected.displayName ??
    result.routingDecision.detected.protocol ??
    'none'
  }
**Dispatch path:** ${result.routingDecision.dispatchPath}

${stepLines}

## Response
\`\`\`
HTTP/1.1 ${result.response.status} ${result.response.statusText}
${respHeaderLines}

${result.response.bodyText || '(empty body)'}
\`\`\`

## Source
${
  result.routingDecision.detected.protocol
    ? adapterSourceUrl(
        result.routingDecision.detected.protocol as ProtocolName,
      )
    : KERNEL_SOURCE_URL
}
`
}

function stepGlyph(state: RoutingDecisionStep['state']): string {
  if (state === 'success') return '[x]'
  if (state === 'failure') return '[!]'
  if (state === 'skipped') return '[-]'
  return '[ ]'
}
