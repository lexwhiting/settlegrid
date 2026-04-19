/**
 * Shared fixture builders for rules that need a baseline "well-formed"
 * template to extend. Per-rule fixtures start from `baselineGood()` and
 * either leave it unchanged (for rules where the baseline is already
 * good enough) or mutate specific fields to create a known-bad variant.
 */

import type { Fixture } from './types.js';

export const BASELINE_PACKAGE_JSON = JSON.stringify({
  name: 'settlegrid-example-tool',
  version: '1.0.0',
  description: 'MCP server for Example Tool with SettleGrid billing',
  type: 'module',
  scripts: {
    dev: 'tsx src/server.ts',
    build: 'tsc',
    start: 'node dist/server.js',
  },
  dependencies: {
    '@settlegrid/mcp': '^0.2.0',
  },
  devDependencies: {
    tsx: '^4.21.0',
    typescript: '^5.0.0',
  },
  keywords: ['settlegrid', 'mcp', 'ai', 'example-tool', 'api'],
  license: 'MIT',
  repository: {
    type: 'git',
    url: 'https://github.com/settlegrid/settlegrid-example-tool',
  },
});

export const BASELINE_SERVER_TS = `/**
 * settlegrid-example-tool — Example Tool MCP Server
 *
 * Wraps the Example Tool API with SettleGrid billing.
 * Requires EXAMPLE_API_KEY environment variable.
 *
 * Methods:
 *   get_item(id)           (1¢)
 *   search_items(query)    (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface GetItemInput { id: string }
interface SearchInput { query: string; limit?: number }

const BASE = 'https://api.example.com/v1'

function getKey(): string {
  const k = process.env.EXAMPLE_API_KEY
  if (!k) throw new Error('EXAMPLE_API_KEY environment variable is required')
  return k
}

async function exFetch<T>(path: string): Promise<T> {
  const res = await fetch(\`\${BASE}\${path}\`, {
    headers: {
      'User-Agent': 'settlegrid-example-tool/1.0 (contact@settlegrid.ai)',
      'Authorization': \`Bearer \${getKey()}\`,
    },
  })
  if (!res.ok) {
    throw new Error(\`Example API \${res.status}: \${await res.text().catch(() => '')}\`)
  }
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: 'example-tool',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_item: { costCents: 1, displayName: 'Get Item' },
      search_items: { costCents: 1, displayName: 'Search Items' },
    },
  },
})

const getItem = sg.wrap(async (args: GetItemInput) => {
  if (!args.id) throw new Error('id is required')
  return await exFetch<Record<string, unknown>>(\`/items/\${encodeURIComponent(args.id)}\`)
}, { method: 'get_item' })

const searchItems = sg.wrap(async (args: SearchInput) => {
  const q = args.query?.trim()
  if (!q) throw new Error('query is required')
  const limit = Math.min(args.limit || 10, 50)
  const data = await exFetch<{ items: Array<Record<string, unknown>> }>(
    \`/search?q=\${encodeURIComponent(q)}&limit=\${limit}\`,
  )
  return { query: q, count: data.items?.length ?? 0, items: data.items ?? [] }
}, { method: 'search_items' })

export { getItem, searchItems }

console.log('settlegrid-example-tool MCP server ready')
console.log('Methods: get_item, search_items')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
`;

export const BASELINE_README = `# settlegrid-example-tool

Wraps the Example Tool API with SettleGrid metered billing.

This MCP server is a reference template showing how a well-formed SettleGrid
tool looks end-to-end: typed input interfaces, explicit API key handling,
error surfaces, and pricing metadata.

## Prerequisites
- Node 20 or newer
- An Example Tool API key from https://example.com/developers (set \`EXAMPLE_API_KEY\`)
- A SettleGrid API key from https://settlegrid.ai (set \`SETTLEGRID_API_KEY\`)

## Installation
\`\`\`bash
git clone https://github.com/settlegrid/settlegrid-example-tool
cd settlegrid-example-tool
npm install
npm run dev
\`\`\`

## Methods
- \`get_item(id)\` — fetches a single item by id. Cost: 1¢ per call.
- \`search_items(query, limit?)\` — searches items; caller can cap limit. Cost: 1¢ per call.

## Pricing
All methods billed at 1¢ per successful call via SettleGrid. See the SettleGrid
docs at https://settlegrid.ai/docs for how metering works.

## Errors
Missing or empty inputs throw. Upstream API non-2xx responses throw with the
status code in the message.

## License
MIT — see LICENSE for full text.
`;

export const BASELINE_TSCONFIG = JSON.stringify({
  compilerOptions: {
    target: 'ES2022',
    module: 'ES2022',
    moduleResolution: 'bundler',
    strict: true,
    esModuleInterop: true,
    skipLibCheck: true,
    outDir: 'dist',
    rootDir: 'src',
  },
  include: ['src/**/*.ts'],
});

export const BASELINE_DOCKERFILE = `FROM node:20-slim
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY . .
RUN npm run build
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s CMD node -e "process.exit(0)"
CMD ["node", "dist/server.js"]
`;

export const BASELINE_VERCEL_JSON = JSON.stringify({
  $schema: 'https://openapi.vercel.sh/vercel.json',
  version: 2,
  builds: [{ src: 'src/server.ts', use: '@vercel/node' }],
});

export const BASELINE_LICENSE = `MIT License

Copyright (c) 2026 SettleGrid

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
`;

export function baselineFiles(): Record<string, string> {
  return {
    'package.json': BASELINE_PACKAGE_JSON,
    'src/server.ts': BASELINE_SERVER_TS,
    'README.md': BASELINE_README,
    'tsconfig.json': BASELINE_TSCONFIG,
    'Dockerfile': BASELINE_DOCKERFILE,
    'vercel.json': BASELINE_VERCEL_JSON,
    'LICENSE': BASELINE_LICENSE,
  };
}

export function baselineGood(overrides: Record<string, string> = {}): Fixture {
  return {
    description: 'well-formed template that should pass all rules',
    files: { ...baselineFiles(), ...overrides },
  };
}

/**
 * Build a known-bad fixture by starting from the baseline and applying
 * `mutate` to selectively break one or more files. If a mutator returns
 * `null`, the file is deleted.
 */
export function baselineBad(
  description: string,
  mutate: (files: Record<string, string>) => Record<string, string | null>,
  expected: { minFindings?: number; maxFindings?: number } = {},
): Fixture {
  const base = baselineFiles();
  const mutations = mutate(base);
  const out: Record<string, string> = { ...base };
  for (const [rel, content] of Object.entries(mutations)) {
    if (content === null) delete out[rel];
    else out[rel] = content;
  }
  return { description, files: out, ...expected };
}
