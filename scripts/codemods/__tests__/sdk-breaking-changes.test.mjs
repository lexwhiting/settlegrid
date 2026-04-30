import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, writeFile, mkdir, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  renameCostCentsToPriceCents,
  rewriteLegacyImportPath,
  renameSgErrorToSettleGridError,
  removeSgDebugCalls,
  applyAllTransforms,
  fileReferencesSdk,
  TRANSFORMS,
  run,
} from '../sdk-breaking-changes.mjs'

// ─── renameCostCentsToPriceCents ──────────────────────────────────

test('costCents → priceCents: renames inside sg.wrap options', () => {
  const before = `
    import { settlegrid } from '@settlegrid/mcp'
    const sg = settlegrid.init({ toolSlug: 'weather' })
    const billed = sg.wrap(handler, { costCents: 5 })
  `
  const { changed, source } = renameCostCentsToPriceCents(before)
  assert.equal(changed, true)
  assert.ok(source.includes('priceCents: 5'))
  assert.ok(!source.includes('costCents'))
})

test('costCents → priceCents: is idempotent (second run is no-op)', () => {
  const before = `const billed = sg.wrap(h, { costCents: 5 })`
  const pass1 = renameCostCentsToPriceCents(before)
  const pass2 = renameCostCentsToPriceCents(pass1.source)
  assert.equal(pass1.changed, true)
  assert.equal(pass2.changed, false)
  assert.equal(pass2.source, pass1.source)
})

test('costCents → priceCents: leaves costCents alone outside sg.wrap', () => {
  const before = `
    const config = { costCents: 5 }
    const out = somethingElse.call({ costCents: 99 })
  `
  const { changed } = renameCostCentsToPriceCents(before)
  assert.equal(changed, false)
})

test('costCents → priceCents: no-op when source does not mention costCents', () => {
  const { changed, source } = renameCostCentsToPriceCents('const x = 1')
  assert.equal(changed, false)
  assert.equal(source, 'const x = 1')
})

test('costCents → priceCents: preserves other properties in the options object', () => {
  const before = `sg.wrap(h, { costCents: 5, currency: 'USD', debug: true })`
  const { source } = renameCostCentsToPriceCents(before)
  assert.ok(source.includes('priceCents: 5'))
  assert.ok(source.includes("currency: 'USD'"))
  assert.ok(source.includes('debug: true'))
})

// ─── rewriteLegacyImportPath ──────────────────────────────────────

test('legacy import path: rewrites to canonical path', () => {
  const before = `import { helper } from '@settlegrid/mcp/legacy'`
  const { changed, source } = rewriteLegacyImportPath(before)
  assert.equal(changed, true)
  // jscodeshift may normalize quote style; accept either single or
  // double quotes around the module name.
  assert.ok(
    source.includes("'@settlegrid/mcp'") ||
      source.includes('"@settlegrid/mcp"'),
  )
  assert.ok(!source.includes('/legacy'))
})

test('legacy import path: is idempotent', () => {
  const before = `import { helper } from '@settlegrid/mcp/legacy'`
  const pass1 = rewriteLegacyImportPath(before)
  const pass2 = rewriteLegacyImportPath(pass1.source)
  assert.equal(pass1.changed, true)
  assert.equal(pass2.changed, false)
  assert.equal(pass2.source, pass1.source)
})

test('legacy import path: rewrites dynamic import()', () => {
  const before = `
    const m = await import('@settlegrid/mcp/legacy')
  `
  const { changed, source } = rewriteLegacyImportPath(before)
  assert.equal(changed, true)
  assert.ok(!source.includes('/legacy'))
})

test('legacy import path: leaves @settlegrid/mcp imports alone', () => {
  const before = `import { settlegrid } from '@settlegrid/mcp'`
  const { changed } = rewriteLegacyImportPath(before)
  assert.equal(changed, false)
})

// ─── renameSgErrorToSettleGridError ───────────────────────────────

test('SGError → SettleGridError: renames named import', () => {
  const before = `import { SGError } from '@settlegrid/mcp'`
  const { changed, source } = renameSgErrorToSettleGridError(before)
  assert.equal(changed, true)
  assert.ok(source.includes('SettleGridError'))
  assert.ok(!source.includes('SGError'))
})

test('SGError → SettleGridError: renames instanceof references', () => {
  const before = `
    import { SGError } from '@settlegrid/mcp'
    try { /* ... */ } catch (e) { if (e instanceof SGError) { /* ... */ } }
  `
  const { source } = renameSgErrorToSettleGridError(before)
  assert.ok(source.includes('e instanceof SettleGridError'))
  assert.ok(!source.includes('SGError'))
})

