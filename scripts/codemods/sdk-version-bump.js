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

import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import * as path from 'node:path';
import jscodeshift from 'jscodeshift';

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
  // First validate the JSON parses — we still want to fail loudly on
  // malformed input, even though we don't use the parsed result.
  try {
    JSON.parse(raw);
  } catch (err) {
    throw err;
  }
  // Match `"@settlegrid/mcp": "<range>"` with optional whitespace around the colon.
  const re = /"@settlegrid\/mcp"\s*:\s*"([\^~]?)(\d+\.\d+\.\d+[^"]*)"/;
  const match = raw.match(re);
  if (!match) {
    return { changed: false, reason: '@settlegrid/mcp not in dependencies' };
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
  const localsToWarnRemoved = new Set(); // local names whose imports were removed

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
          localsToWarnRemoved.add(localName);
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
  if (localsToRename.size > 0) {
    root.find(j.Identifier).forEach((nodePath) => {
      const name = nodePath.value.name;
      const newName = localsToRename.get(name);
      if (!newName) return;
      // Skip property keys in member expressions like `foo.oldHelper` —
      // those aren't references to our binding.
      const parent = nodePath.parent && nodePath.parent.value;
      if (
        parent
        && parent.type === 'MemberExpression'
        && parent.property === nodePath.value
        && !parent.computed
      ) {
        return;
      }
      // Skip object property keys like `{ oldHelper: ... }`.
      if (parent && parent.type === 'Property' && parent.key === nodePath.value && !parent.computed) {
        return;
      }
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
      if (!dryRun) {
        await writeFile(pkgPath, rewrite.next);
      }
    } else {
      result.skipped.push(`package.json: ${rewrite.reason}`);
    }
  }

  // --- src/**/*.ts (only server.ts for now — can be extended) ---
  const serverPath = path.join(templateDir, 'src', 'server.ts');
  if (!existsSync(serverPath)) {
    result.skipped.push('src/server.ts');
  } else {
    let before;
    try {
      before = await readFile(serverPath, 'utf-8');
    } catch (err) {
      result.errors.push(`src/server.ts read failed: ${err.message}`);
      return result;
    }
    try {
      const { changed, source: after } = rewriteServerSource(before, renameMap);
      if (changed) {
        result.filesTouched.push('src/server.ts');
        result.diffs.push({
          file: 'src/server.ts',
          diff: unifiedDiff(before, after, 'src/server.ts'),
        });
        if (!dryRun) {
          await writeFile(serverPath, after);
        }
      } else {
        result.skipped.push('src/server.ts: no rename-map changes');
      }
    } catch (err) {
      result.errors.push(`src/server.ts transform failed: ${err.message}`);
    }
  }

  return result;
}

export const name = 'sdk-version-bump';
export default { name, run };
