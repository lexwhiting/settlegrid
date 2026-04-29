If you have been watching the agent commerce stack take shape over the last 12 months, you have probably noticed three protocols converging: **MCP** for tool discovery, **x402** for payment settlement, and a third layer that has gotten less attention but matters just as much — **ERC-8004 for agent identity**. This post explains what ERC-8004 actually is, why it exists, what it specifies (and what it pointedly does not), and what it means for developers shipping monetized MCP tools today.

ERC-8004 is currently a **Draft** standards-track Ethereum Improvement Proposal authored by Marco De Rossi (MetaMask), Davide Crapis (Ethereum Foundation), Jordan Ellis (Google), and Erik Reppel (Coinbase). The cross-organization authorship is the actual story here. This is not a vendor protocol that one company controls — it is a multi-stakeholder proposal from four of the most influential organizations in the agent payments space, working toward a shared identity layer for trustless agent-to-agent commerce.

## Why Agent Identity Needs Its Own Standard

Most discussion of "the agent economy" focuses on how agents discover services and how they pay for them. MCP solved discovery in 2024-2025. The x402 Foundation solved payment settlement in early 2026. The piece nobody had standardized was **how an agent proves who it is across services without depending on a central platform**.

In a traditional API economy, identity is platform-issued. RapidAPI gives you a key. Stripe gives you a publishable key. SettleGrid gives you an `sg_live_*` key. Each platform owns the identity for its own surface, and reputation does not transfer when you move between platforms. This is fine when humans are in the loop — a human developer can reapply for credentials and rebuild reputation manually. It breaks down when the consumer is itself an autonomous agent that may interact with hundreds of services in a single planning loop and needs portable, verifiable trust.

ERC-8004 attempts to solve that portability problem by putting the minimum viable amount of identity and trust data on-chain, while leaving everything else (reputation algorithms, validation logic, application-specific rules) off-chain in pluggable layers. It is deliberately a thin protocol, not a platform.

## What ERC-8004 Actually Specifies

The proposal defines three on-chain registries and the function interfaces each one exposes. Everything else — reputation aggregation, validation algorithms, agent metadata schemas — is left to off-chain components or higher-layer standards.

### 1. Identity Registry

The Identity Registry extends ERC-721 (the standard NFT interface) with URI storage. Each agent gets a globally unique identifier of the form `{namespace}:{chainId}:{identityRegistry}:{agentId}`. The registry exposes registration methods, metadata getters and setters, and a wallet-binding mechanism so the agent's identity can be associated with an EVM address that is updated via signed authorization.

The function surface is small. `register()` mints a new agent NFT (with optional URI and structured metadata). `setAgentURI()` updates the off-chain registration file. `setAgentWallet()` binds the agent identity to a wallet address using an EIP-712 signature with a deadline. `getAgentWallet()` resolves the current binding. `getMetadata()` and `setMetadata()` provide on-chain key-value metadata storage for things that genuinely need to live on chain.

The key design assumption is that agents are portable, censorship-resistant identifiers. Because the identity is an ERC-721 NFT, every agent is immediately compatible with existing wallets, marketplaces, and management tools that already understand NFTs. The proposal supports agents being registered on multiple chains and resolved via a namespace prefix.

### 2. Reputation Registry

The Reputation Registry is where clients submit structured feedback about agents. The core function is `giveFeedback(agentId, value, valueDecimals, tag1, tag2, endpoint, feedbackURI, feedbackHash)` — the only required arguments are `value` and `valueDecimals` (where `valueDecimals` ranges from 0 to 18, supporting both integer ratings like 1-5 and fixed-point scores like 0.95). The optional fields support tagging by category, linking to off-chain feedback content, and content-addressed integrity hashes.

The registry deliberately does not aggregate or rank. It stores raw feedback signals on-chain so they are publicly composable, and leaves scoring algorithms to off-chain systems that can be replaced or upgraded independently. Feedback can be revoked via `revokeFeedback()`, and agents can append responses to client feedback via `appendResponse()` so the conversation is auditable. There are read functions for clients (`getClients()`, `getLastIndex()`) and a `getSummary()` view that returns aggregate counts and average values for filtered queries.

One critical constraint: a feedback submitter cannot be the agent owner or operator. This prevents the most obvious form of self-dealing reputation inflation. Sybil resistance beyond that is delegated to higher-layer reputation systems — ERC-8004 does not try to solve Sybil attacks itself, by design.

### 3. Validation Registry

The Validation Registry lets agents request and receive independent verification of their work. An agent calls `validationRequest(validatorAddress, agentId, requestURI, requestHash)` to ask a specific validator to verify some output. The validator responds via `validationResponse(requestHash, response, responseURI, responseHash, tag)` where `response` is a uint8 from 0 to 100 representing the validation score.

The proposal explicitly supports three pluggable trust mechanisms: client reputation aggregation, crypto-economic stake-secured re-execution, and TEE (trusted execution environment) attestation. The intent quoted in the spec is "security proportional to value at risk, from low-stake tasks like ordering pizza to high-stake tasks like medical diagnosis." Different validators can run different verification methods, and applications can choose which validator types to trust.

It is worth noting that the Validation Registry is the least mature of the three registries. Independent commentary on the proposal describes it as "a design space" rather than a finished interface — meaning the function surface is defined but the operational details (who runs validators, how validators get paid, how disputes are resolved) are still being figured out by the ecosystem.

## What ERC-8004 Deliberately Does Not Do

Reading the spec, what is left out is as informative as what is included.

**It does not score reputation.** There is no canonical algorithm for converting raw feedback signals into a single agent reputation score. Different applications can build different scoring systems on the same underlying data. This is similar in spirit to how DNS does not enforce TLS — it provides the substrate, not the policy.

