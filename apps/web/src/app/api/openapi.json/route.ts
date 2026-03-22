/**
 * GET /api/openapi.json — OpenAPI 3.1 specification for the SettleGrid API.
 *
 * Covers all major API routes: sessions, agents, x402, a2a, orgs, outcomes, streaming.
 * Cached for 1 hour via Cache-Control.
 */

import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit, apiLimiter } from '@/lib/rate-limit'
import { errorResponse } from '@/lib/api'

export const maxDuration = 5

export async function GET(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
  const rl = await checkRateLimit(apiLimiter, `openapi:${ip}`)
  if (!rl.success) {
    return errorResponse('Too many requests.', 429, 'RATE_LIMIT_EXCEEDED')
  }

  const spec = {
    openapi: '3.1.0',
    info: {
      title: 'SettleGrid API',
      version: '1.0.0',
      description:
        'The Settlement Layer for the AI Economy. SettleGrid handles metering, billing, multi-hop budget delegation, outcome-based settlement, and real-time cost streaming for AI tool providers.',
      contact: { email: 'api@settlegrid.ai', url: 'https://settlegrid.ai' },
      license: { name: 'Proprietary' },
    },
    servers: [
      { url: 'https://settlegrid.ai', description: 'Production' },
      { url: 'http://localhost:3005', description: 'Development' },
    ],
    paths: {
      // ─── SDK Routes ───────────────────────────────────────────────────
      '/api/sdk/validate-key': {
        post: {
          summary: 'Validate an API key',
          tags: ['SDK'],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['apiKey', 'toolSlug'],
                  properties: {
                    apiKey: { type: 'string', description: 'Consumer API key' },
                    toolSlug: { type: 'string', description: 'Tool slug to validate against' },
                  },
                },
              },
            },
          },
          responses: {
            '200': { description: 'Key validation result with consumer/tool IDs' },
            '401': { description: 'Invalid or revoked API key' },
          },
        },
      },
      '/api/sdk/meter': {
        post: {
          summary: 'Meter a tool invocation',
          tags: ['SDK'],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['toolSlug', 'consumerId', 'toolId', 'keyId', 'method', 'costCents'],
                  properties: {
                    toolSlug: { type: 'string' },
                    consumerId: { type: 'string', format: 'uuid' },
                    toolId: { type: 'string', format: 'uuid' },
                    keyId: { type: 'string', format: 'uuid' },
                    method: { type: 'string' },
                    costCents: { type: 'integer', minimum: 0 },
                    latencyMs: { type: 'integer', minimum: 0 },
                  },
                },
              },
            },
          },
          responses: {
            '200': { description: 'Metering recorded successfully' },
            '402': { description: 'Insufficient credits' },
          },
        },
      },

      // ─── Sessions ─────────────────────────────────────────────────────
      '/api/sessions': {
        post: {
          summary: 'Create a workflow session',
          tags: ['Sessions'],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['customerId', 'budgetCents'],
                  properties: {
                    customerId: { type: 'string', description: 'Customer identifier' },
                    budgetCents: { type: 'integer', minimum: 1 },
                    expiresIn: { type: 'integer', minimum: 1, maximum: 86400, description: 'TTL in seconds (max 24h)' },
                    protocol: { type: 'string', enum: ['mcp', 'x402', 'ap2', 'visa-tap'] },
                    metadata: { type: 'object', additionalProperties: true },
                  },
                },
              },
            },
          },
          responses: {
            '201': { description: 'Session created with budget allocation' },
            '400': { description: 'Invalid parameters' },
          },
        },
      },
      '/api/sessions/{id}': {
        get: {
          summary: 'Get session state',
          tags: ['Sessions'],
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
          ],
          responses: {
            '200': { description: 'Session state with budget, spent, reserved, hops' },
            '404': { description: 'Session not found' },
          },
        },
      },

      // ─── Agents (KYA) ─────────────────────────────────────────────────
      '/api/agents': {
        post: {
          summary: 'Register a new agent identity',
          tags: ['Agents'],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['agentName', 'identityType'],
                  properties: {
                    agentName: { type: 'string' },
                    identityType: { type: 'string', enum: ['api-key', 'did:key', 'jwt', 'x509', 'tap-token'] },
                    publicKey: { type: 'string' },
                    providerId: { type: 'string' },
                    capabilities: { type: 'object' },
                    spendingLimitCents: { type: 'integer', minimum: 0 },
                  },
                },
              },
            },
          },
          responses: {
            '201': { description: 'Agent registered with ID and fingerprint' },
          },
        },
      },

      // ─── X402 Payment Protocol ─────────────────────────────────────────
      '/api/x402/verify': {
        post: {
          summary: 'Verify an X402 payment',
          tags: ['X402'],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['paymentPayload', 'scheme'],
                  properties: {
                    paymentPayload: { type: 'string', description: 'Base64-encoded payment proof' },
                    scheme: { type: 'string', enum: ['exact', 'upto'] },
                    network: { type: 'string', enum: ['base-sepolia', 'base-mainnet'] },
                  },
                },
              },
            },
          },
          responses: {
            '200': { description: 'Payment verification result' },
          },
        },
      },

      // ─── Organizations ─────────────────────────────────────────────────
      '/api/orgs': {
        post: {
          summary: 'Create an organization',
          tags: ['Organizations'],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['name', 'billingEmail'],
                  properties: {
                    name: { type: 'string' },
                    billingEmail: { type: 'string', format: 'email' },
                    plan: { type: 'string', enum: ['free', 'starter', 'growth', 'scale', 'enterprise'] },
                    monthlyBudgetCents: { type: 'integer', minimum: 0 },
                  },
                },
              },
            },
          },
          responses: {
            '201': { description: 'Organization created' },
          },
        },
      },

      // ─── Outcomes (Phase 8) ────────────────────────────────────────────
      '/api/outcomes': {
        post: {
          summary: 'Create an outcome verification',
          tags: ['Outcomes'],
          description: 'Register a pending outcome verification for pay-for-performance pricing.',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['invocationId', 'toolId', 'consumerId', 'outcomeType', 'successCriteria', 'fullPriceCents'],
                  properties: {
                    invocationId: { type: 'string' },
                    toolId: { type: 'string' },
                    consumerId: { type: 'string' },
                    outcomeType: { type: 'string', enum: ['boolean', 'score', 'custom'] },
                    successCriteria: {
                      type: 'object',
                      properties: {
                        outcomeType: { type: 'string', enum: ['boolean', 'score', 'custom'] },
                        minScore: { type: 'number' },
                        maxLatencyMs: { type: 'number' },
                        requiredFields: { type: 'array', items: { type: 'string' } },
                      },
                    },
                    fullPriceCents: { type: 'integer', minimum: 0 },
                    failurePriceCents: { type: 'integer', minimum: 0 },
                  },
                },
              },
            },
          },
          responses: {
            '201': { description: 'Outcome verification created' },
          },
        },
      },
      '/api/outcomes/{id}': {
        get: {
          summary: 'Get outcome verification status',
          tags: ['Outcomes'],
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
          ],
          responses: {
            '200': { description: 'Verification details including pass/fail and dispute status' },
            '404': { description: 'Verification not found' },
          },
        },
      },
      '/api/outcomes/{id}/verify': {
        post: {
          summary: 'Submit actual outcome for evaluation',
          tags: ['Outcomes'],
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['actualOutcome'],
                  properties: {
                    actualOutcome: { description: 'The raw result from the tool invocation' },
                    latencyMs: { type: 'integer', minimum: 0 },
                  },
                },
              },
            },
          },
          responses: {
            '200': { description: 'Evaluation result with pass/fail, score, and settled price' },
            '404': { description: 'Verification not found' },
            '409': { description: 'Already verified' },
          },
        },
      },
      '/api/outcomes/{id}/dispute': {
        post: {
          summary: 'Open a dispute on an outcome verification',
          tags: ['Outcomes'],
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['reason'],
                  properties: {
                    reason: { type: 'string', maxLength: 1000 },
                  },
                },
              },
            },
          },
          responses: {
            '200': { description: 'Dispute opened' },
            '404': { description: 'Verification not found' },
            '410': { description: 'Dispute deadline passed' },
            '409': { description: 'Dispute already exists' },
          },
        },
      },

      // ─── Streaming ─────────────────────────────────────────────────────
      '/api/stream': {
        get: {
          summary: 'Real-time cost streaming via Server-Sent Events',
          tags: ['Streaming'],
          description: 'Connect to receive real-time session budget updates. Events: session.state, balance.updated, budget.warning, budget.exceeded.',
          parameters: [
            { name: 'sessionId', in: 'query', required: true, schema: { type: 'string' } },
            { name: 'apiKey', in: 'query', required: true, schema: { type: 'string' } },
          ],
          responses: {
            '200': {
              description: 'SSE stream of budget events',
              content: { 'text/event-stream': { schema: { type: 'string' } } },
            },
            '401': { description: 'API key required' },
            '400': { description: 'Missing sessionId' },
          },
        },
      },

      // ─── OpenAPI Spec ──────────────────────────────────────────────────
      '/api/openapi.json': {
        get: {
          summary: 'Get the OpenAPI 3.1 specification',
          tags: ['Meta'],
          responses: {
            '200': { description: 'OpenAPI 3.1 JSON spec' },
          },
        },
      },
    },
    components: {
      securitySchemes: {
        apiKey: {
          type: 'apiKey',
          in: 'header',
          name: 'x-api-key',
          description: 'Consumer API key for SDK operations',
        },
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          description: 'Bearer token for dashboard operations',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            code: { type: 'string' },
          },
        },
        OutcomeCriteria: {
          type: 'object',
          properties: {
            outcomeType: { type: 'string', enum: ['boolean', 'score', 'custom'] },
            minScore: { type: 'number', description: 'Minimum score for score-based outcomes (0-1)' },
            maxLatencyMs: { type: 'number', description: 'Maximum acceptable latency in ms' },
            requiredFields: { type: 'array', items: { type: 'string' }, description: 'Fields required in custom outcome' },
          },
        },
        StreamEvent: {
          type: 'object',
          properties: {
            type: { type: 'string', enum: ['session.state', 'balance.updated', 'budget.warning', 'budget.exceeded'] },
            sessionId: { type: 'string' },
            spentCents: { type: 'integer' },
            reservedCents: { type: 'integer' },
            remainingCents: { type: 'integer' },
            budgetCents: { type: 'integer' },
            percentUsed: { type: 'integer' },
            timestamp: { type: 'string', format: 'date-time' },
          },
        },
        SupportedCurrency: {
          type: 'string',
          enum: ['USD', 'EUR', 'GBP', 'JPY', 'USDC'],
        },
      },
    },
    tags: [
      { name: 'SDK', description: 'SDK operations for tool providers' },
      { name: 'Sessions', description: 'Workflow session management' },
      { name: 'Agents', description: 'Agent identity (KYA) management' },
      { name: 'X402', description: 'X402 payment protocol operations' },
      { name: 'Organizations', description: 'Enterprise organization management' },
      { name: 'Outcomes', description: 'Outcome-based settlement and disputes' },
      { name: 'Streaming', description: 'Real-time cost streaming via SSE' },
      { name: 'Meta', description: 'API metadata and documentation' },
    ],
  }

  return NextResponse.json(spec, {
    headers: { 'Cache-Control': 'public, max-age=3600' },
  })
}
