import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, mkdir, rm, cp, chmod } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import * as url from 'node:url';

import {
  run,
  rewritePackageJson,
  rewriteServerSource,
  resolveRenameMap,
  DEFAULT_RENAME_MAPS,
} from '../sdk-version-bump.js';
import { runCodemod, parseArgs, resolveGlob, loadCodemod } from '../runner.mjs';

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FIXTURES = path.resolve(__dirname, '..', 'fixtures');

// ---------------------------------------------------------------------------
// Helpers: materialize a fixture into a fresh tmp template dir
// ---------------------------------------------------------------------------

/**
 * Build an on-disk template directory from named fixture files.
 *
 *   { 'package.json': 'package.json', 'src/server.ts': 'server.ts' }
 *
 * Keys are target paths inside the tmp dir; values are fixture filenames.
 */
async function makeTemplateDir(filesMap) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'codemod-fixture-'));
  for (const [dest, fixture] of Object.entries(filesMap)) {
    const src = path.join(FIXTURES, 'before', fixture);
    const target = path.join(dir, dest);
    await mkdir(path.dirname(target), { recursive: true });
    await cp(src, target);
  }
  return dir;
}

const CREATED_DIRS = [];
async function tmpTemplate(files) {
  const dir = await makeTemplateDir(files);
  CREATED_DIRS.push(dir);
  return dir;
}

after(async () => {
  for (const d of CREATED_DIRS) {
    await rm(d, { recursive: true, force: true }).catch(() => {});
  }
});

// ---------------------------------------------------------------------------
// 1. rewritePackageJson — pure function tests
// ---------------------------------------------------------------------------

describe('rewritePackageJson', () => {
  test('bumps caret range ^0.1.1 → ^0.2.0', () => {
    const pkg = { dependencies: { '@settlegrid/mcp': '^0.1.1' } };
    const result = rewritePackageJson(pkg, '0.1.1', '0.2.0');
    assert.equal(result.changed, true);
    assert.equal(result.next.dependencies['@settlegrid/mcp'], '^0.2.0');
    assert.equal(result.before, '^0.1.1');
    assert.equal(result.after, '^0.2.0');
  });

  test('bumps tilde range ~0.1.1 → ~0.2.0', () => {
    const pkg = { dependencies: { '@settlegrid/mcp': '~0.1.1' } };
    const result = rewritePackageJson(pkg, '0.1.1', '0.2.0');
    assert.equal(result.changed, true);
    assert.equal(result.next.dependencies['@settlegrid/mcp'], '~0.2.0');
  });

  test('leaves other dependencies completely untouched', () => {
    const pkg = {
      dependencies: {
        '@settlegrid/mcp': '^0.1.1',
        zod: '^3.22.0',
        lodash: '^4.17.21',
      },
    };
    const result = rewritePackageJson(pkg, '0.1.1', '0.2.0');
    assert.equal(result.next.dependencies.zod, '^3.22.0');
    assert.equal(result.next.dependencies.lodash, '^4.17.21');
  });

  test('idempotent: already at target returns changed=false', () => {
    const pkg = { dependencies: { '@settlegrid/mcp': '^0.2.0' } };
    const result = rewritePackageJson(pkg, '0.1.1', '0.2.0');
    assert.equal(result.changed, false);
    assert.match(result.reason, /already at target/);
  });

  test('unknown from version emits warning, not error', () => {
    const pkg = { dependencies: { '@settlegrid/mcp': '^0.3.0' } };
    const result = rewritePackageJson(pkg, '0.1.1', '0.2.0');
    assert.equal(result.changed, false);
    assert.equal(result.warning, true);
    assert.match(result.reason, /does not match --from/);
  });

  test('no @settlegrid/mcp in deps returns changed=false', () => {
    const pkg = { dependencies: { zod: '^3.22.0' } };
    const result = rewritePackageJson(pkg, '0.1.1', '0.2.0');
    assert.equal(result.changed, false);
    assert.match(result.reason, /not in dependencies/);
  });

  test('missing dependencies block returns changed=false', () => {
    const pkg = { name: 'broken' };
    const result = rewritePackageJson(pkg, '0.1.1', '0.2.0');
    assert.equal(result.changed, false);
  });

  test('unrecognised version range (object form) returns changed=false with helpful reason', () => {
    const pkg = { dependencies: { '@settlegrid/mcp': '>=0.1.1' } };
    const result = rewritePackageJson(pkg, '0.1.1', '0.2.0');
    assert.equal(result.changed, false);
    assert.match(result.reason, /unrecognised version range/);
  });
});

// ---------------------------------------------------------------------------
// 2. rewriteServerSource — jscodeshift transform
// ---------------------------------------------------------------------------

