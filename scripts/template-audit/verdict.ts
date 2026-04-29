/**
 * Verdict assignment — deterministic KEEP / REVIEW / REMOVE decision
 * given a set of rule findings and flags.
 *
 * Decision rules (in priority order):
 *   1. CANONICAL_20 membership (template.json from P2.8) → KEEP, confidence 1.0.
 *   2. Any FATAL finding                                 → REMOVE, confidence 1.0.
 *   3. ≥2 HIGH findings                                  → REMOVE, confidence 0.9.
 *   4. 1 HIGH + ≥2 MEDIUM                                → REMOVE, confidence 0.8.
 *   5. 1 HIGH alone                                      → REVIEW, confidence 0.7.
 *   6. ≥3 MEDIUM findings                                → REVIEW, confidence 0.6.
 *   7. 1-2 MEDIUM findings (but 0 HIGH / 0 FATAL)        → KEEP with low conf.
 *   8. 0 MEDIUM / 0 HIGH / 0 FATAL                       → KEEP, confidence 0.95.
 *
 * LOW-severity findings never force a verdict change; they're advisory
 * signals included in the evidence but not used to gate KEEP/REMOVE.
 */

import type { RuleFinding, Verdict, VerdictResult } from './types.js';

export interface VerdictInput {
  slug: string;
  absPath: string;
  findings: RuleFinding[];
  isCanonical: boolean;
}

export function assignVerdict(input: VerdictInput): VerdictResult {
  const { slug, absPath, findings, isCanonical } = input;
  const fatal = findings.filter((f) => f.severity === 'fatal');
  const high = findings.filter((f) => f.severity === 'high');
  const medium = findings.filter((f) => f.severity === 'medium');
  const low = findings.filter((f) => f.severity === 'low');
  const reasons: string[] = [];

  // 1. CANONICAL_20 protection.
  if (isCanonical) {
    reasons.push(
      'template.json present (CANONICAL_20 membership from P2.8) — protected by policy',
    );
    if (fatal.length > 0) {
      // Even canonical templates can't survive a fatal finding — the policy
      // trades certainty against broken code. Surface so the reviewer sees it.
      reasons.push(
        `WARNING: ${fatal.length} FATAL finding(s) present despite canonical flag — needs manual review`,
      );
      return {
        slug,
        absPath,
        verdict: 'REVIEW',
        confidence: 0.3,
        findings,
        reasons,
        isCanonical,
      };
    }
    return {
      slug,
      absPath,
      verdict: 'KEEP',
      confidence: 1.0,
      findings,
      reasons,
      isCanonical,
    };
  }

  // 2. Any FATAL → REMOVE.
  if (fatal.length > 0) {
    reasons.push(
      `${fatal.length} FATAL finding(s): ${fatal
        .slice(0, 3)
        .map((f) => f.ruleId)
        .join(', ')}${fatal.length > 3 ? '…' : ''}`,
    );
    return {
      slug,
      absPath,
      verdict: 'REMOVE',
      confidence: 1.0,
      findings,
      reasons,
      isCanonical,
    };
  }

  // 3-4. HIGH + MEDIUM combinations leading to REMOVE.
  if (high.length >= 2) {
    reasons.push(
      `${high.length} HIGH findings: ${high
        .slice(0, 3)
        .map((f) => f.ruleId)
        .join(', ')}${high.length > 3 ? '…' : ''}`,
    );
    return {
      slug,
      absPath,
      verdict: 'REMOVE',
      confidence: 0.9,
      findings,
      reasons,
      isCanonical,
    };
  }
  if (high.length === 1 && medium.length >= 2) {
    reasons.push(
      `1 HIGH (${high[0].ruleId}) + ${medium.length} MEDIUM findings`,
    );
    return {
      slug,
      absPath,
      verdict: 'REMOVE',
      confidence: 0.8,
      findings,
      reasons,
      isCanonical,
    };
  }

  // 5-6. Single HIGH or accumulated MEDIUM → REVIEW.
  if (high.length === 1) {
    reasons.push(`single HIGH finding: ${high[0].ruleId}`);
    return {
      slug,
      absPath,
      verdict: 'REVIEW',
      confidence: 0.7,
      findings,
      reasons,
      isCanonical,
    };
  }
  if (medium.length >= 3) {
    reasons.push(
      `${medium.length} MEDIUM findings: ${medium
        .slice(0, 3)
        .map((f) => f.ruleId)
        .join(', ')}${medium.length > 3 ? '…' : ''}`,
    );
    return {
      slug,
      absPath,
      verdict: 'REVIEW',
      confidence: 0.6,
      findings,
      reasons,
      isCanonical,
    };
  }

  // 7. KEEP band — report MEDIUM/LOW counts as advisory.
  const parts: string[] = [];
  if (medium.length > 0) parts.push(`${medium.length} MEDIUM (advisory)`);
  if (low.length > 0) parts.push(`${low.length} LOW (advisory)`);
  if (parts.length > 0) {
    reasons.push(`KEEP with advisories: ${parts.join(', ')}`);
  } else {
    reasons.push('clean — no findings at medium or higher severity');
  }
  // Confidence slightly penalized by each MEDIUM (capped at 0.5).
  const confidence = Math.max(0.5, 0.95 - medium.length * 0.15);
  return {
    slug,
    absPath,
    verdict: 'KEEP',
    confidence,
    findings,
    reasons,
    isCanonical,
  };
}

/**
 * Helper for verdict counting used by the reporter + meta-audit.
 */
export function countVerdicts(results: VerdictResult[]): Record<Verdict, number> {
  const counts: Record<Verdict, number> = { KEEP: 0, REVIEW: 0, REMOVE: 0 };
  for (const r of results) counts[r.verdict]++;
  return counts;
}
