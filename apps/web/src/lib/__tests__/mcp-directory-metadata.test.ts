import { describe, it, expect } from 'vitest'
import { mcpDirectoryMetadata } from '@/lib/mcp-directory'

describe('mcpDirectoryMetadata', () => {
  it('keeps an empty directory out of search indexes and names no count', () => {
    const metadata = mcpDirectoryMetadata(0)
    expect(metadata.robots).toEqual({ index: false, follow: true })
    expect(metadata.description).toBe(
      'A directory of MCP servers you can add per-call billing to with one command. No servers are listed yet.',
    )
    expect(metadata.description).not.toMatch(/\d/)
    expect(metadata.alternates).toEqual({ canonical: 'https://settlegrid.ai/mcp' })
  })

  it('states the real count for a populated directory and leaves indexing on', () => {
    const metadata = mcpDirectoryMetadata(1234)
    expect(metadata.robots).toBeUndefined()
    expect(metadata.description).toBe(
      'Browse 1,234 MCP servers indexed from public sources such as GitHub, npm and PyPI. Add per-call billing with one command.',
    )
    expect(metadata.title).toBe('MCP Server Directory | SettleGrid')
  })
})
