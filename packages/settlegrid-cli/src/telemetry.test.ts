/**
 * P4.1 — CLI telemetry tests.
 *
 * Wire-shape integration coverage at the CLI ↔ proxy seam. Captures
 * the actual outbound POST body (the lesson from the Phase 3 Python
 * SDK meter bug — mocks alone aren't enough; assert key-set against
 * the receiving Zod schema's required keys).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import {
  isOptedOut,
  getProxyBase,
  getDistinctId,
  telemetryIdPath,
  capture,
  captureCliInstallStarted,
  captureScaffoldSuccess,
  captureScaffoldFailed,
  normalizeScaffoldSlug,
  __setFetchForTests,
} from './telemetry.js'

const ORIGINAL_ENV = { ...process.env }
let tmpHome: string

beforeEach(() => {
  // Each test gets a clean HOME so distinct-id files don't leak
  // between tests. mkdtempSync gives us a unique dir we can blow
  // away in afterEach.
  tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'sgcli-telemetry-'))
  process.env = { ...ORIGINAL_ENV, HOME: tmpHome, USERPROFILE: tmpHome }
  delete process.env.SETTLEGRID_TELEMETRY
  delete process.env.SETTLEGRID_API_URL
})

afterEach(() => {
  process.env = { ...ORIGINAL_ENV }
  __setFetchForTests(undefined)
  try {
    fs.rmSync(tmpHome, { recursive: true, force: true })
  } catch {
    // best-effort cleanup
  }
})

describe('isOptedOut', () => {
  it('returns false when env var unset', () => {
    delete process.env.SETTLEGRID_TELEMETRY
    expect(isOptedOut()).toBe(false)
  })

  it.each(['0', 'false', 'no', 'off', 'FALSE', '  off  ', 'OFF'])(
    'returns true for %p',
    (val) => {
      process.env.SETTLEGRID_TELEMETRY = val
      expect(isOptedOut()).toBe(true)
    },
  )

  it.each(['1', 'true', 'yes', 'on', '', 'maybe'])(
    'returns false for %p (telemetry stays on for any non-opt-out value)',
    (val) => {
      process.env.SETTLEGRID_TELEMETRY = val
      expect(isOptedOut()).toBe(false)
    },
  )
})

describe('getProxyBase', () => {
  it('defaults to https://settlegrid.ai when env unset', () => {
    delete process.env.SETTLEGRID_API_URL
    expect(getProxyBase()).toBe('https://settlegrid.ai')
  })

  it('uses SETTLEGRID_API_URL when set, stripping trailing slash', () => {
    process.env.SETTLEGRID_API_URL = 'http://localhost:3000/'
    expect(getProxyBase()).toBe('http://localhost:3000')
  })

  it('falls back to default on whitespace-only env value', () => {
    process.env.SETTLEGRID_API_URL = '   '
    expect(getProxyBase()).toBe('https://settlegrid.ai')
  })
})

describe('getDistinctId', () => {
  it('creates a UUID + persists it to ~/.settlegrid/telemetry-id with 0600 perms', () => {
    const id = getDistinctId()
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
    const file = telemetryIdPath()
    expect(fs.existsSync(file)).toBe(true)
    expect(fs.readFileSync(file, 'utf8')).toBe(id)
    if (process.platform !== 'win32') {
      const stat = fs.statSync(file)
      // Mode-bits (lower 9): file mode 0o600 → 0o100600 with type bits.
      expect(stat.mode & 0o777).toBe(0o600)
      const dirStat = fs.statSync(path.dirname(file))
      expect(dirStat.mode & 0o777).toBe(0o700)
    }
  })

  it('returns the same UUID on subsequent calls', () => {
    const a = getDistinctId()
    const b = getDistinctId()
    expect(a).toBe(b)
  })

  it('regenerates on corrupt file content', () => {
    const file = telemetryIdPath()
    fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 })
    fs.writeFileSync(file, 'not-a-uuid', { mode: 0o600 })
    const id = getDistinctId()
    expect(id).not.toBe('not-a-uuid')
    expect(id).toMatch(/^[0-9a-f]{8}-/)
    expect(fs.readFileSync(file, 'utf8')).toBe(id)
  })

  it('still returns a UUID when the home dir is unwritable', () => {
    // Point HOME at a path we can't write to. The function MUST
    // NOT throw — telemetry never blocks user-visible work.
    process.env.HOME = '/proc/no-such-path/at/all'
    process.env.USERPROFILE = '/proc/no-such-path/at/all'
    const id = getDistinctId()
    expect(id).toMatch(/^[0-9a-f]{8}-/)
  })
})

describe('capture — wire shape', () => {
  it('POSTs the documented body shape to the proxy', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(null, { status: 200 }),
    )
    __setFetchForTests(fetchMock as unknown as typeof fetch)
    process.env.SETTLEGRID_API_URL = 'http://localhost:3000'

    const ok = await capture('cli_install_started', {
      cli_version: '0.1.0',
      node_version: '20.0.0',
      os: 'darwin-arm64',
    })

    expect(ok).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('http://localhost:3000/api/telemetry/capture')
    expect((init as RequestInit).method).toBe('POST')
    expect((init as RequestInit).redirect).toBe('error')
    const body = JSON.parse((init as RequestInit).body as string)
    expect(Object.keys(body).sort()).toEqual([
      'distinct_id',
      'event',
      'properties',
    ])
    expect(body.event).toBe('cli_install_started')
    expect(body.distinct_id).toMatch(/^[0-9a-f]{8}-/)
    expect(body.properties).toEqual({
      cli_version: '0.1.0',
      node_version: '20.0.0',
      os: 'darwin-arm64',
    })
  })

  it('returns false (no fetch call) when opted out', async () => {
    process.env.SETTLEGRID_TELEMETRY = '0'
    const fetchMock = vi.fn()
    __setFetchForTests(fetchMock as unknown as typeof fetch)

    const ok = await capture('cli_install_started', {
      cli_version: '0.1.0',
      node_version: '20.0.0',
      os: 'linux-x64',
    })
    expect(ok).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('returns false on fetch reject (does not throw)', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'))
    __setFetchForTests(fetchMock as unknown as typeof fetch)

    const ok = await capture('scaffold_failed', {
      template_slug: 'foo',
      error_code: 'unknown',
    })
    expect(ok).toBe(false)
  })

  it('returns false on non-2xx response', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(null, { status: 500 }),
    )
    __setFetchForTests(fetchMock as unknown as typeof fetch)

    const ok = await capture('scaffold_failed', {
      template_slug: 'foo',
      error_code: 'unknown',
    })
    expect(ok).toBe(false)
  })

  it('aborts the request after the 2s timeout', async () => {
    // Simulate fetch that never resolves so we trigger the abort.
    const fetchMock = vi.fn().mockImplementation((_url, init) => {
      return new Promise((_resolve, reject) => {
        const signal = (init as RequestInit).signal
        if (signal) {
          signal.addEventListener('abort', () => {
            const err = new Error('aborted')
            err.name = 'AbortError'
            reject(err)
          })
        }
      })
    })
    __setFetchForTests(fetchMock as unknown as typeof fetch)
    vi.useFakeTimers()

    const promise = capture('cli_install_started', {
      cli_version: '0.1.0',
      node_version: '20.0.0',
      os: 'linux-x64',
    })
    // Advance past the 2s telemetry timeout.
    await vi.advanceTimersByTimeAsync(2100)
    const ok = await promise
    expect(ok).toBe(false)

    vi.useRealTimers()
  })
})

describe('normalizeScaffoldSlug — privacy normalisation (H3)', () => {
  it('returns (unknown) for undefined / empty input', () => {
    expect(normalizeScaffoldSlug(undefined)).toBe('(unknown)')
    expect(normalizeScaffoldSlug('')).toBe('(unknown)')
  })

  it('returns (local) for filesystem paths (no path leak)', () => {
    expect(normalizeScaffoldSlug('/Users/me/code/secret-project')).toBe('(local)')
    expect(normalizeScaffoldSlug('./local-mcp')).toBe('(local)')
    expect(normalizeScaffoldSlug('../sibling')).toBe('(local)')
    expect(normalizeScaffoldSlug('C:\\Users\\me\\repo')).toBe('(local)')
  })

  it('returns github:owner/repo for https github URLs', () => {
    expect(normalizeScaffoldSlug('https://github.com/anthropics/claude-code')).toBe(
      'github:anthropics/claude-code',
    )
    expect(
      normalizeScaffoldSlug('https://github.com/owner/repo.git'),
    ).toBe('github:owner/repo')
    expect(
      normalizeScaffoldSlug('http://github.com/owner/repo/tree/main'),
    ).toBe('github:owner/repo')
  })

  it('returns github:owner/repo for github: shorthand', () => {
    expect(normalizeScaffoldSlug('github:owner/repo')).toBe('github:owner/repo')
  })

  it('returns github:owner/repo for git@ ssh form', () => {
    expect(normalizeScaffoldSlug('git@github.com:owner/repo.git')).toBe(
      'github:owner/repo',
    )
  })

  it('does not echo arbitrary URL paths (privacy)', () => {
    // A URL that doesn't match the github patterns falls through to
    // (local). No raw string ever appears in the slug.
    const slug = normalizeScaffoldSlug('https://gitlab.com/secret-org/project')
    expect(slug).toBe('(local)')
    expect(slug).not.toContain('secret-org')
    expect(slug).not.toContain('gitlab')
  })

  it('never returns a slug containing a slash-prefixed path component', () => {
    // Property-style assertion: for any input, the output is one of:
    //   - '(unknown)' / '(local)'
    //   - 'github:owner/repo' (controlled shape)
    // Never a raw filesystem path or URL.
    const inputs = [
      '/etc/passwd',
      '/home/user/.ssh/id_rsa',
      'file:///var/log/messages',
      'https://example.com/some/leaky/path',
    ]
    for (const input of inputs) {
      const out = normalizeScaffoldSlug(input)
      expect(out === '(unknown)' || out === '(local)' || out.startsWith('github:')).toBe(true)
    }
  })
})

describe('typed helpers', () => {
  it('captureCliInstallStarted fills node_version + os', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(null, { status: 200 }),
    )
    __setFetchForTests(fetchMock as unknown as typeof fetch)

    await captureCliInstallStarted({ cli_version: '9.9.9' })
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.event).toBe('cli_install_started')
    expect(body.properties.cli_version).toBe('9.9.9')
    expect(body.properties.node_version).toBe(process.versions.node)
    expect(body.properties.os).toBe(`${process.platform}-${process.arch}`)
  })

  it('captureScaffoldSuccess forwards template_slug + duration_ms', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(null, { status: 200 }),
    )
    __setFetchForTests(fetchMock as unknown as typeof fetch)
    await captureScaffoldSuccess({ template_slug: 'neon', duration_ms: 4321 })
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.event).toBe('scaffold_success')
    expect(body.properties).toEqual({
      template_slug: 'neon',
      duration_ms: 4321,
    })
  })

  it('captureScaffoldFailed forwards template_slug + error_code', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(null, { status: 200 }),
    )
    __setFetchForTests(fetchMock as unknown as typeof fetch)
    await captureScaffoldFailed({
      template_slug: 'foo',
      error_code: 'pr_failed',
    })
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.event).toBe('scaffold_failed')
    expect(body.properties).toEqual({
      template_slug: 'foo',
      error_code: 'pr_failed',
    })
  })
})