describe('rewriteServerSource', () => {
  test('empty rename map = no-op (mechanism still runs)', () => {
    const src = `import { settlegrid } from '@settlegrid/mcp'\nconst sg = settlegrid.init({ toolSlug: 'x', pricing: { defaultCostCents: 1 } })\n`;
    const result = rewriteServerSource(src, { imports: {}, removedImports: [] });
    assert.equal(result.changed, false);
    assert.equal(result.source, src);
  });

  test('rename map renames an import', () => {
    const src = `import { oldHelper, settlegrid } from '@settlegrid/mcp'\noldHelper()\n`;
    const result = rewriteServerSource(src, {
      imports: { oldHelper: 'newHelper' },
      removedImports: [],
    });
    assert.equal(result.changed, true);
    assert.match(result.source, /newHelper/);
    assert.ok(!result.source.includes('oldHelper'));
  });

  test('removedImports drops a named import entirely', () => {
    const src = `import { settlegrid, deprecatedFn } from '@settlegrid/mcp'\n`;
    const result = rewriteServerSource(src, {
      imports: {},
      removedImports: ['deprecatedFn'],
    });
    assert.equal(result.changed, true);
    assert.ok(!result.source.includes('deprecatedFn'));
    assert.match(result.source, /settlegrid/);
  });

  test('files without @settlegrid/mcp import are skipped', () => {
    const src = `import { z } from 'zod'\nexport const foo = z.string()\n`;
    const result = rewriteServerSource(src, { imports: { a: 'b' }, removedImports: [] });
    assert.equal(result.changed, false);
  });

  test('binder guard: FunctionDeclaration.id with the same name is NOT renamed', () => {
    // The import `oldName` is renamed to `newName`, but a local
    // `function oldName()` exists in the same file. The function's
    // declaration name must survive — otherwise we corrupt a local
    // binding that coincidentally shadows the SDK export.
    const src = `import { settlegrid, oldName } from '@settlegrid/mcp'\nfunction oldName() { return 1 }\nexport { settlegrid }\n`;
    const result = rewriteServerSource(src, {
      imports: { oldName: 'newName' },
      removedImports: [],
    });
    assert.equal(result.changed, true);
    // Import specifier renamed
    assert.match(result.source, /import\s*\{[^}]*newName/);
    // FunctionDeclaration.id preserved (binder skip)
    assert.match(
      result.source,
      /function oldName\s*\(/,
      'FunctionDeclaration.id must not be renamed (would clobber local binding)',
    );
  });

  test('binder guard: VariableDeclarator.id with the same name is NOT renamed', () => {
    const src = `import { settlegrid, widget } from '@settlegrid/mcp'\nconst widget2 = 42\nconst gadget2 = widget2\n`;
    // The local `widget2` is unrelated (different name), so this is
    // mostly a sanity check that our binder guard doesn't break normal
    // rename behavior. The import specifier should still be renamed.
    const result = rewriteServerSource(src, {
      imports: { widget: 'gadget' },
      removedImports: [],
    });
    assert.equal(result.changed, true);
    assert.match(result.source, /import\s*\{[^}]*gadget/);
    // The unrelated local const keeps its name
    assert.match(result.source, /const widget2 = 42/);
  });

  test('binder guard: ObjectProperty key with the same name is NOT renamed', () => {
    // ObjectProperty keys in babel (the ts parser) use node type
    // `ObjectProperty`, not ESTree's `Property`. Both must be skipped.
    const src = `import { settlegrid, oldKey } from '@settlegrid/mcp'\nconst obj = { oldKey: 1 }\nexport { obj, settlegrid }\n`;
    const result = rewriteServerSource(src, {
      imports: { oldKey: 'newKey' },
      removedImports: [],
    });
    assert.equal(result.changed, true);
    assert.match(result.source, /import\s*\{[^}]*newKey/);
    // Object property key must survive unrenamed
    assert.match(
      result.source,
      /\{\s*oldKey:\s*1\s*\}/,
      'ObjectProperty.key must not be renamed',
    );
  });

  test('null / non-string source returns a safe no-op', () => {
    assert.deepEqual(rewriteServerSource(null, { imports: {}, removedImports: [] }), {
      changed: false,
      source: '',
    });
    assert.deepEqual(
      rewriteServerSource(undefined, { imports: {}, removedImports: [] }),
      { changed: false, source: '' },
    );
    assert.deepEqual(rewriteServerSource(42, { imports: {}, removedImports: [] }), {
      changed: false,
      source: 42,
    });
  });

  test('namespace import (`import * as mcp`) is passed through unchanged', () => {
    // The rename map operates on named imports. A namespace import
    // binds the whole module under one local name, so there are no
    // named specifiers to rename — the spec.type !== 'ImportSpecifier'
    // branch just passes it through.
    const src = `import * as mcp from '@settlegrid/mcp'\nmcp.settlegrid.init({ toolSlug: 'x' })\n`;
    const result = rewriteServerSource(src, {
      imports: { settlegrid: 'renamed' },
      removedImports: [],
    });
    assert.equal(result.changed, false);
    assert.match(result.source, /import \* as mcp from '@settlegrid\/mcp'/);
  });

  test('default import is passed through unchanged (non-ImportSpecifier branch)', () => {
    const src = `import mcp from '@settlegrid/mcp'\nmcp.init()\n`;
    const result = rewriteServerSource(src, {
      imports: { mcp: 'renamed' },
      removedImports: [],
    });
    assert.equal(result.changed, false);
  });

  test('aliased named import keeps the alias when the imported name is renamed', () => {
    // `import { oldHelper as h } from '@settlegrid/mcp'` — the LOCAL
    // binding is `h`, so existing references to `h()` should still
    // resolve after renaming `oldHelper` to `newHelper`. The expected
    // output is `import { newHelper as h } from '@settlegrid/mcp'`.
    const src = `import { settlegrid, oldHelper as h } from '@settlegrid/mcp'\nh()\n`;
    const result = rewriteServerSource(src, {
      imports: { oldHelper: 'newHelper' },
      removedImports: [],
    });
    assert.equal(result.changed, true);
    assert.match(
      result.source,
      /newHelper as h/,
      'expected the aliased form `newHelper as h`',
    );
    // References to the local `h` are unchanged (the local name wasn't renamed)
    assert.match(result.source, /h\(\)/);
  });
});

// ---------------------------------------------------------------------------
// 3. resolveRenameMap + DEFAULT_RENAME_MAPS
// ---------------------------------------------------------------------------

describe('rewritePackageJsonRaw (raw-string form, direct tests)', () => {
  // The raw form is the one run() actually calls internally. Unit tests
  // for each return shape (in addition to the object-form tests) guard
  // against drift between the two variants.
  test('non-string input returns changed=false with reason', async () => {
    const { rewritePackageJsonRaw } = await import('../sdk-version-bump.js');
    const result = rewritePackageJsonRaw(null, '0.1.1', '0.2.0');
    assert.equal(result.changed, false);
    assert.match(result.reason, /not a string/);
  });

  test('already-at-target returns changed=false with "already at target"', async () => {
    const { rewritePackageJsonRaw } = await import('../sdk-version-bump.js');
    const raw = '{ "dependencies": { "@settlegrid/mcp": "^0.2.0" } }';
    const result = rewritePackageJsonRaw(raw, '0.1.1', '0.2.0');
    assert.equal(result.changed, false);
    assert.match(result.reason, /already at target/);
  });

  test('version mismatch emits warning=true with helpful message', async () => {
    const { rewritePackageJsonRaw } = await import('../sdk-version-bump.js');
    const raw = '{ "dependencies": { "@settlegrid/mcp": "^0.5.0" } }';
    const result = rewritePackageJsonRaw(raw, '0.1.1', '0.2.0');
    assert.equal(result.changed, false);
    assert.equal(result.warning, true);
    assert.match(result.reason, /does not match --from/);
  });

  test('malformed JSON throws (so callers can report a parse error)', async () => {
    const { rewritePackageJsonRaw } = await import('../sdk-version-bump.js');
    assert.throws(
      () => rewritePackageJsonRaw('{ not valid json', '0.1.1', '0.2.0'),
      SyntaxError,
    );
  });

  test('unparseable version range returns warning=true, reason includes "unrecognised"', async () => {
    const { rewritePackageJsonRaw } = await import('../sdk-version-bump.js');
    const raw = '{ "dependencies": { "@settlegrid/mcp": ">=0.1.1" } }';
    const result = rewritePackageJsonRaw(raw, '0.1.1', '0.2.0');
    assert.equal(result.changed, false);
    assert.equal(result.warning, true);
    assert.match(result.reason, /unrecognised version range/i);
  });

  test('@settlegrid/mcp genuinely absent returns reason="not in dependencies" (no false warning)', async () => {
    const { rewritePackageJsonRaw } = await import('../sdk-version-bump.js');
    const raw = '{ "dependencies": { "zod": "^3.22.0" } }';
    const result = rewritePackageJsonRaw(raw, '0.1.1', '0.2.0');
    assert.equal(result.changed, false);
    assert.match(result.reason, /not in dependencies/);
    // Absent ≠ unrecognised. Don't emit warning=true here — the template
    // just doesn't depend on the SDK and should be silently skipped.
    assert.notEqual(result.warning, true);
  });
});

describe('resolveRenameMap', () => {
  test('known version pair returns registered map', () => {
    const map = resolveRenameMap('0.1.1', '0.2.0');
    assert.ok(map);
    assert.equal(Array.isArray(map.removedImports), true);
  });

  test('unknown version pair returns empty default map', () => {
    const map = resolveRenameMap('9.9.9', '10.0.0');
    assert.deepEqual(map, { imports: {}, removedImports: [] });
  });

  test('explicit override wins over registered map', () => {
    const override = { imports: { a: 'b' }, removedImports: ['c'] };
    const map = resolveRenameMap('0.1.1', '0.2.0', override);
    assert.deepEqual(map, override);
  });

  test('0.1.1→0.2.0 default rename map is currently empty', () => {
    assert.deepEqual(DEFAULT_RENAME_MAPS['0.1.1->0.2.0'], {
      imports: {},
      removedImports: [],
    });
  });
});

// ---------------------------------------------------------------------------
// 4. run() — full per-template flow against fixtures
// ---------------------------------------------------------------------------

describe('run() against a fixture template', () => {
  test('dry run reports diff without writing', async () => {
    const dir = await tmpTemplate({
      'package.json': 'package.json',
      'src/server.ts': 'server.ts',
    });
    const result = await run(dir, { from: '0.1.1', to: '0.2.0', dryRun: true });
    assert.deepEqual(result.errors, []);
    assert.ok(result.filesTouched.includes('package.json'));
    // Verify the file on disk was NOT modified
    const raw = await readFile(path.join(dir, 'package.json'), 'utf-8');
    assert.match(raw, /\^0\.1\.1/);
    // The diff must include both lines
    const diff = result.diffs.find((d) => d.file === 'package.json');
    assert.ok(diff);
    assert.match(diff.diff, /-.*\^0\.1\.1/);
    assert.match(diff.diff, /\+.*\^0\.2\.0/);
  });

  test('apply mode writes the new bytes to package.json', async () => {
    const dir = await tmpTemplate({
      'package.json': 'package.json',
      'src/server.ts': 'server.ts',
    });
    const result = await run(dir, { from: '0.1.1', to: '0.2.0', dryRun: false });
    assert.deepEqual(result.errors, []);
    const raw = await readFile(path.join(dir, 'package.json'), 'utf-8');
    const parsed = JSON.parse(raw);
    assert.equal(parsed.dependencies['@settlegrid/mcp'], '^0.2.0');
  });

  test('idempotent: second run is a no-op', async () => {
    const dir = await tmpTemplate({
      'package.json': 'package.json',
      'src/server.ts': 'server.ts',
    });
    const first = await run(dir, { from: '0.1.1', to: '0.2.0', dryRun: false });
    assert.ok(first.filesTouched.includes('package.json'));
    const second = await run(dir, { from: '0.1.1', to: '0.2.0', dryRun: false });
    assert.ok(!second.filesTouched.includes('package.json'));
    assert.ok(second.skipped.some((s) => s.startsWith('package.json:')));
  });

  test('malformed package.json returns a structured error, does not throw', async () => {
    const dir = await tmpTemplate({
      'package.json': 'package-malformed.json',
    });
    const result = await run(dir, { from: '0.1.1', to: '0.2.0', dryRun: true });
    assert.equal(result.errors.length, 1);
    assert.match(result.errors[0], /package\.json parse failed/);
    // filesTouched stays empty; nothing written to disk
    assert.deepEqual(result.filesTouched, []);
  });

  test('non-settlegrid dependencies are untouched in the output', async () => {
    const dir = await tmpTemplate({
      'package.json': 'package-extra-deps.json',
    });
    await run(dir, { from: '0.1.1', to: '0.2.0', dryRun: false });
    const parsed = JSON.parse(await readFile(path.join(dir, 'package.json'), 'utf-8'));
    assert.equal(parsed.dependencies['@settlegrid/mcp'], '^0.2.0');
    assert.equal(parsed.dependencies.zod, '^3.22.0');
    assert.equal(parsed.dependencies.lodash, '^4.17.21');
    assert.equal(parsed.devDependencies['@types/lodash'], '^4.14.0');
  });

  test('custom rename map transforms src/server.ts', async () => {
    const dir = await tmpTemplate({
      'package.json': 'package.json',
      'src/server.ts': 'server-with-deprecated.ts',
    });
    const result = await run(dir, {
      from: '0.1.1',
      to: '0.2.0',
      dryRun: false,
      renameMap: {
        imports: { oldHelper: 'newHelper' },
        removedImports: ['deprecatedFn'],
      },
    });
    assert.deepEqual(result.errors, []);
    assert.ok(result.filesTouched.includes('src/server.ts'));
    const source = await readFile(path.join(dir, 'src/server.ts'), 'utf-8');

    // Rename: the import specifier AND the usage reference are both updated
    assert.ok(!source.includes('oldHelper'), 'oldHelper reference should be renamed');
    assert.match(source, /newHelper/);

    // Removal: the import specifier is dropped from the import declaration,
    // but downstream usages remain as compile errors that the user must fix.
    // This is the spec's intended behavior — removedImports is a signal, not
    // a code fixer.
    const importLine = source.match(/import\s+\{[^}]*\}\s+from\s+['"]@settlegrid\/mcp['"]/)?.[0] ?? '';
    assert.ok(
      !importLine.includes('deprecatedFn'),
      `deprecatedFn should be absent from the import line, got: ${importLine}`,
    );
  });

  test('unknown from version produces a skip, not an error', async () => {
    const dir = await tmpTemplate({
      'package.json': 'package-at-target.json',
    });
    const result = await run(dir, { from: '0.1.1', to: '0.2.0', dryRun: true });
    assert.deepEqual(result.errors, []);
    assert.deepEqual(result.filesTouched, []);
    // Either "already at target" or "does not match --from" — both are skips
    assert.ok(result.skipped.some((s) => s.startsWith('package.json:')));
  });

  test('missing --from or --to returns a validation error', async () => {
    const dir = await tmpTemplate({
      'package.json': 'package.json',
    });
    const result = await run(dir, { dryRun: true });
    assert.equal(result.errors.length, 1);
    assert.match(result.errors[0], /requires --from and --to/);
  });

  test('template with no package.json is skipped cleanly', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'codemod-empty-'));
    CREATED_DIRS.push(dir);
    const result = await run(dir, { from: '0.1.1', to: '0.2.0', dryRun: true });
    assert.deepEqual(result.errors, []);
    assert.ok(result.skipped.includes('package.json'));
  });

  test('unparseable version range skips with an unrecognised-range reason (not "not in deps")', async () => {
    // `>=0.1.1` is a valid semver range but our strict regex only
    // handles caret/tilde/exact. The skip reason must NOT say "not in
    // dependencies" — that would mislead the user into thinking the
    // dep is absent when it's actually present with an unhandled range.
    const dir = await mkdtemp(path.join(os.tmpdir(), 'codemod-vr-'));
    CREATED_DIRS.push(dir);
    await writeFile(
      path.join(dir, 'package.json'),
      JSON.stringify(
        { name: 't', dependencies: { '@settlegrid/mcp': '>=0.1.1' } },
        null,
        2,
      ),
    );
    const result = await run(dir, { from: '0.1.1', to: '0.2.0', dryRun: true });
    assert.deepEqual(result.errors, []);
    assert.deepEqual(result.filesTouched, []);
    assert.ok(
      result.skipped.some((s) => /unrecognised version range/i.test(s)),
      `expected unrecognised-range skip reason, got: ${result.skipped.join(', ')}`,
    );
    assert.ok(
      !result.skipped.some((s) => /not in dependencies/.test(s)),
      'must not report "not in dependencies" when the dep IS present',
    );
  });

  test('only .ts files under src/ are considered (walks src recursively, ignores .d.ts, skips non-src)', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'codemod-srcwalk-'));
    CREATED_DIRS.push(dir);
    await cp(
      path.join(FIXTURES, 'before', 'package.json'),
      path.join(dir, 'package.json'),
    );
    await mkdir(path.join(dir, 'src', 'nested'), { recursive: true });
    await mkdir(path.join(dir, 'scripts'), { recursive: true });
    const source = `import { settlegrid, oldHelper } from '@settlegrid/mcp'\noldHelper()\n`;
    await writeFile(path.join(dir, 'src', 'server.ts'), source);
    await writeFile(path.join(dir, 'src', 'nested', 'handler.ts'), source);
    // .d.ts is deliberately skipped by walkTsFiles (declaration-only)
    await writeFile(path.join(dir, 'src', 'types.d.ts'), source);
    // Files outside src/ must not be touched
    await writeFile(path.join(dir, 'build.ts'), source);
    await writeFile(path.join(dir, 'scripts', 'helper.ts'), source);

    const result = await run(dir, {
      from: '0.1.1',
      to: '0.2.0',
      dryRun: false,
      renameMap: { imports: { oldHelper: 'newHelper' }, removedImports: [] },
    });

    assert.deepEqual(result.errors, []);
    assert.ok(result.filesTouched.includes(path.join('src', 'server.ts')));
    assert.ok(result.filesTouched.includes(path.join('src', 'nested', 'handler.ts')));
    assert.ok(
      !result.filesTouched.includes('build.ts'),
      'build.ts is outside src/ and must not be walked',
    );
    assert.ok(
      !result.filesTouched.includes(path.join('scripts', 'helper.ts')),
      'scripts/helper.ts is outside src/ and must not be walked',
    );
    assert.ok(
      !result.filesTouched.includes(path.join('src', 'types.d.ts')),
      '.d.ts files must be skipped by walkTsFiles',
    );

    // Verify on-disk state: transformed inside src/, untouched outside
    const serverAfter = await readFile(path.join(dir, 'src', 'server.ts'), 'utf-8');
    assert.match(serverAfter, /newHelper/);
    const nestedAfter = await readFile(
      path.join(dir, 'src', 'nested', 'handler.ts'),
      'utf-8',
    );
    assert.match(nestedAfter, /newHelper/);
    const buildAfter = await readFile(path.join(dir, 'build.ts'), 'utf-8');
    assert.match(buildAfter, /oldHelper/);
    assert.ok(!buildAfter.includes('newHelper'));
    const helperAfter = await readFile(path.join(dir, 'scripts', 'helper.ts'), 'utf-8');
    assert.match(helperAfter, /oldHelper/);
    assert.ok(!helperAfter.includes('newHelper'));
  });

  test('src/ exists but contains no .ts files → skipped with "no .ts files" reason', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'codemod-empty-src-'));
    CREATED_DIRS.push(dir);
    await cp(
      path.join(FIXTURES, 'before', 'package.json'),
      path.join(dir, 'package.json'),
    );
    await mkdir(path.join(dir, 'src'), { recursive: true });
    // Put a non-.ts file and a .d.ts in src/ — both should be ignored
    await writeFile(path.join(dir, 'src', 'readme.md'), 'not a .ts file');
    await writeFile(path.join(dir, 'src', 'types.d.ts'), 'export type X = 1');

    const result = await run(dir, { from: '0.1.1', to: '0.2.0', dryRun: true });
    assert.deepEqual(result.errors, []);
    assert.ok(
      result.skipped.some((s) => s.includes('no .ts files')),
      `expected "no .ts files" skip, got: ${result.skipped.join(', ')}`,
    );
  });

  test('package.json read failure surfaces as a structured error (chmod 000)', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'codemod-readfail-pkg-'));
    CREATED_DIRS.push(dir);
    const pkgPath = path.join(dir, 'package.json');
    await cp(path.join(FIXTURES, 'before', 'package.json'), pkgPath);
    // Make it unreadable. existsSync still returns true (stat is allowed)
    // but readFile throws EACCES — exercises the readFile catch branch.
    await chmod(pkgPath, 0o000);
    try {
      const result = await run(dir, { from: '0.1.1', to: '0.2.0', dryRun: true });
      assert.ok(
        result.errors.some((e) => /package\.json read failed/.test(e)),
        `expected read-failed error, got: ${result.errors.join(', ')}`,
      );
      assert.deepEqual(result.filesTouched, []);
    } finally {
      await chmod(pkgPath, 0o644).catch(() => {});
    }
  });

  test('.ts file read failure surfaces as a structured error (chmod 000)', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'codemod-readfail-ts-'));
    CREATED_DIRS.push(dir);
    await cp(
      path.join(FIXTURES, 'before', 'package.json'),
      path.join(dir, 'package.json'),
    );
    await mkdir(path.join(dir, 'src'));
    const tsPath = path.join(dir, 'src', 'server.ts');
    await writeFile(
      tsPath,
      `import { settlegrid, oldHelper } from '@settlegrid/mcp'\noldHelper()\n`,
    );
    await chmod(tsPath, 0o000);
    try {
      const result = await run(dir, {
        from: '0.1.1',
        to: '0.2.0',
        dryRun: true,
        renameMap: { imports: { oldHelper: 'newHelper' }, removedImports: [] },
      });
      assert.ok(
        result.errors.some((e) => /read failed/.test(e) && e.includes('src/server.ts')),
        `expected .ts read-failed error, got: ${result.errors.join(', ')}`,
      );
    } finally {
      await chmod(tsPath, 0o644).catch(() => {});
    }
  });

  test('apply-mode write failure surfaces as a structured error (readonly template dir)', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'codemod-writefail-'));
    CREATED_DIRS.push(dir);
    await cp(
      path.join(FIXTURES, 'before', 'package.json'),
      path.join(dir, 'package.json'),
    );
    // Strip write on the template dir BEFORE running. Read+execute is
    // still allowed, so existsSync/readFile succeed and the transform
    // returns pending-write entries. The flush loop then hits the write
    // failure path (writing the tmpfile into a 555 dir returns EACCES).
    await chmod(dir, 0o555);
    try {
      const result = await run(dir, { from: '0.1.1', to: '0.2.0', dryRun: false });
      assert.ok(
        result.errors.some((e) => /write failed/.test(e)),
        `expected write-failed error, got: ${result.errors.join(', ')}`,
      );
      // Original file must remain untouched (rename-into-place invariant)
      const onDisk = await readFile(path.join(dir, 'package.json'), 'utf-8');
      assert.match(onDisk, /\^0\.1\.1/);
    } finally {
      // Restore perms so `after()` cleanup can rm the dir.
      await chmod(dir, 0o755).catch(() => {});
    }
  });

  test('walkTsFiles silently skips subdirectories it cannot read (readdir EACCES catch)', async () => {
    // Covers the `try { readdir(...) } catch { return }` branch in the
    // recursive walker: the walker must not abort when it encounters an
    // unreadable subdirectory — it just skips it and keeps going.
    const dir = await mkdtemp(path.join(os.tmpdir(), 'codemod-unreadable-'));
    CREATED_DIRS.push(dir);
    await cp(
      path.join(FIXTURES, 'before', 'package.json'),
      path.join(dir, 'package.json'),
    );
    await mkdir(path.join(dir, 'src', 'readable'), { recursive: true });
    const readableTs = path.join(dir, 'src', 'readable', 'ok.ts');
    await writeFile(
      readableTs,
      `import { settlegrid, oldHelper } from '@settlegrid/mcp'\noldHelper()\n`,
    );
    const unreadableDir = path.join(dir, 'src', 'unreadable');
    await mkdir(unreadableDir);
    await writeFile(
      path.join(unreadableDir, 'hidden.ts'),
      `import { settlegrid, oldHelper } from '@settlegrid/mcp'\noldHelper()\n`,
    );
    await chmod(unreadableDir, 0o000);
    try {
      const result = await run(dir, {
        from: '0.1.1',
        to: '0.2.0',
        dryRun: false,
        renameMap: { imports: { oldHelper: 'newHelper' }, removedImports: [] },
      });
      assert.deepEqual(result.errors, []);
      assert.ok(
        result.filesTouched.some((f) => f.includes('readable') && f.endsWith('ok.ts')),
        `expected readable/ok.ts to be touched, got: ${result.filesTouched.join(', ')}`,
      );
      assert.ok(
        !result.filesTouched.some((f) => f.includes('hidden.ts')),
        'hidden.ts inside unreadable dir must not appear in filesTouched',
      );
    } finally {
      await chmod(unreadableDir, 0o755).catch(() => {});
    }
  });

  test('rollback on error: apply mode leaves no partial writes when a transform fails', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'codemod-rollback-'));
    CREATED_DIRS.push(dir);
    await cp(
      path.join(FIXTURES, 'before', 'package.json'),
      path.join(dir, 'package.json'),
    );
    await mkdir(path.join(dir, 'src'), { recursive: true });
    // First file: valid import the rename map would transform (queued for write)
    await writeFile(
      path.join(dir, 'src', 'a.ts'),
      `import { settlegrid, oldHelper } from '@settlegrid/mcp'\noldHelper()\n`,
    );
    // Second file: @settlegrid/mcp import + unterminated template literal.
    // The `@settlegrid/mcp` substring forces rewriteServerSource to attempt
    // a parse, and the unterminated backtick makes babel throw.
    await writeFile(
      path.join(dir, 'src', 'b.ts'),
      'import { settlegrid } from \'@settlegrid/mcp\'\nconst x = `unterminated\n',
    );

    const originalPkg = await readFile(path.join(dir, 'package.json'), 'utf-8');
    const originalA = await readFile(path.join(dir, 'src', 'a.ts'), 'utf-8');

    const result = await run(dir, {
      from: '0.1.1',
      to: '0.2.0',
      dryRun: false, // apply mode — rollback only matters with writes enabled
      renameMap: { imports: { oldHelper: 'newHelper' }, removedImports: [] },
    });

    assert.ok(result.errors.length > 0, 'expected a transform error');
    assert.ok(
      result.errors.some((e) => e.includes('transform failed')),
      `expected a "transform failed" error, got: ${result.errors.join(', ')}`,
    );

    // Rollback invariant: NO file on disk should have been modified, even
    // though package.json and src/a.ts were already queued for writing.
    const pkgAfter = await readFile(path.join(dir, 'package.json'), 'utf-8');
    const aAfter = await readFile(path.join(dir, 'src', 'a.ts'), 'utf-8');
    assert.equal(
      pkgAfter,
      originalPkg,
      'package.json must not be written when a later transform fails',
    );
    assert.equal(
      aAfter,
      originalA,
      'src/a.ts must not be written when a later transform fails',
    );
  });
});

