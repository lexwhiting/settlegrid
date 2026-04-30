/**
 * P2.INTL1 — tests for the cold-email outreach backfill script.
 *
 * Exercises the CSV pipeline + GitHub-URL parser + per-row
 * enrichment with a mocked fetch. The actual heuristic (country
 * parsing, segment classification) is unit-tested in
 * apps/web/src/lib/__tests__/international.test.ts — these tests
 * are about the SCRIPT wiring: does the CSV round-trip cleanly,
 * does it handle GitHub-URL edge cases, does enrichment write the
 * expected columns.
 */

import { describe, it, expect, vi } from 'vitest'
import {
  RateLimitError,
  backfillFile,
  enrichRow,
  extractGithubUsername,
  fetchGithubLocation,
  parseCsv,
  runCli,
  serializeCsv,
} from './backfill-country'

describe('parseCsv + serializeCsv — round-trip', () => {
  it('parses a simple comma-separated file', () => {
    const src = 'email,domain\nada@acme.us,acme.us\nbob@acme.de,acme.de\n'
    const { headers, rows } = parseCsv(src)
    expect(headers).toEqual(['email', 'domain'])
    expect(rows).toHaveLength(2)
    expect(rows[0]).toEqual({ email: 'ada@acme.us', domain: 'acme.us' })
  })

  it('skips commented lines (starting with #)', () => {
    const src =
      '# this is a comment\n' +
      'email,domain\n' +
      '# another comment\n' +
      'ada@acme.us,acme.us\n'
    const { rows } = parseCsv(src)
    expect(rows).toHaveLength(1)
  })

  it('handles quoted cells with embedded commas', () => {
    const src = 'name,company\nAda,"Acme, Inc."\n'
    const { rows } = parseCsv(src)
    expect(rows[0]).toEqual({ name: 'Ada', company: 'Acme, Inc.' })
  })

  it('handles escaped double-quotes inside quoted cells', () => {
    const src = 'name,company\nAda,"Acme ""The"" Corp"\n'
    const { rows } = parseCsv(src)
    expect(rows[0]).toEqual({ name: 'Ada', company: 'Acme "The" Corp' })
  })

  it('pads missing trailing cells with empty strings', () => {
    const src = 'email,domain,note\nada@acme.us,acme.us\n'
    const { rows } = parseCsv(src)
    expect(rows[0]).toEqual({ email: 'ada@acme.us', domain: 'acme.us', note: '' })
  })

  it('returns empty result for empty input', () => {
    expect(parseCsv('')).toEqual({ headers: [], rows: [] })
    expect(parseCsv('# only comments\n')).toEqual({ headers: [], rows: [] })
  })

  it('round-trips a parsed CSV through serialize', () => {
    const src = 'email,domain\nada@acme.us,acme.us\n'
    const { headers, rows } = parseCsv(src)
    expect(serializeCsv(headers, rows)).toBe(src)
  })

  it('serialize quotes cells that contain commas', () => {
    const out = serializeCsv(['a', 'b'], [{ a: 'x', b: 'has, comma' }])
    expect(out).toContain('"has, comma"')
  })

  it('serialize escapes embedded double-quotes', () => {
    const out = serializeCsv(['a'], [{ a: 'has "quotes"' }])
    expect(out).toContain('"has ""quotes"""')
  })
})

describe('extractGithubUsername', () => {
  it.each([
    ['https://github.com/ada', 'ada'],
    ['https://github.com/ada/repo', 'ada'],
    ['https://github.com/ada-lovelace', 'ada-lovelace'],
    ['https://www.github.com/ada', 'ada'],
    ['http://github.com/ada', 'ada'],
  ])('parses %s → %s', (url, expected) => {
    expect(extractGithubUsername(url)).toBe(expected)
  })

  it.each([
    'https://github.com',
    'https://github.com/',
    'https://example.com/ada',
    'not a url',
    'https://github.com/orgs/foo',
    'https://github.com/settings',
    'https://github.com/marketplace',
  ])('returns null for invalid / reserved path %s', (url) => {
    expect(extractGithubUsername(url)).toBeNull()
  })
})

