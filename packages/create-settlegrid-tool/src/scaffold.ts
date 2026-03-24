import fs from 'fs-extra'
import path from 'node:path'
import pc from 'picocolors'
import { fileURLToPath } from 'node:url'
import type { ToolConfig } from './types.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

function getTemplatesDir(): string {
  // In development (running from src/), templates is at ../templates
  // In production (running from dist/), templates is at ../templates
  const candidates = [
    path.resolve(__dirname, '..', 'templates'),
    path.resolve(__dirname, '..', '..', 'templates'),
  ]
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate
    }
  }
  return candidates[0]
}

function replacePlaceholders(content: string, config: ToolConfig): string {
  return content
    .replace(/\{\{TOOL_NAME\}\}/g, config.toolName)
    .replace(/\{\{TOOL_SLUG\}\}/g, config.toolSlug)
    .replace(/\{\{DESCRIPTION\}\}/g, config.description)
    .replace(/\{\{PRICE_CENTS\}\}/g, String(config.priceCents))
    .replace(/\{\{CATEGORY\}\}/g, config.category)
    .replace(/\{\{PRICING_MODEL\}\}/g, config.pricingModel)
}

async function copyTemplateDir(
  templateDir: string,
  targetDir: string,
  config: ToolConfig
): Promise<void> {
  const entries = await fs.readdir(templateDir, { withFileTypes: true })

  for (const entry of entries) {
    const srcPath = path.join(templateDir, entry.name)
    // Handle dotfile naming: _dotfile -> .dotfile
    const targetName = entry.name.startsWith('_dot_')
      ? '.' + entry.name.slice(5)
      : entry.name
    const destPath = path.join(targetDir, targetName)

    if (entry.isDirectory()) {
      await fs.ensureDir(destPath)
      await copyTemplateDir(srcPath, destPath, config)
    } else {
      const content = await fs.readFile(srcPath, 'utf-8')
      const processed = replacePlaceholders(content, config)
      await fs.writeFile(destPath, processed, 'utf-8')
      console.log(`  ${pc.green('+')} ${path.relative(config.targetDir, destPath)}`)
    }
  }
}

export async function scaffold(config: ToolConfig): Promise<void> {
  const templatesDir = getTemplatesDir()

  // Check if target directory already exists and is non-empty
  if (await fs.pathExists(config.targetDir)) {
    const files = await fs.readdir(config.targetDir)
    if (files.length > 0) {
      throw new Error(
        `Directory "${config.directory}" already exists and is not empty.`
      )
    }
  }

  await fs.ensureDir(config.targetDir)

  // Copy the selected template
  const templatePath = path.join(templatesDir, config.template)
  if (!(await fs.pathExists(templatePath))) {
    throw new Error(`Template "${config.template}" not found at ${templatePath}`)
  }

  await copyTemplateDir(templatePath, config.targetDir, config)

  // Add deploy-target-specific files
  if (config.deployTarget === 'vercel') {
    const vercelConfig = JSON.stringify(
      {
        buildCommand: 'npm run build',
        outputDirectory: 'dist',
      },
      null,
      2
    )
    await fs.writeFile(
      path.join(config.targetDir, 'vercel.json'),
      vercelConfig + '\n',
      'utf-8'
    )
    console.log(`  ${pc.green('+')} vercel.json`)
  }

  if (config.deployTarget === 'docker') {
    const dockerfile = `FROM node:20-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-slim
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
EXPOSE 3000
CMD ["node", "dist/server.js"]
`
    await fs.writeFile(
      path.join(config.targetDir, 'Dockerfile'),
      dockerfile,
      'utf-8'
    )
    console.log(`  ${pc.green('+')} Dockerfile`)

    const dockerignore = `node_modules
dist
.env
.git
`
    await fs.writeFile(
      path.join(config.targetDir, '.dockerignore'),
      dockerignore,
      'utf-8'
    )
    console.log(`  ${pc.green('+')} .dockerignore`)
  }

  if (config.deployTarget === 'railway') {
    const railwayToml = `[build]
builder = "nixpacks"

[deploy]
startCommand = "npm start"
`
    await fs.writeFile(
      path.join(config.targetDir, 'railway.toml'),
      railwayToml,
      'utf-8'
    )
    console.log(`  ${pc.green('+')} railway.toml`)
  }
}