// ---------------------------------------------------------------------------
// 5. runner.mjs — glob + orchestrator
// ---------------------------------------------------------------------------

describe('runner.mjs', () => {
  test('parseArgs extracts positional codemod + --apply + --target', () => {
    const args = parseArgs(['sdk-version-bump', '--from', '0.1.1', '--to', '0.2.0', '--target', 'foo/bar', '--apply']);
    assert.equal(args.codemod, 'sdk-version-bump');
    assert.equal(args.apply, true);
    assert.equal(args.target, 'foo/bar');
    assert.equal(args.options.from, '0.1.1');
    assert.equal(args.options.to, '0.2.0');
  });

  test('parseArgs defaults: no --apply, default target glob', () => {
    const args = parseArgs(['sdk-version-bump', '--from', '0.1.1', '--to', '0.2.0']);
    assert.equal(args.apply, false);
    assert.equal(args.target, 'open-source-servers/*');
  });

  test('parseArgs throws when --target is missing a value (end of argv)', () => {
    assert.throws(
      () => parseArgs(['sdk-version-bump', '--target']),
      /--target requires a value/,
    );
  });

  test('parseArgs throws when --target is followed by another flag (no value)', () => {
    assert.throws(
      () => parseArgs(['sdk-version-bump', '--target', '--apply']),
      /--target requires a value/,
    );
  });

  test('parseArgs treats a bare flag at end-of-argv as a boolean true', () => {
    // Exercises the `args.options[key] = true` branch for flags that
    // have no following value (i.e. plain booleans).
    const args = parseArgs(['sdk-version-bump', '--verbose']);
    assert.equal(args.codemod, 'sdk-version-bump');
    assert.equal(args.options.verbose, true);
  });

  test('parseArgs treats a flag followed by another flag as a boolean true', () => {
    const args = parseArgs(['sdk-version-bump', '--dry', '--apply']);
    assert.equal(args.options.dry, true);
    assert.equal(args.apply, true);
  });

  test('loadCodemod rejects path-traversal names (security)', async () => {
    await assert.rejects(
      () => loadCodemod('../../etc/passwd'),
      /invalid codemod name/,
    );
    await assert.rejects(() => loadCodemod('foo/bar'), /invalid codemod name/);
    await assert.rejects(() => loadCodemod(''), /invalid codemod name/);
    await assert.rejects(() => loadCodemod('-leading-dash'), /invalid codemod name/);
  });

  test('loadCodemod accepts safe names', async () => {
    const { name } = await loadCodemod('sdk-version-bump');
    assert.equal(name, 'sdk-version-bump');
  });

  test('resolveGlob expands a trailing /* to sorted directory list', async () => {
    const parent = await mkdtemp(path.join(os.tmpdir(), 'codemod-glob-'));
    CREATED_DIRS.push(parent);
    await mkdir(path.join(parent, 'b'));
    await mkdir(path.join(parent, 'a'));
    await mkdir(path.join(parent, 'c'));
    const dirs = await resolveGlob(path.join(parent, '*'), parent);
    assert.equal(dirs.length, 3);
    // Sorted alphabetically
    assert.ok(dirs[0].endsWith('/a'));
    assert.ok(dirs[1].endsWith('/b'));
    assert.ok(dirs[2].endsWith('/c'));
  });

  test('resolveGlob with an exact directory path returns a one-element list', async () => {
    const parent = await mkdtemp(path.join(os.tmpdir(), 'codemod-exact-'));
    CREATED_DIRS.push(parent);
    await mkdir(path.join(parent, 'only'));
    const dirs = await resolveGlob(path.join(parent, 'only'), parent);
    assert.equal(dirs.length, 1);
    assert.ok(dirs[0].endsWith('/only'));
  });

  test('resolveGlob with an exact file path returns []', async () => {
    const parent = await mkdtemp(path.join(os.tmpdir(), 'codemod-exactfile-'));
    CREATED_DIRS.push(parent);
    await writeFile(path.join(parent, 'file.txt'), '');
    const dirs = await resolveGlob(path.join(parent, 'file.txt'), parent);
    assert.deepEqual(dirs, []);
  });

  test('resolveGlob with a non-existent path returns []', async () => {
    const parent = await mkdtemp(path.join(os.tmpdir(), 'codemod-nope-'));
    CREATED_DIRS.push(parent);
    const dirs = await resolveGlob(path.join(parent, 'nope'), parent);
    assert.deepEqual(dirs, []);
  });

  test('resolveGlob with /* over a missing parent returns []', async () => {
    const dirs = await resolveGlob('/definitely/does/not/exist/*', '/');
    assert.deepEqual(dirs, []);
  });

  test('loadCodemod throws when the module lacks a run function', async () => {
    // Create a tmpdir "codemods" with a stub that exports nothing useful,
    // then point loadCodemod at it. This exercises the "no run export"
    // branch without polluting the real codemods directory.
    const stubDir = await mkdtemp(path.join(os.tmpdir(), 'codemod-stub-'));
    CREATED_DIRS.push(stubDir);
    await writeFile(
      path.join(stubDir, 'broken-codemod.mjs'),
      'export const hello = 1\n',
    );
    await assert.rejects(
      () => loadCodemod('broken-codemod', stubDir),
      /does not export a run\(\) function/,
    );
  });

  test('loadCodemod throws with a clear message when the codemod is not found', async () => {
    const stubDir = await mkdtemp(path.join(os.tmpdir(), 'codemod-notfound-'));
    CREATED_DIRS.push(stubDir);
    await assert.rejects(
      () => loadCodemod('missing-codemod', stubDir),
      /not found in/,
    );
  });

  test('loadCodemod loads a .mjs module that exports default function', async () => {
    const stubDir = await mkdtemp(path.join(os.tmpdir(), 'codemod-default-'));
    CREATED_DIRS.push(stubDir);
    await writeFile(
      path.join(stubDir, 'default-fn-codemod.mjs'),
      'export default async function run() { return { filesTouched: [], skipped: [], errors: [], diffs: [] } }\n',
    );
    const { name, run } = await loadCodemod('default-fn-codemod', stubDir);
    assert.equal(name, 'default-fn-codemod');
    const result = await run('/tmp');
    assert.deepEqual(result.filesTouched, []);
  });

  test('runCodemod catches a thrown error from the codemod and records a fatal error', async () => {
    // A codemod that throws during run() should NOT crash the runner —
    // the error is captured as a per-template fatal and the rest of the
    // run continues. This exercises the catch-branch in runCodemod.
    const parent = await mkdtemp(path.join(os.tmpdir(), 'codemod-throws-parent-'));
    CREATED_DIRS.push(parent);
    await mkdir(path.join(parent, 'alpha'));
    await mkdir(path.join(parent, 'beta'));

    const stubCodemodsDir = await mkdtemp(path.join(os.tmpdir(), 'codemod-throws-dir-'));
    CREATED_DIRS.push(stubCodemodsDir);
    // Stub that throws on alpha but returns a clean result on beta, so
    // we can assert the runner doesn't abort after the first throw.
    await writeFile(
      path.join(stubCodemodsDir, 'selective-throw.mjs'),
      `export async function run(dir) {
  if (dir.endsWith('alpha')) throw new Error('boom from alpha');
  return { filesTouched: [], skipped: ['nothing to do'], errors: [], diffs: [] };
}\n`,
    );
    const auditDir = await mkdtemp(path.join(os.tmpdir(), 'codemod-throws-audit-'));
    CREATED_DIRS.push(auditDir);

    const summary = await runCodemod({
      codemod: 'selective-throw',
      target: path.join(parent, '*'),
      apply: false,
      options: {},
      persistLastRun: false,
      codemodsDir: stubCodemodsDir,
      auditFailuresDir: auditDir,
    });

    assert.equal(summary.totals.templates, 2);
    assert.ok(summary.totals.errors >= 1);
    const alpha = summary.templates.find((t) => t.dir.endsWith('alpha'));
    const beta = summary.templates.find((t) => t.dir.endsWith('beta'));
    assert.ok(alpha, 'alpha template should be present');
    assert.ok(beta, 'beta template should be present even though alpha threw');
    assert.ok(
      alpha.errors.some((e) => e.includes('fatal:') && e.includes('boom from alpha')),
      `expected fatal error on alpha, got: ${alpha.errors.join(', ')}`,
    );
    assert.deepEqual(beta.errors, [], 'beta should be untouched by alpha failure');
  });

  test('runCodemod aggregates per-template results', async () => {
    const parent = await mkdtemp(path.join(os.tmpdir(), 'codemod-agg-'));
    CREATED_DIRS.push(parent);
    const auditDir = await mkdtemp(path.join(os.tmpdir(), 'codemod-audit-'));
    CREATED_DIRS.push(auditDir);
    // Two valid templates + one with a malformed package.json
    for (const [name, fixture] of [
      ['alpha', 'package.json'],
      ['beta', 'package.json'],
      ['broken', 'package-malformed.json'],
    ]) {
      await mkdir(path.join(parent, name), { recursive: true });
      await cp(
        path.join(FIXTURES, 'before', fixture),
        path.join(parent, name, 'package.json'),
      );
    }
    const summary = await runCodemod({
      codemod: 'sdk-version-bump',
      target: path.join(parent, '*'),
      apply: false,
      options: { from: '0.1.1', to: '0.2.0' },
      persistLastRun: false,
      auditFailuresDir: auditDir,
    });
    assert.equal(summary.totals.templates, 3);
    // alpha + beta each touch package.json in dry-run
    assert.equal(summary.totals.filesTouched, 2);
    // broken has exactly 1 error
    assert.ok(summary.totals.errors >= 1);
    // Verify no files on disk were written in dry run
    const raw = await readFile(path.join(parent, 'alpha', 'package.json'), 'utf-8');
    assert.match(raw, /\^0\.1\.1/);
  });

  test('runner writes failure log to the provided auditFailuresDir', async () => {
    const parent = await mkdtemp(path.join(os.tmpdir(), 'codemod-fail-'));
    CREATED_DIRS.push(parent);
    const auditDir = await mkdtemp(path.join(os.tmpdir(), 'codemod-fail-log-'));
    CREATED_DIRS.push(auditDir);
    // One template with malformed package.json so the runner logs a failure
    await mkdir(path.join(parent, 'broken'));
    await cp(
      path.join(FIXTURES, 'before', 'package-malformed.json'),
      path.join(parent, 'broken', 'package.json'),
    );
    await runCodemod({
      codemod: 'sdk-version-bump',
      target: path.join(parent, '*'),
      apply: false,
      options: { from: '0.1.1', to: '0.2.0' },
      persistLastRun: false,
      auditFailuresDir: auditDir,
    });
    // Exactly one codemod-*.json file should exist under the override dir,
    // and it should contain the slug "broken" as the failing template.
    const { readdir } = await import('node:fs/promises');
    const files = await readdir(auditDir);
    const logs = files.filter((f) => f.startsWith('codemod-sdk-version-bump-'));
    assert.equal(logs.length, 1);
    // .jsonl files are one-object-per-line (compact JSON, no pretty-print)
    // so multiple same-day runs can be stream-parsed line by line.
    assert.ok(logs[0].endsWith('.jsonl'), `expected .jsonl file, got ${logs[0]}`);
    const content = await readFile(path.join(auditDir, logs[0]), 'utf-8');
    assert.match(content, /"codemod":"sdk-version-bump"/);
    assert.match(content, /broken/);
    // Each line must parse as a standalone JSON object (jsonl invariant)
    const lines = content.trim().split('\n');
    for (const line of lines) {
      const parsed = JSON.parse(line);
      assert.equal(parsed.codemod, 'sdk-version-bump');
    }
  });

  test('CLI entry: smoke test via spawned subprocess (dry run against a tmp template)', async () => {
    // Shell out to `node scripts/codemods/runner.mjs` to exercise the
    // cliMain entry point — the in-process runCodemod tests can't
    // cover the top-level CLI glue (arg parsing wiring, printDiff,
    // summary line, exit code).
    const { spawn } = await import('node:child_process');
    const parent = await mkdtemp(path.join(os.tmpdir(), 'codemod-cli-'));
    CREATED_DIRS.push(parent);
    await mkdir(path.join(parent, 'only'));
    await cp(
      path.join(FIXTURES, 'before', 'package.json'),
      path.join(parent, 'only', 'package.json'),
    );
    const repoRoot = path.resolve(__dirname, '..', '..', '..');
    const runnerPath = path.join(repoRoot, 'scripts', 'codemods', 'runner.mjs');

    const child = spawn(
      process.execPath,
      [
        runnerPath,
        'sdk-version-bump',
        '--from',
        '0.1.1',
        '--to',
        '0.2.0',
        '--target',
        path.join(parent, '*'),
      ],
      { stdio: ['ignore', 'pipe', 'pipe'] },
    );
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (c) => (stdout += c.toString()));
    child.stderr.on('data', (c) => (stderr += c.toString()));
    const exitCode = await new Promise((resolve, reject) => {
      child.on('error', reject);
      child.on('close', resolve);
    });

    assert.equal(exitCode, 0, `expected exit 0, got ${exitCode}\nstderr: ${stderr}`);
    // CLI prints the per-template diff block...
    assert.match(stdout, /=== .*only ===/);
    assert.match(stdout, /^-.*\^0\.1\.1/m);
    assert.match(stdout, /^\+.*\^0\.2\.0/m);
    // ...and a summary line with the sdk-version-bump tag
    assert.match(stdout, /\[codemod:sdk-version-bump\]/);
    assert.match(stdout, /1 templates, 1 files would touch/);
    assert.match(stdout, /DRY RUN — pass --apply to write changes/);
    // The CLI did NOT write to disk in dry-run
    const pkgRaw = await readFile(path.join(parent, 'only', 'package.json'), 'utf-8');
    assert.match(pkgRaw, /\^0\.1\.1/);
  });

  test('CLI entry: missing codemod name prints usage and exits 1', async () => {
    const { spawn } = await import('node:child_process');
    const repoRoot = path.resolve(__dirname, '..', '..', '..');
    const runnerPath = path.join(repoRoot, 'scripts', 'codemods', 'runner.mjs');
    const child = spawn(process.execPath, [runnerPath], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stderr = '';
    child.stderr.on('data', (c) => (stderr += c.toString()));
    const exitCode = await new Promise((resolve, reject) => {
      child.on('error', reject);
      child.on('close', resolve);
    });
    assert.equal(exitCode, 1);
    assert.match(stderr, /Usage:/);
  });

  test('CLI entry: zero templates matched exits 1 with explanatory line', async () => {
    const { spawn } = await import('node:child_process');
    const repoRoot = path.resolve(__dirname, '..', '..', '..');
    const runnerPath = path.join(repoRoot, 'scripts', 'codemods', 'runner.mjs');
    const child = spawn(
      process.execPath,
      [
        runnerPath,
        'sdk-version-bump',
        '--from',
        '0.1.1',
        '--to',
        '0.2.0',
        '--target',
        '/definitely/does/not/exist',
      ],
      { stdio: ['ignore', 'pipe', 'pipe'] },
    );
    let stdout = '';
    child.stdout.on('data', (c) => (stdout += c.toString()));
    const exitCode = await new Promise((resolve, reject) => {
      child.on('error', reject);
      child.on('close', resolve);
    });
    assert.equal(exitCode, 1);
    assert.match(stdout, /no templates matched target/);
  });

  test('runner writes .last-run.json when persistLastRun is not false', async () => {
    const parent = await mkdtemp(path.join(os.tmpdir(), 'codemod-lr-'));
    CREATED_DIRS.push(parent);
    await mkdir(path.join(parent, 'one'));
    await cp(
      path.join(FIXTURES, 'before', 'package.json'),
      path.join(parent, 'one', 'package.json'),
    );
    const summary = await runCodemod({
      codemod: 'sdk-version-bump',
      target: path.join(parent, '*'),
      apply: false,
      options: { from: '0.1.1', to: '0.2.0' },
      // persistLastRun default = true
    });
    const lastRun = path.join(
      path.dirname(url.fileURLToPath(import.meta.url)),
      '..',
      '.last-run.json',
    );
    assert.ok(existsSync(lastRun));
    const content = JSON.parse(await readFile(lastRun, 'utf-8'));
    assert.equal(content.codemod, 'sdk-version-bump');
    assert.equal(content.totals.templates, 1);
  });
});