describe('fetchGithubLocation', () => {
  it('returns null when url is empty', async () => {
    expect(await fetchGithubLocation(undefined)).toBeNull()
    expect(await fetchGithubLocation('')).toBeNull()
  })

  it('returns null when no token (rate-limit avoidance)', async () => {
    const fakeFetch = vi.fn()
    const result = await fetchGithubLocation('https://github.com/ada', {
      fetchImpl: fakeFetch as unknown as typeof fetch,
    })
    expect(result).toBeNull()
    expect(fakeFetch).not.toHaveBeenCalled()
  })

  it('returns location when GitHub API resolves', async () => {
    const fakeFetch = vi.fn(
      async () =>
        new Response(JSON.stringify({ login: 'ada', location: 'London, UK' }), {
          status: 200,
        }),
    )
    const result = await fetchGithubLocation('https://github.com/ada', {
      token: 'ghp_fake',
      fetchImpl: fakeFetch as unknown as typeof fetch,
    })
    expect(result).toBe('London, UK')
    expect(fakeFetch).toHaveBeenCalledWith(
      'https://api.github.com/users/ada',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer ghp_fake',
        }),
      }),
    )
  })

  it('returns null on GitHub 404', async () => {
    const fakeFetch = vi.fn(async () => new Response('', { status: 404 }))
    const result = await fetchGithubLocation('https://github.com/ada', {
      token: 'ghp_fake',
      fetchImpl: fakeFetch as unknown as typeof fetch,
    })
    expect(result).toBeNull()
  })

  it('returns null on network error', async () => {
    const fakeFetch = vi.fn(async () => {
      throw new Error('network down')
    })
    const result = await fetchGithubLocation('https://github.com/ada', {
      token: 'ghp_fake',
      fetchImpl: fakeFetch as unknown as typeof fetch,
    })
    expect(result).toBeNull()
  })

  it('handles null location in GitHub response', async () => {
    const fakeFetch = vi.fn(
      async () =>
        new Response(JSON.stringify({ login: 'ada', location: null }), {
          status: 200,
        }),
    )
    const result = await fetchGithubLocation('https://github.com/ada', {
      token: 'ghp_fake',
      fetchImpl: fakeFetch as unknown as typeof fetch,
    })
    expect(result).toBeNull()
  })
})

describe('enrichRow', () => {
  it('writes country_iso + stripe_supported + segment', async () => {
    const row = { email: 'ada@acme.us', domain: 'acme.us' }
    const enriched = await enrichRow(row)
    expect(enriched.country_iso).toBe('US')
    expect(enriched.stripe_supported).toBe('true')
    expect(enriched.segment).toBe('activate-now')
  })

  it('Cohort-1 row routes to waitlist segment', async () => {
    const row = { email: 'kunle@acme.ng', domain: 'acme.ng' }
    const enriched = await enrichRow(row)
    expect(enriched.country_iso).toBe('NG')
    expect(enriched.stripe_supported).toBe('false')
    expect(enriched.segment).toBe('stripe-unsupported-corridor-waitlist')
  })

  it('unresolvable domain → UNKNOWN + cold segment', async () => {
    const row = { email: 'x@example.com', domain: 'example.com' }
    const enriched = await enrichRow(row)
    expect(enriched.country_iso).toBe('UNKNOWN')
    expect(enriched.stripe_supported).toBe('unknown')
    expect(enriched.segment).toBe('cold-unknown-country')
  })

  it('preserves other fields untouched', async () => {
    const row = {
      email: 'ada@acme.us',
      domain: 'acme.us',
      first_name: 'Ada',
      company: 'Acme',
      source: 'github-scrape',
    }
    const enriched = await enrichRow(row)
    expect(enriched.first_name).toBe('Ada')
    expect(enriched.company).toBe('Acme')
    expect(enriched.source).toBe('github-scrape')
  })

  it('respects an EXISTING segment value (manual override)', async () => {
    // A manual reviewer may have set `segment: opted-out` after a
    // prospect explicitly unsubscribed. Backfill must NOT clobber
    // that.
    const row = {
      email: 'ada@acme.us',
      domain: 'acme.us',
      segment: 'opted-out',
    }
    const enriched = await enrichRow(row)
    expect(enriched.segment).toBe('opted-out')
    // country_iso + stripe_supported are still computed for audit.
    expect(enriched.country_iso).toBe('US')
  })

  it('uses GitHub location when token + url present, overriding domain', async () => {
    // Ada's domain is .us (generic — would be UNKNOWN). Her GitHub
    // profile says Karachi, Pakistan. Backfill honors the GitHub
    // signal (primary heuristic).
    const fakeFetch = vi.fn(
      async () =>
        new Response(
          JSON.stringify({ location: 'Karachi, Pakistan' }),
          { status: 200 },
        ),
    )
    const row = {
      email: 'ada@example.com',
      domain: 'example.com',
      github_url: 'https://github.com/ada',
    }
    const enriched = await enrichRow(row, {
      token: 'ghp_fake',
      fetchImpl: fakeFetch as unknown as typeof fetch,
    })
    expect(enriched.country_iso).toBe('PK')
    expect(enriched.segment).toBe('stripe-unsupported-corridor-waitlist')
  })
})

