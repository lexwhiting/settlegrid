/**
 * P2.FMT4 — SettleGrid n8n node unit tests (Invoke Tool).
 *
 * Exercises the execute() function with a mocked IExecuteFunctions
 * harness. Validates:
 *   - Invoke Tool POSTs to /api/proxy/{slug} with the expected body
 *   - Credentials integration (apiKey + baseUrl threaded through)
 *   - 401 / 402 / 404 / 429 / 5xx errors map to NodeApiError with
 *     actionable messages
 *   - Arguments (JSON) parsing: object, string, empty, invalid,
 *     arrays, primitives
 *   - Invoke operation is wired into the node's property schema
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NodeApiError } from 'n8n-workflow'
import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow'
import { SettleGrid } from '../nodes/SettleGrid/SettleGrid.node'

type Params = Record<string, unknown>

interface HarnessOptions {
  params?: Params
  inputs?: INodeExecutionData[]
  credentials?: { apiKey: string; baseUrl?: string }
  httpRequestImpl?: (options: unknown) => unknown
  continueOnFail?: boolean
}

function makeHarness(opts: HarnessOptions = {}) {
  const params = opts.params ?? {}
  const inputs = opts.inputs ?? [{ json: {} }]
  const credentials = opts.credentials ?? { apiKey: 'sg_live_abc' }
  const httpRequest = vi.fn(
    opts.httpRequestImpl ?? (async () => ({ ok: true })),
  )
  const getNode = vi.fn(() => ({ name: 'SettleGrid', type: 'settleGrid' }))
  const getCredentials = vi.fn(async () => credentials)
  const getInputData = vi.fn(() => inputs)
  const continueOnFail = vi.fn(() => opts.continueOnFail ?? false)
  const getNodeParameter = vi.fn(
    (name: string, _itemIndex: number, fallback?: unknown) => {
      if (name in params) return params[name]
      return fallback
    },
  )
  const ctx = {
    getCredentials,
    getInputData,
    getNodeParameter,
    getNode,
    continueOnFail,
    helpers: { httpRequest },
  } as unknown as IExecuteFunctions
  return { ctx, httpRequest, getCredentials, getNodeParameter, getNode }
}

function invokeToolParams(overrides: Params = {}): Params {
  return {
    resource: 'tool',
    operation: 'invokeTool',
    slug: 'weather-lookup',
    invokeMethod: '',
    invokeArgs: '{}',
    ...overrides,
  }
}

describe('SettleGrid node — node description (P2.FMT4)', () => {
  it('registers Invoke Tool as a Tool operation', () => {
    const node = new SettleGrid()
    const operationProp = node.description.properties.find(
      (p) =>
        p.name === 'operation' &&
        p.displayOptions?.show?.resource?.includes('tool'),
    )
    expect(operationProp).toBeDefined()
    const options = (operationProp as { options?: Array<{ value: string }> })
      .options
    expect(options?.map((o) => o.value)).toContain('invokeTool')
  })

  it('surfaces `slug` for both getTool and invokeTool', () => {
    const node = new SettleGrid()
    const slugProp = node.description.properties.find(
      (p) => p.name === 'slug',
    )
    expect(slugProp?.displayOptions?.show?.operation).toEqual(
      expect.arrayContaining(['getTool', 'invokeTool']),
    )
  })

  it('exposes invokeArgs as a JSON-typed parameter', () => {
    const node = new SettleGrid()
    const argsProp = node.description.properties.find(
      (p) => p.name === 'invokeArgs',
    )
    expect(argsProp?.type).toBe('json')
    expect(argsProp?.default).toBe('{}')
  })

  it('exposes invokeMethod only for invokeTool', () => {
    const node = new SettleGrid()
    const methodProp = node.description.properties.find(
      (p) => p.name === 'invokeMethod',
    )
    expect(methodProp?.displayOptions?.show?.operation).toEqual(['invokeTool'])
  })
})

describe('SettleGrid node — Invoke Tool happy path', () => {
  beforeEach(() => vi.clearAllMocks())

  it('POSTs to /api/proxy/{slug} with the x-api-key header', async () => {
    const { ctx, httpRequest } = makeHarness({
      params: invokeToolParams({ invokeArgs: '{"query":"Tokyo weather"}' }),
    })
    const node = new SettleGrid()
    const result = await node.execute.call(ctx)
    expect(httpRequest).toHaveBeenCalledTimes(1)
    const req = httpRequest.mock.calls[0][0] as Record<string, unknown>
    expect(req.method).toBe('POST')
    expect(req.url).toBe('https://settlegrid.ai/api/proxy/weather-lookup')
    expect((req.headers as Record<string, unknown>)['x-api-key']).toBe(
      'sg_live_abc',
    )
    expect(req.body).toEqual({ query: 'Tokyo weather' })
    expect(result).toEqual([[{ json: { ok: true } }]])
  })

  it('appends `method` to the body when invokeMethod is provided', async () => {
    const { ctx, httpRequest } = makeHarness({
      params: invokeToolParams({
        invokeArgs: '{"q":"hi"}',
        invokeMethod: 'search',
      }),
    })
    await new SettleGrid().execute.call(ctx)
    const req = httpRequest.mock.calls[0][0] as Record<string, unknown>
    expect(req.body).toEqual({ q: 'hi', method: 'search' })
  })

  it('honors a custom baseUrl from credentials (trailing slash stripped)', async () => {
    const { ctx, httpRequest } = makeHarness({
      params: invokeToolParams(),
      credentials: {
        apiKey: 'sg_live_xyz',
        baseUrl: 'https://staging.settlegrid.ai/',
      },
    })
    await new SettleGrid().execute.call(ctx)
    const req = httpRequest.mock.calls[0][0] as Record<string, unknown>
    expect(req.url).toBe(
      'https://staging.settlegrid.ai/api/proxy/weather-lookup',
    )
  })

  it('URL-encodes slugs with special characters', async () => {
    const { ctx, httpRequest } = makeHarness({
      params: invokeToolParams({ slug: 'my tool/name?x=y' }),
    })
    await new SettleGrid().execute.call(ctx)
    const req = httpRequest.mock.calls[0][0] as Record<string, unknown>
    expect(req.url).toBe(
      'https://settlegrid.ai/api/proxy/my%20tool%2Fname%3Fx%3Dy',
    )
  })

  it('accepts invokeArgs as an object (expression evaluation)', async () => {
    const { ctx, httpRequest } = makeHarness({
      params: invokeToolParams({ invokeArgs: { pre: 'evaluated', n: 1 } }),
    })
    await new SettleGrid().execute.call(ctx)
    const req = httpRequest.mock.calls[0][0] as Record<string, unknown>
    expect(req.body).toEqual({ pre: 'evaluated', n: 1 })
  })

  it('defaults to empty body when invokeArgs is "{}"', async () => {
    const { ctx, httpRequest } = makeHarness({ params: invokeToolParams() })
    await new SettleGrid().execute.call(ctx)
    const req = httpRequest.mock.calls[0][0] as Record<string, unknown>
    expect(req.body).toBeUndefined()
  })

  it('runs once per input item', async () => {
    const { ctx, httpRequest } = makeHarness({
      params: invokeToolParams({ invokeArgs: '{"x":1}' }),
      inputs: [{ json: {} }, { json: {} }, { json: {} }],
    })
    await new SettleGrid().execute.call(ctx)
    expect(httpRequest).toHaveBeenCalledTimes(3)
  })

  it('unwraps array responses into separate output items', async () => {
    const { ctx } = makeHarness({
      params: invokeToolParams({ invokeArgs: '{"x":1}' }),
      httpRequestImpl: async () => [{ id: 1 }, { id: 2 }],
    })
    const result = await new SettleGrid().execute.call(ctx)
    expect(result).toEqual([[{ json: { id: 1 } }, { json: { id: 2 } }]])
  })
})

describe('SettleGrid node — Invoke Tool error mapping (P2.FMT4 DoD)', () => {
  beforeEach(() => vi.clearAllMocks())

  async function runWithHttpError(status: number) {
    const err = Object.assign(new Error(`HTTP ${status}`), {
      httpCode: status,
      statusCode: status,
    })
    const { ctx } = makeHarness({
      params: invokeToolParams({ invokeArgs: '{"x":1}' }),
      httpRequestImpl: async () => {
        throw err
      },
    })
    return new SettleGrid().execute.call(ctx)
  }

  it('maps 401 → NodeApiError with "Invalid or missing SettleGrid API key"', async () => {
    await expect(runWithHttpError(401)).rejects.toThrowError(
      /Invalid or missing SettleGrid API key/,
    )
  })

  it('maps 402 → NodeApiError with "Insufficient SettleGrid credits"', async () => {
    await expect(runWithHttpError(402)).rejects.toThrowError(
      /Insufficient SettleGrid credits/,
    )
  })

  it('maps 404 → NodeApiError with "SettleGrid tool not found"', async () => {
    await expect(runWithHttpError(404)).rejects.toThrowError(
      /SettleGrid tool not found/,
    )
  })

  it('maps 429 → NodeApiError with "rate limit exceeded"', async () => {
    await expect(runWithHttpError(429)).rejects.toThrowError(/rate limit/i)
  })

  it('maps 500 → NodeApiError with "upstream error"', async () => {
    await expect(runWithHttpError(500)).rejects.toThrowError(
      /upstream error.*500/,
    )
  })

  it('maps 503 → NodeApiError with 5xx upstream error', async () => {
    await expect(runWithHttpError(503)).rejects.toThrowError(
      /upstream error.*503/,
    )
  })

  it('falls back to a generic message when status is unknown', async () => {
    const err = new Error('network failure')
    const { ctx } = makeHarness({
      params: invokeToolParams({ invokeArgs: '{"x":1}' }),
      httpRequestImpl: async () => {
        throw err
      },
    })
    await expect(new SettleGrid().execute.call(ctx)).rejects.toThrowError(
      /SettleGrid API request failed/,
    )
  })

  it('all HTTP-status errors are thrown as NodeApiError instances', async () => {
    const err = Object.assign(new Error('boom'), { httpCode: 402 })
    const { ctx } = makeHarness({
      params: invokeToolParams({ invokeArgs: '{"x":1}' }),
      httpRequestImpl: async () => {
        throw err
      },
    })
    try {
      await new SettleGrid().execute.call(ctx)
      expect.fail('should have thrown')
    } catch (e) {
      expect(e).toBeInstanceOf(NodeApiError)
    }
  })

  it('extracts status from response.status when httpCode/statusCode are missing', async () => {
    const err = Object.assign(new Error('x'), { response: { status: 402 } })
    const { ctx } = makeHarness({
      params: invokeToolParams({ invokeArgs: '{"x":1}' }),
      httpRequestImpl: async () => {
        throw err
      },
    })
    await expect(new SettleGrid().execute.call(ctx)).rejects.toThrowError(
      /Insufficient SettleGrid credits/,
    )
  })

  it('honors continueOnFail — emits an error item instead of throwing', async () => {
    const err = Object.assign(new Error('x'), { httpCode: 402 })
    const { ctx } = makeHarness({
      params: invokeToolParams({ invokeArgs: '{"x":1}' }),
      continueOnFail: true,
      httpRequestImpl: async () => {
        throw err
      },
    })
    const result = await new SettleGrid().execute.call(ctx)
    expect(result[0]).toHaveLength(1)
    expect((result[0][0].json as Record<string, unknown>).error).toMatch(
      /Insufficient SettleGrid credits/,
    )
  })
})

describe('SettleGrid node — Invoke Tool input validation', () => {
  beforeEach(() => vi.clearAllMocks())

  it('throws NodeApiError when slug is empty', async () => {
    const { ctx } = makeHarness({
      params: invokeToolParams({ slug: '' }),
    })
    await expect(new SettleGrid().execute.call(ctx)).rejects.toThrowError(
      /Tool Slug is required/,
    )
  })

  it('throws NodeApiError when slug is whitespace-only', async () => {
    const { ctx } = makeHarness({
      params: invokeToolParams({ slug: '   ' }),
    })
    await expect(new SettleGrid().execute.call(ctx)).rejects.toThrowError(
      /Tool Slug is required/,
    )
  })

  it('throws NodeApiError when invokeArgs is malformed JSON', async () => {
    const { ctx } = makeHarness({
      params: invokeToolParams({ invokeArgs: '{not json' }),
    })
    await expect(new SettleGrid().execute.call(ctx)).rejects.toThrowError(
      /not valid JSON/,
    )
  })

  it('throws NodeApiError when invokeArgs is a JSON array', async () => {
    const { ctx } = makeHarness({
      params: invokeToolParams({ invokeArgs: '[1,2,3]' }),
    })
    await expect(new SettleGrid().execute.call(ctx)).rejects.toThrowError(
      /must be a JSON object/,
    )
  })

  it('throws NodeApiError when invokeArgs is a JSON primitive', async () => {
    const { ctx } = makeHarness({
      params: invokeToolParams({ invokeArgs: '42' }),
    })
    await expect(new SettleGrid().execute.call(ctx)).rejects.toThrowError(
      /must be a JSON object/,
    )
  })

  it('throws NodeApiError when invokeArgs is a number (non-object, non-string)', async () => {
    const { ctx } = makeHarness({
      params: invokeToolParams({ invokeArgs: 42 }),
    })
    await expect(new SettleGrid().execute.call(ctx)).rejects.toThrowError(
      /must be an object or a JSON string/,
    )
  })

  it('does NOT call httpRequest when validation fails', async () => {
    const { ctx, httpRequest } = makeHarness({
      params: invokeToolParams({ invokeArgs: '{not json' }),
    })
    await expect(new SettleGrid().execute.call(ctx)).rejects.toThrow()
    expect(httpRequest).not.toHaveBeenCalled()
  })
})

describe('SettleGrid node — credential validation (hostile fix)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('throws NodeApiError when credential apiKey is missing', async () => {
    const { ctx, httpRequest } = makeHarness({
      params: invokeToolParams({ invokeArgs: '{"x":1}' }),
      credentials: { apiKey: '' },
    })
    await expect(new SettleGrid().execute.call(ctx)).rejects.toThrowError(
      /credential is missing an API key/,
    )
    expect(httpRequest).not.toHaveBeenCalled()
  })

  it('throws NodeApiError when credential apiKey is whitespace-only', async () => {
    const { ctx, httpRequest } = makeHarness({
      params: invokeToolParams({ invokeArgs: '{"x":1}' }),
      credentials: { apiKey: '   ' },
    })
    await expect(new SettleGrid().execute.call(ctx)).rejects.toThrowError(
      /credential is missing an API key/,
    )
    expect(httpRequest).not.toHaveBeenCalled()
  })

  it('throws NodeApiError when credential apiKey is non-string (object)', async () => {
    const { ctx, httpRequest } = makeHarness({
      params: invokeToolParams({ invokeArgs: '{"x":1}' }),
      credentials: { apiKey: { nested: 'x' } as unknown as string },
    })
    await expect(new SettleGrid().execute.call(ctx)).rejects.toThrowError(
      /credential is missing an API key/,
    )
    expect(httpRequest).not.toHaveBeenCalled()
  })

  it('trims whitespace on credential apiKey before forwarding', async () => {
    const { ctx, httpRequest } = makeHarness({
      params: invokeToolParams({ invokeArgs: '{"x":1}' }),
      credentials: { apiKey: '  sg_live_trimmed  ' },
    })
    await new SettleGrid().execute.call(ctx)
    const req = httpRequest.mock.calls[0][0] as Record<string, unknown>
    expect((req.headers as Record<string, unknown>)['x-api-key']).toBe(
      'sg_live_trimmed',
    )
  })

  it('falls back to default baseUrl when credential baseUrl is non-string', async () => {
    const { ctx, httpRequest } = makeHarness({
      params: invokeToolParams({ invokeArgs: '{"x":1}' }),
      credentials: {
        apiKey: 'sg_live_x',
        baseUrl: 42 as unknown as string,
      },
    })
    await new SettleGrid().execute.call(ctx)
    const req = httpRequest.mock.calls[0][0] as Record<string, unknown>
    expect((req.url as string).startsWith('https://settlegrid.ai/')).toBe(true)
  })
})

describe('SettleGrid node — credentials integration (P2.FMT4 DoD)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('reads credentials exactly once per execute() call', async () => {
    const { ctx, getCredentials } = makeHarness({
      params: invokeToolParams({ invokeArgs: '{"x":1}' }),
      inputs: [{ json: {} }, { json: {} }],
    })
    await new SettleGrid().execute.call(ctx)
    expect(getCredentials).toHaveBeenCalledTimes(1)
    expect(getCredentials).toHaveBeenCalledWith('settleGridApi')
  })

  it('forwards the apiKey from credentials as the x-api-key header verbatim', async () => {
    const { ctx, httpRequest } = makeHarness({
      params: invokeToolParams({ invokeArgs: '{"x":1}' }),
      credentials: { apiKey: 'sg_live_custom_key_XYZ789' },
    })
    await new SettleGrid().execute.call(ctx)
    const req = httpRequest.mock.calls[0][0] as Record<string, unknown>
    expect((req.headers as Record<string, unknown>)['x-api-key']).toBe(
      'sg_live_custom_key_XYZ789',
    )
  })

  it('defaults baseUrl to https://settlegrid.ai when credential omits it', async () => {
    const { ctx, httpRequest } = makeHarness({
      params: invokeToolParams({ invokeArgs: '{"x":1}' }),
      credentials: { apiKey: 'sg_live_x' },
    })
    await new SettleGrid().execute.call(ctx)
    const req = httpRequest.mock.calls[0][0] as Record<string, unknown>
    expect((req.url as string).startsWith('https://settlegrid.ai/')).toBe(true)
  })
})
