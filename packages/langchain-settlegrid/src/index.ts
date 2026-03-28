import { SettleGridTool } from './tool'
import type { SettleGridToolConfig, SettleGridToolResult } from './tool'

export { SettleGridTool }
export type { SettleGridToolConfig, SettleGridToolResult }

/* -------------------------------------------------------------------------- */
/*  Types                                                                      */
/* -------------------------------------------------------------------------- */

export interface SettleGridToolkitOptions {
  /** SettleGrid API key (consumer key for the tools you want to use) */
  apiKey: string
  /** Base URL for the SettleGrid API. Default: https://settlegrid.ai */
  baseUrl?: string
}

/** Shape of a single tool returned by the SettleGrid Discovery API */
interface DiscoveredTool {
  name: string
  slug: string
  description: string
  category: string
  tags: string[] | null
  version: string | null
  pricing: unknown
  costCents: number | null
  invocations: number
  verified: boolean
  averageRating: number
  developer: string
  developerSlug: string | null
  url: string
  developerUrl: string | null
}

/** Shape of the Discovery API response */
interface DiscoverResponse {
  ok: boolean
  data: {
    tools: DiscoveredTool[]
    total: number
    limit: number
    offset: number
    hasMore: boolean
  }
}

/* -------------------------------------------------------------------------- */
/*  SettleGridToolkit                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Discovers SettleGrid tools and returns them as LangChain `Tool` instances.
 *
 * Usage:
 * ```ts
 * import { SettleGridToolkit } from 'langchain-settlegrid'
 *
 * const toolkit = new SettleGridToolkit({ apiKey: 'sg_...' })
 * const tools = await toolkit.discoverTools('weather')
 * // Pass `tools` to any LangChain agent
 * ```
 */
export class SettleGridToolkit {
  private apiKey: string
  private baseUrl: string

  constructor(options: SettleGridToolkitOptions) {
    if (!options.apiKey) {
      throw new Error('SettleGridToolkit requires an apiKey')
    }
    this.apiKey = options.apiKey
    this.baseUrl = (options.baseUrl ?? 'https://settlegrid.ai').replace(
      /\/$/,
      ''
    )
  }

  /**
   * Discover tools from the SettleGrid marketplace and return them as
   * LangChain Tool instances ready for use in agents.
   *
   * @param query  - Optional search query (name, description, or slug)
   * @param category - Optional category filter (e.g., "data", "nlp", "code")
   * @param limit  - Max tools to return (1-100, default 20)
   */
  async discoverTools(
    query?: string,
    category?: string,
    limit = 20
  ): Promise<SettleGridTool[]> {
    const params = new URLSearchParams()
    if (query) params.set('q', query)
    if (category) params.set('category', category)
    params.set('limit', String(Math.min(Math.max(limit, 1), 100)))

    const url = `${this.baseUrl}/api/v1/discover?${params.toString()}`

    const response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(
        `SettleGrid discovery failed (${response.status}): ${errorText}`
      )
    }

    const json = (await response.json()) as DiscoverResponse

    if (!json.ok || !json.data?.tools) {
      throw new Error('Unexpected response from SettleGrid Discovery API')
    }

    return json.data.tools.map(
      (tool) =>
        new SettleGridTool({
          slug: tool.slug,
          name: tool.name,
          description: tool.description,
          costCents: tool.costCents,
          apiKey: this.apiKey,
          baseUrl: this.baseUrl,
        })
    )
  }

  /**
   * Create a SettleGridTool directly from a known slug, without calling the
   * Discovery API. Useful when you already know which tool you want.
   */
  createTool(
    slug: string,
    description: string,
    costCents: number | null = null
  ): SettleGridTool {
    return new SettleGridTool({
      slug,
      name: slug,
      description,
      costCents,
      apiKey: this.apiKey,
      baseUrl: this.baseUrl,
    })
  }
}
