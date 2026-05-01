We're running a public x402 facilitator at
[facilitator.settlegrid.ai](https://facilitator.settlegrid.ai).
Anyone shipping an x402-protected MCP server, REST endpoint, or
agent service can point their settlement layer at it without
standing up a gas wallet, an RPC subscription, or a signature-
verification stack of their own.

This is partly a thing we needed and partly a thing the protocol
needed. Coinbase's x402 spec turns HTTP 402 Payment Required into
a real settlement primitive: a tool returns 402 with a payment
offer, the buyer's client signs an EIP-3009 authorization, and a
*facilitator* — a third party with a funded wallet and the
verification logic — submits the on-chain transfer. The protocol
is healthier when more independent facilitators run the same
endpoints. Nevermined operates one too. So does Coinbase. Now so
do we.

## Endpoints

All three required by the x402 v2 facilitator spec are live on
day one:

- `POST /v1/verify` — validate a payment payload (signature,
  nonce, balance, time window) without settling. Use this when
  your tool wants to confirm a payment is good before doing the
  expensive work the buyer paid for.
- `POST /v1/settle` — verify, then submit the on-chain transfer
  via our gas wallet. Idempotent: same payload returns the same
  `txHash` for 24 hours, so retries don't double-charge.
- `GET /v1/supported` — capabilities envelope (schemes, networks,
  extensions). Read this first when your tool starts up; cache
  the result.

Curl examples and the request/response shapes are at
[settlegrid.ai/protocols/x402/facilitator](https://settlegrid.ai/protocols/x402/facilitator).

## What we support on day one

- **Base mainnet** (CAIP-2: `eip155:8453`). USDC at
  `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`.
- **Base Sepolia** (CAIP-2: `eip155:84532`). USDC at
  `0x036CbD53842c5426634e7929541eC2318f3dCF7e`.

That's it. Two networks. The internal SettleGrid kernel has
plumbing for more, but the public facilitator only advertises
networks I've personally end-to-end-settled on outside our dev
environment. If you want Ethereum mainnet, Optimism, Arbitrum,
or Polygon, file an issue and we'll prioritize against demand.
The supported list is a guarantee, not a roadmap.

The `exact` scheme (EIP-3009 `transferWithAuthorization`) is the
production path. The `upto` scheme (Permit2-based, useful for
metered usage where the final amount is computed at settlement
time) is in beta — `verify` works, `settle` returns a 400
`UNSUPPORTED_SCHEME` until I've shipped the Permit2 wallet
integration and tested it against a real flow. Don't build
production traffic on `upto` yet.

## How it works under the hood

The route at `/v1/verify` calls into our existing settlement
module
([apps/web/src/lib/settlement/x402](https://github.com/lexwhiting/settlegrid/tree/main/apps/web/src/lib/settlement/x402)) —
the same code path that powers the internal SDK adapter. Verify
checks the signature, nonce state, balance, and `validBefore`
window via a viem public client. Settle adds transaction
submission via a viem wallet client; on success, we cache the
result keyed on the SHA-256 of the payment payload in Redis
with a 24-hour TTL. Hitting the same payload twice returns the
cached `txHash` without burning gas a second time. Rate
limiting is per IP, per endpoint. No facilitator auth on either
side — public means public.

## Why a third public facilitator

Nevermined and Coinbase already operate facilitators, and both
work fine. Adding a third is a community contribution, not a
competition. Three reasons to use ours:

1. **Geographic and provider diversity.** Three independent
   facilitators on three different cloud providers (Vercel,
   Coinbase's infra, Nevermined's) means a single incident at
   any one of them doesn't dark the protocol for everyone.
2. **Source-available implementation.** All the verification
   and settlement code is in the SettleGrid monorepo at
   [github.com/lexwhiting/settlegrid](https://github.com/lexwhiting/settlegrid).
   If something fails on a tricky edge case, you can read the
   exact line that returned the error.
3. **No surprise auth additions.** Some facilitator operators
   reserve the right to require API keys later. Our contract is
   public-public; if we ever change that we'll announce it
   30 days ahead and document the rationale.

If your tool needs lowest-possible latency in a different
region or your SDK already pins another provider's URL, keep
using what works. The protocol is bigger than any single
facilitator — including ours.

If you're picking between SettleGrid and Nevermined more
broadly — pricing, protocol breadth, SDK languages, named
customers — the side-by-side at
[settlegrid.ai/compare/nevermined](https://settlegrid.ai/compare/nevermined)
calls out where each is genuinely stronger.

## Operational stance

I'm a solo founder. The facilitator runs on the same Vercel
deployment as the rest of the SettleGrid app, so it inherits the
same uptime profile and the same incident-response paths. Open
issues with the
[`facilitator`](https://github.com/lexwhiting/settlegrid/labels/facilitator)
label show up in our launch-week war room dashboard. For an
outage report, email
[founder@settlegrid.ai](mailto:founder@settlegrid.ai) — that's
faster than the issue tracker for time-sensitive problems.

Two things I'm explicit about:

- **The gas wallet is finite.** If you push enough volume to
  drain the wallet faster than I can refill it, settlement will
  start returning 500 `SETTLEMENT_FAILED` until I top up. There
  is no auto-refill from a treasury account today; that's
  coming. In the meantime, the wallet balance is on the
  [`/protocols/x402/facilitator`](/protocols/x402/facilitator)
  page (planned, not live yet).
- **Not yet shipped.** Tasks I owe the x402 community:
  full `upto`-scheme settlement, automated wallet refill, a
  status page beyond the GitHub issues label, and country-
  matched RPC fallback for Base. Coming next, in that order.

## What's next

Try it. Point your tool at
`https://facilitator.settlegrid.ai`, run a settlement on Base
Sepolia, and tell me where the round-trip latency or the error
messages were worse than what you're using today. I'd rather
hear that the response shape needs work than discover it from
silence. Issue, email, or
[@lexwhiting](https://x.com/lexwhiting) on X — whichever's
fastest.

The protocol is healthier with more facilitators in it. Welcome.