test('SGError → SettleGridError: is idempotent', () => {
  const before = `import { SGError } from '@settlegrid/mcp'`
  const pass1 = renameSgErrorToSettleGridError(before)
  const pass2 = renameSgErrorToSettleGridError(pass1.source)
  assert.equal(pass1.changed, true)
  assert.equal(pass2.changed, false)
  assert.equal(pass2.source, pass1.source)
})

test('SGError → SettleGridError: leaves unrelated identifiers alone', () => {
  const before = `
    import { SGError } from '@settlegrid/mcp'
    const SGErrorLog = []
    throw new SGError('x')
  `
  const { source } = renameSgErrorToSettleGridError(before)
  // SGErrorLog contains "SGError" as a prefix of its own identifier;
  // we must NOT rename it. The transform operates at AST-identifier
  // level, not a text-replace — so this is tested by leaving the
  // full identifier intact.
  assert.ok(source.includes('SGErrorLog'))
})

test('SGError → SettleGridError: preserves aliased imports', () => {
  const before = `
    import { SGError as MyError } from '@settlegrid/mcp'
    throw new MyError('x')
  `
  const { source } = renameSgErrorToSettleGridError(before)
  // The imported name is renamed, but the local alias MyError is
  // user-chosen and left intact.
  assert.ok(source.includes('SettleGridError as MyError'))
  assert.ok(source.includes('new MyError'))
})

// ─── removeSgDebugCalls ───────────────────────────────────────────

test('sg.debug removal: removes bare-call statements', () => {
  const before = `
    function main() {
      sg.debug()
      doWork()
    }
  `
  const { changed, source } = removeSgDebugCalls(before)
  assert.equal(changed, true)
  assert.ok(!source.includes('sg.debug'))
  assert.ok(source.includes('doWork()'))
})

test('sg.debug removal: removes calls with arguments', () => {
  const before = `sg.debug('checkpoint-1')`
  const { changed, source } = removeSgDebugCalls(before)
  assert.equal(changed, true)
  assert.ok(!source.includes('sg.debug'))
})

test('sg.debug removal: is idempotent', () => {
  const before = `
    sg.debug()
    keepThis()
  `
  const pass1 = removeSgDebugCalls(before)
  const pass2 = removeSgDebugCalls(pass1.source)
  assert.equal(pass1.changed, true)
  assert.equal(pass2.changed, false)
  assert.equal(pass2.source, pass1.source)
})

test('sg.debug removal: leaves other sg methods alone', () => {
  const before = `
    sg.wrap(handler)
    sg.meter('call', 1)
    sg.init()
  `
  const { changed, source } = removeSgDebugCalls(before)
  assert.equal(changed, false)
  assert.equal(source, before)
})

// ─── applyAllTransforms ───────────────────────────────────────────

test('applyAllTransforms: runs every transform in sequence', () => {
  const before = `
    import { SGError, helper } from '@settlegrid/mcp/legacy'
    const sg = settlegrid.init({ toolSlug: 't' })
    const billed = sg.wrap(handler, { costCents: 5 })
    sg.debug('checkpoint')
    if (err instanceof SGError) throw err
  `
  const { changed, source, touchedBy } = applyAllTransforms(before)
  assert.equal(changed, true)
  assert.ok(touchedBy.length >= 3)
  // All four transforms match different patterns in this source, so
  // we expect all four to have fired.
  assert.deepEqual(
    new Set(touchedBy),
    new Set([
      'rename-costCents-to-priceCents',
      'rewrite-legacy-import-path',
      'rename-SGError-to-SettleGridError',
      'remove-sg-debug-calls',
    ]),
  )
  assert.ok(!source.includes('costCents'))
  assert.ok(!source.includes('/legacy'))
  assert.ok(!source.includes('sg.debug'))
  assert.ok(source.includes('SettleGridError'))
})

test('applyAllTransforms: is idempotent (hostile audit (c) requirement)', () => {
  const before = `
    import { SGError } from '@settlegrid/mcp/legacy'
    sg.wrap(h, { costCents: 5 })
    sg.debug()
    throw new SGError('x')
  `
  const pass1 = applyAllTransforms(before)
  const pass2 = applyAllTransforms(pass1.source)
  assert.equal(pass1.changed, true)
  assert.equal(pass2.changed, false)
  assert.equal(pass2.source, pass1.source)
  assert.deepEqual(pass2.touchedBy, [])
})

