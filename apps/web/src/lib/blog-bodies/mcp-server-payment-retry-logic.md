MCP server payment retry logic is not the same problem as retry logic in a conventional REST API. When a payment fails on a standard API — say, a user's credit card declines on a SaaS checkout — the user sees an error, fixes their billing info, and tries again. The loop is short, human-supervised, and stateful in an obvious way.

In an agentic workflow, none of those properties hold. An AI agent may call your tool dozens of times inside a single planning loop. It may retry automatically on any error it cannot parse. It may time out and silently abandon mid-session, leaving partially-executed tasks and unmetered invocations behind. Or it may loop on a transient error and rack up duplicate charges before the upstream orchestrator notices something is wrong.

This guide covers the full failure surface for MCP tool monetization using the `@settlegrid/mcp` SDK: what errors fire and when, how to build idempotent retry logic that survives agent loops, how to do preflight credit validation before expensive compute, and how to configure graceful degradation so your tool stays available during infrastructure outages. For a broader introduction to monetizing an MCP server from scratch, see [How to Monetize an MCP Server](https://settlegrid.ai/learn/blog/how-to-monetize-mcp-server) for related context.

## Why MCP Server Payment Retry Logic Is Different From Conventional API Billing

Conventional API billing assumes a human or a deterministic client on the other end. The client sends a request, gets a response, and either handles the error or surfaces it to a person. The retry loop is short by design.

Agentic workflows break each of those assumptions:

**Non-deterministic retry behavior.** An LLM agent deciding to retry a failed tool call may do so based on instructions that say "if a tool fails, try it again up to three times." The agent does not distinguish between a network blip and an `InsufficientCreditsError`. Without structured error codes in your response, the agent will retry a funds-exhausted call three times before giving up — charging you nothing if the key is empty, but wasting compute and causing confusing logs.

**Mid-session abandonment.** A long-running agent session may time out at the orchestration layer while your tool handler is mid-execution. The `sg.meter()` call may fire after the agent has already moved on, recording a charge against a consumer who never received the result. Without idempotency tokens, you have no way to detect or reconcile this.

**Parallelized invocations.** Some orchestrators fan out tool calls in parallel. If your tool does not deduplicate on a client-supplied request ID, the same logical operation can be charged multiple times when two branches of the plan issue the same call within milliseconds of each other.

**Slow billing paths blocking fast tool paths.** If your `timeoutMs` is set to the default 5000ms and SettleGrid is experiencing elevated latency, your tool response time degrades even though the tool itself is fast. Agents have their own timeout budgets. A billing-induced timeout looks identical to a tool failure from the agent's perspective.

The sections below address each of these failure modes directly.

## Mapping the Error Surface: InvalidKeyError, InsufficientCreditsError, TimeoutError, and When Each Fires

The `@settlegrid/mcp` SDK throws eight distinct error types. Each represents a different failure category and warrants a different response strategy.

| Error | When it fires | Retryable? | Agent guidance |
|---|---|---|---|
| `InvalidKeyError` | Key is empty, malformed, or not registered | No | Return a structured 401 — the agent needs a valid key |
| `InsufficientCreditsError` | Consumer balance is below method cost | No | Return a structured 402 — retrying burns compute for nothing |
| `ToolNotFoundError` | `toolSlug` does not match a registered tool | No | Configuration error — surface immediately |
| `ToolDisabledError` | Tool exists but has been disabled | No | Surface immediately — not a transient condition |
| `RateLimitedError` | Consumer has exceeded their rate limit | Yes, with backoff | Return a structured 429 with a retry hint |
| `SettleGridUnavailableError` | SettleGrid API returned 5xx | Yes | Degrade gracefully or retry after delay |
| `NetworkError` | Network failure reaching SettleGrid | Yes | Retry with exponential backoff |
| `TimeoutError` | Request to SettleGrid exceeded `timeoutMs` | Yes | Degrade gracefully or retry |

The critical distinction is between **non-retryable billing errors** (`InvalidKeyError`, `InsufficientCreditsError`) and **transient infrastructure errors** (`NetworkError`, `TimeoutError`, `SettleGridUnavailableError`). If your error handler treats all eight the same way, agents will retry non-retryable errors — wasting their token budget and your compute.

For additional context on how per-call billing interacts with agent orchestration patterns, see [Per-Call Billing for AI Agents](https://settlegrid.ai/learn/blog/per-call-billing-ai-agents).

## Implementing Idempotent Retry Logic With sg.wrap() and Structured Error Handling

### Structured error responses

The first requirement is that every error case returns a payload the agent can branch on. MCP tool responses are JSON; there is no HTTP status code for the agent to inspect. That means your error payloads need to carry a machine-readable `error.code` field.

The `search` and `analyze` functions referenced in the examples below are placeholders for your real tool logic — they are not part of the SDK. Define them as stubs (`async function search(query) { return [] }`) if you are running these snippets locally before wiring in your actual implementation.

```typescript
import { settlegrid } from '@settlegrid/mcp'
import {
  InvalidKeyError,
  InsufficientCreditsError,
  RateLimitedError,
  SettleGridUnavailableError,
  NetworkError,
} from '@settlegrid/mcp'
import { TimeoutError } from '@settlegrid/mcp'

// Placeholder — replace with your actual search implementation
async function search(query: string): Promise<{ results: string[] }> {
  return { results: [] }
}

const sg = settlegrid.init({
  toolSlug: 'my-search-tool',
  pricing: {
    defaultCostCents: 2,
    methods: {
      search: { costCents: 5 },
      analyze: { costCents: 10 },
    },
  },
})

const searchHandler = sg.wrap(
  async (args: { query: string }) => {
    const results = await search(args.query)
    return { content: [{ type: 'text', text: JSON.stringify(results) }] }
  },
  { method: 'search' }
)

export async function handleSearchTool(args: { query: string }, context: unknown) {
  try {
    return await searchHandler(args, context)
  } catch (err) {
    if (err instanceof InvalidKeyError) {
      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              error: {
                code: 'INVALID_KEY',
                message: 'The provided API key is not valid. Obtain a key from the tool publisher.',
                retryable: false,
              },
            }),
          },
        ],
      }
    }

    if (err instanceof InsufficientCreditsError) {
      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              error: {
                code: 'INSUFFICIENT_CREDITS',
                message: 'Consumer balance is too low for this operation. Top up at settlegrid.ai.',
                retryable: false,
              },
            }),
          },
        ],
      }
    }

    if (err instanceof RateLimitedError) {
      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              error: {
                code: 'RATE_LIMITED',
                message: 'Rate limit exceeded. Wait before retrying.',
                retryable: true,
                retryAfterMs: 5000,
              },
            }),
          },
        ],
      }
    }

    if (err instanceof TimeoutError || err instanceof SettleGridUnavailableError) {
      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              error: {
                code: 'BILLING_UNAVAILABLE',
                message: 'Billing infrastructure is temporarily unavailable.',
                retryable: true,
                retryAfterMs: 2000,
              },
            }),
          },
        ],
      }
    }

    if (err instanceof NetworkError) {
      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              error: {
                code: 'NETWORK_ERROR',
                message: 'Network failure communicating with billing service.',
                retryable: true,
                retryAfterMs: 1000,
              },
            }),
          },
        ],
      }
    }

    // Unknown error — do not swallow
    throw err
  }
}
```

The `retryable: boolean` field is the key addition here. An agent that parses this payload can branch: if `retryable` is false, it should not retry and should surface the issue to the user. If `retryable` is true, it can apply backoff and try again. Agents that do not parse structured errors will at least get a descriptive `message` instead of a generic exception string.

### Idempotency wrapper using sg.meter()

`sg.wrap()` handles metering automatically, but it does not perform deduplication across repeated invocations with the same logical request ID. In agent workflows where the orchestrator may retry the same call on transient failure, you can end up charging twice for one operation.

The pattern below uses a client-supplied `requestId` stored in a `Map` to detect duplicates within a configurable window. When a `requestId` is seen for the first time, the handler executes and calls `sg.meter()` directly. On repeat calls within the deduplication window, the cached result is returned without metering.

Note: this pattern uses `sg.meter()` manually, which means you are responsible for running your handler logic before the meter call. `sg.validateKey()` is used as a preflight check so you can confirm the key is valid and has sufficient balance before running compute.

```typescript
import { settlegrid } from '@settlegrid/mcp'
import { InvalidKeyError, InsufficientCreditsError } from '@settlegrid/mcp'

// Placeholder — replace with your actual analysis implementation
async function analyze(payload: unknown): Promise<{ summary: string }> {
  return { summary: '' }
}

const sg = settlegrid.init({
  toolSlug: 'my-analysis-tool',
  pricing: {
    defaultCostCents: 2,
    methods: {
      analyze: { costCents: 10 },
    },
  },
})

const DEDUP_WINDOW_MS = 60_000 // 60 seconds

interface CachedResult {
  result: unknown
  expiresAt: number
}

const requestCache = new Map<string, CachedResult>()

function pruneExpiredEntries() {
  const now = Date.now()
  for (const [key, entry] of requestCache) {
    if (entry.expiresAt < now) {
      requestCache.delete(key)
    }
  }
}

export async function idempotentAnalyze(
  args: { payload: unknown; requestId: string },
  apiKey: string
): Promise<unknown> {
  pruneExpiredEntries()

  const cached = requestCache.get(args.requestId)
  if (cached && cached.expiresAt > Date.now()) {
    // Duplicate invocation within the deduplication window — return cached result
    return cached.result
  }

  // Preflight: validate the key and check balance before doing any work
  const keyCheck = await sg.validateKey(apiKey)
  if (!keyCheck.valid) {
    throw new InvalidKeyError('API key is not valid')
  }
  if (keyCheck.balanceCents < 10) {
    // 10 cents is the cost of the analyze method
    throw new InsufficientCreditsError('Balance too low for analyze (requires 10 cents)')
  }

  // Execute the tool logic
  const result = await analyze(args.payload)

  // Meter only after successful execution, only for unseen request IDs
  await sg.meter(apiKey, 'analyze')

  // Cache the result for the deduplication window
  requestCache.set(args.requestId, {
    result,
    expiresAt: Date.now() + DEDUP_WINDOW_MS,
  })

  return result
}
```

A few design notes on this pattern:

- The `requestId` must come from the calling agent, not be generated server-side. A server-generated ID defeats deduplication because each invocation generates a new one.
- `sg.meter()` is called after execution succeeds. This means a tool crash before `sg.meter()` results in unmetered execution. For high-cost operations this is the correct trade-off — charging for failed executions creates worse user experience than occasionally losing revenue on crashes.
- `DEDUP_WINDOW_MS` should be set to at least as long as your agent's session timeout. If agents can retry over a 30-second window, a 60-second deduplication window covers the overlap with margin.

## Graceful Degradation Patterns: Letting Agents Fail Loudly vs Failing Silently

There are two distinct degradation decisions to make:

1. **When SettleGrid is unavailable** — should the tool execute without metering, or refuse to execute?
2. **When the consumer has no funds** — should the tool return a partial result, or refuse entirely?

For (2), the answer is almost always to refuse. Returning partial results for an unmetered call trains agents to expect inconsistent tool behavior and makes revenue reconciliation impossible.

For (1), the answer depends on your tool's sensitivity. A tool that provides data of real commercial value should refuse to execute without billing. A tool where downtime is more costly than lost revenue — for example, a health-check or status tool — can proceed in a no-metering mode with explicit logging.

The `settlegrid.init()` configuration below sets a short `timeoutMs` appropriate for a latency-sensitive tool, enables `debug` mode for local development, and uses a fallback wrapper to handle `TimeoutError` and `SettleGridUnavailableError` by proceeding without metering:

```typescript
import { settlegrid } from '@settlegrid/mcp'
import { TimeoutError, SettleGridUnavailableError, NetworkError } from '@settlegrid/mcp'

// Placeholder — replace with your real tool logic
async function fetchStatus(resourceId: string): Promise<{ status: string }> {
  return { status: 'ok' }
}

// Production config: tight timeout, no debug
const sg = settlegrid.init({
  toolSlug: 'status-checker',
  debug: process.env.NODE_ENV !== 'production',
  timeoutMs: 3000,   // Fail fast — do not let billing delay the tool response
  cacheTtlMs: 60000, // 1-minute key validation cache to reduce round-trips
  pricing: {
    defaultCostCents: 1,
  },
})

const statusHandler = sg.wrap(
  async (args: { resourceId: string }) => {
    const status = await fetchStatus(args.resourceId)
    return { content: [{ type: 'text', text: JSON.stringify(status) }] }
  }
)

export async function handleStatusTool(
  args: { resourceId: string },
  context: unknown
): Promise<unknown> {
  try {
    return await statusHandler(args, context)
  } catch (err) {
    if (
      err instanceof TimeoutError ||
      err instanceof SettleGridUnavailableError ||
      err instanceof NetworkError
    ) {
      // Billing infrastructure is down — execute without metering
      // Log clearly so this is visible in monitoring
      console.warn(
        '[SettleGrid] Degraded mode: billing unavailable, executing without metering.',
        {
          error: err.constructor.name,
          message: (err as Error).message,
          toolSlug: 'status-checker',
          timestamp: new Date().toISOString(),
        }
      )

      // Execute the underlying logic directly, bypassing billing
      const result = await fetchStatus(args.resourceId)
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              ...result,
              _meta: { billingStatus: 'degraded', reason: err.constructor.name },
            }),
          },
        ],
      }
    }

    // Re-throw billing errors (InvalidKeyError, InsufficientCreditsError, etc.)
    // These are not infrastructure failures — do not degrade for them
    throw err
  }
}
```

Setting `debug: true` in non-production environments forces synchronous metering, which means the meter call completes before the response returns. This makes it easier to verify metering behavior in integration tests because you can assert on the meter result in the same tick. In production, metering is fire-and-forget and does not add to response latency.

The `timeoutMs: 3000` setting is deliberately shorter than the SDK default of 5000ms. For a status-checking tool where the underlying call is fast, a 5-second billing timeout is longer than the tool response the agent expects. Tune this value to the p99 of your own tool's execution time.

## Testing Your Retry Logic With debug Mode and sg_test_ Keys Before Going Live

The `sg_test_*` key format connects to SettleGrid's test environment. Validation, credit checking, and metering all run, but no real money moves. This lets you exercise every error path — including `InsufficientCreditsError` — without affecting live balances.

For local development, the recommended configuration is:

```typescript
import { settlegrid } from '@settlegrid/mcp'
import {
  InvalidKeyError,
  InsufficientCreditsError,
  RateLimitedError,
  NetworkError,
  TimeoutError,
  SettleGridUnavailableError,
} from '@settlegrid/mcp'

// Placeholder — replace with your real search and analysis implementations
async function runVectorSearch(query: string): Promise<{ results: string[] }> {
  return { results: [`result for: ${query}`] }
}

async function runDeepAnalysis(data: unknown): Promise<{ summary: string }> {
  return { summary: 'analysis complete' }
}

// Local dev config
const sg = settlegrid.init({
  toolSlug: 'research-tool',
  debug: true,       // Synchronous metering — easier to test
  timeoutMs: 3000,   // Fail fast in tests
  pricing: {
    defaultCostCents: 2,
    methods: {
      search: { costCents: 5 },
      analyze: { costCents: 10 },
    },
  },
})

// Retry harness with exponential backoff for transient errors
async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts: number,
  baseDelayMs: number
): Promise<T> {
  let lastError: unknown
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (err) {
      if (
        err instanceof NetworkError ||
        err instanceof TimeoutError ||
        err instanceof SettleGridUnavailableError
      ) {
        lastError = err
        const delay = baseDelayMs * Math.pow(2, attempt)
        await new Promise((resolve) => setTimeout(resolve, delay))
        continue
      }
      // Non-retryable error — surface immediately
      throw err
    }
  }
  throw lastError
}

// Search handler with per-method cost and retry harness
const searchHandler = sg.wrap(
  async (args: { query: string }) => {
    const results = await runVectorSearch(args.query)
    return { content: [{ type: 'text', text: JSON.stringify(results) }] }
  },
  { method: 'search' }  // Picks up costCents: 5 from pricing config
)

// Analyze handler with per-method cost and retry harness
const analyzeHandler = sg.wrap(
  async (args: { data: unknown }) => {
    const analysis = await runDeepAnalysis(args.data)
    return { content: [{ type: 'text', text: JSON.stringify(analysis) }] }
  },
  { method: 'analyze' }  // Picks up costCents: 10 from pricing config
)

export async function handleTool(
  method: 'search' | 'analyze',
  args: Record<string, unknown>,
  context: unknown
): Promise<unknown> {
  const handler = method === 'search' ? searchHandler : analyzeHandler

  try {
    // Wrap the handler invocation in the retry harness
    // NetworkError and transient errors retry up to 2 times with exponential backoff
    // First retry: 500ms delay. Second retry: 1000ms delay.
    return await withRetry(() => handler(args as never, context), 2, 500)
  } catch (err) {
    if (err instanceof InvalidKeyError) {
      return {
        isError: true,
        content: [{ type: 'text', text: JSON.stringify({ error: { code: 'INVALID_KEY', retryable: false } }) }],
      }
    }
    if (err instanceof InsufficientCreditsError) {
      return {
        isError: true,
        content: [{ type: 'text', text: JSON.stringify({ error: { code: 'INSUFFICIENT_CREDITS', retryable: false } }) }],
      }
    }
    if (err instanceof RateLimitedError) {
      return {
        isError: true,
        content: [{ type: 'text', text: JSON.stringify({ error: { code: 'RATE_LIMITED', retryable: true, retryAfterMs: 5000 } }) }],
      }
    }
    if (err instanceof NetworkError || err instanceof TimeoutError || err instanceof SettleGridUnavailableError) {
      return {
        isError: true,
        content: [{ type: 'text', text: JSON.stringify({ error: { code: 'BILLING_UNAVAILABLE', retryable: true, retryAfterMs: 2000 } }) }],
      }
    }
    throw err
  }
}
```

Note: `runVectorSearch` and `runDeepAnalysis` are placeholders for your real tool logic — they are not part of the SDK. The stubs above return minimal data so the snippet runs without errors if you copy it verbatim.

### Preflight credit validation before expensive compute

One case the retry harness above does not cover: `InsufficientCreditsError` that surfaces *after* your tool has already done expensive work. If your `analyze` method runs a 10-second embedding pipeline before `sg.wrap()` meters the call, and the consumer's balance is 8 cents when the method costs 10, the work was wasted.

`sg.validateKey()` lets you check balance before executing:

```typescript
import { settlegrid } from '@settlegrid/mcp'
import { InvalidKeyError, InsufficientCreditsError } from '@settlegrid/mcp'

// Placeholder — replace with your real expensive compute implementation
async function runExpensiveCompute(input: unknown): Promise<{ result: string }> {
  return { result: '' }
}

const sg = settlegrid.init({
  toolSlug: 'expensive-tool',
  pricing: {
    defaultCostCents: 10,
    methods: {
      analyze: { costCents: 10 },
    },
  },
})

export async function handleExpensiveAnalyze(
  args: { input: unknown },
  apiKey: string
): Promise<unknown> {
  // Preflight: validate key and check balance before starting compute
  const METHOD_COST_CENTS = 10

  const check = await sg.validateKey(apiKey)

  if (!check.valid) {
    return {
      isError: true,
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            error: {
              code: 'INVALID_KEY',
              message: 'API key is invalid.',
              retryable: false,
            },
          }),
        },
      ],
    }
  }

  if (check.balanceCents < METHOD_COST_CENTS) {
    return {
      isError: true,
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            error: {
              code: 'INSUFFICIENT_CREDITS',
              message: `Balance is ${check.balanceCents} cents. This operation costs ${METHOD_COST_CENTS} cents.`,
              balanceCents: check.balanceCents,
              requiredCents: METHOD_COST_CENTS,
              retryable: false,
            },
          }),
        },
      ],
    }
  }

  // Balance confirmed sufficient — proceed with expensive computation
  const result = await runExpensiveCompute(args.input)

  // Meter after successful execution
  await sg.meter(apiKey, 'analyze')

  return {
    content: [{ type: 'text', text: JSON.stringify(result) }],
  }
}
```

The preflight check adds one round-trip to SettleGrid, but that round-trip is covered by the in-memory LRU cache (default TTL: 5 minutes, configurable via `cacheTtlMs`). If the agent called another method on the same key within the last five minutes, `validateKey()` returns the cached result with no network call. The latency cost in practice is close to zero for active consumers.

### Testing each error path with sg_test_ keys

Use `sg_test_*` keys to exercise every branch of your error handler before going live. Create test keys with zero balance to trigger `InsufficientCreditsError`, use malformed strings to trigger `InvalidKeyError`, and use the SettleGrid dashboard to temporarily rate-limit a test key to exercise `RateLimitedError`.

With `debug: true`, metering is synchronous — you can write assertions immediately after the handler returns:

```typescript
// Example test sketch (using any test framework)
const testApiKey = 'sg_test_emptywallet123'

const result = await handleExpensiveAnalyze({ input: 'some data' }, testApiKey)

// result should be a structured error, not a thrown exception
console.assert(result.isError === true)
const parsed = JSON.parse(result.content[0].text)
console.assert(parsed.error.code === 'INSUFFICIENT_CREDITS')
console.assert(parsed.error.retryable === false)
```

For full SDK documentation including all configuration options and error types, see the [SettleGrid SDK reference](https://settlegrid.ai/docs). For an overview of pricing tiers and take rates, see [SettleGrid pricing](https://settlegrid.ai/pricing).

## Summary

The failure surface for MCP tool billing is wider than it looks. Eight distinct error types, each requiring a different response strategy. Agent loops that retry non-retryable errors. Parallel invocations that duplicate charges. Billing latency that looks identical to tool failure from the agent's perspective.

The patterns in this guide reduce those failure modes to manageable ones:

- **Structured error payloads** with machine-readable `code` and `retryable` fields let agents branch on failure type rather than treating all errors identically.
- **Idempotency wrappers** using client-supplied request IDs and `sg.meter()` prevent duplicate charges from agent retry loops.
- **Preflight `sg.validateKey()` checks** surface `InsufficientCreditsError` before expensive compute runs, not after.
- **Graceful degradation** on `TimeoutError` and `SettleGridUnavailableError` keeps the tool available during billing infrastructure outages, with explicit logging so degraded invocations are visible.
- **Exponential backoff** on `NetworkError` and transient errors prevents agent retry storms from amplifying infrastructure issues.

For a comparison of billing approaches across MCP frameworks, see [MCP Billing Comparison 2026](https://settlegrid.ai/learn/blog/mcp-billing-comparison-2026) for related context.