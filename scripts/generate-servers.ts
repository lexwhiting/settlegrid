#!/usr/bin/env npx tsx
/**
 * SettleGrid Batch MCP Server Generator
 *
 * Reads a JSON manifest of APIs and generates complete MCP server projects
 * in open-source-servers/, enabling rapid scaling to 1,000+ repos.
 *
 * Usage:
 *   npx tsx scripts/generate-servers.ts scripts/api-manifest.json
 *   npx tsx scripts/generate-servers.ts scripts/api-manifest.json --category finance
 *   npx tsx scripts/generate-servers.ts scripts/api-manifest.json --limit 50
 *   npx tsx scripts/generate-servers.ts scripts/api-manifest.json --category ai --limit 10
 *   npx tsx scripts/generate-servers.ts scripts/api-manifest.json --dry-run
 */

import * as fs from 'node:fs'
import * as path from 'node:path'

// ─── Types ──────────────────────────────────────────────────────────────────

interface ManifestParam {
  name: string
  type: 'string' | 'number' | 'boolean' | 'string[]' | 'number[]'
  required: boolean
  description: string
  default?: string | number | boolean
  enum?: string[]
}

interface ManifestMethod {
  name: string
  description: string
  endpoint: string
  httpMethod: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  params: ManifestParam[]
  queryMapping?: Record<string, string>
  bodyMapping?: Record<string, string>
  pathMapping?: Record<string, string>
  headers?: Record<string, string>
  costCents: number
  responseFields?: string[]
  responseIsArray?: boolean
  responseArraySlice?: number
  responseRootKey?: string
}

interface ManifestAuth {
  type: 'none' | 'query' | 'header' | 'bearer'
  paramName?: string
  headerName?: string
  envVar?: string
  prefix?: string
  defaultValue?: string
}

interface ManifestEntry {
  name: string
  displayName: string
  description: string
  category: string
  baseUrl: string
  auth: ManifestAuth
  methods: ManifestMethod[]
  keywords: string[]
  freeApiKeyUrl?: string
  userAgent?: string
  rateLimit?: string
  docsUrl?: string
  notes?: string
}

// ─── CLI Arg Parsing ────────────────────────────────────────────────────────

function parseArgs(argv: string[]) {
  const args = argv.slice(2)
  let manifestPath = ''
  let category = ''
  let limit = 0
  let dryRun = false

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === '--category' && args[i + 1]) {
      category = args[++i].toLowerCase()
    } else if (arg === '--limit' && args[i + 1]) {
      limit = parseInt(args[++i], 10)
    } else if (arg === '--dry-run') {
      dryRun = true
    } else if (!arg.startsWith('--')) {
      manifestPath = arg
    }
  }

  if (!manifestPath) {
    console.error('Usage: npx tsx scripts/generate-servers.ts <manifest.json> [--category <cat>] [--limit <n>] [--dry-run]')
    process.exit(1)
  }

  return { manifestPath, category, limit, dryRun }
}

// ─── Code Generation Helpers ────────────────────────────────────────────────

function toCamelCase(str: string): string {
  return str.replace(/_([a-z])/g, (_, c) => c.toUpperCase())
}

function toPascalCase(str: string): string {
  const camel = toCamelCase(str)
  return camel.charAt(0).toUpperCase() + camel.slice(1)
}

function tsType(paramType: string): string {
  switch (paramType) {
    case 'string': return 'string'
    case 'number': return 'number'
    case 'boolean': return 'boolean'
    case 'string[]': return 'string[]'
    case 'number[]': return 'number[]'
    default: return 'string'
  }
}

function toolSlug(name: string): string {
  return name.replace(/^settlegrid-/, '')
}

function indentLines(text: string, indent: number): string {
  const pad = ' '.repeat(indent)
  return text.split('\n').map(line => line ? pad + line : line).join('\n')
}

// ─── File Generators ────────────────────────────────────────────────────────

function generatePackageJson(entry: ManifestEntry): string {
  const pkg = {
    name: entry.name,
    version: '1.0.0',
    description: `MCP server for ${entry.displayName} with SettleGrid billing. ${entry.description}`,
    type: 'module',
    scripts: {
      dev: 'tsx src/server.ts',
      build: 'tsc',
      start: 'node dist/server.js',
    },
    dependencies: {
      '@settlegrid/mcp': '^0.1.1',
    },
    devDependencies: {
      tsx: '^4.0.0',
      typescript: '^5.0.0',
    },
    keywords: ['settlegrid', 'mcp', 'ai', ...entry.keywords],
    license: 'MIT',
    repository: {
      type: 'git',
      url: `https://github.com/settlegrid/${entry.name}`,
    },
  }
  return JSON.stringify(pkg, null, 2) + '\n'
}

