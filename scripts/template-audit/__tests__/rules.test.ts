import { describe, it, expect } from 'vitest';
import type { CorpusIndex, Rule, TemplateInput } from '../types.js';
import { ALL_RULES, assertUniqueRuleIds } from '../rules/index.js';
import { baselineGood } from '../fixtures.js';
import {
  placeholderSurvivalRule,
  pythonTernaryRule,
  scaffoldMarkerRule,
} from '../rules/pollution-detection.js';
import {
  sdkImportRule,
  sdkInitRule,
  toolSlugMatchRule,
  pricingDefaultRule,
  wrapHandlerRule,
} from '../rules/sdk-integration.js';
import {
  serverLineCountRule,
  readmeSubstanceRule,
  externalCallRule,
  errorHandlingRule,
} from '../rules/content-depth.js';
import {
  requiredFilesRule,
  packageJsonValidRule,
  slugMatchRule,
  tsconfigValidRule,
  licenseNonEmptyRule,
} from '../rules/structural.js';
import {
  keywordsRule,
  descriptionRule,
  licenseFieldRule,
  repositoryFieldRule,
  pinnedDepsRule,
} from '../rules/metadata.js';
import { manifestValidRule } from '../rules/manifest.js';
import {
  duplicateServerRule,
  duplicateReadmeRule,
  normalizeSource,
  normalizeReadme,
} from '../rules/originality.js';
import { tscCompileRule } from '../rules/executable-gates.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function emptyCorpus(): CorpusIndex {
  return {
    sourceHashIndex: new Map(),
    readmeHashIndex: new Map(),
    canonicalSlugs: new Set(),
    totalTemplates: 0,
  };
}

