import { describe, it, expect } from 'vitest';
import { runMetaAudit, compareDeterminism } from '../meta-audit.js';
import { ALL_RULES } from '../rules/index.js';
import { baselineGood } from '../fixtures.js';
import type { Rule, VerdictResult } from '../types.js';

describe('runMetaAudit — rule fixtures', () => {
  it('every production rule passes its own fixture contracts', async () => {
    const report = await runMetaAudit({ rules: ALL_RULES });
    const failed = report.ruleFixtureChecks.filter(
      (r) => !r.knownGoodPassed || !r.knownBadRejected,
    );
    if (failed.length > 0) {
      console.error('Failing rules:', failed);
    }
    expect(failed.length).toBe(0);
    expect(report.passed).toBe(true);
  });

  it('detects a rule whose knownGood produces findings', async () => {
    const bogusRule: Rule = {
      id: 'test:bogus-good',
      description: '',
      severity: 'high',
      category: 'structural',
      fixtures: {
        knownGood: baselineGood(),
        knownBad: baselineGood(), // same as good — rule always rejects
      },
      async check() {
        return [{ ruleId: 'test:bogus-good', severity: 'high', message: 'always' }];
      },
    };
    const report = await runMetaAudit({ rules: [bogusRule] });
    expect(report.passed).toBe(false);
    const entry = report.ruleFixtureChecks.find((r) => r.ruleId === 'test:bogus-good');
    expect(entry?.knownGoodPassed).toBe(false);
  });

  it('detects a rule whose knownBad is never rejected', async () => {
    const bogusRule: Rule = {
      id: 'test:bogus-bad',
      description: '',
      severity: 'high',
      category: 'structural',
      fixtures: {
        knownGood: baselineGood(),
        knownBad: baselineGood(),
      },
      async check() {
        return []; // never fires — so knownBad is not rejected
      },
    };
    const report = await runMetaAudit({ rules: [bogusRule] });
    expect(report.passed).toBe(false);
    const entry = report.ruleFixtureChecks.find((r) => r.ruleId === 'test:bogus-bad');
    expect(entry?.knownBadRejected).toBe(false);
  });

  it('rejects duplicate rule ids', async () => {
    const dupRule: Rule = {
      id: 'test:dup',
      description: '',
      severity: 'low',
      category: 'structural',
      fixtures: {
        knownGood: baselineGood(),
        knownBad: { description: '', files: baselineGood().files, minFindings: 0, maxFindings: 0 },
      },
      async check() {
        return [];
      },
    };
    const report = await runMetaAudit({ rules: [dupRule, dupRule] });
    expect(report.passed).toBe(false);
    expect(report.ruleFixtureChecks[0].ruleId).toBe('(registry)');
  });
});

describe('runMetaAudit — corpus invariants', () => {
  function vr(
    slug: string,
    verdict: 'KEEP' | 'REVIEW' | 'REMOVE' = 'KEEP',
  ): VerdictResult {
    return {
      slug,
      absPath: `/${slug}`,
      verdict,
      confidence: 1,
      findings: [],
      reasons: [],
      isCanonical: false,
    };
  }

  it('flags duplicate slugs in corpus results', async () => {
    const report = await runMetaAudit({
      rules: ALL_RULES,
      corpusResult: {
        results: [vr('a'), vr('b'), vr('a')],
        ruleActivations: Object.fromEntries(ALL_RULES.map((r) => [r.id, 1])),
      },
    });
    expect(report.verdictInvariant.duplicateSlugs).toContain('a');
    expect(report.passed).toBe(false);
  });

  it('dead-rule detection reports rules that never fired on corpus', async () => {
    const ruleActivations = Object.fromEntries(ALL_RULES.map((r) => [r.id, 1]));
    // Mark one rule as dead (zero activations).
    ruleActivations['structural:license-non-empty'] = 0;
    const report = await runMetaAudit({
      rules: ALL_RULES,
      corpusResult: { results: [vr('a')], ruleActivations },
    });
    expect(report.deadRules).toContain('structural:license-non-empty');
  });

  it('dead-rule detection does NOT fail the overall meta-audit', async () => {
    const ruleActivations = Object.fromEntries(ALL_RULES.map((r) => [r.id, 0]));
    const report = await runMetaAudit({
      rules: ALL_RULES,
      corpusResult: { results: [vr('a')], ruleActivations },
    });
    // Dead rules reported but don't fail — operator decides.
    expect(report.deadRules.length).toBeGreaterThan(0);
    expect(report.passed).toBe(true);
  });

  it('flags mutually-exclusive rule contradictions', async () => {
    const result = vr('a');
    result.findings = [
      { ruleId: 'structural:required-files', severity: 'high', message: 'missing' },
      { ruleId: 'metadata:keywords-sufficient', severity: 'low', message: 'few' },
    ];
    const report = await runMetaAudit({
      rules: ALL_RULES,
      corpusResult: {
        results: [result],
        ruleActivations: Object.fromEntries(ALL_RULES.map((r) => [r.id, 1])),
      },
      mutuallyExclusive: [['structural:required-files', 'metadata:keywords-sufficient']],
    });
    expect(report.contradictions.length).toBe(1);
    expect(report.passed).toBe(false);
  });
});

describe('compareDeterminism', () => {
  function vr(
    slug: string,
    verdict: 'KEEP' | 'REVIEW' | 'REMOVE' = 'KEEP',
  ): VerdictResult {
    return {
      slug,
      absPath: `/${slug}`,
      verdict,
      confidence: 1,
      findings: [],
      reasons: [],
      isCanonical: false,
    };
  }

  it('passes when two runs produce identical verdicts', () => {
    const a = [vr('a'), vr('b', 'REMOVE')];
    const b = [vr('a'), vr('b', 'REMOVE')];
    const r = compareDeterminism(a, b);
    expect(r.passed).toBe(true);
    expect(r.diffCount).toBe(0);
  });

  it('detects verdict flips', () => {
    const a = [vr('a', 'KEEP')];
    const b = [vr('a', 'REMOVE')];
    const r = compareDeterminism(a, b);
    expect(r.passed).toBe(false);
    expect(r.diffs[0]).toContain('verdict');
  });

  it('detects length mismatch', () => {
    const r = compareDeterminism([vr('a')], [vr('a'), vr('b')]);
    expect(r.passed).toBe(false);
    expect(r.diffs[0]).toContain('length mismatch');
  });

  it('detects slug drift across runs', () => {
    const r = compareDeterminism([vr('a')], [vr('b')]);
    expect(r.passed).toBe(false);
  });
});