// --- H2 regression: file-level SDK-presence gate -----------------
// Without the gate, a third-party library using `.wrap(h, {
// costCents: 5 })` or a local `SGError` class would be
// misrenamed. The gate skips any file that doesn't reference
// @settlegrid/mcp at the source level.

test('fileReferencesSdk: true for files importing @settlegrid/mcp', () => {
  assert.equal(
    fileReferencesSdk(`import { settlegrid } from '@settlegrid/mcp'`),
    true,
  )
})

test('fileReferencesSdk: true for files importing the legacy subpath', () => {
  assert.equal(
    fileReferencesSdk(`import { x } from '@settlegrid/mcp/legacy'`),
    true,
  )
})

test('fileReferencesSdk: false for files without any SDK reference', () => {
  assert.equal(
    fileReferencesSdk(`const foo = require('third-party')`),
    false,
  )
})

test('fileReferencesSdk: false for non-string input', () => {
  assert.equal(fileReferencesSdk(null), false)
  assert.equal(fileReferencesSdk(undefined), false)
  assert.equal(fileReferencesSdk(42), false)
})

test('applyAllTransforms: skips files that do NOT import @settlegrid/mcp even when they contain codemod-targetable patterns', () => {
  // Hostile scenario: third-party library's `.wrap()` helper uses a
  // costCents field of its own. Without the gate, this would be
  // misrewritten.
  const before = `
    import { wrapper } from 'third-party-lib'
    const billed = wrapper.wrap(handler, { costCents: 5 })
  `
  const { changed, source, touchedBy } = applyAllTransforms(before)
  assert.equal(changed, false)
  assert.equal(source, before)
  assert.deepEqual(touchedBy, [])
})

test('applyAllTransforms: applies when the file does import @settlegrid/mcp', () => {
  const before = `
    import { settlegrid } from '@settlegrid/mcp'
    const sg = settlegrid.init({ toolSlug: 't' })
    const billed = sg.wrap(handler, { costCents: 5 })
  `
  const { changed, touchedBy } = applyAllTransforms(before)
  assert.equal(changed, true)
  assert.ok(touchedBy.includes('rename-costCents-to-priceCents'))
})

// --- H4 regression: binder guards for SGError rename -------------
// Without the expanded binder guards, a local class or type
// declaration named SGError (shadowing the import) would have
// its binder clobbered.

test('SGError rename: does NOT clobber a local class declaration named SGError', () => {
  const before = `
    import { SGError } from '@settlegrid/mcp'
    class SGError extends Error {
      constructor(message: string) { super(message) }
    }
  `
  const { source } = renameSgErrorToSettleGridError(before)
  // The import is renamed (from the SDK).
  assert.ok(source.includes('SettleGridError'))
  // But the class declaration binder (the name being introduced
  // by `class SGError`) must be preserved.
  assert.ok(source.includes('class SGError'))
})

test('SGError rename: does NOT clobber a local function named SGError', () => {
  const before = `
    import { SGError } from '@settlegrid/mcp'
    function SGError(code: string) { return new Error(code) }
  `
  const { source } = renameSgErrorToSettleGridError(before)
  assert.ok(source.includes('function SGError'))
})

test('SGError rename: does NOT clobber a TSTypeAliasDeclaration named SGError', () => {
  const before = `
    import { SGError } from '@settlegrid/mcp'
    type SGError = { code: string }
  `
  const { source } = renameSgErrorToSettleGridError(before)
  assert.ok(source.includes('type SGError'))
})

test('applyAllTransforms: returns unchanged on a clean file', () => {
  const clean = `
    import { settlegrid } from '@settlegrid/mcp'
    const sg = settlegrid.init({ slug: 'weather' })
    const billed = sg.wrap(handler, { priceCents: 5 })
  `
  const { changed, source } = applyAllTransforms(clean)
  assert.equal(changed, false)
  assert.equal(source, clean)
})

test('TRANSFORMS registry has at least 3 transforms (spec requires ≥3)', () => {
  assert.ok(TRANSFORMS.length >= 3)
  for (const t of TRANSFORMS) {
    assert.equal(typeof t.name, 'string')
    assert.equal(typeof t.apply, 'function')
  }
})

// ─── run() integration — per-template ─────────────────────────────

test('run(): walks src/ + transforms every .ts file', async () => {
  const tmp = await mkdtemp(join(tmpdir(), 'sbc-'))
  try {
    await mkdir(join(tmp, 'src'), { recursive: true })
    await writeFile(
      join(tmp, 'src', 'server.ts'),
      `import { SGError } from '@settlegrid/mcp'\nsg.wrap(h, { costCents: 5 })\n`,
    )
    const result = await run(tmp, { dryRun: true })
    assert.equal(result.errors.length, 0)
    assert.equal(result.filesTouched.length, 1)
    assert.equal(result.filesTouched[0], join('src', 'server.ts'))
    assert.ok(result.diffs.length > 0)
  } finally {
    await rm(tmp, { recursive: true, force: true })
  }
})

