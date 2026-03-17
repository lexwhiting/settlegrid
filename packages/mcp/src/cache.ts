/**
 * @settlegrid/mcp - LRU Cache for key validation
 *
 * In-memory Least-Recently-Used cache with TTL-based expiration.
 * Reduces API calls for repeated key validation within the TTL window.
 *
 * @packageDocumentation
 */

import type { KeyValidationResult } from './types'

interface CacheEntry {
  value: KeyValidationResult
  expiresAt: number
}

/**
 * LRU (Least-Recently-Used) cache with TTL expiration for key validation results.
 *
 * Used internally by the SDK to avoid redundant API calls when the same key
 * is validated multiple times within the TTL window.
 *
 * @example
 * ```typescript
 * const cache = new LRUCache(1000, 300000) // 1000 entries, 5 min TTL
 * cache.set('sg_live_abc', validationResult)
 * const cached = cache.get('sg_live_abc') // returns result or undefined
 * ```
 */
export class LRUCache {
  private readonly maxSize: number
  private readonly ttlMs: number
  private readonly cache: Map<string, CacheEntry>

  /**
   * Create a new LRU cache.
   *
   * @param maxSize - Maximum number of entries before LRU eviction (default: 1000)
   * @param ttlMs - Time-to-live in milliseconds for cache entries (default: 300000 / 5 minutes)
   */
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
