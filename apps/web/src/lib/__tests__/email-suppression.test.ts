/**
 * email-compliance (G6-1/2/3) — unit + source-level regression guards for the
 * suppression gate. Complements email-compliance.integration.test.ts (which
 * runs the real pglite round-trips). Split out because the fail-CLOSED test
 * needs a THROWING db mock (file-scoped vi.mock) that the pglite suite can't
 * share, and the seam guards are pure source assertions.
 */
import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'

// db throws → isSuppressed must fail CLOSED (return true).
vi.mock('@/lib/db', () => ({
  db: {
    select: () => {
      throw new Error('simulated store failure')
    },
  },
}))
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))

import {
  normalizeEmail,
  isSuppressed,
  isSuppressibleStream,
  SUPPRESSIBLE_STREAMS,
  listUnsubscribeHeaders,
  unsubscribeLinkUrl,
} from '@/lib/email-suppression'

const SRC = path.resolve(__dirname, '../..')
const read = (rel: string) => readFileSync(path.join(SRC, rel), 'utf8')

describe('normalizeEmail', () => {
  it('trims + lowercases and is idempotent', () => {
    expect(normalizeEmail('  MixedCase@Example.COM ')).toBe('mixedcase@example.com')
    const once = normalizeEmail('  A@B.Com ')
    expect(normalizeEmail(once)).toBe(once)
  })
  it('byte-matches the legacy Redis writer key form', () => {
    // The legacy crons wrote unsub:outreach:{email.trim().toLowerCase()}.
    expect(`unsub:outreach:${normalizeEmail(' Foo@Bar.COM')}`).toBe('unsub:outreach:foo@bar.com')
  })
})

describe('SUPPRESSIBLE_STREAMS', () => {
  it('contains the five public streams and EXCLUDES the webhook-only/orphan literals', () => {
    expect([...SUPPRESSIBLE_STREAMS].sort()).toEqual(
      ['abandoned-checkout', 'consumer-digest', 'newsletter', 'outreach', 'weekly-report'].sort(),
    )
    // 'all' is webhook-only; 'marketing' is a dropped orphan literal.
    expect(isSuppressibleStream('all')).toBe(false)
    expect(isSuppressibleStream('marketing')).toBe(false)
    expect(isSuppressibleStream('consumer-digest')).toBe(true)
    expect(isSuppressibleStream('nonsense')).toBe(false)
  })
})

describe('isSuppressed fail-CLOSED', () => {
  it('returns TRUE on a store error (a paused bulk send is safe)', async () => {
    // db.select throws → the catch returns true. Newsletter stream avoids the
    // Redis-union branch, isolating the DB failure path.
    expect(await isSuppressed('anyone@x.com', 'newsletter')).toBe(true)
  })
  it('returns TRUE (fails closed) on a null/undefined email instead of throwing', async () => {
    // normalizeEmail(null/undefined) throws — isSuppressed must CATCH it and fail
    // closed (its contract is "on any error, return true / skip the send"), not
    // reject. Guards the fail-closed invariant against a bad argument, not just a
    // DB error.
    expect(await isSuppressed(undefined as unknown as string, 'newsletter')).toBe(true)
    expect(await isSuppressed(null as unknown as string, 'outreach')).toBe(true)
  })
})

describe('List-Unsubscribe headers + visible link URLs', () => {
  it('newsletter points at its own route; other streams at the stream-aware endpoint', () => {
    const nl = listUnsubscribeHeaders('User@X.com', 'newsletter')
    expect(nl['List-Unsubscribe']).toContain('/api/newsletter/unsubscribe?email=user%40x.com')
    expect(nl['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click')

    const dg = listUnsubscribeHeaders('User@X.com', 'consumer-digest')
    expect(dg['List-Unsubscribe']).toContain('/api/unsubscribe?email=user%40x.com&stream=consumer-digest')
    expect(dg['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click')
  })
  it('visible link carries the stream as ?type=', () => {
    expect(unsubscribeLinkUrl('a@b.com', 'weekly-report')).toBe(
      'https://settlegrid.ai/unsubscribe?email=a%40b.com&type=weekly-report',
    )
  })
})

// ── Source-level regression guards (the seams) ───────────────────────────────
describe('FOLD #1 — transactional exemption: the sendEmail transport stays frozen', () => {
  it('email.ts never imports the suppression gate nor calls isSuppressed', () => {
    const emailTs = read('lib/email.ts')
    // No suppression read in the transport / transactional templates — an 'all'
    // row therefore cannot block a receipt/security email (they never consult it).
    expect(emailTs).not.toMatch(/email-suppression/)
    expect(emailTs).not.toMatch(/isSuppressed/)
  })
})

describe('every bulk sender is wired to the gate', () => {
  const senders = [
    'newsletter',
    'consumer-digest',
    'claim-outreach',
    'claim-follow-up',
    'abandoned-checkout',
    'weekly-report', // covers BOTH the enhanced report and the TOTW congrats
  ]
  for (const s of senders) {
    it(`${s} consults isSuppressed`, () => {
      expect(read(`app/api/cron/${s}/route.ts`)).toMatch(/isSuppressed/)
    })
  }
})

describe('G6-2 client forwards the stream (the un-renderable React half of the round-trip)', () => {
  it('unsubscribe-client reads ?type= and forwards { email, stream }', () => {
    const client = read('app/unsubscribe/unsubscribe-client.tsx')
    expect(client).toMatch(/searchParams\.get\('type'\)/)
    expect(client).toMatch(/\{ email, stream \}/)
  })
})

describe('the 3 folded senders carry a VISIBLE stream-correct unsubscribe link', () => {
  it('abandoned-checkout template links type=abandoned-checkout', () => {
    expect(read('lib/email.ts')).toMatch(/type=abandoned-checkout/)
  })
  it('weekly-report (enhanced + TOTW) links type=weekly-report', () => {
    const weekly = read('app/api/cron/weekly-report/route.ts')
    expect(weekly.match(/type=weekly-report/g)?.length).toBeGreaterThanOrEqual(2)
  })
})

describe('G6-3 webhook hardening (source ordering)', () => {
  it('pins the Node runtime and fails CLOSED on the secret BEFORE constructing the verifier', () => {
    const wh = read('app/api/webhooks/resend/route.ts')
    expect(wh).toMatch(/runtime = 'nodejs'/)
    // Markers unique to CODE (not the surrounding comments): the 503 guard's
    // error code, and the raw-body verification call.
    const guardIdx = wh.indexOf("'NOT_CONFIGURED'")
    const verifyIdx = wh.indexOf('.verify(rawBody')
    expect(guardIdx).toBeGreaterThan(-1)
    expect(verifyIdx).toBeGreaterThan(guardIdx)
  })
})
