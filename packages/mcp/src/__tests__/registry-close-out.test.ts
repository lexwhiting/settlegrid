/**
 * Test close-out for P1.K1: coverage for ProtocolRegistry code paths
 * that were NOT exercised by the copied protocol-adapters tests.
 *
 * Gaps closed:
 *   - register() throws when a duplicate adapter name is registered
 *   - clear() empties the registry and lets prior adapters be re-registered
 *   - detect() returns undefined when no adapter matches the request
 *   - get() / has() return undefined / false for unknown protocol names
 *
 * The existing protocol-adapters.test.ts covers the happy-path registry
 * methods (register/get/has/list/detect with a populated priority list)
 * but never exercises the error/empty branches. A future refactor could
 * silently break those branches without the main test suite noticing.
 * These tests are intentionally the only close-out additions in a
 * dedicated file — keeping them separate from the copied
 * protocol-adapters.test.ts makes the provenance of each test explicit:
 * the copied file stays byte-close to its apps/web source, close-out
 * additions live here.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { ProtocolRegistry } from '../adapters/index'
// Individual adapter classes are imported from their per-protocol files
// because the adapters/index.ts module does NOT re-export them — it
// only re-exports the ProtocolRegistry class, DETECTION_PRIORITY const,
// and the auto-registered protocolRegistry singleton. Importing each
// class from its own file is the same pattern used by the copied
// protocol-adapters.test.ts.
import { MCPAdapter } from '../adapters/mcp'
import { X402Adapter } from '../adapters/x402'

describe('ProtocolRegistry — close-out coverage (P1.K1)', () => {
  let registry: ProtocolRegistry

  beforeEach(() => {
    registry = new ProtocolRegistry()
  })

  describe('register() duplicate detection', () => {
    it('throws when the same adapter instance is registered twice', () => {
      const mcp = new MCPAdapter()
      registry.register(mcp)
      expect(() => registry.register(mcp)).toThrow(
        /Adapter already registered for protocol: mcp/,
      )
    })

    it('throws when a second instance with the same name is registered', () => {
      registry.register(new MCPAdapter())
      // Second instance, same `name` field → should collide
      expect(() => registry.register(new MCPAdapter())).toThrow(
        /Adapter already registered for protocol: mcp/,
      )
    })

    it('duplicate-register throw does not mutate the existing entry', () => {
      const first = new MCPAdapter()
      registry.register(first)
      try {
        registry.register(new MCPAdapter())
      } catch {
        // swallow the expected throw
      }
      // The original instance is still what `.get()` returns
      expect(registry.get('mcp')).toBe(first)
      // And the list still has exactly one entry
      expect(registry.list()).toHaveLength(1)
    })

    it('different-named adapters coexist without collision', () => {
      registry.register(new MCPAdapter())
      // X402Adapter has name 'x402' — distinct from 'mcp', so no throw
      expect(() => registry.register(new X402Adapter())).not.toThrow()
      expect(registry.has('mcp')).toBe(true)
      expect(registry.has('x402')).toBe(true)
      expect(registry.list()).toHaveLength(2)
    })
  })

  describe('clear()', () => {
    it('empties the registry', () => {
      registry.register(new MCPAdapter())
      registry.register(new X402Adapter())
      expect(registry.list()).toHaveLength(2)
      registry.clear()
      expect(registry.list()).toHaveLength(0)
    })

    it('is idempotent on an empty registry', () => {
      // Fresh registry starts empty; clear() on empty should not throw
      expect(registry.list()).toHaveLength(0)
      expect(() => registry.clear()).not.toThrow()
      expect(registry.list()).toHaveLength(0)
    })

    it('lets previously-registered adapters be re-registered after clear', () => {
      const mcp = new MCPAdapter()
      registry.register(mcp)
      registry.clear()
      // After clear, registering the same name no longer collides
      expect(() => registry.register(new MCPAdapter())).not.toThrow()
      expect(registry.has('mcp')).toBe(true)
    })

    it('makes has() return false for previously-registered adapters', () => {
      registry.register(new MCPAdapter())
      registry.register(new X402Adapter())
      expect(registry.has('mcp')).toBe(true)
      expect(registry.has('x402')).toBe(true)
      registry.clear()
      expect(registry.has('mcp')).toBe(false)
      expect(registry.has('x402')).toBe(false)
    })

    it('makes get() return undefined for previously-registered adapters', () => {
      registry.register(new MCPAdapter())
      expect(registry.get('mcp')).toBeDefined()
      registry.clear()
      expect(registry.get('mcp')).toBeUndefined()
    })
  })

  describe('empty-registry lookups', () => {
    it('has() returns false for any name on an empty registry', () => {
      expect(registry.has('mcp')).toBe(false)
      expect(registry.has('x402')).toBe(false)
      expect(registry.has('ap2')).toBe(false)
      expect(registry.has('visa-tap')).toBe(false)
      expect(registry.has('mpp')).toBe(false)
      expect(registry.has('ucp')).toBe(false)
      expect(registry.has('acp')).toBe(false)
      expect(registry.has('mastercard-vi')).toBe(false)
      expect(registry.has('circle-nano')).toBe(false)
    })

    it('get() returns undefined for any name on an empty registry', () => {
      expect(registry.get('mcp')).toBeUndefined()
      expect(registry.get('x402')).toBeUndefined()
    })

    it('list() returns an empty array on an empty registry', () => {
      const list = registry.list()
      expect(Array.isArray(list)).toBe(true)
      expect(list).toHaveLength(0)
    })

    it('detect() returns undefined when no adapter is registered', () => {
      const req = new Request('http://localhost', {
        headers: { 'x-api-key': 'sg_live_abc' },
      })
      expect(registry.detect(req)).toBeUndefined()
    })

    it('detect() returns undefined when the registered adapter cannot handle the request', () => {
      registry.register(new MCPAdapter())
      // This request has no API key, no Bearer token → MCPAdapter.canHandle returns false
      const req = new Request('http://localhost/some/path')
      expect(registry.detect(req)).toBeUndefined()
    })
  })

  describe('detectionPriority getter', () => {
    it('returns a readonly array of the 9 protocol names in priority order', () => {
      const priority = registry.detectionPriority
      expect(priority).toHaveLength(9)
      // First is mpp (most specific), last is mcp (fallback)
      expect(priority[0]).toBe('mpp')
      expect(priority[8]).toBe('mcp')
    })

    it('reflects the module-level DETECTION_PRIORITY constant', () => {
      // The getter returns the same array referenced by DETECTION_PRIORITY
      // in the module. Two fresh registry instances return arrays with
      // identical contents.
      const r1 = new ProtocolRegistry()
      const r2 = new ProtocolRegistry()
      expect(r1.detectionPriority).toEqual(r2.detectionPriority)
    })
  })
})
