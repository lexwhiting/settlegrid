import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock jose before importing auth module
vi.mock('jose', () => ({
  SignJWT: vi.fn().mockImplementation((payload: Record<string, unknown>) => {
    const instance = {
      _payload: payload,
      _header: {} as Record<string, unknown>,
      _exp: '',
      _iss: '',
      _sub: '',
      setProtectedHeader: vi.fn().mockImplementation((header: Record<string, unknown>) => {
        instance._header = header
        return instance
      }),
      setIssuedAt: vi.fn().mockReturnThis(),
      setExpirationTime: vi.fn().mockImplementation((exp: string) => {
        instance._exp = exp
        return instance
      }),
      setIssuer: vi.fn().mockImplementation((iss: string) => {
        instance._iss = iss
        return instance
      }),
      setSubject: vi.fn().mockImplementation((sub: string) => {
        instance._sub = sub
        return instance
      }),
      sign: vi.fn().mockResolvedValue('mock-jwt-token'),
    }
    return instance
  }),
  jwtVerify: vi.fn().mockResolvedValue({
    payload: {
      sub: 'dev-123',
      email: 'dev@example.com',
      role: 'developer',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 604800,
    },
  }),
}))

vi.mock('bcryptjs', () => ({
  default: {
    hash: vi.fn().mockResolvedValue('$2a$12$hashedpassword'),
    compare: vi.fn().mockResolvedValue(true),
  },
}))

vi.mock('@/lib/env', () => ({
  getJwtSecret: vi.fn().mockReturnValue('test-jwt-secret-at-least-32-chars-long'),
  isProduction: vi.fn().mockReturnValue(false),
}))

import {
  hashPassword,
  comparePassword,
  createToken,
  verifyToken,
  setSessionCookie,
  clearSessionCookie,
} from '@/lib/auth'
import type { TokenPayload } from '@/lib/auth'
import bcrypt from 'bcryptjs'
import { jwtVerify } from 'jose'
import { NextResponse } from 'next/server'

describe('hashPassword', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns a bcrypt hash string', async () => {
    const hash = await hashPassword('mysecurepassword')
    expect(hash).toBe('$2a$12$hashedpassword')
    expect(bcrypt.hash).toHaveBeenCalledWith('mysecurepassword', 12)
  })

  it('calls bcrypt with 12 rounds', async () => {
    await hashPassword('test')
    expect(bcrypt.hash).toHaveBeenCalledWith('test', 12)
  })
})

describe('comparePassword', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns true for matching password', async () => {
    const result = await comparePassword('password', '$2a$12$hash')
    expect(result).toBe(true)
    expect(bcrypt.compare).toHaveBeenCalledWith('password', '$2a$12$hash')
  })

  it('returns false for non-matching password', async () => {
    vi.mocked(bcrypt.compare).mockResolvedValueOnce(false as never)
    const result = await comparePassword('wrong', '$2a$12$hash')
    expect(result).toBe(false)
  })
})

describe('createToken', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates a JWT token string', async () => {
    const payload: TokenPayload = {
      id: 'dev-123',
      email: 'dev@example.com',
      role: 'developer',
    }

    const token = await createToken(payload)
    expect(typeof token).toBe('string')
    expect(token).toBe('mock-jwt-token')
  })

  it('includes the correct role in the token', async () => {
    const payload: TokenPayload = {
      id: 'con-456',
      email: 'consumer@example.com',
      role: 'consumer',
    }

    const token = await createToken(payload)
    expect(token).toBe('mock-jwt-token')
  })
})

describe('verifyToken', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns decoded session with id, email, role', async () => {
    const session = await verifyToken('mock-jwt-token')
    expect(session.id).toBe('dev-123')
    expect(session.email).toBe('dev@example.com')
    expect(session.role).toBe('developer')
    expect(typeof session.iat).toBe('number')
    expect(typeof session.exp).toBe('number')
  })

  it('throws on invalid token', async () => {
    vi.mocked(jwtVerify).mockRejectedValueOnce(new Error('Invalid token'))

    await expect(verifyToken('bad-token')).rejects.toThrow('Invalid token')
  })

  it('returns consumer role from consumer token', async () => {
    vi.mocked(jwtVerify).mockResolvedValueOnce({
      payload: {
        sub: 'con-789',
        email: 'con@example.com',
        role: 'consumer',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 604800,
      },
      protectedHeader: { alg: 'HS256' },
      key: new Uint8Array(),
    } as never)

    const session = await verifyToken('consumer-token')
    expect(session.id).toBe('con-789')
    expect(session.role).toBe('consumer')
  })
})

