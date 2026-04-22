/**
 * P3.K2 — Voltage hosted-LND REST client.
 *
 * Voltage exposes the standard LND REST surface, so this client is
 * protocol-compatible with any `lnd_rest_url + Grpc-Metadata-macaroon`
 * endpoint. The spec names three operations:
 *
 *   - `createInvoice(amountMsat)`  — POST /v1/invoices
 *   - `lookupInvoice(paymentHash)` — GET  /v1/invoice/{payment_hash}
 *   - `decodePreimage(preimage)`   — local SHA-256 (no network call)
 *
 * Design rules applied at authoring time (per
 * `feedback-scaffold-discipline.md`):
 *   - Every public method validates its inputs up front (null /
 *     undefined / non-object / out-of-range) with an explicit throw.
 *   - Every HTTP response is size-capped at 64 KiB — same constant
 *     as the P3.K1 body-inspection guard. Voltage responses are ~1 KiB
 *     in practice; a runaway reverse-proxy or malicious upstream MUST
 *     NOT be able to force unbounded memory allocation in the SDK.
 *   - `fetch` and `setTimeout` are injectable so unit tests do not
 *     require network patches or real timers.
 *   - Hex comparisons use `timingSafeEqual` (via `timingSafeHexEqual`
 *     below) because preimage-hash equality is an authentication
 *     decision — `===` would be a timing oracle.
 *
 * Voltage's own LND build pins `Stripe-Version` is irrelevant —
 * Voltage is Lightning-native and uses `Grpc-Metadata-macaroon` for
 * auth. No API-version pin is sent; the LND REST surface is
 * effectively stable across the 0.18.x range Voltage hosts.
 */

import { createHash, timingSafeEqual } from 'crypto'

// ─── Constants ─────────────────────────────────────────────────────────────

/**
 * Maximum Voltage response body, in bytes. Voltage invoice bodies are
 * ~1 KiB; 64 KiB is ~64× slack for unexpected metadata growth while
 * still blocking a malicious upstream from forcing arbitrary buffer
 * allocation. Same constant as the P3.K1 body-inspection guard.
 */
export const VOLTAGE_MAX_BODY_BYTES = 64 * 1024

/**
 * Maximum Lightning invoice memo length, in characters. BOLT-11 does
 * not strictly cap memo length, but real nodes reject > ~640 bytes.
 * 512 chars is a safe working margin that accommodates tool names
 * and tool-slug context while rejecting obvious DoS inputs.
 */
export const VOLTAGE_MAX_MEMO_CHARS = 512

/** Default HTTP timeout for Voltage round-trips, in milliseconds. */
export const VOLTAGE_DEFAULT_TIMEOUT_MS = 10_000

/**
 * Regex for a valid Lightning preimage / payment hash — 32 bytes of
 * hex = exactly 64 lowercase or uppercase hex digits. Rejects any
 * value with wrong length, non-hex characters, or surrounding
 * whitespace BEFORE it flows into crypto primitives.
 */
const HEX_32_BYTES = /^[0-9a-f]{64}$/i

// ─── Public types ──────────────────────────────────────────────────────────

export interface VoltageClientOptions {
  /** VOLTAGE_NODE_URL. Full URL with protocol, no trailing slash required. */
  nodeUrl: string
  /**
   * VOLTAGE_MACAROON. Hex-encoded admin or invoice macaroon. Sent
   * verbatim as the `Grpc-Metadata-macaroon` request header.
   */
  macaroon: string
  /** Injectable for unit tests. Defaults to global `fetch`. */
  fetchImpl?: typeof fetch
  /** Request timeout in ms. Defaults to {@link VOLTAGE_DEFAULT_TIMEOUT_MS}. */
  timeoutMs?: number
}

/**
 * Normalized invoice shape used by the L402 adapter. Mirrors the
 * subset of LND's `lnrpc.Invoice` message that L402 actually
 * consumes. Fields not needed by the adapter are intentionally
 * omitted so a spec-compliant mock is trivial to construct.
 *
 * Monetary amounts are always in **millisatoshis** (`msat`) so the
 * adapter does not have to reason about sat/msat unit drift. Inside
 * LND the primary field is `value` (sats); `value_msat` is present
 * when the invoice was minted in msat. We normalize to msat here.
 */
