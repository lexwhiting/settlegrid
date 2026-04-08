## The 2026 Protocol Explosion

> **April 2, 2026 update.** The agent payments landscape changed materially in early April. The **x402 Foundation** launched under the Linux Foundation with founding members including **Visa, Mastercard, American Express, Stripe, Coinbase, Cloudflare, Google, Microsoft, AWS, Adyen, Fiserv, Shopify, and KakaoPay**. Coinbase contributed the x402 protocol — originally created in-house — to neutral foundation governance. With 23+ companies coalescing around a single open standard, x402 is now the most credible candidate for the de facto "agentic payments protocol" of 2026. We've updated the x402 section below to reflect this. Older sections of this post still describe the pre-Foundation landscape and are kept for historical context.

In March 2026 alone, three major payment infrastructure players launched agent payment products: Stripe (Merchant Payment Protocol), Visa (Transaction Approval Protocol), and Mastercard (Agent Suite with the first live agent payment in Europe). Add Coinbase x402, OpenAI ACP, Google A2A, and several emerging standards, and the landscape has gone from zero to ten competing protocols in under a year.

This fragmentation creates a real problem for tool developers: which protocols should you support? Supporting all ten means reaching every possible agent, but implementing ten payment integrations is impractical. Supporting just one means missing agents that use other protocols.

SettleGrid solves this by supporting all 15 protocols through a single SDK integration. You integrate once, and SettleGrid handles protocol negotiation, payment processing, and settlement across all 10 standards. This section compares each protocol so you understand the landscape even if you never need to implement them directly.

## Protocol Comparison Table

Each protocol takes a different approach to agent payments. Some are HTTP-native, some are blockchain-based, and some build on existing card network infrastructure.

| Protocol | Backed By | Payment Rail | Adoption (Apr 2026) | Best For |
| --- | --- | --- | --- | --- |
| MCP | Anthropic | Via billing layer | 97M+ SDK downloads | AI tool calling (dominant standard) |
| **x402** | **x402 Foundation (Linux Foundation)** — 23+ industry backers including Visa, Mastercard, Stripe, Coinbase, Google, AWS, Microsoft, KakaoPay | HTTP 402 + crypto and fiat rails | Multi-stakeholder governance launched April 2, 2026 | **The emerging de facto standard for agent payments** |
| MPP | Stripe | Fiat (Stripe) | 100+ services | Fiat payments, enterprise |
| A2A | Google | Protocol-agnostic | Early (DeepMind) | Multi-agent orchestration |
| AP2 | Community | Protocol-agnostic | Emerging | Agent-to-agent delegation |
| Visa TAP | Visa | Card networks | Pilot phase | Enterprise, regulated industries |
| UCP | Community | HTTP-native | Emerging | Simple REST-based payments |
| ACP | OpenAI | Shopify Commerce | 12 merchants | ChatGPT plugin commerce |
| Mastercard Agent Pay | Mastercard | Card networks | First live transaction in Hong Kong, expanding to ASEAN | Enterprise, cross-border |
| Circle Nanopayments | Circle | USDC stablecoin | Emerging | Sub-cent micropayments |

## MCP: The Tool-Calling Standard

The Model Context Protocol is the dominant standard for AI tool calling, with 97 million SDK downloads and over 12,770 servers. MCP defines how agents discover, authenticate with, and invoke tools. It does not define payment semantics natively, which is why billing layers like SettleGrid exist.

MCP is protocol-agnostic about payments. Any billing system can sit on top of MCP tool calls. SettleGrid adds billing metadata to MCP responses so agents know the cost before calling and can verify the charge after. This approach preserves MCP compatibility while adding monetization.

If you build MCP tools, you should support MCP. It is the baseline. The question is which payment protocol to layer on top.

## x402: From Coinbase Project to Linux Foundation Standard

x402 is the most consequential agent payments protocol of 2026. Originally created in-house by Coinbase, it uses the HTTP 402 Payment Required status code to enable per-request payments: an agent makes a request, receives a 402 response with payment instructions, settles the payment, and retries with proof of settlement. The protocol is rail-agnostic — it works equally well with crypto micropayments, USDC stablecoin transfers, or traditional fiat networks.