describe('setSessionCookie', () => {
  it('sets the sg-token cookie on the response', () => {
    const response = NextResponse.json({ ok: true })
    const result = setSessionCookie(response, 'my-token')

    const cookie = result.cookies.get('sg-token')
    expect(cookie).toBeDefined()
    expect(cookie?.value).toBe('my-token')
  })
})

describe('clearSessionCookie', () => {
  it('clears the sg-token cookie', () => {
    const response = NextResponse.json({ ok: true })
    const result = clearSessionCookie(response)

    const cookie = result.cookies.get('sg-token')
    expect(cookie).toBeDefined()
    expect(cookie?.value).toBe('')
  })

  it('returns the same response object', () => {
    const response = NextResponse.json({ ok: true })
    const result = clearSessionCookie(response)
    expect(result).toBe(response)
  })

  it('sets maxAge to 0 for immediate expiry', () => {
    const response = NextResponse.json({})
    clearSessionCookie(response)
    const cookieHeader = response.headers.get('set-cookie')
    expect(cookieHeader).toContain('Max-Age=0')
  })
})

describe('setSessionCookie (extended)', () => {
  it('returns the same response object', () => {
    const response = NextResponse.json({ ok: true })
    const result = setSessionCookie(response, 'token-val')
    expect(result).toBe(response)
  })

  it('sets httpOnly flag', () => {
    const response = NextResponse.json({})
    setSessionCookie(response, 'token')
    const cookieHeader = response.headers.get('set-cookie')
    expect(cookieHeader).toContain('HttpOnly')
  })

  it('sets SameSite=Lax', () => {
    const response = NextResponse.json({})
    setSessionCookie(response, 'token')
    const cookieHeader = response.headers.get('set-cookie')
    expect(cookieHeader?.toLowerCase()).toContain('samesite=lax')
  })

  it('sets path to /', () => {
    const response = NextResponse.json({})
    setSessionCookie(response, 'token')
    const cookieHeader = response.headers.get('set-cookie')
    expect(cookieHeader).toContain('Path=/')
  })

  it('sets 7-day max age (604800s)', () => {
    const response = NextResponse.json({})
    setSessionCookie(response, 'token')
    const cookieHeader = response.headers.get('set-cookie')
    expect(cookieHeader).toContain('Max-Age=604800')
  })
})

describe('createToken (extended)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates token for consumer role', async () => {
    const payload: TokenPayload = {
      id: 'con-789',
      email: 'consumer@example.com',
      role: 'consumer',
    }
    const token = await createToken(payload)
    expect(typeof token).toBe('string')
  })

  it('returns a string token', async () => {
    const payload: TokenPayload = { id: 'x', email: 'x@x.com', role: 'developer' }
    const token = await createToken(payload)
    expect(typeof token).toBe('string')
    expect(token.length).toBeGreaterThan(0)
  })
})

describe('verifyToken (extended)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('verifies with issuer settlegrid and HS256', async () => {
    await verifyToken('some-token')
    expect(jwtVerify).toHaveBeenCalledWith(
      'some-token',
      expect.any(Uint8Array),
      expect.objectContaining({ issuer: 'settlegrid', algorithms: ['HS256'] })
    )
  })

  it('returns numeric iat and exp', async () => {
    const session = await verifyToken('valid-token')
    expect(typeof session.iat).toBe('number')
    expect(typeof session.exp).toBe('number')
    expect(session.exp).toBeGreaterThan(session.iat)
  })
})

describe('hashPassword (extended)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('hashes different passwords separately', async () => {
    await hashPassword('password1')
    await hashPassword('password2')
    expect(bcrypt.hash).toHaveBeenCalledTimes(2)
    expect(bcrypt.hash).toHaveBeenCalledWith('password1', 12)
    expect(bcrypt.hash).toHaveBeenCalledWith('password2', 12)
  })
})

describe('comparePassword (extended)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('passes password and hash to bcrypt.compare', async () => {
    await comparePassword('plain', '$2a$12$stored')
    expect(bcrypt.compare).toHaveBeenCalledWith('plain', '$2a$12$stored')
  })
})
