/**
 * Shared generator for SettleGrid MCP server projects.
 *
 * Usage:
 *   import { generateServer } from './lib/generate.mjs'
 *   generateServer({ slug, name, description, ... })
 */

import { writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'

const OUT = '/Users/lex/settlegrid/open-source-servers'

export function generateServer({
  slug,
  name,
  description,
  keywords = [],
  upstream = {},
  auth = { type: 'none' },
  methods = [],
  serverTs,
}) {
  const dir = join(OUT, `settlegrid-${slug}`)
  mkdirSync(join(dir, 'src'), { recursive: true })

  // ── package.json ──────────────────────────────────────────────────────────
  writeFileSync(
    join(dir, 'package.json'),
    JSON.stringify(
      {
        name: `settlegrid-${slug}`,
        version: '1.0.0',
        description,
        type: 'module',
        scripts: {
          dev: 'tsx src/server.ts',
          build: 'tsc',
          start: 'node dist/server.js',
        },
        dependencies: { '@settlegrid/mcp': '^0.1.1' },
        devDependencies: { tsx: '^4.0.0', typescript: '^5.0.0' },
        keywords: ['settlegrid', 'mcp', 'ai', ...keywords],
        license: 'MIT',
        repository: {
          type: 'git',
          url: `https://github.com/settlegrid/settlegrid-${slug}`,
        },
      },
      null,
      2
    ) + '\n'
  )

  // ── tsconfig.json ─────────────────────────────────────────────────────────
  writeFileSync(
    join(dir, 'tsconfig.json'),
    JSON.stringify(
      {
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
      },
      null,
      2
    ) + '\n'
  )

  // ── .gitignore ────────────────────────────────────────────────────────────
  writeFileSync(join(dir, '.gitignore'), 'node_modules/\ndist/\n.env\n*.js\n*.d.ts\n*.js.map\n!src/\n')

  // ── LICENSE ───────────────────────────────────────────────────────────────
  writeFileSync(
    join(dir, 'LICENSE'),
    `MIT License

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
  )

  // ── Dockerfile ────────────────────────────────────────────────────────────
  writeFileSync(
    join(dir, 'Dockerfile'),
    `FROM node:20-alpine AS builder
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
  )

  // ── vercel.json ───────────────────────────────────────────────────────────
  writeFileSync(
    join(dir, 'vercel.json'),
    JSON.stringify(
      {
        builds: [{ src: 'dist/server.js', use: '@vercel/node' }],
        routes: [{ src: '/(.*)', dest: 'dist/server.js' }],
      },
      null,
      2
    ) + '\n'
  )

  // ── .env.example ──────────────────────────────────────────────────────────
  let envContent =
    '# SettleGrid API key (required) — get yours at https://settlegrid.ai\nSETTLEGRID_API_KEY=sg_live_your_key_here\n'
  if (auth.type !== 'none' && auth.keyEnvVar) {
    envContent += `\n# ${auth.keyDesc || (upstream.provider || name) + ' API key'}\n${auth.keyEnvVar}=your_key_here\n`
  }
  writeFileSync(join(dir, '.env.example'), envContent)

  // ── README.md ─────────────────────────────────────────────────────────────
  const methodsTable = methods
    .map((m) => {
      const params = m.params?.map((p) => p.name).join(', ') || ''
      return `| \`${m.name}(${params})\` | ${m.description} | ${m.costCents}¢ |`
    })
    .join('\n')

  const paramsSection = methods
    .map((m) => {
      if (!m.params?.length) return ''
      return (
        `### ${m.name}\n` +
        m.params
          .map(
            (p) =>
              `- \`${p.name}\` (${p.type}, ${p.required ? 'required' : 'optional'}) — ${p.description}`
          )
          .join('\n')
      )
    })
    .filter(Boolean)
    .join('\n\n')

  let envTable =
    '| Variable | Required | Description |\n|----------|----------|-------------|\n| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |\n'
  if (auth.type !== 'none' && auth.keyEnvVar) {
    envTable += `| \`${auth.keyEnvVar}\` | Yes | ${auth.keyDesc || (upstream.provider || name) + ' API key'} |\n`
  }

  const upstreamAuth =
    auth.type === 'none' ? 'None required' : upstream.auth || 'API key required'

  const readme = `# settlegrid-${slug}

${name} MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-${slug})

${description}

## Quick Start

\`\`\`bash
npm install
cp .env.example .env   # Add your SettleGrid API key${auth.keyEnvVar ? ' + ' + auth.keyEnvVar : ''}
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

- **Provider**: ${upstream.provider || name}
- **Base URL**: ${upstream.baseUrl || ''}
- **Auth**: ${upstreamAuth}
- **Rate Limits**: ${upstream.rateLimit || 'See provider docs'}
- **Docs**: ${upstream.docsUrl || ''}

## Deploy

### Docker

\`\`\`bash
docker build -t settlegrid-${slug} .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx${auth.keyEnvVar ? ' -e ' + auth.keyEnvVar + '=xxx' : ''} -p 3000:3000 settlegrid-${slug}
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
`
  writeFileSync(join(dir, 'README.md'), readme)

  // ── src/server.ts ─────────────────────────────────────────────────────────
  writeFileSync(join(dir, 'src', 'server.ts'), serverTs)

  console.log(`  ✓ settlegrid-${slug}`)
}