function generateTsConfig(): string {
  const config = {
    compilerOptions: {
      target: 'ES2022',
      module: 'ESNext',
      moduleResolution: 'bundler',
      outDir: 'dist',
      rootDir: 'src',
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
      forceConsistentCasingInFileNames: true,
      resolveJsonModule: true,
      declaration: true,
      declarationMap: true,
      sourceMap: true,
    },
    include: ['src/**/*'],
    exclude: ['node_modules', 'dist'],
  }
  return JSON.stringify(config, null, 2) + '\n'
}

function generateGitignore(): string {
  return `node_modules/
dist/
.env
*.js
*.d.ts
*.js.map
!src/
`
}

function generateDockerfile(): string {
  return `FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "dist/server.js"]
`
}

function generateVercelJson(): string {
  const config = {
    builds: [{ src: 'dist/server.js', use: '@vercel/node' }],
    routes: [{ src: '/(.*)', dest: 'dist/server.js' }],
  }
  return JSON.stringify(config, null, 2) + '\n'
}

function generateLicense(): string {
  return `MIT License

Copyright (c) 2026 SettleGrid

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
`
}

function generateEnvExample(entry: ManifestEntry): string {
  let lines = '# SettleGrid API key (required) — get yours at https://settlegrid.ai\n'
  lines += 'SETTLEGRID_API_KEY=sg_live_your_key_here\n'

  if (entry.auth.type !== 'none' && entry.auth.envVar) {
    lines += '\n'
    lines += `# ${entry.displayName} API key`
    if (entry.freeApiKeyUrl) {
      lines += ` — get one at ${entry.freeApiKeyUrl}`
    }
    lines += '\n'
    lines += `${entry.auth.envVar}=your_api_key_here\n`
  } else if (entry.auth.type === 'none') {
    lines += `\n# No API key needed for ${entry.displayName} — it's free\n`
  }

  return lines
}

function generateReadme(entry: ManifestEntry): string {
  const slug = toolSlug(entry.name)
  const costRange = (() => {
    const costs = entry.methods.map((m) => m.costCents)
    const min = Math.min(...costs)
    const max = Math.max(...costs)
    return min === max ? `${min}¢` : `${min}-${max}¢`
  })()

  let md = `# ${entry.name}\n\n`
  md += `${entry.displayName} MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).\n\n`
  md += `[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)\n`
  md += `[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)\n`
  md += `[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/${entry.name})\n\n`
  md += `${entry.description}\n\n`

  md += `## Quick Start\n\n`
  md += '```bash\n'
  md += `npm install\n`
  md += `cp .env.example .env   # Add your SettleGrid API key`
  if (entry.auth.type !== 'none' && entry.auth.envVar) {
    md += ` + ${entry.auth.envVar}`
  }
  md += '\n'
  md += `npm run dev\n`
  md += '```\n\n'

  md += `## Methods\n\n`
  md += `| Method | Description | Cost |\n`
  md += `|--------|-------------|------|\n`
  for (const m of entry.methods) {
    const paramList = m.params.filter(p => p.required).map(p => p.name).join(', ')
    md += `| \`${m.name}(${paramList})\` | ${m.description} | ${m.costCents}¢ |\n`
  }
  md += '\n'

  md += `## Parameters\n\n`
  for (const m of entry.methods) {
    md += `### ${m.name}\n`
    for (const p of m.params) {
      md += `- \`${p.name}\` (${p.type}${p.required ? ', required' : ', optional'}) — ${p.description}`
      if (p.default !== undefined) md += ` (default: ${JSON.stringify(p.default)})`
      md += '\n'
    }
    md += '\n'
  }

  md += `## Environment Variables\n\n`
  md += `| Variable | Required | Description |\n`
  md += `|----------|----------|-------------|\n`
  md += `| \`SETTLEGRID_API_KEY\` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |\n`
  if (entry.auth.type !== 'none' && entry.auth.envVar) {
    const required = entry.auth.defaultValue ? 'No' : 'Yes'
    const desc = entry.freeApiKeyUrl
      ? `${entry.displayName} API key from [${entry.freeApiKeyUrl}](${entry.freeApiKeyUrl})`
      : `${entry.displayName} API key`
    md += `| \`${entry.auth.envVar}\` | ${required} | ${desc} |\n`
  }
  md += '\n'

  if (entry.auth.type === 'none') {
    md += `No API key needed for the upstream ${entry.displayName} API.\n\n`
  }

  md += `## Upstream API\n\n`
  md += `- **Provider**: ${entry.displayName}\n`
  md += `- **Base URL**: ${entry.baseUrl}\n`
  md += `- **Auth**: ${entry.auth.type === 'none' ? 'None required' : `API key (${entry.auth.type})`}\n`
  if (entry.rateLimit) md += `- **Rate Limits**: ${entry.rateLimit}\n`
  if (entry.docsUrl) md += `- **Docs**: ${entry.docsUrl}\n`
  md += '\n'

  md += `## Deploy\n\n`
  md += `### Docker\n\n`
  md += '```bash\n'
  md += `docker build -t ${entry.name} .\n`
  md += `docker run -e SETTLEGRID_API_KEY=sg_live_xxx`
  if (entry.auth.type !== 'none' && entry.auth.envVar) {
    md += ` -e ${entry.auth.envVar}=xxx`
  }
  md += ` -p 3000:3000 ${entry.name}\n`
  md += '```\n\n'

  md += `### Vercel\n\n`
  md += `Click the "Deploy with Vercel" button above, or:\n\n`
  md += '```bash\n'
  md += `npm run build\nvercel --prod\n`
  md += '```\n\n'

  md += `## License\n\nMIT - see [LICENSE](LICENSE)\n\n`
  md += `---\n\nBuilt with [SettleGrid](https://settlegrid.ai) — The Settlement Layer for the AI Economy\n`

  return md
}

