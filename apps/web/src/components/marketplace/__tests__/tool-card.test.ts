/**
 * Marketplace ToolCard "Claimed" badge: only claimed directory listings
 * (draft + sourceEcosystem), the same rule as the tool page.
 */
import { describe, it, expect, vi } from 'vitest'
import * as ReactActual from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

// The project compiles JSX with the classic React.createElement transform.
Object.assign(globalThis, { React: ReactActual })

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children?: unknown }) =>
    ReactActual.createElement('a', { href, ...rest }, children as never),
}))

import { ToolCard, type MarketplaceTool } from '../tool-card'

const BASE: MarketplaceTool = {
  id: 't1',
  name: 'Example',
  slug: 'example',
  description: 'An example tool',
  toolType: 'mcp-server',
  sourceEcosystem: null,
  category: null,
  status: 'draft',
  totalInvocations: 0,
  totalRevenueCents: 0,
  verified: false,
  createdAt: '2026-01-01T00:00:00.000Z',
}

function render(tool: Partial<MarketplaceTool>): string {
  return renderToStaticMarkup(ReactActual.createElement(ToolCard, { tool: { ...BASE, ...tool } }))
}

describe('ToolCard Claimed badge', () => {
  it('shows for a claimed directory listing', () => {
    expect(render({ status: 'draft', sourceEcosystem: 'npm' })).toContain('>Claimed<')
  })

  it("does not show for a developer's own listed draft", () => {
    expect(render({ status: 'draft', sourceEcosystem: null })).not.toContain('>Claimed<')
  })

  it('does not show for active or unclaimed tools', () => {
    expect(render({ status: 'active', sourceEcosystem: 'npm' })).not.toContain('>Claimed<')
    expect(render({ status: 'unclaimed', sourceEcosystem: 'npm' })).not.toContain('>Claimed<')
  })
})
