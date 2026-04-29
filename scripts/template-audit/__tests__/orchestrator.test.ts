import { describe, it, expect } from 'vitest';
import {
  buildCorpusIndex,
  inMemoryFsAdapter,
  runAudit,
} from '../orchestrator.js';
import { ALL_RULES } from '../rules/index.js';
import { baselineGood } from '../fixtures.js';

function makeCorpus(
  templates: Record<string, Record<string, string>>,
): Map<string, Map<string, string>> {
  const out = new Map<string, Map<string, string>>();
  for (const [slug, files] of Object.entries(templates)) {
    out.set(slug, new Map(Object.entries(files)));
  }
  return out;
}

describe('buildCorpusIndex', () => {
  it('walks every settlegrid-* directory', async () => {
    const corpus = makeCorpus({
      alpha: baselineGood().files,
      beta: baselineGood().files,
    });
    const { slugs, index } = await buildCorpusIndex('/root', inMemoryFsAdapter(corpus));
    expect(slugs).toEqual(['alpha', 'beta']);
    expect(index.totalTemplates).toBe(2);
  });

  it('detects CANONICAL_20 membership via template.json presence', async () => {
    const corpus = makeCorpus({
      alpha: { ...baselineGood().files, 'template.json': '{}' },
      beta: baselineGood().files,
    });
    const { index } = await buildCorpusIndex('/root', inMemoryFsAdapter(corpus));
    expect(Array.from(index.canonicalSlugs).sort()).toEqual(['alpha']);
  });

  it('populates sourceHashIndex for originality lookups', async () => {
    // Two templates with byte-identical (post-normalization) server.ts.
    const fg = baselineGood().files;
    const corpus = makeCorpus({
      twin1: { ...fg },
      twin2: { ...fg },
      unique: {
        ...fg,
        'src/server.ts': fg['src/server.ts'] + '\n// distinguishing comment\n',
      },
    });
    const { index } = await buildCorpusIndex('/root', inMemoryFsAdapter(corpus));
    // twin1 + twin2 should share a hash; unique should be alone.
    const groups = Array.from(index.sourceHashIndex.values()).filter((v) => v.length > 1);
    expect(groups.length).toBe(1);
    expect(groups[0].sort()).toEqual(['twin1', 'twin2']);
  });

  it('honors onlySlugs filter', async () => {
    const corpus = makeCorpus({
      alpha: baselineGood().files,
      beta: baselineGood().files,
      gamma: baselineGood().files,
    });
    const { slugs } = await buildCorpusIndex(
      '/root',
      inMemoryFsAdapter(corpus),
      ['alpha', 'gamma'],
    );
    expect(slugs).toEqual(['alpha', 'gamma']);
  });

  it('honors limit', async () => {
    const corpus = makeCorpus({
      a: baselineGood().files,
      b: baselineGood().files,
      c: baselineGood().files,
    });
    const { slugs } = await buildCorpusIndex(
      '/root',
      inMemoryFsAdapter(corpus),
      undefined,
      2,
    );
    expect(slugs).toEqual(['a', 'b']);
  });
});

describe('runAudit', () => {
  it('assigns verdicts to every template', async () => {
    const corpus = makeCorpus({
      'example-tool': baselineGood().files,
    });
    const { results } = await runAudit({
      root: '/root',
      rules: ALL_RULES,
      fs: inMemoryFsAdapter(corpus),
    });
    expect(results.length).toBe(1);
    expect(results[0].slug).toBe('example-tool');
    expect(results[0].verdict).toBe('KEEP');
  });

  it('tracks rule activation counts', async () => {
    // Plant a known-broken template to trigger pollution + tsc rules.
    const fg = baselineGood().files;
    const broken = {
      ...fg,
      'src/server.ts':
        fg['src/server.ts'] + '\nconst x = {"A" if cond == "y" else "B"}\n',
    };
    const corpus = makeCorpus({ broken });
    const { ruleActivations } = await runAudit({
      root: '/root',
      rules: ALL_RULES,
      fs: inMemoryFsAdapter(corpus),
    });
    expect(ruleActivations['pollution:python-ternary']).toBeGreaterThanOrEqual(1);
    expect(ruleActivations['executable:tsc-compile']).toBeGreaterThanOrEqual(1);
  });

  it('originality rule flags duplicate server.ts across the corpus', async () => {
    const fg = baselineGood().files;
    const corpus = makeCorpus({ twin1: fg, twin2: fg, other: fg });
    const { results } = await runAudit({
      root: '/root',
      rules: ALL_RULES,
      fs: inMemoryFsAdapter(corpus),
    });
    // Every slug shares the same normalized hash so every slug has
    // originality:duplicate-server finding.
    for (const r of results) {
      const duplicates = r.findings.filter(
        (f) => f.ruleId === 'originality:duplicate-server',
      );
      expect(duplicates.length).toBe(1);
    }
  });

  it('calls onProgress once per template', async () => {
    const corpus = makeCorpus({
      alpha: baselineGood().files,
      beta: baselineGood().files,
    });
    const seen: string[] = [];
    await runAudit({
      root: '/root',
      rules: ALL_RULES,
      fs: inMemoryFsAdapter(corpus),
      onProgress: (slug) => {
        seen.push(slug);
      },
    });
    expect(seen.sort()).toEqual(['alpha', 'beta']);
  });

  it('determinism — running twice yields identical verdicts + finding counts', async () => {
    const fg = baselineGood().files;
    const broken = {
      ...fg,
      'src/server.ts':
        fg['src/server.ts'] + '\nconst x = {"A" if cond == "y" else "B"}\n',
    };
    const corpus = makeCorpus({ a: baselineGood().files, b: broken });
    const opts = {
      root: '/root',
      rules: ALL_RULES,
      fs: inMemoryFsAdapter(corpus),
    };
    const first = await runAudit(opts);
    const second = await runAudit(opts);
    expect(first.results.length).toBe(second.results.length);
    for (let i = 0; i < first.results.length; i++) {
      expect(first.results[i].verdict).toBe(second.results[i].verdict);
      expect(first.results[i].findings.length).toBe(second.results[i].findings.length);
    }
  });
});
