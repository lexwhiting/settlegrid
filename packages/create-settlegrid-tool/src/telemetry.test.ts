/**
 * Telemetry tests for `create-settlegrid-tool`.
 *
 * Wire-shape integration coverage at the CLI ↔ proxy seam: the tests
 * capture the actual outbound POST body and assert its key-set
 * against the receiving proxy's Zod schema. Mirrors
 * `packages/settlegrid-cli/src/telemetry.test.ts`.
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
  __setFetchForTests,
} from './telemetry.js'

/**
 * Env keys these tests mutate. We mutate `process.env` IN PLACE
 * rather than reassigning it wholesale (`process.env = {...}`),
 * because a wholesale reassignment replaces the native-backed env
 * object with a plain JS object — and native consumers like
 * `os.homedir()`, which read the real C environment via `getenv`,
 * would NOT see the change. `telemetryIdPath()` depends on
 * `os.homedir()`, so in-place mutation is the only way to redirect
 * the telemetry-id file at the per-test `tmpHome`.
 */
const MANAGED_ENV_KEYS = [
  'HOME',
  'USERPROFILE',
  'SETTLEGRID_TELEMETRY',
  'SETTLEGRID_API_URL',
  'SETTLEGRID_POSTHOG_ID',
  'CI',
  'CONTINUOUS_INTEGRATION',
] as const

const ORIGINAL_ENV: Record<string, string | undefined> = {}
for (const k of MANAGED_ENV_KEYS) ORIGINAL_ENV[k] = process.env[k]

let tmpHome: string

beforeEach(() => {
  // Each test gets a fresh, isolated HOME so distinct-id files don't
  // leak between tests. In-place assignment syncs to the C env, so
  // os.homedir() honours it.
  tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'cst-telemetry-'))
  process.env.HOME = tmpHome
  process.env.USERPROFILE = tmpHome
  delete process.env.SETTLEGRID_TELEMETRY
  delete process.env.SETTLEGRID_API_URL
  delete process.env.SETTLEGRID_POSTHOG_ID
  // CI env vars must be cleared too — if the test runner itself is
  // in CI, the CI-implicit-opt-out path would short-circuit every
  // isOptedOut() test that expects false.
  delete process.env.CI
  delete process.env.CONTINUOUS_INTEGRATION
})

afterEach(() => {
  for (const k of MANAGED_ENV_KEYS) {
    const original = ORIGINAL_ENV[k]
    if (original === undefined) delete process.env[k]
    else process.env[k] = original
  }
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

  describe('CI auto-opt-out', () => {
    it.each(['true', '1', 'yes', 'false', ''])(
      'returns true when CI=%p (any defined value counts as CI)',
      (val) => {
        process.env.CI = val
        expect(isOptedOut()).toBe(true)
      },
    )

    it('returns true when CONTINUOUS_INTEGRATION is set (older CI systems)', () => {
      process.env.CONTINUOUS_INTEGRATION = 'true'
      expect(isOptedOut()).toBe(true)
    })

    it('CI auto-opt-out wins over explicit SETTLEGRID_TELEMETRY=1', () => {
      process.env.CI = 'true'
      process.env.SETTLEGRID_TELEMETRY = '1'
      expect(isOptedOut()).toBe(true)
    })

    it('returns false when neither CI nor CONTINUOUS_INTEGRATION is set', () => {
      delete process.env.CI
      delete process.env.CONTINUOUS_INTEGRATION
      expect(isOptedOut()).toBe(false)
    })
  })
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
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    )
    const file = telemetryIdPath()
    expect(fs.existsSync(file)).toBe(true)
    expect(fs.readFileSync(file, 'utf8')).toBe(id)
    if (process.platform !== 'win32') {
      const stat = fs.statSync(file)
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
    process.env.HOME = '/proc/no-such-path/at/all'
    process.env.USERPROFILE = '/proc/no-such-path/at/all'
    const id = getDistinctId()
    expect(id).toMatch(/^[0-9a-f]{8}-/)
  })
})

