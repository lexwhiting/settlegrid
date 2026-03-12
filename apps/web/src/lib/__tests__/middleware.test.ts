import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mockGetGateSecret = vi.fn<() => string>(() => { throw new Error('not set') })
const mockGetGatePassword = vi.fn<() => string>(() => { throw new Error('not set') })

vi.mock('@/lib/env', () => ({
  getGateSecret: () => mockGetGateSecret(),
  getGatePassword: () => mockGetGatePassword(),
}))

import { middleware } from '@/middleware'

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

  it('skips gate for public paths like /api/health', async () => {
    const response = await middleware(createRequest('/api/health'))
    // Public paths get NextResponse.next() without security headers
    expect(response.status).toBe(200)
  })

  it('skips gate for /api/sdk/ paths', async () => {
    const response = await middleware(createRequest('/api/sdk/validate-key'))
    expect(response.status).toBe(200)
  })

  it('skips gate for /_next/ paths', async () => {
    const response = await middleware(createRequest('/_next/static/chunk.js'))
    expect(response.status).toBe(200)
  })
})

describe('Middleware gate bypass edge cases', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetGateSecret.mockImplementation(() => { throw new Error('not set') })
    mockGetGatePassword.mockImplementation(() => { throw new Error('not set') })
  })

  it('skips gate for /api/billing/webhook', async () => {
    const response = await middleware(createRequest('/api/billing/webhook'))
    expect(response.status).toBe(200)
  })

  it('skips gate for /api/gate', async () => {
    const response = await middleware(createRequest('/api/gate'))
    expect(response.status).toBe(200)
  })

  it('skips gate for /gate page', async () => {
    const response = await middleware(createRequest('/gate'))
    expect(response.status).toBe(200)
  })

  it('skips gate for /favicon paths', async () => {
    const response = await middleware(createRequest('/favicon.ico'))
    expect(response.status).toBe(200)
  })

  it('does not skip gate for /api/tools (non-public path)', async () => {
    mockGetGatePassword.mockReturnValue('secret123')
    mockGetGateSecret.mockReturnValue('gate-secret-key-1234567890abcdef')

    const response = await middleware(createRequest('/api/tools'))
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
