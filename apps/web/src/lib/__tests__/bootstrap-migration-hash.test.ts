/**
 * Regression teeth (email-compliance ③ post-seal deep audit, 2026-07-04).
 *
 * The bootstrap script seeds `drizzle.__drizzle_migrations` with, per its own
 * documented convention (scripts/bootstrap__drizzle_migrations.sql:18-20),
 * `hash = sha256(<migration file content>)` — "same algorithm drizzle-orm's
 * migrator uses (crypto.createHash('sha256').update(fs.readFileSync(path)))".
 *
 * The ③ deep audit found the 0018_email_suppressions hash had gone STALE: the
 * 0018 SQL file was edited during ② (its deploy-ordering header was corrected
 * for consumer-digest migration-first), which changed its sha256, but the
 * seeded hash row was not re-derived — so the founder-gated launch checklist's
 * own `shasum -a 256` verification would MISMATCH and a wrong hash would be
 * written into the prod ledger. This pins the invariant: the seeded hash MUST
 * equal the current file's sha256 (guards the "edit the file, forget the hash"
 * recurrence — a SEAM defect between the artifact and its derived digest).
 */
import { describe, it, expect } from 'vitest'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const APP_ROOT = path.resolve(__dirname, '../../..')
const bootstrap = readFileSync(
  path.join(APP_ROOT, 'scripts/bootstrap__drizzle_migrations.sql'),
  'utf8',
)

/** sha256 of the raw file bytes — byte-for-byte what drizzle-orm and `shasum -a 256` compute. */
function fileSha256(rel: string): string {
  return createHash('sha256').update(readFileSync(path.join(APP_ROOT, rel))).digest('hex')
}

describe('0018_email_suppressions migration ledger-hash parity', () => {
  it('the seeded __drizzle_migrations hash equals the current 0018 file sha256', () => {
    const sha = fileSha256('drizzle/0018_email_suppressions.sql')
    // The bootstrap seeds the hash in a `SELECT '<hash>'` INSERT guarded by a
    // matching `WHERE NOT EXISTS (... hash = '<hash>')`, so the correct hash must
    // appear in the file; a stale hash (the ③ defect) makes this fail.
    expect(bootstrap).toContain(sha)
  })

  it('the pre-correction stale hash is no longer seeded anywhere', () => {
    // The stale value the ② header edit orphaned. Its presence would mean the
    // ledger row still attests the wrong file content.
    expect(bootstrap).not.toContain('41ac48c4cfb2d2b158171de0ce368754b74927e8630980fb1ad9d87b7fada4ed')
  })
})
