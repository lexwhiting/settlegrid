/**
 * P4.6 — build-outreach-batch.ts script tests.
 *
 * The fetchers + main loop exercise live APIs (GitHub + Anthropic
 * + DB). Those paths are exercised by the founder when they run
 * the script for real. This test file covers only the pure logic
 * that doesn't require network: argument parsing.
 */
import { afterEach, beforeEach, describe, it, expect } from 'vitest'
import {
  GithubRateLimitError,
  getAwesomeMcpLists,
  loadRenderConfigFromEnv,
  parseArgs,
  parsePositiveInt,
} from './build-outreach-batch'

describe('parseArgs', () => {
  it('returns defaults when no args', () => {
    const args = parseArgs([])
    expect(args.dryRun).toBe(false)
    expect(args.noCache).toBe(false)
    expect(args.skipPersonalize).toBe(false)
    expect(args.totalLimit).toBe(100)
    expect(args.tierLimits).toEqual({ hot: 30, warm: 30, cold: 40 })
  })
  it('parses --dry-run', () => {
    expect(parseArgs(['--dry-run']).dryRun).toBe(true)
  })
  it('parses --no-cache', () => {
    expect(parseArgs(['--no-cache']).noCache).toBe(true)
  })
  it('parses --skip-personalize', () => {
    expect(parseArgs(['--skip-personalize']).skipPersonalize).toBe(true)
  })
  it('parses --limit N', () => {
    expect(parseArgs(['--limit', '50']).totalLimit).toBe(50)
  })
  it('parses --hot-limit / --warm-limit / --cold-limit', () => {
    const args = parseArgs([
      '--hot-limit',
      '10',
      '--warm-limit',
      '20',
      '--cold-limit',
      '30',
    ])
    expect(args.tierLimits).toEqual({ hot: 10, warm: 20, cold: 30 })
  })
  it('handles multiple flags together', () => {
    const args = parseArgs([
      '--dry-run',
      '--no-cache',
      '--limit',
      '5',
      '--hot-limit',
      '2',
    ])
    expect(args.dryRun).toBe(true)
    expect(args.noCache).toBe(true)
    expect(args.totalLimit).toBe(5)
    expect(args.tierLimits.hot).toBe(2)
  })
  it('parses --out <path> (HC26 PII guard)', () => {
    const args = parseArgs(['--out', '/tmp/foo.md'])
    expect(args.outPath).toBe('/tmp/foo.md')
  })
  it('defaults outPath to null', () => {
    expect(parseArgs([]).outPath).toBeNull()
  })
  it('throws on non-numeric --limit (HC21 NaN guard)', () => {
    expect(() => parseArgs(['--limit', 'foo'])).toThrow(/--limit/)
  })
  it('throws on negative --limit (HC21)', () => {
    expect(() => parseArgs(['--limit', '-5'])).toThrow(/--limit/)
  })
  it('throws on zero --limit (HC21)', () => {
    expect(() => parseArgs(['--limit', '0'])).toThrow(/--limit/)
  })
  it('throws on float --limit (HC21 — stricter; matches operator intent)', () => {
    expect(() => parseArgs(['--limit', '1.5'])).toThrow(/--limit/)
  })
  it('throws on non-numeric --hot-limit (HC21)', () => {
    expect(() => parseArgs(['--hot-limit', 'NaN'])).toThrow(/--hot-limit/)
  })
})

describe('parsePositiveInt', () => {
  it('parses a positive integer', () => {
    expect(parsePositiveInt('42', '--limit')).toBe(42)
  })
  it('throws on empty string', () => {
    expect(() => parsePositiveInt('', '--limit')).toThrow(/--limit/)
  })
  it('throws on whitespace-only', () => {
    expect(() => parsePositiveInt('   ', '--limit')).toThrow(/--limit/)
  })
  it('throws on numeric-prefixed garbage like "12foo"', () => {
    // parseInt would happily return 12; we want strict matching.
    expect(() => parsePositiveInt('12foo', '--limit')).toThrow(/--limit/)
  })
})

