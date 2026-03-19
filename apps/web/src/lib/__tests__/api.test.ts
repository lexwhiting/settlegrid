import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import {
  successResponse,
  errorResponse,
  parseBody,
  internalErrorResponse,
  ParseBodyError,
} from '@/lib/api'

describe('successResponse', () => {
  it('returns JSON with data and default 200 status', async () => {
    const data = { id: '123', name: 'Test Tool' }
    const response = successResponse(data)

    expect(response.status).toBe(200)

    const body = await response.json()
    expect(body).toEqual({ id: '123', name: 'Test Tool' })
  })

  it('returns JSON with custom status code', async () => {
    const response = successResponse({ created: true }, 201)

    expect(response.status).toBe(201)

    const body = await response.json()
    expect(body).toEqual({ created: true })
  })

  it('handles null data', async () => {
    const response = successResponse(null)

    expect(response.status).toBe(200)

    const body = await response.json()
    expect(body).toBeNull()
  })

  it('handles array data', async () => {
    const response = successResponse([1, 2, 3])

    const body = await response.json()
    expect(body).toEqual([1, 2, 3])
  })
})

describe('errorResponse', () => {
  it('returns error format with message and status', async () => {
    const response = errorResponse('Not found', 404)

    expect(response.status).toBe(404)

    const body = await response.json()
    expect(body).toEqual({ error: 'Not found' })
  })

  it('includes error code when provided', async () => {
    const response = errorResponse('Rate limited', 429, 'RATE_LIMIT_EXCEEDED')

    expect(response.status).toBe(429)

    const body = await response.json()
    expect(body).toEqual({
      error: 'Rate limited',
      code: 'RATE_LIMIT_EXCEEDED',
    })
  })

  it('omits code field when not provided', async () => {
    const response = errorResponse('Bad request', 400)

    const body = await response.json()
    expect(body).toEqual({ error: 'Bad request' })
    expect(body.code).toBeUndefined()
  })
})

describe('parseBody', () => {
  const schema = z.object({
    email: z.string().email(),
    password: z.string().min(8),
  })

  function makeRequest(body: unknown): Request {
    return new Request('http://localhost/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  }

  it('parses valid body against schema', async () => {
    const request = makeRequest({
      email: 'dev@settlegrid.ai',
      password: 'securepassword123',
    })

    const result = await parseBody(request, schema)

    expect(result).toEqual({
      email: 'dev@settlegrid.ai',
      password: 'securepassword123',
    })
  })

  it('throws ParseBodyError for invalid JSON', async () => {
    const request = new Request('http://localhost/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json',
    })

    await expect(parseBody(request, schema)).rejects.toThrow(ParseBodyError)
    await expect(
      parseBody(
        new Request('http://localhost/test', {
          method: 'POST',
          body: 'not json',
        }),
        schema
      )
    ).rejects.toThrow('Request body must be valid JSON')
  })

  it('throws ParseBodyError for validation failures', async () => {
    const request = makeRequest({
      email: 'not-an-email',
      password: 'short',
    })

    try {
      await parseBody(request, schema)
      expect.fail('Should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(ParseBodyError)
      const parseErr = err as ParseBodyError
      expect(parseErr.statusCode).toBe(422)
      expect(parseErr.message).toContain('Validation failed')
    }
  })

  it('throws ParseBodyError for missing required fields', async () => {
    const request = makeRequest({ email: 'dev@settlegrid.ai' })

    await expect(parseBody(request, schema)).rejects.toThrow(ParseBodyError)
  })
})

describe('internalErrorResponse', () => {
  it('returns 500 with generic message for unknown errors', async () => {
    const response = internalErrorResponse('something broke')

    expect(response.status).toBe(500)

    const body = await response.json()
    expect(body).toEqual({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    })
  })

  it('returns 500 for Error instances', async () => {
    const response = internalErrorResponse(new Error('DB connection failed'))

    expect(response.status).toBe(500)

    const body = await response.json()
    expect(body).toEqual({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    })
  })

  it('returns appropriate status for ParseBodyError', async () => {
    const response = internalErrorResponse(
      new ParseBodyError('Invalid input', 422)
    )

    expect(response.status).toBe(422)

    const body = await response.json()
    expect(body).toEqual({
      error: 'Invalid input',
      code: 'VALIDATION_ERROR',
    })
  })

  it('handles null error', async () => {
    const response = internalErrorResponse(null)
    expect(response.status).toBe(500)
    const body = await response.json()
    expect(body.code).toBe('INTERNAL_ERROR')
  })

  it('handles undefined error', async () => {
    const response = internalErrorResponse(undefined)
    expect(response.status).toBe(500)
  })
})

describe('ParseBodyError', () => {
  it('extends Error', () => {
    const err = new ParseBodyError('test', 400)
    expect(err).toBeInstanceOf(Error)
  })

  it('has name ParseBodyError', () => {
    const err = new ParseBodyError('msg', 422)
    expect(err.name).toBe('ParseBodyError')
  })

  it('carries statusCode', () => {
    const err = new ParseBodyError('bad', 400)
    expect(err.statusCode).toBe(400)
  })

  it('carries message', () => {
    const err = new ParseBodyError('Validation failed: email: Invalid', 422)
    expect(err.message).toBe('Validation failed: email: Invalid')
  })
})

describe('successResponse (extended)', () => {
  it('handles nested objects', async () => {
    const response = successResponse({ a: { b: { c: true } } })
    const body = await response.json()
    expect(body.a.b.c).toBe(true)
  })

  it('handles empty object', async () => {
    const response = successResponse({})
    const body = await response.json()
    expect(body).toEqual({})
  })

  it('defaults to 200 status', () => {
    const response = successResponse('anything')
    expect(response.status).toBe(200)
  })
})

describe('errorResponse (extended)', () => {
  it('returns 401 for unauthorized', () => {
    const response = errorResponse('Unauthorized', 401)
    expect(response.status).toBe(401)
  })

  it('returns 403 for forbidden', () => {
    const response = errorResponse('Forbidden', 403)
    expect(response.status).toBe(403)
  })

  it('returns 409 for conflict', async () => {
    const response = errorResponse('Conflict', 409, 'SLUG_EXISTS')
    expect(response.status).toBe(409)
    const body = await response.json()
    expect(body.code).toBe('SLUG_EXISTS')
  })

  it('returns 500 for server error', () => {
    const response = errorResponse('Server error', 500, 'INTERNAL_ERROR')
    expect(response.status).toBe(500)
  })
})

describe('parseBody (extended)', () => {
  const strictSchema = z.object({
    name: z.string().min(1).max(200),
  })

  it('validates max length constraint', async () => {
    const request = new Request('http://localhost/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'a'.repeat(201) }),
    })

    await expect(parseBody(request, strictSchema)).rejects.toThrow(ParseBodyError)
  })

  it('passes with valid short name', async () => {
    const request = new Request('http://localhost/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Valid Name' }),
    })

    const result = await parseBody(request, strictSchema)
    expect(result.name).toBe('Valid Name')
  })

  it('rejects empty name', async () => {
    const request = new Request('http://localhost/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '' }),
    })

    await expect(parseBody(request, strictSchema)).rejects.toThrow(ParseBodyError)
  })
})
