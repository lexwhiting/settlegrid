import { describe, it, expect } from 'vitest'
import { getOrCreateRequestId } from '@/lib/request-id'

const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

describe('getOrCreateRequestId', () => {
  it('returns existing valid x-request-id header', () => {
    const existingId = '550e8400-e29b-41d4-a716-446655440000'
    const request = new Request('http://localhost/test', {
      headers: { 'x-request-id': existingId },
    })

    const result = getOrCreateRequestId(request)
    expect(result).toBe(existingId)
  })

  it('generates a new UUID when no header is present', () => {
    const request = new Request('http://localhost/test')

    const result = getOrCreateRequestId(request)
    expect(result).toMatch(UUID_V4_RE)
  })

  it('generates a new UUID when header is not a valid UUID', () => {
    const request = new Request('http://localhost/test', {
      headers: { 'x-request-id': 'not-a-uuid' },
    })

    const result = getOrCreateRequestId(request)
    expect(result).toMatch(UUID_V4_RE)
    expect(result).not.toBe('not-a-uuid')
  })

  it('generates unique IDs for different requests', () => {
    const req1 = new Request('http://localhost/test1')
    const req2 = new Request('http://localhost/test2')

    const id1 = getOrCreateRequestId(req1)
    const id2 = getOrCreateRequestId(req2)

    expect(id1).not.toBe(id2)
  })

  it('rejects empty string as header value', () => {
    const request = new Request('http://localhost/test', {
      headers: { 'x-request-id': '' },
    })

    const result = getOrCreateRequestId(request)
    expect(result).toMatch(UUID_V4_RE)
  })
})