test('run(): writes files in apply mode, leaves disk untouched in dry-run', async () => {
  const tmp = await mkdtemp(join(tmpdir(), 'sbc-'))
  try {
    await mkdir(join(tmp, 'src'), { recursive: true })
    const srcPath = join(tmp, 'src', 'server.ts')
    // The @settlegrid/mcp import is required so the H2 file-level
    // SDK-presence gate permits the transform to run. Without the
    // import, the whole file is skipped — which is the correct
    // behavior for hostile-safety.
    const originalContent = `import { settlegrid } from '@settlegrid/mcp'\nsg.wrap(h, { costCents: 5 })\n`
    await writeFile(srcPath, originalContent)

    // Dry-run: disk unchanged.
    await run(tmp, { dryRun: true })
    const afterDryRun = await readFile(srcPath, 'utf-8')
    assert.equal(afterDryRun, originalContent)

    // Apply: disk changed.
    await run(tmp, { dryRun: false })
    const afterApply = await readFile(srcPath, 'utf-8')
    assert.ok(afterApply.includes('priceCents: 5'))
    assert.ok(!afterApply.includes('costCents'))
  } finally {
    await rm(tmp, { recursive: true, force: true })
  }
})

test('run(): is idempotent on a template with no matching patterns', async () => {
  const tmp = await mkdtemp(join(tmpdir(), 'sbc-'))
  try {
    await mkdir(join(tmp, 'src'), { recursive: true })
    const srcPath = join(tmp, 'src', 'server.ts')
    await writeFile(srcPath, `const sg = init()\nsg.wrap(h, { priceCents: 5 })\n`)

    const r1 = await run(tmp, { dryRun: false })
    const r2 = await run(tmp, { dryRun: false })
    assert.equal(r1.filesTouched.length, 0)
    assert.equal(r2.filesTouched.length, 0)
    assert.equal(r1.errors.length, 0)
    assert.equal(r2.errors.length, 0)
  } finally {
    await rm(tmp, { recursive: true, force: true })
  }
})

test('run(): skips templates with no src/ directory', async () => {
  const tmp = await mkdtemp(join(tmpdir(), 'sbc-'))
  try {
    await writeFile(join(tmp, 'README.md'), 'no src here')
    const result = await run(tmp, { dryRun: true })
    assert.ok(result.skipped.some((s) => s.includes('src/')))
    assert.equal(result.filesTouched.length, 0)
    assert.equal(result.errors.length, 0)
  } finally {
    await rm(tmp, { recursive: true, force: true })
  }
})

test('run(): skips templates where src/ exists but contains no .ts files', async () => {
  // Covers the branch at line ~509: `src/: no .ts files`. Without
  // this test the branch is dead.
  const tmp = await mkdtemp(join(tmpdir(), 'sbc-'))
  try {
    await mkdir(join(tmp, 'src'), { recursive: true })
    // Drop a non-TS file — shouldn't be picked up by walkTsFiles.
    await writeFile(join(tmp, 'src', 'config.json'), '{}')
    const result = await run(tmp, { dryRun: true })
    assert.ok(
      result.skipped.some((s) => s.includes('no .ts files')),
      `expected a "no .ts files" skip reason, got: ${JSON.stringify(result.skipped)}`,
    )
    assert.equal(result.filesTouched.length, 0)
    assert.equal(result.errors.length, 0)
  } finally {
    await rm(tmp, { recursive: true, force: true })
  }
})

test('run(): malformed .ts surfaces a structured error, not a crash', async () => {
  const tmp = await mkdtemp(join(tmpdir(), 'sbc-'))
  try {
    await mkdir(join(tmp, 'src'), { recursive: true })
    // Content that references @settlegrid/mcp so the file-level
    // gate permits it, and sg.wrap so the transform is exercised,
    // but with a deliberately unbalanced brace that the parser
    // will reject.
    await writeFile(
      join(tmp, 'src', 'bad.ts'),
      `import { settlegrid } from '@settlegrid/mcp'\nsg.wrap(h, { costCents: 5 \n`,
    )
    const result = await run(tmp, { dryRun: true })
    assert.ok(result.errors.length > 0)
    assert.ok(result.errors[0].includes('transform failed'))
  } finally {
    await rm(tmp, { recursive: true, force: true })
  }
})
