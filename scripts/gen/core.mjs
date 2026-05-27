/**
 * Core generator for SettleGrid MCP server projects.
 *
 * Two entry points share a single file-building core via `buildFileMap(s)`:
 *
 *   - `gen(s)`              — writes the 10 files to disk under
 *                              open-source-servers/settlegrid-<slug>/.
 *                              Used by the historical scripts/gen/batch3*.mjs.
 *   - `generateFromSpec(s)` — returns the 10 files as a path→content map
 *                              without touching the filesystem. Used by the
 *                              Templater agent's quality-gate staging +
 *                              writeTemplates pipeline (settlegrid-agents).
 *
 * The 10 files emitted: package.json, tsconfig.json, .gitignore, Dockerfile,
 * vercel.json, LICENSE, .env.example, README.md, src/server.ts, AND
 * template.json (the gallery manifest). The manifest is built from the
 * structured spec + pricing extracted from the generated server.ts so the
 * value the gallery advertises is byte-identical to what the SDK meters.
 *
 * Usage:
 *   import { gen, generateFromSpec } from './core.mjs'
 *   gen({ slug, title, desc, api, key, keywords, methods, serverTs, category? })
 */

import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { mapCategory } from '../lib/templater-categories.mjs'

const BASE = '/Users/lex/settlegrid/open-source-servers'

// ── Static file contents ────────────────────────────────────────────────────

const TSCONFIG = JSON.stringify({
  compilerOptions: {
    target: 'ES2022', module: 'ESNext', moduleResolution: 'bundler',
    outDir: 'dist', rootDir: 'src', strict: true, esModuleInterop: true,
    skipLibCheck: true, forceConsistentCasingInFileNames: true,
    resolveJsonModule: true, declaration: true, declarationMap: true, sourceMap: true,
  },
  include: ['src/**/*'],
  exclude: ['node_modules', 'dist'],
}, null, 2) + '\n'

const GITIGNORE = 'node_modules/\ndist/\n.env\n*.js\n*.d.ts\n*.js.map\n!src/\n'

const DOCKERFILE =
  'FROM node:20-alpine AS builder\n' +
  'WORKDIR /app\n' +
  'COPY package.json package-lock.json* ./\n' +
  'RUN npm ci\n' +
  'COPY tsconfig.json ./\n' +
  'COPY src/ ./src/\n' +
  'RUN npm run build\n\n' +
  'FROM node:20-alpine\n' +
  'WORKDIR /app\n' +
  'COPY package.json package-lock.json* ./\n' +
  'RUN npm ci --omit=dev\n' +
  'COPY --from=builder /app/dist ./dist\n' +
  'ENV NODE_ENV=production\n' +
  'EXPOSE 3000\n' +
  'CMD ["node", "dist/server.js"]\n'

const VERCEL = JSON.stringify({
  builds: [{ src: 'dist/server.js', use: '@vercel/node' }],
  routes: [{ src: '/(.*)', dest: 'dist/server.js' }],
}, null, 2) + '\n'

const LICENSE =
  'MIT License\n\n' +
  'Copyright (c) 2026 Alerterra, LLC\n\n' +
  'Permission is hereby granted, free of charge, to any person obtaining a copy\n' +
  'of this software and associated documentation files (the "Software"), to deal\n' +
  'in the Software without restriction, including without limitation the rights\n' +
  'to use, copy, modify, merge, publish, distribute, sublicense, and/or sell\n' +
  'copies of the Software, and to permit persons to whom the Software is\n' +
  'furnished to do so, subject to the following conditions:\n\n' +
  'The above copyright notice and this permission notice shall be included in all\n' +
  'copies or substantial portions of the Software.\n\n' +
  'THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR\n' +
  'IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,\n' +
  'FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE\n' +
  'AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER\n' +
  'LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,\n' +
  'OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE\n' +
  'SOFTWARE.\n'

