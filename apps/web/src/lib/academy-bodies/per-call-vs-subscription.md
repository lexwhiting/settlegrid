## The Wrong Frame: "Which Is Better?"

Per-call vs subscription gets asked as a values question — "is SaaS better than usage-based?" — but that framing produces worse answers than treating it as a diagnostic. The correct question is: given your tool's usage shape, your caller's budget structure, and your own margin floor, which model leaves the least money on the table? For some tools, the answer is per-call. For others, it's subscription. For a surprising number of mature tools, it's both — a hybrid where the two models handle different customer segments.

This lesson walks through the decision framework. We'll look at the three variables that actually determine pricing-model fit (usage predictability, value-to-price ratio, caller scale), when each model wins along those axes, how hybrid models work in practice, and how to migrate between models without breaking your existing callers. The goal is to give you a defensible answer to "which model should I pick?" — not "which model is fashionable this quarter?"

If you landed here before reading [lesson 1](/learn/academy/pricing-your-mcp-server), the short prerequisite is: know your cost floor per call. The rest of this lesson assumes you have that number.

## The Three Variables That Actually Matter

Most pricing-model debates happen at the wrong altitude. "Per-call is simpler!" or "Subscription has predictable revenue!" are true statements that don't decide anything. Three lower-level variables decide.

### Usage predictability

For a given caller, how well can they predict their monthly call volume?

- **High predictability** — a coding-assistant tool used 8 hours a day by a specific developer. Volume rarely varies more than 20% week-to-week.
- **Medium predictability** — a compliance-check tool a company runs nightly against all deployments. Volume scales with deploy count, which trends but bursts.
- **Low predictability** — a research-synthesis tool an agent reaches for whenever it hits an unfamiliar topic. Volume could be zero one week, 500 calls the next.

High-predictability usage makes subscription viable: the caller can match a plan to their actual need. Low-predictability usage breaks subscription: the caller either overpays for capacity they never use or hits a ceiling and can't complete a task. Per-call handles all three predictability levels because each call is priced independently.

### Value-to-price ratio

For each successful call, what's the estimated value delivered divided by the price charged?

- **High ratio (>20×)** — your tool produces an output worth $5 and charges $0.25. The caller would happily pay 2× more.
- **Medium ratio (3-20×)** — your tool produces $0.30 of value and charges $0.05.
- **Low ratio (<3×)** — your tool produces $0.10 of value and charges $0.05. There's no room to price up.

High-ratio tools can support subscription pricing because the customer willingly commits to a monthly amount even if they underuse. Medium-ratio tools land naturally at per-call because each call's value is recoverable in a per-call price. Low-ratio tools are nervous pricing zones — the margin is thin in any model, and subscription compounds the risk by locking in the thin margin for a full month.

### Caller scale

What's the typical call volume per customer per month?

- **Small (0-500 calls/month)** — individual developers, researchers, small agents.
- **Medium (500-50K/month)** — small-to-midsize agent operators.
- **Large (50K+/month)** — enterprise agent deployments, production agent platforms.

Small-scale callers prefer per-call because they don't want to commit to a monthly fee for usage they're still exploring. Large-scale callers often prefer subscription because it simplifies their own internal cost accounting (one line item instead of thousands of micropayments). Medium-scale is where it gets interesting: those callers benefit most from hybrid models that offer both.

## When Per-Call Wins

Per-call is the strongest default. Four scenarios make it unambiguously the right choice.

### Exploratory / trial-heavy usage

When an agent is sampling your tool to see if it fits, every call carries discovery value. Per-call lets the agent try you with a single invocation — no commitment, no signup friction — and pay pennies to know whether you're worth integrating. Subscription would require a monthly commitment before the agent knows if it'll use you once or a thousand times. For tools that still need to earn their place in an agent's planner, per-call is the on-ramp.

### Unpredictable bursty volume

If your callers can't forecast their monthly usage within a 2× range, any subscription plan you offer will be wrong for them. They'll either overpay (ceiling too high) or underdeliver (ceiling too low). Per-call pricing lets volume float naturally — the price is a unit cost, not a capacity commitment.

### Cross-caller variance

