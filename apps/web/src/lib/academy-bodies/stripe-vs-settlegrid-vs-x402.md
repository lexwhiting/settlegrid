## Three Different Things That Get Compared as Competitors

Stripe's Machine Payments Protocol (MPP), the x402 protocol, and SettleGrid get lumped together in pricing-layer discussions, but they're solving different problems at different layers of the stack. Treating them as interchangeable options leads to bad integration decisions. This lesson breaks down what each actually is (with citations to each project's own public materials), where the real overlaps and complements sit, and how to pick among them for a given tool.

A prefatory disclosure: SettleGrid ships this lesson. We've tried to apply the same standard to ourselves that we apply to Stripe and x402 — where we're weaker than a competitor on a specific dimension, that's stated; where they have limitations, those are sourced from their own public documentation rather than characterized from our perspective. If you find a claim about either Stripe MPP or x402 that you think is unfair, open an issue at the repo linked from the site footer and we'll correct the record.

Before diving in, it's worth reading the [blog post on AI agent payment protocols](/learn/blog/ai-agent-payment-protocols) for the broader protocol landscape. This Academy lesson focuses on the narrower question: for a tool developer choosing a billing path, how do these three options actually differ in practice?

## What Each One Actually Is

### Stripe Machine Payments Protocol (MPP)

Stripe announced MPP on [March 18, 2026](https://stripe.com/blog/machine-payments-protocol) as "an open standard, internet-native way for agents to pay — co-authored by Tempo and Stripe." The protocol is designed to let agents make payments on behalf of humans, with the payment infrastructure abstracted behind a machine-readable interface that works across AI platforms.

MPP sits within Stripe's broader [Agentic Commerce Suite](https://stripe.com/blog/agentic-commerce-suite), launched December 11, 2025, which bundles several related primitives: Shared Payment Tokens (SPTs — per-agent scoped payment credentials), a Checkout Sessions API for agent-initiated transactions, Stripe Radar fraud detection tuned for agent traffic patterns, and a hosted Agentic Commerce Protocol (ACP) endpoint for product catalog syndication to AI agents.

For a tool developer, Stripe MPP is most naturally thought of as "the protocol layer that lets an agent pay Stripe-accepting merchants." It's a payment-transport standard; it doesn't handle per-call metering, micropayment batching, usage-based billing, fraud detection specific to tool calling, or any of the developer-experience wrappers that turn a payment rail into a billing system. If you integrate with Stripe MPP directly, you get a clean rail for agent-initiated payments — but the metering, dispute handling, discovery, and tool-side business logic are yours to build on top.

Stripe also ships a separate [Stripe Agent Toolkit](https://docs.stripe.com/agents) focused on helping agents create and manage Stripe objects via function calling — a different concern. If you're thinking about MPP for MCP tool billing specifically, the Agent Toolkit isn't the same product.

### x402

x402 is an HTTP-native payment standard whose [official site](https://www.x402.org) describes it as "an open, neutral standard for internet-native payments." The protocol uses the standard HTTP status code `402 Payment Required` as the signal that a resource requires payment before serving, and defines how a client negotiates and settles payment before the server returns the resource.

x402 was originally developed at Coinbase (the [coinbase/x402 repo](https://github.com/coinbase/x402) is described as "a payments protocol for the internet, built on HTTP") and has since moved under the Linux Foundation. The [x402 Foundation was launched on April 2, 2026](https://www.linuxfoundation.org/press/linux-foundation-is-launching-the-x402-foundation-and-welcoming-the-contribution-of-the-x402-protocol) at MCP Dev Summit North America, with founding members including Adyen, AWS, American Express, Base, Circle, Cloudflare, Coinbase, Google, Mastercard, Microsoft, Polygon Labs, Shopify, Solana Foundation, Stripe, and Visa — a notably broad cross-industry coalition. The release cites Solana as "one of the earliest adopters of x402, driving nearly 65% of x402 transaction volume this year."

The x402 protocol is network-agnostic by design — the x402.org site notes that it's "a neutral standard, not tied to any specific network" and "supports as many networks / schemes as you want." In practice today, most x402 volume settles in stablecoins via Coinbase's facilitator, with the supported chain list published in the [x402 Foundation docs](https://www.x402.org) (verify at integration time, as the set expands). x402.org's homepage displays live metrics — "75.41M transactions, $24.24M volume in the last 30 days" at time of this writing — indicating material production usage.

For a tool developer, x402 means "any agent that can pay USDC (or other stablecoin via an x402-compatible facilitator) can call your tool, without creating an account on your platform or holding funds in your custody." The trade-off is that your callers need a crypto-native wallet or wallet-abstracted equivalent — the same friction that has historically limited crypto payment adoption in non-crypto-native developer cohorts.

### SettleGrid

SettleGrid is a billing-system-as-a-service for MCP tools and AI agents. The `@settlegrid/mcp` SDK wraps any MCP tool handler or REST endpoint with per-call metering, usage-based billing, and automated Stripe payouts in two lines of code. The hosted Smart Proxy broker routes agent payments across [nine agent payment protocols](/learn/blog/ai-agent-payment-protocols) — MCP native, x402, Stripe MPP, AP2, ACP, UCP, Visa TAP, Mastercard Verifiable Intent, and Circle Nanopayments — with detection adapters for several more. The free tier provides 50,000 operations per month with a 0% take rate on the first $1,000/month of revenue; see the [MCP billing comparison](/learn/blog/mcp-billing-comparison-2026) for the full pricing structure.

For a tool developer, SettleGrid means "I add billing to my existing MCP tool in five minutes and my tool can be paid via any of the mainstream agent payment protocols without me having to integrate each one separately." The trade-off is that you're trusting a managed platform with your billing logic rather than running it yourself; for the subset of developers who want full control over every aspect of billing, direct integration with Stripe MPP or x402 or both is a better fit.

## Where the Real Overlaps Are

The three options overlap in some places and complement in others. The overlaps are where comparative decisions actually matter.

### Stripe MPP and x402 both solve the "how does an agent pay" problem

Both are payment transport protocols — standards for how an agent with a payment method can settle with a merchant that accepts it. MPP uses Stripe's payment infrastructure for the settlement; x402 uses HTTP + crypto rails. If you're building agent-to-merchant commerce (an agent buying a product, booking a flight, paying for a subscription), these two are the candidates to support. Most serious agent platforms will support both, because their caller ecosystems span both fiat-native and crypto-native callers.

### SettleGrid sits one layer up

SettleGrid isn't a payment transport protocol; it's a billing platform that *uses* payment transport protocols (including both Stripe MPP and x402) to settle with agents. If you were to replace SettleGrid, you'd be replacing it with a custom billing implementation that wraps MPP, x402, and/or other rails — not with MPP or x402 directly. This is the source of most confused comparisons: Stripe MPP is not an alternative to SettleGrid; Stripe MPP is a protocol SettleGrid supports.

The genuine overlap SettleGrid has with each of the two is:

- **vs Stripe MPP + DIY billing:** if you're willing to build your own metering, dashboards, fraud detection, and multi-protocol routing on top of Stripe MPP, you can skip SettleGrid. Trade-off: several weeks of engineering and ongoing maintenance, versus a platform integration. The specific revenue level at which DIY becomes economically preferable depends on your engineering cost and protocol ambitions — discussed further in the section below.

- **vs x402 direct:** if your callers are entirely crypto-native and you're comfortable operating a crypto-native tool (handling wallet connectivity, stablecoin volatility edge cases, chain-specific facilitator selection), you can integrate x402 directly and skip the SettleGrid layer. Trade-off: your addressable agent market is smaller than it would be with multi-protocol support.

## A Side-by-Side Reference Table

Pulling the above into a single comparison, with every cell backed by the cited public source:

| Dimension | Stripe MPP | x402 | SettleGrid |
|-----------|------------|------|------------|
| Launch | [March 2026](https://stripe.com/blog/machine-payments-protocol) | Coinbase-origin; [LF Foundation April 2026](https://www.linuxfoundation.org/press/linux-foundation-is-launching-the-x402-foundation-and-welcoming-the-contribution-of-the-x402-protocol) | 2025 |
| Governance | Stripe + Tempo (co-authors) | Linux Foundation (x402 Foundation) | Private company |
| Layer | Payment transport | Payment transport | Billing + settlement platform |
| Settlement currency | Fiat (Stripe's rails) | Stablecoin (network-agnostic) | Multi-protocol (fiat + stablecoin via sub-integrations) |
| Typical caller auth | [SPT (Shared Payment Token)](https://stripe.com/blog/agentic-commerce-suite) | Crypto wallet signature | Platform-issued API key, routed to the chosen rail |
| Typical caller ergonomics | Fits fiat-native enterprise agents naturally | Fits crypto-native agents naturally | Designed to abstract rail selection |
| Integration surface | Direct API: your code handles metering, dashboards, fraud tooling | Direct SDK (TypeScript, Python, Go, Java): your code handles metering, dashboards, fraud tooling | Wrapped: platform ships metering, dashboards, fraud tooling |
| Built-in metering | No (payment protocol, not a billing layer) | No (payment protocol, not a billing layer) | Yes (per-call, tiered, freemium, outcome-based) |
| Built-in fraud detection | Yes ([Radar for agents](https://stripe.com/blog/agentic-commerce-suite)) | No (rail-level controls only) | Yes (platform-level) |
| Agent-side adoption surface | Stripe-connected agents | Coinbase-sphere agents + x402 Foundation members | Multi-protocol via Smart Proxy |
| Platform/settlement fee | Stripe's standard fees (`2.9% + 30¢` on cards, `0.8%` ACH — see [Stripe pricing](https://stripe.com/pricing)) | On-chain gas + facilitator fee (varies by chain) | Progressive take rate: 0% on first $1K/mo, up to 5% at $50K+ |

Two caveats on the table. First, some of these cells describe the "typical" case rather than hard limitations — x402 is network-agnostic, so "stablecoin" is the usual case but not the protocol definition. Check each project's current docs at integration time if the answer matters. Second, the comparison deliberately uses the same shape for each column; in practice, the three options aren't head-to-head substitutes for every use case.

## A Decision Framework

The three-by-three matrix of "what's your caller base × what's your team capacity" covers most real decisions.

### If you're a solo developer or small team shipping an MCP tool

**Pick SettleGrid.** The reason isn't that SettleGrid is "better" than Stripe MPP or x402; it's that the alternative at this team size is a custom billing stack, and the opportunity cost of those 2-4 weeks of engineering is much higher than the platform fee. You'll also support more agent payment protocols than you'd realistically wire up yourself. Upgrade to Stripe MPP direct or x402 direct later if your usage profile makes the platform fee significant.

### If you're a crypto-native platform or tool (stablecoin-denominated usage)

**Pick x402 direct.** The [Coinbase x402 SDKs](https://github.com/coinbase/x402) in TypeScript, Python, Go, and Java give you clean integration in your language of choice. You'll have to build the billing UI and dashboard yourself, but for a crypto-native platform that's often already in-flight anyway. The x402 Foundation's institutional backing (Linux Foundation host, Stripe/Visa/Mastercard among founding members) makes it a durable choice.

### If you're building agent-to-merchant commerce (selling products or services via agents)

**Pick Stripe MPP.** Stripe's Agentic Commerce Suite is purpose-built for this — SPTs give you agent-scoped payment credentials, Radar gives you fraud tooling, and the Checkout Sessions API handles shipping, tax, and order flow. The [Stripe Agent Toolkit](https://docs.stripe.com/agents) complements this with function-calling support for creating Payment Links and managing Stripe objects.

### If you're an enterprise platform serving heterogeneous agent callers

**Pick a multi-protocol layer.** This is the SettleGrid case, but you could also build it yourself on top of Stripe MPP + x402 + any other rails your callers expect. The principle is the same: at enterprise scale, your callers don't want to care which protocol the merchant accepts, and the operational cost of missing a caller because you only support one protocol is large.

## What "Supporting Multiple" Actually Means

The argument for multi-protocol support is that agent ecosystems are pluralistic — some agents are built on Coinbase AgentKit (x402-native), some on Anthropic's MCP SDK (MCP-native), some on Stripe's Agent Toolkit (Stripe MPP-native), some on custom stacks. A tool that supports only one protocol excludes the agents that prefer the others. A tool that supports all three captures traffic from all three.

Implementing this yourself is non-trivial. Each protocol has its own authentication model (SPTs for Stripe MPP, crypto wallet signatures for x402, and typically platform-issued API keys when MCP tools are reached through a managed billing layer), its own settlement lifecycle (instant for in-custody balances, on-chain finality for x402), and its own failure modes (declined cards vs insufficient balance vs chain reorg). Harmonizing these into a single consistent experience requires a middleware layer.

That middleware layer is what SettleGrid (and in different forms, other billing platforms) provides. The value proposition isn't "SettleGrid is a better protocol" — it's "SettleGrid handles the protocol fragmentation so you don't have to." If you're willing to handle that fragmentation yourself, you'll save platform fees at the cost of engineering time. The math flips somewhere between $10K and $100K monthly revenue, depending on how much your engineering time is worth and how many protocols you want to support.

## Migration Paths

Mid-flight pricing/protocol changes are often avoidable with the right foundation. Three specific migration scenarios are worth planning for.

### From DIY Stripe to SettleGrid (or vice versa)

If you built on raw Stripe and want to move to a managed layer, the migration work is mostly on the consumer side: callers who prepaid credits or had saved cards need to be migrated to the new platform's billing entity. Usually this means a grace period where both old and new paths work, with a clear sunset date for the old path. SettleGrid's SDK supports drop-in replacement of `sg.wrap()` over an existing Stripe-metered handler, so the tool code barely changes.

### Adding x402 support to a fiat-native tool

If you're currently charging in USD via Stripe-based rails and want to open up to crypto-native agents, the path is to add x402 as a parallel settlement option rather than replacing fiat. Most tools that do this keep their primary pricing in USD and price x402 calls at the equivalent stablecoin amount, settled at the agent's chosen chain. SettleGrid's Smart Proxy handles the dual-path routing automatically; if you're integrating x402 yourself, the [x402 SDKs](https://github.com/coinbase/x402) provide the client-side patterns.

### Adding Stripe MPP support to an x402-native tool

Less common but worth mentioning. Tools that originally shipped x402-native to capture crypto-native early-adopter volume sometimes want to add fiat support as their market broadens. Stripe MPP is the natural choice because it provides the strongest enterprise-facing payment infrastructure (including fraud detection, chargebacks, and settled-currency reporting that compliance teams require). The implementation pattern mirrors the reverse migration above: run both rails in parallel, let callers pick, and observe the mix over time.

## What This Choice Doesn't Determine

Three things the pricing/protocol decision genuinely doesn't determine, despite often being discussed as if it did.

**Your pricing model.** Whether you charge per-call, subscription, tiered, or outcome-based ([lesson 2 on per-call vs subscription](/learn/academy/per-call-vs-subscription) covers this in depth) is orthogonal to whether you use Stripe MPP, x402, or SettleGrid. Every model can be implemented on every rail.

**Your margin economics.** Rail choice affects settlement fees (Stripe's 2.9% + 30¢, x402's on-chain gas, SettleGrid's platform fee), but those differences are usually smaller than the differences between your per-call price and your cost floor. Pricing rails do not solve a bad pricing model.

**Your discoverability.** Being reachable by agents is a separate problem from being payable by them. Listings in MCP registries, shadow directory presence, and SDK discoverability matter at least as much as which payment protocol you accept. The [SettleGrid shadow directory](/mcp) is one piece of that; others include PulseMCP, mcp.so, Smithery, and Glama.

## Common Confusion Points

Several specific things are frequently gotten wrong in comparative discussions of these three. Worth stating explicitly so you can skip them.

### "Stripe MPP is Stripe's version of MCP"

Not quite. [MCP](/learn/blog/mcp-billing-comparison-2026) is a protocol for agents to discover and call tools — built originally at Anthropic and now maintained as an open-source project at [github.com/modelcontextprotocol](https://github.com/modelcontextprotocol). Importantly, MCP's core spec deliberately does not include payment semantics. Stripe MPP is a payment protocol designed to be complementary to MCP: an MCP tool can accept payments via Stripe MPP, but neither standard subsumes the other. They sit at different layers of the stack.

### "x402 is only for crypto-native agents"

The protocol itself is network-agnostic per the [x402.org site](https://www.x402.org), but in practice most current x402 volume settles in stablecoins on Coinbase-facilitator-supported chains. The x402 Foundation's founding members include fiat-native giants (Visa, Mastercard, American Express, Stripe), which suggests fiat-rail x402 implementations may emerge, but at the time of this writing the realistic integration path for a tool developer is "crypto-native x402." Check the x402 Foundation's current docs at integration time.

### "SettleGrid competes with Stripe"

No. SettleGrid uses Stripe Connect for payouts to tool developers, and is one of many billing layers sitting on top of Stripe's infrastructure. The same relationship exists with x402 — SettleGrid's Smart Proxy routes to x402 facilitators rather than replacing them. The competitive overlap is with DIY billing implementations, not with the underlying payment rails.

### "Picking one locks you out of the others"

The migration paths described earlier work in every direction. A tool that starts on SettleGrid can be moved to direct Stripe MPP integration when revenue scale justifies it; a tool on raw x402 can add Stripe MPP for fiat-native callers; a tool on Stripe MPP direct can add SettleGrid's Smart Proxy for the multi-protocol abstraction. The operational cost of migration is real but not prohibitive — it's measured in days of engineering, not quarters.

### "The best rail is the one with the lowest fees"

Fee comparisons between the three are misleading because the layers are different. Stripe's `2.9% + 30¢` is a transaction fee; x402's on-chain gas is a network fee (varies by chain congestion and transaction size); SettleGrid's progressive take rate is a platform-layer fee on top of whichever transport rail is used. Comparing them directly produces wrong conclusions. The right comparison is total cost including engineering time — which is often dominated by the one-time integration cost, not the per-transaction fee, at realistic tool revenue scales.

## Short Version

Stripe MPP and x402 are payment transport protocols at roughly the same layer — Stripe MPP is Stripe's agentic payment standard for fiat-native agent commerce, x402 is the Linux Foundation-hosted HTTP-native crypto payment standard. SettleGrid is one layer up — a billing platform that uses both (and others) as settlement rails. Choose among them by matching the decision to your caller base and your team capacity, not by picking the "best" one abstractly. Every factual claim in this lesson links to the primary source so you can verify directly rather than trust the comparison.
