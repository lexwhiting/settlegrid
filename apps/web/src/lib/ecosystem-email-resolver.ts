/**
 * Multi-Ecosystem Email Resolver
 *
 * Resolves creator emails from various AI tool ecosystems:
 * GitHub, npm, PyPI, HuggingFace, Apify, and others.
 *
 * Delegates to ecosystem-specific resolvers, falling back to GitHub
 * when a repository link is discovered in package metadata.
 */

import { logger } from '@/lib/logger'
import {
  resolveDeveloperEmail,
  isValidEmail,
} from '@/lib/developer-email-resolver'

// ─── Constants ──────────────────────────────────────────────────────────────

const FETCH_TIMEOUT_MS = 10_000
const USER_AGENT = 'SettleGrid-EcosystemResolver/1.0'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ResolvedCreator {
  email: string
  name: string | null
  username: string
  ecosystem: string
}

// ─── npm Types ──────────────────────────────────────────────────────────────

interface NpmAuthor {
  name?: string
  email?: string
}

interface NpmMaintainer {
  name?: string
  email?: string
}

interface NpmPackageMetadata {
  author?: NpmAuthor | string
  maintainers?: NpmMaintainer[]
  name?: string
}

// ─── PyPI Types ─────────────────────────────────────────────────────────────

interface PypiProjectUrls {
  Repository?: string
  Source?: string
  GitHub?: string
  Homepage?: string
  [key: string]: string | undefined
}

interface PypiPackageInfo {
  author?: string
  author_email?: string
  project_urls?: PypiProjectUrls | null
  name?: string
}

interface PypiPackageMetadata {
  info: PypiPackageInfo
}

// ─── Fetch helper ───────────────────────────────────────────────────────────

async function ecosystemFetch<T>(url: string): Promise<T | null> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

  try {
    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'User-Agent': USER_AGENT,
      },
    })

    if (!response.ok) {
      logger.warn('ecosystem_email_resolver.fetch_failed', {
        url: url.slice(0, 200),
        status: response.status,
      })
      return null
    }

    return (await response.json()) as T
  } catch (err) {
    const isTimeout = err instanceof Error && err.name === 'AbortError'
    logger.warn('ecosystem_email_resolver.fetch_error', {
      msg: isTimeout ? 'Request timed out' : 'Request failed',
      url: url.slice(0, 200),
      error: err instanceof Error ? err.message : String(err),
    })
    return null
  } finally {
    clearTimeout(timeout)
  }
}

// ─── URL Parsers ────────────────────────────────────────────────────────────

/**
 * Parse npm package name from URL.
 * e.g. `https://www.npmjs.com/package/@foo/bar` -> `@foo/bar`
 * e.g. `https://www.npmjs.com/package/express` -> `express`
 */
function parseNpmPackageName(url: string): string | null {
  try {
    const parsed = new URL(url)
    if (
      parsed.hostname !== 'www.npmjs.com' &&
      parsed.hostname !== 'npmjs.com'
    ) {
      return null
    }

    const match = parsed.pathname.match(/^\/package\/(@[^/]+\/[^/]+|[^/]+)/)
    if (!match) return null

    return decodeURIComponent(match[1])
  } catch {
    return null
  }
}

/**
 * Parse PyPI package name from URL.
 * e.g. `https://pypi.org/project/langchain/` -> `langchain`
 */
function parsePypiPackageName(url: string): string | null {
  try {
    const parsed = new URL(url)
    if (parsed.hostname !== 'pypi.org' && parsed.hostname !== 'www.pypi.org') {
      return null
    }

    const match = parsed.pathname.match(/^\/project\/([^/]+)/)
    if (!match) return null

    return decodeURIComponent(match[1])
  } catch {
    return null
  }
}

/**
 * Parse HuggingFace author/org from URL.
 * e.g. `https://huggingface.co/meta-llama/Llama-3` -> `meta-llama`
 */
