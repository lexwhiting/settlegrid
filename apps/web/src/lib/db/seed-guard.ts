/**
 * Guard for the one-off seed scripts in apps/web/scripts (seed-*.ts).
 *
 * Seeds write sample or account rows, so they must not reach the production
 * database. There is no staging database and a local .env.local can hold the
 * production DATABASE_URL, so a seed refuses to start unless:
 *  - NODE_ENV and VERCEL_ENV are not 'production', and
 *  - the database host is local, or the operator has typed that exact host into
 *    SEED_REMOTE_HOST (a deliberate, per-host confirmation for a non-production
 *    database; never set it to the production host).
 *
 * Seeds also use a single connection (SEED_POOL_MAX): they run their statements
 * one after another, and a seed must never open a large pool against a pooler.
 */

export const SEED_POOL_MAX = 1

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]', 'host.docker.internal'])

export type SeedTargetCheck = { ok: true; host: string } | { ok: false; reason: string }

export function checkSeedTarget(
  databaseUrl: string | undefined,
  env: Record<string, string | undefined> = process.env,
): SeedTargetCheck {
  if (env.NODE_ENV === 'production' || env.VERCEL_ENV === 'production') {
    return { ok: false, reason: 'NODE_ENV or VERCEL_ENV is "production"; seeds never run in production.' }
  }
  if (!databaseUrl) {
    return { ok: false, reason: 'DATABASE_URL is not set.' }
  }
  let host: string
  try {
    host = new URL(databaseUrl).hostname.toLowerCase()
  } catch {
    return { ok: false, reason: 'DATABASE_URL is not a valid URL.' }
  }
  if (!host) {
    return { ok: false, reason: 'DATABASE_URL has no host.' }
  }
  if (LOCAL_HOSTS.has(host)) {
    return { ok: true, host }
  }
  const confirmed = (env.SEED_REMOTE_HOST ?? '').trim().toLowerCase()
  if (confirmed && confirmed === host) {
    return { ok: true, host }
  }
  return {
    ok: false,
    reason:
      `DATABASE_URL points at a remote host (${host}). Seeds run only against a local database, ` +
      'or a non-production host typed exactly into SEED_REMOTE_HOST.',
  }
}

/** Exits the process (code 1) when the target is not safe for a seed. */
export function assertSeedTarget(scriptName: string, databaseUrl: string | undefined): void {
  const check = checkSeedTarget(databaseUrl)
  if (!check.ok) {
    console.error(`${scriptName}: refusing to run. ${check.reason}`)
    process.exit(1)
  }
}
