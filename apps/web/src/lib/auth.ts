import { SignJWT, jwtVerify } from 'jose'
import bcrypt from 'bcryptjs'
import { NextResponse } from 'next/server'
import type { ReadonlyRequestCookies } from 'next/dist/server/web/spec-extension/adapters/request-cookies'
import { getJwtSecret, isProduction } from './env'

const COOKIE_NAME = 'sg-token'
const TOKEN_EXPIRY = '7d'
const BCRYPT_ROUNDS = 12

export interface TokenPayload {
  id: string
  email: string
  role: 'developer' | 'consumer'
}

export interface Session extends TokenPayload {
  iat: number
  exp: number
}

function getSecretKey(): Uint8Array {
  return new TextEncoder().encode(getJwtSecret())
}

/**
 * Creates a signed JWT with a 7-day expiry.
 */
export async function createToken(payload: TokenPayload): Promise<string> {
  const secret = getSecretKey()

  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(TOKEN_EXPIRY)
    .setIssuer('settlegrid')
    .setSubject(payload.id)
    .sign(secret)
}

/**
 * Verifies a JWT and returns the decoded payload.
 * Throws if the token is expired, malformed, or has an invalid signature.
 */
export async function verifyToken(token: string): Promise<Session> {
  const secret = getSecretKey()

  const { payload } = await jwtVerify(token, secret, {
    issuer: 'settlegrid',
    algorithms: ['HS256'],
  })

  return {
    id: payload.sub as string,
    email: payload.email as string,
    role: payload.role as 'developer' | 'consumer',
    iat: payload.iat as number,
    exp: payload.exp as number,
  }
}

/**
 * Hashes a plaintext password using bcrypt with 12 salt rounds.
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS)
}

/**
 * Compares a plaintext password against a bcrypt hash.
 */
export async function comparePassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

/**
 * Reads the session from the 'sg-token' cookie.
 * Returns null if no cookie is set or the token is invalid/expired.
 */
export async function getSession(
  cookies: ReadonlyRequestCookies
): Promise<Session | null> {
  const token = cookies.get(COOKIE_NAME)?.value

  if (!token) {
    return null
  }

  try {
    return await verifyToken(token)
  } catch {
    return null
  }
}

/**
 * Sets the session JWT as an httpOnly, secure, SameSite=Lax cookie on the response.
 */
export function setSessionCookie(
  response: NextResponse,
  token: string
): NextResponse {
  response.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProduction(),
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7, // 7 days in seconds
  })

  return response
}

/**
 * Clears the session cookie by setting it to an empty value with immediate expiry.
 */
export function clearSessionCookie(response: NextResponse): NextResponse {
  response.cookies.set(COOKIE_NAME, '', {
    httpOnly: true,
    secure: isProduction(),
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  })

  return response
}
