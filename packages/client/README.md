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

The three usage modes called out by the P3.K3 spec card — call from
Node, call from browser, call with a budget cap — each get one
worked example below.

### 1. Call from Node

```ts
import { createSettleGridClient } from '@settlegrid/client'

const client = createSettleGridClient({
  wallets: {
    mpp: { sharedPaymentToken: process.env.SETTLEGRID_MPP_SPT! },
  },
})

const response = await client.call(
  'https://weather-bot.example/forecast',
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ city: 'Sacramento' }),
  },
)
const forecast = await response.json()
console.log(forecast)
```

The initial request triggers a 402; the client parses the manifest,
picks MPP, attaches `X-Payment-Protocol` and `X-Payment-Token`, and
retries. If the tool accepts the SPT, the response comes back 200
and `forecast` holds the parsed body.

### 2. Call from browser

Browsers never hold private keys. Your server issues a Shared
Payment Token (SPT) after the user authenticates; the browser
receives the SPT as opaque material and uses it as its MPP wallet.

```ts
import { createSettleGridClient } from '@settlegrid/client'

async function fetchSpt(toolSlug: string): Promise<string> {
  const res = await fetch(`/api/issue-spt?tool=${encodeURIComponent(toolSlug)}`)
  if (!res.ok) throw new Error('SPT issue failed')
  return (await res.json()).spt
}

const toolUrl = 'https://search-bot.example/api/v1/search'

// Discovery runs without a wallet — the server advertises supported
// rails so the browser knows WHICH credential to request from its
// server.
const bootClient = createSettleGridClient()
const accepts = await bootClient.discoverProtocols(toolUrl)
console.log('advertised rails:', accepts.map((a) => a.scheme))

const spt = await fetchSpt('search-bot')
const client = createSettleGridClient({
  wallets: { mpp: { sharedPaymentToken: spt } },
})
const response = await client.call(toolUrl, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ q: 'acme widgets' }),
})
const results = await response.json()
```

The isomorphic module graph is what makes this work — the same
`@settlegrid/client` import that runs in Node also builds for the
browser with zero Node-only shims.

### 3. Call with a budget cap

`maxCostCents` short-circuits BEFORE any payment is constructed:

```ts
import { createSettleGridClient, BudgetExceededError } from '@settlegrid/client'

const client = createSettleGridClient({
  wallets: {
    mpp: { sharedPaymentToken: process.env.SETTLEGRID_MPP_SPT! },
    l402: {
      macaroon: process.env.SETTLEGRID_L402_MACAROON!,
      preimage: process.env.SETTLEGRID_L402_PREIMAGE!,
    },
  },
  defaultMaxCostCents: 50, // fallback cap applied to every call
})

try {
  const response = await client.call(
    'https://research-bot.example/api/summarize',
    { method: 'POST', body: JSON.stringify({ url: 'https://…' }) },
    { maxCostCents: 5 }, // tighter per-call cap
  )
  console.log(await response.json())
} catch (err) {
  if (err instanceof BudgetExceededError) {
    console.error(
      `Budget blocked: cheapest rail '${err.rail}' wants ${err.costCents} ` +
        `cents but cap is ${err.maxCostCents}. No payment was constructed.`,
    )
  } else {
    throw err
  }
}
```

When a `BudgetExceededError` is thrown, the SDK guarantees no wallet
material was read, no payment header was built, and no retry fetch
was issued — the throw happens immediately after cheapest-rail
selection, before `payer.buildPayment` is called.

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
