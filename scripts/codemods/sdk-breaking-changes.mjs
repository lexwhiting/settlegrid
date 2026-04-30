/**
 * Codemod: sdk-breaking-changes (P3.11)
 *
 * Applies a set of known breaking-change transforms to every
 * template's TypeScript source under `src/`. Each transform is:
 *
 *   - **Pure**: no I/O, no date-dependence, no randomness. Given
 *     the same input source, always produces the same output.
 *   - **Idempotent**: running twice is a no-op on the second pass.
 *     Tests enforce this explicitly.
 *   - **Narrow**: only touches patterns it recognizes. Anything
 *     that doesn't match the transform's shape is left as-is.
 *
 * Unlike `sdk-version-bump`, this codemod does not require `--from`
 * and `--to` arguments. It encodes each transform as an explicit
 * named migration. The codemod framework contract is the same:
 * returns { filesTouched, skipped, errors, diffs }.
 *
 * Runner invocation:
 *   node scripts/codemods/runner.mjs sdk-breaking-changes \
 *     --target "open-source-servers/*"
 *
 * Contract:
 *   - Dry-run by default; `--apply` writes changes.
 *   - NEVER touches package.json or non-`@settlegrid/mcp` code.
 *   - NEVER writes if any transform in the template errors.
 */

import { readFile, writeFile, readdir, rename, unlink } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import * as path from 'node:path'
import jscodeshift from 'jscodeshift'

// ---------------------------------------------------------------------------
// Transform 1: `costCents` → `priceCents` in `sg.wrap()` options
// ---------------------------------------------------------------------------
//
// A common early-product rename. `costCents` framed the fee from
// the operator's perspective (what the call costs me); `priceCents`
// frames it from the buyer's perspective (what the call costs you).
// Both SDK names have been in play at different points; the
// standardized name going forward is `priceCents`.
//
// Recognized shape:
//   sg.wrap(handler, { costCents: 5 })
//   sg.wrap(handler, { costCents: 5, foo: "bar" })
// Transform target:
//   sg.wrap(handler, { priceCents: 5 })
//   sg.wrap(handler, { priceCents: 5, foo: "bar" })

/**
 * Transform property keys named `costCents` to `priceCents` inside
 * object-literal argument positions of `sg.wrap(...)` calls.
 *
 * Returns `{ changed: boolean, source: string }`.
 */
export function renameCostCentsToPriceCents(source) {
  if (typeof source !== 'string' || !source.includes('costCents')) {
    return { changed: false, source: source ?? '' }
  }
  const j = jscodeshift.withParser('ts')
  let root
  try {
    root = j(source)
  } catch (err) {
    throw new Error(`jscodeshift parse error: ${err.message}`)
  }

  let changed = false

  root
    .find(j.CallExpression, {
      callee: {
        type: 'MemberExpression',
        property: { name: 'wrap' },
      },
    })
    .forEach((callPath) => {
      const args = callPath.value.arguments || []
      for (const arg of args) {
        if (arg.type !== 'ObjectExpression') continue
        for (const prop of arg.properties) {
          if (
            (prop.type === 'Property' ||
              prop.type === 'ObjectProperty') &&
            !prop.computed &&
            prop.key &&
            prop.key.type === 'Identifier' &&
            prop.key.name === 'costCents'
          ) {
            prop.key.name = 'priceCents'
            changed = true
          }
        }
      }
    })

  if (!changed) return { changed: false, source }
  return { changed: true, source: root.toSource() }
}

// ---------------------------------------------------------------------------
// Transform 2: `@settlegrid/mcp/legacy` → `@settlegrid/mcp`
// ---------------------------------------------------------------------------
//
// Early releases exposed some helpers under a `/legacy` subpath.
// The 0.2.0 consolidation folded those into the main entry. This
// transform rewrites any import whose source string matches the
// legacy subpath.
//
// Recognized shape:
//   import { foo } from '@settlegrid/mcp/legacy'
// Transform target:
//   import { foo } from '@settlegrid/mcp'

/**
 * Rewrite import source `@settlegrid/mcp/legacy` to `@settlegrid/mcp`.
 */