// ── Pricing extraction (server.ts → { defaultCostCents, methods }) ──────────
//
// Plain-JS port of `extractServerPricing` from
// `scripts/lib/template-pricing.ts`. The TS version remains the single
// source of truth for .ts consumers (backfill, sync-template-pricing,
// polish-canonical). `.mjs` cannot import `.ts`, so we duplicate the
// ~50-line brace-match + regex parser here. The companion .test on
// scripts/gen/core.test.ts pins behavior against the same fixtures the
// TS parser is tested against — drift between the two parsers will
// surface as a test failure.

/**
 * Given source code and the index of an opening `{`, return the index of
 * its matching `}`. Skips braces inside `'`/`"`/`` ` `` string literals
 * (and their escapes) so a brace inside a `displayName: '... } ...'`
 * cannot throw off depth counting. Returns -1 if unmatched.
 *
 * @param {string} src
 * @param {number} openIdx
 * @returns {number}
 */
function matchBrace(src, openIdx) {
  let depth = 0
  /** @type {string | null} */
  let quote = null
  for (let i = openIdx; i < src.length; i++) {
    const c = src[i]
    if (quote) {
      if (c === '\\') {
        i++ // skip the escaped char
        continue
      }
      if (c === quote) quote = null
      continue
    }
    if (c === "'" || c === '"' || c === '`') {
      quote = c
    } else if (c === '{') {
      depth++
    } else if (c === '}') {
      depth--
      if (depth === 0) return i
    }
  }
  return -1
}

/**
 * Slice out the brace-delimited object literal that follows `<key>:`,
 * braces included. Returns null when the key or a balanced object is
 * not found.
 *
 * @param {string} src
 * @param {string} key
 * @returns {string | null}
 */
function sliceObjectAfterKey(src, key) {
  const keyRe = new RegExp(`\\b${key}\\s*:\\s*\\{`)
  const m = keyRe.exec(src)
  if (!m) return null
  const openIdx = m.index + m[0].length - 1 // m[0] ends with '{'
  const closeIdx = matchBrace(src, openIdx)
  if (closeIdx === -1) return null
  return src.slice(openIdx, closeIdx + 1)
}

/**
 * Extract a single/double/backtick-quoted string field `<key>: '...'`
 * from `src`, returning its unescaped value or null when absent.
 *
 * @param {string} src
 * @param {string} key
 * @returns {string | null}
 */
function extractStringField(src, key) {
  const re = new RegExp(
    `\\b${key}\\s*:\\s*(['"\`])((?:\\\\.|(?!\\1)[\\s\\S])*)\\1`,
  )
  const m = re.exec(src)
  if (!m) return null
  return m[2].replace(/\\(.)/g, '$1')
}

/**
 * Extract `{ defaultCostCents, methods? }` from a template's server.ts
 * source. Mirrors `extractServerPricing` in scripts/lib/template-pricing.ts.
 *
 * @param {string} serverTs
 * @returns {{ defaultCostCents: number, methods?: Record<string, { costCents: number, displayName?: string, unitType?: string }> }}
 */
