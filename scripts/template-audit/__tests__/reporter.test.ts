import { describe, it, expect } from 'vitest';
import {
  buildCorpusReport,
  renderMarkdown,
  renderCsv,
  writeReports,
} from '../reporter.js';
import type { MetaAuditReport, RuleFinding, VerdictResult } from '../types.js';
import * as fsp from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';

function vr(
  slug: string,
  verdict: 'KEEP' | 'REVIEW' | 'REMOVE' = 'KEEP',
  findings: RuleFinding[] = [],
  isCanonical = false,
): VerdictResult {
  return {
    slug,
    absPath: `/${slug}`,
    verdict,
    confidence: 0.9,
    findings,
    reasons: [`${verdict} reason`],
    isCanonical,
  };
}

function emptyMeta(): MetaAuditReport {
  return {
    passed: true,
    ruleFixtureChecks: [{ ruleId: 'a', knownGoodPassed: true, knownBadRejected: true }],
    deadRules: [],
    contradictions: [],
    determinism: { runTwicePassed: true, diffCount: 0 },
    verdictInvariant: {
      sumMatchesTotal: true,
      everyTemplateHasVerdict: true,
      duplicateSlugs: [],
    },
  };
}

describe('buildCorpusReport', () => {
  it('counts verdicts + finds top failure clusters', () => {
    const report = buildCorpusReport({
      runId: 'r1',
      startedAt: new Date('2026-04-18T00:00:00Z'),
      completedAt: new Date('2026-04-18T00:00:10Z'),
      totalTemplates: 3,
      results: [
        vr('a', 'KEEP'),
        vr('b', 'REMOVE', [
          { ruleId: 'pollution:python-ternary', severity: 'fatal', message: 'x' },
        ]),
        vr('c', 'REMOVE', [
          { ruleId: 'pollution:python-ternary', severity: 'fatal', message: 'x' },
          { ruleId: 'executable:tsc-compile', severity: 'high', message: 'tsc' },
        ]),
      ],
      ruleActivations: { 'pollution:python-ternary': 2, 'executable:tsc-compile': 1 },
      metaAudit: emptyMeta(),
    });
    expect(report.verdictCounts).toEqual({ KEEP: 1, REVIEW: 0, REMOVE: 2 });
    expect(report.topFailureClusters[0].ruleId).toBe('pollution:python-ternary');
    expect(report.topFailureClusters[0].count).toBe(2);
  });

  it('computes durationMs', () => {
    const r = buildCorpusReport({
      runId: 'r1',
      startedAt: new Date('2026-04-18T00:00:00Z'),
      completedAt: new Date('2026-04-18T00:00:15Z'),
      totalTemplates: 0,
      results: [],
      ruleActivations: {},
      metaAudit: emptyMeta(),
    });
    expect(r.durationMs).toBe(15_000);
  });
});

describe('renderMarkdown', () => {
  it('emits verdict distribution table', () => {
    const md = renderMarkdown(
      buildCorpusReport({
        runId: 'r1',
        startedAt: new Date('2026-04-18T00:00:00Z'),
        completedAt: new Date('2026-04-18T00:00:01Z'),
        totalTemplates: 2,
        results: [vr('a', 'KEEP'), vr('b', 'REMOVE')],
        ruleActivations: {},
        metaAudit: emptyMeta(),
      }),
    );
    expect(md).toContain('# Template Audit Report');
    expect(md).toContain('| KEEP | 1 | 50.0% |');
    expect(md).toContain('| REMOVE | 1 | 50.0% |');
  });

  it('surfaces meta-audit failures', () => {
    const meta = emptyMeta();
    meta.passed = false;
    meta.ruleFixtureChecks[0].knownGoodPassed = false;
    meta.ruleFixtureChecks[0].details = 'produced 2 findings';
    const md = renderMarkdown(
      buildCorpusReport({
        runId: 'r',
        startedAt: new Date(),
        completedAt: new Date(),
        totalTemplates: 0,
        results: [],
        ruleActivations: {},
        metaAudit: meta,
      }),
    );
    expect(md).toContain('Overall: **FAIL**');
    expect(md).toContain('produced 2 findings');
  });

  it('lists REMOVE candidates with evidence + truncation', () => {
    const results: VerdictResult[] = [];
    for (let i = 0; i < 60; i++) {
      results.push(
        vr(`bad-${i}`, 'REMOVE', [
          { ruleId: 'pollution:python-ternary', severity: 'fatal', message: `m${i}` },
        ]),
      );
    }
    const md = renderMarkdown(
      buildCorpusReport({
        runId: 'r',
        startedAt: new Date(),
        completedAt: new Date(),
        totalTemplates: 60,
        results,
        ruleActivations: {},
        metaAudit: emptyMeta(),
      }),
    );
    expect(md).toContain('### `bad-0`');
    expect(md).toContain('and 10 more');
  });
});

describe('renderCsv', () => {
  it('emits header + one row per verdict', () => {
    const csv = renderCsv(
      buildCorpusReport({
        runId: 'r',
        startedAt: new Date(),
        completedAt: new Date(),
        totalTemplates: 2,
        results: [vr('a', 'KEEP'), vr('b', 'REMOVE')],
        ruleActivations: {},
        metaAudit: emptyMeta(),
      }),
    );
    const lines = csv.trim().split('\n');
    expect(lines.length).toBe(3);
    expect(lines[0]).toBe(
      'slug,verdict,confidence,isCanonical,fatal_count,high_count,medium_count,low_count,findings_summary',
    );
    expect(lines[1]).toMatch(/^a,KEEP,0\.90,no,0,0,0,0,""/);
    expect(lines[2]).toMatch(/^b,REMOVE,/);
  });

  it('escapes embedded quotes in findings_summary', () => {
    const csv = renderCsv(
      buildCorpusReport({
        runId: 'r',
        startedAt: new Date(),
        completedAt: new Date(),
        totalTemplates: 1,
        results: [
          vr('a', 'REMOVE', [
            { ruleId: 'x"quoted', severity: 'fatal', message: 'm' },
          ]),
        ],
        ruleActivations: {},
        metaAudit: emptyMeta(),
      }),
    );
    expect(csv).toContain('x""quoted');
  });
});

describe('writeReports', () => {
  it('writes all three files to disk', async () => {
    const tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'audit-report-'));
    try {
      const result = await writeReports(
        buildCorpusReport({
          runId: 'r',
          startedAt: new Date(),
          completedAt: new Date(),
          totalTemplates: 1,
          results: [vr('a', 'KEEP')],
          ruleActivations: {},
          metaAudit: emptyMeta(),
        }),
        tmpDir,
      );
      for (const p of [result.jsonPath, result.markdownPath, result.csvPath]) {
        const stat = await fsp.stat(p);
        expect(stat.isFile()).toBe(true);
        expect(stat.size).toBeGreaterThan(0);
      }
    } finally {
      await fsp.rm(tmpDir, { recursive: true, force: true });
    }
  });
});