// ─── Server.ts Generation (the key part) ─────────────────────────────────────

function generateServerTs(entry: ManifestEntry): string {
  const slug = toolSlug(entry.name)
  const methodNames = entry.methods.map((m) => m.name)

  // Build the costs display string
  const costRange = (() => {
    const costs = entry.methods.map((m) => m.costCents)
    const min = Math.min(...costs)
    const max = Math.max(...costs)
    return min === max ? `${min}¢` : `${min}-${max}¢`
  })()

  let code = ''

  // ── File header
  code += `/**\n`
  code += ` * ${entry.name} — ${entry.displayName} MCP Server\n`
  code += ` *\n`
  code += ` * ${entry.description.includes('SettleGrid') ? entry.description : `Wraps the ${entry.displayName} API with SettleGrid billing.`}\n`
  if (entry.auth.type === 'none') {
    code += ` * No API key needed for the upstream service.\n`
  } else if (entry.auth.envVar) {
    code += ` * Requires ${entry.auth.envVar} environment variable.\n`
  }
  code += ` *\n`
  code += ` * Methods:\n`
  for (const m of entry.methods) {
    const params = m.params.filter(p => p.required).map(p => p.name).join(', ')
    const padded = `${m.name}(${params})`.padEnd(40)
    code += ` *   ${padded} (${m.costCents}¢)\n`
  }
  code += ` */\n\n`

  // ── Import
  code += `import { settlegrid } from '@settlegrid/mcp'\n\n`

  // ── Types: Input interfaces for each method
  code += `// ─── Types ──────────────────────────────────────────────────────────────────\n\n`
  for (const m of entry.methods) {
    const ifaceName = `${toPascalCase(m.name)}Input`
    code += `interface ${ifaceName} {\n`
    for (const p of m.params) {
      const optional = p.required ? '' : '?'
      code += `  ${p.name}${optional}: ${tsType(p.type)}\n`
    }
    code += `}\n\n`
  }

  // ── Helpers
  code += `// ─── Helpers ────────────────────────────────────────────────────────────────\n\n`
  code += `const API_BASE = '${entry.baseUrl}'\n`

  if (entry.userAgent) {
    code += `const USER_AGENT = '${entry.userAgent}'\n`
  } else {
    code += `const USER_AGENT = '${entry.name}/1.0 (contact@settlegrid.ai)'\n`
  }

  code += '\n'

  // Auth helper function
  if (entry.auth.type !== 'none' && entry.auth.envVar) {
    const fnName = `getApiKey`
    if (entry.auth.defaultValue) {
      code += `function ${fnName}(): string {\n`
      code += `  return process.env.${entry.auth.envVar} ?? '${entry.auth.defaultValue}'\n`
      code += `}\n\n`
    } else {
      code += `function ${fnName}(): string {\n`
      code += `  const key = process.env.${entry.auth.envVar}\n`
      code += `  if (!key) throw new Error('${entry.auth.envVar} environment variable is required')\n`
      code += `  return key\n`
      code += `}\n\n`
    }
  }

  // Generic fetch helper
  code += generateFetchHelper(entry)
  code += '\n'

  // ── SettleGrid Init
  code += `// ─── SettleGrid Init ────────────────────────────────────────────────────────\n\n`
  code += `const sg = settlegrid.init({\n`
  code += `  toolSlug: '${slug}',\n`
  code += `  pricing: {\n`
  code += `    defaultCostCents: 1,\n`
  code += `    methods: {\n`
  for (const m of entry.methods) {
    code += `      ${m.name}: { costCents: ${m.costCents}, displayName: '${m.description.slice(0, 50)}' },\n`
  }
  code += `    },\n`
  code += `  },\n`
  code += `})\n\n`

  // ── Handlers
  code += `// ─── Handlers ───────────────────────────────────────────────────────────────\n\n`
  for (const m of entry.methods) {
    code += generateMethodHandler(entry, m)
    code += '\n'
  }

  // ── Exports
  code += `// ─── Exports ────────────────────────────────────────────────────────────────\n\n`
  const exportNames = entry.methods.map((m) => toCamelCase(m.name))
  code += `export { ${exportNames.join(', ')} }\n\n`

  // ── Console ready message
  code += `console.log('${entry.name} MCP server ready')\n`
  code += `console.log('Methods: ${methodNames.join(', ')}')\n`
  code += `console.log('Pricing: ${costRange} per call | Powered by SettleGrid')\n`

  return code
}

