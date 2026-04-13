# Kernel Demo — Hono + @settlegrid/mcp

End-to-end demo of the SettleGrid dispatch kernel running on a Hono HTTP server.

## What it proves

The kernel works in a non-Next.js runtime (Hono / Node.js) and correctly:
1. Returns a **402 multi-protocol manifest** when no payment headers are present
2. Processes **sg-balance (MCP)** requests — validates the API key, runs the handler, meters the invocation, returns billing metadata
3. Processes **x402** requests — verifies the payment via the facilitator, runs the handler, settles, returns the transaction hash

## Prerequisites

From the **monorepo root** (`/settlegrid`):

```bash
npm install          # installs workspace deps including hono + tsx
cd packages/mcp && npx tsup   # builds @settlegrid/mcp dist (the demo imports from it)
```

## Run the E2E test

```bash
cd examples/kernel-demo
npm test
```

Expected output:

```
═══ SettleGrid Kernel E2E Demo ═══

Test 1: POST /search without payment headers → 402
  ✓ Got 402 with multi-protocol manifest
  ✓ Accepts: sg-balance, exact, mpp

Test 2: POST /search with x-api-key → 200 (sg-balance)
  ✓ Got 200 with billing metadata
  ✓ Operation ID: demo-inv-001
  ✓ Cost: 5 cents

Test 3: POST /search with payment-signature → 200 (x402)
  ✓ Got 200 with x402 settlement
  ✓ Tx hash: 0xdemo

═══ All 3 E2E tests passed ═══
```

## Run the dev server

```bash
npm run dev
```

Starts a Hono server on the default port. Send requests with `curl`:

```bash
# No payment → 402
curl -X POST http://localhost:3000/search

# sg-balance → 200
curl -X POST http://localhost:3000/search -H "x-api-key: sg_live_your_key"
```

## How it works

- **`server.ts`** — Hono app that wraps a `/search` endpoint in `createDispatchKernel`. The kernel detects the payment protocol from request headers and routes through the appropriate pipeline (sg-balance billing or x402 facilitator).
- **`client-test.ts`** — In-process E2E test using Hono's `app.request()` (no TCP listener needed). Mocks `globalThis.fetch` so the kernel's SDK and facilitator HTTPS calls return canned responses without a real SettleGrid backend.
