/**
 * Pollution-detection rules — find template-generator leakage: unsubstituted
 * placeholders, cross-language ternaries, Jinja/Mustache/Python-string-format
 * fragments that escaped the generator into the emitted source.
 *
 * These are the highest-signal "this is a broken shell" detectors. The
 * settlegrid-hebrew-calendar case (line 57 of its server.ts) was the
 * canonical example:
 *
 *   const names = {"HEBREW_MONTHS" if slug == "hebrew-calendar"
 *                  else "ISLAMIC_MONTHS" ...}
 *
 * That's Python ternary syntax in a JSON-like literal inside a TS source,
 * produced by a generator prompt that emitted its own internal reasoning
 * as code. Any template carrying such leakage should be REMOVEd.
 */

import type { Rule, RuleFinding, TemplateInput } from '../types.js';
import { baselineGood, baselineBad } from '../fixtures.js';

// Unsubstituted {{TOKEN}} / {% token %} / %TOKEN% placeholders.
//
// We intentionally do NOT flag `${IDENT}` because that's legitimate TS
// template-literal interpolation (e.g. `${API_BASE}/path`). Distinguishing
// template-literal-interpolation from generator-leak requires full lexing
// or AST context; the false-positive rate from a naive $-pattern was
// ~100% on the real corpus (settlegrid-anthropic line 38 as a concrete
// example). The Mustache double-brace + Jinja + percent patterns are
// high-specificity generator-leak signals and are sufficient.
const TEMPLATE_PLACEHOLDER_PATTERNS = [
  { name: 'mustache-placeholder', pattern: /\{\{\s*[A-Z_][A-Z0-9_]*\s*\}\}/ },
  { name: 'jinja-block', pattern: /\{%\s*[a-zA-Z_][a-zA-Z0-9_]*[\s\S]{0,120}?%\}/ },
  { name: 'percent-placeholder', pattern: /%[A-Z_][A-Z0-9_]{4,}%/ },
];

