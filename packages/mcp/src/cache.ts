/**
 * @settlegrid/mcp - LRU Cache for key validation
 * In-memory cache with TTL to reduce API calls for key validation.
 */

import type { KeyValidationResult } from './types'

interface CacheEntry {
  value: KeyValidationResult
  expiresAt: number
}

export class LRUCache {
  private readonly maxSize: number
  private readonly ttlMs: number
  private readonly cache: Map<string, CacheEntry>

  constructor(maxSize: number = 1000, ttlMs: number = 5 * 60 * 1000) {
    this.maxSize = maxSize
    this.ttlMs = ttlMs
    this.cache = new Map()
  }

  /** Get a cached validation result, or undefined if not found/expired */
  get(key: string): KeyValidationResult | undefined {
    const entry = this.cache.get(key)
    if (!entry) return undefined

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key)
      return undefined
    }

    // Move to end (most recently used) by re-inserting
    this.cache.delete(key)
    this.cache.set(key, entry)
    return entry.value
  }

  /** Cache a validation result */
  set(key: string, value: KeyValidationResult): void {
    // Delete first to update insertion order
    this.cache.delete(key)

    // Evict oldest if at capacity
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value
      if (oldestKey !== undefined) {
        this.cache.delete(oldestKey)
      }
    }

    this.cache.set(key, {
      value,
      expiresAt: Date.now() + this.ttlMs,
    })
  }

  /** Invalidate a specific key */
  invalidate(key: string): void {
    this.cache.delete(key)
  }

  /** Clear the entire cache */
  clear(): void {
    this.cache.clear()
  }

  /** Get current cache size */
  get size(): number {
    return this.cache.size
  }

  /** Remove all expired entries */
  prune(): number {
    const now = Date.now()
    let pruned = 0
    for (const [key, entry] of this.cache) {
      if (now > entry.expiresAt) {
        this.cache.delete(key)
        pruned++
      }
    }
    return pruned
  }
}
