/**
 * SDK-integration rules — verify server.ts actually imports @settlegrid/mcp,
 * calls settlegrid.init() with a toolSlug + pricing config, and wraps at
 * least one handler with sg.wrap().
 *
 * These rules use regex/heuristic source scanning rather than AST parsing
 * to stay cheap across a 1,022-template corpus. For edge-case validation
 * beyond regex, the executable-gates rules run real tsc.
 */

import type { Rule, RuleFinding, TemplateInput } from '../types.js';
import { baselineGood, baselineBad } from '../fixtures.js';

const SETTLEGRID_IMPORT_PATTERN =
  /import\s*\{\s*settlegrid\s*\}\s*from\s*['"]@settlegrid\/mcp['"]/;

const SETTLEGRID_INIT_PATTERN = /settlegrid\s*\.\s*init\s*\(/;

const TOOL_SLUG_PATTERN = /toolSlug\s*:\s*['"]([a-z0-9][a-z0-9-]*)['"]/;

const DEFAULT_COST_PATTERN = /defaultCostCents\s*:\s*(\d+)/;

const SG_WRAP_PATTERN = /sg\s*\.\s*wrap\s*\(/g;

export const sdkImportRule: Rule = {
  id: 'sdk:import-present',
  description: 'server.ts must import { settlegrid } from "@settlegrid/mcp".',
  severity: 'fatal',
  category: 'sdk-integration',
  fixtures: {
    knownGood: baselineGood(),
    knownBad: baselineBad('missing settlegrid import', (f) => ({
      'src/server.ts': f['src/server.ts'].replace(
        "import { settlegrid } from '@settlegrid/mcp'",
        '// import removed',
      ),
    })),
  },
  async check(input: TemplateInput): Promise<RuleFinding[]> {
    const content = input.files.get('src/server.ts');
    if (!content) return [];
    if (!SETTLEGRID_IMPORT_PATTERN.test(content)) {
      return [
        {
          ruleId: 'sdk:import-present',
          severity: 'fatal',
          message: 'server.ts does not import { settlegrid } from "@settlegrid/mcp"',
          evidence: { file: 'src/server.ts' },
        },
      ];
    }
    return [];
  },
};

export const sdkInitRule: Rule = {
  id: 'sdk:init-called',
  description: 'server.ts must call settlegrid.init({ toolSlug, pricing }).',
  severity: 'fatal',
  category: 'sdk-integration',
  fixtures: {
    knownGood: baselineGood(),
    knownBad: baselineBad('no settlegrid.init call', (f) => ({
      'src/server.ts': f['src/server.ts'].replace(
        /const sg = settlegrid\.init\([\s\S]*?\}\)\n/,
        'const sg = { wrap: (h: unknown) => h }\n',
      ),
    })),
  },
  async check(input: TemplateInput): Promise<RuleFinding[]> {
    const content = input.files.get('src/server.ts');
    if (!content) return [];
    if (!SETTLEGRID_INIT_PATTERN.test(content)) {
      return [
        {
          ruleId: 'sdk:init-called',
          severity: 'fatal',
          message: 'server.ts does not call settlegrid.init()',
          evidence: { file: 'src/server.ts' },
        },
      ];
    }
    return [];
  },
};

export const toolSlugMatchRule: Rule = {
  id: 'sdk:tool-slug-matches-dir',
  description: 'toolSlug in settlegrid.init must match the directory slug.',
  severity: 'medium',
  category: 'sdk-integration',
  fixtures: {
    knownGood: baselineGood(),
    knownBad: baselineBad('toolSlug diverges from dir name', (f) => ({
      'src/server.ts': f['src/server.ts'].replace(
        "toolSlug: 'example-tool'",
        "toolSlug: 'completely-different'",
      ),
    })),
  },
  async check(input: TemplateInput): Promise<RuleFinding[]> {
    const content = input.files.get('src/server.ts');
    if (!content) return [];
    const match = content.match(TOOL_SLUG_PATTERN);
    if (!match) {
      // sdk:init-called owns "no init" — here we only flag mismatches.
      return [];
    }
    const declared = match[1];
    if (declared !== input.slug) {
      return [
        {
          ruleId: 'sdk:tool-slug-matches-dir',
          severity: 'medium',
          message: `toolSlug "${declared}" does not match directory slug "${input.slug}"`,
          evidence: { file: 'src/server.ts', snippet: match[0] },
        },
      ];
    }
    return [];
  },
};

export const pricingDefaultRule: Rule = {
  id: 'sdk:pricing-default-cost',
  description: 'settlegrid.init pricing must include defaultCostCents ≥ 1.',
  severity: 'high',
  category: 'sdk-integration',
  fixtures: {
    knownGood: baselineGood(),
    knownBad: baselineBad('defaultCostCents missing', (f) => ({
      'src/server.ts': f['src/server.ts'].replace(/defaultCostCents\s*:\s*\d+,?\s*\n?/, ''),
    })),
  },
  async check(input: TemplateInput): Promise<RuleFinding[]> {
    const content = input.files.get('src/server.ts');
    if (!content) return [];
    const match = content.match(DEFAULT_COST_PATTERN);
    if (!match) {
      return [
        {
          ruleId: 'sdk:pricing-default-cost',
          severity: 'high',
          message: 'pricing.defaultCostCents not found in settlegrid.init',
          evidence: { file: 'src/server.ts' },
        },
      ];
    }
    const val = Number.parseInt(match[1], 10);
    if (!Number.isFinite(val) || val < 1) {
      return [
        {
          ruleId: 'sdk:pricing-default-cost',
          severity: 'high',
          message: `defaultCostCents must be ≥1, got ${val}`,
          evidence: { file: 'src/server.ts', snippet: match[0] },
        },
      ];
    }
    return [];
  },
};

export const wrapHandlerRule: Rule = {
  id: 'sdk:wraps-at-least-one-handler',
  description: 'server.ts must wrap at least one handler with sg.wrap().',
  severity: 'fatal',
  category: 'sdk-integration',
  fixtures: {
    knownGood: baselineGood(),
    knownBad: baselineBad('no sg.wrap calls', (f) => ({
      'src/server.ts': f['src/server.ts'].replace(/sg\.wrap\(/g, 'directInvoke('),
    })),
  },
  async check(input: TemplateInput): Promise<RuleFinding[]> {
    const content = input.files.get('src/server.ts');
    if (!content) return [];
    const matches = content.match(SG_WRAP_PATTERN);
    const count = matches?.length ?? 0;
    if (count === 0) {
      return [
        {
          ruleId: 'sdk:wraps-at-least-one-handler',
          severity: 'fatal',
          message: 'server.ts contains zero sg.wrap(...) calls — no billable methods',
          evidence: { file: 'src/server.ts' },
        },
      ];
    }
    return [];
  },
};

export const sdkIntegrationRules: Rule[] = [
  sdkImportRule,
  sdkInitRule,
  toolSlugMatchRule,
  pricingDefaultRule,
  wrapHandlerRule,
];
