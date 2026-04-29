# SEP-XXXX: experimental/payment capability

- **Status:** Draft (pre-submission)
- **Author:** SettleGrid Team
- **Created:** 2026-04-07
- **Discussion:** (TBD — filed after publication)
- **Compatibility:** MCP 2025-03-26+

---

## 1. Abstract

This proposal adds an `experimental.payment` capability to the MCP initialization handshake, enabling servers to declare pricing for their tools and clients to negotiate payment before invocation. Two new JSON-RPC methods — `payment/quote` and `payment/receipt` — give both sides a structured way to preview cost and confirm settlement. Four new error codes (-32010 through -32013) standardize failure reporting. The capability is purely additive: clients that do not advertise `experimental.payment` continue to work via existing out-of-band API key mechanisms. The design targets pay-per-call as the primary model, with subscription and tiered pricing as optional extensions. A reference implementation exists in the `@settlegrid/mcp` SDK (v0.1.1).

## 2. Motivation

MCP tool servers are increasingly capable — web search, code generation, data analysis — but monetization remains ad hoc. Today, every paid MCP server invents its own billing flow: some use API key headers, others use OAuth scopes, and a few use external payment links. This fragmentation creates four concrete problems.

**Discoverability.** A client connecting to a server has no standard way to learn whether the server charges for calls, how much it charges, or where to purchase credits. Users must read documentation, visit a website, and manually configure environment variables before making their first paid call. This friction eliminates casual trial — the very behaviour MCP was designed to unlock.

**Trust signals.** Clients cannot distinguish between a server that charges 1 cent per call and one that charges 1 dollar. Without a machine-readable cost signal in the handshake, agentic workflows that call multiple tools in sequence cannot enforce budget constraints, leading to either unlimited spend or total avoidance of paid tools.

**Cross-client compatibility.** Every MCP client (Claude Desktop, Cursor, Codex, custom agents) must implement each server's billing scheme independently. A standard capability eliminates this N×M integration matrix and lets a single payment-aware client work with any compliant server.

**Telemetry gaps.** Out-of-band billing provides no receipt at the protocol level. If a tool call succeeds but billing fails silently, the server has no way to communicate this to the client, and the user has no actionable error. A protocol-level receipt closes the feedback loop.

**Emerging ecosystem need.** As MCP adoption grows, tool providers are transitioning from free, developer-focused previews to sustainable, paid APIs. The gap between "works in demo" and "works in production with billing" is where most tool providers stall. A protocol-level standard lowers this barrier from "build a custom billing system" to "declare a capability and let clients handle it." Early adoption data from SettleGrid's open-source server gallery (1,022 templates) shows that per-call billing at 1-5 cents/call is the dominant model, with subscription representing less than 5% of deployed servers.

This SEP addresses all four problems by introducing a capability that is discoverable (handshake), constrained (pre-call quoting), verifiable (post-call receipts), and backwards compatible (additive capability, not a required feature). The design is deliberately minimal — it solves the 90% case (pay-per-call on a credit balance) while leaving room for future extensions (subscriptions, tiered pricing, non-custodial settlement).

## 3. Specification

### 3.1 Capability Declaration

During the `initialize` handshake, a payment-enabled server includes the following in its `capabilities` object:

```json
{
  "capabilities": {
    "experimental": {
      "payment": {
        "version": "1.0",
        "supported": ["pay-per-call", "subscription"],
        "minAmountCents": 1,
        "currency": "USD",
        "processor": "https://settlegrid.ai/api/v1"
      }
    }
  }
}
```

**TypeScript definition:**

