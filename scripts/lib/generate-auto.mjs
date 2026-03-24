/**
 * Auto-generator for SettleGrid MCP servers from compact specs.
 *
 * Usage:
 *   import { G, M } from './lib/generate-auto.mjs'
 *   G('slug', 'Name', 'Description', 'https://api.base.com',
 *     { q: 'apikey', e: 'ENV_VAR', d: 'Free key from...' },  // auth (q=query,h=header,b=bearer,n=none)
 *     { p: 'Provider', u: 'https://...', r: 'Rate limit', docs: 'https://...' }, // upstream
 *     ['keyword1', 'keyword2'],
 *     [
 *       M('method_name', 'Display Name', 2, 'Description',
 *         [{ s: 'query' }],                     // params: s=string, n=number, os=optional string, on=optional number
 *         '/search?q=${query}',                  // endpoint path
 *         { l: 'results', f: ['id', 'name'], m: 10 }  // response: l=list path, f=fields, m=max items
 *       ),
 *     ]
 *   )
 */

import { writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'

const OUT = '/Users/lex/settlegrid/open-source-servers'

// ── Helpers ─────────────────────────────────────────────────────────────────

function snakeToCamel(s) {
  return s.replace(/_([a-z])/g, (_, c) => c.toUpperCase())
}

function snakeToPascal(s) {
  const c = snakeToCamel(s)
  return c[0].toUpperCase() + c.slice(1)
}

// ── Method helper ───────────────────────────────────────────────────────────

export function M(name, displayName, costCents, description, params, path, res) {
  return { name, displayName, costCents, description, params: params || [], path, res: res || {} }
}

// ── Generate server.ts code ─────────────────────────────────────────────────

function buildServerTs(slug, name, desc, base, auth, methods) {
  const authType = auth.q ? 'query' : auth.h ? 'header' : auth.b ? 'bearer' : 'none'
  const envVar = auth.e || ''
  const keyParam = auth.q || auth.h || ''

  // ── Method doc lines
  const methodDocs = methods.map(m => {
    const pnames = m.params.map(p => Object.values(p)[0]).join(', ')
    const pad = Math.max(1, 28 - m.name.length - pnames.length)
    return ` *   ${m.name}(${pnames})${' '.repeat(pad)}— ${m.description}  (${m.costCents}¢)`
  }).join('\n')

  // ── Type interfaces
  const interfaces = methods.map(m => {
    const fields = m.params.map(p => {
      const key = Object.keys(p)[0]
      const pname = p[key]
      const ptype = key.startsWith('o') ? key.slice(1) : key
      const opt = key.startsWith('o') ? '?' : ''
      const tsType = ptype === 's' ? 'string' : 'number'
      return `  ${pname}${opt}: ${tsType}`
    }).join('\n')
    return `interface ${snakeToPascal(m.name)}Input {\n${fields}\n}`
  }).join('\n\n')

  // ── Helpers
  let helpers = `const BASE = '${base}'`
  if (authType !== 'none') {
    helpers += `\nconst API_KEY = process.env.${envVar} ?? ''`
  }

  let headerStr = `'User-Agent': 'settlegrid-${slug}/1.0'`
  if (authType === 'bearer') headerStr += `, Authorization: \`Bearer \${API_KEY}\``
  else if (authType === 'header') headerStr += `, '${keyParam}': API_KEY`

  helpers += `

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(\`\${BASE}\${path}\`, {
    headers: { ${headerStr} },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`${name} API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}`

  // ── SettleGrid init
  const methodPricing = methods.map(m =>
    `      ${m.name}: { costCents: ${m.costCents}, displayName: '${m.displayName}' },`
  ).join('\n')

  // ── Handlers
  const handlers = methods.map(m => {
    const camel = snakeToCamel(m.name)
    const pascal = snakeToPascal(m.name)

    // Validation
    const validations = m.params.map(p => {
      const key = Object.keys(p)[0]
      const pname = p[key]
      const required = !key.startsWith('o')
      const ptype = key.replace(/^o/, '')
      const tsType = ptype === 's' ? 'string' : 'number'

      if (tsType === 'string' && required) {
        return `  if (!args.${pname} || typeof args.${pname} !== 'string') throw new Error('${pname} is required')\n  const ${pname} = args.${pname}.trim()`
      } else if (tsType === 'string') {
        return `  const ${pname} = typeof args.${pname} === 'string' ? args.${pname}.trim() : ''`
      } else if (tsType === 'number' && required) {
        return `  if (typeof args.${pname} !== 'number') throw new Error('${pname} is required and must be a number')\n  const ${pname} = args.${pname}`
      } else {
        return `  const ${pname} = typeof args.${pname} === 'number' ? args.${pname} : 0`
      }
    }).join('\n')

    // Endpoint — interpolate params and add auth
    let endpoint = m.path
    // Encode string params in URL
    m.params.forEach(p => {
      const key = Object.keys(p)[0]
      const pname = p[key]
      const ptype = key.replace(/^o/, '')
      if (ptype === 's') {
        endpoint = endpoint.replace(
          new RegExp(`\\$\\{${pname}\\}`, 'g'),
          `\${encodeURIComponent(${pname})}`
        )
      } else {
        endpoint = endpoint.replace(
          new RegExp(`\\$\\{${pname}\\}`, 'g'),
          `\${${pname}}`
        )
      }
    })
    // Add query auth
    if (authType === 'query') {
      endpoint += (endpoint.includes('?') ? '&' : '?') + `${keyParam}=\${API_KEY}`
    }

    // Response mapping
    let responseCode
    const { l, f, m: maxItems } = m.res
    const fields = f || []
    if (l) {
      // List response
      const max = maxItems || 10
      const picks = fields.map(fld => `        ${fld}: item.${fld},`).join('\n')
      responseCode = `  const items = (data.${l} ?? []).slice(0, ${max})
  return {
    count: items.length,
    results: items.map((item: any) => ({
${picks}
    })),
  }`
    } else if (fields.length > 0) {
      // Object response — pick fields
      const picks = fields.map(fld => `    ${fld}: data.${fld},`).join('\n')
      responseCode = `  return {\n${picks}\n  }`
    } else {
      responseCode = '  return data'
    }

    return `const ${camel} = sg.wrap(async (args: ${pascal}Input) => {
${validations}
  const data = await apiFetch<any>(\`${endpoint}\`)
${responseCode}
}, { method: '${m.name}' })`
  }).join('\n\n')

  // ── Exports
  const exportNames = methods.map(m => snakeToCamel(m.name)).join(', ')
  const methodNamesList = methods.map(m => m.name).join(', ')
  const costs = [...new Set(methods.map(m => m.costCents))].sort((a, b) => a - b)
  const priceStr = costs.length === 1 ? `${costs[0]}¢` : `${costs[0]}-${costs[costs.length - 1]}¢`

  return `/**
 * settlegrid-${slug} — ${name} MCP Server
 *
 * ${desc}
 *
 * Methods:
${methodDocs}
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

${interfaces}

// ─── Helpers ────────────────────────────────────────────────────────────────

${helpers}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: '${slug}',
  pricing: {
    defaultCostCents: ${methods[0]?.costCents || 1},
    methods: {
${methodPricing}
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

${handlers}

// ─── Exports ────────────────────────────────────────────────────────────────

export { ${exportNames} }

console.log('settlegrid-${slug} MCP server ready')
console.log('Methods: ${methodNamesList}')
console.log('Pricing: ${priceStr} per call | Powered by SettleGrid')
`
}

// ── Boilerplate files (same as generate.mjs) ────────────────────────────────

function writeBoilerplate(dir, slug, description, keywords, auth, upstream) {
  const authType = auth.q ? 'query' : auth.h ? 'header' : auth.b ? 'bearer' : 'none'

  writeFileSync(join(dir, 'package.json'), JSON.stringify({
    name: `settlegrid-${slug}`, version: '1.0.0', description, type: 'module',
    scripts: { dev: 'tsx src/server.ts', build: 'tsc', start: 'node dist/server.js' },
    dependencies: { '@settlegrid/mcp': '^0.1.1' },
    devDependencies: { tsx: '^4.0.0', typescript: '^5.0.0' },
    keywords: ['settlegrid', 'mcp', 'ai', ...keywords],
    license: 'MIT',
    repository: { type: 'git', url: `https://github.com/settlegrid/settlegrid-${slug}` },
  }, null, 2) + '\n')

  writeFileSync(join(dir, 'tsconfig.json'), JSON.stringify({
    compilerOptions: {
      target: 'ES2022', module: 'ESNext', moduleResolution: 'bundler',
      outDir: 'dist', rootDir: 'src', strict: true, esModuleInterop: true,
      skipLibCheck: true, forceConsistentCasingInFileNames: true,
      resolveJsonModule: true, declaration: true, declarationMap: true, sourceMap: true,
    },
    include: ['src/**/*'], exclude: ['node_modules', 'dist'],
  }, null, 2) + '\n')

  writeFileSync(join(dir, '.gitignore'), 'node_modules/\ndist/\n.env\n*.js\n*.d.ts\n*.js.map\n!src/\n')

  writeFileSync(join(dir, 'LICENSE'), `MIT License

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
`)

  writeFileSync(join(dir, 'Dockerfile'), `FROM node:20-alpine AS builder
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
`)

  writeFileSync(join(dir, 'vercel.json'), JSON.stringify({
    builds: [{ src: 'dist/server.js', use: '@vercel/node' }],
    routes: [{ src: '/(.*)', dest: 'dist/server.js' }],
  }, null, 2) + '\n')

  let envContent = '# SettleGrid API key (required) — get yours at https://settlegrid.ai\nSETTLEGRID_API_KEY=sg_live_your_key_here\n'
  if (authType !== 'none' && auth.e) {
    envContent += `\n# ${auth.d || upstream.p + ' API key'}\n${auth.e}=your_key_here\n`
  }
  writeFileSync(join(dir, '.env.example'), envContent)
}

function writeReadme(dir, slug, name, description, keywords, auth, upstream, methods) {
  const authType = auth.q ? 'query' : auth.h ? 'header' : auth.b ? 'bearer' : 'none'
  const upstreamAuth = authType === 'none' ? 'None required' : (upstream.a || 'Free API key required')

  const methodsTable = methods.map(m => {
    const pnames = m.params.map(p => Object.values(p)[0]).join(', ')
    return `| \`${m.name}(${pnames})\` | ${m.description} | ${m.costCents}¢ |`
  }).join('\n')

  const paramsSection = methods.map(m => {
    if (!m.params.length) return ''
    return `### ${m.name}\n` + m.params.map(p => {
      const key = Object.keys(p)[0]
      const pname = p[key]
      const ptype = key.replace(/^o/, '') === 's' ? 'string' : 'number'
      const req = key.startsWith('o') ? 'optional' : 'required'
      return `- \`${pname}\` (${ptype}, ${req})`
    }).join('\n')
  }).filter(Boolean).join('\n\n')

  let envTable = '| Variable | Required | Description |\n|----------|----------|-------------|\n| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |\n'
  if (authType !== 'none' && auth.e) {
    envTable += `| \`${auth.e}\` | Yes | ${auth.d || upstream.p + ' API key'} |\n`
  }

  writeFileSync(join(dir, 'README.md'), `# settlegrid-${slug}

${name} MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-${slug})

${description}

## Quick Start

\`\`\`bash
npm install
cp .env.example .env   # Add your SettleGrid API key${auth.e ? ' + ' + auth.e : ''}
npm run dev
\`\`\`

## Methods

| Method | Description | Cost |
|--------|-------------|------|
${methodsTable}

## Parameters

${paramsSection}

## Environment Variables

${envTable}

## Upstream API

- **Provider**: ${upstream.p}
- **Base URL**: ${upstream.u || ''}
- **Auth**: ${upstreamAuth}
- **Rate Limits**: ${upstream.r || 'See provider docs'}
- **Docs**: ${upstream.docs || ''}

## Deploy

### Docker

\`\`\`bash
docker build -t settlegrid-${slug} .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx${auth.e ? ' -e ' + auth.e + '=xxx' : ''} -p 3000:3000 settlegrid-${slug}
\`\`\`

### Vercel

Click the "Deploy with Vercel" button above, or:

\`\`\`bash
npm run build
vercel --prod
\`\`\`

## License

MIT - see [LICENSE](LICENSE)

---

Built with [SettleGrid](https://settlegrid.ai) — The Settlement Layer for the AI Economy
`)
}

// ── Main export ─────────────────────────────────────────────────────────────

export function G(slug, name, description, base, auth, upstream, keywords, methods) {
  const dir = join(OUT, `settlegrid-${slug}`)
  mkdirSync(join(dir, 'src'), { recursive: true })

  writeBoilerplate(dir, slug, description, keywords, auth, upstream)
  writeReadme(dir, slug, name, description, keywords, auth, upstream, methods)

  const serverTs = buildServerTs(slug, name, description, base, auth, methods)
  writeFileSync(join(dir, 'src', 'server.ts'), serverTs)

  console.log(`  ✓ settlegrid-${slug}`)
}
