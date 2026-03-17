import { describe, it, expect } from 'vitest'
import { extractApiKey } from '../middleware'

describe('extractApiKey', () => {
  it('extracts key from settlegrid-api-key metadata', () => {
    const key = extractApiKey(undefined, { 'settlegrid-api-key': 'sg_live_meta' })
    expect(key).toBe('sg_live_meta')
  })

  it('extracts key from x-api-key metadata', () => {
    const key = extractApiKey(undefined, { 'x-api-key': 'sg_live_xapi' })
    expect(key).toBe('sg_live_xapi')
  })

  it('prefers settlegrid-api-key over x-api-key in metadata', () => {
    const key = extractApiKey(undefined, {
      'settlegrid-api-key': 'sg_primary',
      'x-api-key': 'sg_secondary',
    })
    expect(key).toBe('sg_primary')
  })

  it('extracts key from Authorization Bearer header', () => {
    const key = extractApiKey({ authorization: 'Bearer sg_live_bearer' })
    expect(key).toBe('sg_live_bearer')
  })

  it('extracts key from x-api-key header', () => {
    const key = extractApiKey({ 'x-api-key': 'sg_live_header' })
    expect(key).toBe('sg_live_header')
  })

  it('extracts key from X-Api-Key header (capitalized)', () => {
    const key = extractApiKey({ 'X-Api-Key': 'sg_live_cap' })
    expect(key).toBe('sg_live_cap')
  })

  it('handles array header values', () => {
    const key = extractApiKey({ 'x-api-key': ['sg_live_first', 'sg_live_second'] })
    expect(key).toBe('sg_live_first')
  })

  it('returns null when no key available', () => {
    const key = extractApiKey({})
    expect(key).toBeNull()
  })

  it('returns null when headers is undefined and no metadata', () => {
    const key = extractApiKey(undefined, undefined)
    expect(key).toBeNull()
  })

  it('returns null for non-Bearer Authorization header', () => {
    const key = extractApiKey({ authorization: 'Basic dXNlcjpwYXNz' })
    expect(key).toBeNull()
  })

  it('returns null when metadata has unrelated keys', () => {
    const key = extractApiKey(undefined, { 'other-key': 'value' })
    expect(key).toBeNull()
  })

  it('converts non-string metadata values to string', () => {
    const key = extractApiKey(undefined, { 'settlegrid-api-key': 12345 as unknown })
    expect(key).toBe('12345')
  })

  it('prefers metadata over headers', () => {
    const key = extractApiKey(
      { 'x-api-key': 'header_key' },
      { 'settlegrid-api-key': 'meta_key' }
    )
    expect(key).toBe('meta_key')
  })

  it('falls back to Authorization header when x-api-key missing', () => {
    const key = extractApiKey({ 'Authorization': 'Bearer sg_live_auth' })
    expect(key).toBe('sg_live_auth')
  })

  it('handles empty Authorization Bearer', () => {
    const key = extractApiKey({ authorization: 'Bearer ' })
    expect(key).toBe('')
  })

  it('returns null for empty array header', () => {
    const key = extractApiKey({ 'x-api-key': [] })
    expect(key).toBeNull()
  })
})
