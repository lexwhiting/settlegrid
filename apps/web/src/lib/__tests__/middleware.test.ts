import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

const mockGetGateSecret = vi.fn<() => string>(() => { throw new Error('not set') })
const mockGetGatePassword = vi.fn<() => string>(() => { throw new Error('not set') })

vi.mock('@/lib/env', () => ({
  getGateSecret: () => mockGetGateSecret(),
  getGatePassword: () => mockGetGatePassword(),
}))

// Mock clerkMiddleware to pass through — it wraps our handler and calls it with (clerkAuth, request)
vi.mock('@clerk/nextjs/server', () => ({
  clerkMiddleware: (handler: (auth: { protect: () => Promise<void> }, request: NextRequest) => Promise<NextResponse>) => {
    return async (request: NextRequest) => {
      const mockClerkAuth = { protect: vi.fn().mockResolvedValue(undefined) }
      return handler(mockClerkAuth, request)
    }
  },
  createRouteMatcher: (patterns: string[]) => {
    return (request: NextRequest) => {
      const { pathname } = request.nextUrl
      return patterns.some((pattern) => {
        // Simple pattern matching: convert (.*) to regex
        const regex = new RegExp('^' + pattern.replace(/\(\.?\*\)/g, '.*') + '$')
        return regex.test(pathname)
      })
    }
  },
}))

import middlewareDefault from '@/middleware'

// clerkMiddleware returns a function with (req, event) signature but our mock only needs req
const middleware = middlewareDefault as unknown as (request: NextRequest) => Promise<NextResponse>

function createRequest(path: string, cookies?: Record<string, string>): NextRequest {
  const req = new NextRequest(`http://localhost:3005${path}`, {
    method: 'GET',
    headers: { 'x-forwarded-for': '127.0.0.1' },
  })
  if (cookies) {
    for (const [name, value] of Object.entries(cookies)) {
      req.cookies.set(name, value)
    }
  }
  return req
}

describe('Middleware security headers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetGateSecret.mockImplementation(() => { throw new Error('not set') })
    mockGetGatePassword.mockImplementation(() => { throw new Error('not set') })
  })

  it('sets X-Frame-Options: DENY on non-public paths', async () => {
    const response = await middleware(createRequest('/dashboard'))
    expect(response.headers.get('X-Frame-Options')).toBe('DENY')
  })

  it('sets X-Content-Type-Options: nosniff', async () => {
    const response = await middleware(createRequest('/dashboard'))
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff')
  })

  it('sets Strict-Transport-Security header', async () => {
    const response = await middleware(createRequest('/dashboard'))
    const hsts = response.headers.get('Strict-Transport-Security')
    expect(hsts).toContain('max-age=31536000')
    expect(hsts).toContain('includeSubDomains')
  })

  it('sets Content-Security-Policy header', async () => {
    const response = await middleware(createRequest('/dashboard'))
    const csp = response.headers.get('Content-Security-Policy')
    expect(csp).toContain("default-src 'self'")
    expect(csp).toContain("frame-ancestors 'none'")
  })

  it('sets Referrer-Policy header', async () => {
    const response = await middleware(createRequest('/dashboard'))
    expect(response.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin')
  })

  it('sets Permissions-Policy header', async () => {
    const response = await middleware(createRequest('/dashboard'))
    const pp = response.headers.get('Permissions-Policy')
    expect(pp).toContain('camera=()')
    expect(pp).toContain('microphone=()')
    expect(pp).toContain('geolocation=()')
  })

  it('adds security headers for /api/health (public route)', async () => {
    const response = await middleware(createRequest('/api/health'))
    expect(response.status).toBe(200)
    expect(response.headers.get('X-Frame-Options')).toBe('DENY')
  })

  it('adds security headers for /api/sdk/ paths', async () => {
    const response = await middleware(createRequest('/api/sdk/validate-key'))
    expect(response.status).toBe(200)
    expect(response.headers.get('X-Frame-Options')).toBe('DENY')
  })
})

describe('Middleware gate bypass edge cases', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetGateSecret.mockImplementation(() => { throw new Error('not set') })
    mockGetGatePassword.mockImplementation(() => { throw new Error('not set') })
  })

  it('allows access when no gate password is configured for /api/billing/webhook', async () => {
    const response = await middleware(createRequest('/api/billing/webhook'))
    expect(response.status).toBe(200)
  })

  it('allows access when no gate password is configured for /api/gate', async () => {
    const response = await middleware(createRequest('/api/gate'))
    expect(response.status).toBe(200)
  })

  it('allows access for /gate page', async () => {
    const response = await middleware(createRequest('/gate'))
    expect(response.status).toBe(200)
  })

  it('allows access for /favicon paths', async () => {
    const response = await middleware(createRequest('/favicon.ico'))
    expect(response.status).toBe(200)
  })

  it('does not skip gate for /dashboard (non-public path)', async () => {
    mockGetGatePassword.mockReturnValue('secret123')
    mockGetGateSecret.mockReturnValue('gate-secret-key-1234567890abcdef')

    const response = await middleware(createRequest('/dashboard'))
    // Should redirect to /gate since no valid cookie
    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toContain('/gate')
  })
})

describe('Middleware gate with password configured', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetGatePassword.mockReturnValue('my-gate-password')
    mockGetGateSecret.mockReturnValue('my-gate-secret-32chars-minimum!!')
  })

  it('redirects to /gate when password is set but no cookie present', async () => {
    const response = await middleware(createRequest('/dashboard'))
    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toContain('/gate')
  })

  it('redirects to /gate when cookie is present but empty', async () => {
    const response = await middleware(createRequest('/dashboard', { settlegrid_access: '' }))
    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toContain('/gate')
  })

  it('redirects to /gate when cookie has wrong length', async () => {
    const response = await middleware(createRequest('/dashboard', { settlegrid_access: 'short' }))
    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toContain('/gate')
  })

  it('redirects to /gate when cookie has correct length but wrong value', async () => {
    const wrongToken = 'a'.repeat(64)
    const response = await middleware(createRequest('/dashboard', { settlegrid_access: wrongToken }))
    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toContain('/gate')
  })

  it('allows access when no gate password is configured', async () => {
    mockGetGatePassword.mockImplementation(() => { throw new Error('not set') })
    mockGetGateSecret.mockImplementation(() => { throw new Error('not set') })
    const response = await middleware(createRequest('/dashboard'))
    expect(response.status).toBe(200)
    expect(response.headers.get('X-Frame-Options')).toBe('DENY')
  })
})
