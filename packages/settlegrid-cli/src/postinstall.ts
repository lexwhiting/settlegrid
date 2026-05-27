/**
 * P4.1 — `cli_install_started` postinstall hook.
 *
 * Runs once per `npm install -g settlegrid` (and once per local
 * `npm install` if the consumer adds the CLI as a devDependency).
 * Captures the canonical `cli_install_started` event with the user's
 * Node version + OS for funnel analysis.
 *
 * ## Hostile invariants
 *
 *   - MUST NOT throw — a postinstall failure aborts the consumer's
 *     `npm install`. We swallow every error and exit cleanly.
 *   - MUST NOT block longer than ~2 seconds — the telemetry fetch
 *     has its own AbortController-based timeout, but we also enforce
 *     a process-level timeout via `setTimeout(process.exit, ...)`.
 *   - MUST respect `SETTLEGRID_TELEMETRY=0` — handled inside
 *     `captureCliInstallStarted` via the shared opt-out check.
 *   - MUST be silent on stdout/stderr — postinstall noise is
 *     adversarial UX (some package managers treat it as a warning).
 *
 * The shebang at the top is added by tsup's `banner.js` config so
 * `node ./dist/postinstall.js` works from any package manager.
 */
import { readFileSync } from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { captureCliInstallStarted } from './telemetry.js'

const SAFETY_EXIT_MS = 2500

function readCliVersion(): string {
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

;(async () => {
  // Belt-and-suspenders process-level kill switch: if the fetch
  // somehow doesn't honour its AbortController (Node version bug,
  // event-loop wedged) we still exit cleanly within ~2.5s. unref()
  // means this timer doesn't keep the process alive once the
  // telemetry call resolves normally.
  const safety = setTimeout(() => process.exit(0), SAFETY_EXIT_MS)
  safety.unref()

  try {
    await captureCliInstallStarted({ cli_version: readCliVersion() })
  } catch {
    // Telemetry never throws into product code, but defensive catch
    // here is cheap insurance against future refactors.
  } finally {
    clearTimeout(safety)
    process.exit(0)
  }
})()