function parseHuggingFaceAuthor(url: string): string | null {
  try {
    const parsed = new URL(url)
    if (
      parsed.hostname !== 'huggingface.co' &&
      parsed.hostname !== 'www.huggingface.co'
    ) {
      return null
    }

    const segments = parsed.pathname
      .split('/')
      .filter((s) => s.length > 0)
    if (segments.length === 0) return null

    // Skip known non-user path prefixes
    const nonUserPrefixes = new Set([
      'docs',
      'blog',
      'papers',
      'tasks',
      'spaces',
      'datasets',
      'models',
    ])
    const firstSegment = segments[0]
    if (nonUserPrefixes.has(firstSegment)) {
      // For paths like /models/meta-llama/..., the author is segment[1]
      if (
        (firstSegment === 'models' ||
          firstSegment === 'spaces' ||
          firstSegment === 'datasets') &&
        segments.length >= 2
      ) {
        return segments[1]
      }
      return null
    }

    return firstSegment
  } catch {
    return null
  }
}

/**
 * Parse Apify username from URL.
 * e.g. `https://apify.com/apify/web-scraper` -> `apify`
 */
function parseApifyUsername(url: string): string | null {
  try {
    const parsed = new URL(url)
    if (
      parsed.hostname !== 'apify.com' &&
      parsed.hostname !== 'www.apify.com'
    ) {
      return null
    }

    const segments = parsed.pathname
      .split('/')
      .filter((s) => s.length > 0)
    if (segments.length === 0) return null

    const nonUserPrefixes = new Set([
      'store',
      'docs',
      'blog',
      'pricing',
      'about',
      'academy',
    ])
    if (nonUserPrefixes.has(segments[0])) return null

    return segments[0]
  } catch {
    return null
  }
}

/**
 * Detect ecosystem from source URL when sourceEcosystem is not set.
 */
function detectEcosystemFromUrl(url: string): string | null {
  try {
    // Handle git+https:// and git+ssh:// URLs that contain github.com
    if (/^git\+/.test(url) && /github\.com/i.test(url)) {
      return 'github'
    }

    const parsed = new URL(url)
    const host = parsed.hostname.toLowerCase()

    if (host === 'github.com' || host === 'www.github.com') return 'github'
    if (host === 'npmjs.com' || host === 'www.npmjs.com') return 'npm'
    if (host === 'pypi.org' || host === 'www.pypi.org') return 'pypi'
    if (host === 'huggingface.co' || host === 'www.huggingface.co')
      return 'huggingface'
    if (host === 'apify.com' || host === 'www.apify.com') return 'apify'
    if (host === 'gitlab.com' || host === 'www.gitlab.com') return 'gitlab'

    return null
  } catch {
    // git+ssh:// URLs may fail to parse -- check for github.com pattern
    if (/github\.com/i.test(url)) return 'github'
    return null
  }
}

// ─── Ecosystem Resolvers ────────────────────────────────────────────────────

/**
 * Resolve email from npm registry metadata.
 * Checks author.email, then maintainers[0].email.
 */
async function resolveNpmAuthorEmail(
  sourceUrl: string
): Promise<ResolvedCreator | null> {
  const packageName = parseNpmPackageName(sourceUrl)
  if (!packageName) {
    logger.info('ecosystem_email_resolver.npm_invalid_url', {
      url: sourceUrl.slice(0, 200),
    })
    return null
  }

  const registryUrl = `https://registry.npmjs.org/${encodeURIComponent(packageName)}/latest`
  const metadata = await ecosystemFetch<NpmPackageMetadata>(registryUrl)
  if (!metadata) return null

  // Try author.email (author can be an object or a string like "Name <email>")
  if (metadata.author) {
    if (typeof metadata.author === 'object' && metadata.author.email) {
      if (isValidEmail(metadata.author.email)) {
        return {
          email: metadata.author.email,
          name: metadata.author.name ?? null,
          username: packageName,
          ecosystem: 'npm',
        }
      }
    } else if (typeof metadata.author === 'string') {
      // Parse "Name <email>" format
      const emailMatch = metadata.author.match(/<([^>]+)>/)
      if (emailMatch && isValidEmail(emailMatch[1])) {
        const nameMatch = metadata.author.match(/^([^<]+)/)
        return {
          email: emailMatch[1],
          name: nameMatch ? nameMatch[1].trim() : null,
          username: packageName,
          ecosystem: 'npm',
        }
      }
    }
  }

  // Fall back to first maintainer
  if (
    metadata.maintainers &&
    Array.isArray(metadata.maintainers) &&
    metadata.maintainers.length > 0
  ) {
    const maintainer = metadata.maintainers[0]
    if (maintainer.email && isValidEmail(maintainer.email)) {
      return {
        email: maintainer.email,
        name: maintainer.name ?? null,
        username: packageName,
        ecosystem: 'npm',
      }
    }
  }

  logger.info('ecosystem_email_resolver.npm_no_email', { packageName })
  return null
}