**On April 2, 2026, x402 transferred to neutral Linux Foundation governance** under a new entity called the **x402 Foundation**. The founding members include the largest names in payments and cloud infrastructure: Visa, Mastercard, American Express, Stripe, Coinbase, Cloudflare, Google, Microsoft, AWS, Adyen, Fiserv, Shopify, and KakaoPay. This is a meaningfully different posture from a vendor-controlled protocol — Foundation governance means no single company can rug-pull the spec or change the licensing terms.

Several things changed materially when x402 moved under the Foundation:

- **Multi-rail support is now first-class.** Pre-Foundation x402 was strongly associated with crypto rails (originally Base L2). Post-Foundation x402 is being implemented across crypto (Coinbase, Circle USDC), fiat card networks (Visa, Mastercard), and bank settlement rails (Adyen, Fiserv). The protocol surface is the same; the rail is negotiated per request.
- **Enterprise distribution arrived.** Pre-Foundation, x402 was niche outside the crypto-native developer audience. With Visa, Mastercard, AWS, and Google as Foundation members, x402 now ships as part of those vendors' developer toolkits and SDKs. Reach is now measured in millions of developer-accessible accounts, not thousands of crypto wallets.
- **Multi-chain routing is solving fee economics.** Open-source tooling has emerged to route x402 payments across the cheapest available chain at request time (Base, Polygon, Stellar, etc.) — saving 90%+ on fees compared to single-chain implementations. This makes sub-cent micropayments economically viable for the first time.

For SettleGrid users specifically: integrating with x402 used to mean choosing a crypto rail and taking on wallet UX complexity. Post-Foundation, the SettleGrid SDK abstracts the rail selection — your tool emits 402 responses, the consumer's agent settles via whichever rail it has set up, and the metering layer doesn't care.

**Strengths**: open governance, broad industry backing, multi-rail support, sub-cent micropayments, native HTTP semantics that any web stack can implement. **Weaknesses**: still early in Foundation phase (governance and conformance suite are forming), specifications are evolving more rapidly than enterprise legal teams typically prefer, and the breadth of backers means cross-vendor interop testing is non-trivial.

If you can only invest in one new protocol integration in 2026, x402 is now the clear choice. The combination of Linux Foundation governance, the breadth of founding members, and the rail-agnostic protocol design make it the most credible candidate to become the dominant standard. The other protocols in this post remain relevant for specific niches (enterprise procurement, ChatGPT-native commerce, multi-agent orchestration) but x402 is the one to bet on for general-purpose agent payments.

## MPP: Stripe Enters Agent Commerce

The Merchant Payment Protocol, launched by Stripe on March 18, 2026, is the most significant catalyst for agent commerce in 2026. MPP adds agent-native payment flows to Stripe, the platform that already processes payments for millions of businesses. With Visa support and 100+ services at launch, MPP has the distribution to become the default fiat payment protocol for agents.

MPP works by extending Stripe Checkout with agent-specific metadata: tool descriptions, per-call pricing, usage limits, and budget authorization. Agents can discover MPP-enabled services, check prices, and authorize payments programmatically. Settlement happens through existing Stripe infrastructure.

Strengths: Stripe distribution, Visa support, fiat currency, enterprise trust. Weaknesses: Stripe processing fees (2.9% + 30 cents), no micropayment optimization (sub-dollar transactions are expensive at flat per-transaction fees).

## A2A, Visa TAP, ACP, and Emerging Standards

Google A2A (Agent-to-Agent) focuses on multi-agent orchestration rather than payments specifically. It defines how agents discover and communicate with each other, with payment as one capability. A2A is protocol-agnostic about payment rails, meaning it can work with any of the other payment protocols listed here.

Visa TAP (Transaction Approval Protocol) brings card network infrastructure to agent payments. Visa is positioning TAP for enterprise and regulated industries where compliance, audit trails, and consumer protection are non-negotiable. The protocol is in pilot phase with a focus on cross-border transactions.

OpenAI ACP (Agentic Commerce Protocol) launched with Shopify integration but has scaled back to just 12 merchants. The limited adoption suggests demand is not materializing through the ChatGPT-native commerce path. ACP may evolve or be absorbed into other standards.

Mastercard Agent Suite completed the first live agent payment in Europe in March 2026. Like Visa TAP, it targets enterprise use cases with strong compliance and audit capabilities.

## ERC-8004: The Identity Layer Underneath Agent Payments