export interface VoltageInvoice {
  /** BOLT-11 payment request string (what the payer pays). */
  paymentRequest: string
  /** 32-byte payment hash, lowercase hex. */
  paymentHash: string
  /** Amount, in millisatoshis. Always set and always finite. */
  amountMsat: number
  /** Invoice expiry, in seconds from creation. */
  expirySeconds: number
  /** Epoch seconds when the invoice was created by the node. */
  creationDate: number
  /** True once the invoice has been paid (settled state on the node). */
  settled: boolean
  /** Epoch seconds when the invoice settled; absent when unpaid. */
  settleDate?: number
}

/** Parameters passed to {@link VoltageClient.createInvoice}. */
export interface CreateInvoiceParams {
  /** Invoice amount, in millisatoshis. Must be a finite integer ≥ 1. */
  amountMsat: number
  /** Optional memo shown to the payer. Capped at {@link VOLTAGE_MAX_MEMO_CHARS}. */
  memo?: string
  /**
   * Invoice expiry in seconds. LND default is 86400 (24h); we expose
   * this so L402 can shorten invoices to match the macaroon's expiry.
   */
  expirySeconds?: number
}

export interface VoltageClient {
  createInvoice(params: CreateInvoiceParams): Promise<VoltageInvoice>
  lookupInvoice(paymentHash: string): Promise<VoltageInvoice>
  /**
   * Deterministic local operation: SHA-256 of the 32-byte preimage
   * decoded from its hex representation. Returns the hex-encoded
   * payment hash the preimage corresponds to.
   *
   * This is the cryptographic primitive behind L402 payment proof —
   * the invoice's `payment_hash` is `SHA-256(preimage)`. `decodePreimage`
   * lets the adapter compare a client-supplied preimage against the
   * invoice hash without another Voltage round-trip.
   */
  decodePreimage(preimage: string): string
}

// ─── Helpers ───────────────────────────────────────────────────────────────

/**
 * Timing-safe hex string comparison. Equivalent semantics to `===`
 * but does not early-exit on the first mismatched byte, closing the
 * timing side-channel on authentication decisions. Defined here (not
 * imported from l402.ts) so the voltage client is self-contained and
 * the crypto dependency is explicit at the client boundary.
 */
export function timingSafeHexEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  try {
    return timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'))
  } catch {
    return false
  }
}

/**
 * Compute SHA-256 over the 32-byte binary preimage (decoded from
 * hex) and return the hex-encoded digest. Throws on malformed input
 * so a hostile client cannot slip a non-hex string past the check.
 */
export function sha256Hex(preimage: string): string {
  if (typeof preimage !== 'string' || !HEX_32_BYTES.test(preimage)) {
    throw new Error(
      `decodePreimage: preimage must be a 32-byte hex string (64 hex chars); got ${JSON.stringify(
        preimage,
      )}.`,
    )
  }
  return createHash('sha256').update(Buffer.from(preimage, 'hex')).digest('hex')
}

// ─── Client factory ────────────────────────────────────────────────────────

/**
 * Build a {@link VoltageClient} bound to a specific Voltage node.
 * The returned object carries no global state; multiple clients
 * can coexist pointing at different nodes or tenants.
 */
