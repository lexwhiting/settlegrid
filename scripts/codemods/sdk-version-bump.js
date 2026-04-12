/**
 * Codemod: sdk-version-bump (P1.11)
 *
 * Bumps `@settlegrid/mcp` in package.json from one semver range to
 * another, and rewrites deprecated imports in src/**\/*.ts via a
 * per-version rename map.
 *
 * Usage (via runner):
 *   node scripts/codemods/runner.mjs sdk-version-bump \
 *     --from 0.1.1 --to 0.2.0 \
 *     --target "open-source-servers/settlegrid-500px"
 *
 * Contract:
 *   - Idempotent: a second run against the same template is a no-op.
 *   - Dry-run by default (runner controls via dryRun flag).
 *   - Returns { filesTouched, skipped, errors, diffs }.
 *   - NEVER touches non-`@settlegrid/mcp` dependencies.
 *   - NEVER writes files when dryRun is true.
 */

import { readFile, writeFile, readdir, rename, unlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import * as path from 'node:path';
import jscodeshift from 'jscodeshift';

/**
 * Walk a directory recursively and return every .ts file (excluding
 * .d.ts declarations). Used to scan `src/**\/*.ts` without pulling in
 * a glob library.
 */
async function walkTsFiles(rootDir) {
  const results = [];
  async function walk(dir) {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        // Skip node_modules and dist if a template ever grows them
        if (entry.name === 'node_modules' || entry.name === 'dist') continue;
        await walk(full);
      } else if (
        entry.isFile()
        && entry.name.endsWith('.ts')
        && !entry.name.endsWith('.d.ts')
      ) {
        results.push(full);
      }
    }
  }
  await walk(rootDir);
  return results.sort();
}

/**
 * Default rename maps per version transition. For 0.1.1 → 0.2.0 the map
 * is empty because no breaking API changes have shipped yet — but the
 * mechanism is exercised by the test suite with synthetic maps.
 *
 * Structure:
 *   {
 *     'from->to': {
 *       imports: { oldName: newName },        // rename named imports
 *       removedImports: [oldName],            // drop named imports entirely
 *     }
 *   }
 */
export const DEFAULT_RENAME_MAPS = {
  '0.1.1->0.2.0': {
    imports: {},
    removedImports: [],
  },
};

/**
 * Resolve the rename map for a given from→to pair. Falls back to an
 * empty map if no map is registered — the version bump still rewrites
 * package.json but the .ts transform is a no-op.
 */
export function resolveRenameMap(from, to, override) {
  if (override && typeof override === 'object') return override;
  const key = `${from}->${to}`;
  return DEFAULT_RENAME_MAPS[key] ?? { imports: {}, removedImports: [] };
}

// ---------------------------------------------------------------------------
// package.json transform — object form (for pure-function unit tests)
// ---------------------------------------------------------------------------

/**
 * Rewrite the `@settlegrid/mcp` entry in a parsed package.json object.
 * Preserves the original prefix (^0.1.1 → ^0.2.0, ~0.1.1 → ~0.2.0).
 *
 * This is the pure-function variant used by unit tests. The codemod's
 * run() function operates on the raw source string (via
 * rewritePackageJsonRaw) to preserve whitespace and avoid reformatting
 * the entire file on every transform.
 */
export function rewritePackageJson(pkg, from, to) {
  const deps = pkg && typeof pkg === 'object' ? pkg.dependencies : null;
  if (!deps || typeof deps !== 'object') {
    return { changed: false, reason: 'no dependencies block' };
  }
  const current = deps['@settlegrid/mcp'];
  if (typeof current !== 'string') {
    return { changed: false, reason: '@settlegrid/mcp not in dependencies' };
  }
  const match = current.match(/^([\^~]?)(\d+\.\d+\.\d+.*)$/);
  if (!match) {
    return { changed: false, reason: `unrecognised version range: ${current}` };
  }
  const [, prefix, version] = match;
  if (version === to) {
    return { changed: false, reason: 'already at target version' };
  }
  if (version !== from) {
    return {
      changed: false,
      reason: `current version ${version} does not match --from ${from}`,
      warning: true,
    };
  }
  const newRange = `${prefix}${to}`;
  const nextDeps = { ...deps, '@settlegrid/mcp': newRange };
  return {
    changed: true,
    next: { ...pkg, dependencies: nextDeps },
    before: current,
    after: newRange,
  };
}

