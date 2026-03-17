import { describe, it, expect } from 'vitest'
import { GET } from '@/app/api/openapi.json/route'

describe('GET /api/openapi.json', () => {
  it('returns 200 with JSON content type', async () => {
    const response = await GET()

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toContain('application/json')
  })

  it('returns valid OpenAPI 3.1 spec', async () => {
    const response = await GET()
    const spec = await response.json()

    expect(spec.openapi).toBe('3.1.0')
    expect(spec.info.title).toBe('SettleGrid API')
    expect(spec.info.version).toBe('1.0.0')
  })

  it('has Cache-Control header set to 1 hour', async () => {
    const response = await GET()

    expect(response.headers.get('Cache-Control')).toBe('public, max-age=3600')
  })

  it('includes paths for all major API groups', async () => {
    const response = await GET()
    const spec = await response.json()

    // SDK routes
    expect(spec.paths['/api/sdk/validate-key']).toBeDefined()
    expect(spec.paths['/api/sdk/meter']).toBeDefined()

    // Sessions
    expect(spec.paths['/api/sessions']).toBeDefined()

    // Agents
    expect(spec.paths['/api/agents']).toBeDefined()

    // X402
    expect(spec.paths['/api/x402/verify']).toBeDefined()

    // Organizations
    expect(spec.paths['/api/orgs']).toBeDefined()

    // Outcomes (Phase 8)
    expect(spec.paths['/api/outcomes']).toBeDefined()
    expect(spec.paths['/api/outcomes/{id}']).toBeDefined()
    expect(spec.paths['/api/outcomes/{id}/verify']).toBeDefined()
    expect(spec.paths['/api/outcomes/{id}/dispute']).toBeDefined()

    // Streaming
    expect(spec.paths['/api/stream']).toBeDefined()
  })

  it('includes security schemes', async () => {
    const response = await GET()
    const spec = await response.json()

    expect(spec.components.securitySchemes.apiKey).toBeDefined()
    expect(spec.components.securitySchemes.apiKey.type).toBe('apiKey')
    expect(spec.components.securitySchemes.bearerAuth).toBeDefined()
    expect(spec.components.securitySchemes.bearerAuth.type).toBe('http')
  })

  it('includes component schemas', async () => {
    const response = await GET()
    const spec = await response.json()

    expect(spec.components.schemas.Error).toBeDefined()
    expect(spec.components.schemas.OutcomeCriteria).toBeDefined()
    expect(spec.components.schemas.StreamEvent).toBeDefined()
    expect(spec.components.schemas.SupportedCurrency).toBeDefined()
  })

  it('includes tags for all groups', async () => {
    const response = await GET()
    const spec = await response.json()

    const tagNames = spec.tags.map((t: { name: string }) => t.name)
    expect(tagNames).toContain('SDK')
    expect(tagNames).toContain('Sessions')
    expect(tagNames).toContain('Agents')
    expect(tagNames).toContain('X402')
    expect(tagNames).toContain('Organizations')
    expect(tagNames).toContain('Outcomes')
    expect(tagNames).toContain('Streaming')
    expect(tagNames).toContain('Meta')
  })

  it('outcome POST path has correct request schema', async () => {
    const response = await GET()
    const spec = await response.json()

    const outcomePost = spec.paths['/api/outcomes'].post
    expect(outcomePost.tags).toContain('Outcomes')
    const schema = outcomePost.requestBody.content['application/json'].schema
    expect(schema.required).toContain('invocationId')
    expect(schema.required).toContain('toolId')
    expect(schema.required).toContain('consumerId')
    expect(schema.required).toContain('outcomeType')
    expect(schema.required).toContain('fullPriceCents')
  })

  it('stream GET path documents SSE response', async () => {
    const response = await GET()
    const spec = await response.json()

    const streamGet = spec.paths['/api/stream'].get
    expect(streamGet.tags).toContain('Streaming')
    expect(streamGet.parameters).toHaveLength(2)
    expect(streamGet.responses['200'].content).toBeDefined()
    expect(streamGet.responses['200'].content['text/event-stream']).toBeDefined()
  })
})
