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
    method: '',
    args: '{}',
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

  it('exposes args as a JSON-typed parameter', () => {
    const node = new SettleGrid()
    const argsProp = node.description.properties.find(
      (p) => p.name === 'args',
    )
    expect(argsProp?.type).toBe('json')
    expect(argsProp?.default).toBe('{}')
  })

  it('exposes method only for invokeTool', () => {
    const node = new SettleGrid()
    const methodProp = node.description.properties.find(
      (p) => p.name === 'method',
    )
    expect(methodProp?.displayOptions?.show?.operation).toEqual(['invokeTool'])
  })
})

describe('SettleGrid node — Invoke Tool happy path', () => {
  beforeEach(() => vi.clearAllMocks())

  it('POSTs to /api/proxy/{slug} with the x-api-key header', async () => {
    const { ctx, httpRequest } = makeHarness({
      params: invokeToolParams({ args: '{"query":"Tokyo weather"}' }),
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

  it('appends `method` to the body when method is provided', async () => {
    const { ctx, httpRequest } = makeHarness({
      params: invokeToolParams({
        args: '{"q":"hi"}',
        method: 'search',
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

  it('accepts args as an object (expression evaluation)', async () => {
    const { ctx, httpRequest } = makeHarness({
      params: invokeToolParams({ args: { pre: 'evaluated', n: 1 } }),
    })
    await new SettleGrid().execute.call(ctx)
    const req = httpRequest.mock.calls[0][0] as Record<string, unknown>
    expect(req.body).toEqual({ pre: 'evaluated', n: 1 })
  })

  it('defaults to empty body when args is "{}"', async () => {
    const { ctx, httpRequest } = makeHarness({ params: invokeToolParams() })
    await new SettleGrid().execute.call(ctx)
    const req = httpRequest.mock.calls[0][0] as Record<string, unknown>
    expect(req.body).toBeUndefined()
  })

  it('runs once per input item', async () => {
    const { ctx, httpRequest } = makeHarness({
      params: invokeToolParams({ args: '{"x":1}' }),
      inputs: [{ json: {} }, { json: {} }, { json: {} }],
    })
    await new SettleGrid().execute.call(ctx)
    expect(httpRequest).toHaveBeenCalledTimes(3)
  })

  it('unwraps array responses into separate output items', async () => {
    const { ctx } = makeHarness({
      params: invokeToolParams({ args: '{"x":1}' }),
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
      params: invokeToolParams({ args: '{"x":1}' }),
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
      params: invokeToolParams({ args: '{"x":1}' }),
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
      params: invokeToolParams({ args: '{"x":1}' }),
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
      params: invokeToolParams({ args: '{"x":1}' }),
      httpRequestImpl: async () => {
        throw err
      },
    })
    await expect(new SettleGrid().execute.call(ctx)).rejects.toThrowError(
      /Insufficient SettleGrid credits/,
    )
  })

  it('extracts status from response.statusCode as a numeric fallback', async () => {
    const err = Object.assign(new Error('x'), {
      response: { statusCode: 404 },
    })
    const { ctx } = makeHarness({
      params: invokeToolParams({ args: '{"x":1}' }),
      httpRequestImpl: async () => {
        throw err
      },
    })
    await expect(new SettleGrid().execute.call(ctx)).rejects.toThrowError(
      /SettleGrid tool not found/,
    )
  })

  it('parses string httpCode values ("402") as numeric 402', async () => {
    const err = Object.assign(new Error('x'), { httpCode: '402' })
    const { ctx } = makeHarness({
      params: invokeToolParams({ args: '{"x":1}' }),
      httpRequestImpl: async () => {
        throw err
      },
    })
    await expect(new SettleGrid().execute.call(ctx)).rejects.toThrowError(
      /Insufficient SettleGrid credits/,
    )
  })

  it('ignores non-numeric string httpCode values', async () => {
    const err = Object.assign(new Error('x'), { httpCode: 'not-a-number' })
    const { ctx } = makeHarness({
      params: invokeToolParams({ args: '{"x":1}' }),
      httpRequestImpl: async () => {
        throw err
      },
    })
    // Falls through to the generic "request failed" message because
    // status remains undefined when no parseable number is available.
    await expect(new SettleGrid().execute.call(ctx)).rejects.toThrowError(
      /SettleGrid API request failed/,
    )
  })

  it('ignores NaN / Infinity httpCode values', async () => {
    const err = Object.assign(new Error('x'), { httpCode: NaN })
    const { ctx } = makeHarness({
      params: invokeToolParams({ args: '{"x":1}' }),
      httpRequestImpl: async () => {
        throw err
      },
    })
    await expect(new SettleGrid().execute.call(ctx)).rejects.toThrowError(
      /SettleGrid API request failed/,
    )
  })

  it('handles non-object errors (string / undefined) gracefully', async () => {
    const { ctx } = makeHarness({
      params: invokeToolParams({ args: '{"x":1}' }),
      httpRequestImpl: async () => {
        throw 'string error' // eslint-disable-line no-throw-literal
      },
    })
    await expect(new SettleGrid().execute.call(ctx)).rejects.toThrow()
  })

  it('honors continueOnFail — emits an error item instead of throwing', async () => {
    const err = Object.assign(new Error('x'), { httpCode: 402 })
    const { ctx } = makeHarness({
      params: invokeToolParams({ args: '{"x":1}' }),
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

  it('throws NodeApiError when args is malformed JSON', async () => {
    const { ctx } = makeHarness({
      params: invokeToolParams({ args: '{not json' }),
    })
    await expect(new SettleGrid().execute.call(ctx)).rejects.toThrowError(
      /not valid JSON/,
    )
  })

  it('throws NodeApiError when args is a JSON array', async () => {
    const { ctx } = makeHarness({
      params: invokeToolParams({ args: '[1,2,3]' }),
    })
    await expect(new SettleGrid().execute.call(ctx)).rejects.toThrowError(
      /must be a JSON object/,
    )
  })

  it('throws NodeApiError when args is a JSON primitive', async () => {
    const { ctx } = makeHarness({
      params: invokeToolParams({ args: '42' }),
    })
    await expect(new SettleGrid().execute.call(ctx)).rejects.toThrowError(
      /must be a JSON object/,
    )
  })

  it('throws NodeApiError when args is a number (non-object, non-string)', async () => {
    const { ctx } = makeHarness({
      params: invokeToolParams({ args: 42 }),
    })
    await expect(new SettleGrid().execute.call(ctx)).rejects.toThrowError(
      /must be an object or a JSON string/,
    )
  })

  it('does NOT call httpRequest when validation fails', async () => {
    const { ctx, httpRequest } = makeHarness({
      params: invokeToolParams({ args: '{not json' }),
    })
    await expect(new SettleGrid().execute.call(ctx)).rejects.toThrow()
    expect(httpRequest).not.toHaveBeenCalled()
  })
})

describe('SettleGrid node — hostile fixes (round 2)', () => {
  beforeEach(() => vi.clearAllMocks())

  // H1: parseInvokeArgs defensive copy — prevent mutating upstream data
  it('does NOT mutate the raw args object when method param is set', async () => {
    const upstream = { q: 'hello' } // imagine this came from $json
    const { ctx } = makeHarness({
      params: invokeToolParams({ args: upstream, method: 'search' }),
    })
    await new SettleGrid().execute.call(ctx)
    expect(upstream).toEqual({ q: 'hello' }) // no `method` field leaked in
  })

  it('does NOT mutate the raw args object across iterations', async () => {
    const shared = { q: 'hello' }
    const { ctx } = makeHarness({
      params: invokeToolParams({ args: shared, method: 'search' }),
      inputs: [{ json: {} }, { json: {} }, { json: {} }],
    })
    await new SettleGrid().execute.call(ctx)
    expect(shared).toEqual({ q: 'hello' })
  })

  // parseInvokeArgs nullish-input branches (empty / null / undefined)
  it('parseInvokeArgs: empty string returns empty object', async () => {
    const { ctx, httpRequest } = makeHarness({
      params: invokeToolParams({ args: '' }),
    })
    await new SettleGrid().execute.call(ctx)
    const req = httpRequest.mock.calls[0][0] as Record<string, unknown>
    expect(req.body).toBeUndefined() // empty body → not set
  })

  it('parseInvokeArgs: null returns empty object', async () => {
    const { ctx, httpRequest } = makeHarness({
      params: invokeToolParams({ args: null }),
    })
    await new SettleGrid().execute.call(ctx)
    const req = httpRequest.mock.calls[0][0] as Record<string, unknown>
    expect(req.body).toBeUndefined()
  })

  it('parseInvokeArgs: undefined returns empty object', async () => {
    const { ctx, httpRequest } = makeHarness({
      // Note: no `args` in params at all — getNodeParameter returns the
      // default '{}' set by the harness, so we must explicitly set to
      // undefined via params.
      params: invokeToolParams({ args: undefined }),
    })
    await new SettleGrid().execute.call(ctx)
    const req = httpRequest.mock.calls[0][0] as Record<string, unknown>
    expect(req.body).toBeUndefined()
  })

  // sanitizeErrorForNodeApi undefined/null branches — async-throw of
  // undefined / null is legal JS (e.g., `throw undefined`).
  it('sanitize: handles throw of undefined', async () => {
    const { ctx } = makeHarness({
      params: invokeToolParams({ args: '{"x":1}' }),
      httpRequestImpl: async () => {
        throw undefined // eslint-disable-line no-throw-literal
      },
    })
    await expect(new SettleGrid().execute.call(ctx)).rejects.toThrow()
  })

  it('sanitize: handles throw of null', async () => {
    const { ctx } = makeHarness({
      params: invokeToolParams({ args: '{"x":1}' }),
      httpRequestImpl: async () => {
        throw null // eslint-disable-line no-throw-literal
      },
    })
    await expect(new SettleGrid().execute.call(ctx)).rejects.toThrow()
  })

  it('sanitize: handles throw of a number', async () => {
    const { ctx } = makeHarness({
      params: invokeToolParams({ args: '{"x":1}' }),
      httpRequestImpl: async () => {
        throw 42 // eslint-disable-line no-throw-literal
      },
    })
    await expect(new SettleGrid().execute.call(ctx)).rejects.toThrow()
  })

  it('sanitize: walks arrays inside errors without flattening them', async () => {
    // scrubAuthHeaders recurses into arrays (e.g., axios' set-cookie
    // header is commonly an array). This exercises the Array.isArray
    // branch at the top of scrubAuthHeaders.
    const err = Object.assign(new Error('x'), {
      httpCode: 500,
      response: {
        headers: {
          'set-cookie': ['a=1; path=/', 'b=2; path=/'],
          Authorization: 'Bearer leaked_token',
        },
      },
    })
    const { ctx } = makeHarness({
      params: invokeToolParams({ args: '{"x":1}' }),
      httpRequestImpl: async () => {
        throw err
      },
    })
    try {
      await new SettleGrid().execute.call(ctx)
      expect.fail('should have thrown')
    } catch (e) {
      // Authorization still redacted even with array siblings in the
      // same header bag.
      expect(JSON.stringify(e)).not.toContain('leaked_token')
      // The original array on the source is not mutated.
      expect(
        (err.response as { headers: { 'set-cookie': string[] } }).headers[
          'set-cookie'
        ],
      ).toEqual(['a=1; path=/', 'b=2; path=/'])
    }
  })

  it('sanitize: handles errors with explicit null fields', async () => {
    // Exercises the `value === null` branch in scrubAuthHeaders —
    // Object.entries walks to a field whose value is null.
    const err = Object.assign(new Error('x'), {
      httpCode: 500,
      response: null,
      config: null,
    })
    const { ctx } = makeHarness({
      params: invokeToolParams({ args: '{"x":1}' }),
      httpRequestImpl: async () => {
        throw err
      },
    })
    await expect(new SettleGrid().execute.call(ctx)).rejects.toThrow()
  })

  // H2: extractHttpStatus integer+range validation
  it('rejects decimal status codes ("200.5" or 200.5) as non-HTTP', async () => {
    const err = Object.assign(new Error('x'), { httpCode: 200.5 })
    const { ctx } = makeHarness({
      params: invokeToolParams({ args: '{"x":1}' }),
      httpRequestImpl: async () => {
        throw err
      },
    })
    // Decimal → rejected → falls through to generic failure message
    await expect(new SettleGrid().execute.call(ctx)).rejects.toThrowError(
      /SettleGrid API request failed/,
    )
  })

  it('rejects negative status codes', async () => {
    const err = Object.assign(new Error('x'), { httpCode: -1 })
    const { ctx } = makeHarness({
      params: invokeToolParams({ args: '{"x":1}' }),
      httpRequestImpl: async () => {
        throw err
      },
    })
    await expect(new SettleGrid().execute.call(ctx)).rejects.toThrowError(
      /SettleGrid API request failed/,
    )
  })

  it('rejects status 0 (ambiguous / network-error convention)', async () => {
    const err = Object.assign(new Error('x'), { httpCode: 0 })
    const { ctx } = makeHarness({
      params: invokeToolParams({ args: '{"x":1}' }),
      httpRequestImpl: async () => {
        throw err
      },
    })
    await expect(new SettleGrid().execute.call(ctx)).rejects.toThrowError(
      /SettleGrid API request failed/,
    )
  })

  it('rejects status codes below 100 and above 599', async () => {
    for (const bad of [99, 600, 1000]) {
      const err = Object.assign(new Error('x'), { httpCode: bad })
      const { ctx } = makeHarness({
        params: invokeToolParams({ args: '{"x":1}' }),
        httpRequestImpl: async () => {
          throw err
        },
      })
      await expect(new SettleGrid().execute.call(ctx)).rejects.toThrowError(
        /SettleGrid API request failed/,
      )
    }
  })

  // H3: apiKey leak defense. n8n's NodeApiError only surfaces the bits
  // we pass in the 3rd-arg options (message/description/httpCode) in
  // its public JSON form — but the raw error we hand as the 2nd arg
  // is retained internally (and may surface in stderr logs, the n8n
  // executions UI's raw-error view, or error-trigger workflow inputs).
  // Our tests assert the observable no-leak property: the live key
  // string never appears in ANY serialization of the thrown error,
  // regardless of which surface inspects it.
  it('does not leak x-api-key from axios-shaped request/config/response', async () => {
    const err = Object.assign(new Error('Upstream failure'), {
      httpCode: 500,
      config: {
        headers: {
          'x-api-key': 'sg_live_SHOULD_NOT_LEAK',
          Accept: 'application/json',
        },
      },
      request: { headers: { 'x-api-key': 'sg_live_SHOULD_NOT_LEAK' } },
      response: {
        status: 500,
        headers: { 'content-type': 'application/json' },
      },
    })
    const { ctx } = makeHarness({
      params: invokeToolParams({ args: '{"x":1}' }),
      httpRequestImpl: async () => {
        throw err
      },
    })
    try {
      await new SettleGrid().execute.call(ctx)
      expect.fail('should have thrown')
    } catch (e) {
      // Walk every observable surface of the thrown error.
      const surfaces = [
        JSON.stringify(e),
        String(e),
        (e as Error).stack ?? '',
        JSON.stringify(Object.getOwnPropertyNames(e).reduce(
          (acc, key) => ({
            ...acc,
            [key]: (e as Record<string, unknown>)[key],
          }),
          {} as Record<string, unknown>,
        )),
      ]
      for (const surface of surfaces) {
        expect(surface).not.toContain('sg_live_SHOULD_NOT_LEAK')
      }
    }
  })

  it('does not leak Authorization / Cookie headers through any error surface', async () => {
    const err = Object.assign(new Error('x'), {
      httpCode: 500,
      config: {
        headers: {
          Authorization: 'Bearer secret_token_42',
          Cookie: 'session=abc_cookie_secret',
        },
      },
    })
    const { ctx } = makeHarness({
      params: invokeToolParams({ args: '{"x":1}' }),
      httpRequestImpl: async () => {
        throw err
      },
    })
    try {
      await new SettleGrid().execute.call(ctx)
      expect.fail('should have thrown')
    } catch (e) {
      const surfaces = [
        JSON.stringify(e),
        String(e),
        (e as Error).stack ?? '',
      ]
      for (const surface of surfaces) {
        expect(surface).not.toContain('secret_token_42')
        expect(surface).not.toContain('abc_cookie_secret')
      }
    }
  })

  it('sanitization does not mutate the caller\'s error object', async () => {
    const err = Object.assign(new Error('x'), {
      httpCode: 500,
      config: { headers: { 'x-api-key': 'sg_live_sentinel' } },
    })
    const { ctx } = makeHarness({
      params: invokeToolParams({ args: '{"x":1}' }),
      httpRequestImpl: async () => {
        throw err
      },
    })
    await new SettleGrid().execute.call(ctx).catch(() => {})
    // Original error still has the live key — sanitize is copy-on-read.
    expect(
      (err.config as { headers: Record<string, string> }).headers['x-api-key'],
    ).toBe('sg_live_sentinel')
  })

  // H4: method param trimmed
  it('trims whitespace-wrapped method before sending to the proxy', async () => {
    const { ctx, httpRequest } = makeHarness({
      params: invokeToolParams({
        args: '{"q":"hi"}',
        method: '  search  ',
      }),
    })
    await new SettleGrid().execute.call(ctx)
    const req = httpRequest.mock.calls[0][0] as Record<string, unknown>
    expect(req.body).toEqual({ q: 'hi', method: 'search' })
  })

  it('treats whitespace-only method as absent (no override)', async () => {
    const { ctx, httpRequest } = makeHarness({
      params: invokeToolParams({
        args: '{"q":"hi","method":"user-wants"}',
        method: '   ',
      }),
    })
    await new SettleGrid().execute.call(ctx)
    const req = httpRequest.mock.calls[0][0] as Record<string, unknown>
    // User's args.method preserved; empty/whitespace method param
    // does NOT clobber it.
    expect(req.body).toEqual({ q: 'hi', method: 'user-wants' })
  })

  it('method param wins when both args.method and param method are set', async () => {
    const { ctx, httpRequest } = makeHarness({
      params: invokeToolParams({
        args: '{"q":"hi","method":"from-args"}',
        method: 'from-param',
      }),
    })
    await new SettleGrid().execute.call(ctx)
    const req = httpRequest.mock.calls[0][0] as Record<string, unknown>
    expect((req.body as Record<string, unknown>).method).toBe('from-param')
  })

  it('preserves args.method when param method is empty', async () => {
    const { ctx, httpRequest } = makeHarness({
      params: invokeToolParams({
        args: '{"q":"hi","method":"user-pick"}',
        method: '',
      }),
    })
    await new SettleGrid().execute.call(ctx)
    const req = httpRequest.mock.calls[0][0] as Record<string, unknown>
    expect((req.body as Record<string, unknown>).method).toBe('user-pick')
  })
})

describe('SettleGrid node — credential validation (hostile fix)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('throws NodeApiError when credential apiKey is missing', async () => {
    const { ctx, httpRequest } = makeHarness({
      params: invokeToolParams({ args: '{"x":1}' }),
      credentials: { apiKey: '' },
    })
    await expect(new SettleGrid().execute.call(ctx)).rejects.toThrowError(
      /credential is missing an API key/,
    )
    expect(httpRequest).not.toHaveBeenCalled()
  })

  it('throws NodeApiError when credential apiKey is whitespace-only', async () => {
    const { ctx, httpRequest } = makeHarness({
      params: invokeToolParams({ args: '{"x":1}' }),
      credentials: { apiKey: '   ' },
    })
    await expect(new SettleGrid().execute.call(ctx)).rejects.toThrowError(
      /credential is missing an API key/,
    )
    expect(httpRequest).not.toHaveBeenCalled()
  })

  it('throws NodeApiError when credential apiKey is non-string (object)', async () => {
    const { ctx, httpRequest } = makeHarness({
      params: invokeToolParams({ args: '{"x":1}' }),
      credentials: { apiKey: { nested: 'x' } as unknown as string },
    })
    await expect(new SettleGrid().execute.call(ctx)).rejects.toThrowError(
      /credential is missing an API key/,
    )
    expect(httpRequest).not.toHaveBeenCalled()
  })

  it('trims whitespace on credential apiKey before forwarding', async () => {
    const { ctx, httpRequest } = makeHarness({
      params: invokeToolParams({ args: '{"x":1}' }),
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
      params: invokeToolParams({ args: '{"x":1}' }),
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
      params: invokeToolParams({ args: '{"x":1}' }),
      inputs: [{ json: {} }, { json: {} }],
    })
    await new SettleGrid().execute.call(ctx)
    expect(getCredentials).toHaveBeenCalledTimes(1)
    expect(getCredentials).toHaveBeenCalledWith('settleGridApi')
  })

  it('forwards the apiKey from credentials as the x-api-key header verbatim', async () => {
    const { ctx, httpRequest } = makeHarness({
      params: invokeToolParams({ args: '{"x":1}' }),
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
      params: invokeToolParams({ args: '{"x":1}' }),
      credentials: { apiKey: 'sg_live_x' },
    })
    await new SettleGrid().execute.call(ctx)
    const req = httpRequest.mock.calls[0][0] as Record<string, unknown>
    expect((req.url as string).startsWith('https://settlegrid.ai/')).toBe(true)
  })
})