/**
 * Rewrite the `@settlegrid/mcp` entry in a package.json SOURCE STRING,
 * preserving every byte of whitespace except the version-range token.
 *
 * This is what run() uses internally. Unlike the object-form variant,
 * it does not reformat inline dependency blocks or reorder keys —
 * diffs against the original file show exactly one changed line.
 */
export function rewritePackageJsonRaw(raw, from, to) {
  if (typeof raw !== 'string') {
    return { changed: false, reason: 'package.json is not a string' };
  }
  // Validate the JSON parses — malformed input propagates to the caller
  // so it can be surfaced as a structured error, not a silent skip.
  JSON.parse(raw);
  // Presence check: is `@settlegrid/mcp` present at all (under any range)?
  const presenceRe = /"@settlegrid\/mcp"\s*:\s*"[^"]*"/;
  if (!presenceRe.test(raw)) {
    return { changed: false, reason: '@settlegrid/mcp not in dependencies' };
  }
  // Strict match: only bump caret/tilde/exact semver ranges. Complex
  // ranges like `>=0.1.1`, `0.1.x`, `0.1.1 - 0.2.0` are deliberately
  // rejected so the caller sees a loud warning instead of silently
  // treating the dep as absent.
  const strictRe = /"@settlegrid\/mcp"\s*:\s*"([\^~]?)(\d+\.\d+\.\d+[^"]*)"/;
  const match = raw.match(strictRe);
  if (!match) {
    return {
      changed: false,
      reason: 'unrecognised version range for @settlegrid/mcp (expected ^X.Y.Z, ~X.Y.Z, or X.Y.Z)',
      warning: true,
    };
  }
  const [fullMatch, prefix, version] = match;
  if (version === to) {
    return { changed: false, reason: 'already at target version' };
  }
  if (version !== from) {
    return {
      changed: false,
      reason: `current version ${version} does not match --from ${from}`,
      warning: true,
    };
  }
  const replacement = `"@settlegrid/mcp": "${prefix}${to}"`;
  const next = raw.replace(fullMatch, replacement);
  return {
    changed: true,
    next,
    before: fullMatch,
    after: replacement,
  };
}

// ---------------------------------------------------------------------------
// src/**/*.ts transform via jscodeshift
// ---------------------------------------------------------------------------

/**
 * Apply a rename map to the named imports of `@settlegrid/mcp` in a
 * source file. Returns `{ changed, source }`.
 */
