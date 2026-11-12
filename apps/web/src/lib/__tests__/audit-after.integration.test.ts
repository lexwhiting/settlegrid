/**
 * writeAuditLog against real SQL (pglite).
 *
 * Most callers don't await writeAuditLog. The callback it registers with after()
 * must stay pending until the insert has landed, so the platform keeps the
 * invocation alive and the row is persisted.
 *
 * The table is a test-only CREATE TABLE with the columns of `auditLogs` in
 * lib/db/schema.ts (no drizzle-kit, no migrations). The code under test inserts
 * through the real drizzle table definition.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import * as schema from '@/lib/db/schema'

const holder = vi.hoisted(() => ({ db: null as unknown as ReturnType<typeof drizzle> }))
const { mockAfter, mockLogError } = vi.hoisted(() => ({ mockAfter: vi.fn(), mockLogError: vi.fn() }))

vi.mock('next/server', () => ({ after: mockAfter }))
vi.mock('@/lib/db', () => ({ get db() { return holder.db } }))
vi.mock('@/lib/logger', () => ({ logger: { error: mockLogError, warn: vi.fn(), info: vi.fn() } }))

import { writeAuditLog } from '@/lib/audit'

const BOOTSTRAP_SQL = `
  CREATE TABLE audit_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    developer_id uuid,
    consumer_id uuid,
    action text NOT NULL,
    resource_type text NOT NULL,
    resource_id text,
    details jsonb,
    ip_address text,
    user_agent text,
    created_at timestamptz NOT NULL DEFAULT now()
  );
`

const DEVELOPER_ID = '11111111-1111-4111-8111-111111111111'
const ENTRY = {
  developerId: DEVELOPER_ID,
  action: 'settings.notifications_updated',
  resourceType: 'developer',
  details: { channel: 'email' },
} as const

let pg: PGlite
const rows = async () =>
  (await pg.query<{ developer_id: string; action: string; resource_type: string; details: unknown }>(
    'SELECT developer_id, action, resource_type, details FROM audit_logs',
  )).rows

/** Holds the database busy, so a write issued meanwhile stays pending until `release()`. */
function holdDatabase() {
  let release!: () => void
  const gate = new Promise<void>((resolve) => { release = resolve })
  const held = pg.transaction(async () => { await gate })
  return { release: async () => { release(); await held } }
}

beforeAll(async () => {
  pg = new PGlite()
  await pg.waitReady
  await pg.exec(BOOTSTRAP_SQL)
  holder.db = drizzle(pg, { schema })
}, 60_000)

afterAll(async () => {
  await pg?.close()
})

beforeEach(async () => {
  vi.clearAllMocks()
  await pg.exec('TRUNCATE audit_logs')
})

describe('writeAuditLog (pglite)', () => {
  it('registers a callback with after() that stays pending until the un-awaited write is persisted', async () => {
    const database = holdDatabase()
    let done!: Promise<void>
    let settled = false
    try {
      void writeAuditLog(ENTRY) // not awaited, as most callers do

      expect(mockAfter).toHaveBeenCalledTimes(1)
      done = (mockAfter.mock.calls[0][0] as () => Promise<void>)()
      void done.then(() => { settled = true })

      await new Promise((resolve) => setTimeout(resolve, 50))
      expect(settled).toBe(false) // the insert is still waiting for the database
    } finally {
      await database.release()
    }
    await done
    expect(settled).toBe(true)
    expect(await rows()).toEqual([
      { developer_id: DEVELOPER_ID, action: 'settings.notifications_updated', resource_type: 'developer', details: { channel: 'email' } },
    ])
  }, 20_000)

  it('persists the row when called outside a request scope, where after() throws', async () => {
    mockAfter.mockImplementationOnce(() => {
      throw new Error('`after` was called outside a request scope')
    })
    await writeAuditLog(ENTRY)
    expect(await rows()).toHaveLength(1)
  }, 20_000)

  it('resolves, logs and leaves no row when the insert fails', async () => {
    await expect(writeAuditLog({ ...ENTRY, developerId: 'not-a-uuid' })).resolves.toBeUndefined()
    expect(mockAfter).toHaveBeenCalledTimes(1)
    await expect((mockAfter.mock.calls[0][0] as () => Promise<void>)()).resolves.toBeUndefined()
    expect(mockLogError).toHaveBeenCalledWith('audit.write_failed', { action: 'settings.notifications_updated' }, expect.anything())
    expect(await rows()).toHaveLength(0)
  }, 20_000)
})
