/**
 * Error classes for @settlegrid/client. Each carries a machine-readable
 * `code` plus context fields so callers can branch without string-matching
 * on `.message`.
 *
 * All errors extend the native `Error` class rather than a shared base
 * (the class is tiny enough that a base doesn't pay for itself and a
 * native-Error lineage keeps the types compatible with generic
 * `try/catch (err: Error)` handlers).
 */

/**
 * Thrown before any payment is constructed when the cheapest supported
 * rail's cost exceeds the caller's `maxCostCents` budget.
 *
 * The hostile-lens contract is that the cost check fires BEFORE any
 * payment is built — callers can rely on `BudgetExceededError` meaning
 * "no wallet was touched, no HTTP retry was issued, no spend occurred".
 */
export class BudgetExceededError extends Error {
  readonly name = 'BudgetExceededError'
  readonly code = 'budget_exceeded' as const
  readonly costCents: number
  readonly maxCostCents: number
  readonly rail: string
  readonly toolUrl: string

  constructor(init: {
    costCents: number
    maxCostCents: number
    rail: string
    toolUrl: string
  }) {
    super(
      `Budget exceeded for ${init.toolUrl}: cheapest supported rail ` +
        `'${init.rail}' requires ${init.costCents} cents but maxCostCents is ${init.maxCostCents}.`,
    )
    this.costCents = init.costCents
    this.maxCostCents = init.maxCostCents
    this.rail = init.rail
    this.toolUrl = init.toolUrl
    // The `new.target.prototype` pattern preserves instanceof across
    // transpilation targets where native class extension would otherwise
    // drop the subclass chain (ES5 emit, some Jest + Vite combos).
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

/**
 * Thrown when the 402 manifest advertises no rail that both (a) is in
 * the client's supported-payer registry AND (b) has a configured wallet
 * the client can use to pay. Callers should surface this to the human
 * operator so they can provision a wallet for one of the listed rails.
 */
export class NoSupportedProtocolError extends Error {
  readonly name = 'NoSupportedProtocolError'
  readonly code = 'no_supported_protocol' as const
  readonly advertisedSchemes: readonly string[]
  readonly toolUrl: string

  constructor(init: { advertisedSchemes: readonly string[]; toolUrl: string }) {
    super(
      `No wallet configured for any rail advertised by ${init.toolUrl}. ` +
        `Server accepts: [${init.advertisedSchemes.join(', ') || 'none'}]. ` +
        `Configure a wallet via createSettleGridClient({ wallets: { ... } }) ` +
        `for at least one of these rails.`,
    )
    this.advertisedSchemes = init.advertisedSchemes
    this.toolUrl = init.toolUrl
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

/**
 * Thrown when the server returned 402 but the response body was not a
 * parseable PaymentRequiredBody (wrong shape, invalid JSON, missing
 * `accepts` array, etc.) or the body exceeded the client's size cap.
 */
export class MalformedManifestError extends Error {
  readonly name = 'MalformedManifestError'
  readonly code = 'malformed_manifest' as const
  readonly toolUrl: string
  readonly reason: string

  constructor(init: { toolUrl: string; reason: string }) {
    super(`Malformed 402 manifest from ${init.toolUrl}: ${init.reason}`)
    this.toolUrl = init.toolUrl
    this.reason = init.reason
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

/**
 * Thrown when the server returned a non-2xx non-402 status code on
 * either the initial request or the post-payment retry. Wraps the
 * status + a snippet of the response body for debugging.
 */
export class UnexpectedStatusError extends Error {
  readonly name = 'UnexpectedStatusError'
  readonly code = 'unexpected_status' as const
  readonly status: number
  readonly toolUrl: string
  readonly bodySnippet: string

  constructor(init: { status: number; toolUrl: string; bodySnippet: string }) {
    super(
      `Unexpected HTTP ${init.status} from ${init.toolUrl}. ` +
        `Body: ${init.bodySnippet.slice(0, 200)}`,
    )
    this.status = init.status
    this.toolUrl = init.toolUrl
    this.bodySnippet = init.bodySnippet
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

/**
 * Thrown when a caller passes invalid configuration to
 * `createSettleGridClient` or `client.call(...)`. Separate class
 * from the runtime errors so a misuse bug is distinguishable from a
 * network / server error in log aggregation.
 */
export class ClientConfigurationError extends Error {
  readonly name = 'ClientConfigurationError'
  readonly code = 'configuration_error' as const
  readonly field: string

  constructor(init: { field: string; reason: string }) {
    super(`Invalid client configuration for \`${init.field}\`: ${init.reason}`)
    this.field = init.field
    Object.setPrototypeOf(this, new.target.prototype)
  }
}
