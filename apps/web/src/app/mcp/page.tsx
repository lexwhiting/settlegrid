import { redirect } from 'next/navigation'

// The crawled MCP directory is unpublished (no per-repo pages, no sitemap
// entries). /mcp sends visitors to the directory of SettleGrid's own
// open-source servers. A temporary redirect, so the path can be reused.
export const dynamic = 'force-dynamic'

export default function McpDirectoryPage(): never {
  redirect('/servers')
}