describe('getAwesomeMcpLists', () => {
  let originalValue: string | undefined
  beforeEach(() => {
    originalValue = process.env.AWESOME_MCP_LISTS
    delete process.env.AWESOME_MCP_LISTS
  })
  afterEach(() => {
    if (originalValue === undefined) {
      delete process.env.AWESOME_MCP_LISTS
    } else {
      process.env.AWESOME_MCP_LISTS = originalValue
    }
  })

  it('returns the default canonical list when env var is unset', () => {
    expect(getAwesomeMcpLists()).toEqual(['punkpeye/awesome-mcp-servers'])
  })
  it('returns the default when env var is empty string', () => {
    process.env.AWESOME_MCP_LISTS = ''
    expect(getAwesomeMcpLists()).toEqual(['punkpeye/awesome-mcp-servers'])
  })
  it('returns the default when env var is whitespace only', () => {
    process.env.AWESOME_MCP_LISTS = '   '
    expect(getAwesomeMcpLists()).toEqual(['punkpeye/awesome-mcp-servers'])
  })
  it('parses a comma-separated list of owner/repo pairs', () => {
    process.env.AWESOME_MCP_LISTS = 'a/b,c/d,e/f'
    expect(getAwesomeMcpLists()).toEqual(['a/b', 'c/d', 'e/f'])
  })
  it('trims whitespace around entries', () => {
    process.env.AWESOME_MCP_LISTS = ' a/b , c/d  '
    expect(getAwesomeMcpLists()).toEqual(['a/b', 'c/d'])
  })
  it('rejects malformed entries (no slash, multiple slashes, spaces)', () => {
    process.env.AWESOME_MCP_LISTS = 'valid/repo,nosplit,too/many/slashes,has space/repo'
    expect(getAwesomeMcpLists()).toEqual(['valid/repo'])
  })
  it('returns an empty array when every entry is malformed (operator typo)', () => {
    process.env.AWESOME_MCP_LISTS = 'just-a-name,another'
    // Empty array means warm tier produces zero targets — surfaces
    // the misconfiguration in the per-tier counts log.
    expect(getAwesomeMcpLists()).toEqual([])
  })
})

describe('GithubRateLimitError', () => {
  it('formats the reset time when provided', () => {
    // Unix epoch second 1700000000 = 2023-11-14T22:13:20.000Z
    const err = new GithubRateLimitError(1700000000)
    expect(err.name).toBe('GithubRateLimitError')
    expect(err.message).toContain('exhausted')
    expect(err.message).toContain('2023-11-14T22:13:20.000Z')
    expect(err.resetAt).toBe(1700000000)
  })
  it('omits the reset time when null', () => {
    const err = new GithubRateLimitError(null)
    expect(err.message).toContain('exhausted')
    expect(err.message).not.toContain('resets at')
    expect(err.resetAt).toBeNull()
  })
  it('is an instance of Error (so try/catch works)', () => {
    const err = new GithubRateLimitError(0)
    expect(err).toBeInstanceOf(Error)
  })
})

describe('loadRenderConfigFromEnv', () => {
  // Snapshot every env var we read, restore in afterEach. Uses the
  // existing `assertCanSpamConfig` from render.ts — exercising the
  // happy path here closes the integration loop between env-loading
  // and the renderer's CAN-SPAM checks.
  const KEYS = [
    'FOUNDER_NAME',
    'FOUNDER_ROLE',
    'COMPANY_NAME',
    'PHYSICAL_ADDRESS',
    'BLOG_URL',
    'GALLERY_URL',
    'UNSUBSCRIBE_URL',
  ] as const
  let snapshot: Partial<Record<(typeof KEYS)[number], string | undefined>> = {}

  beforeEach(() => {
    snapshot = {}
    for (const k of KEYS) {
      snapshot[k] = process.env[k]
      delete process.env[k]
    }
    process.env.FOUNDER_NAME = 'Lex'
    process.env.FOUNDER_ROLE = 'Founder'
    process.env.COMPANY_NAME = 'SettleGrid (Alerterra, LLC)'
    process.env.PHYSICAL_ADDRESS = '123 Example St, San Francisco, CA 94110'
    process.env.BLOG_URL = 'https://settlegrid.ai/learn/blog/launch'
  })
  afterEach(() => {
    for (const k of KEYS) {
      const v = snapshot[k]
      if (v === undefined) {
        delete process.env[k]
      } else {
        process.env[k] = v
      }
    }
  })

  it('loads every required field from env', () => {
    const cfg = loadRenderConfigFromEnv()
    expect(cfg.founderName).toBe('Lex')
    expect(cfg.founderRole).toBe('Founder')
    expect(cfg.companyName).toBe('SettleGrid (Alerterra, LLC)')
    expect(cfg.physicalAddress).toBe('123 Example St, San Francisco, CA 94110')
    expect(cfg.blogUrl).toBe('https://settlegrid.ai/learn/blog/launch')
  })
  it('defaults galleryUrl to https://settlegrid.ai/templates', () => {
    expect(loadRenderConfigFromEnv().galleryUrl).toBe(
      'https://settlegrid.ai/templates',
    )
  })
  it('respects an explicit GALLERY_URL override', () => {
    process.env.GALLERY_URL = 'https://settlegrid.ai/gallery-v2'
    expect(loadRenderConfigFromEnv().galleryUrl).toBe(
      'https://settlegrid.ai/gallery-v2',
    )
  })
  it('defaults unsubscribeUrl to empty string (personal-mail mode)', () => {
    expect(loadRenderConfigFromEnv().unsubscribeUrl).toBe('')
  })
  it('throws CAN-SPAM error when FOUNDER_NAME is missing', () => {
    delete process.env.FOUNDER_NAME
    expect(() => loadRenderConfigFromEnv()).toThrow(/CAN-SPAM/)
  })
  it('throws CAN-SPAM error when PHYSICAL_ADDRESS is missing', () => {
    delete process.env.PHYSICAL_ADDRESS
    expect(() => loadRenderConfigFromEnv()).toThrow(/CAN-SPAM/)
  })
})