export function rewriteLegacyImportPath(source) {
  if (typeof source !== 'string' || !source.includes('@settlegrid/mcp/legacy')) {
    return { changed: false, source: source ?? '' }
  }
  const j = jscodeshift.withParser('ts')
  let root
  try {
    root = j(source)
  } catch (err) {
    throw new Error(`jscodeshift parse error: ${err.message}`)
  }

  let changed = false

  root
    .find(j.ImportDeclaration, {
      source: { value: '@settlegrid/mcp/legacy' },
    })
    .forEach((nodePath) => {
      nodePath.value.source.value = '@settlegrid/mcp'
      nodePath.value.source.raw = undefined
      changed = true
    })

  // Also rewrite dynamic imports: `await import('@settlegrid/mcp/legacy')`.
  // @babel/parser (jscodeshift's TS parser) emits the argument as a
  // StringLiteral rather than a generic Literal; match either shape
  // so future parser upgrades don't silently skip this transform.
  root
    .find(j.CallExpression, {
      callee: { type: 'Import' },
    })
    .forEach((callPath) => {
      const args = callPath.value.arguments || []
      for (const a of args) {
        if (
          (a.type === 'Literal' || a.type === 'StringLiteral') &&
          a.value === '@settlegrid/mcp/legacy'
        ) {
          a.value = '@settlegrid/mcp'
          if ('raw' in a) a.raw = undefined
          if (a.extra) a.extra = undefined
          changed = true
        }
      }
    })

  if (!changed) return { changed: false, source }
  return { changed: true, source: root.toSource() }
}

// ---------------------------------------------------------------------------
// Transform 3: `SGError` → `SettleGridError`
// ---------------------------------------------------------------------------
//
// The error type was abbreviated in early drafts; the published
// SDK settled on the full `SettleGridError` name. References —
// whether in `catch (err)` predicates, `instanceof` checks, or
// explicit imports — all need updating.
//
// Recognized shape:
//   import { SGError } from '@settlegrid/mcp'
//   catch (e) { if (e instanceof SGError) ... }
// Transform target:
//   import { SettleGridError } from '@settlegrid/mcp'
//   catch (e) { if (e instanceof SettleGridError) ... }

/**
 * Rename `SGError` to `SettleGridError` in imports from
 * `@settlegrid/mcp` and in every reference whose local binding
 * tracks the renamed import.
 */
export function renameSgErrorToSettleGridError(source) {
  if (typeof source !== 'string' || !source.includes('SGError')) {
    return { changed: false, source: source ?? '' }
  }
  const j = jscodeshift.withParser('ts')
  let root
  try {
    root = j(source)
  } catch (err) {
    throw new Error(`jscodeshift parse error: ${err.message}`)
  }

  let changed = false
  const localsToRename = new Map() // oldLocal -> newLocal

  root
    .find(j.ImportDeclaration, {
      source: { value: '@settlegrid/mcp' },
    })
    .forEach((nodePath) => {
      for (const spec of nodePath.value.specifiers || []) {
        if (spec.type !== 'ImportSpecifier') continue
        if (spec.imported.name !== 'SGError') continue
        const localName = spec.local ? spec.local.name : 'SGError'
        // Only rename the local binding when it mirrored the import name
        // (the conventional case). An aliased import (`SGError as foo`)
        // is left alone — the alias was the user's choice.
        if (localName === 'SGError') {
          spec.imported.name = 'SettleGridError'
          if (spec.local) spec.local.name = 'SettleGridError'
          localsToRename.set('SGError', 'SettleGridError')
          changed = true
        } else {
          spec.imported.name = 'SettleGridError'
          changed = true
        }
      }
    })

  // Identifier-rename pass. Mirrors the sdk-version-bump.js binder
  // guards verbatim so a local symbol named SGError (a shadowing
  // function, class, type, enum, or label) isn't renamed by this
  // transform. Without these guards, a template that had
  // `class SGError extends Error { ... }` locally would have its
  // class declaration clobbered even though the class is
  // semantically unrelated to the SDK's SGError type.
  if (localsToRename.size > 0) {
    root.find(j.Identifier).forEach((nodePath) => {
      const oldName = nodePath.value.name
      const newName = localsToRename.get(oldName)
      if (!newName) return
      const parent = nodePath.parent && nodePath.parent.value
      if (!parent) return
      // Skip property access like `foo.SGError` (not a reference to the
      // imported binding).
      if (
        parent.type === 'MemberExpression' &&
        parent.property === nodePath.value &&
        !parent.computed
      )
        return
      // Skip object property keys (`Property` = ESTree, `ObjectProperty` = babel).
      if (
        (parent.type === 'Property' ||
          parent.type === 'ObjectProperty') &&
        parent.key === nodePath.value &&
        !parent.computed
      )
        return
      // Skip class method / property keys.
      if (
        (parent.type === 'ClassMethod' ||
          parent.type === 'ClassProperty' ||
          parent.type === 'MethodDefinition' ||
          parent.type === 'PropertyDefinition') &&
        parent.key === nodePath.value &&
        !parent.computed
      )
        return
      // Skip BINDERS: the identifier is the name being introduced by
      // a declaration, not a reference to our import.
      if (
        (parent.type === 'FunctionDeclaration' ||
          parent.type === 'FunctionExpression') &&
        parent.id === nodePath.value
      )
        return
      if (
        (parent.type === 'ClassDeclaration' ||
          parent.type === 'ClassExpression') &&
        parent.id === nodePath.value
      )
        return
      if (parent.type === 'VariableDeclarator' && parent.id === nodePath.value)
        return
      if (
        (parent.type === 'TSEnumDeclaration' ||
          parent.type === 'TSInterfaceDeclaration' ||
          parent.type === 'TSTypeAliasDeclaration' ||
          parent.type === 'TSModuleDeclaration') &&
        parent.id === nodePath.value
      )
        return
      // Skip labels and label references (`break SGError;`).
      if (
        (parent.type === 'LabeledStatement' ||
          parent.type === 'BreakStatement' ||
          parent.type === 'ContinueStatement') &&
        parent.label === nodePath.value
      )
        return
      nodePath.value.name = newName
    })
  }

  if (!changed) return { changed: false, source }
  return { changed: true, source: root.toSource() }
}

