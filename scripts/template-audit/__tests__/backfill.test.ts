import { describe, it, expect } from 'vitest';
import * as fsp from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import {
  extractDefaultCostCents,
  extractCapabilities,
  humanizeName,
  mapCategory,
  buildManifest,
  buildRunSummary,
  readPkg,
  readServerTs,
  SLUG_REGEX,
} from '../backfill-p3-2-manifests.js';

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

describe('SLUG_REGEX', () => {
  it('accepts valid slugs', () => {
    for (const s of ['pinecone', 'deepgram', 'arize-ax', 'vespa-document-v1', 'x1', 'a']) {
      expect(SLUG_REGEX.test(s)).toBe(true);
    }
  });

  it('rejects path-traversal attempts', () => {
    for (const s of ['../etc', '../../hostile', '/etc/passwd', 'slug/with/slash']) {
      expect(SLUG_REGEX.test(s)).toBe(false);
    }
  });

  it('rejects uppercase + whitespace + leading hyphen', () => {
    for (const s of ['Pinecone', 'foo bar', '-leading-hyphen', '', ' pinecone', 'with_underscore']) {
      expect(SLUG_REGEX.test(s)).toBe(false);
    }
  });
});

describe('humanizeName', () => {
  it('converts kebab-case to Title Case', () => {
    expect(humanizeName('pinecone')).toBe('Pinecone');
    expect(humanizeName('arize-ax')).toBe('Arize Ax');
    expect(humanizeName('vespa-document-v1')).toBe('Vespa Document V1');
  });

  it('tolerates single-char words', () => {
    expect(humanizeName('a')).toBe('A');
    expect(humanizeName('x-y-z')).toBe('X Y Z');
  });
});

describe('mapCategory', () => {
  it('maps every known Templater category to the gallery enum', () => {
    // Exhaustive check — if a new Templater category is added to
    // categories.json, this test will fail until the mapping is updated.
    const knownPairs: Array<[string, string]> = [
      ['rag', 'ai'],
      ['vector-dbs', 'data'],
      ['agent-frameworks', 'ai'],
      ['llm-gateways', 'ai'],
      ['eval-tools', 'devtools'],
      ['observability', 'devtools'],
      ['fine-tuning', 'ai'],
      ['embeddings', 'ai'],
      ['image-gen', 'media'],
      ['speech', 'media'],
      ['translation', 'productivity'],
      ['code-analysis', 'devtools'],
      ['scraping', 'data'],
      ['browser-automation', 'devtools'],
      ['data-pipelines', 'data'],
      ['document-intelligence', 'data'],
      ['knowledge-graphs', 'data'],
      ['prompt-engineering', 'ai'],
      ['synthetic-data', 'data'],
      ['ml-monitoring', 'devtools'],
    ];
    for (const [templater, gallery] of knownPairs) {
      expect(mapCategory(templater)).toBe(gallery);
    }
  });

  it('falls through to "other" for unknown categories', () => {
    expect(mapCategory('nonexistent-category')).toBe('other');
    expect(mapCategory('')).toBe('other');
  });
});

// ---------------------------------------------------------------------------
// extractDefaultCostCents — regex-based parse of server.ts pricing
// ---------------------------------------------------------------------------

