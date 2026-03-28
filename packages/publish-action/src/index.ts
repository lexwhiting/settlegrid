import * as core from '@actions/core'
import * as fs from 'fs'
import * as path from 'path'
import { validateConfig, SettleGridConfig } from './config'

/**
 * Payload sent to the SettleGrid publish API.
 * Maps from settlegrid.config.json fields to the API contract.
 */
interface PublishPayload {
  name: string
  slug: string
  description: string
  category: string
  version: string
  pricingConfig: SettleGridConfig['pricing']
  healthEndpoint?: string
  tags?: string[]
}

/**
 * Expected shape of a successful publish API response.
 */
interface PublishResponse {
  tool: {
    id: string
    slug: string
    name: string
    currentVersion: string
    status: string
  }
  storefrontUrl: string
}

async function run(): Promise<void> {
  try {
    // ── 1. Read inputs ──────────────────────────────────────────────────────

    const apiKey = core.getInput('api-key', { required: true })
    const configPath = core.getInput('config-path') || './settlegrid.config.json'
    const baseUrl = core.getInput('base-url') || 'https://settlegrid.ai'

    // Mask the API key so it never appears in logs
    core.setSecret(apiKey)

    // ── 2. Read and parse config ────────────────────────────────────────────

    const resolvedPath = path.resolve(configPath)
    core.info(`Reading config from ${resolvedPath}`)

    if (!fs.existsSync(resolvedPath)) {
      core.setFailed(
        `Config file not found at ${resolvedPath}. ` +
          'Create a settlegrid.config.json in your repo or set the config-path input.'
      )
      return
    }

    let rawConfig: unknown
    try {
      const content = fs.readFileSync(resolvedPath, 'utf-8')
      rawConfig = JSON.parse(content)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      core.setFailed(`Failed to parse ${resolvedPath}: ${message}`)
      return
    }

    // ── 3. Validate config ──────────────────────────────────────────────────

    const result = validateConfig(rawConfig)

    if (!result.valid) {
      const messages = result.errors.map((e) => `  - ${e.field}: ${e.message}`)
      core.setFailed(
        `Invalid settlegrid.config.json:\n${messages.join('\n')}`
      )
      return
    }

    const config = result.config
    core.info(`Publishing ${config.name} (${config.slug}) v${config.version}`)

    // ── 4. Build payload and call API ───────────────────────────────────────

    const payload: PublishPayload = {
      name: config.name,
      slug: config.slug,
      description: config.description,
      category: config.category,
      version: config.version,
      pricingConfig: config.pricing,
    }

    if (config.healthEndpoint) {
      payload.healthEndpoint = config.healthEndpoint
    }

    if (config.tags && config.tags.length > 0) {
      payload.tags = config.tags
    }

    const url = `${baseUrl.replace(/\/+$/, '')}/api/tools/publish`
    core.info(`PUT ${url}`)

    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify(payload),
    })

    // ── 5. Handle response ──────────────────────────────────────────────────

    const responseText = await response.text()
    let responseData: Record<string, unknown>

    try {
      responseData = JSON.parse(responseText) as Record<string, unknown>
    } catch {
      responseData = { raw: responseText }
    }

    if (response.status >= 500) {
      core.setFailed(
        `SettleGrid API unavailable (HTTP ${response.status}). Please try again later.`
      )
      return
    }

    if (response.status >= 400) {
      const errorMessage =
        typeof responseData.error === 'string'
          ? responseData.error
          : `HTTP ${response.status}: ${responseText.slice(0, 500)}`
      core.setFailed(`Publish failed: ${errorMessage}`)
      return
    }

    // Success (200 or 201)
    const data = responseData as unknown as PublishResponse
    const storefrontUrl =
      data.storefrontUrl || `${baseUrl}/tools/${config.slug}`

    core.info(`Published successfully!`)
    core.info(`  Tool: ${config.name}`)
    core.info(`  Slug: ${config.slug}`)
    core.info(`  Version: ${config.version}`)
    core.info(`  URL: ${storefrontUrl}`)

    // ── 6. Set outputs ──────────────────────────────────────────────────────

    core.setOutput('tool-url', storefrontUrl)
    core.setOutput('tool-slug', config.slug)
    core.setOutput('version', config.version)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    core.setFailed(`Unexpected error: ${message}`)
  }
}

run()