x402, MPP, and the other protocols in this post all answer the question "how does an agent pay for a service?" None of them directly answer the question "how does the service know which agent it is talking to, and how does that agent's reputation transfer when it moves between platforms?" That gap is what **ERC-8004** is designed to fill.

ERC-8004 ("Trustless Agents") is a Draft Ethereum Improvement Proposal authored by Marco De Rossi (MetaMask), Davide Crapis (Ethereum Foundation), Jordan Ellis (Google), and Erik Reppel (Coinbase). The cross-organization authorship is noteworthy — this is not a vendor protocol, it is a multi-stakeholder proposal from the most influential organizations in the agent commerce stack. The spec defines three on-chain registries: an Identity Registry (built on ERC-721) that gives each agent a portable, NFT-compatible identifier; a Reputation Registry where clients submit structured feedback that off-chain systems can aggregate; and a Validation Registry (still incomplete and described as "a design space") that lets independent validators verify agent work via reputation, crypto-economic stake, or TEE attestation.

ERC-8004 is **not a payment protocol**. It does not handle settlement, balance management, or any of the things x402, MPP, or SettleGrid handle. Instead, it sits underneath those protocols as the identity layer that lets an agent prove who it is across any service that participates in the registry. The cleanest mental model is a three-layer stack:

| Layer | Standard | What it solves |
| --- | --- | --- |
| Discovery | MCP (Model Context Protocol) | How agents find tools and learn what they do |
| Identity | ERC-8004 | How agents prove who they are across services |
| Payments | x402 / MPP / others | How agents settle service usage |

For SettleGrid users today, ERC-8004 is something to track, not something to integrate. The standard is in Draft, the Validation Registry is incomplete, and the agent ecosystem that natively speaks ERC-8004 is small. SettleGrid's `sg_live_*` API key model continues to be the right choice for production authentication. The longer-term signal is that the open agent commerce stack is consolidating fast — MCP for discovery, ERC-8004 for identity, and x402 for payments — and the three-standard combination represents a future where agents can authenticate, discover, and pay across services without depending on any single vendor's platform.

We have a dedicated technical guide on this standard at [ERC-8004: Trustless Agent Identity for the MCP Ecosystem](https://settlegrid.ai/learn/blog/erc-8004-trustless-agent-identity), including the full registry interfaces, what the spec deliberately leaves out, and what it means for SettleGrid users specifically.

## Which Protocols Should You Support?

For most MCP tool developers, the practical answer is: use SettleGrid and support all 15 protocols without writing protocol-specific code. SettleGrid handles protocol negotiation, payment verification, and settlement for every protocol through a single SDK integration. You ship one wrap call and your tool accepts payments from any agent on any rail.

If you are building protocol support yourself, the priority order has shifted post-x402-Foundation:

- **For everyone**: **MCP + x402**. Post-Foundation x402 is the most credible candidate to become the dominant agent payments standard. Visa, Mastercard, Stripe, Coinbase, Google, AWS, Microsoft, and 15+ other founding members are all building tooling against it. If you can only support one payment protocol on top of MCP, support x402.
- **For enterprise tools that need card-network compliance**: MCP + x402 + Visa TAP. Visa TAP adds enterprise procurement, compliance, and audit trail features that x402 alone does not provide. This combination covers the largest agent audience and the most demanding enterprise buyers.
- **For ChatGPT-native commerce**: MCP + x402 + ACP. If your target consumer is ChatGPT users, ACP gives you native distribution into the ChatGPT plugin marketplace. x402 still covers the broader agent ecosystem.
- **For Stripe-native tools**: MCP + x402 + MPP. MPP gives you native Stripe distribution and existing-Stripe-account ergonomics. x402 covers everything else.

The agent payment landscape is consolidating fast. Pre-April 2026 the consensus answer was "support multiple protocols and hedge". Post-Foundation, the consensus answer is "support x402 first, layer others as your audience requires". Within 6 to 12 months, supporting x402 may be table stakes for any monetized MCP tool — much like supporting HTTPS is table stakes for any web service.

Until that consolidation finishes, supporting all 15 protocols through SettleGrid means you never have to bet on a winner. If x402 wins outright, you have it covered. If two or three protocols share the agent payments market, you have all of them. The integration cost is constant (one SDK, two lines of code) regardless of how many protocols are in play.
