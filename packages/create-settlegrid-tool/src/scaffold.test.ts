import { describe, it, expect, afterEach } from 'vitest'
import fs from 'fs-extra'
import path from 'node:path'
import os from 'node:os'
import { scaffold } from './scaffold.js'
import type { ToolConfig } from './types.js'

function makeConfig(overrides: Partial<ToolConfig> = {}): ToolConfig {
  const dir = `test-tool-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const targetDir = path.join(os.tmpdir(), dir)
  return {
    directory: dir,
    toolName: 'Test Tool',
    toolSlug: 'test-tool',
    description: 'A test tool',
    category: 'data',
    pricingModel: 'per-call',
    priceCents: 5,
    template: 'blank',
    deployTarget: 'none',
    targetDir,
    ...overrides,
  }
}

const cleanupDirs: string[] = []

afterEach(async () => {
  for (const dir of cleanupDirs) {
    await fs.remove(dir)
  }
  cleanupDirs.length = 0
})

describe('scaffold', () => {
  it('creates a blank template project', async () => {
    const config = makeConfig({ template: 'blank' })
    cleanupDirs.push(config.targetDir)

    await scaffold(config)

    // Check that essential files exist
    expect(await fs.pathExists(path.join(config.targetDir, 'package.json'))).toBe(true)
    expect(await fs.pathExists(path.join(config.targetDir, 'tsconfig.json'))).toBe(true)
    expect(await fs.pathExists(path.join(config.targetDir, 'src', 'server.ts'))).toBe(true)
    expect(await fs.pathExists(path.join(config.targetDir, 'README.md'))).toBe(true)
    expect(await fs.pathExists(path.join(config.targetDir, '.env.example'))).toBe(true)
    expect(await fs.pathExists(path.join(config.targetDir, '.gitignore'))).toBe(true)
  })

  it('replaces placeholders in generated files', async () => {
    const config = makeConfig({
      template: 'blank',
      toolName: 'Weather API',
      toolSlug: 'weather-api',
      description: 'Fetch weather data',
      priceCents: 3,
      category: 'data',
    })
    cleanupDirs.push(config.targetDir)

    await scaffold(config)

    const pkg = await fs.readJson(path.join(config.targetDir, 'package.json'))
    expect(pkg.name).toBe('weather-api')
    expect(pkg.description).toBe('Fetch weather data')

    const server = await fs.readFile(
      path.join(config.targetDir, 'src', 'server.ts'),
      'utf-8'
    )
    expect(server).toContain("toolSlug: 'weather-api'")
    expect(server).toContain('defaultCostCents: 3')
    expect(server).not.toContain('{{TOOL_SLUG}}')
    expect(server).not.toContain('{{PRICE_CENTS}}')

    const env = await fs.readFile(
      path.join(config.targetDir, '.env.example'),
      'utf-8'
    )
    expect(env).toContain('SETTLEGRID_TOOL_SLUG=weather-api')
  })

  it('creates a rest-api template project', async () => {
    const config = makeConfig({ template: 'rest-api' })
    cleanupDirs.push(config.targetDir)

    await scaffold(config)

    const pkg = await fs.readJson(path.join(config.targetDir, 'package.json'))
    expect(pkg.dependencies).toHaveProperty('express')

    const server = await fs.readFile(
      path.join(config.targetDir, 'src', 'server.ts'),
      'utf-8'
    )
    expect(server).toContain('express')
    expect(server).toContain('/health')
  })

  it('creates an openapi template project', async () => {
    const config = makeConfig({ template: 'openapi' })
    cleanupDirs.push(config.targetDir)

    await scaffold(config)

    const server = await fs.readFile(
      path.join(config.targetDir, 'src', 'server.ts'),
      'utf-8'
    )
    expect(server).toContain('UPSTREAM_URL')
    expect(server).toContain('express')
  })

  it('creates an mcp-server template project', async () => {
    const config = makeConfig({ template: 'mcp-server' })
    cleanupDirs.push(config.targetDir)

    await scaffold(config)

    const pkg = await fs.readJson(path.join(config.targetDir, 'package.json'))
    expect(pkg.dependencies).toHaveProperty('@modelcontextprotocol/sdk')
    expect(pkg.dependencies).toHaveProperty('zod')

    const server = await fs.readFile(
      path.join(config.targetDir, 'src', 'server.ts'),
      'utf-8'
    )
    expect(server).toContain('McpServer')
    expect(server).toContain('StdioServerTransport')
    expect(server).toContain('settlegrid')
  })

  it('adds vercel.json for vercel deploy target', async () => {
    const config = makeConfig({ deployTarget: 'vercel' })
    cleanupDirs.push(config.targetDir)

    await scaffold(config)

    expect(await fs.pathExists(path.join(config.targetDir, 'vercel.json'))).toBe(true)
    const vercel = await fs.readJson(path.join(config.targetDir, 'vercel.json'))
    expect(vercel.buildCommand).toBe('npm run build')
    expect(vercel.outputDirectory).toBe('dist')
  })

  it('adds Dockerfile for docker deploy target', async () => {
    const config = makeConfig({ deployTarget: 'docker' })
    cleanupDirs.push(config.targetDir)

    await scaffold(config)

    expect(await fs.pathExists(path.join(config.targetDir, 'Dockerfile'))).toBe(true)
    expect(await fs.pathExists(path.join(config.targetDir, '.dockerignore'))).toBe(true)

    const dockerfile = await fs.readFile(
      path.join(config.targetDir, 'Dockerfile'),
      'utf-8'
    )
    expect(dockerfile).toContain('FROM node:20-slim')
    expect(dockerfile).toContain('npm run build')
  })

  it('adds railway.toml for railway deploy target', async () => {
    const config = makeConfig({ deployTarget: 'railway' })
    cleanupDirs.push(config.targetDir)

    await scaffold(config)

    expect(await fs.pathExists(path.join(config.targetDir, 'railway.toml'))).toBe(true)
    const toml = await fs.readFile(
      path.join(config.targetDir, 'railway.toml'),
      'utf-8'
    )
    expect(toml).toContain('nixpacks')
    expect(toml).toContain('npm start')
  })

  it('does not add deploy files for none target', async () => {
    const config = makeConfig({ deployTarget: 'none' })
    cleanupDirs.push(config.targetDir)

    await scaffold(config)

    expect(await fs.pathExists(path.join(config.targetDir, 'vercel.json'))).toBe(false)
    expect(await fs.pathExists(path.join(config.targetDir, 'Dockerfile'))).toBe(false)
    expect(await fs.pathExists(path.join(config.targetDir, 'railway.toml'))).toBe(false)
  })

  it('throws if target directory is non-empty', async () => {
    const config = makeConfig()
    cleanupDirs.push(config.targetDir)

    await fs.ensureDir(config.targetDir)
    await fs.writeFile(path.join(config.targetDir, 'existing.txt'), 'data')

    await expect(scaffold(config)).rejects.toThrow('already exists and is not empty')
  })

  it('generates valid package.json with correct scripts', async () => {
    const config = makeConfig({ template: 'blank', toolSlug: 'my-cool-tool' })
    cleanupDirs.push(config.targetDir)

    await scaffold(config)

    const pkg = await fs.readJson(path.join(config.targetDir, 'package.json'))
    expect(pkg.scripts.dev).toBe('tsx src/server.ts')
    expect(pkg.scripts.build).toBe('tsc')
    expect(pkg.scripts.start).toBe('node dist/server.js')
    expect(pkg.type).toBe('module')
    expect(pkg.dependencies['@settlegrid/mcp']).toBe('^0.1.1')
  })

  it('generates README with tool name and pricing', async () => {
    const config = makeConfig({
      toolName: 'My Analytics',
      priceCents: 10,
    })
    cleanupDirs.push(config.targetDir)

    await scaffold(config)

    const readme = await fs.readFile(
      path.join(config.targetDir, 'README.md'),
      'utf-8'
    )
    expect(readme).toContain('My Analytics')
    expect(readme).toContain('10 cents per call')
    expect(readme).toContain('settlegrid.ai')
  })
})
