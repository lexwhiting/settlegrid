/**
 * H1 — rate-limit contract for the public MCP route.
 *
 * The route had no limit at its layer ("inheritance" via its internal
 * fetches is illusory — server-side fetches pool all MCP users into one
 * egress-IP bucket). H1 added an IP-keyed sdkLimiter gate as the FIRST
 * statement of handleMcp (POST + DELETE), firing BEFORE McpServer/
 * transport construction. OPTIONS (CORS preflight) and GET (static 405)
 * deliberately stay limit-free. The MCP SDK is mocked wholesale — the
 * contract under test is the gate, not the protocol.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockCheckRateLimit, mockMcpServer, mockHandleRequest } = vi.hoisted(() => ({
  mockCheckRateLimit: vi.fn(),
  mockMcpServer: vi.fn(),
  mockHandleRequest: vi.fn(),
}))

vi.mock('@/lib/rate-limit', () => ({
  sdkLimiter: { __stub: 'sdkLimiter' },
  checkRateLimit: mockCheckRateLimit,
  getClientIp: vi.fn(() => '1.2.3.4'),
}))

vi.mock('@modelcontextprotocol/sdk/server/mcp.js', () => ({
  McpServer: mockMcpServer,
}))

vi.mock('@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js', () => ({
  WebStandardStreamableHTTPServerTransport: vi.fn().mockImplementation(() => ({
    handleRequest: mockHandleRequest,
  })),
}))

import { GET, POST, OPTIONS } from '../route'

describe('mcp route — H1 rate limit', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCheckRateLimit.mockResolvedValue({ success: true, limit: 1000, remaining: 999, reset: 0 })
    mockMcpServer.mockImplementation(() => ({
      registerTool: vi.fn(),
      connect: vi.fn().mockResolvedValue(undefined),
    }))
    mockHandleRequest.mockResolvedValue(
      new Response(JSON.stringify({ jsonrpc: '2.0', result: {}, id: 1 }), { status: 200 }),
    )
  })

  it('POST returns a 429 JSON-RPC error with CORS headers when limited, before any server construction', async () => {
    mockCheckRateLimit.mockResolvedValue({ success: false, limit: 1000, remaining: 0, reset: 0 })

    const res = await POST(
      new NextRequest('http://localhost/api/mcp', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', method: 'tools/list', id: 1 }),
      }),
    )

    expect(res.status).toBe(429)
    const body = await res.json()
    expect(body.jsonrpc).toBe('2.0')
    expect(body.error.code).toBe(-32000)
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*')
    expect(mockMcpServer).not.toHaveBeenCalled()
    expect(mockHandleRequest).not.toHaveBeenCalled()
  })

  it('POST proceeds to the transport when allowed, keyed as mcp:<ip>', async () => {
    const res = await POST(
      new NextRequest('http://localhost/api/mcp', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', method: 'tools/list', id: 1 }),
      }),
    )

    expect(res.status).toBe(200)
    expect(mockCheckRateLimit).toHaveBeenCalledWith(
      expect.objectContaining({ __stub: 'sdkLimiter' }),
      'mcp:1.2.3.4',
    )
    expect(mockHandleRequest).toHaveBeenCalled()
  })

  it('OPTIONS (CORS preflight) never touches the limiter', async () => {
    const res = await OPTIONS()

    expect(res.status).toBe(204)
    expect(mockCheckRateLimit).not.toHaveBeenCalled()
  })

  it('GET (static 405) never touches the limiter', async () => {
    const res = await GET()

    expect(res.status).toBe(405)
    expect(mockCheckRateLimit).not.toHaveBeenCalled()
  })
})