// ---------------------------------------------------------------------------
// Transform 4: remove deprecated `sg.debug()` calls
// ---------------------------------------------------------------------------
//
// `sg.debug()` was a no-op diagnostic left in some early templates
// that the shipped SDK never implemented. Dead code; strip the
// statement entirely so the template's runtime behavior matches
// the implementation.
//
// Recognized shape:
//   sg.debug()
//   sg.debug('some label')
// Transform target:
//   (removed)

/**
 * Remove ExpressionStatement nodes whose expression is a call to
 * `sg.debug(...)`. The expression-statement wrapper is the common
 * case (side-effectful debug call), so we narrow to that.
 */
export function removeSgDebugCalls(source) {
  if (typeof source !== 'string' || !source.includes('sg.debug')) {
    return { changed: false, source: source ?? '' }
  }
  const j = jscodeshift.withParser('ts')
  let root
  try {
    root = j(source)
  } catch (err) {
    throw new Error(`jscodeshift parse error: ${err.message}`)
  }

  let changed = false

  root
    .find(j.ExpressionStatement, {
      expression: {
        type: 'CallExpression',
        callee: {
          type: 'MemberExpression',
          object: { type: 'Identifier', name: 'sg' },
          property: { type: 'Identifier', name: 'debug' },
        },
      },
    })
    .forEach((nodePath) => {
      j(nodePath).remove()
      changed = true
    })

  if (!changed) return { changed: false, source }
  return { changed: true, source: root.toSource() }
}

// ---------------------------------------------------------------------------
// Transform registry
// ---------------------------------------------------------------------------

/**
 * Ordered list of transforms. Order matters when one transform's
 * output could be the input to another's pattern match — here the
 * transforms operate on disjoint patterns, so order is stable.
 *
 * Each entry has:
 *   - name: stable identifier (used in logs and diffs)
 *   - apply: (source) => { changed, source } — pure function
 */
export const TRANSFORMS = [
  { name: 'rename-costCents-to-priceCents', apply: renameCostCentsToPriceCents },
  { name: 'rewrite-legacy-import-path', apply: rewriteLegacyImportPath },
  {
    name: 'rename-SGError-to-SettleGridError',
    apply: renameSgErrorToSettleGridError,
  },
  { name: 'remove-sg-debug-calls', apply: removeSgDebugCalls },
]

/**
 * Source-level presence check: does this file import anything
 * from `@settlegrid/mcp` (either the canonical path or the
 * `/legacy` subpath)? We gate every transform on this because
 * otherwise a third-party library using unrelated patterns like
 * `.wrap(h, { costCents: 5 })` or a local `SGError` class could
 * be misrewritten. Files that don't import the SDK can't be
 * affected by SDK breaking changes, so skipping them is the
 * correct narrow behavior.
 *
 * Exception: `rewrite-legacy-import-path` runs before this gate
 * because its whole job IS introducing the `@settlegrid/mcp`
 * import. Applying it on a file that already has a canonical
 * import is also fine (no-op). Files with NO SDK reference at
 * all skip everything.
 */
