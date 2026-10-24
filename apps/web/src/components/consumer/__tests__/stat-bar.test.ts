/**
 * Consumer stat bar: the Total Balance card includes the global (credit-pack)
 * balance as well as per-tool balances.
 */
import { describe, it, expect } from 'vitest'
import * as ReactActual from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

// The project compiles JSX with the classic React.createElement transform.
Object.assign(globalThis, { React: ReactActual })

import { ConsumerStatBar, computeConsumerStats } from '../stat-bar'

const toolBalance = (toolId: string, balanceCents: number) => ({
  toolId,
  toolName: toolId,
  toolSlug: toolId,
  balanceCents,
  autoRefill: false,
})

const apiKey = (id: string, toolId: string, status = 'active') => ({
  id,
  keyPrefix: 'sg_live_abcd',
  toolId,
  status,
  lastUsedAt: null,
  createdAt: '2026-01-01T00:00:00.000Z',
})

describe('computeConsumerStats', () => {
  it('includes the global balance in the total', () => {
    expect(computeConsumerStats([], [], 100).totalBalanceCents).toBe(100)
  })

  it('adds per-tool balances to the global balance', () => {
    const stats = computeConsumerStats([toolBalance('t1', 250), toolBalance('t2', 0)], [], 99)
    expect(stats.totalBalanceCents).toBe(349)
  })

  it('defaults the global balance to zero', () => {
    expect(computeConsumerStats([toolBalance('t1', 50)], []).totalBalanceCents).toBe(50)
  })

  it('counts a keyed tool as active when the global balance is positive', () => {
    const stats = computeConsumerStats([], [apiKey('k1', 't1'), apiKey('k2', 't2', 'revoked')], 99)
    expect(stats.activeTools).toBe(1)
    expect(stats.activeKeys).toBe(1)
  })

  it('does not count a keyed tool as active without any usable balance', () => {
    const stats = computeConsumerStats([toolBalance('t1', 0)], [apiKey('k1', 't1')], 0)
    expect(stats.activeTools).toBe(0)
    expect(stats.activeKeys).toBe(1)
  })

  it('does not double-count a tool with both a balance and a key', () => {
    const stats = computeConsumerStats([toolBalance('t1', 10)], [apiKey('k1', 't1')], 99)
    expect(stats.activeTools).toBe(1)
  })
})

describe('ConsumerStatBar', () => {
  it('renders the global balance in the Total Balance card', () => {
    const html = renderToStaticMarkup(
      ReactActual.createElement(ConsumerStatBar, { balances: [], keys: [], globalBalanceCents: 100 }),
    )
    expect(html).toContain('aria-label="Total Balance: $1.00"')
  })
})