describe('fetchGithubLocation — hostile-review fixes (timeout + rate-limit)', () => {
  it('throws RateLimitError on GitHub 403 with x-ratelimit-remaining=0', async () => {
    // Hostile-review: silent null on rate-limit exhaustion degrades
    // every remaining prospect to UNKNOWN. The operator must know
    // the backfill is incomplete — throw so the script stops.
    const fakeFetch = vi.fn(
      async () =>
        new Response('', {
          status: 403,
          headers: {
            'x-ratelimit-remaining': '0',
            'x-ratelimit-reset': String(Math.floor(Date.now() / 1000) + 3600),
          },
        }),
    )
    await expect(
      fetchGithubLocation('https://github.com/ada', {
        token: 'ghp_fake',
        fetchImpl: fakeFetch as unknown as typeof fetch,
      }),
    ).rejects.toThrowError(RateLimitError)
  })

  it('does NOT throw on 403 without rate-limit headers (e.g., private user)', async () => {
    const fakeFetch = vi.fn(async () => new Response('', { status: 403 }))
    const result = await fetchGithubLocation('https://github.com/ada', {
      token: 'ghp_fake',
      fetchImpl: fakeFetch as unknown as typeof fetch,
    })
    expect(result).toBeNull()
  })

  it('does NOT throw on 403 with x-ratelimit-remaining > 0 (scope issue, not exhaustion)', async () => {
    const fakeFetch = vi.fn(
      async () =>
        new Response('', {
          status: 403,
          headers: { 'x-ratelimit-remaining': '42' },
        }),
    )
    const result = await fetchGithubLocation('https://github.com/ada', {
      token: 'ghp_fake',
      fetchImpl: fakeFetch as unknown as typeof fetch,
    })
    expect(result).toBeNull()
  })

  it('honors the timeout when GitHub hangs', async () => {
    const fakeFetch = vi.fn(
      async (_url: string, init?: { signal?: AbortSignal }) => {
        // Emulate abort: if the signal fires, throw an AbortError.
        return new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(
              Object.assign(new Error('aborted'), { name: 'AbortError' }),
            )
          })
          // Otherwise never resolve — simulates a hang.
        })
      },
    )
    const result = await fetchGithubLocation('https://github.com/ada', {
      token: 'ghp_fake',
      fetchImpl: fakeFetch as unknown as typeof fetch,
      timeoutMs: 10,
    })
    // Times out, falls into the catch, returns null.
    expect(result).toBeNull()
  })
})

