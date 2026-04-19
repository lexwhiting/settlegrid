/**
 * Content-depth rules — detect shallow shells. A template with a valid
 * package.json but whose server.ts is 20 lines of boilerplate or whose
 * README is just the scaffold preamble is not adding value.
 *
 * These rules use size heuristics calibrated against the well-written
 * templates in the corpus (alpha-vantage, home-assistant, b3-brazil)
 * which cluster around:
 *   - server.ts: 100-150 non-blank non-comment lines
 *   - README:    50-100 non-blank lines
 *   - ≥1 external fetch() or API call
 *   - ≥1 input-validation throw
 */

import type { Rule, RuleFinding, TemplateInput } from '../types.js';
import { baselineGood, baselineBad } from '../fixtures.js';

const MIN_SERVER_EXECUTABLE_LINES = 30;
const MIN_README_LINES = 20;

function countExecutableLines(content: string): number {
  let count = 0;
  let inBlockComment = false;
  for (const raw of content.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    if (inBlockComment) {
      if (line.includes('*/')) inBlockComment = false;
      continue;
    }
    if (line.startsWith('/*')) {
      if (!line.includes('*/')) inBlockComment = true;
      continue;
    }
    if (line.startsWith('//') || line.startsWith('*')) continue;
    count++;
  }
  return count;
}

function countNonBlankLines(content: string): number {
  return content.split('\n').filter((l) => l.trim().length > 0).length;
}

export const serverLineCountRule: Rule = {
  id: 'content:server-line-count',
  description: `server.ts must contain ≥${MIN_SERVER_EXECUTABLE_LINES} executable lines (excluding blanks and comments).`,
  severity: 'medium',
  category: 'content-depth',
  fixtures: {
    knownGood: baselineGood(),
    knownBad: baselineBad('server.ts is a 5-line stub', () => ({
      'src/server.ts': `import { settlegrid } from '@settlegrid/mcp'
const sg = settlegrid.init({ toolSlug: 'stub', pricing: { defaultCostCents: 1 } })
const fn = sg.wrap(async () => ({}), { method: 'x' })
export { fn }
console.log('stub')`,
    })),
  },
  async check(input: TemplateInput): Promise<RuleFinding[]> {
    const content = input.files.get('src/server.ts');
    if (!content) return [];
    const lines = countExecutableLines(content);
    if (lines < MIN_SERVER_EXECUTABLE_LINES) {
      return [
        {
          ruleId: 'content:server-line-count',
          severity: 'medium',
          message: `server.ts has only ${lines} executable lines (threshold ${MIN_SERVER_EXECUTABLE_LINES})`,
          evidence: { file: 'src/server.ts', data: { executableLines: lines } },
        },
      ];
    }
    return [];
  },
};

export const readmeSubstanceRule: Rule = {
  id: 'content:readme-substance',
  description: `README.md must have ≥${MIN_README_LINES} non-blank lines.`,
  severity: 'low',
  category: 'content-depth',
  fixtures: {
    knownGood: baselineGood(),
    knownBad: baselineBad('README is just a heading', () => ({
      'README.md': '# settlegrid-example-tool\n',
    })),
  },
  async check(input: TemplateInput): Promise<RuleFinding[]> {
    const content = input.files.get('README.md');
    if (!content) return [];
    const lines = countNonBlankLines(content);
    if (lines < MIN_README_LINES) {
      return [
        {
          ruleId: 'content:readme-substance',
          severity: 'low',
          message: `README.md has only ${lines} non-blank lines (threshold ${MIN_README_LINES})`,
          evidence: { file: 'README.md', data: { nonBlankLines: lines } },
        },
      ];
    }
    return [];
  },
};