export function createVoltageClient(options: VoltageClientOptions): VoltageClient {
  if (
    options === null ||
    options === undefined ||
    typeof options !== 'object' ||
    Array.isArray(options)
  ) {
    throw new TypeError(
      'createVoltageClient: `options` must be a non-null object.',
    )
  }
  if (typeof options.nodeUrl !== 'string' || options.nodeUrl.length === 0) {
    throw new Error(
      'createVoltageClient: `options.nodeUrl` is required and must be non-empty. Set VOLTAGE_NODE_URL in your environment.',
    )
  }
  if (typeof options.macaroon !== 'string' || options.macaroon.length === 0) {
    throw new Error(
      'createVoltageClient: `options.macaroon` is required and must be non-empty. Set VOLTAGE_MACAROON in your environment.',
    )
  }
  // Normalize trailing slash so caller-vs-call URL concatenation is
  // consistent regardless of what shape the env var was in.
  const baseUrl = options.nodeUrl.replace(/\/+$/, '')
  const fetchImpl = options.fetchImpl ?? fetch
  const timeoutMs = options.timeoutMs ?? VOLTAGE_DEFAULT_TIMEOUT_MS

  async function httpFetch(
    path: string,
    init: { method: 'GET' | 'POST'; body?: string },
  ): Promise<unknown> {
    const url = `${baseUrl}${path}`
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const headers: Record<string, string> = {
        'Grpc-Metadata-macaroon': options.macaroon,
      }
      if (init.body !== undefined) {
        headers['Content-Type'] = 'application/json'
      }
      const response = await fetchImpl(url, {
        method: init.method,
        headers,
        ...(init.body !== undefined ? { body: init.body } : {}),
        signal: controller.signal,
      })
      if (!response.ok) {
        const errorText = await readCappedText(response)
        throw new Error(
          `Voltage ${init.method} ${path} returned HTTP ${response.status}: ${errorText.slice(0, 200)}`,
        )
      }
      const text = await readCappedText(response)
      if (text.length === 0) {
        throw new Error(`Voltage ${init.method} ${path} returned an empty body.`)
      }
      try {
        return JSON.parse(text) as unknown
      } catch (parseErr) {
        const detail = parseErr instanceof Error ? `: ${parseErr.message}` : ''
        throw new Error(
          `Voltage ${init.method} ${path} returned non-JSON body${detail}.`,
        )
      }
    } finally {
      clearTimeout(timer)
    }
  }

  async function createInvoice(params: CreateInvoiceParams): Promise<VoltageInvoice> {
    validateCreateInvoiceParams(params)
    const body: Record<string, string> = {
      value_msat: String(params.amountMsat),
    }
    if (typeof params.memo === 'string' && params.memo.length > 0) {
      body.memo = params.memo
    }
    if (typeof params.expirySeconds === 'number' && params.expirySeconds > 0) {
      body.expiry = String(Math.floor(params.expirySeconds))
    }
    const raw = await httpFetch('/v1/invoices', {
      method: 'POST',
      body: JSON.stringify(body),
    })
    return normalizeInvoice(raw, params.amountMsat)
  }

  async function lookupInvoice(paymentHash: string): Promise<VoltageInvoice> {
    if (typeof paymentHash !== 'string' || !HEX_32_BYTES.test(paymentHash)) {
      throw new Error(
        `lookupInvoice: paymentHash must be a 32-byte hex string (64 hex chars); got ${JSON.stringify(
          paymentHash,
        )}.`,
      )
    }
    const raw = await httpFetch(
      `/v1/invoice/${encodeURIComponent(paymentHash.toLowerCase())}`,
      { method: 'GET' },
    )
    return normalizeInvoice(raw, null)
  }

  function decodePreimage(preimage: string): string {
    return sha256Hex(preimage)
  }

  return { createInvoice, lookupInvoice, decodePreimage }
}

// ─── Internal helpers ──────────────────────────────────────────────────────

function validateCreateInvoiceParams(params: CreateInvoiceParams): void {
  if (
    params === null ||
    params === undefined ||
    typeof params !== 'object' ||
    Array.isArray(params)
  ) {
    throw new TypeError('createInvoice: `params` must be a non-null object.')
  }
  if (
    typeof params.amountMsat !== 'number' ||
    !Number.isFinite(params.amountMsat) ||
    !Number.isInteger(params.amountMsat) ||
    params.amountMsat < 1
  ) {
    throw new RangeError(
      `createInvoice: \`amountMsat\` must be a positive integer (msat); got ${JSON.stringify(
        params.amountMsat,
      )}.`,
    )
  }
  if (params.memo !== undefined) {
    if (typeof params.memo !== 'string') {
      throw new TypeError('createInvoice: `memo` must be a string when supplied.')
    }
    if (params.memo.length > VOLTAGE_MAX_MEMO_CHARS) {
      throw new RangeError(
        `createInvoice: \`memo\` exceeds ${VOLTAGE_MAX_MEMO_CHARS}-char cap (got ${params.memo.length}).`,
      )
    }
  }
  if (params.expirySeconds !== undefined) {
    if (
      typeof params.expirySeconds !== 'number' ||
      !Number.isFinite(params.expirySeconds) ||
      params.expirySeconds < 1
    ) {
      throw new RangeError(
        `createInvoice: \`expirySeconds\` must be a positive finite number; got ${JSON.stringify(
          params.expirySeconds,
        )}.`,
      )
    }
  }
}

/**
 * Read at most VOLTAGE_MAX_BODY_BYTES from a Response as a UTF-8
 * string. A response longer than the cap is truncated AND the call
 * throws — we never silently operate on partial body content because
 * that could leak malformed JSON into downstream parsers. The cap
 * is a hard refusal, not a lenient "truncate and continue."
 */
