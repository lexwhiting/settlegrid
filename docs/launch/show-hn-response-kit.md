<!--
  ============================================================
  FOUNDER REWRITE REQUIRED — DO NOT POST AS-IS
  ============================================================

  This response kit is for the live HN thread. The structural
  arguments below are locked; the voice, links, and specific
  numbers need your touch before the launch.

  Pre-launch tasks (≤30 min):

  1. VERIFY EVERY COMPETITOR LINK
     The kit names + links: Stripe, Gumroad, Lemon Squeezy,
     Paddle, PulseMCP, mcp.so, Smithery, Nevermined, MCPize.
     URLs included are the ones I'm confident about; re-check
     each in a browser before posting, since dead links in a
     response are worse than no link. AgenticTrade is
     referenced via the linked comparison post, not directly
     named in the response, so its URL doesn't need to ship
     in the kit. If you want it named directly, add the URL
     here first.

  2. REWRITE EACH RESPONSE IN YOUR VOICE
     The arguments are correct; the cadence isn't yours yet.
     Read each response aloud once. Strip anything that
     sounds like marketing collateral.

  3. CONFIRM PRICING NUMBERS MATCH /pricing
     The "0% on first $1,000, 2% to $10K, 5% above $50K"
     line in archetype 7 is sourced from
     apps/web/src/app/pricing/page.tsx. If you changed the
     pricing page, update this kit and the Show HN body in
     lockstep.

  3a. VERIFY ARCHETYPE 3 NUMBERS ON LAUNCH DAY
     "12,770 servers on PulseMCP, 17,194 on mcp.so, 6,000+
     on Smithery, 97 million SDK downloads, less than 5%
     generate revenue" — these come from the comparison
     post and may be stale by launch day. If you cite them
     in a live response, re-check the live counts.

  4. ADD ONE MORE ARCHETYPE IF YOU EXPECT IT
     The 10 below are the spec-required set. If you've seen
     a specific objection in beta feedback that isn't here,
     add an 11th archetype before the launch. Better to
     over-prepare than to scramble in the live thread.

  Voice: first-person singular. No "platform," "ecosystem,"
  "scale," "unlock," "leverage," "revolutionary," or
  "game-changing." First-person ("I"), not first-person
  plural ("we"). Concede when wrong; correct when wrong'd.
-->

# Show HN response kit

A pre-written response tree for the 10 most likely comment
archetypes, plus the operating rules for the first 24 hours
of the launch thread.

## Response rules (read before posting)

These are non-negotiable for the first 24 hours. The post
lives or dies on how the founder answers the first 50
comments, not on the post itself.

- **Never argue with a user.** Thank, then address. "Fair
  point — here's what I think..." Even if the commenter is
  wrong, the audience reading the thread is reading for *how
  you respond*, not who is right.
- **Never delete a comment.** Defend or concede. Deletion
  signals you can't take feedback. Even hostile comments are
  an invitation to engage.
- **Respond within 10 minutes for the first 2 hours.** HN's
  ranking algorithm rewards engagement velocity. After hour
  2, drop to a 30-minute window.
- **If a comment reveals a real bug, fix it in the same
  session and reply with the commit SHA.** This is the
  highest-impact response on HN. A "fixed in `abc1234`"
  reply turns a critic into an advocate in the same thread.
- **If you don't know an answer, say so.** "I don't know
  yet — let me check and respond." Faking an answer once
  costs the entire thread's trust.

## 10 anticipated comment archetypes

Each response is 2-4 sentences, first-person, no marketing
tone. The argument is locked; the voice is yours.

### 1. "This is just Stripe with extra steps"