export function rewriteServerSource(source, renameMap) {
  if (!source || typeof source !== 'string') {
    return { changed: false, source: source ?? '' };
  }
  const hasImport = source.includes('@settlegrid/mcp');
  if (!hasImport) return { changed: false, source };

  const j = jscodeshift.withParser('ts');
  let root;
  try {
    root = j(source);
  } catch (err) {
    throw new Error(`jscodeshift parse error: ${err.message}`);
  }

  let changed = false;

  // First, collect the local binding names for each imported name in the
  // @settlegrid/mcp import declaration. Renaming an imported name must
  // also update every reference to that local binding in the file body —
  // otherwise the code compiles to a dangling identifier.
  const localsToRename = new Map(); // oldLocalName -> newLocalName

  root
    .find(j.ImportDeclaration, { source: { value: '@settlegrid/mcp' } })
    .forEach((nodePath) => {
      const specifiers = nodePath.value.specifiers || [];
      const next = [];
      for (const spec of specifiers) {
        if (spec.type !== 'ImportSpecifier') {
          next.push(spec);
          continue;
        }
        const importedName = spec.imported.name;
        const localName = spec.local ? spec.local.name : importedName;
        if (renameMap.removedImports?.includes(importedName)) {
          changed = true;
          continue; // drop the specifier entirely
        }
        const renamed = renameMap.imports?.[importedName];
        if (renamed && renamed !== importedName) {
          changed = true;
          // Only rename the local binding if it mirrored the imported name
          // (the common case). A user-supplied alias (`as foo`) is left
          // alone so existing references continue to resolve.
          if (localName === importedName) {
            localsToRename.set(localName, renamed);
            next.push(j.importSpecifier(j.identifier(renamed)));
          } else {
            next.push(
              j.importSpecifier(j.identifier(renamed), j.identifier(localName)),
            );
          }
        } else {
          next.push(spec);
        }
      }
      nodePath.value.specifiers = next;
    });

  // Rename every identifier reference whose local binding is in the
  // rename map. This catches usages like `oldHelper()` elsewhere in the
  // file. Scope-narrow lookup would be safer, but for @settlegrid/mcp
  // renames the names are globally unique by convention and a whole-file
  // identifier rename is acceptable for the SDK upgrade use case.
  //
  // Binder guard: if an identifier is the *declaration name* of a local
  // function, class, variable, type, or object property key, we must
  // NOT rename it — otherwise we clobber unrelated local bindings that
  // happen to share a name with a removed/renamed SDK export. This
  // still has a residual risk: references to a shadowing local will be
  // renamed naively (we don't do scope analysis). For the SDK-upgrade
  // use case the convention is that SDK export names are globally
  // unique inside a template, so the residual risk is acceptable.
  if (localsToRename.size > 0) {
    root.find(j.Identifier).forEach((nodePath) => {
      const name = nodePath.value.name;
      const newName = localsToRename.get(name);
      if (!newName) return;
      const parent = nodePath.parent && nodePath.parent.value;
      if (!parent) return;
      // Skip property access like `foo.oldHelper` (not a reference).
      if (
        parent.type === 'MemberExpression'
        && parent.property === nodePath.value
        && !parent.computed
      ) return;
      // Skip object property keys (`Property` = ESTree, `ObjectProperty` = babel).
      if (
        (parent.type === 'Property' || parent.type === 'ObjectProperty')
        && parent.key === nodePath.value
        && !parent.computed
      ) return;
      // Skip class method/property keys.
      if (
        (parent.type === 'ClassMethod' || parent.type === 'ClassProperty' || parent.type === 'MethodDefinition' || parent.type === 'PropertyDefinition')
        && parent.key === nodePath.value
        && !parent.computed
      ) return;
      // Skip BINDERS: the identifier is the name being introduced by a
      // declaration, not a reference to our import.
      if (
        (parent.type === 'FunctionDeclaration' || parent.type === 'FunctionExpression')
        && parent.id === nodePath.value
      ) return;
      if (
        (parent.type === 'ClassDeclaration' || parent.type === 'ClassExpression')
        && parent.id === nodePath.value
      ) return;
      if (parent.type === 'VariableDeclarator' && parent.id === nodePath.value) return;
      if (
        (parent.type === 'TSEnumDeclaration' || parent.type === 'TSInterfaceDeclaration' || parent.type === 'TSTypeAliasDeclaration' || parent.type === 'TSModuleDeclaration')
        && parent.id === nodePath.value
      ) return;
      // Skip labels and label references (`break oldHelper;`).
      if (
        (parent.type === 'LabeledStatement' || parent.type === 'BreakStatement' || parent.type === 'ContinueStatement')
        && parent.label === nodePath.value
      ) return;
      nodePath.value.name = newName;
    });
  }

  if (!changed) return { changed: false, source };
  return { changed: true, source: root.toSource() };
}

// ---------------------------------------------------------------------------
// Unified-diff helper (minimal, line-level)
// ---------------------------------------------------------------------------

function unifiedDiff(before, after, filename) {
  if (before === after) return '';
  const beforeLines = before.split('\n');
  const afterLines = after.split('\n');
  const lines = [`--- a/${filename}`, `+++ b/${filename}`];
  // Trivial line-by-line diff (not true LCS, but fine for package.json
  // and small import edits — jscodeshift output is stable line-for-line
  // except at the edited region).
  const max = Math.max(beforeLines.length, afterLines.length);
  for (let i = 0; i < max; i++) {
    const a = beforeLines[i];
    const b = afterLines[i];
    if (a === b) continue;
    if (a !== undefined) lines.push(`-${a}`);
    if (b !== undefined) lines.push(`+${b}`);
  }
  return lines.join('\n') + '\n';
}

// ---------------------------------------------------------------------------
// Per-template runner
// ---------------------------------------------------------------------------