function generateFetchHelper(entry: ManifestEntry): string {
  let code = ''
  const fetchFnName = 'apiFetch'

  code += `async function ${fetchFnName}<T>(path: string, options: {\n`
  code += `  method?: string\n`
  code += `  params?: Record<string, string>\n`
  code += `  body?: unknown\n`
  code += `  headers?: Record<string, string>\n`
  code += `} = {}): Promise<T> {\n`
  code += `  const url = new URL(path.startsWith('http') ? path : \`\${API_BASE}\${path}\`)\n`

  // Add query params
  code += `  if (options.params) {\n`
  code += `    for (const [k, v] of Object.entries(options.params)) {\n`
  code += `      url.searchParams.set(k, v)\n`
  code += `    }\n`
  code += `  }\n`

  // Auth: query param
  if (entry.auth.type === 'query' && entry.auth.paramName) {
    code += `  url.searchParams.set('${entry.auth.paramName}', getApiKey())\n`
  }

  // Build headers
  code += `  const headers: Record<string, string> = {\n`
  code += `    'User-Agent': USER_AGENT,\n`
  code += `    Accept: 'application/json',\n`

  if (entry.auth.type === 'header' && entry.auth.headerName) {
    const prefix = entry.auth.prefix ? `${entry.auth.prefix} ` : ''
    code += `    '${entry.auth.headerName}': \`${prefix}\${getApiKey()}\`,\n`
  } else if (entry.auth.type === 'bearer') {
    code += `    Authorization: \`Bearer \${getApiKey()}\`,\n`
  }

  code += `    ...options.headers,\n`
  code += `  }\n`

  // Body handling
  code += `  const fetchOpts: RequestInit = { method: options.method ?? 'GET', headers }\n`
  code += `  if (options.body) {\n`
  code += `    fetchOpts.body = JSON.stringify(options.body)\n`
  code += `    ;(headers as Record<string, string>)['Content-Type'] = 'application/json'\n`
  code += `  }\n\n`

  // Fetch + error handling
  code += `  const res = await fetch(url.toString(), fetchOpts)\n`
  code += `  if (!res.ok) {\n`
  code += `    const body = await res.text().catch(() => '')\n`
  code += `    throw new Error(\`${entry.displayName} API \${res.status}: \${body.slice(0, 200)}\`)\n`
  code += `  }\n`
  code += `  return res.json() as Promise<T>\n`
  code += `}\n`

  return code
}

