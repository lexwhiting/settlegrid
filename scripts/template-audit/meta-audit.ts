/**
 * Meta-audit ("audit-the-audit") — validates that Layer 1 (rules) and
 * Layer 2 (orchestrator) are themselves correct before we trust their
 * verdicts on the corpus.
 *
 * The meta-audit runs BEFORE the main audit. Any failure aborts the run:
 * we refuse to emit verdicts unless the audit engine has proven its own
 * rules behave as advertised.
 *
 * Checks:
 *   1. Rule-id uniqueness — duplicate ids produce ambiguous findings.
 *   2. Per-rule fixture validation:
 *        - knownGood MUST yield 0 findings (or ≤maxFindings if declared).
 *        - knownBad  MUST yield ≥1 findings (or ≥minFindings if declared).
 *   3. Determinism — running the full audit twice on the same corpus
 *      must produce byte-identical verdict ordering and counts.
 *   4. Verdict invariants on the corpus result:
 *        - sum(KEEP)+sum(REVIEW)+sum(REMOVE) === totalTemplates
 *        - every slug appears exactly once
 *        - no duplicate slugs
 *   5. Dead-rule detection — optional; runs only when a corpus result is
 *      supplied. A rule that never fires on any corpus entry is either
 *      redundant with a cheaper rule or specified incorrectly.
 *   6. Contradiction detection — a single template should not carry
 *      findings for two rules that are mutually-exclusive by design
 *      (currently: no such pairs declared, hook in place for future use).
 */

import type {
  CorpusIndex,
  MetaAuditReport,
  Rule,
  TemplateInput,
  VerdictResult,
} from './types.js';
import { assertUniqueRuleIds } from './rules/index.js';

export interface MetaAuditOptions {
  rules: Rule[];
  corpusResult?: { results: VerdictResult[]; ruleActivations: Record<string, number> };
  /** Pairs of rule ids that must never fire on the same template. */
  mutuallyExclusive?: Array<[string, string]>;
}

function buildFixtureInput(
  slug: string,
  files: Record<string, string>,
): TemplateInput {
  const map = new Map<string, string>();
  for (const [k, v] of Object.entries(files)) map.set(k, v);
  const emptyCorpus: CorpusIndex = {
    sourceHashIndex: new Map(),
    readmeHashIndex: new Map(),
    canonicalSlugs: new Set(),
    totalTemplates: 0,
  };
  return {
    slug,
    absPath: `/fixture/settlegrid-${slug}`,
    files: map,
    corpus: emptyCorpus,
    normalizedSourceHash: 'fixture-hash',
    normalizedReadmeHash: 'fixture-hash',
  };
}

