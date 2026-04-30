import { describe, it, expect } from 'vitest';
import { assignVerdict, countVerdicts } from '../verdict.js';
import type { RuleFinding, VerdictResult } from '../types.js';

function f(ruleId: string, severity: RuleFinding['severity']): RuleFinding {
  return { ruleId, severity, message: `${ruleId} fired` };
}

describe('assignVerdict — canonical protection', () => {
  it('KEEP at confidence 1.0 when isCanonical and no fatal findings', () => {
    const result = assignVerdict({
      slug: 'x',
      absPath: '/x',
      findings: [f('metadata:keywords', 'medium'), f('content:readme', 'low')],
      isCanonical: true,
    });
    expect(result.verdict).toBe('KEEP');
    expect(result.confidence).toBe(1.0);
    expect(result.reasons[0]).toContain('CANONICAL_20');
  });

  it('REVIEW (not KEEP) when canonical but carries a fatal finding', () => {
    const result = assignVerdict({
      slug: 'x',
      absPath: '/x',
      findings: [f('pollution:python-ternary', 'fatal')],
      isCanonical: true,
    });
    expect(result.verdict).toBe('REVIEW');
    expect(result.confidence).toBeLessThan(0.5);
    expect(result.reasons.some((r) => r.includes('WARNING'))).toBe(true);
  });
});

describe('assignVerdict — non-canonical decisions', () => {
  it('REMOVE (1.0 confidence) on any FATAL finding', () => {
    const r = assignVerdict({
      slug: 'x',
      absPath: '/x',
      findings: [f('pollution:python-ternary', 'fatal')],
      isCanonical: false,
    });
    expect(r.verdict).toBe('REMOVE');
    expect(r.confidence).toBe(1.0);
  });

  it('REMOVE (0.9 confidence) on ≥2 HIGH findings', () => {
    const r = assignVerdict({
      slug: 'x',
      absPath: '/x',
      findings: [f('a', 'high'), f('b', 'high')],
      isCanonical: false,
    });
    expect(r.verdict).toBe('REMOVE');
    expect(r.confidence).toBe(0.9);
  });

  it('REMOVE (0.8 confidence) on 1 HIGH + ≥2 MEDIUM', () => {
    const r = assignVerdict({
      slug: 'x',
      absPath: '/x',
      findings: [f('a', 'high'), f('b', 'medium'), f('c', 'medium')],
      isCanonical: false,
    });
    expect(r.verdict).toBe('REMOVE');
    expect(r.confidence).toBe(0.8);
  });

  it('REVIEW (0.7 confidence) on 1 HIGH alone', () => {
    const r = assignVerdict({
      slug: 'x',
      absPath: '/x',
      findings: [f('a', 'high'), f('b', 'medium')],
      isCanonical: false,
    });
    expect(r.verdict).toBe('REVIEW');
    expect(r.confidence).toBe(0.7);
  });

  it('REVIEW (0.6 confidence) on ≥3 MEDIUM findings', () => {
    const r = assignVerdict({
      slug: 'x',
      absPath: '/x',
      findings: [f('a', 'medium'), f('b', 'medium'), f('c', 'medium')],
      isCanonical: false,
    });
    expect(r.verdict).toBe('REVIEW');
    expect(r.confidence).toBe(0.6);
  });

  it('KEEP on 1-2 MEDIUM (but confidence penalized)', () => {
    const r2 = assignVerdict({
      slug: 'x',
      absPath: '/x',
      findings: [f('a', 'medium'), f('b', 'medium')],
      isCanonical: false,
    });
    expect(r2.verdict).toBe('KEEP');
    expect(r2.confidence).toBeCloseTo(0.65, 5);
  });

  it('KEEP on zero findings at confidence 0.95', () => {
    const r = assignVerdict({ slug: 'x', absPath: '/x', findings: [], isCanonical: false });
    expect(r.verdict).toBe('KEEP');
    expect(r.confidence).toBe(0.95);
  });

  it('LOW findings are advisory — never force a verdict change', () => {
    const r = assignVerdict({
      slug: 'x',
      absPath: '/x',
      findings: [f('a', 'low'), f('b', 'low'), f('c', 'low'), f('d', 'low')],
      isCanonical: false,
    });
    expect(r.verdict).toBe('KEEP');
    expect(r.reasons[0]).toContain('LOW (advisory)');
  });
});

describe('countVerdicts', () => {
  it('counts across a mixed list', () => {
    const results: VerdictResult[] = [
      { slug: 'a', absPath: '/a', verdict: 'KEEP', confidence: 1, findings: [], reasons: [], isCanonical: false },
      { slug: 'b', absPath: '/b', verdict: 'REMOVE', confidence: 1, findings: [], reasons: [], isCanonical: false },
      { slug: 'c', absPath: '/c', verdict: 'REVIEW', confidence: 1, findings: [], reasons: [], isCanonical: false },
      { slug: 'd', absPath: '/d', verdict: 'KEEP', confidence: 1, findings: [], reasons: [], isCanonical: false },
    ];
    expect(countVerdicts(results)).toEqual({ KEEP: 2, REVIEW: 1, REMOVE: 1 });
  });
});