If some callers use you 10 times a month and others use you 10,000 times, no single subscription plan fits both. You'd have to ship a tiered subscription ladder — Starter, Builder, Scale — and maintain the tier boundaries as usage patterns evolve. Per-call sidesteps that entirely: one price, one unit, volume varies per caller without any plan engineering.

### Cost-variable underlying compute

If your per-call cost floor varies meaningfully (some calls run $0.01 of compute, others run $0.20), per-call pricing can track your cost. Subscription pricing locks you in at an average, which leaves you exposed to heavy-usage subscribers and overcharging light-usage ones.

The [per-call billing implementation guide](/learn/blog/per-call-billing-ai-agents) walks through the operational mechanics; this lesson stays at the pricing-model layer.

## When Subscription Wins

Subscription is the right choice in a narrower set of cases, but when those conditions are met it outperforms per-call materially.

### High-predictability, high-volume usage

When a caller has stable volume in the thousands-per-month range and a clear ceiling, a subscription plan that covers that volume removes billing friction for both sides. The tool operator gets a predictable revenue baseline; the caller gets a predictable expense line. This is the classic B2B SaaS dynamic, applied to the agent-to-tool world.

### Buyer has SaaS-shaped budget authority

Inside large organizations, finance teams are structurally easier to sell subscriptions to than usage-based billing. A $500/month recurring line item is faster to approve than a "we'll spend somewhere between $200 and $3000 per month" variable expense. If your buyer is an enterprise team, subscription signalling makes the sale easier even when per-call would be mathematically cheaper for the customer.

### Primarily "unlimited" usage with soft caps

Tools that function best when the caller isn't counting calls — coding assistants, chat copilots, continuous monitoring — benefit from subscription pricing because it removes the "should I call this?" friction. When every call feels metered, callers use the tool less, which reduces its actual utility. When calls feel "free within your plan," callers use it more, which increases stickiness and retention.

### High value-to-price ratio supports annual lock-in

If the value-to-price ratio is high enough (>20×), you can sell an annual subscription with a meaningful discount and still profit. Annual pre-payment reduces churn, improves cash flow, and creates lock-in that per-call pricing can't match.

## Side-by-Side Economics

The same 10,000-call-per-month workload priced three different ways, to make the economics concrete. Assume a cost floor of `$0.01` per call and a target 60% gross margin.

| Model | Price structure | Revenue @ 10K calls | Gross margin | Caller's view |
|-------|----------------|---------------------|--------------|----------------|
| Per-call | `$0.025/call` | $250 | 60% | Pay per use; no commitment |
| Subscription (Starter) | `$199/month, includes 10K` | $199 | 50% | Fixed monthly; predictable |
| Subscription + overage | `$99/month includes 4K, $0.025/call overage` | $249 | 60% | Base fee + usage above plan |
| Volume-discounted per-call | `$0.025/call <5K, $0.022/call 5K-50K` | $231 | 55% | Rewards scale; still usage-based |

Two things to notice. First, at 10K calls, per-call and subscription+overage produce almost identical revenue — the subscription structure isn't actually changing what the tool earns, it's just changing how the caller perceives the bill. Second, pure subscription at this price point produces lower revenue than per-call, because the caller "wins" on usage at the plan's edge while you carry the infrastructure for unused capacity. The subscription-wins scenarios earlier in the lesson were ones where the value-to-price ratio was high enough that the plan price could be set above pure per-call equivalents.

The math shifts at lower or higher volumes. At 1,000 calls per month, per-call earns $25 while subscription still earns $199 — a big win for subscription, if the caller is willing to sign up at that cost. At 100,000 calls per month, per-call earns $2,500 while a $199/month Starter plan leaves most callers in overage territory, eroding the subscription advantage. These volume inflection points are why hybrid models exist.

## Hybrid Models

Most mature tools end up with some form of hybrid. Three patterns are common.

### Freemium + per-call

The first N calls per month are free; further calls are per-call priced. This is the pricing-model version of freemium, and it's the right fit when discovery matters and follow-on usage is the revenue goal. The [MCP server free-tier configuration guide](/learn/blog/mcp-server-free-tier-usage-limits) shows how to wire this up at the SDK level — in the pricing-model layer, the free tier is a discovery funnel that converts a fraction of triers to payers.