**It does not solve Sybil attacks.** The spec says explicitly that Sybil mitigation is delegated to reputation system layers, not the protocol itself. An adversarial actor can create unlimited new agent identities on chain. Whether those new agents accumulate trust depends on the higher-layer reputation systems built on top.

**It does not specify on-chain identity verification.** There is no built-in KYC, no proof-of-personhood, no identity claims framework beyond what an agent self-declares in its registration file. The proposal is compatible with external identity systems but does not bundle one.

**It does not define how agents discover services.** That is MCP's job. ERC-8004 is the identity layer underneath whatever discovery mechanism the application chooses.

**It does not handle payments.** That is x402's job (or MPP, or any other settlement protocol). ERC-8004 binds an agent to a wallet so payments can be routed correctly, but it is not a payment protocol.

This intentional minimalism is the proposal's biggest strength and its biggest risk. The strength is that ERC-8004 can plug into any agent commerce stack without forcing architectural decisions on the ecosystem. The risk is that the parts the proposal does not specify — reputation scoring, Sybil resistance, validator economics — are the hardest parts of building a trustworthy agent economy, and the spec does not give implementers much guidance on solving them.

## How ERC-8004 Fits With MCP and x402

The cleanest way to think about the agent commerce stack as of April 2026 is three layers:

| Layer | Standard | What it solves |
| --- | --- | --- |
| Discovery | MCP (Model Context Protocol) | How agents find tools and learn what they do |
| Identity | ERC-8004 | How agents prove who they are across services |
| Payments | x402 | How agents pay for service usage |

These three standards are complementary, not competing. An agent built on the full stack would discover a tool via an MCP server descriptor, present its ERC-8004 agent identity (resolving to a wallet address) as authentication, receive an x402 payment instruction (HTTP 402 with payment metadata), settle the payment from its bound wallet, and call the tool. The tool provider can then submit feedback about the agent's behavior to the ERC-8004 Reputation Registry, which the agent's next interaction with a different tool can use as a portable trust signal.

None of the three standards forces this exact integration pattern. You can run MCP without ERC-8004 (and most production MCP servers do today, using platform-issued API keys). You can use x402 without ERC-8004 (the x402 protocol is identity-agnostic). And you can use ERC-8004 without either MCP or x402 if you are building an agent system on top of a different discovery or payment substrate. But the three together form the cleanest end-to-end open stack for trustless agent commerce.

## What This Means for SettleGrid Users Today

SettleGrid currently authenticates consumers using API keys in the `sg_live_*` and `sg_test_*` format. These keys are platform-issued, carry SettleGrid-specific authorization metadata, and are not portable to other billing platforms or services. This is the right model for the current market — most agent traffic still flows through platform-issued credentials, and the operational maturity benefits (instant key rotation, fine-grained permissions, server-side rate limiting) outweigh the portability cost.

ERC-8004 represents a different model that may matter more as the ecosystem matures. Instead of platform-issued keys, an agent presents an on-chain identity that resolves to its bound wallet, and the platform looks up reputation signals from a public registry rather than relying on private rate-limit history. The operational trade-off is real: on-chain lookups add latency, on-chain signals can be incomplete, and key rotation happens via wallet migration rather than dashboard clicks. But the portability is real too — an agent that has built reputation across many services no longer has to start from zero every time it interacts with a new platform.

For SettleGrid users today, the practical implications are:

- **No code changes needed.** ERC-8004 is a Draft proposal, the Validation Registry is still incomplete, and the ecosystem of agents that natively speak ERC-8004 is small. Continue using `sg_live_*` keys for production authentication.
- **Track the ecosystem.** When the Validation Registry stabilizes, when major agent frameworks add native ERC-8004 support, and when on-chain reputation signals become rich enough to be useful, the trade-offs may shift.
- **Design with portability in mind.** If you are building a tool today, do not hard-code assumptions about identity that would break if the consumer transitioned from a SettleGrid API key to an ERC-8004 wallet binding. Treat the identity as opaque and let the SDK abstract where it comes from.
- **Consider participating in the standard.** ERC-8004 is in Draft. The authors are actively gathering feedback. If you are running a real MCP tool with real consumers, your operational experience is exactly the input the spec needs. The EIP repository and the Ethereum Magicians forum thread are both open for technical comments.

The longer-term signal is that the agent commerce stack is consolidating around open standards faster than any of us expected when MCP launched. MCP, x402, and ERC-8004 together describe a future where agents authenticate, discover, and pay across services without depending on any single vendor's platform. SettleGrid's role in that future is to be the operational infrastructure that makes the standards usable in production — handling the latency budgets, the fraud detection, the consumer onboarding, and the developer payouts — while staying compatible with whichever identity and payment standards win.

## Further Reading

- The ERC-8004 specification itself is at [eips.ethereum.org/EIPS/eip-8004](https://eips.ethereum.org/EIPS/eip-8004).
- The Ethereum Magicians forum thread for ERC-8004 has the active community discussion and is the right place to follow status changes.
- For more on the payment layer that pairs with ERC-8004 identity, see [AI Agent Payment Protocols Compared (2026)](https://settlegrid.ai/learn/blog/ai-agent-payment-protocols).
- For how SettleGrid handles consumer authentication and key management today, see [How to Monetize an MCP Server](https://settlegrid.ai/learn/blog/how-to-monetize-mcp-server).
- For the broader context on how the agent payments landscape consolidated in early 2026, see [MCP Tool Billing Comparison 2026](https://settlegrid.ai/learn/blog/mcp-billing-comparison-2026).
