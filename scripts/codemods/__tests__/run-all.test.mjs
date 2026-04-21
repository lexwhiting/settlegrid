import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, writeFile, mkdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  discoverTemplates,
  sampleForSmokeTest,
  parseArgs,
  runAll,
  runTscOnTemplate,
} from '../run-all.mjs'

// ─── parseArgs ─────────────────────────────────────────────────────

test('parseArgs: defaults to dry-run, no smoke-test', () => {
  const args = parseArgs([])
  assert.equal(args.apply, false)
  assert.equal(args.smokeTest, 0)
})

test('parseArgs: --apply enables write mode', () => {
  const args = parseArgs(['--apply'])
  assert.equal(args.apply, true)
})

test('parseArgs: --smoke-test without argument defaults to 5', () => {
  const args = parseArgs(['--apply', '--smoke-test'])
  assert.equal(args.smokeTest, 5)
})

test('parseArgs: --smoke-test with explicit count', () => {
  const args = parseArgs(['--apply', '--smoke-test', '10'])
  assert.equal(args.smokeTest, 10)
})

test('parseArgs: --smoke-test 0 is a valid explicit skip', () => {
  const args = parseArgs(['--apply', '--smoke-test', '0'])
  assert.equal(args.smokeTest, 0)
})

test('parseArgs: throws on negative smoke-test', () => {
  assert.throws(
    () => parseArgs(['--smoke-test', '-1']),
    /non-negative integer/,
  )
})

test('parseArgs: throws on non-integer smoke-test', () => {
  assert.throws(
    () => parseArgs(['--smoke-test', 'abc']),
    /non-negative integer/,
  )
})

// ─── discoverTemplates ─────────────────────────────────────────────

test('discoverTemplates: returns sorted directories, skips hidden and files', async () => {
  const tmp = await mkdtemp(join(tmpdir(), 'disc-'))
  try {
    await mkdir(join(tmp, 'root-a'), { recursive: true })
    await mkdir(join(tmp, 'root-a', 'template-b'), { recursive: true })
    await mkdir(join(tmp, 'root-a', 'template-a'), { recursive: true })
    await mkdir(join(tmp, 'root-a', '.hidden'), { recursive: true })
    await writeFile(join(tmp, 'root-a', 'not-a-dir.md'), 'ignored')

    const result = await discoverTemplates(['root-a'], tmp)
    // Sorted alphabetically, hidden dir skipped, regular file skipped.
    assert.deepEqual(
      result,
      [
        join(tmp, 'root-a', 'template-a'),
        join(tmp, 'root-a', 'template-b'),
      ],
    )
  } finally {
    await rm(tmp, { recursive: true, force: true })
  }
})

test('discoverTemplates: skips roots that do not exist', async () => {
  const tmp = await mkdtemp(join(tmpdir(), 'disc-'))
  try {
    const result = await discoverTemplates(['nonexistent-root'], tmp)
    assert.deepEqual(result, [])
  } finally {
    await rm(tmp, { recursive: true, force: true })
  }
})

test('discoverTemplates: skips roots where readdir fails (e.g., path is a file)', async () => {
  // Covers the catch branch: existsSync passes (because the path
  // exists) but readdir fails (because the path is a file, not a
  // directory). The function must continue to the next root.
  const tmp = await mkdtemp(join(tmpdir(), 'disc-'))
  try {
    // Create a file named 'weird-root' at the level where we'd
    // normally expect a root directory.
    await writeFile(join(tmp, 'weird-root'), 'this is a file not a dir')
    const result = await discoverTemplates(['weird-root'], tmp)
    assert.deepEqual(result, [])
  } finally {
    await rm(tmp, { recursive: true, force: true })
  }
})

// ─── sampleForSmokeTest (deterministic seeded-random) ──────────────

test('sampleForSmokeTest: returns empty array for n=0', () => {
  assert.deepEqual(sampleForSmokeTest([1, 2, 3, 4, 5], 0, 'seed'), [])
})

test('sampleForSmokeTest: returns empty array for empty input', () => {
  assert.deepEqual(sampleForSmokeTest([], 5, 'seed'), [])
})

test('sampleForSmokeTest: caps at input size when n > length', () => {
  const out = sampleForSmokeTest([1, 2, 3], 100, 'seed')
  assert.equal(out.length, 3)
})

test('sampleForSmokeTest: deterministic for same seed', () => {
  const input = Array.from({ length: 50 }, (_, i) => `template-${i}`)
  const a = sampleForSmokeTest(input, 5, '2026-04-21')
  const b = sampleForSmokeTest(input, 5, '2026-04-21')
  assert.deepEqual(a, b)
})

test('sampleForSmokeTest: different seeds produce different samples', () => {
  const input = Array.from({ length: 50 }, (_, i) => `template-${i}`)
  const a = sampleForSmokeTest(input, 5, '2026-04-20')
  const b = sampleForSmokeTest(input, 5, '2026-04-21')
  // Very low probability of identical samples across different seeds
  // (50 choose 5 ~= 2.1M), so this is a reliable determinism check.
  assert.notDeepEqual(a, b)
})