describe('enrichRow — preserve existing country_iso (hostile-review fix)', () => {
  it('preserves a valid manually-set country_iso (does NOT overwrite with heuristic)', async () => {
    // Hostile-review: a reviewer manually verified this prospect is
    // in India via LinkedIn. Their GitHub location says "Canada"
    // (stale). Re-running the backfill must NOT clobber IN with CA.
    const fakeFetch = vi.fn(
      async () =>
        new Response(JSON.stringify({ location: 'Toronto, Canada' }), {
          status: 200,
        }),
    )
    const row = {
      email: 'ada@acme.com',
      domain: 'acme.com',
      github_url: 'https://github.com/ada',
      country_iso: 'IN', // manually set
    }
    const enriched = await enrichRow(row, {
      token: 'ghp_fake',
      fetchImpl: fakeFetch as unknown as typeof fetch,
    })
    expect(enriched.country_iso).toBe('IN')
    expect(enriched.stripe_supported).toBe('true')
    expect(enriched.segment).toBe('activate-now')
    // GitHub API is NOT called when we have a valid existing value
    // (fetch quota preserved).
    expect(fakeFetch).not.toHaveBeenCalled()
  })

  it('OVERWRITES country_iso="UNKNOWN" on re-run (allow later GitHub info to fill in)', async () => {
    const fakeFetch = vi.fn(
      async () =>
        new Response(JSON.stringify({ location: 'Berlin, Germany' }), {
          status: 200,
        }),
    )
    const row = {
      email: 'ada@acme.com',
      domain: 'acme.com',
      github_url: 'https://github.com/ada',
      country_iso: 'UNKNOWN',
    }
    const enriched = await enrichRow(row, {
      token: 'ghp_fake',
      fetchImpl: fakeFetch as unknown as typeof fetch,
    })
    expect(enriched.country_iso).toBe('DE')
  })

  it('OVERWRITES invalid country_iso (e.g., typo or "UN")', async () => {
    const row = {
      email: 'ada@acme.ng',
      domain: 'acme.ng',
      country_iso: 'UN', // not a country code
    }
    const enriched = await enrichRow(row)
    expect(enriched.country_iso).toBe('NG')
  })

  it('OVERWRITES empty-string country_iso', async () => {
    const row = {
      email: 'ada@acme.us',
      domain: 'acme.us',
      country_iso: '',
    }
    const enriched = await enrichRow(row)
    expect(enriched.country_iso).toBe('US')
  })
})

describe('enrichRow — sanctions-blocked routing (hostile-review fix)', () => {
  it('prospect with country_iso=IR routes to sanctions-blocked (not waitlist)', async () => {
    const row = {
      email: 'blocked@example.ir',
      domain: 'example.com',
      country_iso: 'IR',
    }
    const enriched = await enrichRow(row)
    expect(enriched.country_iso).toBe('IR')
    expect(enriched.segment).toBe('sanctions-blocked')
    // Sanctions-blocked is NOT Stripe-supported, but that's not the
    // distinguishing property — the dedicated segment is.
    expect(enriched.stripe_supported).toBe('false')
  })
})

describe('backfillFile — rate-limit halts the run (hostile-review fix)', () => {
  it('propagates RateLimitError up from the first row that hits it', async () => {
    // Hostile-review: partial-CSV production is worse than no CSV
    // at all, because the operator can't easily tell which rows
    // are authoritative. Stop on first rate-limit signal.
    const fakeFetch = vi.fn(
      async () =>
        new Response('', {
          status: 403,
          headers: { 'x-ratelimit-remaining': '0' },
        }),
    )
    const src =
      'email,github_url\n' +
      'a@x.com,https://github.com/a\n' +
      'b@x.com,https://github.com/b\n'
    await expect(
      backfillFile(src, {
        token: 'ghp_fake',
        fetchImpl: fakeFetch as unknown as typeof fetch,
      }),
    ).rejects.toThrowError(RateLimitError)
  })
})