/**
 * Resolve email from PyPI package metadata.
 * Falls back to GitHub resolver if a repository URL is found.
 */
async function resolvePypiAuthorEmail(
  sourceUrl: string
): Promise<ResolvedCreator | null> {
  const packageName = parsePypiPackageName(sourceUrl)
  if (!packageName) {
    logger.info('ecosystem_email_resolver.pypi_invalid_url', {
      url: sourceUrl.slice(0, 200),
    })
    return null
  }

  const pypiUrl = `https://pypi.org/pypi/${encodeURIComponent(packageName)}/json`
  const metadata = await ecosystemFetch<PypiPackageMetadata>(pypiUrl)
  if (!metadata?.info) return null

  // Try author_email directly
  if (metadata.info.author_email) {
    // PyPI author_email can contain multiple emails separated by commas
    const emails = metadata.info.author_email.split(',').map((e) => e.trim())
    for (const rawEmail of emails) {
      // May include "Name <email>" format
      const emailMatch = rawEmail.match(/<([^>]+)>/)
      const email = emailMatch ? emailMatch[1] : rawEmail

      if (isValidEmail(email)) {
        return {
          email,
          name: metadata.info.author ?? null,
          username: packageName,
          ecosystem: 'pypi',
        }
      }
    }
  }

  // Fall back: check project_urls for a GitHub repository
  if (metadata.info.project_urls) {
    const repoUrl =
      metadata.info.project_urls.Repository ??
      metadata.info.project_urls.Source ??
      metadata.info.project_urls.GitHub ??
      metadata.info.project_urls.Homepage

    if (repoUrl && /github\.com/i.test(repoUrl)) {
      logger.info('ecosystem_email_resolver.pypi_fallback_github', {
        packageName,
        repoUrl: repoUrl.slice(0, 200),
      })

      const developer = await resolveDeveloperEmail(repoUrl)
      if (developer) {
        return {
          email: developer.email,
          name: developer.name,
          username: developer.githubUsername,
          ecosystem: 'pypi',
        }
      }
    }
  }

  logger.info('ecosystem_email_resolver.pypi_no_email', { packageName })
  return null
}

/**
 * Resolve email for HuggingFace authors.
 * No direct email API -- attempts to find a GitHub username from the
 * user's HuggingFace profile page, then delegates to GitHub resolver.
 *
 * Strategy order:
 * 1. User API (/api/users/{author}/overview) -- check for GitHub username field
 * 2. Org API (/api/organizations/{author}/overview) -- handles org accounts that 404 on user API
 * 3. Profile HTML scraping -- look for GitHub link in the profile page HTML
 */
async function resolveHuggingFaceEmail(
  sourceUrl: string
): Promise<ResolvedCreator | null> {
  const author = parseHuggingFaceAuthor(sourceUrl)
  if (!author) {
    logger.info('ecosystem_email_resolver.hf_invalid_url', {
      url: sourceUrl.slice(0, 200),
    })
    return null
  }

  // Strategy 1: Fetch the HuggingFace user API endpoint for GitHub link
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

  try {
    const response = await fetch(`https://huggingface.co/api/users/${encodeURIComponent(author)}/overview`, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'User-Agent': USER_AGENT,
      },
    })

    if (response.ok) {
      const data = (await response.json()) as Record<string, unknown>

      // Check for GitHub username in user data
      if (typeof data.github === 'string' && data.github.length > 0) {
        const githubUrl = `https://github.com/${data.github}`
        const developer = await resolveDeveloperEmail(githubUrl)
        if (developer) {
          return {
            email: developer.email,
            name: developer.name,
            username: author,
            ecosystem: 'huggingface',
          }
        }
      }
    }
  } catch (err) {
    const isAbort = err instanceof Error && err.name === 'AbortError'
    logger.warn('ecosystem_email_resolver.hf_fetch_error', {
      msg: isAbort ? 'Request timed out' : 'Request failed',
      author,
      error: err instanceof Error ? err.message : String(err),
    })
  } finally {
    clearTimeout(timeout)
  }

  // Strategy 2: Try org API (many HF accounts are organizations, not users)
  const orgResult = await resolveHuggingFaceOrg(author)
  if (orgResult) return orgResult

  // Strategy 3: Fallback to HTML profile page scraping
  return await resolveHuggingFaceFromProfile(author)
}

