import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/env', () => ({
  getGateSecret: vi.fn(() => { throw new Error('not set') }),
  getGatePassword: vi.fn(() => { throw new Error('not set') }),
}))

import { middleware } from '@/middleware'

function createRequest(path: string): NextRequest {
  return new NextRequest(`http://localhost:3005${path}`, {
    method: 'GET',
    headers: { 'x-forwarded-for': '127.0.0.1' },
  })
}

describe('Middleware security headers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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
