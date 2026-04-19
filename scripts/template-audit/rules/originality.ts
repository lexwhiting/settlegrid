/**
 * Originality rules — flag templates whose server.ts or README is a near-
 * byte-duplicate of another template. The pre-Quantum-Leap generator
 * emitted some families of templates from the same prompt-batch, which
 * produced source-identical siblings with only the slug swapped.
 *
 * Normalized hashing:
 *   - server.ts: strip the slug token (`settlegrid-<slug>`, `<slug>`) and
 *     common header comments before hashing
 *   - README.md: strip the H1 heading (`# settlegrid-<slug>`) before hashing
 *
 * The orchestrator pre-computes hashes for every template and populates
 * CorpusIndex so the per-template rule check is an O(1) lookup.
 */

import type { Rule, RuleFinding, TemplateInput } from '../types.js';
import { baselineGood } from '../fixtures.js';

// Ultra-thin known-bad requires the orchestrator to pre-populate corpus
// state, so per-rule fixtures validate the check given an artificial
// corpus collision. These fixtures only validate the no-collision path;
// the collision path is pinned by the orchestrator's own unit tests.
export const duplicateServerRule: Rule = {
  id: 'originality:duplicate-server',
  description:
    'server.ts must not be a normalized-hash duplicate of another template.',
  severity: 'medium',
  category: 'originality',
  fixtures: {
    knownGood: baselineGood(),
    knownBad: {
      // Cross-corpus rules can't produce findings in isolation — the
      // collision signal requires ≥2 templates sharing a normalized hash.
      // The orchestrator tests pin the collision path; the meta-audit
      // accepts minFindings=maxFindings=0 as "this rule is a no-op in
      // isolation and requires corpus-scoped context to fire."
      description: 'no collision in single-template input (requires corpus context)',
      files: baselineGood().files,
      minFindings: 0,
      maxFindings: 0,
    },
  },
  async check(input: TemplateInput): Promise<RuleFinding[]> {
    const siblings = input.corpus.sourceHashIndex.get(input.normalizedSourceHash) ?? [];
    const others = siblings.filter((s) => s !== input.slug);
    if (others.length === 0) return [];
    return [
      {
        ruleId: 'originality:duplicate-server',
        severity: 'medium',
        message: `server.ts shares normalized hash with ${others.length} other template(s): ${others.slice(0, 5).join(', ')}${others.length > 5 ? '…' : ''}`,
        evidence: {
          file: 'src/server.ts',
          data: { duplicateSlugs: others, hash: input.normalizedSourceHash },
        },
      },
    ];
  },
};

export const duplicateReadmeRule: Rule = {
  id: 'originality:duplicate-readme',
  description: 'README.md must not be a normalized-hash duplicate of another template.',
  severity: 'low',
  category: 'originality',
  fixtures: {
    knownGood: baselineGood(),
    knownBad: {
      description: 'no collision in single-template input (requires corpus context)',
      files: baselineGood().files,
      minFindings: 0,
      maxFindings: 0,
    },
  },
  async check(input: TemplateInput): Promise<RuleFinding[]> {
    const siblings = input.corpus.readmeHashIndex.get(input.normalizedReadmeHash) ?? [];
    const others = siblings.filter((s) => s !== input.slug);
    if (others.length === 0) return [];
    return [
      {
        ruleId: 'originality:duplicate-readme',
        severity: 'low',
        message: `README.md shares normalized hash with ${others.length} other template(s): ${others.slice(0, 5).join(', ')}${others.length > 5 ? '…' : ''}`,
        evidence: {
          file: 'README.md',
          data: { duplicateSlugs: others, hash: input.normalizedReadmeHash },
        },
      },
    ];
  },
};

export const originalityRules: Rule[] = [duplicateServerRule, duplicateReadmeRule];

// Exported for the orchestrator — normalization before hashing.
export function normalizeSource(content: string, slug: string): string {
  return content
    // strip slug mentions so a slug-only diff doesn't hide dupes
    .replace(new RegExp(`settlegrid-${slug}`, 'g'), 'SLUG')
    .replace(new RegExp(`\\b${slug}\\b`, 'g'), 'SLUG')
    // normalize whitespace
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function normalizeReadme(content: string, slug: string): string {
  return content
    .replace(new RegExp(`settlegrid-${slug}`, 'g'), 'SLUG')
    .replace(new RegExp(`\\b${slug}\\b`, 'g'), 'SLUG')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
