If you are shipping an MCP tool server and want to let users try it for free before asking them to pay, you need two things: a way to track how many calls an API key has made, and a hard gate that stops free-tier callers when they hit the limit. This tutorial walks through exactly that — configuring **MCP server free tier usage limits** using the `@settlegrid/mcp` SDK, with TypeScript code you can copy directly into a project.

By the end you will have:

- A SettleGrid instance with mixed free and paid method pricing
- Tool handlers wrapped with `sg.wrap()` that enforce those limits automatically
- Structured 402 and 401 responses surfaced back to MCP clients
- A pre-call balance check using `sg.validateKey()` to route callers without consuming credits
- A local testing setup that resets cache state between runs

If you are new to SettleGrid's general monetization model, read [How to Monetize an MCP Server](https://settlegrid.ai/learn/blog/how-to-monetize-mcp-server) first, then come back here for the freemium-specific configuration. You can also review the [free MCP monetization overview](https://settlegrid.ai/learn/blog/free-mcp-monetization) and the [full SDK reference](https://settlegrid.ai/docs).

## How MCP Server Free Tier Usage Limits Work in SettleGrid

SettleGrid does not have a separate "free tier" concept as a first-class configuration object. Instead, free-tier behavior emerges from two orthogonal mechanisms:

**1. Zero-cost methods.** When you set `costCents: 0` for a method (or set `defaultCostCents: 0` for the entire tool), calls to that method are still validated — the API key must be present and valid — but the consumer's credit balance is not decremented. This gives you authenticated, metered, free access.

**2. Credit balance exhaustion.** Paid methods (those with a positive `costCents`) will fail with `InsufficientCreditsError` when the caller's balance hits zero. Since SettleGrid enforces this at the metering layer using a real-time Redis `DECRBY` on the hot path, you do not need to track balances yourself. The SDK surfaces the error, and your handler never runs.

Put together: you can define a set of methods that are always free, and a set of methods that require credits. A caller with zero balance can still use the free methods. The moment they attempt a paid method without credits, the call is blocked and you return a 402 with an upgrade prompt.

There is also a third mechanism — `sg.validateKey()` — that lets you read a caller's current balance *before* running any handler, without consuming credits. This is useful for routing: you can check whether the caller has credits and serve them a personalized response (for example, a prompt explaining the paid tier) before they hit a 402 wall.

SettleGrid's [pricing page](https://settlegrid.ai/pricing) shows the take rates: 0% on your first $1,000/month of revenue, 2% to $10,000, 2.5% to $50,000, and 5% above that. On the Free plan (50,000 ops/month), you can prototype and test this entire setup at no cost.

