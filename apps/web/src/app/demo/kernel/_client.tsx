'use client'

/**
 * P4.K1 — interactive client component for the kernel demo.
 *
 * Owns the request spec, the response state, and the loading/error
 * flags. The server component (`page.tsx`) hands this component the
 * adapter inventory at render time so the protocol picker reflects
 * whatever is registered in `protocolRegistry` at build time.
 */

import { useState } from 'react'
import DemoRequestBuilder, {
  buildSpecForProtocol,
  type RequestSpec,
} from '@/components/DemoRequestBuilder'
import DemoResponseViewer, {
  type DemoResponse,
} from '@/components/DemoResponseViewer'
import type { AdapterSummary } from '@/lib/demo-kernel-config'

interface Props {
  adapters: AdapterSummary[]
}

export default function DemoKernelClient({ adapters }: Props) {
  const [request, setRequest] = useState<RequestSpec>(() =>
    buildSpecForProtocol('mcp'),
  )
  const [result, setResult] = useState<DemoResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSend = async () => {
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const res = await fetch('/api/demo/kernel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: request.url,
          method: request.method,
          headers: request.headers,
          body: request.body.length > 0 ? safeParseJson(request.body) : undefined,
        }),
      })
      const json = (await res.json()) as DemoResponse | { error: string; message?: string }

      if (!res.ok) {
        const msg = 'message' in json && json.message ? json.message : 'error' in json ? json.error : 'Request failed.'
        setError(`${res.status} — ${msg}`)
        return
      }

      setResult(json as DemoResponse)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <DemoRequestBuilder
        adapters={adapters}
        value={request}
        onChange={setRequest}
        onSend={handleSend}
        loading={loading}
      />
      <DemoResponseViewer request={request} result={result} error={error} />
    </div>
  )
}

/**
 * Best-effort JSON parse for the request body textarea. If the body
 * isn't valid JSON, fall through with the raw string — the proxy
 * route handles both shapes.
 */
function safeParseJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown
  } catch {
    return text
  }
}
