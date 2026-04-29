/**
 * Reporter — emits per-template JSON + corpus-wide Markdown + CSV.
 *
 * The Markdown report is the primary artifact a human reviewer uses to
 * triage verdicts. The JSON and CSV are for downstream automation
 * (the cull script and spreadsheet-based triage).
 */

import * as fsp from 'node:fs/promises';
import * as path from 'node:path';
import type {
  CorpusReport,
  MetaAuditReport,
  Severity,
  Verdict,
  VerdictResult,
} from './types.js';

export interface ReportWriterOptions {
  outputDir: string;
  runId: string;
}

export interface WriteReportInput {
  runId: string;
  startedAt: Date;
  completedAt: Date;
  totalTemplates: number;
  results: VerdictResult[];
  ruleActivations: Record<string, number>;
  metaAudit: MetaAuditReport;
}

export function buildCorpusReport(input: WriteReportInput): CorpusReport {
  const verdictCounts: Record<Verdict, number> = { KEEP: 0, REVIEW: 0, REMOVE: 0 };
  for (const r of input.results) verdictCounts[r.verdict]++;

  const failureCounts = new Map<string, { count: number; severity: Severity }>();
  for (const r of input.results) {
    for (const f of r.findings) {
      const existing = failureCounts.get(f.ruleId);
      if (existing) {
        existing.count++;
      } else {
        failureCounts.set(f.ruleId, { count: 1, severity: f.severity });
      }
    }
  }
  const topFailureClusters = Array.from(failureCounts.entries())
    .map(([ruleId, v]) => ({ ruleId, count: v.count, severity: v.severity }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return {
    runId: input.runId,
    startedAt: input.startedAt.toISOString(),
    completedAt: input.completedAt.toISOString(),
    durationMs: input.completedAt.getTime() - input.startedAt.getTime(),
    totalTemplates: input.totalTemplates,
    verdictCounts,
    ruleActivations: input.ruleActivations,
    topFailureClusters,
    perTemplate: input.results,
    metaAudit: input.metaAudit,
  };
}

export async function writeReports(
  report: CorpusReport,
  outputDir: string,
): Promise<{ jsonPath: string; markdownPath: string; csvPath: string }> {
  await fsp.mkdir(outputDir, { recursive: true });
  const jsonPath = path.join(outputDir, 'report.json');
  const markdownPath = path.join(outputDir, 'report.md');
  const csvPath = path.join(outputDir, 'verdicts.csv');

  await fsp.writeFile(jsonPath, JSON.stringify(report, null, 2), 'utf-8');
  await fsp.writeFile(markdownPath, renderMarkdown(report), 'utf-8');
  await fsp.writeFile(csvPath, renderCsv(report), 'utf-8');

  return { jsonPath, markdownPath, csvPath };
}

export function renderMarkdown(report: CorpusReport): string {
  const lines: string[] = [];
  lines.push(`# Template Audit Report — ${report.runId}`);
  lines.push('');
  lines.push(
    `**Started:** ${report.startedAt}  \n**Completed:** ${report.completedAt}  \n**Duration:** ${(report.durationMs / 1000).toFixed(1)}s  \n**Total templates audited:** ${report.totalTemplates}`,
  );
  lines.push('');
  lines.push('## Verdict distribution');
  lines.push('');
  lines.push('| Verdict | Count | % |');
  lines.push('|---|---|---|');
  for (const v of ['KEEP', 'REVIEW', 'REMOVE'] as const) {
    const count = report.verdictCounts[v];
    const pct = ((count / Math.max(1, report.totalTemplates)) * 100).toFixed(1);
    lines.push(`| ${v} | ${count} | ${pct}% |`);
  }
  lines.push('');

  lines.push('## Meta-audit');
  lines.push('');
  lines.push(`- Overall: **${report.metaAudit.passed ? 'PASS' : 'FAIL'}**`);
  lines.push(`- Rule fixture checks: ${report.metaAudit.ruleFixtureChecks.length} rules validated`);
  const failingRules = report.metaAudit.ruleFixtureChecks.filter(
    (r) => !r.knownGoodPassed || !r.knownBadRejected,
  );
  if (failingRules.length > 0) {
    lines.push('- Rules that failed their own fixtures:');
    for (const r of failingRules) {
      lines.push(`  - \`${r.ruleId}\`: ${r.details ?? '(no details)'}`);
    }
  }
  if (report.metaAudit.deadRules.length > 0) {
    lines.push(`- Dead rules (never fired on corpus): ${report.metaAudit.deadRules.join(', ')}`);
  }
  if (report.metaAudit.contradictions.length > 0) {
    lines.push(`- Rule contradictions: ${report.metaAudit.contradictions.length}`);
    for (const c of report.metaAudit.contradictions.slice(0, 5)) {
      lines.push(`  - ${c.template}: ${c.ruleAId} + ${c.ruleBId} (${c.reason})`);
    }
  }
  lines.push(
    `- Verdict invariant: sumMatchesTotal=${report.metaAudit.verdictInvariant.sumMatchesTotal}, everyTemplateHasVerdict=${report.metaAudit.verdictInvariant.everyTemplateHasVerdict}`,
  );
  if (report.metaAudit.verdictInvariant.duplicateSlugs.length > 0) {
    lines.push(
      `- Duplicate slugs: ${report.metaAudit.verdictInvariant.duplicateSlugs.join(', ')}`,
    );
  }
  lines.push(
    `- Determinism: runTwicePassed=${report.metaAudit.determinism.runTwicePassed} (diffs: ${report.metaAudit.determinism.diffCount})`,
  );
  lines.push('');

  lines.push('## Top failure clusters');
  lines.push('');
  lines.push('| Rule | Severity | Count |');
  lines.push('|---|---|---|');
  for (const c of report.topFailureClusters) {
    lines.push(`| \`${c.ruleId}\` | ${c.severity} | ${c.count} |`);
  }
  lines.push('');

  lines.push('## Rule activation counts');
  lines.push('');
  lines.push('| Rule | Times fired |');
  lines.push('|---|---|');
  const sortedActivations = Object.entries(report.ruleActivations).sort(
    (a, b) => b[1] - a[1],
  );
  for (const [ruleId, count] of sortedActivations) {
    lines.push(`| \`${ruleId}\` | ${count} |`);
  }
  lines.push('');

  lines.push('## REMOVE candidates (sample)');
  lines.push('');
  const removes = report.perTemplate.filter((r) => r.verdict === 'REMOVE');
  for (const r of removes.slice(0, 50)) {
    lines.push(`### \`${r.slug}\` (confidence ${r.confidence.toFixed(2)})`);
    for (const reason of r.reasons) lines.push(`- ${reason}`);
    for (const f of r.findings.filter((f) => f.severity !== 'low').slice(0, 3)) {
      lines.push(`  - **${f.severity}** \`${f.ruleId}\`: ${f.message}`);
      if (f.evidence?.file) {
        lines.push(
          `    - evidence: ${f.evidence.file}${f.evidence.line ? `:${f.evidence.line}` : ''}${f.evidence.snippet ? `  \n    \`${f.evidence.snippet.replace(/`/g, '\\`')}\`` : ''}`,
        );
      }
    }
    lines.push('');
  }
  if (removes.length > 50) {
    lines.push(`… and ${removes.length - 50} more. See JSON report for full list.`);
  }
  lines.push('');

  lines.push('## REVIEW candidates (sample)');
  lines.push('');
  const reviews = report.perTemplate.filter((r) => r.verdict === 'REVIEW');
  for (const r of reviews.slice(0, 30)) {
    lines.push(`- **\`${r.slug}\`** (confidence ${r.confidence.toFixed(2)}): ${r.reasons.join('; ')}`);
  }
  if (reviews.length > 30) {
    lines.push(`… and ${reviews.length - 30} more.`);
  }

  return lines.join('\n') + '\n';
}

export function renderCsv(report: CorpusReport): string {
  const header = 'slug,verdict,confidence,isCanonical,fatal_count,high_count,medium_count,low_count,findings_summary';
  const rows: string[] = [header];
  for (const r of report.perTemplate) {
    const counts = { fatal: 0, high: 0, medium: 0, low: 0 };
    for (const f of r.findings) counts[f.severity]++;
    const summary = r.findings
      .map((f) => `${f.ruleId}:${f.severity}`)
      .slice(0, 5)
      .join('|');
    const escaped = `"${summary.replace(/"/g, '""')}"`;
    rows.push(
      `${r.slug},${r.verdict},${r.confidence.toFixed(2)},${r.isCanonical ? 'yes' : 'no'},${counts.fatal},${counts.high},${counts.medium},${counts.low},${escaped}`,
    );
  }
  return rows.join('\n') + '\n';
}