```typescript
interface PaymentCapabilityDeclaration {
  version: string;
  supported: Array<"pay-per-call" | "subscription" | "tiered">;
  minAmountCents: number;
  currency: string;
  processor: string;
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `version` | string | yes | Capability version (currently `"1.0"`) |
| `supported` | string[] | yes | Pricing models the server accepts |
| `minAmountCents` | number | yes | Lowest possible per-call cost in the declared currency |
| `currency` | string | yes | ISO 4217 currency code (e.g. `"USD"`) |
| `processor` | string | yes | HTTPS URL of the payment processor's API endpoint |

**JSON Schema:**

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "required": ["version", "supported", "minAmountCents", "currency", "processor"],
  "properties": {
    "version": { "type": "string", "const": "1.0" },
    "supported": {
      "type": "array",
      "items": { "type": "string", "enum": ["pay-per-call", "subscription", "tiered"] },
      "minItems": 1
    },
    "minAmountCents": { "type": "integer", "minimum": 0 },
    "currency": { "type": "string", "pattern": "^[A-Z]{3}$" },
    "processor": { "type": "string", "format": "uri", "pattern": "^https://" }
  },
  "additionalProperties": false
}
```

### 3.2 Client Response

If the client supports payment, it includes a `payment` field in its `initialize` response:

**Accepted:**

```json
{
  "payment": {
    "accepted": "pay-per-call",
    "apiKey": "sg_live_abc123def456"
  }
}
```

**Declined:**

```json
{
  "payment": {
    "declined": true,
    "reason": "no-funds"
  }
}
```

**TypeScript definition:**

```typescript
interface PaymentClientResponseAccepted {
  accepted: "pay-per-call" | "subscription" | "tiered";
  apiKey: string;
}

interface PaymentClientResponseDeclined {
  declined: true;
  reason: "no-funds" | "unsupported-model" | "user-refused" | "budget-exceeded";
}

type PaymentClientResponse =
  | PaymentClientResponseAccepted
  | PaymentClientResponseDeclined;
```

**JSON Schema (accepted variant):**

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "required": ["accepted", "apiKey"],
  "properties": {
    "accepted": { "type": "string", "enum": ["pay-per-call", "subscription", "tiered"] },
    "apiKey": { "type": "string", "minLength": 1 }
  },
  "additionalProperties": false
}
```

### 3.3 `payment/quote` Method

Before invoking a tool, the client MAY call `payment/quote` to learn the cost:

**Request:**

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "payment/quote",
  "params": {
    "tool": "search_web",
    "estimatedInputTokens": 50
  }
}
```

**Response:**

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "costCents": 5,
    "currency": "USD",
    "validForSeconds": 60,
    "quoteId": "qt_abc123"
  }
}
```

**TypeScript definition:**

```typescript
interface PaymentQuoteRequest {
  tool: string;
  estimatedInputTokens?: number;
}

interface PaymentQuoteResponse {
  costCents: number;
  currency: string;
  validForSeconds: number;
  quoteId: string;
}
```

The `quoteId` MAY be passed in the subsequent tool call's `_meta` to lock the quoted price.

### 3.4 `payment/receipt` Method

After a successful paid tool call, the server SHOULD return a receipt. The client MAY also request it explicitly:

**Request:**

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "payment/receipt",
  "params": {
    "callId": "call_xyz789"
  }
}
```

**Response:**

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "receiptId": "rcpt_def456",
    "costCents": 5,
    "currency": "USD",
    "balanceRemainingCents": 995,
    "timestamp": "2026-04-07T12:34:56Z",
    "tool": "search_web"
  }
}
```

**TypeScript definition:**

```typescript
interface PaymentReceiptRequest {
  callId: string;
}