/**
 * Try resolving via HuggingFace organization API.
 * Many HF entities (sentence-transformers, google-bert, etc.) are orgs
 * that return 404 on the /api/users/ endpoint. The org profile page
 * may still contain a GitHub link.
 */
async function resolveHuggingFaceOrg(
  author: string
): Promise<ResolvedCreator | null> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

  try {
    const response = await fetch(
      `https://huggingface.co/api/organizations/${encodeURIComponent(author)}/overview`,
      {
        method: 'GET',
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          'User-Agent': USER_AGENT,
        },
      }
    )

    if (!response.ok) return null

    const data = (await response.json()) as Record<string, unknown>

    // Check for GitHub username in org data
    if (typeof data.github === 'string' && data.github.length > 0) {
      const githubUrl = `https://github.com/${data.github}`
      const developer = await resolveDeveloperEmail(githubUrl)
      if (developer) {
        return {
          email: developer.email,
          name: developer.name,
          username: author,
          ecosystem: 'huggingface',
        }
      }
    }

    return null
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}

/**
 * Attempt to extract a GitHub username from the HuggingFace profile HTML page.
 */
async function resolveHuggingFaceFromProfile(
  author: string
): Promise<ResolvedCreator | null> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

  try {
    const response = await fetch(`https://huggingface.co/${encodeURIComponent(author)}`, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'User-Agent': USER_AGENT,
      },
    })

    if (!response.ok) {
      logger.info('ecosystem_email_resolver.hf_profile_not_found', { author })
      return null
    }

    const html = await response.text()

    // Look for GitHub link in the profile page
    const githubMatch = html.match(
      /href="https?:\/\/github\.com\/([a-zA-Z0-9._-]+)"/
    )
    if (githubMatch) {
      const githubUsername = githubMatch[1]
      logger.info('ecosystem_email_resolver.hf_found_github', {
        author,
        githubUsername,
      })

      const developer = await resolveDeveloperEmail(
        `https://github.com/${githubUsername}`
      )
      if (developer) {
        return {
          email: developer.email,
          name: developer.name,
          username: author,
          ecosystem: 'huggingface',
        }
      }
    }
  } catch (err) {
    const isAbort = err instanceof Error && err.name === 'AbortError'
    logger.warn('ecosystem_email_resolver.hf_profile_error', {
      msg: isAbort ? 'Request timed out' : 'Request failed',
      author,
      error: err instanceof Error ? err.message : String(err),
    })
  } finally {
    clearTimeout(timeout)
  }

  logger.info('ecosystem_email_resolver.hf_no_email', { author })
  return null
}

/**
 * Apify actors are commercial tools -- no public email API.
 * Returns null and logs for manual outreach.
 */
function resolveApifyEmail(sourceUrl: string): ResolvedCreator | null {
  const username = parseApifyUsername(sourceUrl)

  logger.info('ecosystem_email_resolver.apify_manual_outreach', {
    username: username ?? 'unknown',
    url: sourceUrl.slice(0, 200),
    msg: 'Apify actors require manual outreach (no public email API)',
  })

  return null
}

/**
 * Resolve email via GitHub (delegates to existing developer-email-resolver).
 */
async function resolveGitHubEmail(
  sourceUrl: string
): Promise<ResolvedCreator | null> {
  const developer = await resolveDeveloperEmail(sourceUrl)
  if (!developer) return null

  return {
    email: developer.email,
    name: developer.name,
    username: developer.githubUsername,
    ecosystem: 'github',
  }
}

// ─── Website mailto: Scraper ─────────────────────────────────────────────────

/**
 * For direct website URLs (e.g. alpic.ai, aarna.ai), fetch the homepage HTML
 * and look for mailto: links or common contact email patterns.
 * This is the last-resort resolver for the "unknown/other" category.
 */