describe('backfillFile — end-to-end', () => {
  it('enriches a 3-row CSV + produces the expected counts', async () => {
    const src =
      'email,domain,github_url\n' +
      'ada@acme.us,acme.us,\n' +
      'kunle@acme.ng,acme.ng,\n' +
      'sara@startup.com,startup.com,\n'
    const result = await backfillFile(src)
    expect(result.rows).toHaveLength(3)
    expect(result.activateCount).toBe(1)
    expect(result.waitlistCount).toBe(1)
    expect(result.unknownCount).toBe(1)
  })

  it('counts github-lookup skipped-for-missing-token', async () => {
    const src = 'email,github_url\nada@acme.us,https://github.com/ada\n'
    const result = await backfillFile(src)
    expect(result.skippedGithubLookup).toBe(1)
  })

  it('does NOT double-count skipped-github when token is provided', async () => {
    const fakeFetch = vi.fn(
      async () =>
        new Response(JSON.stringify({ location: 'Berlin, Germany' }), {
          status: 200,
        }),
    )
    const src = 'email,github_url\nada@acme.us,https://github.com/ada\n'
    const result = await backfillFile(src, {
      token: 'ghp_fake',
      fetchImpl: fakeFetch as unknown as typeof fetch,
    })
    expect(result.skippedGithubLookup).toBe(0)
    expect(result.rows[0].country_iso).toBe('DE')
  })

  it('handles empty CSV gracefully', async () => {
    const result = await backfillFile('')
    expect(result.rows).toEqual([])
    expect(result.activateCount).toBe(0)
  })

  it('pure CSV → pipes cleanly into serializeCsv → round-trip', async () => {
    const src =
      'email,domain\n' +
      'ada@acme.us,acme.us\n' +
      'kunle@acme.ng,acme.ng\n'
    const result = await backfillFile(src)
    const headers = ['email', 'domain', 'country_iso', 'stripe_supported', 'segment']
    const out = serializeCsv(headers, result.rows)
    // Output must contain both enriched rows with the right columns
    expect(out).toContain('ada@acme.us,acme.us,US,true,activate-now')
    expect(out).toContain('kunle@acme.ng,acme.ng,NG,false,stripe-unsupported-corridor-waitlist')
  })
})