For background on the per-call billing model these limits rely on, see [Per-Call Billing for AI Agents](https://settlegrid.ai/learn/blog/per-call-billing-ai-agents).

## Initializing Your SettleGrid Instance with Per-Method Pricing

Install the SDK:

```bash
npm install @settlegrid/mcp
```

Your MCP server likely has a single entry point file. Initialize SettleGrid at the top, before any handler definitions:

```typescript
import { settlegrid } from '@settlegrid/mcp';

const sg = settlegrid.init({
  toolSlug: 'research-assistant',
  pricing: {
    // Free by default — any method not listed in the map costs nothing
    defaultCostCents: 0,
    methods: {
      // Free methods: these exist in the map explicitly for clarity,
      // but costCents: 0 means no credits are consumed
      ping:   { costCents: 0, displayName: 'Health Check' },
      search: { costCents: 0, displayName: 'Basic Search' },

      // Paid methods: require a positive credit balance
      analyze:   { costCents: 10, displayName: 'Deep Analysis'      },
      summarize: { costCents: 5,  displayName: 'Summarize Document' },
      export:    { costCents: 3,  displayName: 'Export Results'     },
    },
  },
});
```

A few things to note about this configuration:

- `toolSlug` must exactly match the slug you registered on [settlegrid.ai](https://settlegrid.ai/docs). The SDK validates this on the first metered call.
- `defaultCostCents: 0` means that any method you do *not* list in `methods` is also free. This is a safe default during development — you can flip it to a positive value later if you want unknown methods to be gated.
- `costCents` values are integers in US cents. `costCents: 10` means ten cents per call, not ten dollars.
- The `displayName` field is optional but useful for dashboards and consumer-facing billing breakdowns.

This single `sg` instance is reused across all your handlers. It holds the LRU cache for key validation (default TTL: 5 minutes) and the pricing map.

## Wrapping Tool Handlers and Enforcing Credit-Based Gating

Once you have the instance, you wrap each handler with `sg.wrap()`. The wrapper intercepts each call, extracts the API key from the request context, validates it, checks the caller's balance against the method cost, and only invokes your handler if everything passes.

> **Note on placeholders:** The snippets below call into `runVectorSearch` and `runDeepAnalysis`. **These are not part of the SDK** — they are placeholders for your real tool logic. If you want to copy this tutorial verbatim, stub them first as no-op async functions so the snippets compile:
>
> ```typescript
> async function runVectorSearch(query: string, limit = 10): Promise<unknown[]> {
>   return [];
> }
>
> async function runDeepAnalysis(query: string, depth: 'shallow' | 'deep'): Promise<unknown> {
>   return null;
> }
> ```
>
> Replace these with your real implementations once you wire everything up.

Here is a free-tier handler — `search` costs zero cents, so it runs for any valid API key regardless of balance:

```typescript
import { InvalidKeyError, InsufficientCreditsError } from '@settlegrid/mcp';

// Free handler: costCentsOverride: 0 makes this explicit,
// overriding whatever the pricing map says for the 'search' method.
// Using costCentsOverride here is redundant given our pricing config,
// but it documents intent clearly and protects against accidental
// future pricing map changes.
const billedSearch = sg.wrap(
  async (args: { query: string; limit?: number }) => {
    const results = await runVectorSearch(args.query, args.limit ?? 10);
    return {
      results,
      tier: 'free',
      note: 'Upgrade to access deep analysis on these results.',
    };
  },
  {
    method: 'search',
    costCentsOverride: 0,
  }
);
```

Now the paid handler — `analyze` costs 10 cents per call:

```typescript
const billedAnalyze = sg.wrap(
  async (args: { query: string; depth: 'shallow' | 'deep' }) => {
    const analysis = await runDeepAnalysis(args.query, args.depth);
    return {
      analysis,
      tier: 'paid',
    };
  },
  {
    method: 'analyze',
    // No costCentsOverride here — the pricing map's costCents: 10 applies
  }
);
```

When `billedAnalyze` is called by a consumer with insufficient credits, the SDK throws `InsufficientCreditsError` before your handler function body ever executes. The credit check happens inside `sg.wrap()`'s prologue, backed by the same Redis balance check that powers the metering layer. Your `runDeepAnalysis` function is not called, so you do not incur any compute cost for blocked calls.

Both wrapped handlers expect the caller's API key to arrive in the MCP context object under `headers['x-api-key']` or as a Bearer token in `headers['authorization']`. The SDK's `settlegrid.extractApiKey()` helper handles both formats automatically.

## Handling InsufficientCreditsError to Surface Upgrade Prompts

The wrapped handlers throw errors from `@settlegrid/mcp` when billing checks fail. You need to catch these in your MCP tool dispatcher and translate them into structured responses the client can act on.

Here is a complete try-catch block for the `analyze` method, covering both the billing error cases and a fallback for unexpected failures:

```typescript
import {
  InvalidKeyError,
  InsufficientCreditsError,
  RateLimitedError,
} from '@settlegrid/mcp';

async function handleAnalyzeTool(
  args: { query: string; depth: 'shallow' | 'deep' },
  context: { headers: Record<string, string> }
) {
  try {
    const result = await billedAnalyze(args, context);
    return {
      status: 200,
      body: result,
    };
  } catch (err) {
    if (err instanceof InsufficientCreditsError) {
      // HTTP 402 Payment Required — the caller has a valid key but no credits
      return {
        status: 402,
        error: {
          code: 'INSUFFICIENT_CREDITS',
          message:
            'Your credit balance is too low to run a deep analysis. ' +
            'Add credits at https://settlegrid.ai/pricing to continue.',
          upgradeUrl: 'https://settlegrid.ai/pricing',
        },
      };
    }

    if (err instanceof InvalidKeyError) {
      // HTTP 401 Unauthorized — key is missing, malformed, or not found
      return {
        status: 401,
        error: {
          code: 'INVALID_KEY',
          message:
            'The API key provided is invalid or missing. ' +
            'Pass a valid key in the x-api-key header.',
        },
      };
    }

    if (err instanceof RateLimitedError) {
      // HTTP 429 Too Many Requests — caller exceeded rate limits
      return {
        status: 429,
        error: {
          code: 'RATE_LIMITED',
          message: 'Too many requests. Please slow down and retry.',
        },
      };
    }

    // Unexpected error — rethrow so your MCP server's global error handler
    // can log it and return a 500
    throw err;
  }
}
```

A few implementation notes:

- The `upgradeUrl` field in the 402 response is a convention you define — nothing in the SDK mandates it. Including it gives MCP clients (and human users reading logs) a direct action to take.
- `InsufficientCreditsError` and `InvalidKeyError` are distinct classes. Do not collapse them into a single catch block. A 402 and a 401 have different semantics: one means "you need to pay," the other means "you need to authenticate." MCP clients that parse structured error responses will behave differently for each.
- For the free-tier `search` handler, you likely do not need the `InsufficientCreditsError` branch at all (since it costs zero cents), but you still need `InvalidKeyError` handling — unauthenticated callers cannot use even the free methods.

## Using sg.validateKey() to Pre-Route Callers

Sometimes you want to make a routing decision *before* running any handler. For example: if the caller has a positive balance, show them the full response; if they have zero balance, show them a trimmed response with an upsell note. This should happen without consuming any credits.

`sg.validateKey()` lets you read the caller's current `balanceCents` without triggering metering:

```typescript
async function handleSearchTool(
  args: { query: string },
  context: { headers: Record<string, string> }
) {
  const apiKey = settlegrid.extractApiKey(context.headers);

  if (!apiKey) {
    return {
      status: 401,
      error: {
        code: 'INVALID_KEY',
        message: 'Missing API key. Pass a valid key in the x-api-key header.',
      },
    };
  }

  // Validate the key and read balance without consuming credits
  const keyInfo = await sg.validateKey(apiKey);

  if (!keyInfo.valid) {
    return {
      status: 401,
      error: {
        code: 'INVALID_KEY',
        message: 'The provided API key is not valid.',
      },
    };
  }

  // Route based on balance: both paths use billedSearch (costCentsOverride: 0),
  // so no credits are consumed regardless of which branch runs.
  // The balance check here is purely for personalizing the response.
  if (keyInfo.balanceCents > 0) {
    // Caller has credits — run the full free search and hint at paid features
    const result = await billedSearch(args, context);
    return {
      status: 200,
      body: {
        ...result,
        paidFeatures: {
          analyze: { costCents: 10, description: 'Run deep analysis on results' },
          summarize: { costCents: 5, description: 'Summarize this result set' },
        },
      },
    };
  } else {
    // Caller has zero balance — run the free search with a stronger upsell
    const result = await billedSearch(args, context);
    return {
      status: 200,
      body: {
        ...result,
        upgradePrompt:
          'Add credits at https://settlegrid.ai/pricing to unlock ' +
          'analysis and summarization tools.',
      },
    };
  }
}
```

This pattern is useful for progressive disclosure: free-tier callers get a working tool but see prompts that explain what they are missing. Callers with credits get the same free results plus a menu of available paid actions, which encourages upsell without friction.

Note that `sg.validateKey()` still makes a network call on a cache miss. The result is cached in-memory for the duration of `cacheTtlMs` (default: 5 minutes), so repeated calls within the TTL window are effectively free from a latency standpoint.

## Testing Free Tier Limits Locally Before Going to Production

The default cache TTL of 5 minutes makes local testing awkward: if you call `sg.validateKey()` or `sg.wrap()` once with a key, the result is cached, and subsequent test runs within 5 minutes will use the cached result even if you have changed the key's balance on the SettleGrid dashboard.

Two configuration options fix this:

- `debug: true` switches metering from fire-and-forget to synchronous. By default, the SDK meters asynchronously — it does not wait for the metering call to complete before returning. In debug mode, it waits. This means your test can assert that a call was metered (and that the balance was decremented) before inspecting state.
- `cacheTtlMs: 0` disables the in-memory LRU cache entirely. Every `validateKey()` or `wrap()` call goes to the network. This is slower, but it means each test run sees the true current state of the key.

Initialize a separate test instance:

```typescript
import { settlegrid } from '@settlegrid/mcp';

const sgTest = settlegrid.init({
  toolSlug: 'research-assistant',
  debug: true,
  cacheTtlMs: 0,
  pricing: {
    defaultCostCents: 0,
    methods: {
      search:    { costCents: 0  },
      analyze:   { costCents: 10 },
      summarize: { costCents: 5  },
      export:    { costCents: 3  },
    },
  },
});
```

In your test suite, call `sg.clearCache()` between test cases that use different keys or that need to observe balance changes mid-run:

```typescript
import { settlegrid } from '@settlegrid/mcp';
import { InsufficientCreditsError, InvalidKeyError } from '@settlegrid/mcp';

// Wrap the analyze handler using the test instance
const testBilledAnalyze = sgTest.wrap(
  async (args: { query: string; depth: 'shallow' | 'deep' }) => {
    return { analysis: 'test result', tier: 'paid' };
  },
  { method: 'analyze' }
);

async function runTests() {
  const testKey = 'sg_test_abc123'; // sg_test_* keys are safe for local runs

  // --- Test 1: valid key with sufficient balance ---
  console.log('Test 1: paid method with sufficient credits');
  try {
    const result = await testBilledAnalyze(
      { query: 'test query', depth: 'shallow' },
      { headers: { 'x-api-key': testKey } }
    );
    console.log('PASS — result:', result);
  } catch (err) {
    console.error('FAIL — unexpected error:', err);
  }

  // Clear cache so the next test sees fresh state after the balance decrement
  sgTest.clearCache();

  // --- Test 2: invalid key ---
  console.log('Test 2: invalid API key returns InvalidKeyError');
  try {
    await testBilledAnalyze(
      { query: 'test query', depth: 'shallow' },
      { headers: { 'x-api-key': 'sg_test_notreal' } }
    );
    console.error('FAIL — expected InvalidKeyError, got no error');
  } catch (err) {
    if (err instanceof InvalidKeyError) {
      console.log('PASS — InvalidKeyError thrown as expected');
    } else {
      console.error('FAIL — wrong error type:', err);
    }
  }

  sgTest.clearCache();

  // --- Test 3: key with zero balance hits InsufficientCreditsError ---
  // (Requires a key you have set to zero balance on the SettleGrid dashboard)
  const zeroCreditKey = 'sg_test_zerocredit';
  console.log('Test 3: zero-credit key returns InsufficientCreditsError');
  try {
    await testBilledAnalyze(
      { query: 'test query', depth: 'deep' },
      { headers: { 'x-api-key': zeroCreditKey } }
    );
    console.error('FAIL — expected InsufficientCreditsError, got no error');
  } catch (err) {
    if (err instanceof InsufficientCreditsError) {
      console.log('PASS — InsufficientCreditsError thrown as expected');
    } else {
      console.error('FAIL — wrong error type:', err);
    }
  }

  sgTest.clearCache();
}

runTests().catch(console.error);
```

A few additional testing practices worth noting:

- Use `sg_test_*` format keys during local development. The key format `sg_live_*` is for production keys attached to real consumer accounts.
- The `cacheTtlMs: 0` setting is only appropriate in test environments. In production, the default 5-minute TTL prevents a key validation round-trip on every single call, which keeps the SDK's sub-50ms latency guarantee achievable.
- If you use a test runner like Vitest or Jest, call `sgTest.clearCache()` in `beforeEach` rather than manually between tests. This ensures each test starts with a clean cache regardless of test ordering.
- `debug: true` also emits verbose logs to `console.debug`. In a test environment this is useful; suppress it in production by omitting the flag or setting it explicitly to `false`.

## Putting It All Together

Here is a condensed view of the complete setup — initialization, two wrapped handlers, error handling, and the pre-call balance check — as it would appear in a single MCP server module:

```typescript
import {
  settlegrid,
  InvalidKeyError,
  InsufficientCreditsError,
  RateLimitedError,
} from '@settlegrid/mcp';

// Stub helpers — replace with your real tool logic.
// These are NOT part of the SDK; they exist so the snippet compiles standalone.
async function runVectorSearch(query: string): Promise<unknown[]> {
  return [];
}
async function runDeepAnalysis(query: string, depth: 'shallow' | 'deep'): Promise<unknown> {
  return null;
}

// Production instance
const sg = settlegrid.init({
  toolSlug: 'research-assistant',
  pricing: {
    defaultCostCents: 0,
    methods: {
      search:    { costCents: 0,  displayName: 'Basic Search'        },
      ping:      { costCents: 0,  displayName: 'Health Check'        },
      analyze:   { costCents: 10, displayName: 'Deep Analysis'       },
      summarize: { costCents: 5,  displayName: 'Summarize Document'  },
      export:    { costCents: 3,  displayName: 'Export Results'      },
    },
  },
});

// Free handler
const billedSearch = sg.wrap(
  async (args: { query: string }) => {
    return { results: await runVectorSearch(args.query) };
  },
  { method: 'search', costCentsOverride: 0 }
);

// Paid handler
const billedAnalyze = sg.wrap(
  async (args: { query: string; depth: 'shallow' | 'deep' }) => {
    return { analysis: await runDeepAnalysis(args.query, args.depth) };
  },
  { method: 'analyze' }
);

// Dispatcher with structured error handling
export async function dispatch(
  toolName: string,
  args: Record<string, unknown>,
  context: { headers: Record<string, string> }
) {
  try {
    if (toolName === 'search') {
      return { status: 200, body: await billedSearch(args as { query: string }, context) };
    }
    if (toolName === 'analyze') {
      return {
        status: 200,
        body: await billedAnalyze(
          args as { query: string; depth: 'shallow' | 'deep' },
          context
        ),
      };
    }
    return { status: 404, error: { code: 'UNKNOWN_TOOL', message: `No tool named ${toolName}` } };
  } catch (err) {
    if (err instanceof InsufficientCreditsError) {
      return {
        status: 402,
        error: {
          code: 'INSUFFICIENT_CREDITS',
          message: 'Add credits at https://settlegrid.ai/pricing to continue.',
          upgradeUrl: 'https://settlegrid.ai/pricing',
        },
      };
    }
    if (err instanceof InvalidKeyError) {
      return { status: 401, error: { code: 'INVALID_KEY', message: 'Invalid or missing API key.' } };
    }
    if (err instanceof RateLimitedError) {
      return { status: 429, error: { code: 'RATE_LIMITED', message: 'Rate limit exceeded. Retry later.' } };
    }
    throw err;
  }
}
```

This structure keeps billing logic out of your tool implementation functions. `runVectorSearch` and `runDeepAnalysis` are plain async functions with no knowledge of SettleGrid — they receive arguments and return results. All the key validation, credit checking, and metering happens in the `sg.wrap()` layer. When you need to add a new method or change its price, you update the `methods` map in `settlegrid.init()` and wrap the new handler. Nothing else changes.

## Next Steps

With free-tier limits configured, the next thing most developers tackle is distributing API keys to their users and giving consumers a way to top up their balances. The [SettleGrid docs](https://settlegrid.ai/docs) cover the consumer-facing credit purchase flow, developer payout configuration, and Stripe integration.

If you want the broader context around SettleGrid's free plan — what is included, when to upgrade, and a quickstart for shipping your first paid tool live — read the [free MCP monetization overview](https://settlegrid.ai/learn/blog/free-mcp-monetization). For background on the per-call billing model these limits build on, see [Per-Call Billing for AI Agents](https://settlegrid.ai/learn/blog/per-call-billing-ai-agents). And for an end-to-end walkthrough of monetizing an MCP server from scratch, start with [How to Monetize an MCP Server](https://settlegrid.ai/learn/blog/how-to-monetize-mcp-server).
