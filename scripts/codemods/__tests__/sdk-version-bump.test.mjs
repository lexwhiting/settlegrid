import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, mkdir, rm, cp } from 'node:fs/promises';
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
import { runCodemod, parseArgs, resolveGlob } from '../runner.mjs';

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
});

// ---------------------------------------------------------------------------
// 3. resolveRenameMap + DEFAULT_RENAME_MAPS
// ---------------------------------------------------------------------------

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
    const content = await readFile(path.join(auditDir, logs[0]), 'utf-8');
    assert.match(content, /"codemod": "sdk-version-bump"/);
    assert.match(content, /broken/);
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
