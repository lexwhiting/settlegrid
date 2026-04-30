/**
 * Metadata rules — package.json hygiene beyond the structural checks.
 * Keywords / description / repository / license / unpinned-deps are
 * signals that a template was generated carelessly or that its pipeline
 * didn't fill in every field.
 */

import type { Rule, RuleFinding, TemplateInput } from '../types.js';
import { baselineGood, baselineBad } from '../fixtures.js';

const MIN_KEYWORDS = 3;
const MIN_DESCRIPTION_LENGTH = 20;
const GENERATOR_BOILERPLATE_PHRASES = [
  /\bgenerated template\b/i,
  /\btemplater placeholder\b/i,
  /\byour description here\b/i,
  /\bTBD\b/,
  /^description$/i,
];

function loadPkg(input: TemplateInput): Record<string, unknown> | null {
  const content = input.files.get('package.json');
  if (!content) return null;
  try {
    const parsed = JSON.parse(content);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

export const keywordsRule: Rule = {
  id: 'metadata:keywords-sufficient',
  description: `package.json.keywords must have ≥${MIN_KEYWORDS} entries.`,
  severity: 'low',
  category: 'metadata',
  fixtures: {
    knownGood: baselineGood(),
    knownBad: baselineBad('too few keywords', (f) => {
      const pkg = JSON.parse(f['package.json']);
      pkg.keywords = ['mcp'];
      return { 'package.json': JSON.stringify(pkg) };
    }),
  },
  async check(input: TemplateInput): Promise<RuleFinding[]> {
    const pkg = loadPkg(input);
    if (!pkg) return [];
    const kw = Array.isArray(pkg.keywords) ? (pkg.keywords as unknown[]) : [];
    if (kw.length < MIN_KEYWORDS) {
      return [
        {
          ruleId: 'metadata:keywords-sufficient',
          severity: 'low',
          message: `package.json has only ${kw.length} keywords (threshold ${MIN_KEYWORDS})`,
          evidence: { file: 'package.json' },
        },
      ];
    }
    return [];
  },
};

export const descriptionRule: Rule = {
  id: 'metadata:description-substance',
  description: `package.json.description must be ≥${MIN_DESCRIPTION_LENGTH} chars and not boilerplate.`,
  severity: 'low',
  category: 'metadata',
  fixtures: {
    knownGood: baselineGood(),
    knownBad: baselineBad('boilerplate description', (f) => {
      const pkg = JSON.parse(f['package.json']);
      pkg.description = 'TBD';
      return { 'package.json': JSON.stringify(pkg) };
    }),
  },
  async check(input: TemplateInput): Promise<RuleFinding[]> {
    const pkg = loadPkg(input);
    if (!pkg) return [];
    const desc = typeof pkg.description === 'string' ? pkg.description : '';
    if (desc.trim().length < MIN_DESCRIPTION_LENGTH) {
      return [
        {
          ruleId: 'metadata:description-substance',
          severity: 'low',
          message: `description too short (${desc.trim().length} chars, threshold ${MIN_DESCRIPTION_LENGTH})`,
          evidence: { file: 'package.json' },
        },
      ];
    }
    for (const p of GENERATOR_BOILERPLATE_PHRASES) {
      if (p.test(desc)) {
        return [
          {
            ruleId: 'metadata:description-substance',
            severity: 'medium',
            message: `description contains generator boilerplate: "${desc.slice(0, 60)}…"`,
            evidence: { file: 'package.json' },
          },
        ];
      }
    }
    return [];
  },
};

export const licenseFieldRule: Rule = {
  id: 'metadata:license-field',
  description: 'package.json.license must be MIT (consistent with LICENSE file).',
  severity: 'low',
  category: 'metadata',
  fixtures: {
    knownGood: baselineGood(),
    knownBad: baselineBad('wrong license field', (f) => {
      const pkg = JSON.parse(f['package.json']);
      pkg.license = 'UNLICENSED';
      return { 'package.json': JSON.stringify(pkg) };
    }),
  },
  async check(input: TemplateInput): Promise<RuleFinding[]> {
    const pkg = loadPkg(input);
    if (!pkg) return [];
    const license = typeof pkg.license === 'string' ? pkg.license : '';
    if (license !== 'MIT') {
      return [
        {
          ruleId: 'metadata:license-field',
          severity: 'low',
          message: `package.json.license is "${license}", expected "MIT"`,
          evidence: { file: 'package.json' },
        },
      ];
    }
    return [];
  },
};

export const repositoryFieldRule: Rule = {
  id: 'metadata:repository-field',
  description: 'package.json.repository must point at github.com/settlegrid/<pkg-name>.',
  severity: 'low',
  category: 'metadata',
  fixtures: {
    knownGood: baselineGood(),
    knownBad: baselineBad('no repository field', (f) => {
      const pkg = JSON.parse(f['package.json']);
      delete pkg.repository;
      return { 'package.json': JSON.stringify(pkg) };
    }),
  },
  async check(input: TemplateInput): Promise<RuleFinding[]> {
    const pkg = loadPkg(input);
    if (!pkg) return [];
    const repo = pkg.repository;
    if (
      !repo ||
      typeof repo !== 'object' ||
      Array.isArray(repo) ||
      typeof (repo as { url?: unknown }).url !== 'string'
    ) {
      return [
        {
          ruleId: 'metadata:repository-field',
          severity: 'low',
          message: 'package.json.repository missing or malformed',
          evidence: { file: 'package.json' },
        },
      ];
    }
    const url = (repo as { url: string }).url;
    if (!url.includes('github.com/settlegrid/')) {
      return [
        {
          ruleId: 'metadata:repository-field',
          severity: 'low',
          message: `package.json.repository.url does not point at github.com/settlegrid/…: "${url}"`,
          evidence: { file: 'package.json', snippet: url },
        },
      ];
    }
    return [];
  },
};

export const pinnedDepsRule: Rule = {
  id: 'metadata:no-unpinned-deps',
  description: 'No dependency may be pinned to "*" or "latest".',
  severity: 'medium',
  category: 'metadata',
  fixtures: {
    knownGood: baselineGood(),
    knownBad: baselineBad('unpinned dep', (f) => {
      const pkg = JSON.parse(f['package.json']);
      pkg.dependencies['some-lib'] = '*';
      return { 'package.json': JSON.stringify(pkg) };
    }),
  },
  async check(input: TemplateInput): Promise<RuleFinding[]> {
    const pkg = loadPkg(input);
    if (!pkg) return [];
    const findings: RuleFinding[] = [];
    for (const section of ['dependencies', 'devDependencies', 'peerDependencies']) {
      const deps = pkg[section];
      if (!deps || typeof deps !== 'object' || Array.isArray(deps)) continue;
      for (const [name, range] of Object.entries(deps as Record<string, unknown>)) {
        if (range === '*' || range === 'latest') {
          findings.push({
            ruleId: 'metadata:no-unpinned-deps',
            severity: 'medium',
            message: `${section}.${name} uses unpinned range "${range}"`,
            evidence: { file: 'package.json' },
          });
        }
      }
    }
    return findings;
  },
};

export const metadataRules: Rule[] = [
  keywordsRule,
  descriptionRule,
  licenseFieldRule,
  repositoryFieldRule,
  pinnedDepsRule,
];
