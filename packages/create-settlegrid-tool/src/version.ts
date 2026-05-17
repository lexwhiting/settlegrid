/**
 * Resolve this package's own version from its package.json.
 *
 * Works from both `src/` (dev / vitest) and `dist/` (the published
 * tarball) because package.json sits exactly one level above either
 * directory: `src/version.ts` → `../package.json`, and
 * `dist/version.js` → `../package.json`.
 *
 * Never throws — a missing or unparseable package.json degrades to
 * `'unknown'` so a `--version` print or a telemetry `cli_version`
 * property fails soft instead of crashing the process.
 */
import { readFileSync } from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

export function readPackageVersion(): string {
  try {
    const here = path.dirname(fileURLToPath(import.meta.url))
    const pkgPath = path.resolve(here, '..', 'package.json')
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as {
      version?: unknown
    }
    return typeof pkg.version === 'string' && pkg.version.length > 0
      ? pkg.version
      : 'unknown'
  } catch {
    return 'unknown'
  }
}
