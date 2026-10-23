/**
 * HeaderAuthLinks (tool page header): Dashboard when signed in, Log in /
 * Sign up otherwise, hidden while the session is unknown.
 */
import { describe, it, expect, vi } from 'vitest'
import * as ReactActual from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

// The project compiles JSX with the classic React.createElement transform.
Object.assign(globalThis, { React: ReactActual })

const { mockUseSignedIn } = vi.hoisted(() => ({ mockUseSignedIn: vi.fn<() => boolean | null>() }))

vi.mock('@/components/marketing/navbar', () => ({ useSignedIn: mockUseSignedIn }))
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children?: unknown }) =>
    ReactActual.createElement('a', { href, ...rest }, children as never),
}))

import { HeaderAuthLinks } from '../header-auth-links'

function render(): string {
  return renderToStaticMarkup(ReactActual.createElement(HeaderAuthLinks))
}

describe('HeaderAuthLinks', () => {
  it('links to the dashboard when signed in', () => {
    mockUseSignedIn.mockReturnValue(true)
    const html = render()
    expect(html).toContain('href="/dashboard"')
    expect(html).not.toContain('Log in')
    expect(html).not.toContain('Sign up')
  })

  it('shows Log in and Sign up when signed out', () => {
    mockUseSignedIn.mockReturnValue(false)
    const html = render()
    expect(html).toContain('href="/login"')
    expect(html).toContain('href="/register"')
    expect(html).not.toContain('invisible')
  })

  it('keeps the links invisible until the session is known', () => {
    mockUseSignedIn.mockReturnValue(null)
    const html = render()
    expect(html.match(/invisible/g)).toHaveLength(2)
    expect(html).not.toContain('Dashboard')
  })
})
