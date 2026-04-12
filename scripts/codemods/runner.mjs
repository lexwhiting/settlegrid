#!/usr/bin/env node
/**
 * Codemod runner (P1.11)
 *
 * Usage:
 *   node scripts/codemods/runner.mjs <codemod-name> [options] [--apply]
 *
 * Default target glob: open-source-servers/*
 * Default mode: dry-run (prints unified diff, no writes)
 *
 * Options are forwarded to the codemod. Common examples:
 *   --from 0.1.1 --to 0.2.0       (sdk-version-bump)
 *   --target "open-source-servers/settlegrid-500px"
 *
 * Results:
 *   - Per-run summary in scripts/codemods/.last-run.json
 *   - Parse failures (per template) logged to
 *     docs/audit-failures/codemod-<name>-<YYYY-MM-DD>.json
 */

import { readdir, stat, mkdir, writeFile, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import * as path from 'node:path';
import * as url from 'node:url';

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const CODEMODS_DIR = __dirname;
const LAST_RUN_FILE = path.join(CODEMODS_DIR, '.last-run.json');
const AUDIT_FAILURES_DIR = path.join(REPO_ROOT, 'docs', 'audit-failures');
const DEFAULT_TARGET_GLOB = 'open-source-servers/*';

// ---------------------------------------------------------------------------
// Arg parsing — deliberately simple, no external deps
// ---------------------------------------------------------------------------

/**
 * Parse argv into { codemod, target, apply, options }.
 * Positional arg is the codemod name. --flags collect into options.
 */
export function parseArgs(argv) {
  const args = {
    codemod: null,
    target: DEFAULT_TARGET_GLOB,
    apply: false,
    options: {},
  };
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--apply') {
      args.apply = true;
    } else if (arg === '--target') {
      args.target = argv[++i];
    } else if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith('--')) {
        args.options[key] = next;
        i++;
      } else {
        args.options[key] = true;
      }
    } else {
      positional.push(arg);
    }
  }
  if (positional.length > 0) args.codemod = positional[0];
  return args;
}

// ---------------------------------------------------------------------------
// Glob resolution — minimal, supports trailing /*
// ---------------------------------------------------------------------------

/**
 * Expand a glob like "open-source-servers/*" into an array of absolute
 * directory paths. Only supports a single trailing /* wildcard, which is
 * all the codemod runner needs.
 */
