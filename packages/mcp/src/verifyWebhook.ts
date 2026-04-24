/**
 * P3.K4 — Buyer-side webhook verification helper.
 *
 * The developer's settlement endpoint receives HMAC-signed webhooks
 * from the SettleGrid kernel. This helper verifies the signature
 * using the developer's tool secret, doing:
 *
 *   1. Read and cap the request body (64 KiB default — a realistic
 *      settlement webhook payload is ~1-2 KiB; cap is ~32× slack).
 *   2. Pull the `X-SettleGrid-Signature` header.
 *   3. Run the signature + timestamp + tolerance check via
 *      {@link verifyPayloadSignature}.
 *   4. Return `{ ok, payload? }` — callers discriminate on `ok` and
 *      parse `payload` themselves (we do NOT parse JSON for them,
 *      because verifying a webhook against a pre-parsed object can
 *      drift if the parse normalizes whitespace or reorders keys).
 *
 * Compared to `verifyPayloadSignature`, this helper handles the
 * HTTP-level concerns: reading the body once (with a cap), resolving
 * the signature header casing correctly, and supplying a consistent
 * shape for the two failure paths (no header / invalid signature).
 *
 * D-note (P3.K4): the spec card places this at `packages/sdk/src/
 * verifyWebhook.ts`. The repo's seller SDK lives at `packages/mcp/`;
 * `packages/sdk/` does not exist. The file was placed at the real
 * path and the difference is documented in the P3.K4 scaffold commit
 * body as D1.
 */

import { verifyPayloadSignature, type VerifyOptions } from './auth/tool-secret'

/** Header name for the SettleGrid webhook signature. Case-insensitive
 * on the wire; we read lowercase via the standard Headers API. */
export const SETTLEGRID_SIGNATURE_HEADER = 'x-settlegrid-signature'

/** Default cap on webhook body size, in bytes. Realistic webhook
 * payloads are ~1-2 KiB; 64 KiB is ~32× slack while still bounding
 * a malicious sender's memory amplification. */
export const DEFAULT_WEBHOOK_MAX_BYTES = 64 * 1024

// ─── Public types ────────────────────────────────────────────────────

export interface VerifyWebhookOptions extends VerifyOptions {
  /**
   * Max body bytes. Defaults to {@link DEFAULT_WEBHOOK_MAX_BYTES}.
   * A body exceeding the cap resolves to `{ ok: false }` — the
   * helper never allocates an arbitrarily-large buffer.
   */
  maxBytes?: number
  /**
   * Alternative signature header name. Default
   * {@link SETTLEGRID_SIGNATURE_HEADER}. Useful for testing against
   * legacy endpoints or for renamed-header migrations.
   */
  signatureHeader?: string
}

export interface VerifyWebhookResult {
  /** True iff the signature matched and the timestamp was fresh. */
  ok: boolean
  /** Raw request-body string. Null when the body read failed or the
   * cap was exceeded. Populated on both `ok=true` AND `ok=false`
   * when the read itself succeeded so callers can log the rejected
   * body for forensics. */
  payload: string | null
  /**
   * Machine-readable reason code when `ok === false`. Never exposed
   * to the wire — callers use this for metrics / debugging. Codes
   * are intentionally coarse so a webhook that fails verification
   * doesn't leak WHICH check failed (an oracle-leak concern).
   */
  reason?:
    | 'missing_header'
    | 'body_too_large'
    | 'body_read_failed'
    | 'signature_mismatch'
}

// ─── Public function ─────────────────────────────────────────────────

/**
 * Verify a SettleGrid settlement webhook. Pass the Request and the
 * tool secret; receive a pass/fail verdict and the raw payload.
 *
 * Usage:
 *
 * ```ts
 * import { verifyWebhook } from '@settlegrid/mcp'
 *
 * export async function POST(req: Request) {
 *   const { ok, payload } = await verifyWebhook(req, process.env.TOOL_SECRET!)
 *   if (!ok || payload === null) return new Response('bad signature', { status: 400 })
 *   const event = JSON.parse(payload)
 *   // ...handle event...
 *   return new Response('ok', { status: 200 })
 * }
 * ```
 */
export async function verifyWebhook(
  request: Request,
  toolSecret: string,
  opts: VerifyWebhookOptions = {},
): Promise<VerifyWebhookResult> {
  const headerName = opts.signatureHeader ?? SETTLEGRID_SIGNATURE_HEADER
  const maxBytes = opts.maxBytes ?? DEFAULT_WEBHOOK_MAX_BYTES
  if (!Number.isInteger(maxBytes) || maxBytes < 1) {
    throw new TypeError(
      `verifyWebhook: \`maxBytes\` must be a positive integer; got ${JSON.stringify(maxBytes)}.`,
    )
  }

  const header = request.headers.get(headerName)

  let payload: string
  try {
    payload = await readBodyCapped(request, maxBytes)
  } catch (err) {
    if (err instanceof BodyTooLargeError) {
      return { ok: false, payload: null, reason: 'body_too_large' }
    }
    return { ok: false, payload: null, reason: 'body_read_failed' }
  }

  if (typeof header !== 'string' || header.length === 0) {
    return { ok: false, payload, reason: 'missing_header' }
  }

  const ok = verifyPayloadSignature(payload, header, toolSecret, {
    toleranceSec: opts.toleranceSec,
    clock: opts.clock,
  })
  return ok
    ? { ok: true, payload }
    : { ok: false, payload, reason: 'signature_mismatch' }
}

// ─── Internal helpers ────────────────────────────────────────────────

class BodyTooLargeError extends Error {}

/**
 * Drain a Request body into a string with a hard byte cap. Similar
 * to the client-SDK `streamTextCapped`, but returns ASCII text only
 * (webhook payloads are JSON, and a non-UTF-8 body is treated as a
 * body-read failure rather than being decoded with replacement
 * characters that would shift the HMAC input).
 *
 * Fast-path: honest upstream sets Content-Length.
 * Stream path: chunks read via `body.getReader()` with a running
 * total; exceeds cap → cancel reader, throw.
 */
async function readBodyCapped(
  request: Request,
  maxBytes: number,
): Promise<string> {
  const contentLength = request.headers.get('content-length')
  if (contentLength !== null) {
    const parsed = Number.parseInt(contentLength, 10)
    if (Number.isFinite(parsed) && parsed > maxBytes) {
      throw new BodyTooLargeError(
        `Webhook body (${parsed} bytes via Content-Length) exceeds ${maxBytes}-byte cap.`,
      )
    }
  }

  if (request.body === null) {
    return ''
  }

  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let received = 0
  try {
    for (;;) {
      const { value, done } = await reader.read()
      if (done) break
      if (value === undefined) continue
      received += value.byteLength
      if (received > maxBytes) {
        throw new BodyTooLargeError(
          `Webhook body exceeds ${maxBytes}-byte cap during stream (received ${received} bytes).`,
        )
      }
      chunks.push(value)
    }
    return Buffer.concat(chunks).toString('utf-8')
  } catch (err) {
    try {
      await reader.cancel()
    } catch {
      // best-effort; the caller will see the original error.
    }
    throw err
  } finally {
    try {
      reader.releaseLock()
    } catch {
      // Lock already released by cancel() in the error path.
    }
  }
}