describe('getDistinctId — SETTLEGRID_POSTHOG_ID handoff', () => {
  // A posthog-js anonymous id (UUIDv7 — the version nibble is `7`).
  const BROWSER_ID = '019e3707-1234-7abc-8def-0123456789ab'

  it('uses SETTLEGRID_POSTHOG_ID when it is a valid UUID', () => {
    process.env.SETTLEGRID_POSTHOG_ID = BROWSER_ID
    expect(getDistinctId()).toBe(BROWSER_ID)
  })

  it('does NOT persist the env-var id to the telemetry-id file', () => {
    process.env.SETTLEGRID_POSTHOG_ID = BROWSER_ID
    getDistinctId()
    // A borrowed browser id must not pin the machine identity.
    expect(fs.existsSync(telemetryIdPath())).toBe(false)
  })

  it('ignores SETTLEGRID_POSTHOG_ID when it is not a valid UUID', () => {
    process.env.SETTLEGRID_POSTHOG_ID = 'not-a-uuid'
    const id = getDistinctId()
    expect(id).not.toBe('not-a-uuid')
    expect(id).toMatch(/^[0-9a-f]{8}-/)
  })

  it('env-var id wins over an existing persisted file', () => {
    const persisted = getDistinctId() // creates the file
    expect(persisted).not.toBe(BROWSER_ID)
    process.env.SETTLEGRID_POSTHOG_ID = BROWSER_ID
    expect(getDistinctId()).toBe(BROWSER_ID)
  })
})

describe('capture — wire shape', () => {
  it('POSTs the documented body shape to the proxy', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 200 }))
    __setFetchForTests(fetchMock as unknown as typeof fetch)
    process.env.SETTLEGRID_API_URL = 'http://localhost:3000'

    const ok = await capture('cli_install_started', {
      cli_version: '1.0.1',
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
      cli_version: '1.0.1',
      node_version: '20.0.0',
      os: 'darwin-arm64',
    })
  })

  it('carries the SETTLEGRID_POSTHOG_ID as the distinct_id on the wire', async () => {
    const browserId = '019e3707-1234-7abc-8def-0123456789ab'
    process.env.SETTLEGRID_POSTHOG_ID = browserId
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 200 }))
    __setFetchForTests(fetchMock as unknown as typeof fetch)

    await capture('scaffold_success', { template_slug: 'tmdb', duration_ms: 1 })
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.distinct_id).toBe(browserId)
  })

  it('returns false (no fetch call) when opted out', async () => {
    process.env.SETTLEGRID_TELEMETRY = '0'
    const fetchMock = vi.fn()
    __setFetchForTests(fetchMock as unknown as typeof fetch)

    const ok = await capture('cli_install_started', {
      cli_version: '1.0.1',
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
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 500 }))
    __setFetchForTests(fetchMock as unknown as typeof fetch)

    const ok = await capture('scaffold_failed', {
      template_slug: 'foo',
      error_code: 'unknown',
    })
    expect(ok).toBe(false)
  })

  it('aborts the request after the 2s timeout', async () => {
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
      cli_version: '1.0.1',
      node_version: '20.0.0',
      os: 'linux-x64',
    })
    await vi.advanceTimersByTimeAsync(2100)
    const ok = await promise
    expect(ok).toBe(false)

    vi.useRealTimers()
  })
})

describe('typed helpers', () => {
  it('captureCliInstallStarted fills node_version + os', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 200 }))
    __setFetchForTests(fetchMock as unknown as typeof fetch)

    await captureCliInstallStarted({ cli_version: '9.9.9' })
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.event).toBe('cli_install_started')
    expect(body.properties.cli_version).toBe('9.9.9')
    expect(body.properties.node_version).toBe(process.versions.node)
    expect(body.properties.os).toBe(`${process.platform}-${process.arch}`)
  })

  it('captureScaffoldSuccess forwards template_slug + duration_ms', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 200 }))
    __setFetchForTests(fetchMock as unknown as typeof fetch)
    await captureScaffoldSuccess({ template_slug: 'tmdb', duration_ms: 4321 })
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.event).toBe('scaffold_success')
    expect(body.properties).toEqual({
      template_slug: 'tmdb',
      duration_ms: 4321,
    })
  })

  it('captureScaffoldFailed forwards template_slug + error_code', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 200 }))
    __setFetchForTests(fetchMock as unknown as typeof fetch)
    await captureScaffoldFailed({
      template_slug: 'tmdb',
      error_code: 'template_not_found',
    })
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.event).toBe('scaffold_failed')
    expect(body.properties).toEqual({
      template_slug: 'tmdb',
      error_code: 'template_not_found',
    })
  })
})