Freemium risks: evaluation bots that use exactly your free allowance and never convert, scraping abuse, and competitors running you against your own free tier to benchmark their own tool. Mitigate with per-account (not per-key) free allowances and with meaningful-but-bounded free capabilities (the free tier should hint at value, not replace the paid tier).

### Subscription base + per-call overage

A subscription plan includes N calls per month; calls beyond N are priced per-call. This is the pricing model that serves both predictable callers (within their plan) and bursty callers (paying overage on exceptional weeks). It also creates a natural sales conversation: customers who hit their overage often are candidates for plan upgrades.

Subscription + overage works well when the base plan covers 80-90% of a typical caller's usage. If the base plan only covers 20% and everyone is always in overage, the model is broken — callers feel like they're paying a subscription AND per-call, and they'll either churn or negotiate.

### Per-call + tier-based volume discount

Pure per-call pricing with an automatic volume discount at certain thresholds. A tool might charge `$0.05/call` up to 10K calls/month, then `$0.04/call` from 10K to 100K, then `$0.03/call` above 100K. This is technically per-call, but the ladder creates subscription-like incentives for scale callers without requiring them to commit to a plan.

This model is ergonomically simple for the caller (no plan to pick) and naturally rewards scale. It's also forgiving of pricing mistakes: if your per-call price turns out to be too high, the volume tiers let large callers self-select into acceptable economics without a negotiation.

## Three Short Case Studies

The theory is cleaner than the real world. Four illustrative patterns drawn from common MCP-ecosystem dynamics — composite teaching examples rather than claims about any specific named tools, but representative of the decisions operators actually face.

The sentiment-analysis tool from [lesson 1](/learn/academy/pricing-your-mcp-server) landed at per-call because its usage pattern was wildly bursty across callers. Attempts to test subscription failed because no single plan fit more than a third of their callers. The fix was to run per-call exclusively and add a volume discount at 50K calls/month to keep large callers from churning to DIY alternatives.

A documentation-search tool tried pure subscription first — "unlimited searches for $49/month" — and got adopted by three callers in its first month who used it 2,000+ times each. Two of them were running evaluation frameworks and generated no downstream revenue; one was a legitimate heavy user. The revenue barely covered infrastructure. Switching to `$0.02/call` with a `$0` base fee dropped total revenue 30% in month one but improved gross margin by 5x and filtered out the evaluators. The tool was profitable by month three.

A compliance-check tool ran parallel pricing for six months: subscription for enterprise accounts, per-call for individual developers. The enterprise cohort accepted a $299/month plan covering up to 5,000 checks; the developer cohort paid `$0.50/check` with no minimum. This worked because the two cohorts had different value-to-price ratios (enterprise callers needed to run checks on every pull request; developers checked a handful of repos ad hoc) and very different purchasing processes. The hybrid was more operational overhead but captured meaningful revenue from both segments.

A data-enrichment tool started with subscription-only pricing and got stuck in negotiation with every enterprise prospect — each one wanted a different plan tier, a different overage rate, or a different minimum commitment. After nine months of bespoke contracts, the team rebuilt on a two-SKU pricing page: a self-serve Developer plan at `$49/month` for 5K calls and a self-serve Team plan at `$199/month` for 25K calls, both with `$0.02/call` overage above the cap. Enterprise prospects could still negotiate custom terms, but self-serve sign-ups suddenly moved in hours instead of weeks. The lesson is that the enterprise-style negotiation was a symptom of too few SKUs; giving prospects a clear self-serve option converted most of them without any negotiation at all.

## Common Mistakes

The same pricing-model mistakes recur across the MCP ecosystem. Four patterns worth recognizing so you can skip them.

### Picking subscription because it feels more professional

SaaS cultural default says "real businesses sell subscriptions." That heuristic is a trap when applied to AI tools, because the agent-to-tool world doesn't have the same dynamics as the human-to-software world. Subscriptions work in traditional SaaS because the buyer has stable, predictable usage and values the certainty of a fixed monthly cost. Agents have neither of those properties — their usage is goal-driven, not calendar-driven, and they don't value certainty over cost. Pick subscription only if your variables point there, not because it sounds more mature.

### Shipping too many tiers at launch