interface PaymentReceiptResponse {
  receiptId: string;
  costCents: number;
  currency: string;
  balanceRemainingCents: number;
  timestamp: string;
  tool: string;
}
```

### 3.5 Error Codes

| Code | Name | Description |
|------|------|-------------|
| -32010 | `PAYMENT_REQUIRED` | The tool requires payment but the client did not provide an API key or payment context |
| -32011 | `PAYMENT_INVALID_KEY` | The provided API key is malformed, expired, or not recognized |
| -32012 | `PAYMENT_INSUFFICIENT_FUNDS` | Valid key, but the consumer's balance is too low for this call |
| -32013 | `PAYMENT_PROCESSOR_DOWN` | The payment processor is unreachable; the server cannot verify payment |

**JSON-RPC error object example:**

```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "error": {
    "code": -32012,
    "message": "Insufficient funds",
    "data": {
      "requiredCents": 5,
      "balanceCents": 2,
      "topUpUrl": "https://settlegrid.ai/top-up?tool=search-api"
    }
  }
}
```

## 4. Rationale

**Why a capability, not a header convention?** HTTP headers work for REST APIs but MCP operates over stdio, SSE, and WebSocket transports where HTTP headers are unavailable. A capability in the initialization handshake is transport-agnostic and discoverable by any MCP client without transport-specific logic.

**Why quote before call?** Agentic workflows often chain multiple tool calls in a loop. A quote step lets the agent enforce a per-call or per-session budget before committing to an invocation. Without it, the agent discovers the cost only after the call succeeds (or fails with `PAYMENT_INSUFFICIENT_FUNDS`), which is too late for budget management.

**Why not use HTTP 402 Payment Required?** MCP's JSON-RPC layer does not map cleanly to HTTP status codes. A dedicated error code range (-32010 to -32013) is more expressive and avoids conflation with transport-level HTTP errors. The error `data` field carries structured context (required amount, balance, top-up URL) that HTTP 402 does not standardize.

**Comparison with Lightning BOLT-12.** Lightning's invoice-based flow (offer → invoice → payment → preimage) is more complex than what MCP tool calls need. Most MCP calls cost fractions of a cent and complete in under a second — well below Lightning's practical minimum settlement threshold. A credit-balance model with a simple quote/receipt cycle fits the latency and cost profile better. Non-custodial settlement (e.g. via x402 or Lightning) is supported as an optional `supported` model but not required for basic interoperability.

**Why separate quote and receipt methods?** Combining cost information into the tool call response would reduce round trips but would not allow the client to enforce a budget before committing to execution. The quote step is explicitly separated so that agentic orchestrators can implement "ask before spending" policies. The receipt step is separated so that clients can request receipts asynchronously for reconciliation, even if they did not request a quote. Both methods are optional — a minimal implementation can skip quotes and return receipts inline via `_meta`.

## 5. Backwards Compatibility

Clients that do not advertise `experimental.payment` in their `initialize` request MUST continue to work with payment-enabled servers. The server falls back to the existing out-of-band mechanism:

1. The client does not send a `payment` field in its initialize response.
2. The server checks for an API key in `_meta["settlegrid-api-key"]` (MCP metadata), `x-api-key` header (HTTP transport), or `Authorization: Bearer` header.
3. If no key is found, the server returns error code `-32010 PAYMENT_REQUIRED` with a `topUpUrl` in the error data.

No existing MCP functionality is removed or altered. The `experimental` namespace ensures that clients and servers can adopt this capability without affecting the core protocol surface.

## 6. Security Considerations

**Key leakage.** The `apiKey` field in the client's initialize response is transmitted in cleartext over the MCP transport. Implementations MUST use TLS for network transports (SSE, WebSocket). For stdio transports (local processes), the key is confined to the local machine's IPC channel. Servers MUST NOT log the full API key; truncation to the first 8 characters is sufficient for diagnostics.

**Replay attacks.** A malicious intermediary could replay a valid `payment/quote` response to trick a client into believing a call is cheaper than it actually is. Implementations SHOULD include a `quoteId` with a server-generated nonce and a short `validForSeconds` window. The server MUST reject expired or reused quote IDs.

**Processor trust model.** The `processor` URL in the capability declaration points to a third-party service that the client must trust to handle billing. Clients SHOULD verify the processor URL against a user-configured allowlist. Clients MUST NOT follow redirects from the processor URL without user confirmation to prevent SSRF.

**Audit trail.** Every paid call SHOULD produce a receipt (via `payment/receipt` or inline `_meta`). The receipt MUST include a `receiptId` that is unique, immutable, and retrievable from the processor for dispute resolution.

**Amount disclosure.** The `payment/quote` response reveals the cost of a tool call before invocation. In some contexts (e.g. competitive pricing), servers may not want to disclose per-method costs. Servers MAY omit the quote endpoint and charge at the declared `minAmountCents` or the method-specific cost, relying on the client to accept the capability's pricing range.

**Transport security.** For stdio transports, the API key travels through the local machine's IPC channel and is not exposed to the network. For SSE and WebSocket transports, the connection MUST use TLS (wss:// or https://) to protect the key in transit. Servers SHOULD reject non-TLS connections when `experimental.payment` is active. The `processor` URL MUST be HTTPS; plain HTTP processor URLs MUST be rejected by conforming clients to prevent credential interception.

**Denial of service via quoting.** A malicious client could flood the server with `payment/quote` requests to exhaust resources without ever making a paid call. Servers SHOULD rate-limit quote requests independently from tool calls and MAY require a valid API key before responding to quotes.

## 7. Reference Implementation Plan

The `@settlegrid/mcp` SDK (v0.1.1) already implements the server-side primitives:

- `createPaymentCapability({ toolSlug, pricing })` — generates the `experimental.payment` capability object for the MCP server initialization, including provider metadata, pricing config, and top-up URL.
- `PAYMENT_ERROR_CODES` — exports the error code constants (`-32001` through `-32005` in the current SDK; this SEP proposes renumbering to `-32010` through `-32013` for the standardized range).
- `extractApiKey(headers, metadata)` — resolves the API key from MCP `_meta`, `x-api-key`, or `Authorization: Bearer` sources, implementing the fallback chain described in Section 5.

**Timeline:**

| Milestone | Target | Status |
|-----------|--------|--------|
| SDK server-side helpers | v0.1.1 | Shipped |
| SEP draft published to MCP GitHub discussion | Week 3 | This document |
| Reference server (settlegrid-demo) with full payment flow | Week 5 | Planned |
| Reference client plugin (Claude Desktop) demonstrating quote → call → receipt | Week 7 | Planned |
| SEP → formal PR against MCP spec repo | Week 8 | Depends on community feedback |

**Implementation notes.** The reference server will be a fully-functional MCP tool server built on `@modelcontextprotocol/sdk` that wraps a public API (e.g. geocoding or weather) with `@settlegrid/mcp` billing. It will demonstrate all three phases of the payment flow: capability declaration in `initialize`, inline cost in `_meta` responses, and the `payment/quote` + `payment/receipt` method pair. The server will include integration tests that verify each error code (-32010 through -32013) fires under the correct conditions.

The reference client plugin will be a Claude Desktop extension (or equivalent) that detects `experimental.payment` in the server's capability response, prompts the user for their API key on first connection, and displays cost and remaining balance after each tool call. The plugin will implement a configurable per-session budget cap that calls `payment/quote` before any invocation that would exceed the cap, and surfaces the quoted cost to the user for confirmation. This demonstrates the agentic budget-enforcement use case described in Section 4.

## 8. Open Questions

1. **Multi-currency support.** Should the capability declare a single `currency` or an array of supported currencies? Multi-currency adds complexity to the quote flow (exchange rates, rounding).

2. **Micropayment batching.** For high-volume, low-cost tools (< 1 cent per call), should the protocol support batching N calls into a single settlement? This reduces processor overhead but complicates receipt semantics.

3. **Custodial vs non-custodial.** The current design assumes a custodial processor (SettleGrid holds balances). Should the spec accommodate non-custodial models (e.g. x402 protocol, Lightning Network) as first-class `supported` values?

4. **Privacy of amounts.** Should the `payment/quote` response be encrypted or signed to prevent intermediaries from observing pricing? This matters for marketplace servers where pricing is competitive.

5. **Receipt verification.** Should clients be able to verify receipts independently (e.g. via a public receipt endpoint on the processor), or is trust in the server sufficient?

6. **Budget delegation.** When an agent spawns sub-agents that call paid tools, how should the budget be delegated? A hierarchical session model (parent session → child session with a sub-budget) could address this.

7. **Subscription lifecycle.** The `subscription` model is listed as a `supported` value but this draft does not specify how subscription state is communicated. Should subscription management be out-of-band or have its own method pair?

8. **Refunds.** If a tool call succeeds at the protocol level but produces an incorrect result, how does the consumer request a refund? This is likely a processor-level concern, not a protocol one, but should be acknowledged.

9. **Rate limiting interaction.** MCP already has no standard rate-limiting mechanism. When a paid tool has both a rate limit and a payment requirement, which takes precedence? Should `PAYMENT_REQUIRED` and `RATE_LIMITED` be orthogonal?

10. **Capability negotiation versioning.** If `experimental.payment` v2.0 adds fields, how does a v1.0 client handle the extra fields? The `version` field enables forward compatibility, but the spec should mandate that unknown fields are ignored.

## 9. Appendix A: Full Example Handshake

### Client → Server: initialize

```json
{
  "jsonrpc": "2.0",
  "id": 0,
  "method": "initialize",
  "params": {
    "protocolVersion": "2025-03-26",
    "capabilities": {
      "experimental": {
        "payment": {
          "version": "1.0"
        }
      }
    },
    "clientInfo": {
      "name": "my-agent",
      "version": "1.0.0"
    }
  }
}
```

### Server → Client: initialize result

```json
{
  "jsonrpc": "2.0",
  "id": 0,
  "result": {
    "protocolVersion": "2025-03-26",
    "capabilities": {
      "tools": {},
      "experimental": {
        "payment": {
          "version": "1.0",
          "supported": ["pay-per-call"],
          "minAmountCents": 1,
          "currency": "USD",
          "processor": "https://settlegrid.ai/api/v1"
        }
      }
    },
    "serverInfo": {
      "name": "weather-api",
      "version": "1.0.0"
    }
  }
}
```

### Client → Server: payment accepted (in next request)

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "get_weather",
    "arguments": { "latitude": 40.7, "longitude": -74.0 },
    "_meta": {
      "settlegrid-api-key": "sg_live_abc123def456",
      "settlegrid-max-cost-cents": 10
    }
  }
}
```

