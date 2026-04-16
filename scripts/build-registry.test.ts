import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { writeFile, mkdir, readFile, rm, mkdtemp } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { buildRegistry, type RegistryJson } from './build-registry'

// ── Fixtures ───────────────────────────────────────────────────────────────

const VALID_TEMPLATE = {
  slug: 'test-weather',
  name: 'Weather API Server',
  description: 'MCP server for weather data with SettleGrid billing.',
  version: '1.0.0',
  category: 'data',
  tags: ['weather', 'api'],
  author: { name: 'Test Author', github: 'testuser' },
  repo: { type: 'git', url: 'https://github.com/test/weather' },
  runtime: 'node',
  languages: ['ts'],
  entry: 'src/index.ts',
  pricing: { model: 'free' },
  quality: { tests: true },
  capabilities: ['weather-lookup'],
  featured: false,
}

const MINIMAL_TEMPLATE = {
  slug: 'test-minimal',
  name: 'Minimal',
  description: 'A minimal test template.',
  version: '0.1.0',
  category: 'other',
  tags: [],
  author: { name: 'Min' },
  repo: { type: 'git', url: 'https://github.com/test/minimal' },
  runtime: 'node',
  languages: ['js'],
  entry: 'index.js',
  pricing: { model: 'free' },
  quality: { tests: false },
  capabilities: [],
  featured: false,
}

const INVALID_TEMPLATE = {
  slug: 'INVALID-CAPS',
  name: '',
  version: 'not-semver',
}

// ── Test setup ─────────────────────────────────────────────────────────────

let tmpRoot: string
let tmpOutput: string

beforeEach(async () => {
  tmpRoot = await mkdtemp(join(tmpdir(), 'sg-registry-test-'))
  tmpOutput = await mkdtemp(join(tmpdir(), 'sg-registry-out-'))

  for (const [dirName, data] of [
    ['settlegrid-test-weather', VALID_TEMPLATE],
    ['settlegrid-test-minimal', MINIMAL_TEMPLATE],
    ['settlegrid-test-invalid', INVALID_TEMPLATE],
  ] as const) {
    const dir = join(tmpRoot, dirName)
    await mkdir(dir, { recursive: true })
    await writeFile(join(dir, 'template.json'), JSON.stringify(data))
  }
})

afterEach(async () => {
  await rm(tmpRoot, { recursive: true, force: true })
  await rm(tmpOutput, { recursive: true, force: true })
})

// ── Tests ──────────────────────────────────────────────────────────────────

