import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { LRUCache } from '../cache'
import type { KeyValidationResult } from '../types'

function makeResult(overrides: Partial<KeyValidationResult> = {}): KeyValidationResult {
  return {
    valid: true,
    consumerId: 'con-1',
    toolId: 'tool-1',
    keyId: 'key-1',
    balanceCents: 5000,
    ...overrides,
  }
}

describe('LRUCache constructor', () => {
  it('creates cache with default maxSize 1000', () => {
    const cache = new LRUCache()
    expect(cache.size).toBe(0)
  })

  it('creates cache with custom maxSize', () => {
    const cache = new LRUCache(5)
    expect(cache.size).toBe(0)
  })

  it('creates cache with custom TTL', () => {
    const cache = new LRUCache(100, 1000)
    expect(cache.size).toBe(0)
  })
})

describe('LRUCache set and get', () => {
  let cache: LRUCache

  beforeEach(() => {
    cache = new LRUCache(100, 60000) // 1 minute TTL
  })

  it('stores and retrieves a value', () => {
    const result = makeResult()
    cache.set('key1', result)
    expect(cache.get('key1')).toEqual(result)
  })

  it('returns undefined for missing key', () => {
    expect(cache.get('nonexistent')).toBeUndefined()
  })

  it('increments size on set', () => {
    cache.set('a', makeResult())
    expect(cache.size).toBe(1)
    cache.set('b', makeResult())
    expect(cache.size).toBe(2)
  })

  it('overwrites existing key without incrementing size', () => {
    cache.set('a', makeResult({ balanceCents: 100 }))
    cache.set('a', makeResult({ balanceCents: 200 }))
    expect(cache.size).toBe(1)
    expect(cache.get('a')?.balanceCents).toBe(200)
  })

  it('stores different values for different keys', () => {
    cache.set('k1', makeResult({ consumerId: 'c1' }))
    cache.set('k2', makeResult({ consumerId: 'c2' }))
    expect(cache.get('k1')?.consumerId).toBe('c1')
    expect(cache.get('k2')?.consumerId).toBe('c2')
  })
})

describe('LRUCache eviction', () => {
  it('evicts oldest entry when at capacity', () => {
    const cache = new LRUCache(3, 60000)
    cache.set('a', makeResult({ consumerId: 'a' }))
    cache.set('b', makeResult({ consumerId: 'b' }))
    cache.set('c', makeResult({ consumerId: 'c' }))
    // At capacity, adding d should evict a
    cache.set('d', makeResult({ consumerId: 'd' }))

    expect(cache.get('a')).toBeUndefined()
    expect(cache.get('b')).toBeDefined()
    expect(cache.get('c')).toBeDefined()
    expect(cache.get('d')).toBeDefined()
    expect(cache.size).toBe(3)
  })

  it('accessing a key moves it to most recently used', () => {
    const cache = new LRUCache(3, 60000)
    cache.set('a', makeResult({ consumerId: 'a' }))
    cache.set('b', makeResult({ consumerId: 'b' }))
    cache.set('c', makeResult({ consumerId: 'c' }))

    // Access 'a' to make it most recently used
    cache.get('a')

    // Now adding 'd' should evict 'b' (oldest after 'a' was accessed)
    cache.set('d', makeResult({ consumerId: 'd' }))
    expect(cache.get('a')).toBeDefined()
    expect(cache.get('b')).toBeUndefined()
    expect(cache.get('d')).toBeDefined()
  })

  it('handles maxSize of 1', () => {
    const cache = new LRUCache(1, 60000)
    cache.set('a', makeResult({ consumerId: 'a' }))
    expect(cache.get('a')?.consumerId).toBe('a')

    cache.set('b', makeResult({ consumerId: 'b' }))
    expect(cache.get('a')).toBeUndefined()
    expect(cache.get('b')?.consumerId).toBe('b')
    expect(cache.size).toBe(1)
  })
})

describe('LRUCache TTL expiration', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns value within TTL', () => {
    const cache = new LRUCache(100, 5000) // 5s TTL
    cache.set('key', makeResult())

    vi.advanceTimersByTime(4999)
    expect(cache.get('key')).toBeDefined()
  })

  it('returns undefined after TTL expires', () => {
    const cache = new LRUCache(100, 5000)
    cache.set('key', makeResult())

    vi.advanceTimersByTime(5001)
    expect(cache.get('key')).toBeUndefined()
  })

  it('deletes expired entry on access', () => {
    const cache = new LRUCache(100, 1000)
    cache.set('key', makeResult())
    expect(cache.size).toBe(1)

    vi.advanceTimersByTime(1001)
    cache.get('key') // triggers deletion
    expect(cache.size).toBe(0)
  })
})

describe('LRUCache invalidate', () => {
  it('removes a specific key', () => {
    const cache = new LRUCache(100, 60000)
    cache.set('a', makeResult())
    cache.set('b', makeResult())
    cache.invalidate('a')
    expect(cache.get('a')).toBeUndefined()
    expect(cache.get('b')).toBeDefined()
    expect(cache.size).toBe(1)
  })

  it('does nothing for non-existent key', () => {
    const cache = new LRUCache()
    cache.set('a', makeResult())
    cache.invalidate('nonexistent')
    expect(cache.size).toBe(1)
  })
})

describe('LRUCache clear', () => {
  it('removes all entries', () => {
    const cache = new LRUCache()
    cache.set('a', makeResult())
    cache.set('b', makeResult())
    cache.set('c', makeResult())
    cache.clear()
    expect(cache.size).toBe(0)
    expect(cache.get('a')).toBeUndefined()
    expect(cache.get('b')).toBeUndefined()
    expect(cache.get('c')).toBeUndefined()
  })

  it('is safe to call on empty cache', () => {
    const cache = new LRUCache()
    cache.clear()
    expect(cache.size).toBe(0)
  })
})

describe('LRUCache prune', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('removes all expired entries', () => {
    const cache = new LRUCache(100, 1000)
    cache.set('a', makeResult())
    cache.set('b', makeResult())

    vi.advanceTimersByTime(500)
    cache.set('c', makeResult()) // not expired yet

    vi.advanceTimersByTime(600) // a,b expired, c still valid

    const pruned = cache.prune()
    expect(pruned).toBe(2)
    expect(cache.size).toBe(1)
    expect(cache.get('c')).toBeDefined()
  })

  it('returns 0 when nothing to prune', () => {
    const cache = new LRUCache(100, 60000)
    cache.set('a', makeResult())
    const pruned = cache.prune()
    expect(pruned).toBe(0)
  })

  it('returns 0 on empty cache', () => {
    const cache = new LRUCache()
    const pruned = cache.prune()
    expect(pruned).toBe(0)
  })
})

describe('LRUCache size', () => {
  it('reflects current entry count', () => {
    const cache = new LRUCache()
    expect(cache.size).toBe(0)
    cache.set('a', makeResult())
    expect(cache.size).toBe(1)
    cache.set('b', makeResult())
    expect(cache.size).toBe(2)
    cache.invalidate('a')
    expect(cache.size).toBe(1)
    cache.clear()
    expect(cache.size).toBe(0)
  })
})
