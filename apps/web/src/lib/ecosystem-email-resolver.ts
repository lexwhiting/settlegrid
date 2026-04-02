/**
 * Multi-Ecosystem Email Resolver
 *
 * Resolves creator emails from various AI tool ecosystems:
 * GitHub, npm, PyPI, HuggingFace, Apify, and others.
 *
 * Delegates to ecosystem-specific resolvers, falling back to GitHub
 * when a repository link is discovered in package metadata.
 *
 * Smithery resolution pipeline (in order):
 *   0. qualifiedName → GitHub repo (e.g. "upstash/context7-mcp" → github.com/upstash/context7-mcp)
 *   1. Smithery API connections[] for GitHub URLs
 *   2. Smithery HTML page scraping for GitHub links
 *   3. Official MCP Registry cross-reference for repository.url
 *   4. npm search by tool name for author/maintainer email
 *   5. GitHub Search API for repos matching tool name
 *   6. PulseMCP v0beta (sunset fallback)
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
  /** Internal: GitHub URL discovered during Smithery cross-referencing, for source_repo_url backfill */
  _discoveredGitHubUrl?: string
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

// ─── npm Search Types ──────────────────────────────────────────────────────

interface NpmSearchPublisher {
  email?: string
  username?: string
}

interface NpmSearchPackage {
  name: string
  publisher?: NpmSearchPublisher
  maintainers?: NpmMaintainer[]
  author?: NpmAuthor | string
}

interface NpmSearchObject {
  package: NpmSearchPackage
  searchScore?: number
}

interface NpmSearchResult {
  objects?: NpmSearchObject[]
}

// ─── MCP Registry Types ────────────────────────────────────────────────────

interface McpRegistryRepository {
  url?: string
  source?: string
}

interface McpRegistryServer {
  name?: string
  repository?: McpRegistryRepository
}

interface McpRegistryEntry {
  server: McpRegistryServer
}

interface McpRegistrySearchResult {
  servers?: McpRegistryEntry[]
}

// ─── GitHub Search Types ────────────────────────────────────────────────────

interface GitHubSearchRepoOwner {
  login: string
}

interface GitHubSearchRepoItem {
  full_name: string
  name: string
  owner: GitHubSearchRepoOwner
  html_url: string
}

