/**
 * Data for the /mcp directory page, read from the shadow index.
 * Server-side only.
 */

import { getAllShadowEntries, countShadowEntries, listOwners, type ShadowEntry } from '@/lib/shadow-index'
import { logger } from '@/lib/logger'

export interface McpDirectoryData {
  entries: ShadowEntry[]
  totalCount: number
  owners: string[]
}

/** Longest the /mcp page waits for its reads before it renders the empty directory. */
export const MCP_DIRECTORY_TIMEOUT_MS = 10_000

const EMPTY: McpDirectoryData = { entries: [], totalCount: 0, owners: [] }

/**
 * The top 50 entries by stars, the entry count and the owners. If the reads
 * have not finished after `timeoutMs`, returns the empty directory instead, so
 * the page answers rather than waiting for the function's time limit. The reads
 * are not cancelled: their database connections stay busy until they finish.
 */
export async function loadMcpDirectory(timeoutMs = MCP_DIRECTORY_TIMEOUT_MS): Promise<McpDirectoryData> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timedOut = new Promise<McpDirectoryData>((resolve) => {
    timer = setTimeout(() => {
      logger.warn('mcp_directory.read_timeout', { timeoutMs })
      resolve(EMPTY)
    }, timeoutMs)
  })
  const reads = Promise.all([getAllShadowEntries(50), countShadowEntries(), listOwners()]).then(
    ([entries, totalCount, owners]) => ({ entries, totalCount, owners }),
  )
  try {
    return await Promise.race([reads, timedOut])
  } finally {
    clearTimeout(timer)
  }
}
