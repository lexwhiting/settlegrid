import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { promises as fsp } from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { sync, parseArgs, type SyncOptions } from '../sync-templater-runs.js'

// Mirrors the agent-emitter summary shape just enough to pass
// looksLikeSummary().
function writeSummary(
  dir: string,
  filename: string,
  body: Record<string, unknown>,
) {
  return fsp.writeFile(path.join(dir, filename), JSON.stringify(body), 'utf-8')
}

const baseSummary = {
  runId: 'run-2026-04-19T10-00-00-000Z',
  startedAt: '2026-04-19T10:00:00.000Z',
  totalAttempts: 10,
  passed: 7,
  topFailureClusters: [],
}

describe('parseArgs', () => {
  const run = (flags: string[]) =>
    parseArgs(['node', 'sync-templater-runs.ts', ...flags])

  it('defaults to source + dest when no flags', () => {
    const opts = run([])
    expect(opts.source).toMatch(/agents\/data\/templater\/runs$/)
    expect(opts.dest).toMatch(/apps\/web\/src\/data\/templater-runs$/)
    expect(opts.dryRun).toBe(false)
  })

  it('overrides source + dest via flags', () => {
    const opts = run(['--source', '/a', '--dest', '/b'])
    expect(opts.source).toBe('/a')
    expect(opts.dest).toBe('/b')
  })

  it('sets dryRun with --dry-run', () => {
    expect(run(['--dry-run']).dryRun).toBe(true)
  })
})

describe('sync', () => {
  let src: string
  let dst: string

  beforeEach(async () => {
    src = await fsp.mkdtemp(path.join(os.tmpdir(), 'templater-sync-src-'))
    dst = await fsp.mkdtemp(path.join(os.tmpdir(), 'templater-sync-dst-'))
  })

  afterEach(async () => {
    await fsp.rm(src, { recursive: true, force: true })
    await fsp.rm(dst, { recursive: true, force: true })
  })

  const opts = (): SyncOptions => ({ source: src, dest: dst, dryRun: false })

  it('reports sourceMissing when source dir does not exist', async () => {
    const r = await sync({
      source: path.join(src, 'nope'),
      dest: dst,
      dryRun: false,
    })
    expect(r.sourceMissing).toBe(true)
    expect(r.copied).toHaveLength(0)
  })

  it('copies a single summary and normalizes the filename to <runId>.json', async () => {
    await writeSummary(src, 'arbitrary-name-summary.json', baseSummary)
    const r = await sync(opts())
    expect(r.copied).toEqual([`${baseSummary.runId}.json`])
    expect(r.invalid).toHaveLength(0)
    const written = await fsp.readdir(dst)
    expect(written).toEqual([`${baseSummary.runId}.json`])
  })

  // --- hostile: idempotency -------------------------------------------

  it('is idempotent on a second identical run', async () => {
    await writeSummary(src, 'a-summary.json', baseSummary)
    const first = await sync(opts())
    expect(first.copied).toHaveLength(1)
    const second = await sync(opts())
    expect(second.copied).toHaveLength(0)
    expect(second.unchanged).toHaveLength(1)
  })

  it('re-writes when the source content changes', async () => {
    await writeSummary(src, 'a-summary.json', baseSummary)
    await sync(opts())
    // Source mutated — a new dashboard read should see the update
    await writeSummary(src, 'a-summary.json', {
      ...baseSummary,
      passed: 99,
    })
    const r = await sync(opts())
    expect(r.copied).toHaveLength(1)
    const written = JSON.parse(
      await fsp.readFile(
        path.join(dst, `${baseSummary.runId}.json`),
        'utf-8',
      ),
    )
    expect(written.passed).toBe(99)
  })

  // --- hostile: ingestion validation ----------------------------------

  it('skips files that parse but are missing required summary fields', async () => {
    await writeSummary(src, 'bogus-summary.json', { hello: 'world' })
    const r = await sync(opts())
    expect(r.copied).toHaveLength(0)
    expect(r.invalid).toHaveLength(1)
    expect(r.invalid[0].reason).toMatch(/missing required summary fields/)
  })

  it('skips files that do not parse as JSON', async () => {
    await fsp.writeFile(path.join(src, 'broken-summary.json'), '{ bad')
    const r = await sync(opts())
    expect(r.copied).toHaveLength(0)
    expect(r.invalid).toHaveLength(1)
    expect(r.invalid[0].reason).toMatch(/JSON parse/)
  })

  it('ignores files that do not end in -summary.json', async () => {
    await writeSummary(src, 'some-run.jsonl', baseSummary)
    await writeSummary(src, 'random.json', baseSummary)
    const r = await sync(opts())
    expect(r.copied).toHaveLength(0)
    expect(r.unchanged).toHaveLength(0)
  })

  // --- hostile: path traversal via runId ------------------------------

  it('neutralizes dangerous runIds with a safe-slug transform', async () => {
    await writeSummary(src, 'attack-summary.json', {
      ...baseSummary,
      runId: '../../../etc/passwd',
    })
    const r = await sync(opts())
    expect(r.copied).toHaveLength(1)
    // The unsafe chars are replaced with underscores — destination
    // stays inside dst/ and no files escape outside it.
    const written = await fsp.readdir(dst)
    expect(written[0]).not.toContain('..')
    expect(written[0]).not.toContain('/')
    expect(written[0]).toMatch(/\.json$/)
  })

  // --- dry run --------------------------------------------------------

  it('makes no writes in dry-run mode', async () => {
    await writeSummary(src, 'a-summary.json', baseSummary)
    const r = await sync({ ...opts(), dryRun: true })
    expect(r.copied).toHaveLength(1)
    // dst dir still empty because dry-run skipped writes
    const written = await fsp.readdir(dst)
    expect(written).toHaveLength(0)
  })
})