export async function resolveGlob(pattern, baseDir = REPO_ROOT) {
  const absolute = path.isAbsolute(pattern) ? pattern : path.resolve(baseDir, pattern);
  if (!absolute.endsWith('/*') && !absolute.endsWith('\\*')) {
    // Exact path — check if it's a directory
    try {
      const s = await stat(absolute);
      return s.isDirectory() ? [absolute] : [];
    } catch {
      return [];
    }
  }
  const parent = absolute.slice(0, -2);
  try {
    const entries = await readdir(parent, { withFileTypes: true });
    return entries
      .filter((e) => e.isDirectory())
      .map((e) => path.join(parent, e.name))
      .sort();
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Codemod loading
// ---------------------------------------------------------------------------

/**
 * Load a codemod module by name from scripts/codemods/<name>.js.
 * Module must export a default function or a `run` function.
 */
export async function loadCodemod(name) {
  const candidates = [
    path.join(CODEMODS_DIR, `${name}.js`),
    path.join(CODEMODS_DIR, `${name}.mjs`),
  ];
  for (const file of candidates) {
    if (existsSync(file)) {
      const mod = await import(url.pathToFileURL(file).href);
      const run = mod.run ?? mod.default?.run ?? mod.default;
      if (typeof run !== 'function') {
        throw new Error(`codemod "${name}" does not export a run() function`);
      }
      return { name, run, module: mod };
    }
  }
  throw new Error(`codemod "${name}" not found in ${CODEMODS_DIR}`);
}

// ---------------------------------------------------------------------------
// Failure log writer
// ---------------------------------------------------------------------------

async function writeFailureLog(codemodName, failures, targetDir = AUDIT_FAILURES_DIR) {
  if (failures.length === 0) return null;
  try {
    await mkdir(targetDir, { recursive: true });
    const date = new Date().toISOString().slice(0, 10);
    const logPath = path.join(
      targetDir,
      `codemod-${codemodName}-${date}.json`,
    );
    const entry = {
      timestamp: new Date().toISOString(),
      codemod: codemodName,
      failures,
    };
    // Append as JSONL so multiple runs on the same day accumulate
    await writeFile(
      logPath,
      JSON.stringify(entry, null, 2) + '\n',
      { flag: 'a' },
    );
    return logPath;
  } catch (err) {
    // Never let log writing crash the runner
    // eslint-disable-next-line no-console
    console.warn(`[codemod-runner] failed to write failure log: ${err.message}`);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Public orchestrator — used by tests AND the CLI entry
// ---------------------------------------------------------------------------

/**
 * Run a codemod against every directory in the resolved target glob.
 *
 * @param {{
 *   codemod: string,
 *   target?: string,
 *   apply?: boolean,
 *   options?: Record<string, unknown>,
 *   baseDir?: string,
 *   persistLastRun?: boolean,
 * }} args
 * @returns {Promise<{
 *   codemod: string,
 *   target: string,
 *   apply: boolean,
 *   templates: Array<{ dir: string, filesTouched: string[], skipped: string[], errors: string[], diffs: Array<{ file: string, diff: string }> }>,
 *   totals: { templates: number, filesTouched: number, errors: number, skipped: number },
 * }>}
 */
export async function runCodemod(args) {
  const target = args.target ?? DEFAULT_TARGET_GLOB;
  const baseDir = args.baseDir ?? REPO_ROOT;
  const apply = args.apply === true;
  const options = args.options ?? {};

  const { name, run } = await loadCodemod(args.codemod);
  const dirs = await resolveGlob(target, baseDir);

  const perTemplate = [];
  const failures = [];

  for (const dir of dirs) {
    try {
      const result = await run(dir, { ...options, dryRun: !apply });
      perTemplate.push({
        dir,
        filesTouched: result.filesTouched ?? [],
        skipped: result.skipped ?? [],
        errors: result.errors ?? [],
        diffs: result.diffs ?? [],
      });
      if ((result.errors ?? []).length > 0) {
        failures.push({
          dir,
          errors: result.errors,
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      perTemplate.push({
        dir,
        filesTouched: [],
        skipped: [],
        errors: [`fatal: ${msg}`],
        diffs: [],
      });
      failures.push({ dir, errors: [msg] });
    }
  }

  const totals = perTemplate.reduce(
    (acc, t) => ({
      templates: acc.templates + 1,
      filesTouched: acc.filesTouched + t.filesTouched.length,
      errors: acc.errors + t.errors.length,
      skipped: acc.skipped + t.skipped.length,
    }),
    { templates: 0, filesTouched: 0, errors: 0, skipped: 0 },
  );

  const summary = {
    codemod: name,
    target,
    apply,
    templates: perTemplate,
    totals,
  };

  if (args.persistLastRun !== false) {
    try {
      await writeFile(LAST_RUN_FILE, JSON.stringify(summary, null, 2) + '\n');
    } catch {
      /* non-fatal */
    }
  }

  if (failures.length > 0) {
    await writeFailureLog(name, failures, args.auditFailuresDir ?? AUDIT_FAILURES_DIR);
  }

  return summary;
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

function printDiff(summary) {
  for (const t of summary.templates) {
    if (t.diffs.length === 0 && t.errors.length === 0) continue;
    const rel = path.relative(REPO_ROOT, t.dir) || t.dir;
    process.stdout.write(`\n=== ${rel} ===\n`);
    for (const d of t.diffs) {
      process.stdout.write(`--- ${d.file}\n`);
      process.stdout.write(d.diff);
      if (!d.diff.endsWith('\n')) process.stdout.write('\n');
    }
    for (const e of t.errors) {
      process.stdout.write(`error: ${e}\n`);
    }
  }
}

async function cliMain() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.codemod) {
    console.error('Usage: node scripts/codemods/runner.mjs <codemod-name> [--target glob] [--apply] [--key value ...]');
    process.exit(1);
  }

  const summary = await runCodemod({
    codemod: args.codemod,
    target: args.target,
    apply: args.apply,
    options: args.options,
  });

  printDiff(summary);

  process.stdout.write(
    `\n[codemod:${summary.codemod}] ${summary.totals.templates} templates, ` +
      `${summary.totals.filesTouched} files ${summary.apply ? 'touched' : 'would touch'}, ` +
      `${summary.totals.skipped} skipped, ${summary.totals.errors} errors\n`,
  );
  if (!summary.apply && summary.totals.filesTouched > 0) {
    process.stdout.write(
      `[codemod:${summary.codemod}] DRY RUN — pass --apply to write changes\n`,
    );
  }
  if (summary.totals.errors > 0) process.exitCode = 1;
}

// Only run the CLI when invoked directly, not when imported by tests.
if (import.meta.url === url.pathToFileURL(process.argv[1] || '').href) {
  cliMain().catch((err) => {
    console.error('[codemod-runner] fatal:', err instanceof Error ? err.stack : err);
    process.exit(2);
  });
}
