import { Tool } from '@langchain/core/tools'

/* -------------------------------------------------------------------------- */
/*  Types                                                                      */
/* -------------------------------------------------------------------------- */

export interface SettleGridToolConfig {
  /** Tool slug (used as the proxy endpoint path segment) */
  slug: string
  /** Human-readable tool name */
  name: string
  /** Tool description surfaced to the LLM */
  description: string
  /** Cost per invocation in cents (informational) */
  costCents: number | null
  /** SettleGrid API key */
  apiKey: string
  /** Base URL for SettleGrid API (default: https://settlegrid.ai) */
  baseUrl: string
}

export interface SettleGridToolResult {
  /** The upstream response body */
  output: string
  /** Cost charged for this invocation in cents */
  costCents: number
  /** Round-trip latency through the SettleGrid proxy in ms */
  latencyMs: number
}

/* -------------------------------------------------------------------------- */
/*  SettleGridTool                                                             */
/* -------------------------------------------------------------------------- */

/**
 * A LangChain Tool that proxies calls through SettleGrid's billing proxy.
 *
 * Each instance wraps a single SettleGrid tool. The `_call` method sends the
 * agent's input to `/api/proxy/{slug}` with the consumer's API key, and
 * returns the upstream response. Cost and latency metadata are available in
 * the `lastInvocationMeta` property after each call.
 */
export class SettleGridTool extends Tool {
  name: string
  description: string

  private slug: string
  private apiKey: string
  private baseUrl: string
  private _costCents: number | null

  /** Metadata from the most recent invocation (cost + latency) */
  lastInvocationMeta: { costCents: number; latencyMs: number } | null = null

  constructor(config: SettleGridToolConfig) {
    super()
    this.slug = config.slug
    this.name = config.slug
    this.description = config.description
    this.apiKey = config.apiKey
    this.baseUrl = config.baseUrl
    this._costCents = config.costCents
  }

  /** Informational: the expected cost per call in cents */
  get costCents(): number | null {
    return this._costCents
  }

  /** @internal */
  async _call(input: string): Promise<string> {
    const url = `${this.baseUrl}/api/proxy/${encodeURIComponent(this.slug)}`

    // Try to parse input as JSON for structured requests; fall back to
    // sending as a plain text body if it is not valid JSON.
    let body: string
    let contentType: string
    try {
      JSON.parse(input)
      body = input
      contentType = 'application/json'
    } catch {
      body = JSON.stringify({ input })
      contentType = 'application/json'
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': contentType,
        'x-api-key': this.apiKey,
        Accept: 'application/json',
      },
      body,
    })

    const costHeader = response.headers.get('x-settlegrid-cost-cents')
    const latencyHeader = response.headers.get('x-settlegrid-latency-ms')

    this.lastInvocationMeta = {
      costCents: costHeader ? Number(costHeader) : 0,
      latencyMs: latencyHeader ? Number(latencyHeader) : 0,
    }

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(
        `SettleGrid proxy error (${response.status}): ${errorText}`
      )
    }

    return response.text()
  }
}
