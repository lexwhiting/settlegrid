/**
 * P4.1 — vitest setup.
 *
 * Telemetry is opt-out by default in tests so existing init() /
 * meter() tests don't trigger outbound fetch attempts to the
 * proxy. Tests that exercise the telemetry module itself
 * (`__tests__/telemetry.test.ts`) delete the env var in their
 * own beforeEach.
 */
process.env.SETTLEGRID_TELEMETRY = process.env.SETTLEGRID_TELEMETRY ?? '0'
