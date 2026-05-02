/**
 * P4.K1 hostile-review F6 — buildTranscript markdown safety.
 *
 * The transcript is copied to the visitor's clipboard as raw
 * markdown. If the embedded request/response content contains a
 * literal triple-backtick fence, a 3-backtick wrapper would break
 * out of the code block and corrupt the transcript when the visitor
 * pastes it elsewhere. The pickFence helper widens the fence on
 * demand. These tests pin that behavior.
 */

import { describe, it, expect } from 'vitest'
import { buildTranscript } from '../DemoResponseViewer'
import type { DemoResponse } from '../DemoResponseViewer'
import type { RequestSpec } from '../DemoRequestBuilder'

function makeRequest(overrides: Partial<RequestSpec> = {}): RequestSpec {
  return {
    url: 'https://demo.settlegrid.ai/api/x',
    method: 'POST',
    headers: { 'x-api-key': 'sk_test' },
    body: '{"method":"demo.invocation"}',
    ...overrides,
  }
}

function makeResponse(overrides: Partial<DemoResponse> = {}): DemoResponse {
  return {
    routingDecision: {
      detected: { protocol: 'mcp', displayName: 'MCP' },
      dispatchPath: 'sg-balance',
      steps: [
        {
          label: 'Protocol detection',
          state: 'success',
          detail: 'Detected MCP.',
        },
      ],
    },
    response: {
      status: 200,
      statusText: 'OK',
      headers: { 'content-type': 'application/json' },
      body: { ok: true },
      bodyText: '{"ok":true}',
    },
    rateLimit: { limit: 30, remaining: 29, reset: 1700000000 },
    ...overrides,
  }
}

describe('buildTranscript — pickFence widens fences when content contains backticks', () => {
  it('uses 3-backtick fences when content has none', () => {
    const md = buildTranscript(makeRequest(), makeResponse())
    // 3-backtick fence appears 4 times: open+close × request+response
    const matches = md.match(/^```$/gm) ?? []
    expect(matches.length).toBeGreaterThanOrEqual(2)
  })

  it('widens to 4 backticks when the response body contains a literal 3-backtick fence', () => {
    const result = makeResponse({
      response: {
        status: 200,
        statusText: 'OK',
        headers: {},
        body: '```malicious```',
        bodyText: '```malicious```',
      },
    })
    const md = buildTranscript(makeRequest(), result)
    expect(md).toContain('````')
    // The request still uses 3-backtick fences (its body is clean).
    // Response section uses 4-backtick fences.
    const fourBacktickMatches = md.match(/^````$/gm) ?? []
    expect(fourBacktickMatches.length).toBe(2)
  })

  it('widens to 5 backticks when content contains a 4-backtick run', () => {
    const result = makeResponse({
      response: {
        status: 200,
        statusText: 'OK',
        headers: {},
        body: '````',
        bodyText: '````',
      },
    })
    const md = buildTranscript(makeRequest(), result)
    expect(md).toContain('`````')
    const fiveBacktickMatches = md.match(/^`````$/gm) ?? []
    expect(fiveBacktickMatches.length).toBe(2)
  })

  it('widens for embedded fences in the request body too', () => {
    const md = buildTranscript(
      makeRequest({ body: '```\nimport secret\n```' }),
      makeResponse(),
    )
    // Request fence widens to 4 backticks; response fence stays at 3.
    expect(md).toContain('````\nPOST')
  })

  it('request and response fences widen independently', () => {
    // Each section picks its own fence width based on its own content
    // — the request's fence is sized for the request body, the
    // response's fence is sized for the response body. Verifies the
    // two sections don't share a single global fence width.
    const md = buildTranscript(
      makeRequest({ body: 'plain content' }),
      makeResponse({
        response: {
          status: 200,
          statusText: 'OK',
          headers: {},
          body: '```dangerous```',
          bodyText: '```dangerous```',
        },
      }),
    )
    // Request body has no backticks → 3-backtick fence.
    // Response body has 3 backticks → fence widens to 4.
    expect(md).toMatch(/```\nPOST https:/)  // request open: 3 backticks
    expect(md).toContain('````\nHTTP/1.1') // response open: 4 backticks
  })
})

describe('buildTranscript — structural sanity', () => {
  it('includes the canonical section headings', () => {
    const md = buildTranscript(makeRequest(), makeResponse())
    expect(md).toContain('# SettleGrid kernel demo transcript')
    expect(md).toContain('## Request')
    expect(md).toContain('## Routing decision')
    expect(md).toContain('## Response')
    expect(md).toContain('## Source')
  })

  it('echoes the routing-decision protocol display name', () => {
    const md = buildTranscript(makeRequest(), makeResponse())
    expect(md).toContain('**Detected:** MCP')
    expect(md).toContain('**Dispatch path:** sg-balance')
  })

  it('points the source link at the detected adapter file on GitHub', () => {
    const md = buildTranscript(makeRequest(), makeResponse())
    expect(md).toContain(
      'https://github.com/lexwhiting/settlegrid/blob/main/packages/mcp/src/adapters/mcp.ts',
    )
  })

  it('points the source link at kernel.ts when no protocol matched', () => {
    const md = buildTranscript(
      makeRequest(),
      makeResponse({
        routingDecision: {
          detected: { protocol: null },
          dispatchPath: '402-manifest',
          steps: [],
        },
      }),
    )
    expect(md).toContain(
      'https://github.com/lexwhiting/settlegrid/blob/main/packages/mcp/src/kernel.ts',
    )
  })
})