export const externalCallRule: Rule = {
  id: 'content:external-fetch-or-data',
  description:
    'server.ts must either fetch() an external URL OR declare ≥10 reference-data entries (pure-data templates).',
  severity: 'medium',
  category: 'content-depth',
  fixtures: {
    knownGood: baselineGood(),
    knownBad: baselineBad('no fetch + no reference data', () => ({
      'src/server.ts': `import { settlegrid } from '@settlegrid/mcp'
const sg = settlegrid.init({ toolSlug: 'empty', pricing: { defaultCostCents: 1 } })
const fn = sg.wrap(async () => {
  return { message: 'hello' }
}, { method: 'fn' })
const fn2 = sg.wrap(async () => ({ ok: true }), { method: 'fn2' })
const fn3 = sg.wrap(async () => ({ data: 'nothing' }), { method: 'fn3' })
const fn4 = sg.wrap(async () => ({ x: 1 }), { method: 'fn4' })
const fn5 = sg.wrap(async () => ({ y: 2 }), { method: 'fn5' })
const fn6 = sg.wrap(async () => ({ z: 3 }), { method: 'fn6' })
const fn7 = sg.wrap(async () => ({ a: 'b' }), { method: 'fn7' })
const fn8 = sg.wrap(async () => ({ c: 'd' }), { method: 'fn8' })
const fn9 = sg.wrap(async () => ({ e: 'f' }), { method: 'fn9' })
const fn10 = sg.wrap(async () => ({ g: 'h' }), { method: 'fn10' })
const fn11 = sg.wrap(async () => ({ i: 'j' }), { method: 'fn11' })
const fn12 = sg.wrap(async () => ({ k: 'l' }), { method: 'fn12' })
const fn13 = sg.wrap(async () => ({ m: 'n' }), { method: 'fn13' })
const fn14 = sg.wrap(async () => ({ o: 'p' }), { method: 'fn14' })
const fn15 = sg.wrap(async () => ({ q: 'r' }), { method: 'fn15' })
const fn16 = sg.wrap(async () => ({ s: 't' }), { method: 'fn16' })
const fn17 = sg.wrap(async () => ({ u: 'v' }), { method: 'fn17' })
const fn18 = sg.wrap(async () => ({ w: 'x' }), { method: 'fn18' })
const fn19 = sg.wrap(async () => ({ yz: '12' }), { method: 'fn19' })
const fn20 = sg.wrap(async () => ({ ab: 'cd' }), { method: 'fn20' })
const fn21 = sg.wrap(async () => ({ ef: 'gh' }), { method: 'fn21' })
const fn22 = sg.wrap(async () => ({ ij: 'kl' }), { method: 'fn22' })
const fn23 = sg.wrap(async () => ({ mn: 'op' }), { method: 'fn23' })
const fn24 = sg.wrap(async () => ({ qr: 'st' }), { method: 'fn24' })
const fn25 = sg.wrap(async () => ({ uv: 'wx' }), { method: 'fn25' })
const fn26 = sg.wrap(async () => ({ yz: '90' }), { method: 'fn26' })
const fn27 = sg.wrap(async () => ({ pp: 'qq' }), { method: 'fn27' })
const fn28 = sg.wrap(async () => ({ rr: 'ss' }), { method: 'fn28' })
const fn29 = sg.wrap(async () => ({ tt: 'uu' }), { method: 'fn29' })
const fn30 = sg.wrap(async () => ({ vv: 'ww' }), { method: 'fn30' })
export { fn }
console.log('empty ready')`,
    })),
  },
  async check(input: TemplateInput): Promise<RuleFinding[]> {
    const content = input.files.get('src/server.ts');
    if (!content) return [];
    const fetchCount = (content.match(/\bfetch\s*\(/g) ?? []).length;
    if (fetchCount > 0) return [];
    // Reference-data path: look for const arrays / records with enough entries.
    // Count property-assignment lines inside object literals.
    const colonEntries = (content.match(/^\s*['"]?[\w.-]+['"]?\s*:/gm) ?? []).length;
    if (colonEntries >= 10) return [];
    return [
      {
        ruleId: 'content:external-fetch-or-data',
        severity: 'medium',
        message: `server.ts has no fetch() call and only ${colonEntries} data-entry lines — appears to be a hollow handler chain`,
        evidence: { file: 'src/server.ts', data: { fetchCount, colonEntries } },
      },
    ];
  },
};

export const errorHandlingRule: Rule = {
  id: 'content:input-validation-throws',
  description: 'server.ts should throw at least once on invalid input.',
  severity: 'low',
  category: 'content-depth',
  fixtures: {
    knownGood: baselineGood(),
    knownBad: baselineBad('never throws (input validation removed)', (f) => ({
      // Comment-prefixing would still match the regex `\bthrow\s+new\s+Error\s*\(`
      // because `\b` matches after `// `. Replace with a genuine non-throw
      // expression so the regex can't match.
      'src/server.ts': f['src/server.ts'].replace(
        /throw\s+new\s+Error\s*\([^)]*\)/g,
        'console.warn("validation skipped")',
      ),
    })),
  },
  async check(input: TemplateInput): Promise<RuleFinding[]> {
    const content = input.files.get('src/server.ts');
    if (!content) return [];
    const throws = (content.match(/\bthrow\s+new\s+\w*Error\s*\(/g) ?? []).length;
    if (throws === 0) {
      return [
        {
          ruleId: 'content:input-validation-throws',
          severity: 'low',
          message: 'server.ts has no throw statements — missing input validation',
          evidence: { file: 'src/server.ts' },
        },
      ];
    }
    return [];
  },
};

export const contentDepthRules: Rule[] = [
  serverLineCountRule,
  readmeSubstanceRule,
  externalCallRule,
  errorHandlingRule,
];
