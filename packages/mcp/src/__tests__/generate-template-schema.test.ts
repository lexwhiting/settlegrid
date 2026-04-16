/**
 * Integration tests for the `postbuild` JSON Schema generation script.
 *
 * The script (`scripts/generate-template-schema.cjs`) is a standalone
 * CJS file that reads the built Zod schema from `dist/index.js` and
 * writes a JSON Schema to `schemas/template.schema.json`. We spawn
 * it as a child process with env-var overrides for the dist entry
 * path (`SETTLEGRID_DIST_ENTRY`) and the output file
 * (`SETTLEGRID_SCHEMA_OUT`) so every test runs in isolation without
 * touching real build artifacts.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const SCRIPT_PATH = resolve(__dirname, '..', '..', 'scripts', 'generate-template-schema.cjs')
const REAL_DIST = resolve(__dirname, '..', '..', 'dist', 'index.js')

/** Spawn the script with env overrides and return result. */
function runScript(env: Record<string, string>) {
  return spawnSync('node', [SCRIPT_PATH], {
    env: { ...process.env, ...env },
    encoding: 'utf-8',
    timeout: 30_000,
  })
}

describe('generate-template-schema.cjs', () => {
  let sandbox: string

  beforeAll(() => {
    sandbox = mkdtempSync(join(tmpdir(), 'settlegrid-gen-'))
  })

  afterAll(() => {
    rmSync(sandbox, { recursive: true, force: true })
  })

  // ─── Error paths ──────────────────────────────────────────────────────────

  it('exits 1 with clear message when dist entry does not exist', () => {
    const missing = join(sandbox, 'nonexistent.js')
    const result = runScript({ SETTLEGRID_DIST_ENTRY: missing })

    expect(result.status).toBe(1)
    expect(result.stderr).toContain('not found')
    expect(result.stderr).toContain(missing)
    expect(result.stderr).toContain('postbuild')
  })

  it('exits 1 when dist entry throws on require', () => {
    const throws = join(sandbox, 'throws.cjs')
    writeFileSync(throws, 'throw new Error("module load boom");\n', 'utf-8')
    const result = runScript({ SETTLEGRID_DIST_ENTRY: throws })

    expect(result.status).toBe(1)
    expect(result.stderr).toContain('failed to require')
    expect(result.stderr).toContain('module load boom')
  })

  it('exits 1 when dist entry exports without templateManifestSchema', () => {
    const empty = join(sandbox, 'empty-export.cjs')
    writeFileSync(empty, 'module.exports = { foo: 1 };\n', 'utf-8')
    const result = runScript({ SETTLEGRID_DIST_ENTRY: empty })

    expect(result.status).toBe(1)
    expect(result.stderr).toContain('templateManifestSchema')
    expect(result.stderr).toContain('re-export')
  })

  // ─── Happy path ───────────────────────────────────────────────────────────

  it('generates a valid JSON Schema file from the real dist and exits 0', () => {
    // Guard: if dist hasn't been built, skip rather than giving a
    // false negative. CI / the audit chain always runs build first.
    if (!existsSync(REAL_DIST)) {
      process.stderr.write(
        `SKIP: dist/index.js not found at ${REAL_DIST} — run \`npm run build\` first.\n`,
      )
      return
    }

    const outPath = join(sandbox, 'output.json')
    const result = runScript({
      SETTLEGRID_DIST_ENTRY: REAL_DIST,
      SETTLEGRID_SCHEMA_OUT: outPath,
    })

    expect(result.status).toBe(0)
    expect(result.stdout).toContain('generate-template-schema: wrote')

    // Output file must exist, parse as JSON, and have expected shape.
    expect(existsSync(outPath)).toBe(true)
    const schema = JSON.parse(readFileSync(outPath, 'utf-8'))
    expect(schema).toHaveProperty('definitions')
    expect(schema.definitions).toHaveProperty('TemplateManifest')
    expect(schema.definitions.TemplateManifest.type).toBe('object')

    // Verify the httpUrl hardening pattern survived the round-trip.
    const repoUrl = schema.definitions.TemplateManifest.properties.repo.properties.url
    expect(repoUrl.pattern).toMatch(/https/)
    expect(repoUrl.format).toBe('uri')

    // Verify pricing.perCallUsdCents is integer after .int() hardening.
    const pricing = schema.definitions.TemplateManifest.properties.pricing
    expect(pricing.properties.perCallUsdCents.type).toBe('integer')
  })
})