// Python / non-JS / generator-reasoning fragments. These are patterns that
// compile-fail or at minimum indicate the generator emitted its own prompt
// logic rather than producing canonical TS.
const PYTHON_TERNARY_PATTERN =
  /["'`][^"'`\n]*["'`]\s+if\s+\w+\s*==\s*["'`][^"'`\n]*["'`]\s+else\s+["'`]/;
const PYTHON_DICT_WITH_RESERVED =
  /\{\s*["'][^"'\n]+["']\s+if\s+\w+\s*==\s*["'][^"'\n]+["']\s+else/;

// Obvious scaffold-marker strings that made it into production.
const SCAFFOLD_MARKER_PATTERN =
  /\b(TODO|FIXME|XXX|HACK|PLACEHOLDER|REPLACE[_-]?ME|YOUR[_-]?KEY[_-]?HERE)\b/;

// Comment-wrapped markers are permissible in limited doses; flag only when
// they appear outside comments on executable lines. Pragmatic heuristic:
// count total TODO/FIXME occurrences and flag if excessive.
const TODO_THRESHOLD = 3;

export const placeholderSurvivalRule: Rule = {
  id: 'pollution:placeholder-survival',
  description:
    'Template generator placeholders (Mustache/Jinja/env-style) must have been substituted.',
  severity: 'fatal',
  category: 'pollution',
  fixtures: {
    knownGood: baselineGood(),
    knownBad: baselineBad('{{TOOL_SLUG}} survived into server.ts', (f) => ({
      'src/server.ts': f['src/server.ts'].replace(
        "toolSlug: 'example-tool'",
        "toolSlug: '{{TOOL_SLUG}}'",
      ),
    })),
  },
  async check(input: TemplateInput): Promise<RuleFinding[]> {
    const findings: RuleFinding[] = [];
    const toScan: Array<[string, string]> = [];
    for (const [rel, content] of input.files) {
      if (rel.endsWith('.ts') || rel.endsWith('.md') || rel.endsWith('.json')) {
        toScan.push([rel, content]);
      }
    }
    for (const [rel, content] of toScan) {
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        for (const { name, pattern } of TEMPLATE_PLACEHOLDER_PATTERNS) {
          if (pattern.test(line)) {
            findings.push({
              ruleId: 'pollution:placeholder-survival',
              severity: 'fatal',
              message: `unsubstituted ${name} placeholder in ${rel}:${i + 1}`,
              evidence: { file: rel, line: i + 1, snippet: line.trim().slice(0, 200) },
            });
          }
        }
      }
    }
    return findings;
  },
};

export const pythonTernaryRule: Rule = {
  id: 'pollution:python-ternary',
  description:
    'Python-style "X if cond == Y else Z" ternary must not appear in TypeScript sources.',
  severity: 'fatal',
  category: 'pollution',
  fixtures: {
    knownGood: baselineGood(),
    knownBad: baselineBad(
      'Python ternary leaked from generator prompt (hebrew-calendar case)',
      (f) => ({
        'src/server.ts':
          f['src/server.ts'] +
          `\nconst names = {"HEBREW_MONTHS" if slug == "hebrew-calendar" else "ISLAMIC_MONTHS"}\n`,
      }),
    ),
  },
  async check(input: TemplateInput): Promise<RuleFinding[]> {
    const findings: RuleFinding[] = [];
    for (const [rel, content] of input.files) {
      if (!rel.endsWith('.ts')) continue;
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (PYTHON_TERNARY_PATTERN.test(line) || PYTHON_DICT_WITH_RESERVED.test(line)) {
          findings.push({
            ruleId: 'pollution:python-ternary',
            severity: 'fatal',
            message: `Python-style ternary in ${rel}:${i + 1}`,
            evidence: { file: rel, line: i + 1, snippet: line.trim().slice(0, 200) },
          });
        }
      }
    }
    return findings;
  },
};

export const scaffoldMarkerRule: Rule = {
  id: 'pollution:scaffold-markers',
  description: 'Excessive TODO/FIXME/PLACEHOLDER/YOUR_KEY_HERE scaffold markers.',
  severity: 'medium',
  category: 'pollution',
  fixtures: {
    knownGood: baselineGood(),
    knownBad: baselineBad('lots of TODO markers', (f) => ({
      'src/server.ts':
        f['src/server.ts'] +
        `\n// TODO: implement this\n// FIXME: broken\n// TODO: also this\n// PLACEHOLDER handler\n// YOUR_KEY_HERE\n`,
    })),
  },
  async check(input: TemplateInput): Promise<RuleFinding[]> {
    let totalMarkers = 0;
    const samples: Array<{ file: string; line: number; snippet: string }> = [];
    for (const [rel, content] of input.files) {
      if (!rel.endsWith('.ts') && !rel.endsWith('.md')) continue;
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (SCAFFOLD_MARKER_PATTERN.test(lines[i])) {
          totalMarkers++;
          if (samples.length < 3) {
            samples.push({
              file: rel,
              line: i + 1,
              snippet: lines[i].trim().slice(0, 160),
            });
          }
        }
      }
    }
    if (totalMarkers > TODO_THRESHOLD) {
      return [
        {
          ruleId: 'pollution:scaffold-markers',
          severity: 'medium',
          message: `${totalMarkers} scaffold markers (TODO/FIXME/PLACEHOLDER/YOUR_KEY_HERE) — threshold ${TODO_THRESHOLD}`,
          evidence: {
            file: samples[0]?.file,
            line: samples[0]?.line,
            snippet: samples[0]?.snippet,
            data: { count: totalMarkers, samples },
          },
        },
      ];
    }
    return [];
  },
};

export const pollutionRules: Rule[] = [
  placeholderSurvivalRule,
  pythonTernaryRule,
  scaffoldMarkerRule,
];
