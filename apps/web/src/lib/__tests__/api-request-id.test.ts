import { describe, it, expect } from 'vitest'
import {
  successResponse,
  errorResponse,
  internalErrorResponse,
} from '@/lib/api'

describe('API response helpers with requestId', () => {
  it('successResponse includes x-request-id header when provided', () => {
    const response = successResponse({ ok: true }, 200, 'req-abc-123')
    expect(response.headers.get('x-request-id')).toBe('req-abc-123')
  })

  it('successResponse omits x-request-id header when not provided', () => {
    const response = successResponse({ ok: true })
    expect(response.headers.get('x-request-id')).toBeNull()
  })

  it('errorResponse includes x-request-id header when provided', () => {
    const response = errorResponse('Not found', 404, 'NOT_FOUND', 'req-def-456')
    expect(response.headers.get('x-request-id')).toBe('req-def-456')
  })

  it('errorResponse omits x-request-id header when not provided', () => {
    const response = errorResponse('Not found', 404)
    expect(response.headers.get('x-request-id')).toBeNull()
  })

  it('internalErrorResponse includes x-request-id header when provided', () => {
    const response = internalErrorResponse(new Error('boom'), 'req-ghi-789')
    expect(response.headers.get('x-request-id')).toBe('req-ghi-789')
    expect(response.status).toBe(500)
  })

  it('internalErrorResponse omits x-request-id header when not provided', () => {
    const response = internalErrorResponse(new Error('boom'))
    expect(response.headers.get('x-request-id')).toBeNull()
  })
})