async function resolveWebsiteEmail(
  sourceUrl: string
): Promise<ResolvedCreator | null> {
  let hostname: string
  try {
    hostname = new URL(sourceUrl).hostname
  } catch {
    return null
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

  try {
    const response = await fetch(sourceUrl, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html',
      },
    })

    clearTimeout(timeout)
    if (!response.ok) return null

    const html = await response.text()

    // Strategy 1: Extract mailto: links (most reliable)
    const mailtoMatches = html.match(/mailto:([^\s"'<>?#]+)/gi)
    if (mailtoMatches) {
      for (const match of mailtoMatches) {
        const email = match.replace(/^mailto:/i, '').trim()
        if (isValidEmail(email)) {
          logger.info('ecosystem_email_resolver.website_mailto_found', {
            hostname,
            email: email.split('@')[0]?.slice(0, 3) + '***@' + email.split('@')[1],
          })
          return {
            email,
            name: null,
            username: hostname,
            ecosystem: 'website',
          }
        }
      }
    }

    // Strategy 2: Look for GitHub links in the website HTML
    const githubMatch = html.match(
      /href="(https?:\/\/github\.com\/[a-zA-Z0-9._-]+(?:\/[a-zA-Z0-9._-]+)?)"/
    )
    if (githubMatch) {
      const githubUrl = githubMatch[1]
      logger.info('ecosystem_email_resolver.website_github_found', {
        hostname,
        githubUrl: githubUrl.slice(0, 200),
      })
      const developer = await resolveDeveloperEmail(githubUrl)
      if (developer) {
        return {
          email: developer.email,
          name: developer.name,
          username: developer.githubUsername,
          ecosystem: 'website',
        }
      }
    }

    return null
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}

// ─── Public API ─────────────────────────────────────────────────────────────

// ─── Smithery → GitHub Cross-Reference ───────────────────────────────────────

/**
 * Cross-references a Smithery server URL with PulseMCP to find the GitHub source repo.
 * Smithery URLs like "smithery.ai/servers/foo" don't contain developer contact info,
 * but PulseMCP indexes the same servers and provides source_code_url (usually GitHub).
 */
async function resolveSmitheryToGitHub(smitheryUrl: string): Promise<string | null> {
  // Extract server name from URL: "https://smithery.ai/servers/agentmail" → "agentmail"
  // Also handle nested paths: "https://smithery.ai/servers/owner/server-name"
  const match = smitheryUrl.match(/smithery\.ai\/servers?\/(.+?)(?:\?|#|$)/)
  if (!match) return null
  const serverPath = match[1].replace(/\/+$/, '')

  // Strategy 1: Smithery API (returns homepage which is often GitHub)
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

    const res = await fetch(
      `https://registry.smithery.ai/servers/${encodeURIComponent(serverPath)}`,
      {
        signal: controller.signal,
        headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      }
    )

    clearTimeout(timeout)
    if (res.ok) {
      const data = (await res.json()) as Record<string, unknown>
      // Check connections for GitHub URLs
      if (Array.isArray(data.connections)) {
        for (const conn of data.connections) {
          const url = typeof (conn as Record<string, unknown>)?.url === 'string' ? (conn as Record<string, unknown>).url as string : ''
          if (url.includes('github.com')) {
            logger.info('ecosystem_email_resolver.smithery_api_github_found', { serverPath, githubUrl: url })
            return url
          }
        }
      }
    }
  } catch {
    // Continue to next strategy
  }

  // Strategy 2: Scrape the Smithery HTML page for GitHub links
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

    const res = await fetch(
      `https://smithery.ai/server/${encodeURIComponent(serverPath)}`,
      {
        signal: controller.signal,
        headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' },
      }
    )

    clearTimeout(timeout)
    if (res.ok) {
      const html = await res.text()
      // Look for GitHub repo links in the HTML
      const githubMatches = html.match(/https:\/\/github\.com\/[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+/g)
      if (githubMatches && githubMatches.length > 0) {
        // Filter out generic GitHub links (smithery's own, etc.)
        const repoUrl = githubMatches.find(url =>
          !url.includes('github.com/smithery') &&
          !url.includes('github.com/modelcontextprotocol') &&
          !url.includes('github.com/anthropics')
        ) ?? githubMatches[0]

        logger.info('ecosystem_email_resolver.smithery_html_github_found', { serverPath, githubUrl: repoUrl })
        return repoUrl
      }
    }
  } catch {
    // Continue to fallback
  }

  // Strategy 3: Try PulseMCP v0beta as last resort (being sunset but still partially works)
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

    const serverName = serverPath.split('/').pop() ?? serverPath
    const res = await fetch(
      `https://api.pulsemcp.com/v0beta/servers?query=${encodeURIComponent(serverName)}&count_per_page=5`,
      {
        signal: controller.signal,
        headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      }
    )

    clearTimeout(timeout)
    if (res.ok) {
      const data = (await res.json()) as { servers?: Array<{ name?: string; source_code_url?: string }> }
      if (Array.isArray(data.servers)) {
        for (const server of data.servers) {
          const name = typeof server.name === 'string' ? server.name.toLowerCase() : ''
          if (name.includes(serverName.toLowerCase()) || serverName.toLowerCase().includes(name)) {
            if (typeof server.source_code_url === 'string' && server.source_code_url.includes('github.com')) {
              logger.info('ecosystem_email_resolver.smithery_pulsemcp_found', { serverPath, githubUrl: server.source_code_url })
              return server.source_code_url
            }
          }
        }
      }
    }
  } catch {
    // All strategies exhausted
  }

  logger.info('ecosystem_email_resolver.smithery_no_github', { serverPath })
  return null
}

/**
 * Resolves the creator's email for any supported AI tool ecosystem.
 *
 * Strategy:
 * 1. Detect ecosystem from sourceEcosystem or URL
 * 2. Dispatch to ecosystem-specific resolver
 * 3. Return ResolvedCreator or null if no email found
 *
 * Supported ecosystems: github, npm, pypi, huggingface, apify, smithery
 * Smithery cross-references with PulseMCP to find GitHub repos.
 */
export async function resolveCreatorEmail(
  sourceUrl: string,
  ecosystem: string | null
): Promise<ResolvedCreator | null> {
  if (!sourceUrl || typeof sourceUrl !== 'string') {
    logger.info('ecosystem_email_resolver.no_source_url')
    return null
  }

  // Determine ecosystem: explicit value, or detect from URL
  const resolvedEcosystem =
    ecosystem ?? detectEcosystemFromUrl(sourceUrl) ?? 'unknown'

  logger.info('ecosystem_email_resolver.resolving', {
    ecosystem: resolvedEcosystem,
    url: sourceUrl.slice(0, 200),
  })

  try {
    switch (resolvedEcosystem) {
      case 'npm':
        return await resolveNpmAuthorEmail(sourceUrl)

      case 'pypi':
        return await resolvePypiAuthorEmail(sourceUrl)

      case 'huggingface':
      case 'replicate':
        return await resolveHuggingFaceEmail(sourceUrl)

      case 'apify':
        return resolveApifyEmail(sourceUrl)

      case 'github':
      case 'mcp-registry':
      case 'pulsemcp':
        return await resolveGitHubEmail(sourceUrl)

      case 'smithery': {
        // Smithery URLs (smithery.ai/servers/foo) don't contain GitHub info.
        // Cross-reference with PulseMCP to find the GitHub source_code_url.
        const githubUrl = await resolveSmitheryToGitHub(sourceUrl)
        if (githubUrl) {
          return await resolveGitHubEmail(githubUrl)
        }
        logger.info('ecosystem_email_resolver.smithery_no_github', { url: sourceUrl.slice(0, 200) })
        return null
      }

      default: {
        // Try GitHub resolution if the URL contains github.com
        // (handles git+ prefixed URLs and other non-standard formats)
        const detected = detectEcosystemFromUrl(sourceUrl)
        if (detected === 'github') {
          return await resolveGitHubEmail(sourceUrl)
        }

        // For direct website URLs (alpic.ai, aarna.ai, etc.),
        // try scraping the website for mailto: links or GitHub links
        if (sourceUrl.startsWith('http')) {
          const websiteResult = await resolveWebsiteEmail(sourceUrl)
          if (websiteResult) return websiteResult
        }

        logger.info('ecosystem_email_resolver.unsupported_ecosystem', {
          ecosystem: resolvedEcosystem,
          url: sourceUrl.slice(0, 200),
        })
        return null
      }
    }
  } catch (err) {
    logger.error(
      'ecosystem_email_resolver.resolver_error',
      { ecosystem: resolvedEcosystem, url: sourceUrl.slice(0, 200) },
      err
    )
    return null
  }
}
