import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { checkSeedTarget, SEED_POOL_MAX } from '../seed-guard'

const LOCAL = 'postgres://postgres:pw@localhost:5432/postgres'
const REMOTE = 'postgres://postgres.abc:pw@aws-0-us-east-1.pooler.supabase.com:6543/postgres'

describe('checkSeedTarget', () => {
  it('allows a local database outside production', () => {
    expect(checkSeedTarget(LOCAL, {})).toEqual({ ok: true, host: 'localhost' })
    expect(checkSeedTarget('postgres://u:p@127.0.0.1:54322/postgres', { NODE_ENV: 'development' }).ok).toBe(true)
  })

  it('refuses whenever NODE_ENV or VERCEL_ENV is production, even for a local host', () => {
    expect(checkSeedTarget(LOCAL, { NODE_ENV: 'production' }).ok).toBe(false)
    expect(checkSeedTarget(LOCAL, { VERCEL_ENV: 'production' }).ok).toBe(false)
    expect(checkSeedTarget(REMOTE, { VERCEL_ENV: 'production', SEED_REMOTE_HOST: 'aws-0-us-east-1.pooler.supabase.com' }).ok).toBe(false)
  })

  it('refuses a remote host unless that exact host is confirmed', () => {
    expect(checkSeedTarget(REMOTE, {}).ok).toBe(false)
    expect(checkSeedTarget(REMOTE, { SEED_REMOTE_HOST: 'other.example.com' }).ok).toBe(false)
    expect(checkSeedTarget(REMOTE, { SEED_REMOTE_HOST: 'pooler.supabase.com' }).ok).toBe(false)
    expect(checkSeedTarget(REMOTE, { SEED_REMOTE_HOST: ' AWS-0-us-east-1.pooler.supabase.com ' })).toEqual({
      ok: true,
      host: 'aws-0-us-east-1.pooler.supabase.com',
    })
  })

  it('refuses a missing or malformed DATABASE_URL', () => {
    expect(checkSeedTarget(undefined, {}).ok).toBe(false)
    expect(checkSeedTarget('', {}).ok).toBe(false)
    expect(checkSeedTarget('not a url', {}).ok).toBe(false)
  })

  it('never puts the URL credentials in the refusal reason', () => {
    const check = checkSeedTarget(REMOTE, {})
    expect(check.ok).toBe(false)
    if (!check.ok) expect(check.reason).not.toContain(':pw@')
  })
})

describe('seed scripts', () => {
  const dir = resolve(__dirname, '../../../../scripts')
  const seeds = readdirSync(dir).filter((f) => /^seed-.*\.ts$/.test(f))

  it('finds the seed scripts', () => {
    expect(seeds.length).toBeGreaterThan(0)
  })

  it.each(seeds)('%s checks its target before connecting and uses one connection', (file) => {
    const src = readFileSync(join(dir, file), 'utf8')
    expect(src).toMatch(/assertSeedTarget\(/)
    expect(src).not.toMatch(/max:\s*[2-9]/)
    const ownClient = src.indexOf('postgres(')
    if (ownClient !== -1) {
      expect(src.indexOf('assertSeedTarget(')).toBeLessThan(ownClient)
      expect(src).toMatch(/max:\s*SEED_POOL_MAX/)
    }
    expect(SEED_POOL_MAX).toBe(1)
  })
})
