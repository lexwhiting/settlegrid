/**
 * V-N3-log-redaction (H1 + M1) — a sanitizing `AdapterLogger` seam.
 *
 * Every `apps/web/src/lib/*-proxy.ts` wrapper injects an `appLogger` into its
 * `@settlegrid/mcp` adapter core (`logger: appLogger`). Those cores log raw
 * payer/nonce meta on SettleGrid's HOSTED settling paths:
 *   - `packages/mcp/src/adapters/x402.ts`        `x402.payment_accepted_local { payerAddress }`
 *   - `packages/mcp/src/adapters/drain.ts`       `drain.payment_accepted { payerAddress, nonce }`
 *   - `packages/mcp/src/adapters/circle-nano.ts` `circle_nano.proof_structurally_valid { payer }`
 * plus the app-side H1 site (`circle-nano-proxy.ts` `circle_nano.payment_validated`).
 * Because the old forwarding `appLogger` passed the meta straight to
 * `@/lib/logger` (→ stdout + Sentry), those STRUCTURED keys bypassed the central
 * `emit()` free-text sanitizer and egressed the raw EVM payer (+ channel nonce).
 *
 * We do NOT redact inside `packages/mcp`: a self-hoster's raw payer in THEIR own
 * injected logger is THEIR data, not a SettleGrid leak. The fix lives at the
 * SettleGrid seam — this factory returns an `AdapterLogger` that strips the
 * payer-identifying meta keys (redacting hex/op_id-shaped values via
 * {@link redactLogString}) before forwarding to `@/lib/logger`. One seam closes
 * H1, every M1 adapter site, and any future adapter log addition at once; the
 * `err` 3rd argument is still sanitized centrally by `emit()` (channel B).
 *
 * Correlation is preserved: only the payer key set is touched — `toolSlug`,
 * `network`, `amountBaseUnits`, a row `id`, etc. pass through untouched.
 *
 * B4 (channelId DECISION — STRIP): the drain adapter logs
 * `channelId: voucher.channelAddress` — a raw EVM payment-channel CONTRACT
 * address (`0x<40>`). It is NOT the payer EOA, but it is a per-channel on-chain
 * identifier that compounds the channel nonce, and the seam's no-raw-address
 * posture should hold for it too. So `channelId`/`channelAddress` are added to
 * the stripped key set (redacted to `0x<redacted>`). This is SAFE for
 * observability: the drain runbook recovers `(channelAddress, nonce)` from the
 * DB row by `id`, never from the log.
 *
 * B1 (non-string values — DROP): a payer key whose value is NOT a string (the
 * drain channel `nonce` is a `number`; a future payer could be a bigint/object)
 * escapes {@link redactLogString} — `String(42) === '42'` has no `0x`/≥40-hex
 * shape, so coerce-and-redact would forward it VERBATIM. Such values are DROPPED
 * entirely (correlation rides on `toolSlug`/row `id`/`amountBaseUnits`).
 */

import type { AdapterLogger } from '@settlegrid/mcp'
import { logger } from './logger'
import { redactLogString } from './settlement/log-redaction'

/**
 * The payer-identifying meta keys the injected adapter loggers emit. In every
 * known site the value is a raw EVM address (`0x<40>`), an EIP-3009 / channel
 * nonce (`0x<64>`), a payer-bearing op_id, or a numeric channel nonce. A STRING
 * value is reduced by {@link redactLogString} (`0x…` → `0x<redacted>`,
 * `{rail}:{network}:{payer}:{nonce}` → `{rail}:{network}:anon`); a NON-STRING
 * value (the drain channel `nonce: number`) is DROPPED (B1). `channelId` /
 * `channelAddress` (the raw drain channel contract address) are stripped too (B4).
 * A non-hex string under one of these keys (none in practice) is left as-is by
 * `redactLogString` and so passes through.
 */
const PAYER_META_KEYS = [
  'payer',
  'payerAddress',
  'payerIdentifier',
  'from',
  'nonce',
  'drainNonce',
  'channelId',
  'channelAddress',
] as const

/**
 * Redact the payer key set from an adapter meta object, copy-on-write: a meta
 * with nothing to redact is forwarded by reference (never reallocated), matching
 * the zero-overhead contract of the prior pass-through `appLogger`. Pure.
 */
function sanitizeAdapterMeta(
  data: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (!data) return data
  let copy: Record<string, unknown> | undefined
  for (const k of PAYER_META_KEYS) {
    if (!(k in data)) continue
    const v = data[k]
    if (typeof v === 'string') {
      const red = redactLogString(v)
      if (red !== v) {
        copy ??= { ...data }
        copy[k] = red
      }
      continue
    }
    // B1: a NON-STRING value under a payer key (the drain channel `nonce` is a
    // `number`; a future payer could be a bigint/object) escapes redactLogString
    // — `String(42) === '42'` has no `0x`/≥40-hex shape, so coerce-and-redact
    // would forward it verbatim. DROP the key entirely.
    copy ??= { ...data }
    delete copy[k]
  }
  return copy ?? data
}

/**
 * Build an `AdapterLogger` that sanitizes the payer key set before forwarding to
 * `@/lib/logger`. Drop-in replacement for the per-file forwarding `appLogger`
 * (`data ?? {}` preserved so an undefined meta still emits `{}`).
 */
export function createSanitizingAdapterLogger(): AdapterLogger {
  return {
    info: (event, data) => logger.info(event, sanitizeAdapterMeta(data) ?? {}),
    warn: (event, data) => logger.warn(event, sanitizeAdapterMeta(data) ?? {}),
    error: (event, data, err) => logger.error(event, sanitizeAdapterMeta(data) ?? {}, err),
  }
}