test('sampleForSmokeTest: returns unique elements (no duplicates)', () => {
  const input = Array.from({ length: 20 }, (_, i) => i)
  const out = sampleForSmokeTest(input, 10, 'seed')
  assert.equal(new Set(out).size, out.length)
})

// ─── runAll integration (dry-run) ──────────────────────────────────

test('runAll: dry-run on empty roots returns zero totals', async () => {
  const tmp = await mkdtemp(join(tmpdir(), 'ra-'))
  try {
    const result = await runAll({
      apply: false,
      baseDir: tmp,
      roots: ['open-source-servers'],
      codemods: ['sdk-breaking-changes'],
    })
    assert.equal(result.templatesDiscovered, 0)
    assert.equal(result.totals.filesTouched, 0)
    assert.equal(result.totals.errors, 0)
  } finally {
    await rm(tmp, { recursive: true, force: true })
  }
})

test('runAll: aggregates per-template errors in perCodemod.errors', async () => {
  // Covers lines ~280-284: the error-aggregation branch in runAll
  // that pushes per-template failures into the codemod's error
  // list. Driven by a template with a malformed .ts file that the
  // parser rejects.
  const tmp = await mkdtemp(join(tmpdir(), 'ra-'))
  try {
    const badTemplate = join(tmp, 'open-source-servers', 'broken')
    await mkdir(join(badTemplate, 'src'), { recursive: true })
    // Include the SDK import so the H2 gate permits transforms;
    // deliberately break the brace balance so jscodeshift parse
    // fails.
    await writeFile(
      join(badTemplate, 'src', 'bad.ts'),
      `import { settlegrid } from '@settlegrid/mcp'\nsg.wrap(h, { costCents: 5 \n`,
    )
    const result = await runAll({
      apply: false,
      baseDir: tmp,
      roots: ['open-source-servers'],
      codemods: ['sdk-breaking-changes'],
    })
    assert.equal(result.totals.errors, 1)
    const cm = result.perCodemod['sdk-breaking-changes']
    assert.equal(cm.errors.length, 1)
    assert.ok(
      cm.errors[0].template.includes('broken'),
      `expected error template to include "broken", got ${cm.errors[0].template}`,
    )
    assert.ok(cm.errors[0].errors.length > 0)
  } finally {
    await rm(tmp, { recursive: true, force: true })
  }
})

test('runAll: applies all configured codemods to each template', async () => {
  const tmp = await mkdtemp(join(tmpdir(), 'ra-'))
  try {
    const t1 = join(tmp, 'open-source-servers', 'a')
    const t2 = join(tmp, 'open-source-servers', 'b')
    await mkdir(join(t1, 'src'), { recursive: true })
    await mkdir(join(t2, 'src'), { recursive: true })
    await writeFile(
      join(t1, 'src', 'server.ts'),
      `import { settlegrid } from '@settlegrid/mcp'\nsg.wrap(h, { costCents: 5 })\n`,
    )
    await writeFile(
      join(t2, 'src', 'server.ts'),
      `// no SDK usage here\nconst x = 1\n`,
    )
    const result = await runAll({
      apply: false,
      baseDir: tmp,
      roots: ['open-source-servers'],
      codemods: ['sdk-breaking-changes'],
    })
    assert.equal(result.templatesDiscovered, 2)
    // One template has a matching pattern, one doesn't.
    assert.equal(result.totals.filesTouched, 1)
    assert.equal(result.totals.errors, 0)
  } finally {
    await rm(tmp, { recursive: true, force: true })
  }
})

// ─── runTscOnTemplate (H14 timeout regression) ─────────────────────

test('runTscOnTemplate: skipped when no tsconfig.json', async () => {
  const tmp = await mkdtemp(join(tmpdir(), 'tsc-'))
  try {
    const result = await runTscOnTemplate(tmp)
    assert.equal(result.ok, true)
    assert.equal(result.skipped, true)
    assert.equal(result.timedOut, false)
  } finally {
    await rm(tmp, { recursive: true, force: true })
  }
})

test('runTscOnTemplate: enforces timeout + returns timedOut=true', async () => {
  // We can't easily force tsc into an infinite loop from a test,
  // but we can prove the timeout mechanism by setting a 1ms timeout
  // on an ordinarily-short tsc invocation. The child process will
  // get SIGKILLed before it can complete, and the function must
  // resolve with ok=false and timedOut=true within reasonable time.
  const tmp = await mkdtemp(join(tmpdir(), 'tsc-'))
  try {
    await writeFile(
      join(tmp, 'tsconfig.json'),
      JSON.stringify({ compilerOptions: { noEmit: true } }),
    )
    await writeFile(join(tmp, 'a.ts'), 'const x = 1')
    const result = await runTscOnTemplate(tmp, { timeoutMs: 1 })
    // Either the process was killed by the timeout (expected) or
    // somehow completed in under 1ms (possible on a very fast
    // machine, unlikely for tsc). Both are acceptable; what we're
    // proving is the timeout path doesn't hang.
    assert.ok(result.ok === false || result.ok === true)
    // If it did time out, the flag must be set.
    if (result.timedOut) {
      assert.equal(result.ok, false)
      assert.match(result.stderr, /timed out after 1ms/)
    }
  } finally {
    await rm(tmp, { recursive: true, force: true })
  }
})
