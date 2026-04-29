/**
 * Orchestrator — walks the corpus, hashes sources for cross-template
 * originality checks, dispatches every rule against every template, and
 * assembles VerdictResult records.
 *
 * Designed for testability: accepts a filesystem adapter so unit tests
 * can drive an in-memory corpus without touching disk.
 */

import * as fsp from 'node:fs/promises';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import type {
  CorpusIndex,
  Rule,
  RuleFinding,
  TemplateInput,
  VerdictResult,
} from './types.js';
import { assignVerdict } from './verdict.js';
import { normalizeReadme, normalizeSource } from './rules/originality.js';

const CORPUS_READ_FILES = [
  'package.json',
  'src/server.ts',
  'README.md',
  'tsconfig.json',
  'Dockerfile',
  'vercel.json',
  'LICENSE',
  'template.json',
] as const;

export interface FsAdapter {
  listSlugs(root: string): Promise<string[]>;
  readFiles(root: string, slug: string, files: readonly string[]): Promise<Map<string, string>>;
}

export const realFsAdapter: FsAdapter = {
  async listSlugs(root: string): Promise<string[]> {
    const entries = await fsp.readdir(root, { withFileTypes: true });
    return entries
      .filter((e) => e.isDirectory() && e.name.startsWith('settlegrid-'))
      .map((e) => e.name.replace(/^settlegrid-/, ''))
      .sort();
  },
  async readFiles(
    root: string,
    slug: string,
    files: readonly string[],
  ): Promise<Map<string, string>> {
    const dir = path.join(root, `settlegrid-${slug}`);
    const out = new Map<string, string>();
    for (const f of files) {
      try {
        out.set(f, await fsp.readFile(path.join(dir, f), 'utf-8'));
      } catch {
        // File missing — intentionally omitted from map; rules check presence.
      }
    }
    return out;
  },
};

export interface RunAuditOptions {
  root: string;
  rules: Rule[];
  fs?: FsAdapter;
  /** Per-slug filter (substring match). Useful for sampling. */
  onlySlugs?: string[];
  /** Upper bound on templates audited (after filter). */
  limit?: number;
  /** Progress callback — called once per template completed. */
  onProgress?: (slug: string, result: VerdictResult) => void;
}

export interface RunAuditResult {
  results: VerdictResult[];
  corpus: CorpusIndex;
  ruleActivations: Record<string, number>;
}

function hashContent(s: string): string {
  return crypto.createHash('sha256').update(s).digest('hex').slice(0, 16);
}

export async function buildCorpusIndex(
  root: string,
  fs: FsAdapter,
  onlySlugs?: string[],
  limit?: number,
): Promise<{
  slugs: string[];
  fileMaps: Map<string, Map<string, string>>;
  index: CorpusIndex;
}> {
  let slugs = await fs.listSlugs(root);
  if (onlySlugs && onlySlugs.length > 0) {
    slugs = slugs.filter((s) => onlySlugs.includes(s));
  }
  if (typeof limit === 'number') {
    slugs = slugs.slice(0, limit);
  }

  const fileMaps = new Map<string, Map<string, string>>();
  const sourceHashIndex = new Map<string, string[]>();
  const readmeHashIndex = new Map<string, string[]>();
  const canonicalSlugs = new Set<string>();

  for (const slug of slugs) {
    const files = await fs.readFiles(root, slug, CORPUS_READ_FILES);
    fileMaps.set(slug, files);

    const serverTs = files.get('src/server.ts') ?? '';
    if (serverTs) {
      const hash = hashContent(normalizeSource(serverTs, slug));
      const arr = sourceHashIndex.get(hash) ?? [];
      arr.push(slug);
      sourceHashIndex.set(hash, arr);
    }
    const readme = files.get('README.md') ?? '';
    if (readme) {
      const hash = hashContent(normalizeReadme(readme, slug));
      const arr = readmeHashIndex.get(hash) ?? [];
      arr.push(slug);
      readmeHashIndex.set(hash, arr);
    }
    if (files.has('template.json')) {
      canonicalSlugs.add(slug);
    }
  }

  return {
    slugs,
    fileMaps,
    index: {
      sourceHashIndex,
      readmeHashIndex,
      canonicalSlugs,
      totalTemplates: slugs.length,
    },
  };
}

export async function runAudit(options: RunAuditOptions): Promise<RunAuditResult> {
  const fs = options.fs ?? realFsAdapter;
  const { slugs, fileMaps, index } = await buildCorpusIndex(
    options.root,
    fs,
    options.onlySlugs,
    options.limit,
  );

  const ruleActivations: Record<string, number> = {};
  for (const r of options.rules) ruleActivations[r.id] = 0;

  const results: VerdictResult[] = [];
  for (const slug of slugs) {
    const files = fileMaps.get(slug) ?? new Map<string, string>();
    const absPath = path.join(options.root, `settlegrid-${slug}`);
    const serverTs = files.get('src/server.ts') ?? '';
    const readme = files.get('README.md') ?? '';
    const input: TemplateInput = {
      slug,
      absPath,
      files,
      corpus: index,
      normalizedSourceHash: serverTs ? hashContent(normalizeSource(serverTs, slug)) : '',
      normalizedReadmeHash: readme ? hashContent(normalizeReadme(readme, slug)) : '',
    };

    const findings: RuleFinding[] = [];
    for (const rule of options.rules) {
      const ruleFindings = await rule.check(input);
      if (ruleFindings.length > 0) {
        ruleActivations[rule.id] = (ruleActivations[rule.id] ?? 0) + 1;
        findings.push(...ruleFindings);
      }
    }

    const verdictResult = assignVerdict({
      slug,
      absPath,
      findings,
      isCanonical: index.canonicalSlugs.has(slug),
    });
    results.push(verdictResult);
    options.onProgress?.(slug, verdictResult);
  }

  return { results, corpus: index, ruleActivations };
}

/**
 * In-memory FsAdapter for tests. Accepts a map of slug → file-map.
 */
export function inMemoryFsAdapter(
  templates: Map<string, Map<string, string>>,
): FsAdapter {
  return {
    async listSlugs() {
      return Array.from(templates.keys()).sort();
    },
    async readFiles(_root, slug, files) {
      const all = templates.get(slug);
      if (!all) return new Map();
      const out = new Map<string, string>();
      for (const f of files) {
        const c = all.get(f);
        if (c !== undefined) out.set(f, c);
      }
      return out;
    },
  };
}
