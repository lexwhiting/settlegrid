export interface ShadowRecord {
  source: string
  owner: string
  repo: string
  name: string
  description?: string
  category?: string
  tags?: string[]
  stars?: number
  downloads?: number
  lastUpdated?: Date
  sourceUrl?: string
}

export interface SourceModule {
  name: string
  fetch: (opts: FetchOptions) => AsyncIterable<ShadowRecord>
}

export interface FetchOptions {
  limit?: number
  signal?: AbortSignal
}
