/**
 * `cli_install_started` postinstall hook for `create-settlegrid-tool`.
 *
 * Runs once per `npm install` / `npx create-settlegrid-tool` (when
 * npx resolves a fresh install rather than a warm cache). Captures
 * the canonical `cli_install_started` event with the user's Node
 * version + OS for funnel analysis.
 *
 * ## Hostile invariants
 *
 *   - MUST NOT throw — a postinstall failure aborts the consumer's
 *     `npm install`. We swallow every error and exit cleanly.
 *     (package.json also appends `|| true` as belt-and-suspenders.)
 *   - MUST NOT block longer than ~2.5 seconds — the telemetry fetch
 *     has its own AbortController timeout, but we also enforce a
 *     process-level timeout via `setTimeout(process.exit, ...)`.
 *   - MUST respect `SETTLEGRID_TELEMETRY=0` + CI — handled inside
 *     `captureCliInstallStarted` via the shared opt-out check.
 *   - MUST be silent on stdout/stderr — postinstall noise is
 *     adversarial UX (some package managers treat it as a warning).
 *
 * The shebang at the top is added by tsup's `banner` config so
 * `node ./dist/postinstall.js` works from any package manager.
 */
import { captureCliInstallStarted } from './telemetry.js'
import { readPackageVersion } from './version.js'

const SAFETY_EXIT_MS = 2500

;(async () => {
  // Belt-and-suspenders process-level kill switch: if the fetch
  // somehow doesn't honour its AbortController (Node version bug,
  // event-loop wedged) we still exit cleanly within ~2.5s. unref()
  // means this timer doesn't keep the process alive once the
  // telemetry call resolves normally.
  const safety = setTimeout(() => process.exit(0), SAFETY_EXIT_MS)
  safety.unref()

  try {
    await captureCliInstallStarted({ cli_version: readPackageVersion() })
  } catch {
    // Telemetry never throws into product code, but a defensive
    // catch here is cheap insurance against future refactors.
  } finally {
    clearTimeout(safety)
    process.exit(0)
  }
})()