### Server → Client: tool result with payment receipt

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "content": [{ "type": "text", "text": "{\"temperature\": 22, \"unit\": \"celsius\"}" }],
    "_meta": {
      "settlegrid-cost-cents": 1,
      "settlegrid-remaining-cents": 999,
      "settlegrid-receipt-id": "rcpt_weather_20260407_001"
    }
  }
}
```

## 10. Appendix B: Migration Guide for Existing SettleGrid Users

Existing users of `@settlegrid/mcp` who use the out-of-band API key flow do not need to change anything. The current SDK already supports both flows:

1. **Out-of-band (current default).** The consumer sets `SETTLEGRID_API_KEY` in their environment. The SDK's `extractApiKey()` reads it from the `x-api-key` header or MCP `_meta`. No protocol-level capability is advertised.

2. **In-band (this SEP).** The server calls `createPaymentCapability()` during initialization to declare `experimental.payment`. Payment-aware clients negotiate via the handshake. Non-aware clients fall back to out-of-band keys.

**Migration steps:**

1. Upgrade to `@settlegrid/mcp` ≥ 0.2.0 (once released with the full SEP implementation).
2. Add the capability to your server's initialization:
   ```typescript
   import { createPaymentCapability } from '@settlegrid/mcp'

   const server = new McpServer({
     capabilities: {
       experimental: {
         payment: createPaymentCapability({
           toolSlug: 'my-tool',
           pricing: { model: 'per-invocation', defaultCostCents: 5 },
         }),
       },
     },
   })
   ```
3. No changes to your tool handlers — `sg.wrap()` already handles both key-resolution paths.
4. Test with a payment-aware client (reference client expected in Week 7) and verify that receipts appear in `_meta`.

Both flows coexist indefinitely. The out-of-band flow is not deprecated.

**Testing the migration.** After upgrading, run your server locally and connect with a payment-aware test client. Verify:

1. The `initialize` response includes `experimental.payment` in `capabilities`.
2. A tool call with `_meta["settlegrid-api-key"]` succeeds and returns `_meta["settlegrid-cost-cents"]` in the response.
3. A tool call without any API key returns error code `-32010 PAYMENT_REQUIRED`.
4. A tool call with an invalid key returns error code `-32011 PAYMENT_INVALID_KEY`.

If all four checks pass, the server is fully compatible with both the legacy out-of-band flow and the new in-band payment capability. Existing consumers who never upgrade their client will continue to work exactly as before.
