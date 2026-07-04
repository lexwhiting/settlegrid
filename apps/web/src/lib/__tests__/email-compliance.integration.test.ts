/**
 * email-compliance (G6-1 / G6-2 / G6-3) — real-Postgres (pglite) integration
 * tests for the canonical email-suppression gate, on the SAME drizzle-kit
 * pushSchema harness as ensure-twin.integration.test.ts (real UNIQUE + real
 * ON CONFLICT — the load-bearing dedup/normalization properties are invisible
 * to a mock db).
 *
 * PROVES:
 *   - suppress/isSuppressed stream scope ('all' ⊇ every stream; exact-stream
 *     match) + normalization identity across the write/read boundary + the
 *     idempotent ON CONFLICT upsert.
 *   - G6-2 WRITE-SEAM round-trip: the exact body the unsubscribe client emits
 *     for a `type=<stream>` link, driven through the REAL POST /api/unsubscribe
 *     handler, writes the CORRECT `(email, stream)` row (NOT 'outreach') and
 *     makes isSuppressed(email, stream) — the digest/report/checkout sender's
 *     skip predicate — return true. Not a bare suppress()/isSuppressed() unit
 *     test. (The React client half is un-renderable here — no jsdom/RTL/
 *     react-test-renderer in the repo — so its `type`→body forwarding is pinned
 *     structurally in email-suppression.test.ts.)
 *   - G6-1: GET /api/newsletter/unsubscribe returns NON-405 and persists the
 *     opt-out (table row + case-insensitive newsletter_subscribed flip).
 *   - G6-3 webhook security: a VALID signed email.complained → (email,'all');
 *     an INVALID signature → 400 and NO row; redelivery → idempotent; hard vs
 *     soft bounce; unset secret → 503.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { createRequire } from 'node:module'
import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import { and, eq } from 'drizzle-orm'
import { NextRequest } from 'next/server'
import { Webhook } from 'svix'

const { pushSchema } = createRequire(import.meta.url)('drizzle-kit/api') as typeof import('drizzle-kit/api')

const holder = vi.hoisted(() => ({ db: null as unknown as ReturnType<typeof drizzle> }))
vi.mock('@/lib/db', () => ({
  db: new Proxy(
    {},
    {
      get(_t, prop, recv) {
        const real = holder.db as unknown as Record<string | symbol, unknown>
        if (!real) throw new Error('pglite db not initialized (beforeAll did not run)')
        const value = Reflect.get(real, prop, recv)
        return typeof value === 'function' ? (value as (...a: unknown[]) => unknown).bind(real) : value
      },
    },
  ),
}))
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))
vi.mock('@/lib/rate-limit', () => ({
  getClientIp: (h: Headers) => h.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown-ip',
  apiLimiter: {},
  authLimiter: {},
  sdkLimiter: {},
  checkRateLimit: vi.fn().mockResolvedValue({ success: true, limit: 100, remaining: 99, reset: 0 }),
}))
// In-memory Redis so the legacy outreach union + the /api/unsubscribe outreach
// fallback write don't need a live Upstash instance.
const redisStore = vi.hoisted(() => new Map<string, string>())
vi.mock('@/lib/redis', () => ({
  getRedis: () => ({
    get: async (k: string) => redisStore.get(k) ?? null,
    set: async (k: string, v: unknown) => {
      redisStore.set(k, String(v))
      return 'OK'
    },
  }),
  tryRedis: async (fn: () => Promise<unknown>) => {
    try {
      return await fn()
    } catch {
      return null
    }
  },
}))

import * as schema from '@/lib/db/schema'
import { suppress, isSuppressed } from '@/lib/email-suppression'
import { POST as unsubscribePOST } from '@/app/api/unsubscribe/route'
import { GET as newsletterGET, POST as newsletterPOST } from '@/app/api/newsletter/unsubscribe/route'
import { POST as resendPOST } from '@/app/api/webhooks/resend/route'

let pg: PGlite
let db: ReturnType<typeof drizzle>

const WEBHOOK_SECRET = 'whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw'

beforeAll(async () => {
  pg = new PGlite()
  await pg.waitReady
  db = drizzle(pg, { schema })
  const res = await pushSchema(schema as Record<string, unknown>, db as never)
  await res.apply()
  holder.db = db
  process.env.RESEND_WEBHOOK_SECRET = WEBHOOK_SECRET
}, 60_000)

afterAll(async () => {
  await pg?.close()
  delete process.env.RESEND_WEBHOOK_SECRET
})

beforeEach(async () => {
  vi.clearAllMocks()
  redisStore.clear()
  process.env.RESEND_WEBHOOK_SECRET = WEBHOOK_SECRET
  await pg.exec('TRUNCATE "email_suppressions", "consumers", "processed_webhook_events" RESTART IDENTITY CASCADE')
})

const rows = (email: string, stream?: string) =>
  db
    .select()
    .from(schema.emailSuppressions)
    .where(
      stream
        ? and(eq(schema.emailSuppressions.email, email), eq(schema.emailSuppressions.stream, stream))
        : eq(schema.emailSuppressions.email, email),
    )

function jsonPost(url: string, body: unknown): NextRequest {
  return new NextRequest(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

// ── suppress + isSuppressed core semantics ───────────────────────────────────
describe('suppress + isSuppressed', () => {
  it("'all' suppresses EVERY bulk stream (bounce/complaint scope)", async () => {
    await suppress('user@x.com', 'all', 'complaint', 'resend-webhook')
    expect(await isSuppressed('user@x.com', 'newsletter')).toBe(true)
    expect(await isSuppressed('user@x.com', 'consumer-digest')).toBe(true)
    expect(await isSuppressed('user@x.com', 'weekly-report')).toBe(true)
    expect(await isSuppressed('user@x.com', 'abandoned-checkout')).toBe(true)
    expect(await isSuppressed('user@x.com', 'outreach')).toBe(true)
  })

  it('an exact-stream suppression matches ONLY that stream (not others)', async () => {
    await suppress('a@x.com', 'consumer-digest', 'unsubscribe', 'link')
    expect(await isSuppressed('a@x.com', 'consumer-digest')).toBe(true)
    expect(await isSuppressed('a@x.com', 'newsletter')).toBe(false)
    expect(await isSuppressed('a@x.com', 'weekly-report')).toBe(false)
  })

  it('normalizes across the write/read boundary (mixed case + whitespace)', async () => {
    await suppress('  MixedCase@X.COM ', 'newsletter', 'unsubscribe', 'link')
    // stored normalized
    const [row] = await rows('mixedcase@x.com', 'newsletter')
    expect(row).toBeTruthy()
    // read with different casing still matches
    expect(await isSuppressed('MIXEDCASE@x.com', 'newsletter')).toBe(true)
  })

  it('finds a NON-normalized (admin/manual) row via the lower(email) index — the read honors the DB backstop', async () => {
    // A row written OUTSIDE suppress() (the schema-documented source:'admin' /
    // reason:'manual' path — e.g. a hand-typed Supabase insert for a legal/abuse
    // takedown) stores a mixed-case email. The unique index is on lower(email),
    // so the row is canonically deduped; isSuppressed MUST match it too. For
    // consumer-digest / weekly-report / abandoned-checkout the table is the ONLY
    // gate, so a read miss = the sender keeps mailing a suppressed address; and a
    // mixed-case 'all' row would make a later genuine complaint no-op on conflict.
    await db
      .insert(schema.emailSuppressions)
      .values({ email: 'Manual@Admin.COM', stream: 'consumer-digest', reason: 'manual', source: 'admin' })
    expect(await isSuppressed('manual@admin.com', 'consumer-digest')).toBe(true)
    // an un-normalized 'all' row must still block every bulk stream
    await db
      .insert(schema.emailSuppressions)
      .values({ email: 'Dead@Box.IO', stream: 'all', reason: 'bounce', source: 'admin' })
    expect(await isSuppressed('dead@box.io', 'weekly-report')).toBe(true)
  })

  it('is idempotent — a re-suppress does NOT create a second row (ON CONFLICT)', async () => {
    await suppress('dup@x.com', 'newsletter', 'unsubscribe', 'link')
    await suppress('dup@x.com', 'newsletter', 'unsubscribe', 'list-unsub-post')
    expect((await rows('dup@x.com', 'newsletter')).length).toBe(1)
  })

  it('returns false for a never-suppressed address', async () => {
    expect(await isSuppressed('clean@x.com', 'newsletter')).toBe(false)
  })

  it('unions the legacy Redis unsub:outreach: key (transition safety)', async () => {
    redisStore.set('unsub:outreach:legacy@x.com', '1')
    expect(await isSuppressed('legacy@x.com', 'outreach')).toBe(true)
    // legacy outreach key must NOT bleed into other streams
    expect(await isSuppressed('legacy@x.com', 'newsletter')).toBe(false)
  })

  it('unions the legacy Redis bounce:outreach: key (send-failure suppression)', async () => {
    redisStore.set('bounce:outreach:bounced@x.com', '1')
    expect(await isSuppressed('bounced@x.com', 'outreach')).toBe(true)
  })
})

// ── G6-2 WRITE-SEAM round-trip ───────────────────────────────────────────────
describe('G6-2 /api/unsubscribe write-seam round-trip', () => {
  // The client forwards `type` as `stream`; drive the EXACT body it emits.
  for (const stream of ['consumer-digest', 'weekly-report', 'abandoned-checkout'] as const) {
    it(`type=${stream} → writes (email,'${stream}') and the sender's skip predicate becomes true (NOT 'outreach')`, async () => {
      const email = `rt-${stream}@x.com`
      const res = await unsubscribePOST(
        jsonPost('https://settlegrid.ai/api/unsubscribe', { email, stream }),
      )
      expect(res.status).toBe(200)
      // correct stream row written
      expect((await rows(email, stream)).length).toBe(1)
      // the digest/report/checkout sender's `if (await isSuppressed(...)) skip`
      // predicate now holds
      expect(await isSuppressed(email, stream)).toBe(true)
      // the OLD G6-2 bug wrote 'outreach' — assert it did NOT
      expect((await rows(email, 'outreach')).length).toBe(0)
    })
  }

  it("back-compat: a bare {email} POST (no stream) writes 'outreach' + the legacy Redis key", async () => {
    const email = 'legacy-link@x.com'
    const res = await unsubscribePOST(jsonPost('https://settlegrid.ai/api/unsubscribe', { email }))
    expect(res.status).toBe(200)
    expect((await rows(email, 'outreach')).length).toBe(1)
    expect(redisStore.get(`unsub:outreach:${email}`)).toBe('1')
  })

  it('RFC-8058 one-click POST reads the address from the URL QUERY (not the form body)', async () => {
    const email = 'oneclick@x.com'
    const req = new NextRequest(
      `https://settlegrid.ai/api/unsubscribe?email=${encodeURIComponent(email)}&stream=consumer-digest`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: 'List-Unsubscribe=One-Click',
      },
    )
    const res = await unsubscribePOST(req)
    expect(res.status).toBe(200)
    const [row] = await rows(email, 'consumer-digest')
    expect(row).toBeTruthy()
    expect(row.source).toBe('list-unsub-post')
  })
})

// ── G6-1 newsletter unsubscribe (fixes the 405) ──────────────────────────────
describe('G6-1 newsletter unsubscribe', () => {
  it('GET returns NON-405 and persists the opt-out (table row + case-insensitive flip)', async () => {
    // consumers.email is stored trimmed but NOT lowercased — seed a mixed-case row.
    await db.insert(schema.consumers).values({ email: 'News@Reader.com', newsletterSubscribed: true })
    const res = await newsletterGET(
      new NextRequest('https://settlegrid.ai/api/newsletter/unsubscribe?email=news@reader.com'),
    )
    expect(res.status).not.toBe(405)
    expect(res.status).toBe(200)
    // canonical table row
    expect((await rows('news@reader.com', 'newsletter')).length).toBe(1)
    // durable fallback flip found the mixed-case row via lower() match
    const [c] = await db
      .select()
      .from(schema.consumers)
      .where(eq(schema.consumers.email, 'News@Reader.com'))
    expect(c.newsletterSubscribed).toBe(false)
  })

  it('one-click POST (form body + query email) persists without a 400', async () => {
    const req = new NextRequest(
      'https://settlegrid.ai/api/newsletter/unsubscribe?email=oneclick-nl@x.com',
      {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: 'List-Unsubscribe=One-Click',
      },
    )
    const res = await newsletterPOST(req)
    expect(res.status).toBe(200)
    expect((await rows('oneclick-nl@x.com', 'newsletter')).length).toBe(1)
  })
})

// ── G6-3 Resend/Svix webhook (security boundary) ─────────────────────────────
describe('G6-3 Resend webhook', () => {
  function signed(payloadObj: unknown, opts: { id?: string; tamper?: boolean } = {}): NextRequest {
    const id = opts.id ?? 'msg_test_1'
    const payload = JSON.stringify(payloadObj)
    const wh = new Webhook(WEBHOOK_SECRET)
    const timestamp = new Date()
    const signature = wh.sign(id, timestamp, payload)
    return new NextRequest('https://settlegrid.ai/api/webhooks/resend', {
      method: 'POST',
      headers: {
        'svix-id': id,
        'svix-timestamp': Math.floor(timestamp.getTime() / 1000).toString(),
        'svix-signature': opts.tamper ? 'v1,dGFtcGVyZWRfc2lnbmF0dXJl' : signature,
        'content-type': 'application/json',
      },
      body: payload,
    })
  }

  it('VALID email.complained → suppresses (normalized email, all) + 200', async () => {
    const res = await resendPOST(
      signed({ type: 'email.complained', data: { to: ['Victim@Example.COM'] } }),
    )
    expect(res.status).toBe(200)
    const [row] = await rows('victim@example.com', 'all')
    expect(row).toBeTruthy()
    expect(row.reason).toBe('complaint')
    expect(row.source).toBe('resend-webhook')
  })

  it('INVALID signature → 400 AND writes NO row (the forgery guard)', async () => {
    const res = await resendPOST(
      signed({ type: 'email.complained', data: { to: ['forged@x.com'] } }, { tamper: true }),
    )
    expect(res.status).toBe(400)
    // Assert the 400 is the SIGNATURE rejection specifically (not the
    // missing-headers 400) — the request is well-formed with all three svix
    // headers present and only svix-signature tampered, so it reaches .verify().
    expect((await res.json()).code).toBe('INVALID_SIGNATURE')
    expect((await rows('forged@x.com')).length).toBe(0)
  })

  it('redelivery of the same svix-id is idempotent (one row, duplicate ack)', async () => {
    const payload = { type: 'email.complained', data: { to: ['dupe@x.com'] } }
    const first = await resendPOST(signed(payload, { id: 'msg_dupe' }))
    expect(first.status).toBe(200)
    const second = await resendPOST(signed(payload, { id: 'msg_dupe' }))
    expect(second.status).toBe(200)
    expect((await second.json()).duplicate).toBe(true)
    expect((await rows('dupe@x.com', 'all')).length).toBe(1)
  })

  it('PERMANENT (hard) bounce → suppresses (email,all)', async () => {
    const res = await resendPOST(
      signed({
        type: 'email.bounced',
        data: { to: ['dead@x.com'], bounce: { type: 'Permanent' } },
      }),
    )
    expect(res.status).toBe(200)
    expect((await rows('dead@x.com', 'all')).length).toBe(1)
  })

  it('TRANSIENT (soft) bounce → writes NO row (would kill a live address)', async () => {
    const res = await resendPOST(
      signed({
        type: 'email.bounced',
        data: { to: ['temp@x.com'], bounce: { type: 'Transient' } },
      }),
    )
    expect(res.status).toBe(200)
    expect((await rows('temp@x.com')).length).toBe(0)
  })

  it('unset RESEND_WEBHOOK_SECRET → 503 NOT_CONFIGURED, writes NO row', async () => {
    delete process.env.RESEND_WEBHOOK_SECRET
    const res = await resendPOST(
      signed({ type: 'email.complained', data: { to: ['x@x.com'] } }),
    )
    expect(res.status).toBe(503)
    expect((await rows('x@x.com')).length).toBe(0)
    process.env.RESEND_WEBHOOK_SECRET = WEBHOOK_SECRET
  })
})