function makeInput(
  slug: string,
  files: Record<string, string>,
  overrides: Partial<TemplateInput> = {},
): TemplateInput {
  return {
    slug,
    absPath: `/fake/settlegrid-${slug}`,
    files: new Map(Object.entries(files)),
    corpus: overrides.corpus ?? emptyCorpus(),
    normalizedSourceHash: overrides.normalizedSourceHash ?? 'hash-abc',
    normalizedReadmeHash: overrides.normalizedReadmeHash ?? 'hash-def',
  };
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

describe('rules registry', () => {
  it('ALL_RULES has >=20 rules', () => {
    expect(ALL_RULES.length).toBeGreaterThanOrEqual(20);
  });

  it('every rule id is unique', () => {
    expect(() => assertUniqueRuleIds()).not.toThrow();
  });

  it('duplicate ids are detected', () => {
    const dup: Rule[] = [ALL_RULES[0], ALL_RULES[0]];
    expect(() => assertUniqueRuleIds(dup)).toThrow(/Duplicate rule id/);
  });

  it('every rule has fixtures.knownGood and fixtures.knownBad', () => {
    for (const r of ALL_RULES) {
      expect(r.fixtures.knownGood).toBeDefined();
      expect(r.fixtures.knownBad).toBeDefined();
      expect(r.fixtures.knownGood.files).toBeDefined();
      expect(r.fixtures.knownBad.files).toBeDefined();
    }
  });

  it('every rule id follows namespace:name format', () => {
    for (const r of ALL_RULES) {
      expect(r.id).toMatch(/^[a-z]+:[a-z0-9-]+$/);
    }
  });
});

// ---------------------------------------------------------------------------
// Structural rules — extra coverage beyond fixtures
// ---------------------------------------------------------------------------

describe('structural rules', () => {
  it('required-files flags each missing file', async () => {
    const input = makeInput('x', {});
    const findings = await requiredFilesRule.check(input);
    expect(findings.length).toBe(7); // all 7 required files missing
    expect(findings.every((f) => f.ruleId === 'structural:required-files')).toBe(true);
  });

  it('package-json-valid tolerates missing file (delegates to required-files)', async () => {
    const input = makeInput('x', {});
    expect((await packageJsonValidRule.check(input)).length).toBe(0);
  });

  it('package-json-valid flags non-JSON content as fatal', async () => {
    const input = makeInput('x', { 'package.json': 'module.exports = {}' });
    const findings = await packageJsonValidRule.check(input);
    expect(findings.length).toBeGreaterThanOrEqual(1);
    expect(findings[0].severity).toBe('fatal');
  });

  it('package-json-valid flags JSON array (not object) as fatal', async () => {
    const input = makeInput('x', { 'package.json': '[]' });
    const findings = await packageJsonValidRule.check(input);
    expect(findings.some((f) => f.severity === 'fatal')).toBe(true);
  });

  it('slug-match does not flag when names agree', async () => {
    const input = makeInput('my-tool', {
      'package.json': JSON.stringify({ name: 'settlegrid-my-tool' }),
    });
    const findings = await slugMatchRule.check(input);
    expect(findings.length).toBe(0);
  });

  it('tsconfig-valid skips when file is absent (required-files catches it)', async () => {
    const input = makeInput('x', {});
    expect((await tsconfigValidRule.check(input)).length).toBe(0);
  });

  it('license-non-empty flags a very short LICENSE file', async () => {
    const input = makeInput('x', { LICENSE: 'MIT' });
    const findings = await licenseNonEmptyRule.check(input);
    expect(findings.length).toBe(1);
    expect(findings[0].severity).toBe('low');
  });
});

// ---------------------------------------------------------------------------
// Pollution rules — core signal for broken-shell detection
// ---------------------------------------------------------------------------

describe('pollution rules', () => {
  it('placeholder-survival catches mustache-style {{FOO_BAR}}', async () => {
    const input = makeInput('x', {
      'src/server.ts': 'const x = "{{TOOL_SLUG}}";\n',
    });
    const findings = await placeholderSurvivalRule.check(input);
    expect(findings.length).toBeGreaterThanOrEqual(1);
    expect(findings[0].severity).toBe('fatal');
    expect(findings[0].message).toContain('mustache-placeholder');
  });

  it('placeholder-survival catches Jinja {% if %}', async () => {
    const input = makeInput('x', {
      'src/server.ts': '// {% if foo %} sample {% endif %}\n',
    });
    const findings = await placeholderSurvivalRule.check(input);
    expect(findings.length).toBeGreaterThanOrEqual(1);
  });

  it('placeholder-survival catches %ENV_VAR% Windows-style', async () => {
    const input = makeInput('x', {
      'src/server.ts': 'const p = "%USER_PROFILE%";\n',
    });
    const findings = await placeholderSurvivalRule.check(input);
    expect(findings.length).toBeGreaterThanOrEqual(1);
  });

  it('placeholder-survival does NOT flag legitimate ${VAR} template literals (false-positive regression)', async () => {
    const input = makeInput('x', {
      'src/server.ts':
        'const url = `${API_BASE}/${path}`;\nconst key = `Bearer ${token}`;\n',
    });
    const findings = await placeholderSurvivalRule.check(input);
    expect(findings.length).toBe(0);
  });

  it('python-ternary catches the hebrew-calendar pattern', async () => {
    const input = makeInput('hebrew-calendar', {
      'src/server.ts': `const x = {"A" if slug == "hebrew-calendar" else "B"}\n`,
    });
    const findings = await pythonTernaryRule.check(input);
    expect(findings.length).toBeGreaterThanOrEqual(1);
    expect(findings[0].severity).toBe('fatal');
  });

  it('python-ternary does NOT flag a normal JS ternary', async () => {
    const input = makeInput('x', {
      'src/server.ts': 'const x = cond ? "A" : "B";\n',
    });
    expect((await pythonTernaryRule.check(input)).length).toBe(0);
  });

  it('scaffold-markers triggers only past threshold', async () => {
    const input = makeInput('x', {
      'src/server.ts': '// TODO: one\n// TODO: two\n// TODO: three\n',
    });
    expect((await scaffoldMarkerRule.check(input)).length).toBe(0); // at threshold=3, not over
    const over = makeInput('x', {
      'src/server.ts': '// TODO: 1\n// FIXME: 2\n// TODO: 3\n// PLACEHOLDER: 4\n',
    });
    expect((await scaffoldMarkerRule.check(over)).length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// SDK-integration rules
// ---------------------------------------------------------------------------

describe('sdk-integration rules', () => {
  it('sdk-import-present passes baseline', async () => {
    const input = makeInput('example-tool', baselineGood().files);
    expect((await sdkImportRule.check(input)).length).toBe(0);
  });

  it('sdk-init-called flags missing init', async () => {
    const input = makeInput('x', {
      'src/server.ts': "import { settlegrid } from '@settlegrid/mcp'\n",
    });
    const findings = await sdkInitRule.check(input);
    expect(findings.length).toBe(1);
    expect(findings[0].severity).toBe('fatal');
  });

  it('tool-slug-matches-dir flags mismatch', async () => {
    const input = makeInput('correct-slug', {
      'src/server.ts': "settlegrid.init({ toolSlug: 'wrong-slug', pricing: { defaultCostCents: 1 } })",
    });
    const findings = await toolSlugMatchRule.check(input);
    expect(findings.length).toBe(1);
    expect(findings[0].message).toContain('wrong-slug');
    expect(findings[0].message).toContain('correct-slug');
  });

  it('pricing-default-cost flags zero cost', async () => {
    const input = makeInput('x', {
      'src/server.ts': 'settlegrid.init({ pricing: { defaultCostCents: 0 } })',
    });
    const findings = await pricingDefaultRule.check(input);
    expect(findings.length).toBe(1);
    expect(findings[0].severity).toBe('high');
  });

  it('wraps-at-least-one-handler flags zero sg.wrap calls', async () => {
    const input = makeInput('x', {
      'src/server.ts': "import { settlegrid } from '@settlegrid/mcp'\nconst sg = settlegrid.init({})\n",
    });
    const findings = await wrapHandlerRule.check(input);
    expect(findings.length).toBe(1);
    expect(findings[0].severity).toBe('fatal');
  });
});

// ---------------------------------------------------------------------------
// Content-depth rules
// ---------------------------------------------------------------------------

describe('content-depth rules', () => {
  it('server-line-count flags under-threshold code', async () => {
    const input = makeInput('x', { 'src/server.ts': 'const a = 1\n' });
    const findings = await serverLineCountRule.check(input);
    expect(findings.length).toBe(1);
    expect(findings[0].evidence?.data?.executableLines).toBe(1);
  });

  it('server-line-count strips block + line comments when counting', async () => {
    const code =
      `/**\n * big doc\n * block\n */\n// line\n// line2\n` +
      Array.from({ length: 30 }, (_, i) => `const x${i} = ${i};`).join('\n');
    const input = makeInput('x', { 'src/server.ts': code });
    const findings = await serverLineCountRule.check(input);
    expect(findings.length).toBe(0);
  });

  it('readme-substance flags a one-line README', async () => {
    const input = makeInput('x', { 'README.md': '# x\n' });
    const findings = await readmeSubstanceRule.check(input);
    expect(findings.length).toBe(1);
  });

  it('external-fetch-or-data passes when fetch() is present', async () => {
    const input = makeInput('x', {
      'src/server.ts': 'const r = await fetch("https://api.example.com");\n',
    });
    expect((await externalCallRule.check(input)).length).toBe(0);
  });

  it('external-fetch-or-data passes when enough reference-data entries exist', async () => {
    const lines = Array.from({ length: 15 }, (_, i) => `  '${i}': { v: ${i} },`);
    const input = makeInput('x', {
      'src/server.ts': `const DATA = {\n${lines.join('\n')}\n};\n`,
    });
    expect((await externalCallRule.check(input)).length).toBe(0);
  });

  it('input-validation-throws flags zero throws', async () => {
    const input = makeInput('x', { 'src/server.ts': 'const x = 1\n' });
    expect((await errorHandlingRule.check(input)).length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Metadata rules
// ---------------------------------------------------------------------------

describe('metadata rules', () => {
  function pkgInput(pkg: Record<string, unknown>): TemplateInput {
    return makeInput('x', { 'package.json': JSON.stringify(pkg) });
  }

  it('keywords-sufficient flags <3 keywords', async () => {
    expect((await keywordsRule.check(pkgInput({ keywords: ['a', 'b'] }))).length).toBe(1);
    expect((await keywordsRule.check(pkgInput({ keywords: ['a', 'b', 'c'] }))).length).toBe(0);
  });

  it('description-substance flags TBD', async () => {
    const findings = await descriptionRule.check(pkgInput({ description: 'TBD' }));
    // TBD is both short (<20) and boilerplate — rule returns the short-description
    // finding first and returns early.
    expect(findings.length).toBe(1);
  });

  it('description-substance flags "your description here"', async () => {
    const findings = await descriptionRule.check(
      pkgInput({ description: 'Your description here for this MCP server' }),
    );
    expect(findings.length).toBe(1);
    expect(findings[0].severity).toBe('medium');
  });

  it('license-field flags non-MIT license', async () => {
    expect(
      (await licenseFieldRule.check(pkgInput({ license: 'UNLICENSED' }))).length,
    ).toBe(1);
    expect((await licenseFieldRule.check(pkgInput({ license: 'MIT' }))).length).toBe(0);
  });

  it('repository-field flags missing url', async () => {
    expect((await repositoryFieldRule.check(pkgInput({}))).length).toBe(1);
  });

  it('repository-field flags non-github.com/settlegrid url', async () => {
    const findings = await repositoryFieldRule.check(
      pkgInput({ repository: { type: 'git', url: 'https://gitlab.com/other/repo' } }),
    );
    expect(findings.length).toBe(1);
  });

  it('pinned-deps flags * or latest', async () => {
    expect(
      (
        await pinnedDepsRule.check(
          pkgInput({ dependencies: { '@settlegrid/mcp': '*' } }),
        )
      ).length,
    ).toBe(1);
    expect(
      (
        await pinnedDepsRule.check(
          pkgInput({ dependencies: { '@settlegrid/mcp': 'latest' } }),
        )
      ).length,
    ).toBe(1);
    expect(
      (
        await pinnedDepsRule.check(
          pkgInput({ dependencies: { '@settlegrid/mcp': '^0.2.0' } }),
        )
      ).length,
    ).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Manifest rule
// ---------------------------------------------------------------------------

describe('manifest rule', () => {
  it('passes when template.json is absent (manifest is optional)', async () => {
    const input = makeInput('x', {});
    expect((await manifestValidRule.check(input)).length).toBe(0);
  });

  it('flags invalid JSON', async () => {
    const input = makeInput('x', { 'template.json': '{ not json' });
    const findings = await manifestValidRule.check(input);
    expect(findings.length).toBe(1);
    expect(findings[0].severity).toBe('high');
  });

  it('flags missing required field', async () => {
    const input = makeInput('x', { 'template.json': '{ "slug": "x" }' });
    expect((await manifestValidRule.check(input)).length).toBe(1);
  });

  it('flags slug/directory mismatch', async () => {
    const minValid = {
      slug: 'x',
      name: 'X',
      description: 'x',
      version: '1',
      category: 'data',
      tags: [],
      author: { name: 'X' },
      repo: { type: 'git', url: 'https://github.com/settlegrid/x' },
      runtime: 'node',
      languages: ['ts'],
      entry: 'src/server.ts',
      pricing: { model: 'per-call' },
    };
    const input = makeInput('other', { 'template.json': JSON.stringify(minValid) });
    const findings = await manifestValidRule.check(input);
    expect(findings.length).toBe(1);
    expect(findings[0].message).toContain('slug');
  });
});

// ---------------------------------------------------------------------------
// Originality — exercise with a synthetic corpus index
// ---------------------------------------------------------------------------

describe('originality rules', () => {
  it('duplicate-server finds sibling', async () => {
    const corpus: CorpusIndex = {
      sourceHashIndex: new Map([['h1', ['a', 'b', 'c']]]),
      readmeHashIndex: new Map(),
      canonicalSlugs: new Set(),
      totalTemplates: 3,
    };
    const input = makeInput('a', {}, { corpus, normalizedSourceHash: 'h1' });
    const findings = await duplicateServerRule.check(input);
    expect(findings.length).toBe(1);
    expect(findings[0].message).toContain('b');
    expect(findings[0].message).toContain('c');
  });

  it('duplicate-server does not flag unique hash', async () => {
    const corpus: CorpusIndex = {
      sourceHashIndex: new Map([['h-unique', ['only']]]),
      readmeHashIndex: new Map(),
      canonicalSlugs: new Set(),
      totalTemplates: 1,
    };
    const input = makeInput('only', {}, { corpus, normalizedSourceHash: 'h-unique' });
    expect((await duplicateServerRule.check(input)).length).toBe(0);
  });

  it('duplicate-readme works symmetrically', async () => {
    const corpus: CorpusIndex = {
      sourceHashIndex: new Map(),
      readmeHashIndex: new Map([['r1', ['a', 'b']]]),
      canonicalSlugs: new Set(),
      totalTemplates: 2,
    };
    const input = makeInput('a', {}, { corpus, normalizedReadmeHash: 'r1' });
    expect((await duplicateReadmeRule.check(input)).length).toBe(1);
  });

  it('normalizeSource strips slug + whitespace', () => {
    const a = normalizeSource(
      'const sg = settlegrid.init({ toolSlug: "alpha" })\n\n',
      'alpha',
    );
    const b = normalizeSource(
      'const sg = settlegrid.init({ toolSlug: "beta" })\n',
      'beta',
    );
    expect(a).toBe(b);
  });
});

// ---------------------------------------------------------------------------
// Executable TSC
// ---------------------------------------------------------------------------

describe('tsc-compile rule', () => {
  it('passes a syntactically clean baseline', async () => {
    const input = makeInput('example-tool', baselineGood().files);
    const findings = await tscCompileRule.check(input);
    expect(findings.length).toBe(0);
  });

  it('flags a Python-ternary leakage as tsc errors', async () => {
    const bad = baselineGood().files['src/server.ts'] +
      `\nconst names = {"A" if slug == "x" else "B"}\n`;
    const input = makeInput('example-tool', {
      ...baselineGood().files,
      'src/server.ts': bad,
    });
    const findings = await tscCompileRule.check(input);
    expect(findings.length).toBeGreaterThanOrEqual(1);
    expect(findings[0].severity).toBe('high');
    expect(findings[0].message).toContain('tsc failed');
  });

  it('tolerates missing server.ts (other rules own absence)', async () => {
    const input = makeInput('x', {});
    expect((await tscCompileRule.check(input)).length).toBe(0);
  });
});
