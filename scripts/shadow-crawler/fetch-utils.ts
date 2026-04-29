/**
 * HTTP fetch utilities with timeout and exponential-backoff retry.
 */

const DEFAULT_TIMEOUT_MS = 10_000
const MAX_RETRIES = 3
const BASE_DELAY_MS = 500

export async function fetchWithRetry(
  url: string,
  init?: RequestInit & { timeoutMs?: number },
): Promise<Response> {
  const timeoutMs = init?.timeoutMs ?? DEFAULT_TIMEOUT_MS

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)

    try {
      const res = await fetch(url, {
        ...init,
        signal: controller.signal,
      })
      clearTimeout(timeout)

      if (res.ok) return res

      // Retry on 429 and 5xx; fail immediately on 4xx
      if (res.status !== 429 && res.status < 500) {
        throw new Error(`HTTP ${res.status}: ${url}`)
      }

      if (attempt === MAX_RETRIES) {
        throw new Error(`HTTP ${res.status} after ${MAX_RETRIES + 1} attempts: ${url}`)
      }
    } catch (err) {
      clearTimeout(timeout)
      if (attempt === MAX_RETRIES) throw err
      // AbortError from timeout is retryable
    }

    // Exponential backoff: 500ms, 1s, 2s
    await new Promise((r) => setTimeout(r, BASE_DELAY_MS * 2 ** attempt))
  }

  throw new Error(`Unreachable: max retries exceeded for ${url}`)
}

export async function fetchJson<T>(
  url: string,
  init?: RequestInit & { timeoutMs?: number },
): Promise<T> {
  const res = await fetchWithRetry(url, init)
  return res.json() as Promise<T>
}