function generateMethodHandler(entry: ManifestEntry, method: ManifestMethod): string {
  const camelName = toCamelCase(method.name)
  const ifaceName = `${toPascalCase(method.name)}Input`
  const requiredParams = method.params.filter(p => p.required)
  const optionalParams = method.params.filter(p => !p.required)

  let code = ''
  code += `const ${camelName} = sg.wrap(async (args: ${ifaceName}) => {\n`

  // Input validation for required params
  for (const p of requiredParams) {
    if (p.type === 'string') {
      code += `  if (!args.${p.name} || typeof args.${p.name} !== 'string') {\n`
      code += `    throw new Error('${p.name} is required (${p.description.toLowerCase()})')\n`
      code += `  }\n`
    } else if (p.type === 'number') {
      code += `  if (typeof args.${p.name} !== 'number' || isNaN(args.${p.name})) {\n`
      code += `    throw new Error('${p.name} must be a number')\n`
      code += `  }\n`
    } else if (p.type === 'string[]') {
      code += `  if (!Array.isArray(args.${p.name}) || args.${p.name}.length === 0) {\n`
      code += `    throw new Error('${p.name} must be a non-empty array')\n`
      code += `  }\n`
    }
  }

  // Build the endpoint URL
  let endpointExpr = `'${method.endpoint}'`
  if (method.pathMapping) {
    endpointExpr = '`' + method.endpoint.replace(/\{(\w+)\}/g, (_, key) => {
      const paramName = method.pathMapping![key] || key
      return '${encodeURIComponent(String(args.' + paramName + '))}'
    }) + '`'
  }

  // Build query params
  if (method.httpMethod === 'GET' || method.queryMapping) {
    code += `\n  const params: Record<string, string> = {}\n`
    if (method.queryMapping) {
      for (const [queryKey, paramName] of Object.entries(method.queryMapping)) {
        const param = method.params.find(p => p.name === paramName)
        if (param?.required) {
          if (param.type === 'number') {
            code += `  params['${queryKey}'] = String(args.${paramName})\n`
          } else {
            code += `  params['${queryKey}'] = args.${paramName}\n`
          }
        } else if (param) {
          code += `  if (args.${paramName} !== undefined) params['${queryKey}'] = String(args.${paramName})\n`
        }
      }
    } else {
      // Auto-map params as query params for GET requests
      for (const p of method.params) {
        if (p.required) {
          code += `  params['${p.name}'] = String(args.${p.name})\n`
        } else {
          code += `  if (args.${p.name} !== undefined) params['${p.name}'] = String(args.${p.name})\n`
        }
      }
    }
  }

  // Build the fetch call
  if (method.httpMethod === 'POST' && method.bodyMapping) {
    code += `\n  const body: Record<string, unknown> = {}\n`
    for (const [bodyKey, paramName] of Object.entries(method.bodyMapping)) {
      const param = method.params.find(p => p.name === paramName)
      if (param?.required) {
        code += `  body['${bodyKey}'] = args.${paramName}\n`
      } else {
        code += `  if (args.${paramName} !== undefined) body['${bodyKey}'] = args.${paramName}\n`
      }
    }
    code += `\n  const data = await apiFetch<Record<string, unknown>>(${endpointExpr}, {\n`
    code += `    method: '${method.httpMethod}',\n`
    if (method.queryMapping) {
      code += `    params,\n`
    }
    code += `    body,\n`
    if (method.headers) {
      code += `    headers: ${JSON.stringify(method.headers)},\n`
    }
    code += `  })\n`
  } else if (method.httpMethod === 'POST') {
    // POST with params as body
    code += `\n  const body: Record<string, unknown> = {}\n`
    for (const p of method.params) {
      if (p.required) {
        code += `  body['${p.name}'] = args.${p.name}\n`
      } else {
        code += `  if (args.${p.name} !== undefined) body['${p.name}'] = args.${p.name}\n`
      }
    }
    code += `\n  const data = await apiFetch<Record<string, unknown>>(${endpointExpr}, {\n`
    code += `    method: 'POST',\n`
    code += `    body,\n`
    if (method.headers) {
      code += `    headers: ${JSON.stringify(method.headers)},\n`
    }
    code += `  })\n`
  } else {
    // GET request
    code += `\n  const data = await apiFetch<Record<string, unknown>>(${endpointExpr}, {\n`
    code += `    params,\n`
    if (method.headers) {
      code += `    headers: ${JSON.stringify(method.headers)},\n`
    }
    code += `  })\n`
  }

  // Response extraction
  if (method.responseRootKey) {
    code += `\n  const results = (data as Record<string, unknown>)['${method.responseRootKey}']\n`
    if (method.responseIsArray && method.responseArraySlice) {
      code += `  const items = Array.isArray(results) ? results.slice(0, ${method.responseArraySlice}) : results\n`
      code += `\n  return { ${method.params.filter(p => p.required).map(p => p.name + ': args.' + p.name).join(', ')}${requiredParams.length > 0 ? ', ' : ''}results: items }\n`
    } else {
      code += `\n  return { ${method.params.filter(p => p.required).map(p => p.name + ': args.' + p.name).join(', ')}${requiredParams.length > 0 ? ', ' : ''}...results as Record<string, unknown> }\n`
    }
  } else if (method.responseIsArray) {
    const slice = method.responseArraySlice || 50
    code += `\n  const items = Array.isArray(data) ? data.slice(0, ${slice}) : [data]\n`
    code += `\n  return { ${method.params.filter(p => p.required).map(p => p.name + ': args.' + p.name).join(', ')}${requiredParams.length > 0 ? ', ' : ''}count: items.length, results: items }\n`
  } else {
    code += `\n  return data\n`
  }

  code += `}, { method: '${method.name}' })\n`

  return code
}

