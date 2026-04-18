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
  backfillFile,
  enrichRow,
  extractGithubUsername,
  fetchGithubLocation,
  parseCsv,
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