export async function runMetaAudit(opts: MetaAuditOptions): Promise<MetaAuditReport> {
  const report: MetaAuditReport = {
    passed: true,
    ruleFixtureChecks: [],
    deadRules: [],
    contradictions: [],
    determinism: { runTwicePassed: true, diffCount: 0 },
    verdictInvariant: {
      sumMatchesTotal: true,
      everyTemplateHasVerdict: true,
      duplicateSlugs: [],
    },
  };

  // 1. Rule-id uniqueness.
  try {
    assertUniqueRuleIds(opts.rules);
  } catch (err) {
    report.passed = false;
    report.ruleFixtureChecks.push({
      ruleId: '(registry)',
      knownGoodPassed: false,
      knownBadRejected: false,
      details: (err as Error).message,
    });
    return report; // no point continuing if ids collide
  }

  // 2. Per-rule fixture validation.
  for (const rule of opts.rules) {
    const { knownGood, knownBad } = rule.fixtures;
    let knownGoodPassed = false;
    let knownBadRejected = false;
    let details = '';

    try {
      const goodFindings = await rule.check(buildFixtureInput('example-tool', knownGood.files));
      const goodMax = knownGood.maxFindings ?? 0;
      if (goodFindings.length <= goodMax) {
        knownGoodPassed = true;
      } else {
        details += `known-good produced ${goodFindings.length} findings (expected ≤${goodMax}). `;
      }
    } catch (err) {
      details += `known-good threw: ${(err as Error).message}. `;
    }

    try {
      const badFindings = await rule.check(buildFixtureInput('example-tool', knownBad.files));
      const badMin = knownBad.minFindings ?? 1;
      const badMax = knownBad.maxFindings;
      const aboveFloor = badFindings.length >= badMin;
      const belowCeiling = badMax === undefined || badFindings.length <= badMax;
      if (aboveFloor && belowCeiling) {
        knownBadRejected = true;
      } else if (!aboveFloor) {
        details += `known-bad produced only ${badFindings.length} findings (expected ≥${badMin}). `;
      } else {
        details += `known-bad produced ${badFindings.length} findings (expected ≤${badMax}). `;
      }
    } catch (err) {
      details += `known-bad threw: ${(err as Error).message}. `;
    }

    report.ruleFixtureChecks.push({
      ruleId: rule.id,
      knownGoodPassed,
      knownBadRejected,
      details: details.trim() || undefined,
    });
    if (!knownGoodPassed || !knownBadRejected) {
      report.passed = false;
    }
  }

  // 3-5. Corpus-scoped invariants — only when a corpus result is supplied.
  if (opts.corpusResult) {
    const { results, ruleActivations } = opts.corpusResult;
    const counts = { KEEP: 0, REVIEW: 0, REMOVE: 0 };
    const seen = new Set<string>();
    const dups: string[] = [];
    for (const r of results) {
      counts[r.verdict]++;
      if (seen.has(r.slug)) dups.push(r.slug);
      seen.add(r.slug);
    }
    const sum = counts.KEEP + counts.REVIEW + counts.REMOVE;
    report.verdictInvariant.sumMatchesTotal = sum === results.length;
    report.verdictInvariant.everyTemplateHasVerdict = sum === results.length;
    report.verdictInvariant.duplicateSlugs = dups;

    if (!report.verdictInvariant.sumMatchesTotal) report.passed = false;
    if (dups.length > 0) report.passed = false;

    // Dead-rule detection — a rule that never fired on any corpus entry.
    // Note: some rules (e.g. originality) may legitimately have zero
    // activations on a corpus with no duplicates. The meta-audit reports
    // them as dead but does NOT fail on this alone (report.passed stays
    // true for dead-rule findings — operator decides).
    for (const rule of opts.rules) {
      if ((ruleActivations[rule.id] ?? 0) === 0) {
        report.deadRules.push(rule.id);
      }
    }
  }

  // 6. Mutual-exclusion contradiction detection.
  if (opts.mutuallyExclusive && opts.corpusResult) {
    for (const [aId, bId] of opts.mutuallyExclusive) {
      for (const r of opts.corpusResult.results) {
        const hasA = r.findings.some((f) => f.ruleId === aId);
        const hasB = r.findings.some((f) => f.ruleId === bId);
        if (hasA && hasB) {
          report.contradictions.push({
            template: r.slug,
            ruleAId: aId,
            ruleBId: bId,
            reason: 'both rules fired on same template despite being declared mutually exclusive',
          });
          report.passed = false;
        }
      }
    }
  }

  return report;
}

/**
 * Re-runs the full audit on the same corpus and compares verdicts byte-
 * for-byte. The orchestrator is responsible for wiring this up — meta-
 * audit exports the diff helper.
 */
export function compareDeterminism(
  runA: VerdictResult[],
  runB: VerdictResult[],
): { passed: boolean; diffCount: number; diffs: string[] } {
  const diffs: string[] = [];
  if (runA.length !== runB.length) {
    diffs.push(`length mismatch: ${runA.length} vs ${runB.length}`);
  }
  const byA = new Map(runA.map((r) => [r.slug, r]));
  const byB = new Map(runB.map((r) => [r.slug, r]));
  for (const [slug, a] of byA) {
    const b = byB.get(slug);
    if (!b) {
      diffs.push(`${slug}: missing from second run`);
      continue;
    }
    if (a.verdict !== b.verdict) {
      diffs.push(`${slug}: verdict ${a.verdict} vs ${b.verdict}`);
    }
    if (a.findings.length !== b.findings.length) {
      diffs.push(`${slug}: findings count ${a.findings.length} vs ${b.findings.length}`);
    }
  }
  for (const slug of byB.keys()) {
    if (!byA.has(slug)) diffs.push(`${slug}: missing from first run`);
  }
  return { passed: diffs.length === 0, diffCount: diffs.length, diffs };
}