A pricing page with Free / Starter / Builder / Pro / Scale / Enterprise is a sign that the team hasn't decided who the product is for. Every tier adds engineering surface area (enforcement, billing, plan-level feature gating) and every tier adds sales-conversation overhead (which one should I pick?). Start with one or two tiers and add more only when real usage data shows where the natural segment boundaries sit. Most tools launch best with exactly one SKU and let volume discounts do the segmentation work.

### Baking pricing into the MCP interface

A frequent anti-pattern is encoding pricing assumptions into the tool's method signatures or metadata — e.g., a `premium_search` method that exists only because the developer wanted to charge differently for one feature. This couples your pricing model to your API surface, which means changing pricing requires a breaking API change. Keep the pricing decision in the billing layer, not in the tool interface. The same method can have different costs for different callers without the caller ever seeing that complexity.

### Setting prices by copying a competitor verbatim

Competitors have different cost floors, different caller mixes, and different margin targets. Copying their price without understanding the underlying economics just imports their mistakes — or their advantages, which don't transfer. Use competitor prices as one input to your benchmarking, not as the answer. If you're genuinely the nth entrant in a category, price 10-20% below the median initially to win early adoption, then iterate up once you've captured the segment.

## Migrating Between Models

Pricing-model changes are the hardest pricing changes to execute. Three rules reduce the risk.

### Never retroactively change a caller's pricing

If a caller signed up under subscription, they should be able to stay on subscription for the current billing cycle at minimum. Retroactive reprices burn trust and create support tickets that eat any revenue gain from the migration. Grandfather existing plans, apply new pricing to new sign-ups only, and migrate gradually.

### Use a separate SKU for the new model

If you're adding per-call as a second option alongside subscription, create it as a distinct purchasable SKU rather than modifying the existing plan. Let callers self-select. Observe adoption patterns before deciding whether to deprecate the old SKU.

### Move the announcement before you move the prices

Your existing callers should learn about the new pricing from you, in a clear email with one actionable choice (stay, switch, or cancel). Finding out mid-month through an unexpected invoice is how customers end up on Hacker News complaining about your pricing.

The [MCP billing comparison](/learn/blog/mcp-billing-comparison-2026) post covers the operational mechanics of supporting multiple pricing models simultaneously; the deciding question at the model level is whether your billing layer lets you ship a new SKU in an afternoon. If changing pricing requires a two-week deploy cycle, you'll run fewer experiments than you should.

## The Short Playbook

If you're picking a pricing model for a new MCP tool, work through these questions in order:

1. **What's your caller's usage predictability?** If it's low or highly variable across callers, start with per-call. Subscription requires the caller to know their usage in advance, and AI tools serve callers who rarely do.
2. **What's the value-to-price ratio?** If it's below 3×, per-call is safer because it lets you adjust more quickly and caps your downside on any single call. If it's above 20×, subscription becomes viable because the customer willingly commits for the value.
3. **Who's the buyer?** If it's an enterprise team with SaaS-shaped budget authority, subscription (or subscription+overage) is worth considering — finance processes are structurally easier to navigate with recurring line items. If it's an individual developer or a small agent operator, per-call removes the commitment friction they'd otherwise balk at.
4. **What's the expected call volume per caller per month?** If it's under 500, per-call wins on ergonomics — subscription feels heavy for that scale. If it's over 50K, subscription or volume-discounted per-call wins — the transactional overhead of per-call billing at that scale starts to cost both sides real money.
5. **What's your willingness to maintain multiple SKUs?** Hybrid models capture more revenue but demand more operational effort. If you're a solo developer, start simple — single SKU, single price — and add complexity only when data demands it.

Most first-time tool publishers will answer those questions in a way that lands them on pure per-call. That's fine — per-call is the default for a reason, and you can evolve to hybrid later when you have real usage data to inform the transition. What you want to avoid is picking subscription because it "feels more professional" or picking per-call because it's "what everyone else does." Pick the model your variables point to, run it for three to six months, and revisit.

One practical note: whatever model you start with, make sure your billing layer supports switching. If trying subscription requires redeploying your tool or reshaping the MCP interface, you'll never run the experiment — and the cost of not experimenting is much higher than the cost of building on a flexible foundation from day one.
