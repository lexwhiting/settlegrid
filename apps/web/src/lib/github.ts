import crypto from 'node:crypto'
import { getGitHubAppId, getGitHubAppPrivateKey, getGitHubWebhookSecret } from '@/lib/env'
import { logger } from '@/lib/logger'

// ─── Constants ──────────────────────────────────────────────────────────────────

const GITHUB_API_BASE = 'https://api.github.com'
const FETCH_TIMEOUT_MS = 10_000
const JWT_EXPIRY_SECONDS = 600 // 10 minutes (GitHub max)

// ─── JWT Helpers (RS256, no external dependency) ────────────────────────────────

/**
 * Base64url-encode a buffer (RFC 7515).
 */
function base64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/**
 * Create a GitHub App JWT using RS256.
 *
 * GitHub App authentication requires a short-lived JWT signed with the App's
 * private key. This JWT is exchanged for an installation token.
 *
 * @see https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-a-jwt
 */
function createAppJwt(appId: string, privateKey: string): string {
  const now = Math.floor(Date.now() / 1000)

  const header = base64url(Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })))

  const payload = base64url(
    Buffer.from(
      JSON.stringify({
        iat: now - 60, // Allow 60s clock skew
        exp: now + JWT_EXPIRY_SECONDS,
        iss: appId,
      })
    )
  )

  const signingInput = `${header}.${payload}`
  const sign = crypto.createSign('RSA-SHA256')
  sign.update(signingInput)
  sign.end()

  const signature = base64url(sign.sign(privateKey))

  return `${signingInput}.${signature}`
}

// ─── Webhook Signature Verification ─────────────────────────────────────────────

/**
 * Verify a GitHub webhook signature (HMAC SHA-256).
 *
 * @param payload  Raw request body string
 * @param signature  The `x-hub-signature-256` header value (e.g. "sha256=abc...")
 * @param secret  The webhook secret configured for the GitHub App
 * @returns true if the signature is valid
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  if (!signature.startsWith('sha256=')) {
    return false
  }

  const expected = `sha256=${crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex')}`

  // Constant-time comparison to prevent timing attacks
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
  } catch {
    // Lengths differ
    return false
  }
}

// ─── Installation Token Exchange ────────────────────────────────────────────────

interface InstallationTokenResponse {
  token: string
  expires_at: string
  permissions: Record<string, string>
}

/**
 * Exchange a GitHub App installation ID for an access token.
 *
 * The flow:
 * 1. Generate a JWT signed with the App's private key
 * 2. POST to /app/installations/{id}/access_tokens
 * 3. GitHub returns a short-lived installation token
 */
export async function getInstallationToken(installationId: number): Promise<string> {
  const appId = getGitHubAppId()
  const privateKey = getGitHubAppPrivateKey()

  if (!appId || !privateKey) {
    throw new GitHubConfigError('GitHub App not configured: missing GITHUB_APP_ID or GITHUB_APP_PRIVATE_KEY')
  }

  const jwt = createAppJwt(appId, privateKey)

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

  try {
    const response = await fetch(
      `${GITHUB_API_BASE}/app/installations/${installationId}/access_tokens`,
      {
        method: 'POST',
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${jwt}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'User-Agent': 'SettleGrid-GitHubApp/1.0',
        },
      }
    )

    if (!response.ok) {
      const body = await response.text().catch(() => '')
      logger.error('github.installation_token_failed', {
        installationId,
        status: response.status,
        body: body.slice(0, 500),
      })
      throw new GitHubApiError(
        `Failed to get installation token: ${response.status}`,
        response.status
      )
    }

    const data = (await response.json()) as InstallationTokenResponse
    return data.token
  } finally {
    clearTimeout(timeout)
  }
}

// ─── File Content Fetching ──────────────────────────────────────────────────────

interface GitHubFileContent {
  content?: string
  encoding?: string
  sha?: string
}

/**
 * Fetch a file's content from a GitHub repository.
 *
 * @param token  Installation access token
 * @param owner  Repository owner
 * @param repo   Repository name
 * @param path   File path within the repo
 * @returns The decoded file content, or null if the file doesn't exist
 */
export async function fetchFileContent(
  token: string,
  owner: string,
  repo: string,
  path: string
): Promise<string | null> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

  try {
    const response = await fetch(
      `${GITHUB_API_BASE}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodeURIComponent(path)}`,
      {
        method: 'GET',
        signal: controller.signal,
        headers: {
          Authorization: `token ${token}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'User-Agent': 'SettleGrid-GitHubApp/1.0',
        },
      }
    )

    if (response.status === 404) {
      return null
    }

    if (!response.ok) {
      logger.warn('github.fetch_file_failed', {
        owner,
        repo,
        path,
        status: response.status,
      })
      return null
    }

    const data = (await response.json()) as GitHubFileContent

    if (data.encoding === 'base64' && typeof data.content === 'string') {
      return Buffer.from(data.content, 'base64').toString('utf-8')
    }

    // Some small files may be returned inline
    if (typeof data.content === 'string') {
      return data.content
    }

    return null
  } catch (error) {
    const isTimeout = error instanceof Error && error.name === 'AbortError'
    logger.warn('github.fetch_file_error', {
      owner,
      repo,
      path,
      msg: isTimeout ? 'Request timed out' : 'Request failed',
      error: error instanceof Error ? error.message : String(error),
    })
    return null
  } finally {
    clearTimeout(timeout)
  }
}

// ─── Repository Listing ────────────────────────────────────────────────────────

interface GitHubRepo {
  name: string
  full_name: string
  default_branch: string
  private: boolean
}

/**
 * List all repositories accessible to a given installation.
 * Returns up to 100 repos (first page).
 */
export async function listInstallationRepos(token: string): Promise<GitHubRepo[]> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

  try {
    const response = await fetch(
      `${GITHUB_API_BASE}/installation/repositories?per_page=100`,
      {
        method: 'GET',
        signal: controller.signal,
        headers: {
          Authorization: `token ${token}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'User-Agent': 'SettleGrid-GitHubApp/1.0',
        },
      }
    )

    if (!response.ok) {
      logger.warn('github.list_repos_failed', { status: response.status })
      return []
    }

    const data = (await response.json()) as { repositories?: GitHubRepo[] }
    return Array.isArray(data.repositories) ? data.repositories : []
  } catch (error) {
    logger.warn('github.list_repos_error', {
      error: error instanceof Error ? error.message : String(error),
    })
    return []
  } finally {
    clearTimeout(timeout)
  }
}

// ─── Configuration Check ───────────────────────────────────────────────────────

/**
 * Returns true if all required GitHub App env vars are set.
 */
export function isGitHubAppConfigured(): boolean {
  return Boolean(getGitHubAppId() && getGitHubAppPrivateKey() && getGitHubWebhookSecret())
}

// ─── Error Classes ──────────────────────────────────────────────────────────────

export class GitHubConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'GitHubConfigError'
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

export class GitHubApiError extends Error {
  public readonly statusCode: number

  constructor(message: string, statusCode: number) {
    super(message)
    this.name = 'GitHubApiError'
    this.statusCode = statusCode
    Object.setPrototypeOf(this, new.target.prototype)
  }
}
