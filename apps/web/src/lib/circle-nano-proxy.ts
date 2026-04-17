/**
 * Circle Nanopayments — app-side thin re-export (P2.K2).
 *
 * @see packages/mcp/src/adapters/circle-nano.ts
 */

import {
  CircleNanoAdapter,
  isCircleNanoRequest as isCircleNanoRequestCore,
  validateCircleNanoPayment as validateCircleNanoPaymentCore,
  generateCircleNano402Response as generateCircleNano402ResponseCore,
} from '@settlegrid/mcp'
import type {
  CircleNanoPaymentResult,
  CircleNanoToolConfig,
  CircleNanoErrorCode,
} from '@settlegrid/mcp'
import { getAppUrl } from './env'
import { logger } from './logger'

const circleNanoAdapter = new CircleNanoAdapter()

const appLogger = {
  info: (event: string, data?: Record<string, unknown>) => logger.info(event, data ?? {}),
  warn: (event: string, data?: Record<string, unknown>) => logger.warn(event, data ?? {}),
  error: (event: string, data?: Record<string, unknown>, err?: unknown) =>
    logger.error(event, data ?? {}, err),
}

export function isCircleNanoRequest(request: Request): boolean {
  return isCircleNanoRequestCore(request)
}

/** Circle Nano enable check — env.ts does not expose one, defined here. */
export function isCircleNanoEnabled(): boolean {
  return !!process.env.CIRCLE_NANO_API_KEY
}

export async function validateCircleNanoPayment(
  request: Request,
  toolConfig: CircleNanoToolConfig,
): Promise<CircleNanoPaymentResult> {
  return validateCircleNanoPaymentCore(request, {
    enabled: isCircleNanoEnabled(),
    toolConfig,
    logger: appLogger,
  })
}

export function generateCircleNano402Response(
  toolSlug: string,
  costCents: number,
  toolName?: string,
): Response {
  return generateCircleNano402ResponseCore({
    toolSlug,
    costCents,
    toolName,
    appUrl: getAppUrl(),
  })
}

export { circleNanoAdapter }
export type { CircleNanoPaymentResult, CircleNanoToolConfig, CircleNanoErrorCode }
