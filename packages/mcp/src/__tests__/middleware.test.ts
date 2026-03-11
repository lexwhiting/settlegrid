import { describe, it, expect } from 'vitest'
import { extractApiKey } from '../middleware'

describe('extractApiKey', () => {
  it('extracts from MCP metadata settlegrid-api-key', () => {
    const key = extractApiKey(undefined, { 'settlegrid-api-key': 'sk_test_123' })
    expect(key).toBe('sk_test_123')
  })

  it('extracts from MCP metadata x-api-key', () => {
    const key = extractApiKey(undefined, { 'x-api-key': 'sk_test_456' })
    expect(key).toBe('sk_test_456')
  })

  it('prefers settlegrid-api-key over x-api-key in metadata', () => {
    const key = extractApiKey(undefined, {
      'settlegrid-api-key': 'preferred',
      'x-api-key': 'fallback',
    })
    expect(key).toBe('preferred')
  })

  it('extracts from Authorization Bearer header', () => {
    const key = extractApiKey({ authorization: 'Bearer sk_test_789' })
    expect(key).toBe('sk_test_789')
  })

  it('extracts from x-api-key header', () => {
    const key = extractApiKey({ 'x-api-key': 'sk_test_abc' })
    expect(key).toBe('sk_test_abc')
  })

  it('extracts from X-Api-Key header (case variation)', () => {
    const key = extractApiKey({ 'X-Api-Key': 'sk_test_def' })
    expect(key).toBe('sk_test_def')
  })

  it('handles array header values', () => {
    const key = extractApiKey({ 'x-api-key': ['sk_test_arr'] })
    expect(key).toBe('sk_test_arr')
  })

  it('returns null when no key found', () => {
    const key = extractApiKey({})
    expect(key).toBeNull()
  })

  it('returns null for undefined headers and metadata', () => {
    const key = extractApiKey(undefined, undefined)
    expect(key).toBeNull()
  })

  it('returns null for no arguments', () => {
    const key = extractApiKey()
    expect(key).toBeNull()
  })

  it('ignores non-Bearer authorization', () => {
    const key = extractApiKey({ authorization: 'Basic abc123' })
    expect(key).toBeNull()
  })

  it('prefers metadata over headers', () => {
    const key = extractApiKey(
      { 'x-api-key': 'header-key' },
      { 'settlegrid-api-key': 'metadata-key' }
    )
    expect(key).toBe('metadata-key')
  })
})
