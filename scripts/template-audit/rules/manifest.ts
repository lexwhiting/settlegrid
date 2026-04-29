/**
 * Manifest rule — if a template.json exists (CANONICAL_20 from P2.8 OR
 * anything Phase 3 Templater produces per P2.6 schema), validate it
 * against the schema exported from @settlegrid/mcp.
 *
 * template.json presence is a positive signal (KEEP hint) but not required.
 * A malformed template.json IS a failure since it breaks the gallery build.
 */

import type { Rule, RuleFinding, TemplateInput } from '../types.js';
import { baselineGood, baselineBad } from '../fixtures.js';

// Minimal shape validator — avoids pulling in the full @settlegrid/mcp package
// at audit-script eval time. The full Zod schema lives in
// packages/mcp/src/template-schema.ts; this is a light mirror.
interface MinimalManifest {
  slug: string;
  name: string;
  description: string;
  version: string;
  category: string;
  tags: string[];
  author: { name: string };
  repo: { type: string; url: string };
  runtime: string;
  languages: string[];
  entry: string;
  pricing: { model: string };
}

function validateManifest(raw: unknown): { ok: true; data: MinimalManifest } | { ok: false; reason: string } {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { ok: false, reason: 'manifest must be a JSON object' };
  }
  const m = raw as Record<string, unknown>;
  const required = [
    'slug',
    'name',
    'description',
    'version',
    'category',
    'tags',
    'author',
    'repo',
    'runtime',
    'languages',
    'entry',
    'pricing',
  ] as const;
  for (const k of required) {
    if (!(k in m)) return { ok: false, reason: `missing field: ${k}` };
  }
  if (typeof m.slug !== 'string' || !/^[a-z0-9][a-z0-9-]*$/.test(m.slug)) {
    return { ok: false, reason: `invalid slug: ${String(m.slug)}` };
  }
  if (!Array.isArray(m.tags)) return { ok: false, reason: 'tags must be array' };
  if (!Array.isArray(m.languages)) return { ok: false, reason: 'languages must be array' };
  const author = m.author as Record<string, unknown>;
  if (typeof author?.name !== 'string') return { ok: false, reason: 'author.name required' };
  const repo = m.repo as Record<string, unknown>;
  if (typeof repo?.url !== 'string' || !/^https?:\/\//i.test(repo.url)) {
    return { ok: false, reason: 'repo.url must be http(s) URL' };
  }
  if (typeof m.entry !== 'string' || m.entry.length === 0) {
    return { ok: false, reason: 'entry must be non-empty string' };
  }
  const pricing = m.pricing as Record<string, unknown>;
  if (typeof pricing?.model !== 'string') return { ok: false, reason: 'pricing.model required' };
  return {
    ok: true,
    data: {
      slug: m.slug,
      name: m.name as string,
      description: m.description as string,
      version: m.version as string,
      category: m.category as string,
      tags: m.tags as string[],
      author: { name: author.name },
      repo: { type: (repo.type as string) ?? 'git', url: repo.url },
      runtime: m.runtime as string,
      languages: m.languages as string[],
      entry: m.entry as string,
      pricing: { model: pricing.model },
    },
  };
}

const GOOD_MANIFEST = JSON.stringify({
  slug: 'example-tool',
  name: 'Example Tool',
  description: 'Example MCP tool template for audit fixture',
  version: '1.0.0',
  category: 'data',
  tags: ['example', 'test', 'audit'],
  author: { name: 'SettleGrid', url: 'https://settlegrid.ai' },
  repo: { type: 'git', url: 'https://github.com/settlegrid/settlegrid-example-tool' },
  runtime: 'node',
  languages: ['ts'],
  entry: 'src/server.ts',
  pricing: { model: 'per-call', perCallUsdCents: 1 },
  quality: { tests: false },
  capabilities: ['get_item', 'search_items'],
  featured: false,
});

export const manifestValidRule: Rule = {
  id: 'manifest:template-json-valid',
  description:
    'If template.json exists, it must validate against the P2.6 manifest schema.',
  severity: 'high',
  category: 'manifest',
  fixtures: {
    knownGood: baselineGood({ 'template.json': GOOD_MANIFEST }),
    knownBad: baselineBad(
      'template.json missing required fields',
      () => ({
        'template.json': JSON.stringify({ slug: 'broken' }),
      }),
    ),
  },
  async check(input: TemplateInput): Promise<RuleFinding[]> {
    const content = input.files.get('template.json');
    if (!content) return [];
    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch (err) {
      return [
        {
          ruleId: 'manifest:template-json-valid',
          severity: 'high',
          message: `template.json invalid JSON: ${(err as Error).message}`,
          evidence: { file: 'template.json' },
        },
      ];
    }
    const validation = validateManifest(parsed);
    if (!validation.ok) {
      return [
        {
          ruleId: 'manifest:template-json-valid',
          severity: 'high',
          message: `template.json validation failed: ${validation.reason}`,
          evidence: { file: 'template.json' },
        },
      ];
    }
    if (validation.data.slug !== input.slug) {
      return [
        {
          ruleId: 'manifest:template-json-valid',
          severity: 'medium',
          message: `template.json.slug "${validation.data.slug}" does not match directory slug "${input.slug}"`,
          evidence: { file: 'template.json' },
        },
      ];
    }
    return [];
  },
};

export const manifestRules: Rule[] = [manifestValidRule];