interface GitHubSearchResult {
  total_count: number
  items?: GitHubSearchRepoItem[]
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
    if (host === 'smithery.ai' || host === 'www.smithery.ai' || host === 'registry.smithery.ai') return 'smithery'

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

/** GitHub-generic exclusion patterns for filtering out framework/docs repos */
const GITHUB_GENERIC_OWNERS = new Set([
  'smithery',
  'smithery-ai',
  'modelcontextprotocol',
  'anthropics',
  'anthropic',
])

/**
 * Cross-references a Smithery server URL with multiple sources to find the GitHub repo.
 * Smithery URLs like "smithery.ai/servers/foo" don't contain developer contact info.
 *
 * Strategy order (most reliable first):
 *   0. qualifiedName → GitHub (e.g. "upstash/context7-mcp" → github.com/upstash/context7-mcp)
 *   1. Smithery registry API connections[] for GitHub URLs
 *   2. Smithery HTML page scraping for GitHub links
 *   3. Official MCP Registry cross-reference for repository.url
 *   4. GitHub Search API for repos matching tool name
 *   5. PulseMCP v0beta (sunset fallback, ~10% failure rate)
 */
async function resolveSmitheryToGitHub(smitheryUrl: string): Promise<string | null> {
  // Extract server path from URL: "https://smithery.ai/servers/upstash/context7-mcp" → "upstash/context7-mcp"
  const match = smitheryUrl.match(/smithery\.ai\/servers?\/(.+?)(?:\?|#|$)/)
  if (!match) return null
  const serverPath = match[1].replace(/\/+$/, '')

  // Strategy 0: qualifiedName → GitHub repo
  // Many Smithery qualifiedNames are "{githubOwner}/{repoName}" (81 of 97 pending).
  // Try GitHub API HEAD request to verify the repo exists.
  if (serverPath.includes('/')) {
    const [owner, repo] = serverPath.split('/')
    if (owner && repo) {
      const githubUrl = `https://github.com/${owner}/${repo}`
      const verified = await verifyGitHubRepo(owner, repo)
      if (verified) {
        logger.info('ecosystem_email_resolver.smithery_qualifiedname_github', {
          serverPath,
          githubUrl,
        })
        return githubUrl
      }

      // The owner might be the GitHub user but repo name differs slightly.
      // Try the owner's GitHub profile — if it exists, it's a valid lead.
      const ownerExists = await verifyGitHubUser(owner)
      if (ownerExists) {
        // Search the owner's repos for a matching name
        const repoUrl = await searchOwnerRepos(owner, repo)
        if (repoUrl) {
          logger.info('ecosystem_email_resolver.smithery_owner_repo_search', {
            serverPath,
            githubUrl: repoUrl,
          })
          return repoUrl
        }
      }
    }
  }

  // Strategy 1: Smithery registry API (connections may contain GitHub URLs)
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
          const url =
            typeof (conn as Record<string, unknown>)?.url === 'string'
              ? ((conn as Record<string, unknown>).url as string)
              : ''
          if (url.includes('github.com')) {
            logger.info('ecosystem_email_resolver.smithery_api_github_found', {
              serverPath,
              githubUrl: url,
            })
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
      const githubMatches = html.match(
        /https:\/\/github\.com\/[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+/g
      )
      if (githubMatches && githubMatches.length > 0) {
        const repoUrl =
          githubMatches.find(
            (url) =>
              !GITHUB_GENERIC_OWNERS.has(
                url.split('/')[3]?.toLowerCase() ?? ''
              )
          ) ?? githubMatches[0]

        logger.info('ecosystem_email_resolver.smithery_html_github_found', {
          serverPath,
          githubUrl: repoUrl,
        })
        return repoUrl
      }
    }
  } catch {
    // Continue to fallback
  }

  // Strategy 3: Official MCP Registry cross-reference
  const serverName = serverPath.split('/').pop() ?? serverPath
  const mcpRegistryUrl = await resolveViaMcpRegistry(serverName)
  if (mcpRegistryUrl) {
    logger.info('ecosystem_email_resolver.smithery_mcp_registry_found', {
      serverPath,
      githubUrl: mcpRegistryUrl,
    })
    return mcpRegistryUrl
  }

  // Strategy 4: GitHub Search API for repos matching tool name
  const githubSearchUrl = await resolveViaGitHubSearch(serverName)
  if (githubSearchUrl) {
    logger.info('ecosystem_email_resolver.smithery_github_search_found', {
      serverPath,
      githubUrl: githubSearchUrl,
    })
    return githubSearchUrl
  }

  // Strategy 5: PulseMCP v0beta as last resort (being sunset, ~10% failures)
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

    const res = await fetch(
      `https://api.pulsemcp.com/v0beta/servers?query=${encodeURIComponent(serverName)}&count_per_page=5`,
      {
        signal: controller.signal,
        headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      }
    )

    clearTimeout(timeout)
    if (res.ok) {
      const data = (await res.json()) as {
        servers?: Array<{ name?: string; source_code_url?: string }>
      }
      if (Array.isArray(data.servers)) {
        for (const server of data.servers) {
          const name =
            typeof server.name === 'string' ? server.name.toLowerCase() : ''
          if (
            name.includes(serverName.toLowerCase()) ||
            serverName.toLowerCase().includes(name)
          ) {
            if (
              typeof server.source_code_url === 'string' &&
              server.source_code_url.includes('github.com')
            ) {
              logger.info('ecosystem_email_resolver.smithery_pulsemcp_found', {
                serverPath,
                githubUrl: server.source_code_url,
              })
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

// ─── GitHub Verification Helpers ─────────────────────────────────────────────

/**
 * Verify that a GitHub repo exists using a HEAD request (minimal API cost).
 * Returns true if the repo exists (200 or 301 redirect).
 */
async function verifyGitHubRepo(owner: string, repo: string): Promise<boolean> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

  try {
    const res = await fetch(
      `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`,
      {
        method: 'HEAD',
        signal: controller.signal,
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'application/vnd.github+json',
        },
      }
    )
    clearTimeout(timeout)
    // 200 = exists, 301 = moved/renamed (still valid)
    return res.status === 200 || res.status === 301
  } catch {
    return false
  } finally {
    clearTimeout(timeout)
  }
}

/**
 * Verify that a GitHub user/org exists.
 */
async function verifyGitHubUser(username: string): Promise<boolean> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

  try {
    const res = await fetch(
      `https://api.github.com/users/${encodeURIComponent(username)}`,
      {
        method: 'HEAD',
        signal: controller.signal,
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'application/vnd.github+json',
        },
      }
    )
    clearTimeout(timeout)
    return res.status === 200
  } catch {
    return false
  } finally {
    clearTimeout(timeout)
  }
}

/**
 * Search a GitHub user/org's repos for a name matching the tool.
 * Handles cases where the repo name slightly differs from the Smithery qualifiedName.
 */
async function searchOwnerRepos(
  owner: string,
  toolName: string
): Promise<string | null> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

  try {
    const res = await fetch(
      `https://api.github.com/search/repositories?q=user:${encodeURIComponent(owner)}+${encodeURIComponent(toolName)}+in:name&per_page=5`,
      {
        signal: controller.signal,
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'application/vnd.github+json',
        },
      }
    )
    clearTimeout(timeout)
    if (!res.ok) return null

    const data = (await res.json()) as GitHubSearchResult
    if (!data.items || data.items.length === 0) return null

    // Prefer exact name match, then closest partial match
    const exactMatch = data.items.find(
      (item) => item.name.toLowerCase() === toolName.toLowerCase()
    )
    if (exactMatch) return exactMatch.html_url

    // Accept first result if the name contains the tool name
    const partialMatch = data.items.find((item) =>
      item.name.toLowerCase().includes(toolName.toLowerCase())
    )
    if (partialMatch) return partialMatch.html_url

    return null
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}

// ─── Cross-Ecosystem Resolvers ──────────────────────────────────────────────

/**
 * Search the Official MCP Registry for a tool by name and extract its repository URL.
 * The registry indexes MCP servers from multiple sources and often provides GitHub URLs.
 */
async function resolveViaMcpRegistry(
  toolName: string
): Promise<string | null> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

  try {
    const res = await fetch(
      `https://registry.modelcontextprotocol.io/v0.1/servers?search=${encodeURIComponent(toolName)}`,
      {
        signal: controller.signal,
        headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      }
    )
    clearTimeout(timeout)
    if (!res.ok) return null

    const data = (await res.json()) as McpRegistrySearchResult
    if (!Array.isArray(data.servers) || data.servers.length === 0) return null

    // Find the best matching server with a GitHub repository URL
    const toolNameLower = toolName.toLowerCase()
    for (const entry of data.servers) {
      const serverName = entry.server.name?.toLowerCase() ?? ''
      // Check if the server name contains our tool name (or vice versa)
      if (
        serverName.includes(toolNameLower) ||
        toolNameLower.includes(serverName.split('/').pop() ?? '')
      ) {
        const repoUrl = entry.server.repository?.url
        if (
          typeof repoUrl === 'string' &&
          repoUrl.includes('github.com')
        ) {
          return repoUrl
        }
      }
    }

    // Fallback: return first result with a GitHub repo URL
    for (const entry of data.servers) {
      const repoUrl = entry.server.repository?.url
      if (typeof repoUrl === 'string' && repoUrl.includes('github.com')) {
        // Only use if the name is reasonably close
        const serverNameParts = (entry.server.name ?? '').split('/')
        const lastPart = serverNameParts[serverNameParts.length - 1]?.toLowerCase() ?? ''
        if (
          lastPart.includes(toolNameLower) ||
          toolNameLower.includes(lastPart)
        ) {
          return repoUrl
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
 * Search npm for a tool by name and extract author/maintainer email.
 * Handles scoped packages (@org/name) and unscoped packages.
 * Returns a ResolvedCreator directly (no GitHub intermediary needed).
 */
async function resolveViaNpmSearch(
  toolName: string
): Promise<ResolvedCreator | null> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

  try {
    const res = await fetch(
      `https://registry.npmjs.org/-/v1/search?text=${encodeURIComponent(toolName)}&size=5`,
      {
        signal: controller.signal,
        headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      }
    )
    clearTimeout(timeout)
    if (!res.ok) return null

    const data = (await res.json()) as NpmSearchResult
    if (!Array.isArray(data.objects) || data.objects.length === 0) return null

    const toolNameLower = toolName.toLowerCase()

    for (const obj of data.objects) {
      const pkg = obj.package
      const pkgNameLower = pkg.name.toLowerCase()

      // Only consider packages whose name contains the tool name (or vice versa)
      const pkgBaseName = pkgNameLower.includes('/')
        ? pkgNameLower.split('/').pop() ?? pkgNameLower
        : pkgNameLower
      if (
        !pkgBaseName.includes(toolNameLower) &&
        !toolNameLower.includes(pkgBaseName)
      ) {
        continue
      }

      // Try publisher.email (most reliable — current owner)
      if (pkg.publisher?.email && isValidEmail(pkg.publisher.email)) {
        return {
          email: pkg.publisher.email,
          name: pkg.publisher.username ?? null,
          username: pkg.publisher.username ?? pkg.name,
          ecosystem: 'npm',
        }
      }

      // Try maintainers
      if (Array.isArray(pkg.maintainers)) {
        for (const m of pkg.maintainers) {
          if (m.email && isValidEmail(m.email)) {
            return {
              email: m.email,
              name: m.name ?? null,
              username: m.name ?? pkg.name,
              ecosystem: 'npm',
            }
          }
        }
      }

      // Try author
      if (pkg.author) {
        if (typeof pkg.author === 'object' && pkg.author.email && isValidEmail(pkg.author.email)) {
          return {
            email: pkg.author.email,
            name: pkg.author.name ?? null,
            username: pkg.name,
            ecosystem: 'npm',
          }
        }
        if (typeof pkg.author === 'string') {
          const emailMatch = pkg.author.match(/<([^>]+)>/)
          if (emailMatch && isValidEmail(emailMatch[1])) {
            const nameMatch = pkg.author.match(/^([^<]+)/)
            return {
              email: emailMatch[1],
              name: nameMatch ? nameMatch[1].trim() : null,
              username: pkg.name,
              ecosystem: 'npm',
            }
          }
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
 * Search GitHub for repos matching a tool name.
 * Returns the first matching repo URL (for tools that might have a GitHub repo
 * but no other cross-reference available).
 */
async function resolveViaGitHubSearch(
  toolName: string
): Promise<string | null> {
  // Only search for names that are specific enough (avoid generic terms)
  if (toolName.length < 4) return null

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

  try {
    const res = await fetch(
      `https://api.github.com/search/repositories?q=${encodeURIComponent(toolName)}+in:name&per_page=5&sort=stars&order=desc`,
      {
        signal: controller.signal,
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'application/vnd.github+json',
        },
      }
    )
    clearTimeout(timeout)
    if (!res.ok) return null

    const data = (await res.json()) as GitHubSearchResult
    if (!data.items || data.items.length === 0) return null

    const toolNameLower = toolName.toLowerCase()

    // Prefer exact name match
    const exactMatch = data.items.find(
      (item) => item.name.toLowerCase() === toolNameLower
    )
    if (exactMatch) return exactMatch.html_url

    // Accept the first result if it closely matches
    const closeMatch = data.items.find((item) => {
      const itemName = item.name.toLowerCase()
      return (
        itemName.includes(toolNameLower) ||
        toolNameLower.includes(itemName)
      )
    })
    if (closeMatch) return closeMatch.html_url

    return null
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}

/**
 * Extract the tool name from a source URL for cross-ecosystem lookups.
 * Used when the primary resolver fails and we need to search npm/GitHub/MCP Registry.
 */
function extractToolNameFromUrl(sourceUrl: string): string | null {
  try {
    const parsed = new URL(sourceUrl)
    const segments = parsed.pathname.split('/').filter((s) => s.length > 0)

    // Smithery: /servers/owner/name or /servers/name
    if (parsed.hostname.includes('smithery')) {
      const idx = segments.indexOf('servers') ?? segments.indexOf('server')
      if (idx !== -1 && segments.length > idx + 1) {
        return segments[segments.length - 1]
      }
    }

    // MCP Registry: name is usually the tool name itself
    if (parsed.hostname.includes('modelcontextprotocol')) {
      return null // No useful name in the registry base URL
    }

    // Generic: last path segment
    if (segments.length > 0) {
      return segments[segments.length - 1]
    }

    return null
  } catch {
    return null
  }
}

/**
 * Resolves the creator's email for any supported AI tool ecosystem.
 *
 * Strategy:
 * 1. Detect ecosystem from sourceEcosystem or URL
 * 2. Dispatch to ecosystem-specific resolver
 * 3. If primary fails, try cross-ecosystem fallbacks (npm search, MCP Registry, GitHub search)
 * 4. Return ResolvedCreator or null if no email found
 *
 * Supported ecosystems: github, npm, pypi, huggingface, apify, smithery
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
    let result: ResolvedCreator | null = null

    switch (resolvedEcosystem) {
      case 'npm':
        result = await resolveNpmAuthorEmail(sourceUrl)
        break

      case 'pypi':
        result = await resolvePypiAuthorEmail(sourceUrl)
        break

      case 'huggingface':
      case 'replicate':
        result = await resolveHuggingFaceEmail(sourceUrl)
        break

      case 'apify':
        result = resolveApifyEmail(sourceUrl)
        break

      case 'github':
      case 'mcp-registry':
      case 'pulsemcp':
        result = await resolveGitHubEmail(sourceUrl)
        break

      case 'smithery': {
        // Smithery URLs require multi-strategy GitHub cross-referencing.
        const githubUrl = await resolveSmitheryToGitHub(sourceUrl)
        if (githubUrl) {
          result = await resolveGitHubEmail(githubUrl)
          if (result) {
            // Store the discovered GitHub URL for backfill
            result._discoveredGitHubUrl = githubUrl
          }
        }

        // If GitHub resolution failed but we found a GitHub URL,
        // try npm search as fallback
        if (!result) {
          const toolName = extractToolNameFromUrl(sourceUrl)
          if (toolName) {
            // Try npm search for direct email
            result = await resolveViaNpmSearch(toolName)
            if (result) {
              logger.info('ecosystem_email_resolver.smithery_npm_search_resolved', {
                toolName,
                email: result.email.split('@')[0]?.slice(0, 3) + '***',
              })
            }
          }
        }
        break
      }

      default: {
        // Try GitHub resolution if the URL contains github.com
        const detected = detectEcosystemFromUrl(sourceUrl)
        if (detected === 'github') {
          result = await resolveGitHubEmail(sourceUrl)
        }

        // For direct website URLs, try scraping for mailto: or GitHub links
        if (!result && sourceUrl.startsWith('http')) {
          result = await resolveWebsiteEmail(sourceUrl)
        }

        if (!result) {
          logger.info('ecosystem_email_resolver.unsupported_ecosystem', {
            ecosystem: resolvedEcosystem,
            url: sourceUrl.slice(0, 200),
          })
        }
        break
      }
    }

    // Cross-ecosystem fallback: try npm search for any ecosystem that failed
    if (!result && resolvedEcosystem !== 'npm' && resolvedEcosystem !== 'apify') {
      const toolName = extractToolNameFromUrl(sourceUrl)
      if (toolName && toolName.length >= 3) {
        result = await resolveViaNpmSearch(toolName)
        if (result) {
          logger.info('ecosystem_email_resolver.npm_search_fallback_resolved', {
            ecosystem: resolvedEcosystem,
            toolName,
          })
        }
      }
    }

    return result
  } catch (err) {
    logger.error(
      'ecosystem_email_resolver.resolver_error',
      { ecosystem: resolvedEcosystem, url: sourceUrl.slice(0, 200) },
      err
    )
    return null
  }
}

/**
 * Resolves the creator's email and returns any discovered GitHub URL for backfill.
 * Used by the claim-outreach cron to update source_repo_url when a better URL is found.
 */
export async function resolveCreatorEmailWithBackfill(
  sourceUrl: string,
  ecosystem: string | null
): Promise<{ creator: ResolvedCreator | null; discoveredGitHubUrl: string | null }> {
  const creator = await resolveCreatorEmail(sourceUrl, ecosystem)

  // Extract discovered GitHub URL from the creator result
  const discoveredGitHubUrl = creator?._discoveredGitHubUrl ?? null

  return { creator, discoveredGitHubUrl }
}
