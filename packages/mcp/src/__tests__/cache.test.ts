import { describe, it, expect, beforeEach, vi } from 'vitest'
import { LRUCache } from '../cache'

describe('LRUCache', () => {
  let cache: LRUCache

  beforeEach(() => {
    cache = new LRUCache(3, 60000)
  })

  it('stores and retrieves values', () => {
    cache.set('key1', {
      valid: true,
      consumerId: 'c1',
      toolId: 't1',
      keyId: 'k1',
      balanceCents: 1000,
    })
    const result = cache.get('key1')
    expect(result).toBeDefined()
    expect(result!.consumerId).toBe('c1')
    expect(result!.balanceCents).toBe(1000)
  })

  it('returns undefined for missing keys', () => {
    expect(cache.get('nonexistent')).toBeUndefined()
  })

  it('evicts oldest entry when at capacity', () => {
    cache.set('key1', { valid: true, consumerId: 'c1', toolId: 't1', keyId: 'k1', balanceCents: 100 })
    cache.set('key2', { valid: true, consumerId: 'c2', toolId: 't2', keyId: 'k2', balanceCents: 200 })
    cache.set('key3', { valid: true, consumerId: 'c3', toolId: 't3', keyId: 'k3', balanceCents: 300 })
    // At capacity (3), adding key4 should evict key1
    cache.set('key4', { valid: true, consumerId: 'c4', toolId: 't4', keyId: 'k4', balanceCents: 400 })

    expect(cache.get('key1')).toBeUndefined()
    expect(cache.get('key2')).toBeDefined()
    expect(cache.get('key4')).toBeDefined()
    expect(cache.size).toBe(3)
  })

  it('refreshes position on get (LRU behavior)', () => {
    cache.set('key1', { valid: true, consumerId: 'c1', toolId: 't1', keyId: 'k1', balanceCents: 100 })
    cache.set('key2', { valid: true, consumerId: 'c2', toolId: 't2', keyId: 'k2', balanceCents: 200 })
    cache.set('key3', { valid: true, consumerId: 'c3', toolId: 't3', keyId: 'k3', balanceCents: 300 })

    // Access key1 to refresh it
    cache.get('key1')
    // key2 is now the oldest
    cache.set('key4', { valid: true, consumerId: 'c4', toolId: 't4', keyId: 'k4', balanceCents: 400 })

    expect(cache.get('key1')).toBeDefined()
    expect(cache.get('key2')).toBeUndefined() // evicted
    expect(cache.get('key3')).toBeDefined()
  })

  it('expires entries after TTL', () => {
    vi.useFakeTimers()
    const shortCache = new LRUCache(10, 1000) // 1 second TTL

    shortCache.set('key1', { valid: true, consumerId: 'c1', toolId: 't1', keyId: 'k1', balanceCents: 100 })
    expect(shortCache.get('key1')).toBeDefined()

    vi.advanceTimersByTime(1500)
    expect(shortCache.get('key1')).toBeUndefined()

    vi.useRealTimers()
  })

  it('invalidates specific keys', () => {
    cache.set('key1', { valid: true, consumerId: 'c1', toolId: 't1', keyId: 'k1', balanceCents: 100 })
    cache.invalidate('key1')
    expect(cache.get('key1')).toBeUndefined()
  })

  it('clears all entries', () => {
    cache.set('key1', { valid: true, consumerId: 'c1', toolId: 't1', keyId: 'k1', balanceCents: 100 })
    cache.set('key2', { valid: true, consumerId: 'c2', toolId: 't2', keyId: 'k2', balanceCents: 200 })
    cache.clear()
    expect(cache.size).toBe(0)
    expect(cache.get('key1')).toBeUndefined()
  })

  it('prunes expired entries', () => {
    vi.useFakeTimers()
    const prunableCache = new LRUCache(10, 500)

    prunableCache.set('key1', { valid: true, consumerId: 'c1', toolId: 't1', keyId: 'k1', balanceCents: 100 })
    vi.advanceTimersByTime(300)
    prunableCache.set('key2', { valid: true, consumerId: 'c2', toolId: 't2', keyId: 'k2', balanceCents: 200 })
    vi.advanceTimersByTime(300) // key1 expired, key2 still valid

    const pruned = prunableCache.prune()
    expect(pruned).toBe(1)
    expect(prunableCache.get('key1')).toBeUndefined()
    expect(prunableCache.get('key2')).toBeDefined()

    vi.useRealTimers()
  })

  it('reports correct size', () => {
    expect(cache.size).toBe(0)
    cache.set('key1', { valid: true, consumerId: 'c1', toolId: 't1', keyId: 'k1', balanceCents: 100 })
    expect(cache.size).toBe(1)
    cache.set('key2', { valid: true, consumerId: 'c2', toolId: 't2', keyId: 'k2', balanceCents: 200 })
    expect(cache.size).toBe(2)
  })
})
