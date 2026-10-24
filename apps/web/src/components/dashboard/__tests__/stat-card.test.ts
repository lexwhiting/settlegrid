/**
 * StatCard with `animate`: once the count-up finishes, the displayed value
 * matches the formatted input, including its fractional digits (a 1-cent
 * revenue must read "$0.01", not "$0").
 */
import { describe, it, expect, vi } from 'vitest'
import * as ReactActual from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

// The project compiles JSX with the classic React.createElement transform.
Object.assign(globalThis, { React: ReactActual })

// Effects don't run in a static render; stand in for a finished count-up,
// which ends on Math.round(target) like the real hook.
const { mockUseCountUp } = vi.hoisted(() => ({
  mockUseCountUp: vi.fn((target: number) => (target <= 0 ? target : Math.round(target))),
}))
vi.mock('@/hooks/use-count-up', () => ({ useCountUp: mockUseCountUp }))

import { StatCard } from '../stat-card'

function render(value: string, animate = true): string {
  return renderToStaticMarkup(ReactActual.createElement(StatCard, { title: 'Revenue', value, animate }))
}

describe('StatCard animated value', () => {
  it.each([
    ['$0.01'],
    ['$0.00'],
    ['$1,234.56'],
    ['1,234'],
    ['12.5%'],
    ['4'],
  ])('shows %s after the count-up', (value) => {
    expect(render(value)).toContain(`>${value}<`)
  })

  it('counts cents, not whole dollars, for a currency value', () => {
    mockUseCountUp.mockClear()
    render('$0.01')
    expect(mockUseCountUp).toHaveBeenCalledWith(1, 800, true)
  })

  it('shows the value unchanged without animate', () => {
    expect(render('$0.01', false)).toContain('>$0.01<')
  })
})
