/**
 * Core generator for SettleGrid MCP server projects.
 *
 * Usage:
 *   import { gen } from './core.mjs'
 *   gen({ slug, title, desc, api, key, keywords, methods, serverTs })
 *
 * Each call creates a complete project directory under open-source-servers/.
 */

import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

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

// ── Generator ───────────────────────────────────────────────────────────────

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
 */
export function gen(s) {
  const dir = join(BASE, `settlegrid-${s.slug}`)
  mkdirSync(join(dir, 'src'), { recursive: true })

  // ── package.json ──
  writeFileSync(join(dir, 'package.json'), JSON.stringify({
    name: `settlegrid-${s.slug}`,
    version: '1.0.0',
    description: `MCP server for ${s.title} with SettleGrid billing. ${s.desc}`,
    type: 'module',
    scripts: { dev: 'tsx src/server.ts', build: 'tsc', start: 'node dist/server.js' },
    dependencies: { '@settlegrid/mcp': '^0.1.1' },
    devDependencies: { tsx: '^4.0.0', typescript: '^5.0.0' },
    keywords: ['settlegrid', 'mcp', 'ai', ...s.keywords],
    license: 'MIT',
    repository: { type: 'git', url: `https://github.com/settlegrid/settlegrid-${s.slug}` },
  }, null, 2) + '\n')

  // ── tsconfig.json ──
  writeFileSync(join(dir, 'tsconfig.json'), TSCONFIG)

  // ── .env.example ──
  let env = '# SettleGrid API key (required) — get yours at https://settlegrid.ai\nSETTLEGRID_API_KEY=sg_live_your_key_here\n'
  if (s.key) {
    env += `\n# ${s.api.name} API key${s.key.required ? ' (required)' : ' (optional)'} — ${s.key.url}\n${s.key.env}=${s.key.default || 'your_key_here'}\n`
  } else {
    env += `\n# No API key needed for ${s.api.name} — it's free and open\n`
  }
  writeFileSync(join(dir, '.env.example'), env)

  // ── .gitignore ──
  writeFileSync(join(dir, '.gitignore'), GITIGNORE)

  // ── Dockerfile ──
  writeFileSync(join(dir, 'Dockerfile'), DOCKERFILE)

  // ── vercel.json ──
  writeFileSync(join(dir, 'vercel.json'), VERCEL)

  // ── LICENSE ──
  writeFileSync(join(dir, 'LICENSE'), LICENSE)

  // ── README.md ──
  const costs = s.methods.map(m => m.cost)
  const minC = Math.min(...costs), maxC = Math.max(...costs)
  const costStr = minC === maxC ? `${minC}¢` : `${minC}-${maxC}¢`

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
  writeFileSync(join(dir, 'README.md'), r)

  // ── src/server.ts ──
  writeFileSync(join(dir, 'src', 'server.ts'), s.serverTs)

  console.log(`  ✓ settlegrid-${s.slug}`)
}