export function extractServerPricing(serverTs) {
  const pricingBlock = sliceObjectAfterKey(serverTs, 'pricing')
  if (!pricingBlock) return { defaultCostCents: 1 }

  const dcMatch = pricingBlock.match(/\bdefaultCostCents\s*:\s*(\d+)/)
  const defaultCostCents = dcMatch ? Number.parseInt(dcMatch[1], 10) : 1

  const methodsBlock = sliceObjectAfterKey(pricingBlock, 'methods')
  if (!methodsBlock) return { defaultCostCents }

  /** @type {Record<string, { costCents: number, displayName?: string, unitType?: string }>} */
  const methods = {}
  const body = methodsBlock.slice(1, -1)
  const entryRe = /([A-Za-z_$][\w$]*)\s*:\s*\{/g
  /** @type {RegExpExecArray | null} */
  let m
  while ((m = entryRe.exec(body)) !== null) {
    const name = m[1]
    const innerOpen = m.index + m[0].length - 1
    const innerClose = matchBrace(body, innerOpen)
    if (innerClose === -1) break
    const inner = body.slice(innerOpen, innerClose + 1)
    entryRe.lastIndex = innerClose + 1

    const costMatch = inner.match(/\bcostCents\s*:\s*(\d+)/)
    if (!costMatch) continue
    /** @type {{ costCents: number, displayName?: string, unitType?: string }} */
    const entry = { costCents: Number.parseInt(costMatch[1], 10) }
    const displayName = extractStringField(inner, 'displayName')
    if (displayName !== null) entry.displayName = displayName
    const unitType = extractStringField(inner, 'unitType')
    if (unitType !== null) entry.unitType = unitType
    methods[name] = entry
  }

  return Object.keys(methods).length > 0
    ? { defaultCostCents, methods }
    : { defaultCostCents }
}

// ── Manifest builder ────────────────────────────────────────────────────────

const TAG_BOILERPLATE = new Set(['settlegrid', 'mcp', 'ai'])
const MAX_TAGS = 10
const MAX_TAG_LEN = 30
const MAX_CAPABILITIES = 30

/**
 * Build a schema-valid `template.json` manifest object from a spec.
 *
 * Field sourcing — see packages/mcp/src/template-schema.ts for the schema
 * this must satisfy:
 *   - category    : mapCategory(s.category)  — fine-grained Templater
 *                                              slug → gallery enum, defaults
 *                                              to 'other'.
 *   - tags        : [s.category, ...keywords minus boilerplate], deduped,
 *                   each <=30 chars, capped at 10. Mirrors the assembly in
 *                   backfill-p3-2-manifests.ts#buildManifest.
 *   - capabilities: spec.methods.map(m => m.name) — snake_case method
 *                   names, capped at 30 (schema max).
 *   - pricing     : extracted from s.serverTs via extractServerPricing()
 *                   so the manifest is byte-identical to what the SDK
 *                   meters on. perCallUsdCents = defaultCostCents.
 *                   methods carried as the per-method price map.
 *
 * @param {object} s — see the type comment on gen() / generateFromSpec()
 * @returns {object} — manifest object (call JSON.stringify on it)
 */
export function generateManifest(s) {
  const { defaultCostCents, methods: serverMethods } = extractServerPricing(s.serverTs)

  // Tag assembly: prepend the Templater category slug when present, then
  // drop boilerplate keywords, dedupe, truncate to schema bounds, cap.
  const tagSeed = []
  if (typeof s.category === 'string' && s.category.length > 0) {
    tagSeed.push(s.category)
  }
  if (Array.isArray(s.keywords)) tagSeed.push(...s.keywords)
  /** @type {string[]} */
  const tags = []
  const seenTags = new Set()
  for (const raw of tagSeed) {
    if (typeof raw !== 'string') continue
    const t = raw.trim()
    if (t.length === 0 || t.length > MAX_TAG_LEN) continue
    if (TAG_BOILERPLATE.has(t)) continue
    if (seenTags.has(t)) continue
    seenTags.add(t)
    tags.push(t)
    if (tags.length >= MAX_TAGS) break
  }

  const capabilities = Array.isArray(s.methods)
    ? s.methods
        .map((m) => (m && typeof m.name === 'string' ? m.name : null))
        .filter((n) => typeof n === 'string')
        .slice(0, MAX_CAPABILITIES)
    : []

  // Build pricing.methods from the structured spec when extractServerPricing
  // didn't find one in the serverTs — preserves a useful methods map even
  // when the generated server.ts shape drifts from what the parser
  // recognises. Prefer the serverTs-extracted map when present so the
  // manifest matches the metered source exactly.
  /** @type {Record<string, { costCents: number, displayName?: string, unitType?: string }>} */
  let methods
  if (serverMethods && Object.keys(serverMethods).length > 0) {
    methods = serverMethods
  } else if (Array.isArray(s.methods)) {
    methods = {}
    for (const m of s.methods) {
      if (m && typeof m.name === 'string' && typeof m.cost === 'number') {
        methods[m.name] = { costCents: m.cost, displayName: m.display }
      }
    }
  } else {
    methods = {}
  }

  const perCallUsdCents = Number.isInteger(defaultCostCents) && defaultCostCents >= 0
    ? defaultCostCents
    : 1

  return {
    slug: s.slug,
    name: s.title,
    description: s.desc,
    version: '1.0.0',
    category: mapCategory(s.category),
    tags,
    author: {
      name: 'Alerterra, LLC',
      url: 'https://settlegrid.ai',
      github: 'settlegrid',
    },
    repo: {
      type: 'git',
      url: `https://github.com/settlegrid/settlegrid-${s.slug}`,
    },
    runtime: 'node',
    languages: ['ts'],
    entry: 'src/server.ts',
    pricing: {
      model: 'per-call',
      perCallUsdCents,
      ...(Object.keys(methods).length > 0 ? { methods } : {}),
    },
    quality: { tests: false },
    capabilities,
    featured: false,
  }
}

// ── Renderers (used by both gen and generateFromSpec) ───────────────────────

function renderPackageJson(s) {
  return JSON.stringify({
    name: `settlegrid-${s.slug}`,
    version: '1.0.0',
    description: `MCP server for ${s.title} with SettleGrid billing. ${s.desc}`,
    type: 'module',
    scripts: { dev: 'tsx src/server.ts', build: 'tsc', start: 'node dist/server.js' },
    dependencies: { '@settlegrid/mcp': '^0.2.0' },
    devDependencies: { tsx: '^4.0.0', typescript: '^5.0.0' },
    keywords: ['settlegrid', 'mcp', 'ai', ...s.keywords],
    license: 'MIT',
    repository: { type: 'git', url: `https://github.com/settlegrid/settlegrid-${s.slug}` },
  }, null, 2) + '\n'
}

function renderEnvExample(s) {
  let env = '# SettleGrid API key (required) — get yours at https://settlegrid.ai\nSETTLEGRID_API_KEY=sg_live_your_key_here\n'
  if (s.key) {
    env += `\n# ${s.api.name} API key${s.key.required ? ' (required)' : ' (optional)'} — ${s.key.url}\n${s.key.env}=${s.key.default || 'your_key_here'}\n`
  } else {
    env += `\n# No API key needed for ${s.api.name} — it's free and open\n`
  }
  return env
}

function renderReadme(s) {
  let r = `# settlegrid-${s.slug}\n\n`
  r += `${s.title} MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).\n\n`
  r += `[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)\n`
  r += `[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)\n`
  r += `[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-${s.slug})\n\n`
  r += `${s.desc}\n\n`
  r += `## Quick Start\n\n\`\`\`bash\nnpm install\ncp .env.example .env   # Add your SettleGrid API key\nnpm run dev\n\`\`\`\n\n`
  r += `## Methods\n\n| Method | Description | Cost |\n|--------|-------------|------|\n`
  for (const m of s.methods) r += `| \`${m.name}(${m.params})\` | ${m.display} | ${m.cost}¢ |\n`
  r += `\n## Parameters\n\n`
  for (const m of s.methods) {
    r += `### ${m.name}\n`
    for (const i of m.inputs) r += `- \`${i.name}\` (${i.type}${i.required ? ', required' : ''}) — ${i.desc}\n`
    r += '\n'
  }
  r += `## Environment Variables\n\n| Variable | Required | Description |\n|----------|----------|-------------|\n`
  r += `| \`SETTLEGRID_API_KEY\` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |\n`
  if (s.key) r += `| \`${s.key.env}\` | ${s.key.required ? 'Yes' : 'No'} | ${s.api.name} API key from [${s.key.url}](${s.key.url}) |\n`
  r += '\n'
  if (!s.key) r += `No API key needed for the upstream ${s.api.name} API — it is completely free.\n\n`
  r += `## Upstream API\n\n- **Provider**: ${s.api.name}\n- **Base URL**: ${s.api.base}\n- **Auth**: ${s.key ? 'API key required' : 'None required'}\n- **Docs**: ${s.api.docs}\n\n`
  r += `## Deploy\n\n### Docker\n\n\`\`\`bash\ndocker build -t settlegrid-${s.slug} .\ndocker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-${s.slug}\n\`\`\`\n\n`
  r += `### Vercel\n\nClick the "Deploy with Vercel" button above, or:\n\n\`\`\`bash\nnpm run build\nvercel --prod\n\`\`\`\n\n`
  r += `## License\n\nMIT - see [LICENSE](LICENSE)\n\n---\n\nBuilt with [SettleGrid](https://settlegrid.ai) — The Settlement Layer for the AI Economy\n`
  return r
}

// ── Shared file map builder ────────────────────────────────────────────────
//
// Single point of truth for what a generated template looks like on disk.
// Both `gen()` (writes to disk) and `generateFromSpec()` (returns the map)
// dispatch through this. The Templater scale-run picks up new keys
// (including `template.json`) automatically — its path-traversal guards
// pass any clean relative path. Adding entries here propagates everywhere
// without caller changes.

/**
 * @param {object} s
 * @returns {Record<string, string>}
 */
function buildFileMap(s) {
  /** @type {Record<string, string>} */
  const files = {
    'package.json': renderPackageJson(s),
    'tsconfig.json': TSCONFIG,
    '.gitignore': GITIGNORE,
    'Dockerfile': DOCKERFILE,
    'vercel.json': VERCEL,
    'LICENSE': LICENSE,
    '.env.example': renderEnvExample(s),
    'README.md': renderReadme(s),
    'src/server.ts': s.serverTs,
    'template.json': JSON.stringify(generateManifest(s), null, 2) + '\n',
  }
  return files
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * @param {object} s - Server specification
 * @param {string} s.slug        - Directory suffix (e.g. 'weather-gov')
 * @param {string} s.title       - Human title (e.g. 'NOAA/NWS Weather')
 * @param {string} s.desc        - One-line description
 * @param {{ base: string, name: string, docs: string }} s.api
 * @param {{ env: string, url: string, default?: string, required?: boolean }|null} s.key
 * @param {string[]} s.keywords
 * @param {{ name: string, display: string, cost: number, params: string,
 *           inputs: { name: string, type: string, required: boolean, desc: string }[]
 *        }[]} s.methods
 * @param {string} s.serverTs    - Full src/server.ts content
 * @param {string} [s.category]  - Optional Templater category slug (e.g. `rag`,
 *                                  `observability`). Mapped to a gallery-enum
 *                                  value for manifest.category and prepended as
 *                                  the first tag. Absent → defaults to 'other'.
 */
export function gen(s) {
  const dir = join(BASE, `settlegrid-${s.slug}`)
  mkdirSync(join(dir, 'src'), { recursive: true })

  const files = buildFileMap(s)
  for (const [rel, content] of Object.entries(files)) {
    const target = join(dir, rel)
    // Ensure intermediate dirs exist for nested keys (src/server.ts).
    mkdirSync(join(dir, rel.includes('/') ? rel.replace(/\/[^/]+$/, '') : '.'), { recursive: true })
    writeFileSync(target, content)
  }

  console.log(`  ✓ settlegrid-${s.slug}`)
}

/**
 * Generate template file contents from a spec without writing to disk.
 * Returns a Record<string, string> mapping relative file paths to contents.
 *
 * @param {object} s - Same spec shape as gen()
 * @returns {Record<string, string>}
 */
export function generateFromSpec(s) {
  return buildFileMap(s)
}