// ─── Main ───────────────────────────────────────────────────────────────────

function main() {
  const { manifestPath, category, limit, dryRun } = parseArgs(process.argv)

  // Resolve paths
  const resolvedManifest = path.resolve(manifestPath)
  const rootDir = path.resolve(path.dirname(resolvedManifest), '..')
  const outputDir = path.join(rootDir, 'open-source-servers')

  // Read manifest
  if (!fs.existsSync(resolvedManifest)) {
    console.error(`Manifest not found: ${resolvedManifest}`)
    process.exit(1)
  }

  const raw = fs.readFileSync(resolvedManifest, 'utf-8')
  let manifest: ManifestEntry[] = JSON.parse(raw)

  console.log(`Loaded ${manifest.length} API entries from manifest`)

  // Filter by category
  if (category) {
    manifest = manifest.filter((e) => e.category.toLowerCase() === category)
    console.log(`Filtered to ${manifest.length} entries in category "${category}"`)
  }

  // Apply limit
  if (limit > 0) {
    manifest = manifest.slice(0, limit)
    console.log(`Limited to ${manifest.length} entries`)
  }

  if (manifest.length === 0) {
    console.log('No entries to generate. Exiting.')
    process.exit(0)
  }

  // Ensure output directory
  fs.mkdirSync(outputDir, { recursive: true })

  let generated = 0
  let skipped = 0
  const errors: string[] = []

  for (const entry of manifest) {
    const serverDir = path.join(outputDir, entry.name)

    // Skip if already exists (don't overwrite existing hand-crafted servers)
    if (fs.existsSync(path.join(serverDir, 'src', 'server.ts'))) {
      console.log(`  SKIP  ${entry.name} (already exists)`)
      skipped++
      continue
    }

    if (dryRun) {
      console.log(`  DRY   ${entry.name} (${entry.category}) — ${entry.methods.length} methods`)
      generated++
      continue
    }

    try {
      // Create directories
      fs.mkdirSync(path.join(serverDir, 'src'), { recursive: true })

      // Write all files
      fs.writeFileSync(path.join(serverDir, 'package.json'), generatePackageJson(entry))
      fs.writeFileSync(path.join(serverDir, 'tsconfig.json'), generateTsConfig())
      fs.writeFileSync(path.join(serverDir, '.gitignore'), generateGitignore())
      fs.writeFileSync(path.join(serverDir, '.env.example'), generateEnvExample(entry))
      fs.writeFileSync(path.join(serverDir, 'Dockerfile'), generateDockerfile())
      fs.writeFileSync(path.join(serverDir, 'vercel.json'), generateVercelJson())
      fs.writeFileSync(path.join(serverDir, 'LICENSE'), generateLicense())
      fs.writeFileSync(path.join(serverDir, 'README.md'), generateReadme(entry))
      fs.writeFileSync(path.join(serverDir, 'src', 'server.ts'), generateServerTs(entry))

      console.log(`  OK    ${entry.name} (${entry.category}) — ${entry.methods.length} methods`)
      generated++
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`  FAIL  ${entry.name}: ${msg}`)
      errors.push(`${entry.name}: ${msg}`)
    }
  }

  console.log('\n─── Summary ─────────────────────────────────────────────')
  console.log(`Generated: ${generated}`)
  console.log(`Skipped:   ${skipped} (already exist)`)
  console.log(`Errors:    ${errors.length}`)
  if (errors.length > 0) {
    for (const e of errors) {
      console.log(`  - ${e}`)
    }
  }
  console.log(`Output:    ${outputDir}`)
}

main()
