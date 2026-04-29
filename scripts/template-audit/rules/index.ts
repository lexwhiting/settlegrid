import type { Rule } from '../types.js';
import { structuralRules } from './structural.js';
import { pollutionRules } from './pollution-detection.js';
import { sdkIntegrationRules } from './sdk-integration.js';
import { contentDepthRules } from './content-depth.js';
import { metadataRules } from './metadata.js';
import { manifestRules } from './manifest.js';
import { originalityRules } from './originality.js';
import { executableGatesRules } from './executable-gates.js';

/**
 * Registry of every rule that participates in the corpus audit. Ordering
 * matters only for logs + meta-audit dead-rule detection; verdict assembly
 * is order-independent.
 */
export const ALL_RULES: Rule[] = [
  ...structuralRules,
  ...pollutionRules,
  ...sdkIntegrationRules,
  ...contentDepthRules,
  ...metadataRules,
  ...manifestRules,
  ...originalityRules,
  ...executableGatesRules,
];

export function ruleIds(): string[] {
  return ALL_RULES.map((r) => r.id);
}

export function assertUniqueRuleIds(rules: Rule[] = ALL_RULES): void {
  const seen = new Set<string>();
  for (const r of rules) {
    if (seen.has(r.id)) {
      throw new Error(`Duplicate rule id: ${r.id}`);
    }
    seen.add(r.id);
  }
}

export {
  structuralRules,
  pollutionRules,
  sdkIntegrationRules,
  contentDepthRules,
  metadataRules,
  manifestRules,
  originalityRules,
  executableGatesRules,
};
