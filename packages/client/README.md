# @settlegrid/client

Buyer-side SDK for calling SettleGrid-billed tools. When a tool replies
`402 Payment Required`, the client parses the multi-protocol manifest,
picks the cheapest rail it can pay, constructs the payment headers, and
retries the request. Per-call budget caps short-circuit BEFORE any
payment is constructed.

Isomorphic — works in Node 18+ and modern browsers. No private-key
handling client-side; wallets carry pre-issued credentials (Stripe SPTs,
L402 macaroon+preimage pairs, signed EIP-3009 blobs, VDC JWTs).

## Install

```
npm install @settlegrid/client
```

## Quick start

```ts
import { createSettleGridClient } from '@settlegrid/client'

const client = createSettleGridClient({
  wallets: {
    mpp: { sharedPaymentToken: 'spt_…' },
    l402: { macaroon: '…', preimage: '…' },
  },
  defaultMaxCostCents: 50,
})

const response = await client.call('https://tool.example/api/search', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: 'hello' }),
})
const result = await response.json()
```

## API

### `createSettleGridClient(config?)`

Returns a `SettleGridClient`.

```ts
interface SettleGridClientConfig {
  fetch?: typeof fetch            // default: globalThis.fetch
  wallets?: Partial<Record<RailName, WalletRef>>
  defaultMaxCostCents?: number    // omit for no default cap
  manifestMaxBytes?: number       // default: 64 KiB
}
```

### `client.call(toolUrl, request?, options?)`

Sends the request, handles 402, and returns the final `Response`.

```ts
interface CallOptions {
  maxCostCents?: number                 // overrides defaultMaxCostCents
  preferredRails?: readonly RailName[]  // strict allowlist
  signal?: AbortSignal
  headers?: Record<string, string>      // merged into initial + retry
}
```

Throws:

- `BudgetExceededError` when the cheapest supported rail's cost
  exceeds `maxCostCents`. Guaranteed to throw BEFORE any payment is
  constructed — no wallet material is touched, no retry fetch is
  issued.
- `NoSupportedProtocolError` when no rail is both supported by this
  client AND has a configured wallet (or `preferredRails` has no
  intersection with the payable set).
- `MalformedManifestError` when the 402 response body is not a
  parseable `PaymentRequiredBody` (invalid JSON, missing `accepts`,
  etc.) or exceeds the manifest byte cap.
- `ClientConfigurationError` for caller misuse — invalid
  `toolUrl`, negative budget, non-function `fetch`, etc.

### `client.wallet(rail)`

Returns the configured `WalletRef` for a rail, or `undefined`.

### `client.discoverProtocols(toolUrl)`

Sends an `OPTIONS` probe and returns the advertised `accepts[]` array
without paying. Returns `[]` when the server does not answer OPTIONS
with a 402-shaped body (405, network error, non-JSON, etc.) —
callers who need guaranteed discovery should issue a real `call()`
and inspect the response when the first call 402s.

## Supported rails

| Rail    | Manifest scheme | Wallet fields                    |
|---------|-----------------|----------------------------------|
| `exact` | `'exact'`       | `xPaymentHeader` (base64 X-Payment)
| `mpp`   | `'mpp'`         | `sharedPaymentToken`, `sessionId?`
| `l402`  | `'l402'`        | `macaroon`, `preimage` (64 hex)
| `ap2`   | `'ap2'`         | `vdcJwt`, `consumerId?`

Unsupported schemes on the 402 manifest are silently skipped during
cheapest-rail selection. If every advertised rail is unsupported,
`NoSupportedProtocolError` is thrown.

## Examples

### 1. Node — basic call with a budget cap

```ts
import { createSettleGridClient, BudgetExceededError } from '@settlegrid/client'

const client = createSettleGridClient({
  wallets: {
    mpp: { sharedPaymentToken: process.env.SETTLEGRID_MPP_SPT! },
  },
  defaultMaxCostCents: 10,
})

try {
  const response = await client.call(
    'https://weather-bot.example/forecast',
    { method: 'POST', body: JSON.stringify({ city: 'Sacramento' }) },
    { maxCostCents: 5 },
  )
  if (response.ok) {
    console.log(await response.json())
  } else {
    console.error(`tool returned ${response.status}`)
  }
} catch (err) {
  if (err instanceof BudgetExceededError) {
    console.error(
      `Budget blocked: ${err.rail} wants ${err.costCents} cents, ` +
        `cap is ${err.maxCostCents}.`,
    )
  } else {
    throw err
  }
}
```

### 2. Browser — read-only wallet discovery

The browser never holds private keys. Your server issues a Shared
Payment Token after the user authenticates and hands it to the
browser. The browser wallet is marked `readOnly: false` because the
SPT itself IS the payment credential — no signing required.

```ts
import { createSettleGridClient } from '@settlegrid/client'

async function fetchSpt(toolSlug: string): Promise<string> {
  const res = await fetch(`/api/issue-spt?tool=${encodeURIComponent(toolSlug)}`)
  if (!res.ok) throw new Error('SPT issue failed')
  return (await res.json()).spt
}

const toolUrl = 'https://search-bot.example/api/v1/search'

// Discover what rails the tool accepts before issuing an SPT.
const bootClient = createSettleGridClient()
const accepts = await bootClient.discoverProtocols(toolUrl)
console.log('advertised rails:', accepts.map((a) => a.scheme))

// Issue SPT, then call.
const spt = await fetchSpt('search-bot')
const client = createSettleGridClient({
  wallets: { mpp: { sharedPaymentToken: spt } },
})
const response = await client.call(toolUrl, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ q: 'acme widgets' }),
})
```

### 3. Node — multi-rail wallet with preferred rail + AbortSignal

```ts
import { createSettleGridClient } from '@settlegrid/client'

const client = createSettleGridClient({
  wallets: {
    mpp: { sharedPaymentToken: process.env.SETTLEGRID_MPP_SPT! },
    l402: {
      macaroon: process.env.SETTLEGRID_L402_MACAROON!,
      preimage: process.env.SETTLEGRID_L402_PREIMAGE!,
    },
    ap2: {
      vdcJwt: process.env.SETTLEGRID_AP2_VDC!,
      consumerId: 'agent-42',
    },
  },
})

const ac = new AbortController()
setTimeout(() => ac.abort(), 5_000)

// Prefer L402 even when MPP is cheaper (experimental integration).
const response = await client.call(
  'https://research-bot.example/api/summarize',
  { method: 'POST', body: JSON.stringify({ url: 'https://…' }) },
  {
    maxCostCents: 25,
    preferredRails: ['l402'],
    signal: ac.signal,
  },
)
```

## Hostile-lens invariants

Three invariants the SDK enforces and the test suite locks in:

1. **Cheapest selection is by actual minimum cost, not first match.**
   When a wallet can pay multiple rails, the rail with the numerically
   smallest `extractCostCents` wins. Ties are broken by the server's
   manifest order (stable sort).
2. **Budget check happens BEFORE payment construction.** A
   `BudgetExceededError` throw guarantees no wallet field was read,
   no payment header was built, and no retry fetch was issued.
3. **No Node-only imports.** The module graph uses only Web APIs
   (`fetch`, `ReadableStream`, `TextDecoder`, `URL`). Browser bundles
   build without polyfills.

## License

MIT