describe('runCli — CLI entry-point tests (coverage close-out)', () => {
  function makeCtx() {
    const errors: string[] = []
    const files = new Map<string, string>()
    const ctx = {
      errors,
      files,
      logger: {
        error: (msg: string) => {
          errors.push(msg)
        },
      },
      readFile: (p: string) => {
        const v = files.get(p)
        if (v === undefined) throw new Error(`no file: ${p}`)
        return v
      },
      writeFile: (p: string, d: string) => {
        files.set(p, d)
      },
      existsSync: (p: string) => files.has(p),
    }
    return ctx
  }

  it('returns exit code 2 with usage when --in is missing', async () => {
    const ctx = makeCtx()
    const result = await runCli({
      argv: ['node', 'script.ts', '--out', '/tmp/out.csv'],
      env: {},
      ...ctx,
    })
    expect(result.exitCode).toBe(2)
    expect(ctx.errors[0]).toMatch(/Usage:/)
  })

  it('returns exit code 2 when --out is missing', async () => {
    const ctx = makeCtx()
    const result = await runCli({
      argv: ['node', 'script.ts', '--in', '/tmp/in.csv'],
      env: {},
      ...ctx,
    })
    expect(result.exitCode).toBe(2)
  })

  it('returns exit code 2 when --in has no value', async () => {
    const ctx = makeCtx()
    const result = await runCli({
      argv: ['node', 'script.ts', '--in'],
      env: {},
      ...ctx,
    })
    expect(result.exitCode).toBe(2)
  })

  it('returns exit code 1 when input file does not exist', async () => {
    const ctx = makeCtx()
    const result = await runCli({
      argv: ['node', 'script.ts', '--in', '/tmp/missing.csv', '--out', '/tmp/out.csv'],
      env: {},
      ...ctx,
    })
    expect(result.exitCode).toBe(1)
    expect(ctx.errors[0]).toMatch(/input file not found/)
  })

  it('happy path: reads, enriches, writes output with right shape', async () => {
    const ctx = makeCtx()
    ctx.files.set(
      '/tmp/in.csv',
      'email,domain\nada@acme.us,acme.us\nkunle@acme.ng,acme.ng\n',
    )
    const result = await runCli({
      argv: ['node', 'script.ts', '--in', '/tmp/in.csv', '--out', '/tmp/out.csv'],
      env: {},
      ...ctx,
    })
    expect(result.exitCode).toBe(0)
    expect(result.outputPath).toBe('/tmp/out.csv')
    expect(result.summary).toEqual({
      rowsWritten: 2,
      activateCount: 1,
      waitlistCount: 1,
      unknownCount: 0,
      skippedGithubLookup: 0,
    })
    const outCsv = ctx.files.get('/tmp/out.csv') ?? ''
    expect(outCsv).toContain('country_iso')
    expect(outCsv).toContain('stripe_supported')
    expect(outCsv).toContain('segment')
    expect(outCsv).toContain('US,true,activate-now')
    expect(outCsv).toContain('NG,false,stripe-unsupported-corridor-waitlist')
  })

  it('output header includes country_iso / stripe_supported / segment even when absent in input', async () => {
    const ctx = makeCtx()
    ctx.files.set('/tmp/in.csv', 'email,domain\nada@acme.us,acme.us\n')
    await runCli({
      argv: ['node', 'script.ts', '--in', '/tmp/in.csv', '--out', '/tmp/out.csv'],
      env: {},
      ...ctx,
    })
    const outCsv = ctx.files.get('/tmp/out.csv') ?? ''
    const headerLine = outCsv.split('\n')[0]
    expect(headerLine).toContain('country_iso')
    expect(headerLine).toContain('stripe_supported')
    expect(headerLine).toContain('segment')
  })

  it('returns exit code 1 when backfillFile throws (rate-limit)', async () => {
    const ctx = makeCtx()
    ctx.files.set(
      '/tmp/in.csv',
      'email,github_url\nada@acme.com,https://github.com/ada\n',
    )
    const rateLimitFetch = vi.fn(
      async () =>
        new Response('', {
          status: 403,
          headers: { 'x-ratelimit-remaining': '0' },
        }),
    )
    const result = await runCli({
      argv: ['node', 'script.ts', '--in', '/tmp/in.csv', '--out', '/tmp/out.csv'],
      env: { GITHUB_TOKEN: 'ghp_fake' },
      fetchImpl: rateLimitFetch as unknown as typeof fetch,
      ...ctx,
    })
    expect(result.exitCode).toBe(1)
    expect(ctx.errors.some((e) => /rate limit/i.test(e))).toBe(true)
    // The output file was NOT written — partial progress is worse
    // than no progress for operator clarity.
    expect(ctx.files.has('/tmp/out.csv')).toBe(false)
  })

  it('passes through the GITHUB_TOKEN env var to the fetch', async () => {
    const ctx = makeCtx()
    ctx.files.set(
      '/tmp/in.csv',
      'email,domain,github_url\nada@x.com,x.com,https://github.com/ada\n',
    )
    const fakeFetch = vi.fn(
      async () =>
        new Response(JSON.stringify({ location: 'Berlin, Germany' }), {
          status: 200,
        }),
    )
    const result = await runCli({
      argv: ['node', 'script.ts', '--in', '/tmp/in.csv', '--out', '/tmp/out.csv'],
      env: { GITHUB_TOKEN: 'ghp_test_token' },
      fetchImpl: fakeFetch as unknown as typeof fetch,
      ...ctx,
    })
    expect(result.exitCode).toBe(0)
    const call = fakeFetch.mock.calls[0]
    const init = call[1] as { headers: Record<string, string> }
    expect(init.headers.Authorization).toBe('Bearer ghp_test_token')
  })
})