describe('extractDefaultCostCents', () => {
  it('extracts the cents value from a canonical settlegrid.init call', () => {
    const src = `
      const sg = settlegrid.init({
        toolSlug: 'x',
        pricing: { defaultCostCents: 5, methods: {} },
      });
    `;
    expect(extractDefaultCostCents(src)).toBe(5);
  });

  it('extracts single-digit cents', () => {
    expect(extractDefaultCostCents("pricing: { defaultCostCents: 1 }")).toBe(1);
  });

  it('extracts multi-digit cents (e.g. 10)', () => {
    expect(extractDefaultCostCents("pricing: { defaultCostCents: 10 }")).toBe(10);
  });

  it('falls back to 1 when the field is missing', () => {
    expect(extractDefaultCostCents("pricing: { methods: {} }")).toBe(1);
  });

  it('falls back to 1 when the value is 0 (sentinel for "not real")', () => {
    expect(extractDefaultCostCents("defaultCostCents: 0")).toBe(1);
  });

  it('ignores a defaultCostCents mention outside the pricing block', () => {
    // A stray comment mentioning defaultCostCents must not shadow the real
    // value: the shared extractor scopes its lookup to the `pricing: {...}`
    // object literal, so the comment is skipped and the real value wins.
    const src = `// defaultCostCents: 100\npricing: { defaultCostCents: 2 }`;
    expect(extractDefaultCostCents(src)).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// extractCapabilities — regex-based parse of sg.wrap method names
// ---------------------------------------------------------------------------

describe('extractCapabilities', () => {
  it('extracts snake_case method names from sg.wrap calls', () => {
    const src = `
      const fn1 = sg.wrap(async () => ({}), { method: 'get_thing' });
      const fn2 = sg.wrap(async () => ({}), { method: 'search_items' });
    `;
    expect(extractCapabilities(src)).toEqual(['get_thing', 'search_items']);
  });

  it('sorts alphabetically', () => {
    const src = `
      sg.wrap(..., { method: 'z_last' });
      sg.wrap(..., { method: 'a_first' });
      sg.wrap(..., { method: 'm_middle' });
    `;
    expect(extractCapabilities(src)).toEqual(['a_first', 'm_middle', 'z_last']);
  });

  it('deduplicates repeated method names', () => {
    const src = `
      sg.wrap(..., { method: 'same' });
      sg.wrap(..., { method: 'same' });
    `;
    expect(extractCapabilities(src)).toEqual(['same']);
  });

  it('filters out HTTP verbs from fetch({method:"POST"}) options', () => {
    // Regression: earlier extraction surfaced GET/POST/PUT in capabilities
    // because fetch() options carry `method: 'POST'` strings.
    const src = `
      fetch(url, { method: 'POST', headers: {} });
      fetch(url, { method: 'get' });
      sg.wrap(async () => ({}), { method: 'real_handler' });
    `;
    expect(extractCapabilities(src)).toEqual(['real_handler']);
    expect(extractCapabilities(src)).not.toContain('POST');
    expect(extractCapabilities(src)).not.toContain('get');
  });

  it('only matches lowercase snake_case (uppercase verbs rejected at source)', () => {
    // `method: 'POST'` shouldn't match because the regex [a-z_] excludes
    // capital letters.
    const src = `{ method: 'POST' }; { method: 'DELETE' }; { method: 'GET' };`;
    expect(extractCapabilities(src)).toEqual([]);
  });

  it('returns [] when no methods are found', () => {
    expect(extractCapabilities("// no methods here")).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// buildManifest — full manifest assembly
// ---------------------------------------------------------------------------

describe('buildManifest', () => {
  const basePkg = {
    name: 'settlegrid-pinecone',
    version: '2.0.0',
    description: 'MCP server for Pinecone with SettleGrid billing',
    keywords: ['settlegrid', 'mcp', 'pinecone', 'vector', 'rag', 'ai'],
  };
  const baseServerTs = `
    import { settlegrid } from '@settlegrid/mcp';
    const sg = settlegrid.init({
      toolSlug: 'pinecone',
      pricing: { defaultCostCents: 2, methods: { list_indexes: { costCents: 2 } } },
    });
    const fn = sg.wrap(async () => ({}), { method: 'list_indexes' });
    export { fn };
  `;

  it('constructs a P2.6-compliant manifest', () => {
    const m = buildManifest('pinecone', 'rag', basePkg, baseServerTs);
    expect(m.slug).toBe('pinecone');
    expect(m.name).toBe('Pinecone');
    expect(m.description).toBe('MCP server for Pinecone with SettleGrid billing');
    expect(m.version).toBe('2.0.0');
    expect(m.category).toBe('ai'); // rag → ai
    expect(m.entry).toBe('src/server.ts');
    expect(m.runtime).toBe('node');
    expect(m.languages).toEqual(['ts']);
    expect(m.pricing).toEqual({
      model: 'per-call',
      perCallUsdCents: 2,
      methods: { list_indexes: { costCents: 2 } },
    });
    expect(m.quality).toEqual({ tests: false });
    expect(m.capabilities).toEqual(['list_indexes']);
    expect(m.featured).toBe(false);
  });

  it('emits pricing.methods sourced from the server.ts methods block', () => {
    const serverTs = `
      const sg = settlegrid.init({
        toolSlug: 'multi',
        pricing: {
          defaultCostCents: 1,
          methods: {
            search: { costCents: 1, displayName: 'Search' },
            deep: { costCents: 5, displayName: 'Deep Analyze' },
          },
        },
      });
    `;
    const m = buildManifest('multi', 'rag', basePkg, serverTs);
    expect(m.pricing.methods).toEqual({
      search: { costCents: 1, displayName: 'Search' },
      deep: { costCents: 5, displayName: 'Deep Analyze' },
    });
  });

  it('omits pricing.methods when server.ts has no methods block', () => {
    const serverTs = `settlegrid.init({ toolSlug: 't', pricing: { defaultCostCents: 3 } });`;
    const m = buildManifest('t', 'rag', basePkg, serverTs);
    expect(m.pricing.perCallUsdCents).toBe(3);
    expect(m.pricing.methods).toBeUndefined();
  });

  it('populates author + repo with canonical SettleGrid values', () => {
    const m = buildManifest('pinecone', 'rag', basePkg, baseServerTs);
    expect(m.author.name).toBe('Alerterra, LLC');
    expect(m.author.url).toBe('https://settlegrid.ai');
    expect(m.author.github).toBe('settlegrid');
    expect(m.repo.type).toBe('git');
    expect(m.repo.url).toBe('https://github.com/settlegrid/settlegrid-pinecone');
  });

  it('caps tags at 10 entries (P2.6 schema limit)', () => {
    const fatPkg = {
      ...basePkg,
      keywords: Array.from({ length: 30 }, (_, i) => `keyword-${i}`),
    };
    const m = buildManifest('pinecone', 'rag', fatPkg, baseServerTs);
    expect(m.tags.length).toBeLessThanOrEqual(10);
  });

  it('strips "settlegrid"/"mcp"/"ai" boilerplate from tags', () => {
    const m = buildManifest('pinecone', 'rag', basePkg, baseServerTs);
    expect(m.tags).not.toContain('settlegrid');
    expect(m.tags).not.toContain('mcp');
    expect(m.tags).not.toContain('ai');
  });

  it('prepends Templater category as first tag', () => {
    const m = buildManifest('pinecone', 'rag', basePkg, baseServerTs);
    expect(m.tags[0]).toBe('rag');
  });

  it('falls back to a default description when package.json lacks one', () => {
    const pkg = { ...basePkg, description: undefined };
    const m = buildManifest('pinecone', 'rag', pkg, baseServerTs);
    expect(m.description).toContain('Pinecone');
    expect(m.description).toContain('SettleGrid');
  });

  it('falls back to version 1.0.0 when package.json lacks version', () => {
    const pkg = { ...basePkg, version: undefined };
    const m = buildManifest('pinecone', 'rag', pkg, baseServerTs);
    expect(m.version).toBe('1.0.0');
  });

  it('tolerates non-array keywords field', () => {
    const pkg = { ...basePkg, keywords: 'not-an-array' as unknown };
    const m = buildManifest('pinecone', 'rag', pkg, baseServerTs);
    // Category still lands in tags even if keywords were invalid.
    expect(m.tags).toContain('rag');
  });

  it('maps unknown Templater category to "other"', () => {
    const m = buildManifest('x', 'absolutely-unknown', basePkg, baseServerTs);
    expect(m.category).toBe('other');
  });
});

// ---------------------------------------------------------------------------
// buildRunSummary — aggregate summary from JSONL attempts
// ---------------------------------------------------------------------------

describe('buildRunSummary', () => {
  function attempt(
    verdict: string,
    slug?: string,
    costUsdAttempt = 0,
    extras: Record<string, unknown> = {},
  ): any {
    return {
      runId: 'run-test',
      category: 'test',
      toolName: slug ?? 'X',
      startedAt: '2026-04-19T10:00:00.000Z',
      completedAt: '2026-04-19T10:00:05.000Z',
      durationMs: 5000,
      verdict,
      templateSlug: slug,
      costUsdAttempt,
      cumulativeCostUsd: costUsdAttempt,
      tokensInAttempt: 100,
      tokensOutAttempt: 50,
      invocationsAttempt: 1,
      modelsAttempt: ['claude-haiku-4-5'],
      ...extras,
    };
  }

  it('counts pass/reject/fail correctly', () => {
    const attempts = [
      attempt('pass', 'a'),
      attempt('pass', 'b'),
      attempt('rejected-by-spec-generator'),
      attempt('fetch-docs-failed'),
      attempt('quality-gate-failed'),
    ];
    const s = buildRunSummary(attempts, 2, 0);
    expect(s.passed).toBe(2);
    expect(s.rejected).toBe(1);
    expect(s.failed).toBe(2);
    expect(s.totalAttempts).toBe(5);
  });

  it('computes reject-rate percentage', () => {
    const attempts = [
      attempt('pass', 'a'),
      attempt('pass', 'b'),
      attempt('pass', 'c'),
      attempt('fetch-docs-failed'),
    ];
    const s = buildRunSummary(attempts, 3, 0);
    expect(s.rejectRatePct).toBe(25.0);
  });

  it('computes cost-per-successful-template', () => {
    const attempts = [
      attempt('pass', 'a', 0.10),
      attempt('pass', 'b', 0.20),
      attempt('fetch-docs-failed', undefined, 0.05),
    ];
    const s = buildRunSummary(attempts, 2, 0);
    // Total cost $0.35 / 2 successful = $0.175 per successful.
    expect(s.costPerSuccessfulTemplateUsdTracked).toBeCloseTo(0.175, 6);
  });

  it('handles zero successful templates without division by zero', () => {
    const attempts = [attempt('fetch-docs-failed'), attempt('synthesize-failed')];
    const s = buildRunSummary(attempts, 0, 0);
    expect(s.costPerSuccessfulTemplateUsdTracked).toBe(0);
    expect(s.rejectRatePct).toBe(100);
  });

  it('aggregates topFailureClusters from non-pass verdicts', () => {
    const attempts = [
      attempt('pass', 'a'),
      attempt('fetch-docs-failed'),
      attempt('fetch-docs-failed'),
      attempt('fetch-docs-failed'),
      attempt('synthesize-failed'),
      attempt('synthesize-failed'),
    ];
    const s = buildRunSummary(attempts, 1, 0);
    expect(s.topFailureClusters[0]).toEqual({ verdict: 'fetch-docs-failed', count: 3 });
    expect(s.topFailureClusters[1]).toEqual({ verdict: 'synthesize-failed', count: 2 });
  });

  it('clamps durationSeconds to 0 on unparseable timestamps', () => {
    const attempts = [
      attempt('pass', 'a', 0, {
        startedAt: 'not-a-date',
        completedAt: 'also-not-a-date',
      }),
    ];
    const s = buildRunSummary(attempts, 1, 0);
    expect(s.durationSeconds).toBe(0);
  });

  it('clamps durationSeconds to 0 on reversed timestamps', () => {
    const attempts = [
      attempt('pass', 'a', 0, {
        startedAt: '2026-04-19T11:00:00.000Z',
        completedAt: '2026-04-19T10:00:00.000Z', // before startedAt
      }),
    ];
    const s = buildRunSummary(attempts, 1, 0);
    expect(s.durationSeconds).toBe(0);
  });

  it('sums tokens across attempts', () => {
    const attempts = [
      attempt('pass', 'a', 0, { tokensInAttempt: 100, tokensOutAttempt: 50 }),
      attempt('pass', 'b', 0, { tokensInAttempt: 200, tokensOutAttempt: 100 }),
    ];
    const s = buildRunSummary(attempts, 2, 0);
    expect(s.tokensInTracked).toBe(300);
    expect(s.tokensOutTracked).toBe(150);
  });

  it('propagates backfill counts + cost-tracking note', () => {
    const attempts = [attempt('pass', 'a')];
    const s = buildRunSummary(attempts, 5, 2);
    expect(s.backfilledTemplateJson).toBe(5);
    expect(s.skippedAlreadyHadTemplateJson).toBe(2);
    expect(s.costTrackingNote).toContain('Haiku');
    expect(s.costTrackingNote).toContain('NOT captured');
  });
});

// ---------------------------------------------------------------------------
// Filesystem helpers — readPkg + readServerTs
// ---------------------------------------------------------------------------

describe('readPkg + readServerTs', () => {
  it('readPkg returns null for nonexistent dir', async () => {
    expect(await readPkg('/nonexistent/path/xyz')).toBeNull();
  });

  it('readPkg parses valid JSON', async () => {
    const dir = await fsp.mkdtemp(path.join(os.tmpdir(), 'backfill-test-'));
    try {
      await fsp.writeFile(
        path.join(dir, 'package.json'),
        JSON.stringify({ name: 'x', version: '1.0.0' }),
      );
      const pkg = await readPkg(dir);
      expect(pkg).toMatchObject({ name: 'x', version: '1.0.0' });
    } finally {
      await fsp.rm(dir, { recursive: true, force: true });
    }
  });

  it('readPkg returns null for malformed JSON', async () => {
    const dir = await fsp.mkdtemp(path.join(os.tmpdir(), 'backfill-test-'));
    try {
      await fsp.writeFile(path.join(dir, 'package.json'), '{ malformed');
      expect(await readPkg(dir)).toBeNull();
    } finally {
      await fsp.rm(dir, { recursive: true, force: true });
    }
  });

  it('readServerTs returns null for missing file', async () => {
    expect(await readServerTs('/nonexistent/path/xyz')).toBeNull();
  });

  it('readServerTs reads existing server.ts', async () => {
    const dir = await fsp.mkdtemp(path.join(os.tmpdir(), 'backfill-test-'));
    try {
      await fsp.mkdir(path.join(dir, 'src'), { recursive: true });
      await fsp.writeFile(path.join(dir, 'src/server.ts'), 'export const x = 1;');
      expect(await readServerTs(dir)).toBe('export const x = 1;');
    } finally {
      await fsp.rm(dir, { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// End-to-end CLI integration (via spawn)
// ---------------------------------------------------------------------------

describe('backfill CLI — integration', () => {
  const SCRIPT = path.resolve(
    __dirname,
    '..',
    'backfill-p3-2-manifests.ts',
  );

  async function runCli(args: string[]): Promise<{ stdout: string; stderr: string; code: number }> {
    const { spawn } = await import('node:child_process');
    return new Promise((resolve) => {
      const child = spawn('npx', ['tsx', SCRIPT, ...args], {
        env: { ...process.env, FORCE_COLOR: '0' },
      });
      let stdout = '';
      let stderr = '';
      child.stdout.on('data', (d: Buffer) => (stdout += d.toString()));
      child.stderr.on('data', (d: Buffer) => (stderr += d.toString()));
      child.on('exit', (code) => resolve({ stdout, stderr, code: code ?? 0 }));
    });
  }

  it('rejects invalid slug via --skip: invalid slug log', async () => {
    const tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'backfill-cli-'));
    try {
      const jsonl = path.join(tmpDir, 'run.jsonl');
      const hostile = {
        runId: 'test',
        category: 'rag',
        toolName: 'X',
        startedAt: '2026-04-19T10:00:00Z',
        completedAt: '2026-04-19T10:00:01Z',
        durationMs: 1000,
        verdict: 'pass',
        templateSlug: '../../../etc/hostile',
        costUsdAttempt: 0,
        cumulativeCostUsd: 0,
        tokensInAttempt: 0,
        tokensOutAttempt: 0,
        invocationsAttempt: 0,
        modelsAttempt: [],
      };
      await fsp.writeFile(jsonl, JSON.stringify(hostile) + '\n');
      const r = await runCli(['--run-jsonl', jsonl]);
      expect(r.code).toBe(0);
      expect(r.stdout).toMatch(/invalid slug/);
      expect(r.stdout).toMatch(/1 invalid slugs rejected/);
      // Hostile dir was NOT created:
      const exists = await fsp
        .stat('/etc/hostile')
        .then(() => true)
        .catch(() => false);
      expect(exists).toBe(false);
    } finally {
      await fsp.rm(tmpDir, { recursive: true, force: true });
    }
  }, 60_000);

  it('per-line JSONL resilience: skips malformed line, keeps valid ones', async () => {
    const tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'backfill-cli-'));
    try {
      const jsonl = path.join(tmpDir, 'run.jsonl');
      // Two bad lines + one good line (with nonexistent slug, so it
      // harmlessly reports missing dir).
      const good = {
        runId: 'test',
        category: 'rag',
        toolName: 'Good',
        startedAt: '2026-04-19T10:00:00Z',
        completedAt: '2026-04-19T10:00:01Z',
        durationMs: 1000,
        verdict: 'pass',
        templateSlug: 'nonexistent-good',
        costUsdAttempt: 0,
        cumulativeCostUsd: 0,
        tokensInAttempt: 0,
        tokensOutAttempt: 0,
        invocationsAttempt: 0,
        modelsAttempt: [],
      };
      await fsp.writeFile(
        jsonl,
        [
          '{ "broken":"json', // malformed #1
          JSON.stringify(good), // valid
          '{ "also-broken":', // malformed #2
        ].join('\n') + '\n',
      );
      const r = await runCli(['--run-jsonl', jsonl]);
      expect(r.code).toBe(0);
      expect(r.stdout).toMatch(/2 malformed lines skipped/);
      expect(r.stdout).toMatch(/Loaded 1 attempts/);
      expect(r.stdout).toMatch(/1 missing dirs/);
      // The specific slug name is logged to stderr via console.warn
      expect(r.stderr).toMatch(/nonexistent-good/);
    } finally {
      await fsp.rm(tmpDir, { recursive: true, force: true });
    }
  }, 60_000);
});
