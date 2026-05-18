/**
 * Shared template-pricing helpers — the single source of truth for
 *
 *   1. extracting per-method pricing from a template's `src/server.ts`
 *      (the `pricing` object passed to `settlegrid.init()`), and
 *   2. rendering the price-dependent Monetization sections of a
 *      template's `monetization.md` and `README.md`.
 *
 * `src/server.ts` is the source of truth for pricing: it is what the SDK
 * actually meters on (`resolveOperationCost()` looks up
 * `pricing.methods[method].costCents`). `template.json` and the doc files
 * are downstream projections. Every generator that touches pricing —
 * `scripts/template-audit/backfill-p3-2-manifests.ts` (manifest backfill),
 * `scripts/polish-canonical.ts` (canonical-20 polish), and
 * `scripts/sync-template-pricing.ts` (the gallery pricing sync) — funnels
 * through THIS module so the fee math and rendered tables stay identical
 * everywhere. Do not fork this logic.
 *
 * Fee model (SettleGrid canonical, house style): 0% take on a developer's
 * first $1,000/mo of revenue, then 2–5% volume-tiered above it. Worked
 * examples below use the conservative top of that band (5%), matching the
 * established `monetization.md` voice.
 */

// ── Pricing extraction (server.ts → ServerPricing) ──────────────────────────

/** A single method's pricing — mirrors the SDK's `pricing.methods` entry. */
export interface MethodPricing {
  costCents: number
  displayName?: string
  unitType?: string
}

/** Pricing extracted from a template's `settlegrid.init({ pricing })` call. */
export interface ServerPricing {
  /** `pricing.defaultCostCents` — falls back to 1 when absent/unparseable. */
  defaultCostCents: number
  /** `pricing.methods` keyed by method name; omitted when no block found. */
  methods?: Record<string, MethodPricing>
}

/**
 * Given `src` and the index of an opening `{`, return the index of its
 * matching `}`. String literals (`'`, `"`, `` ` ``) are skipped so a brace
 * inside a string cannot throw off the depth count. Returns -1 if unmatched.
 */
function matchBrace(src: string, openIdx: number): number {
  let depth = 0
  let quote: string | null = null
  for (let i = openIdx; i < src.length; i++) {
    const c = src[i]
    if (quote) {
      if (c === '\\') {
        i++ // skip the escaped char
        continue
      }
      if (c === quote) quote = null
      continue
    }
    if (c === "'" || c === '"' || c === '`') {
      quote = c
    } else if (c === '{') {
      depth++
    } else if (c === '}') {
      depth--
      if (depth === 0) return i
    }
  }
  return -1
}

/**
 * Slice out the brace-delimited object literal that follows `<key>:` in
 * `src`, braces included. Returns null when the key or a balanced object
 * is not found.
 */
function sliceObjectAfterKey(src: string, key: string): string | null {
  const keyRe = new RegExp(`\\b${key}\\s*:\\s*\\{`)
  const m = keyRe.exec(src)
  if (!m) return null
  const openIdx = m.index + m[0].length - 1 // m[0] ends with '{'
  const closeIdx = matchBrace(src, openIdx)
  if (closeIdx === -1) return null
  return src.slice(openIdx, closeIdx + 1)
}

/**
 * Extract a single-/double-/backtick-quoted string field `<key>: '...'`
 * from `src`, returning its unescaped value or null when absent.
 */
function extractStringField(src: string, key: string): string | null {
  const re = new RegExp(
    `\\b${key}\\s*:\\s*(['"\`])((?:\\\\.|(?!\\1)[\\s\\S])*)\\1`,
  )
  const m = re.exec(src)
  if (!m) return null
  return m[2].replace(/\\(.)/g, '$1')
}

/**
 * Extract `{ defaultCostCents, methods? }` from a template's `server.ts`.
 *
 * Regex- and brace-matching-based (no AST parser is shipped here), which is
 * sound because every template's `pricing` object is a plain data literal:
 * integers, quoted strings, and one level of nested objects. The `methods`
 * map preserves source order.
 */