export function fileReferencesSdk(source) {
  if (typeof source !== 'string') return false
  // Substring check is sufficient — the transforms themselves
  // operate at AST level so a string-level false positive just
  // lets them parse and no-op. A false NEGATIVE would skip
  // legitimate SDK files; the substring covers imports in
  // every syntactic form we emit.
  return source.includes('@settlegrid/mcp')
}

/**
 * Apply every transform in sequence to a single source string.
 * Returns `{ changed, source, touchedBy }` where `touchedBy` is
 * the ordered list of transform names that produced changes.
 *
 * Files that don't reference `@settlegrid/mcp` at all are
 * skipped entirely — this prevents misrenaming unrelated
 * third-party code that happens to share a pattern (e.g., a
 * `.wrap()` helper with its own `costCents` field).
 */
export function applyAllTransforms(source) {
  if (!fileReferencesSdk(source)) {
    return { changed: false, source, touchedBy: [] }
  }
  let current = source
  let changed = false
  const touchedBy = []
  for (const t of TRANSFORMS) {
    const result = t.apply(current)
    if (result.changed) {
      current = result.source
      changed = true
      touchedBy.push(t.name)
    }
  }
  return { changed, source: current, touchedBy }
}

// ---------------------------------------------------------------------------
// File system walkers + diff helper (mirrors sdk-version-bump.js)
// ---------------------------------------------------------------------------

async function walkTsFiles(rootDir) {
  const results = []
  async function walk(dir) {
    let entries
    try {
      entries = await readdir(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === 'dist') continue
        await walk(full)
      } else if (
        entry.isFile() &&
        entry.name.endsWith('.ts') &&
        !entry.name.endsWith('.d.ts')
      ) {
        results.push(full)
      }
    }
  }
  await walk(rootDir)
  return results.sort()
}

function unifiedDiff(before, after, filename) {
  if (before === after) return ''
  const beforeLines = before.split('\n')
  const afterLines = after.split('\n')
  const lines = [`--- a/${filename}`, `+++ b/${filename}`]
  const max = Math.max(beforeLines.length, afterLines.length)
  for (let i = 0; i < max; i++) {
    const a = beforeLines[i]
    const b = afterLines[i]
    if (a === b) continue
    if (a !== undefined) lines.push(`-${a}`)
    if (b !== undefined) lines.push(`+${b}`)
  }
  return lines.join('\n') + '\n'
}

// ---------------------------------------------------------------------------
// Per-template runner
// ---------------------------------------------------------------------------

/**
 * Apply every transform to every .ts file under `templateDir/src`.
 * Rollback on error: if any file fails to transform, no disk
 * writes occur.
 */
export async function run(templateDir, opts = {}) {
  const result = { filesTouched: [], skipped: [], errors: [], diffs: [] }
  const dryRun = opts.dryRun !== false

  const srcDir = path.join(templateDir, 'src')
  if (!existsSync(srcDir)) {
    result.skipped.push('src/')
    return result
  }

  const tsFiles = await walkTsFiles(srcDir)
  if (tsFiles.length === 0) {
    result.skipped.push('src/: no .ts files')
    return result
  }

  const pendingWrites = []

  for (const absFile of tsFiles) {
    const relFile = path.relative(templateDir, absFile)
    let before
    try {
      before = await readFile(absFile, 'utf-8')
    } catch (err) {
      result.errors.push(`${relFile} read failed: ${err.message}`)
      return result
    }
    try {
      const { changed, source: after, touchedBy } = applyAllTransforms(before)
      if (changed) {
        result.filesTouched.push(relFile)
        result.diffs.push({
          file: relFile,
          diff: unifiedDiff(before, after, relFile),
          touchedBy,
        })
        pendingWrites.push({ path: absFile, content: after })
      } else {
        result.skipped.push(`${relFile}: no matching patterns`)
      }
    } catch (err) {
      result.errors.push(`${relFile} transform failed: ${err.message}`)
      return result
    }
  }

  if (!dryRun) {
    for (const w of pendingWrites) {
      const tmpPath = `${w.path}.codemod-${process.pid}.tmp`
      try {
        await writeFile(tmpPath, w.content)
        await rename(tmpPath, w.path)
      } catch (err) {
        await unlink(tmpPath).catch(() => {})
        result.errors.push(
          `${path.relative(templateDir, w.path)} write failed: ${err.message}`,
        )
        return result
      }
    }
  }

  return result
}

export const name = 'sdk-breaking-changes'
export default { name, run }
