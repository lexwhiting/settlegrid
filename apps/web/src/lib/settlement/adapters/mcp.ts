/**
 * MCP Protocol Adapter
 *
 * Extracts payment context from MCP tool call requests.
 * Supports API keys from:
 *   1. _meta['settlegrid-api-key'] (MCP metadata, preferred)
 *   2. Authorization: Bearer <key> header
 *   3. x-api-key header
 */

import type { ProtocolAdapter, PaymentContext, SettlementResult } from '../types'
import { randomUUID } from 'crypto'

export class MCPAdapter implements ProtocolAdapter {
  readonly name = 'mcp' as const
  readonly displayName = 'Model Context Protocol'

  /**
   * Detect if this request is an MCP tool call.
   * MCP requests typically have:
   *   - x-api-key or settlegrid-api-key header/metadata
   *   - Content-Type: application/json
   *   - A JSON body with method and arguments (JSON-RPC 2.0 style)
   */
  canHandle(request: Request): boolean {
    // MCP is the default/fallback protocol for API-key-based requests
    const hasApiKey =
      request.headers.get('x-api-key') !== null ||
      request.headers.get('authorization')?.startsWith('Bearer sg_') === true
    return hasApiKey
  }

  async extractPaymentContext(request: Request): Promise<PaymentContext> {
    // Extract API key from headers
    const apiKey =
      request.headers.get('x-api-key') ??
      request.headers.get('authorization')?.replace('Bearer ', '') ??
      null

    if (!apiKey) {
      throw new Error('No API key found in request')
    }

    // Try to parse the body for method info
    let method = 'default'
    let service = 'unknown'
    let params: unknown = undefined

    try {
      const clone = request.clone()
      const body = await clone.json()
      if (body?.method) method = String(body.method)
      if (body?.toolSlug) service = String(body.toolSlug)
      if (body?.arguments) params = body.arguments
      // MCP _meta can carry settlegrid context
      if (body?._meta?.['settlegrid-method']) {
        method = String(body._meta['settlegrid-method'])
      }
      if (body?._meta?.['settlegrid-service']) {
        service = String(body._meta['settlegrid-service'])
      }
    } catch {
      // Body may not be JSON or may have been consumed
    }

    return {
      protocol: 'mcp',
      identity: {
        type: 'api-key',
        value: apiKey,
      },
      operation: {
        service,
        method,
        params,
      },
      payment: {
        type: 'credit-balance',
      },
      requestId: request.headers.get('x-request-id') ?? randomUUID(),
    }
  }

  formatResponse(result: SettlementResult, _request: Request): Response {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-SettleGrid-Operation-Id': result.operationId,
      'X-SettleGrid-Cost-Cents': String(result.costCents),
    }

    if (result.remainingBalanceCents != null) {
      headers['X-SettleGrid-Remaining-Balance'] = String(result.remainingBalanceCents)
    }

    // MCP responses include billing info in _meta style
    return new Response(
      JSON.stringify({
        status: result.status,
        operationId: result.operationId,
        costCents: result.costCents,
        remainingBalanceCents: result.remainingBalanceCents,
        _meta: {
          billing: {
            costCents: result.costCents,
            remainingBalanceCents: result.remainingBalanceCents,
            settlementType: result.metadata.settlementType,
            latencyMs: result.metadata.latencyMs,
          },
        },
      }),
      { status: 200, headers }
    )
  }

  formatError(error: Error, request: Request): Response {
    const isInsufficientCredits = error.message.includes('INSUFFICIENT_CREDITS') ||
      error.message.includes('insufficient') ||
      error.message.includes('balance')

    const status = isInsufficientCredits ? 402 : 500
    const code = isInsufficientCredits ? 'INSUFFICIENT_CREDITS' : 'SERVER_ERROR'

    return new Response(
      JSON.stringify({
        error: {
          code,
          message: error.message,
          protocol: 'mcp' as const,
          timestamp: new Date().toISOString(),
          requestId: request.headers.get('x-request-id') ?? null,
        },
      }),
      {
        status,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }
}