async function readCappedText(response: Response): Promise<string> {
  const contentLengthHeader = response.headers.get('content-length')
  if (contentLengthHeader !== null) {
    const parsed = Number.parseInt(contentLengthHeader, 10)
    if (Number.isFinite(parsed) && parsed > VOLTAGE_MAX_BODY_BYTES) {
      throw new Error(
        `Voltage response body (${parsed} bytes) exceeds ${VOLTAGE_MAX_BODY_BYTES}-byte cap.`,
      )
    }
  }
  const text = await response.text()
  if (text.length > VOLTAGE_MAX_BODY_BYTES) {
    throw new Error(
      `Voltage response body (${text.length} chars) exceeds ${VOLTAGE_MAX_BODY_BYTES}-byte cap after materialization.`,
    )
  }
  return text
}

/**
 * Translate an LND-REST `invoice` payload into the adapter's
 * normalized shape. Handles both the msat-native form (`value_msat`)
 * and the legacy sat form (`value`) so the client tolerates the
 * Voltage node's LND minor-version drift.
 *
 * `expectedAmountMsat` is the client's pre-flight amount for
 * createInvoice; when provided and the server returns a mismatched
 * value, we throw rather than silently accepting the drift. For
 * `lookupInvoice` the expected amount is not known locally, so we
 * pass `null`.
 */
function normalizeInvoice(raw: unknown, expectedAmountMsat: number | null): VoltageInvoice {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error(
      `Voltage invoice response must be a non-null object; got ${typeof raw}.`,
    )
  }
  const body = raw as Record<string, unknown>

  const paymentRequest = typeof body.payment_request === 'string' ? body.payment_request : ''
  if (paymentRequest.length === 0) {
    throw new Error('Voltage invoice response missing `payment_request` string.')
  }

  // LND returns `r_hash` in BASE64 on POST /v1/invoices and in HEX on
  // GET /v1/invoice/{payment_hash}. Normalize to lowercase hex so the
  // adapter always compares hashes in one encoding.
  const paymentHash = extractPaymentHash(body)
  if (paymentHash === null) {
    throw new Error('Voltage invoice response missing `r_hash`.')
  }

  const amountMsat = extractAmountMsat(body)
  if (amountMsat === null) {
    throw new Error(
      'Voltage invoice response missing both `value_msat` and `value` fields.',
    )
  }
  if (expectedAmountMsat !== null && amountMsat !== expectedAmountMsat) {
    throw new Error(
      `Voltage returned amountMsat=${amountMsat}; expected ${expectedAmountMsat}.`,
    )
  }

  const expirySeconds = Number.parseInt(String(body.expiry ?? '3600'), 10)
  const creationDate = Number.parseInt(String(body.creation_date ?? '0'), 10)
  const settled = body.settled === true
  const settleDateRaw = body.settle_date
  const settleDate =
    settled && settleDateRaw !== undefined
      ? Number.parseInt(String(settleDateRaw), 10)
      : undefined

  return {
    paymentRequest,
    paymentHash,
    amountMsat,
    expirySeconds: Number.isFinite(expirySeconds) ? expirySeconds : 3600,
    creationDate: Number.isFinite(creationDate) ? creationDate : 0,
    settled,
    ...(settleDate !== undefined && Number.isFinite(settleDate)
      ? { settleDate }
      : {}),
  }
}

function extractPaymentHash(body: Record<string, unknown>): string | null {
  // Prefer `r_hash_str` when present (LND ≥ 0.15) — already hex.
  const hashStr = body.r_hash_str
  if (typeof hashStr === 'string' && HEX_32_BYTES.test(hashStr)) {
    return hashStr.toLowerCase()
  }
  const hashRaw = body.r_hash
  if (typeof hashRaw === 'string' && hashRaw.length > 0) {
    // Attempt hex first, fall back to base64. r_hash is base64 on
    // POST responses and hex on GET responses — we accept both.
    if (HEX_32_BYTES.test(hashRaw)) return hashRaw.toLowerCase()
    try {
      const decoded = Buffer.from(hashRaw, 'base64')
      if (decoded.length === 32) return decoded.toString('hex')
    } catch {
      // fall through
    }
  }
  return null
}

function extractAmountMsat(body: Record<string, unknown>): number | null {
  const msatRaw = body.value_msat
  if (msatRaw !== undefined) {
    const parsed = Number.parseInt(String(msatRaw), 10)
    if (Number.isFinite(parsed) && parsed >= 0) return parsed
  }
  const satRaw = body.value
  if (satRaw !== undefined) {
    const parsed = Number.parseInt(String(satRaw), 10)
    if (Number.isFinite(parsed) && parsed >= 0) return parsed * 1000
  }
  return null
}
