/**
 * Isomorphic HTTP utilities for @settlegrid/client.
 *
 * D1 — The seller-side SDK exports `streamTextCapped` at
 * packages/mcp/src/adapters/lightning/voltage.ts. The handoff
 * explicitly directs callers to import that function rather than
 * re-implementing the cap. Unfortunately, voltage.ts sits inside a
 * module that imports `crypto` at top-level (`createHash`,
 * `timingSafeEqual`) for adjacent payment-hash + timing-safe helpers.
 * ESM tree-shaking CAN in principle drop the Node-only imports when
 * only `streamTextCapped` is used, but that's a property of the
 * downstream bundler — tsup's esbuild-based pipeline does it
 * correctly today, but webpack / rollup consumers may not. Shipping
 * a node-dependent module graph into the browser is a hostile
 * requirement (c) violation.
 *
 * This module is therefore a line-for-line port of the seller-side
 * cap using ONLY Web APIs (TextDecoder + ReadableStream). Any fix
 * to the cap semantics in voltage.ts MUST be mirrored here. A
 * future diff that consolidates the two implementations into a
 * @settlegrid/iso-primitives package would be welcome.
 */

/**
 * Read a Response body into a string with a hard byte cap. Rejects
 * upstream before allocating unbounded memory when the server
 * advertises a too-large Content-Length, and also enforces the cap
 * during streaming so a truthful-Content-Length-but-streaming-more
 * server cannot bypass the check.
 *
 * Cancels the reader on cap violation so the underlying transport
 * is not kept open consuming further bytes.
 */
export async function streamTextCapped(
  response: Response,
  maxBytes: number,
): Promise<string> {
  // Hostile fix H44 — defensive check on `maxBytes`. Callers inside
  // this package pre-validate via `validateManifestCap`, but the
  // function is exported module-internally and could gain additional
  // call sites; accepting `maxBytes = 0 | -1 | NaN | 1.5` would
  // either degrade to a silent no-cap (NaN comparisons are false) or
  // immediately reject every read. Fail loud instead.
  if (!Number.isInteger(maxBytes) || maxBytes < 1) {
    throw new TypeError(
      `streamTextCapped: \`maxBytes\` must be a positive integer; got ${JSON.stringify(maxBytes)}.`,
    )
  }
  // Fast-path: honest upstream sets Content-Length.
  const contentLengthHeader = response.headers.get('content-length')
  if (contentLengthHeader !== null) {
    const parsed = Number.parseInt(contentLengthHeader, 10)
    if (Number.isFinite(parsed) && parsed > maxBytes) {
      try {
        await response.body?.cancel()
      } catch {
        // Best-effort cancel; swallow transport errors so the
        // cap-violation error below is the one the caller sees.
      }
      throw new Error(
        `Response body (${parsed} bytes via Content-Length) exceeds ${maxBytes}-byte cap.`,
      )
    }
  }

  if (response.body === null) {
    return ''
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder('utf-8')
  let text = ''
  let received = 0
  try {
    for (;;) {
      const { value, done } = await reader.read()
      if (done) break
      if (value === undefined) continue
      received += value.byteLength
      if (received > maxBytes) {
        throw new Error(
          `Response body exceeds ${maxBytes}-byte cap during stream (received ${received} bytes).`,
        )
      }
      // `stream: true` lets the decoder hold onto a partial multi-byte
      // codepoint across reads. The final flush in the post-loop
      // `decode()` (no args) emits any trailing bytes.
      text += decoder.decode(value, { stream: true })
    }
    // Flush the decoder's internal buffer.
    text += decoder.decode()
    return text
  } catch (err) {
    try {
      await reader.cancel()
    } catch {
      // already-cancelled / stream-errored states can re-throw here;
      // the original error is the one the caller needs to see.
    }
    throw err
  } finally {
    try {
      reader.releaseLock()
    } catch {
      // Lock already released by reader.cancel() above in the error
      // path; redundant releaseLock throws an InvalidStateError. The
      // happy path falls through to here WITHOUT the reader being
      // released, which IS the work we want to do.
    }
  }
}

/**
 * Parse a {@link PaymentRequiredBody} from a capped text body. Throws
 * a `SyntaxError`-shaped error when the JSON is invalid or a
 * `TypeError`-shaped error when the JSON is valid but the shape is
 * wrong. Callers wrap the throw in `MalformedManifestError` for a
 * single-line branch.
 */
export function parsePaymentRequiredBody(raw: string): unknown {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch (err) {
    throw new Error(
      `402 body is not valid JSON: ${err instanceof Error ? err.message : String(err)}`,
    )
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('402 body is not a JSON object')
  }
  const asRecord = parsed as Record<string, unknown>
  // Hostile fix H20 — strict protocol-version + error-marker checks.
  // The x402 v2 body shape uses these two fields as a self-describing
  // tag. Accepting a body without the tags (or with the wrong values)
  // risks misinterpreting a future x402 v3 body — or a non-x402
  // response that happens to have an `accepts` array — as if it were
  // a v2 manifest and silently paying against incompatible semantics.
  if (asRecord.x402Version !== 2) {
    throw new Error(
      `402 body has unsupported \`x402Version\` ` +
        `(expected 2, got ${JSON.stringify(asRecord.x402Version)}).`,
    )
  }
  if (asRecord.error !== 'payment_required') {
    throw new Error(
      `402 body has wrong \`error\` marker ` +
        `(expected 'payment_required', got ${JSON.stringify(asRecord.error)}).`,
    )
  }
  if (!Array.isArray(asRecord.accepts)) {
    throw new Error('402 body is missing an `accepts` array')
  }
  if ((asRecord.accepts as unknown[]).length === 0) {
    throw new Error('402 body `accepts` array is empty')
  }
  return parsed
}
