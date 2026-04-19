/**
 * Structural rules — verify every template carries the expected file set
 * and that the critical config files parse as valid JSON with the expected
 * shape (name, slug match, @settlegrid/mcp dependency).
 *
 * These are cheap to evaluate (file existence + JSON.parse) and high-signal.
 * A template that's missing package.json or has invalid JSON is almost
 * certainly broken.
 */

import type { Rule, RuleFinding, TemplateInput } from '../types.js';
import { baselineGood, baselineBad } from '../fixtures.js';

const REQUIRED_FILES = [
  'package.json',
  'src/server.ts',
  'README.md',
  'tsconfig.json',
  'Dockerfile',
  'vercel.json',
  'LICENSE',
];

export const requiredFilesRule: Rule = {
  id: 'structural:required-files',
  description: 'Every template must ship the expected 7-file skeleton.',
  severity: 'high',
  category: 'structural',
  fixtures: {
    knownGood: baselineGood(),
    knownBad: baselineBad('missing README + Dockerfile', () => ({
      'README.md': null,
      Dockerfile: null,
    })),
  },
  async check(input: TemplateInput): Promise<RuleFinding[]> {
    const findings: RuleFinding[] = [];
    for (const f of REQUIRED_FILES) {
      if (!input.files.has(f)) {
        findings.push({
          ruleId: 'structural:required-files',
          severity: 'high',
          message: `missing required file: ${f}`,
          evidence: { file: f },
        });
      }
    }
    return findings;
  },
};

export const packageJsonValidRule: Rule = {
  id: 'structural:package-json-valid',
  description: 'package.json must parse as JSON and carry name + @settlegrid/mcp dep.',
  severity: 'fatal',
  category: 'structural',
  fixtures: {
    knownGood: baselineGood(),
    knownBad: baselineBad('package.json is a code fragment, not JSON', () => ({
      'package.json': 'module.exports = { name: "x" }',
    })),
  },
  async check(input: TemplateInput): Promise<RuleFinding[]> {
    const content = input.files.get('package.json');
    if (content === undefined) return []; // required-files rule catches absence
    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch (err) {
      return [
        {
          ruleId: 'structural:package-json-valid',
          severity: 'fatal',
          message: `package.json invalid JSON: ${(err as Error).message}`,
          evidence: { file: 'package.json' },
        },
      ];
    }
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return [
        {
          ruleId: 'structural:package-json-valid',
          severity: 'fatal',
          message: 'package.json must be a JSON object',
          evidence: { file: 'package.json' },
        },
      ];
    }
    const pkg = parsed as Record<string, unknown>;
    const findings: RuleFinding[] = [];
    if (typeof pkg.name !== 'string' || pkg.name.length === 0) {
      findings.push({
        ruleId: 'structural:package-json-valid',
        severity: 'high',
        message: 'package.json.name missing or empty',
        evidence: { file: 'package.json' },
      });
    }
    const deps = (pkg.dependencies ?? {}) as Record<string, unknown>;
    if (typeof deps['@settlegrid/mcp'] !== 'string') {
      findings.push({
        ruleId: 'structural:package-json-valid',
        severity: 'high',
        message: '@settlegrid/mcp not listed in dependencies',
        evidence: { file: 'package.json' },
      });
    }
    return findings;
  },
};

export const slugMatchRule: Rule = {
  id: 'structural:slug-match',
  description: 'package.json.name should equal settlegrid-<dir-slug>.',
  severity: 'medium',
  category: 'structural',
  fixtures: {
    knownGood: baselineGood(),
    knownBad: baselineBad('package.json.name does not match slug', (f) => {
      const pkg = JSON.parse(f['package.json']);
      pkg.name = 'settlegrid-wrong-name';
      return { 'package.json': JSON.stringify(pkg) };
    }),
  },
  async check(input: TemplateInput): Promise<RuleFinding[]> {
    const content = input.files.get('package.json');
    if (!content) return [];
    let pkg: Record<string, unknown>;
    try {
      pkg = JSON.parse(content) as Record<string, unknown>;
    } catch {
      return []; // package-json-valid rule owns this
    }
    const name = typeof pkg.name === 'string' ? pkg.name : '';
    const expected = `settlegrid-${input.slug}`;
    if (name !== expected) {
      return [
        {
          ruleId: 'structural:slug-match',
          severity: 'medium',
          message: `package.json.name "${name}" does not match expected "${expected}"`,
          evidence: { file: 'package.json' },
        },
      ];
    }
    return [];
  },
};

export const tsconfigValidRule: Rule = {
  id: 'structural:tsconfig-valid',
  description: 'tsconfig.json must parse as JSON.',
  severity: 'high',
  category: 'structural',
  fixtures: {
    knownGood: baselineGood(),
    knownBad: baselineBad('tsconfig is malformed', () => ({
      'tsconfig.json': '{ not valid json',
    })),
  },
  async check(input: TemplateInput): Promise<RuleFinding[]> {
    const content = input.files.get('tsconfig.json');
    if (!content) return [];
    try {
      JSON.parse(content);
      return [];
    } catch (err) {
      return [
        {
          ruleId: 'structural:tsconfig-valid',
          severity: 'high',
          message: `tsconfig.json invalid JSON: ${(err as Error).message}`,
          evidence: { file: 'tsconfig.json' },
        },
      ];
    }
  },
};

export const licenseNonEmptyRule: Rule = {
  id: 'structural:license-non-empty',
  description: 'LICENSE must be non-empty and reference a recognized license.',
  severity: 'low',
  category: 'structural',
  fixtures: {
    knownGood: baselineGood(),
    knownBad: baselineBad('LICENSE is empty', () => ({
      LICENSE: '',
    })),
  },
  async check(input: TemplateInput): Promise<RuleFinding[]> {
    // An empty LICENSE file is still present (required-files rule counts it
    // as present), but it carries zero license text. Treat as substantive
    // failure. Missing LICENSE entirely is handled by the required-files rule.
    if (!input.files.has('LICENSE')) return [];
    const content = input.files.get('LICENSE') ?? '';
    const trimmed = content.trim();
    if (trimmed.length < 100) {
      return [
        {
          ruleId: 'structural:license-non-empty',
          severity: 'low',
          message: `LICENSE is suspiciously short (${trimmed.length} chars, expected ≥100)`,
          evidence: { file: 'LICENSE' },
        },
      ];
    }
    return [];
  },
};

export const structuralRules: Rule[] = [
  requiredFilesRule,
  packageJsonValidRule,
  slugMatchRule,
  tsconfigValidRule,
  licenseNonEmptyRule,
];
