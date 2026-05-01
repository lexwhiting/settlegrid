'use client'

/**
 * P4.K1 — request builder pane for the kernel demo.
 *
 * Lets a visitor pick a protocol (or "no payment headers"), then
 * pre-fills realistic headers + body so the kernel's detection chain
 * has something concrete to recognize. Visitors can edit any field
 * before clicking send.
 *
 * The protocol-specific templates are intentionally minimal — they
 * carry just enough header/body shape to be detected; not enough to
 * be confused for a production payment payload. The sandbox never
 * settles real money regardless.
 */

import { useEffect, useState } from 'react'
import type { ProtocolName } from '@settlegrid/mcp'
import type { AdapterSummary } from '@/lib/demo-kernel-config'

export type ProtocolChoice = ProtocolName | 'none'

export interface RequestSpec {
  url: string
  method: string
  headers: Record<string, string>
  body: string
}

interface Props {
  adapters: AdapterSummary[]
  value: RequestSpec
  onChange: (next: RequestSpec) => void
  onSend: () => void
  loading: boolean
}

/**
 * Per-protocol request templates. Each entry produces a request shape
 * that the corresponding adapter's `canHandle()` will recognize so
 * the demo can show a successful detection. Keep these in sync with
 * the canHandle implementations in `packages/mcp/src/adapters/*`.
 */
const PROTOCOL_TEMPLATES: Record<ProtocolChoice, Partial<RequestSpec>> = {
  none: {
    headers: {},
    body: '',
  },
  mcp: {
    headers: { 'x-api-key': 'sk_demo_visitor_key' },
    body: JSON.stringify(
      { method: 'demo.invocation', params: { hello: 'world' } },
      null,
      2,
    ),
  },
  x402: {
    headers: {
      'x-payment': 'eyJzY2hlbWUiOiJleGFjdCIsIm5ldHdvcmsiOiJiYXNlIn0=',
    },
    body: JSON.stringify({ method: 'demo.invocation' }, null, 2),
  },
  mpp: {
    headers: {
      'x-payment-form': 'card',
      'x-payment-method-id': 'pm_demo_card',
    },
    body: JSON.stringify({ method: 'demo.invocation' }, null, 2),
  },
  ap2: {
    headers: { 'x-ap2-envelope': 'demo-envelope-token' },
    body: JSON.stringify({ method: 'demo.invocation' }, null, 2),
  },
  l402: {
    headers: {
      authorization: 'L402 demo-macaroon-blob:0000000000000000',
    },
    body: JSON.stringify({ method: 'demo.invocation' }, null, 2),
  },
  acp: {
    headers: { 'x-acp-receipt': 'demo-acp-receipt' },
    body: JSON.stringify({ method: 'demo.invocation' }, null, 2),
  },
  ucp: {
    headers: { 'x-ucp-token': 'demo-ucp-token' },
    body: JSON.stringify({ method: 'demo.invocation' }, null, 2),
  },
  'visa-tap': {
    headers: { 'x-visa-tap': 'demo-tap-token' },
    body: JSON.stringify({ method: 'demo.invocation' }, null, 2),
  },
  'mastercard-vi': {
    headers: { 'x-mastercard-vi': 'demo-vi-token' },
    body: JSON.stringify({ method: 'demo.invocation' }, null, 2),
  },
  'circle-nano': {
    headers: { 'x-circle-nano': 'demo-circle-nano-token' },
    body: JSON.stringify({ method: 'demo.invocation' }, null, 2),
  },
  alipay: {
    headers: { 'x-actp-token': 'demo-alipay-token' },
    body: JSON.stringify({ method: 'demo.invocation' }, null, 2),
  },
  kyapay: {
    headers: { 'x-kyapay-jwt': 'demo-kyapay-jwt' },
    body: JSON.stringify({ method: 'demo.invocation' }, null, 2),
  },
  emvco: {
    headers: { 'x-emvco-token': 'demo-emvco-token' },
    body: JSON.stringify({ method: 'demo.invocation' }, null, 2),
  },
  drain: {
    headers: { 'x-drain-receipt': 'demo-drain-receipt' },
    body: JSON.stringify({ method: 'demo.invocation' }, null, 2),
  },
}

const DEFAULT_URL = 'https://demo.settlegrid.ai/api/demo-tool/invoke'

export function buildSpecForProtocol(choice: ProtocolChoice): RequestSpec {
  const template = PROTOCOL_TEMPLATES[choice] ?? {}
  return {
    url: DEFAULT_URL,
    method: 'POST',
    headers: { ...(template.headers ?? {}) },
    body: template.body ?? '',
  }
}