export function extractServerPricing(serverTs: string): ServerPricing {
  const pricingBlock = sliceObjectAfterKey(serverTs, 'pricing')
  if (!pricingBlock) return { defaultCostCents: 1 }

  const dcMatch = pricingBlock.match(/\bdefaultCostCents\s*:\s*(\d+)/)
  const defaultCostCents = dcMatch ? Number.parseInt(dcMatch[1], 10) : 1

  const methodsBlock = sliceObjectAfterKey(pricingBlock, 'methods')
  if (!methodsBlock) return { defaultCostCents }

  const methods: Record<string, MethodPricing> = {}
  // Body without the enclosing braces; scan top-level `name: { ... }` pairs.
  const body = methodsBlock.slice(1, -1)
  const entryRe = /([A-Za-z_$][\w$]*)\s*:\s*\{/g
  let m: RegExpExecArray | null
  while ((m = entryRe.exec(body)) !== null) {
    const name = m[1]
    const innerOpen = m.index + m[0].length - 1
    const innerClose = matchBrace(body, innerOpen)
    if (innerClose === -1) break
    const inner = body.slice(innerOpen, innerClose + 1)
    // Advance past this entry so inner keys are never matched as entries.
    entryRe.lastIndex = innerClose + 1

    const costMatch = inner.match(/\bcostCents\s*:\s*(\d+)/)
    if (!costMatch) continue // not a pricing entry — skip defensively
    const entry: MethodPricing = {
      costCents: Number.parseInt(costMatch[1], 10),
    }
    const displayName = extractStringField(inner, 'displayName')
    if (displayName !== null) entry.displayName = displayName
    const unitType = extractStringField(inner, 'unitType')
    if (unitType !== null) entry.unitType = unitType
    methods[name] = entry
  }

  return Object.keys(methods).length > 0
    ? { defaultCostCents, methods }
    : { defaultCostCents }
}

// ── Revenue math ────────────────────────────────────────────────────────────

/** Monthly revenue (USD) below which SettleGrid takes 0%. */
export const FEE_FREE_THRESHOLD_USD = 1000

/**
 * Conservative take rate used for worked examples — the top of the
 * canonical 2–5% band. Keeping every doc on the same rate makes the
 * generated tables reproducible and the figures defensible (revenue is
 * never overstated).
 */
export const EXAMPLE_TAKE_RATE = 0.05

export interface RevenueBreakdown {
  /** Gross monthly revenue in USD before any fee. */
  grossUsd: number
  /** SettleGrid fee in USD (0 below the fee-free threshold). */
  feeUsd: number
  /** Developer's net revenue in USD after the fee. */
  netUsd: number
  /** Whether any fee applies (gross is above the fee-free threshold). */
  feeApplies: boolean
}

/** Revenue breakdown for `calls` invocations at `priceCents` per call. */
export function revenueFor(priceCents: number, calls: number): RevenueBreakdown {
  const grossUsd = (calls * priceCents) / 100
  const feeApplies = grossUsd > FEE_FREE_THRESHOLD_USD
  const feeUsd = feeApplies
    ? (grossUsd - FEE_FREE_THRESHOLD_USD) * EXAMPLE_TAKE_RATE
    : 0
  return { grossUsd, feeUsd, netUsd: grossUsd - feeUsd, feeApplies }
}

// ── Formatting helpers ──────────────────────────────────────────────────────

const CENT = '¢' // ¢
const NDASH = '–' // –
const APPROX = '≈' // ≈

/** `1234.5` → `$1,234` (whole-dollar, comma-grouped). */
function usd(n: number): string {
  return `$${Math.round(n).toLocaleString('en-US')}`
}

/** `0.02` → `$0.02` (two decimals). */
function usd2(n: number): string {
  return `$${n.toFixed(2)}`
}

/** `0.02` → `$0.0200` (four decimals — per-call amounts). */
function usd4(n: number): string {
  return `$${n.toFixed(4)}`
}

// ── Document section renderers ──────────────────────────────────────────────

const EXAMPLE_CALL_VOLUMES = [1_000, 10_000, 100_000, 1_000_000]

/**
 * Render the `## Revenue Model` + `## Revenue Examples` sections of a
 * template's `monetization.md` for a per-call price of `priceCents`.
 *
 * The returned string starts at `## Revenue Model` and ends with the final
 * table row plus a trailing newline — it is spliced in ahead of the static
 * `## How It Works` section, which callers preserve verbatim.
 */
export function renderMonetizationSections(priceCents: number): string {
  const perCall = priceCents / 100

  const exampleRows = EXAMPLE_CALL_VOLUMES.map((calls) => {
    const { grossUsd, feeUsd, netUsd, feeApplies } = revenueFor(
      priceCents,
      calls,
    )
    let feeCell: string
    if (!feeApplies) {
      feeCell =
        grossUsd === FEE_FREE_THRESHOLD_USD
          ? `**$0** (at $1k cap)`
          : `**$0** (under $1k)`
    } else {
      const aboveUsd = grossUsd - FEE_FREE_THRESHOLD_USD
      feeCell = `~${usd(feeUsd)} (${APPROX}5% on $${aboveUsd / 1000}k above $1k)`
    }
    const netCell = feeApplies ? `**~${usd(netUsd)}**` : `**${usd(netUsd)}**`
    return `| ${calls.toLocaleString('en-US')} | ${usd(grossUsd)} | ${feeCell} | ${netCell} |`
  }).join('\n')

  return `## Revenue Model

This template uses **per-call pricing** via SettleGrid with **progressive
take rates**. The first $1,000 of monthly revenue per developer is
fee-free; tiered fees apply only above that threshold.

| Tier | SettleGrid take | Your share |
|------|-----------------|------------|
| First $1,000 / month | **0%** | **100%** |
| Above $1,000 / month | **2${NDASH}5%** (volume-tiered) | **95${NDASH}98%** |

| Metric | Value |
|--------|-------|
| **Price per call** | ${usd2(perCall)} (${priceCents}${CENT}) |
| **Your revenue per call ${NDASH} first $1,000/mo** | ${usd4(perCall)} (100%) |
| **Your revenue per call ${NDASH} above $1,000/mo** | ${usd4(perCall * 0.95)}${NDASH}${usd4(perCall * 0.98)} |

## Revenue Examples (at ${usd2(perCall)} / call)

| Monthly Calls | Gross Revenue | SettleGrid Fee | Your Revenue |
|---------------|---------------|----------------|--------------|
${exampleRows}
`
}

/**
 * Render the `## Monetization` section of a template's `README.md` for a
 * per-call price of `priceCents`. Starts at the `## Monetization` heading
 * and ends with the `See [monetization.md]` line plus a trailing newline.
 */
export function renderReadmeMonetization(priceCents: number): string {
  const rows = [1_000, 10_000, 100_000]
    .map((calls) => {
      const { netUsd, feeApplies } = revenueFor(priceCents, calls)
      const cell = feeApplies ? `~${usd(netUsd)}` : usd(netUsd)
      return `| ${calls.toLocaleString('en-US')} | ${cell} |`
    })
    .join('\n')

  return `## Monetization

Turn this template into a revenue stream. At the default ${priceCents}${CENT}/call pricing, SettleGrid takes 0% on your first $1,000/mo of revenue (then 2${NDASH}5%, volume-tiered, above it):

| Monthly Calls | Your Revenue |
|---------------|--------------|
${rows}

See [monetization.md](monetization.md) for full pricing math and payout details.
`
}