// ---------------------------------------------------------------------------
// 6. Diff format stability
// ---------------------------------------------------------------------------

describe('diff output', () => {
  test('produces a stable unified-diff format', async () => {
    const dir = await tmpTemplate({ 'package.json': 'package.json' });
    const result = await run(dir, { from: '0.1.1', to: '0.2.0', dryRun: true });
    const diff = result.diffs.find((d) => d.file === 'package.json');
    assert.ok(diff);
    // File header + exactly one -/+ pair (minimal diff, no whole-file reformat)
    assert.match(diff.diff, /^--- a\/package\.json\n\+\+\+ b\/package\.json\n/);
    assert.match(diff.diff, /^-.*"@settlegrid\/mcp": "\^0\.1\.1"/m);
    assert.match(diff.diff, /^\+.*"@settlegrid\/mcp": "\^0\.2\.0"/m);
    // Exactly one removed line and one added line — proves we're not
    // reformatting the whole file on every transform.
    const removed = (diff.diff.match(/^-[^-+]/gm) || []).length;
    const added = (diff.diff.match(/^\+[^-+]/gm) || []).length;
    assert.equal(removed, 1, `expected exactly 1 removed line, got ${removed}`);
    assert.equal(added, 1, `expected exactly 1 added line, got ${added}`);
  });
});