/**
 * Run the sdk-version-bump codemod against a single template directory.
 *
 * @param {string} templateDir - absolute path to the template root
 * @param {{
 *   from?: string,
 *   to?: string,
 *   renameMap?: { imports?: Record<string,string>, removedImports?: string[] },
 *   dryRun?: boolean,
 * }} opts
 * @returns {Promise<{
 *   filesTouched: string[],
 *   skipped: string[],
 *   errors: string[],
 *   diffs: Array<{ file: string, diff: string }>,
 * }>}
 */
export async function run(templateDir, opts = {}) {
  const result = { filesTouched: [], skipped: [], errors: [], diffs: [] };
  const dryRun = opts.dryRun !== false;
  const from = opts.from;
  const to = opts.to;

  if (!from || !to) {
    result.errors.push('sdk-version-bump requires --from and --to');
    return result;
  }

  const renameMap = resolveRenameMap(from, to, opts.renameMap);

  // Collect every planned write in memory first. Only flush to disk after
  // every transform succeeds — this is the "rollback on error" invariant
  // from the P1.11 spec: an apply-mode run that fails mid-template must
  // not leave the template in a partially modified state.
  const pendingWrites = [];

  // --- package.json ---
  const pkgPath = path.join(templateDir, 'package.json');
  if (!existsSync(pkgPath)) {
    result.skipped.push('package.json');
  } else {
    let raw;
    try {
      raw = await readFile(pkgPath, 'utf-8');
    } catch (err) {
      result.errors.push(`package.json read failed: ${err.message}`);
      return result;
    }

    let rewrite;
    try {
      rewrite = rewritePackageJsonRaw(raw, from, to);
    } catch (err) {
      result.errors.push(`package.json parse failed: ${err.message}`);
      return result;
    }

    if (rewrite.changed) {
      result.filesTouched.push('package.json');
      result.diffs.push({
        file: 'package.json',
        diff: unifiedDiff(raw, rewrite.next, 'package.json'),
      });
      pendingWrites.push({ path: pkgPath, content: rewrite.next });
    } else {
      result.skipped.push(`package.json: ${rewrite.reason}`);
    }
  }

  // --- src/**/*.ts (walk the whole src/ tree, not just server.ts) ---
  const srcDir = path.join(templateDir, 'src');
  if (!existsSync(srcDir)) {
    result.skipped.push('src/');
  } else {
    const tsFiles = await walkTsFiles(srcDir);
    if (tsFiles.length === 0) {
      result.skipped.push('src/: no .ts files');
    }
    for (const absFile of tsFiles) {
      const relFile = path.relative(templateDir, absFile);
      let before;
      try {
        before = await readFile(absFile, 'utf-8');
      } catch (err) {
        result.errors.push(`${relFile} read failed: ${err.message}`);
        return result;
      }
      try {
        const { changed, source: after } = rewriteServerSource(before, renameMap);
        if (changed) {
          result.filesTouched.push(relFile);
          result.diffs.push({
            file: relFile,
            diff: unifiedDiff(before, after, relFile),
          });
          pendingWrites.push({ path: absFile, content: after });
        } else {
          result.skipped.push(`${relFile}: no rename-map changes`);
        }
      } catch (err) {
        // Any transform error aborts the whole template — pendingWrites
        // is discarded so we never write a partial update (rollback).
        result.errors.push(`${relFile} transform failed: ${err.message}`);
        return result;
      }
    }
  }

  // Flush all pending writes AT THE END. If any transform above pushed
  // an error, we've already returned and nothing is written.
  //
  // Per-file atomicity: write to a sibling tempfile and rename into
  // place. Rename is atomic on POSIX (single syscall) so the caller
  // never observes a half-written file. This does NOT give transactional
  // rollback across multiple files — if write N succeeds and write N+1
  // fails, the first N files stay written. A future hardening pass
  // could snapshot originals into a tmp dir for full all-or-nothing
  // semantics, but per-file atomicity is enough to avoid corruption.
  if (!dryRun) {
    for (const w of pendingWrites) {
      const tmpPath = `${w.path}.codemod-${process.pid}.tmp`;
      try {
        await writeFile(tmpPath, w.content);
        await rename(tmpPath, w.path);
      } catch (err) {
        await unlink(tmpPath).catch(() => {});
        result.errors.push(`${path.relative(templateDir, w.path)} write failed: ${err.message}`);
        return result;
      }
    }
  }

  return result;
}

export const name = 'sdk-version-bump';
export default { name, run };