describe('build-registry', () => {
  it('strict mode fails on invalid manifests with aggregated report', async () => {
    await expect(
      buildRegistry({
        templateRoots: [tmpRoot],
        outputDir: tmpOutput,
        strict: true,
      }),
    ).rejects.toThrow(/Strict mode: 1 invalid manifest/)
  })

  it('non-strict mode skips invalid and returns 2 valid templates', async () => {
    const { registry, skipped } = await buildRegistry({
      templateRoots: [tmpRoot],
      outputDir: tmpOutput,
      strict: false,
    })

    expect(registry.totalTemplates).toBe(2)
    expect(skipped).toHaveLength(1)
    expect(skipped[0].dir).toBe('settlegrid-test-invalid')
    expect(registry.templates.map((t) => t.slug)).toEqual([
      'test-minimal',
      'test-weather',
    ])
  })

  it('writes registry.json and per-slug JSON files', async () => {
    await buildRegistry({
      templateRoots: [tmpRoot],
      outputDir: tmpOutput,
      strict: false,
    })

    // registry.json
    const content = await readFile(join(tmpOutput, 'registry.json'), 'utf-8')
    const parsed: RegistryJson = JSON.parse(content)

    expect(parsed.version).toBe(1)
    expect(parsed.totalTemplates).toBe(2)
    expect(parsed.templates).toHaveLength(2)

    // Per-slug files
    const weather = JSON.parse(
      await readFile(join(tmpOutput, 'templates', 'test-weather.json'), 'utf-8'),
    )
    expect(weather.slug).toBe('test-weather')

    const minimal = JSON.parse(
      await readFile(join(tmpOutput, 'templates', 'test-minimal.json'), 'utf-8'),
    )
    expect(minimal.slug).toBe('test-minimal')
  })

  it('output is deterministic across two runs (ignoring generatedAt/commit)', async () => {
    await buildRegistry({
      templateRoots: [tmpRoot],
      outputDir: tmpOutput,
      strict: false,
    })
    const file1 = await readFile(join(tmpOutput, 'registry.json'), 'utf-8')

    await buildRegistry({
      templateRoots: [tmpRoot],
      outputDir: tmpOutput,
      strict: false,
    })
    const file2 = await readFile(join(tmpOutput, 'registry.json'), 'utf-8')

    // Normalize the two fields that are expected to change
    const normalize = (s: string) =>
      s
        .replace(/"generatedAt":\s*"[^"]+"/, '"generatedAt": "REDACTED"')
        .replace(/"commit":\s*"[^"]+"/, '"commit": "REDACTED"')

    expect(normalize(file1)).toEqual(normalize(file2))
  })

  it('--only filters to a single template', async () => {
    const { registry } = await buildRegistry({
      templateRoots: [tmpRoot],
      outputDir: tmpOutput,
      strict: false,
      only: 'test-weather',
    })

    expect(registry.totalTemplates).toBe(1)
    expect(registry.templates[0].slug).toBe('test-weather')
  })

  it('categories are sorted alphabetically', async () => {
    const { registry } = await buildRegistry({
      templateRoots: [tmpRoot],
      outputDir: tmpOutput,
      strict: false,
    })

    const catKeys = Object.keys(registry.categories)
    expect(catKeys).toEqual([...catKeys].sort())
  })

  it('handles non-existent template roots gracefully', async () => {
    const { registry } = await buildRegistry({
      templateRoots: ['/tmp/sg-nonexistent-root-' + Date.now()],
      outputDir: tmpOutput,
      strict: false,
    })

    expect(registry.totalTemplates).toBe(0)
    expect(registry.templates).toEqual([])
  })

  it('rejects duplicate slugs — strict mode errors, non-strict keeps first', async () => {
    // Create a second directory with the SAME slug as VALID_TEMPLATE
    const dupeDir = join(tmpRoot, 'settlegrid-zzz-dupe')
    await mkdir(dupeDir, { recursive: true })
    await writeFile(
      join(dupeDir, 'template.json'),
      JSON.stringify({ ...VALID_TEMPLATE, name: 'Duplicate Entry' }),
    )

    // Strict mode: should error on the duplicate
    await expect(
      buildRegistry({
        templateRoots: [tmpRoot],
        outputDir: tmpOutput,
        strict: true,
      }),
    ).rejects.toThrow(/Duplicate slug 'test-weather'/)

    // Non-strict mode: first occurrence wins, duplicate is skipped
    const { registry, skipped } = await buildRegistry({
      templateRoots: [tmpRoot],
      outputDir: tmpOutput,
      strict: false,
    })

    const weatherEntries = registry.templates.filter(
      (t) => t.slug === 'test-weather',
    )
    expect(weatherEntries).toHaveLength(1)
    expect(weatherEntries[0].name).toBe('Weather API Server') // first wins

    const dupeSkip = skipped.find((s) => s.dir === 'settlegrid-zzz-dupe')
    expect(dupeSkip).toBeDefined()
    expect(dupeSkip!.errors[0]).toContain('Duplicate slug')
  })

  it('cleans up stale per-slug .json files from previous runs', async () => {
    // Run 1: build with all 3 fixtures (2 valid)
    await buildRegistry({
      templateRoots: [tmpRoot],
      outputDir: tmpOutput,
      strict: false,
    })

    const weatherPath = join(tmpOutput, 'templates', 'test-weather.json')
    const minimalPath = join(tmpOutput, 'templates', 'test-minimal.json')

    // Both per-slug files exist
    await expect(readFile(weatherPath, 'utf-8')).resolves.toBeTruthy()
    await expect(readFile(minimalPath, 'utf-8')).resolves.toBeTruthy()

    // Run 2: build with only the minimal template (remove the weather fixture)
    await rm(join(tmpRoot, 'settlegrid-test-weather'), {
      recursive: true,
      force: true,
    })

    await buildRegistry({
      templateRoots: [tmpRoot],
      outputDir: tmpOutput,
      strict: false,
    })

    // minimal still exists, weather was cleaned up
    await expect(readFile(minimalPath, 'utf-8')).resolves.toBeTruthy()
    await expect(readFile(weatherPath, 'utf-8')).rejects.toThrow(/ENOENT/)
  })

  it('does not clean up non-slug .json files or non-.json files', async () => {
    const templatesDir = join(tmpOutput, 'templates')
    await mkdir(templatesDir, { recursive: true })

    // Plant a non-slug .json file and a .txt file
    await writeFile(join(templatesDir, 'Config.json'), '{}')
    await writeFile(join(templatesDir, 'notes.txt'), 'keep me')

    await buildRegistry({
      templateRoots: [tmpRoot],
      outputDir: tmpOutput,
      strict: false,
    })

    // Non-slug .json (uppercase C) is NOT cleaned up
    await expect(
      readFile(join(templatesDir, 'Config.json'), 'utf-8'),
    ).resolves.toBe('{}')

    // .txt is untouched
    await expect(
      readFile(join(templatesDir, 'notes.txt'), 'utf-8'),
    ).resolves.toBe('keep me')
  })
})