SettleGrid is built on Stripe Connect, not against it.
[Stripe](https://stripe.com) handles cards, KYC, 1099-K, and
disputes. SettleGrid extends it with per-call metering, the
API-key validation cache (LRU with 5-minute TTL), credit-
balance enforcement at the wrap boundary, the multi-protocol
detection chain across nine adapters (MCP, x402, AP2, MPP,
ACP, UCP, Visa TAP, Mastercard VI, Circle Nano), and atomic
multi-hop settlement sessions. You could rebuild the metering
layer on Stripe — I did, the first time, and it took six days.
You'd still have to build the protocol detection chain and the
session primitives separately.

### 2. "Why not use Gumroad/Lemon Squeezy/Paddle?"

[Gumroad](https://gumroad.com),
[Lemon Squeezy](https://lemonsqueezy.com), and
[Paddle](https://paddle.com) are subscription-and-product
launchpads, not per-invocation billing. The MCP economy
bills per call (every search, every analysis): an agent
calls the tool, the tool decrements a balance, and the next
call needs to know the new balance with sub-second latency.
None of those tools are designed for that loop; they're
built for one-time products and recurring subscriptions.

### 3. "MCP is hype, there's no market"

[12,770 servers on PulseMCP](https://www.pulsemcp.com),
[17,194 on mcp.so](https://mcp.so), 6,000+ on
[Smithery](https://smithery.ai). The TypeScript SDK has been
downloaded over 97 million times. Less than 5% generate any
revenue today, which is the gap I'm trying to close. Real
numbers, not certainty about the long tail, but real signal.

### 4. "Your shadow directory is sketchy — you're listing repos without permission"

Fair, and worth answering directly. Every entry is a public
GitHub repo with public-facing metadata (name, description,
stars), not private code. Unclaimed shadow entries are
noindex'd by default — they don't surface in Google, only on
the SettleGrid index — and the claim flow flips a page to
indexed when the maintainer wants it discoverable. If you
saw a specific repo that shouldn't be there, paste it and
I'll remove it before this comment is 30 minutes old.

### 5. "How does this handle refunds/disputes?"

Disputes route through Stripe's standard chargeback flow on
the publisher's Connect account. Stripe owns the dispute UX;
I forward the chargeback events into the publisher dashboard.
Refunds restore the consumer's balance via a compensating
ledger entry that mirrors the original metering decrement,
posted asynchronously after the Stripe refund settles. A
publisher-facing disputes UI is on the roadmap for the next
milestone; today the data lives in the Stripe dashboard, the
SettleGrid affordance isn't there yet.

### 6. "What stops me from running this myself with Redis + Stripe?"

Nothing. It's roughly a week of work the first time and a
maintenance tax forever (webhook signature verification,
idempotency keys, refund reversals, rate-limit headers,
fraud detection, the per-publisher onboarding flow). SettleGrid
is the bet that the week of work isn't worth doing twice.
If you do roll your own, the published SDK packages
([@settlegrid/mcp](https://github.com/lexwhiting/settlegrid/tree/main/packages/mcp),
[@settlegrid/cli](https://github.com/lexwhiting/settlegrid/tree/main/packages/settlegrid-cli),
and the Python adapters) are MIT-licensed; borrow whatever's
useful.

### 7. "Pricing seems high/low"

Free tier is 50,000 ops/month with 0% take rate on your
first $1,000 of monthly revenue, climbing to 2% to $10K,
2.5% to $50K, and 5% above ([pricing](https://settlegrid.ai/pricing)).
The 0% floor is meant to remove friction for hobbyists and
side projects. Open to a specific objection: what tier feels
wrong, against what comparison? Prices were calibrated
against the comparison post above, but I haven't pressure-
tested them in production yet, so I'd rather hear the
objection than ignore it.

### 8. "The landing page is ugly"

You're right, I'm a solo founder. PRs to
[apps/web/src/app](https://github.com/lexwhiting/settlegrid/tree/main/apps/web/src/app)
welcome. What specifically would you change first? I'll
take the most upvoted suggestion in the thread that I can
ship in a week, and ship it.

### 9. "How is this different from [competitor X]?"

The closest direct competitor is
[Nevermined](https://nevermined.io); the side-by-side
breakdown is at
[settlegrid.ai/compare/nevermined](https://settlegrid.ai/compare/nevermined),
including the pieces where Nevermined is genuinely stronger
(Python SDK on PyPI today, named reference customer in Valory,
public x402 facilitator). The short version: Nevermined runs
crypto-first (USDC on Base by default) with Stripe Connect as
an alternative; SettleGrid runs Stripe-first with nine
protocol adapters layered in front, and prices 0% under
$1,000/month vs Nevermined's flat 2%.
[MCPize](https://www.mcpize.com) is a lightweight per-call
wrapper without discovery, dashboards, fraud detection, or
multi-protocol support. Broader feature comparison across
every billing approach I'm aware of is at
[settlegrid.ai/learn/blog/mcp-billing-comparison-2026](https://settlegrid.ai/learn/blog/mcp-billing-comparison-2026).

### 10. "Can I self-host?"

Not today. The metering layer is hosted on settlegrid.ai
because the multi-tenant Redis, Stripe Connect onboarding,
and protocol-facilitator routing benefit from being
centralized. Self-host is on the roadmap behind multi-tenant
payouts. Earliest realistic ship is later this year, probably
as a Docker Compose for the metering API + dashboard, with
you bringing your own Stripe account.

## Operational notes

- **Have this file open in a side panel during the launch.**
  Copy-paste responses with founder voice tweaks at the seams.
- **Track which archetype you saw.** If a comment fits two
  archetypes, pick the one with the more specific answer.
  If a comment fits zero, write the response from scratch
  rather than forcing a near-fit.
- **Update the kit live.** New archetypes that surface in
  the first 2 hours are highly likely to surface again. Add
  an 11th, 12th, etc. as they appear.
- **The first 90 minutes set the trajectory.** After the
  first 50 comments, response cadence can drop to 1 hour.
  After the first 200, you can sleep.
