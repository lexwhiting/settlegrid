/**
 * sendNotificationEmail outcomes against real SQL (pglite): developer preferences and
 * the email_suppressions table are real; the Resend call (sendEmail) is mocked.
 *
 * - 'sent' when sendEmail succeeds; 'failed' when it returns false or throws.
 * - 'opted_out' when the developer turned the event off.
 * - Account notices never consult the bulk-mail suppression table (its documented
 *   invariant): an address with an 'all' suppression still gets them; Resend's own
 *   suppression list handles delivery to bounced or complained addresses.
 * - Critical notices are sent regardless of preferences.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import * as schema from '@/lib/db/schema'

const holder = vi.hoisted(() => ({ db: null as unknown as ReturnType<typeof drizzle> }))
const sendEmail = vi.hoisted(() => vi.fn(async (): Promise<boolean> => true))

vi.mock('@/lib/db', () => ({ get db() { return holder.db } }))
vi.mock('@/lib/email', () => ({ sendEmail }))

import { sendNotificationEmail } from '@/lib/notifications'

const BOOTSTRAP_SQL = `
  CREATE TABLE developers (id uuid PRIMARY KEY, notification_preferences jsonb);
  CREATE TABLE email_suppressions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email text NOT NULL,
    stream text NOT NULL, reason text NOT NULL, source text, created_at timestamptz NOT NULL DEFAULT now());
  CREATE UNIQUE INDEX email_suppressions_lower_email_stream_idx ON email_suppressions (lower(email), stream);
`

const DEV = 'd0000000-0000-4000-8000-000000000001'
const OPTED_OUT = 'd0000000-0000-4000-8000-000000000002'
let pg: PGlite

const notify = (developerId: string, email: string, critical?: boolean) =>
  sendNotificationEmail({ developerId, eventKey: 'quality_alert', email, subject: 'S', html: '<p>H</p>', critical })

beforeAll(async () => {
  pg = new PGlite()
  await pg.waitReady
  await pg.exec(BOOTSTRAP_SQL)
  holder.db = drizzle(pg, { schema })
  await pg.query(`INSERT INTO developers (id, notification_preferences) VALUES ($1, '{}'), ($2, '{"quality_alert": false}')`, [DEV, OPTED_OUT])
  await pg.query(`INSERT INTO email_suppressions (email, stream, reason, source) VALUES
    ('bounced@example.com', 'all', 'bounce', 'resend-webhook'),
    ('complained@example.com', 'all', 'complaint', 'resend-webhook'),
    ('reader@example.com', 'newsletter', 'unsubscribe', 'link')`)
}, 60_000)

afterAll(async () => {
  await pg?.close()
})

beforeEach(() => {
  sendEmail.mockReset()
  sendEmail.mockResolvedValue(true)
})

describe('sendNotificationEmail outcomes (pglite)', () => {
  it("returns 'sent' when the email goes out", async () => {
    expect(await notify(DEV, 'dev@example.com')).toBe('sent')
    expect(sendEmail).toHaveBeenCalledWith({ to: 'dev@example.com', subject: 'S', html: '<p>H</p>' })
  })

  it('passes an idempotency key through to Resend', async () => {
    expect(await sendNotificationEmail({ developerId: DEV, eventKey: 'quality_alert', email: 'dev@example.com', subject: 'S', html: '<p>H</p>', idempotencyKey: 'k1' })).toBe('sent')
    expect(sendEmail).toHaveBeenCalledWith({ to: 'dev@example.com', subject: 'S', html: '<p>H</p>', idempotencyKey: 'k1' })
  })

  it("returns 'opted_out' and sends nothing when the developer turned the event off", async () => {
    expect(await notify(OPTED_OUT, 'dev@example.com')).toBe('opted_out')
    expect(sendEmail).not.toHaveBeenCalled()
  })

  it('does not consult the bulk-mail suppression table for an account notice', async () => {
    expect(await notify(DEV, 'bounced@example.com')).toBe('sent')
    expect(await notify(DEV, 'complained@example.com')).toBe('sent')
    expect(await notify(DEV, 'reader@example.com')).toBe('sent')
    expect(sendEmail).toHaveBeenCalledTimes(3)
  })

  it("returns 'failed' when Resend refuses the email or the call throws", async () => {
    sendEmail.mockResolvedValueOnce(false)
    expect(await notify(DEV, 'dev@example.com')).toBe('failed')
    sendEmail.mockRejectedValueOnce(new Error('network'))
    expect(await notify(DEV, 'dev@example.com')).toBe('failed')
  })

  it('sends a critical notice regardless of preferences', async () => {
    expect(await notify(OPTED_OUT, 'dev@example.com', true)).toBe('sent')
    expect(sendEmail).toHaveBeenCalledTimes(1)
  })
})
