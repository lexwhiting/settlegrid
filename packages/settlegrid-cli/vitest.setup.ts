/**
 * P4.1 — vitest setup.
 *
 * Telemetry is opt-out by default in tests. The dedicated
 * `src/telemetry.test.ts` deletes the env var in its own
 * beforeEach, so capture flow is still exercised under test.
 */
process.env.SETTLEGRID_TELEMETRY = process.env.SETTLEGRID_TELEMETRY ?? '0'