export default function DemoRequestBuilder({
  adapters,
  value,
  onChange,
  onSend,
  loading,
}: Props) {
  const [protocol, setProtocol] = useState<ProtocolChoice>('mcp')

  // Push the initial template up to the parent on mount so the parent
  // doesn't need to know the template defaults.
  useEffect(() => {
    onChange(buildSpecForProtocol(protocol))
    // We deliberately exclude onChange from deps — the parent re-binds
    // it every render and would otherwise loop. Mount-only is correct.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleProtocolChange = (next: ProtocolChoice) => {
    setProtocol(next)
    onChange(buildSpecForProtocol(next))
  }

  const updateHeader = (key: string, val: string) => {
    onChange({ ...value, headers: { ...value.headers, [key]: val } })
  }

  const removeHeader = (key: string) => {
    const next = { ...value.headers }
    delete next[key]
    onChange({ ...value, headers: next })
  }

  const addHeader = () => {
    onChange({
      ...value,
      headers: { ...value.headers, '': '' },
    })
  }

  return (
    <div className="flex flex-col gap-4 bg-[#161822] border border-[#2A2D3E] rounded-xl p-5">
      <div>
        <label
          htmlFor="demo-protocol-select"
          className="text-xs font-semibold uppercase tracking-wider text-amber-400 mb-2 block"
        >
          Protocol
        </label>
        <select
          id="demo-protocol-select"
          value={protocol}
          onChange={(e) => handleProtocolChange(e.target.value as ProtocolChoice)}
          className="w-full bg-[#0C0E14] border border-[#2A2D3E] rounded-md px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-amber-400"
        >
          <option value="none">No payment headers (force 402 manifest)</option>
          {adapters.map((a) => (
            <option key={a.name} value={a.name}>
              {a.displayName} — {labelDispatchPath(a.dispatchPath)}
            </option>
          ))}
        </select>
        <p className="text-xs text-gray-500 mt-2 leading-relaxed">
          {protocol === 'none'
            ? 'No protocol-specific headers will be set. Kernel returns its multi-protocol 402 manifest.'
            : describeChoice(protocol, adapters)}
        </p>
      </div>

      <div>
        <label
          htmlFor="demo-url-input"
          className="text-xs font-semibold uppercase tracking-wider text-amber-400 mb-2 block"
        >
          Target URL (illustrative — kernel does not fetch this)
        </label>
        <input
          id="demo-url-input"
          type="text"
          value={value.url}
          onChange={(e) => onChange({ ...value, url: e.target.value })}
          className="w-full bg-[#0C0E14] border border-[#2A2D3E] rounded-md px-3 py-2 text-sm text-gray-100 font-mono focus:outline-none focus:ring-2 focus:ring-amber-400"
        />
      </div>

      <div>
        <label
          htmlFor="demo-method-select"
          className="text-xs font-semibold uppercase tracking-wider text-amber-400 mb-2 block"
        >
          Method
        </label>
        <select
          id="demo-method-select"
          value={value.method}
          onChange={(e) => onChange({ ...value, method: e.target.value })}
          className="w-full bg-[#0C0E14] border border-[#2A2D3E] rounded-md px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-amber-400"
        >
          <option value="POST">POST</option>
          <option value="GET">GET</option>
          <option value="PUT">PUT</option>
          <option value="PATCH">PATCH</option>
          <option value="DELETE">DELETE</option>
        </select>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-amber-400">
            Headers
          </span>
          <button
            type="button"
            onClick={addHeader}
            className="text-xs text-amber-400 hover:text-amber-300"
          >
            + add
          </button>
        </div>
        <div className="space-y-2">
          {Object.entries(value.headers).map(([key, val], idx) => (
            <div key={`${key}-${idx}`} className="flex gap-2">
              <input
                type="text"
                value={key}
                onChange={(e) => {
                  const newHeaders = { ...value.headers }
                  delete newHeaders[key]
                  newHeaders[e.target.value] = val
                  onChange({ ...value, headers: newHeaders })
                }}
                placeholder="header"
                className="flex-1 bg-[#0C0E14] border border-[#2A2D3E] rounded-md px-2 py-1 text-xs text-gray-100 font-mono focus:outline-none focus:ring-1 focus:ring-amber-400"
              />
              <input
                type="text"
                value={val}
                onChange={(e) => updateHeader(key, e.target.value)}
                placeholder="value"
                className="flex-1 bg-[#0C0E14] border border-[#2A2D3E] rounded-md px-2 py-1 text-xs text-gray-100 font-mono focus:outline-none focus:ring-1 focus:ring-amber-400"
              />
              <button
                type="button"
                onClick={() => removeHeader(key)}
                className="text-xs text-gray-500 hover:text-red-400 px-2"
                aria-label={`Remove header ${key}`}
              >
                ×
              </button>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-500 mt-2 leading-relaxed">
          Authorization header is set server-side (sandbox secret) and
          stripped from visitor input.
        </p>
      </div>

      <div>
        <label
          htmlFor="demo-body-textarea"
          className="text-xs font-semibold uppercase tracking-wider text-amber-400 mb-2 block"
        >
          Body
        </label>
        <textarea
          id="demo-body-textarea"
          value={value.body}
          onChange={(e) => onChange({ ...value, body: e.target.value })}
          rows={8}
          spellCheck={false}
          className="w-full bg-[#0C0E14] border border-[#2A2D3E] rounded-md px-3 py-2 text-xs text-gray-100 font-mono focus:outline-none focus:ring-2 focus:ring-amber-400"
        />
      </div>

      <button
        type="button"
        onClick={onSend}
        disabled={loading}
        className="w-full bg-amber-500 text-[#0C0E14] font-semibold rounded-md px-4 py-3 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? 'Routing through kernel…' : 'Send through kernel'}
      </button>
    </div>
  )
}

function labelDispatchPath(
  path: AdapterSummary['dispatchPath'],
): string {
  if (path === 'sg-balance') return 'settled (sg-balance)'
  if (path === 'facilitator') return 'settled (facilitator)'
  return '402 manifest only'
}

function describeChoice(
  choice: ProtocolChoice,
  adapters: AdapterSummary[],
): string {
  if (choice === 'none') return 'Forces the multi-protocol 402 manifest.'
  const adapter = adapters.find((a) => a.name === choice)
  if (!adapter) return ''
  if (adapter.dispatchPath === '402-manifest') {
    return `Detected by the kernel, but routed to the 402 manifest (${adapter.displayName} dispatch lands in a future kernel phase).`
  }
  if (adapter.dispatchPath === 'sg-balance') {
    return `Detected and dispatched through the sg-balance pipeline (validate key → check balance → authorize → handler → meter).`
  }
  return `Detected and dispatched through the facilitator pipeline (verify → authorize → handler → settle).`
}
