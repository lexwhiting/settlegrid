<!--
  ============================================================
  FOUNDER REWRITE REQUIRED — DO NOT POST AS-IS
  ============================================================

  Show HN posts succeed or fail in the first 90 minutes. The
  founder's voice in the body and the technical depth of the
  first comment matter more than the structural draft below.

  Required pre-post tasks (≤30 min):

  1. PICK A TITLE
     Three alternatives below. All literal, all under 80
     chars, all starting with "Show HN:". Pick one. If none
     fit, write your own — keep it literal.

  2. REWRITE THE BODY IN YOUR VOICE
     Read the body draft aloud. If it sounds like marketing,
     cut it. The body must answer four things in 3-5
     sentences: what it is, what problem, what's unique,
     what's NOT yet working. The "what's NOT yet working"
     line is non-negotiable — HN downranks hype, weakness
     acknowledgment is HN-native.

  3. WRITE THE "WHAT FAILED" BEAT IN THE FIRST COMMENT
     Search "{{FAILURE_STORY}}" in the first comment and
     replace with a real story. A pricing model you tried
     and abandoned. A demo that broke. A wrong assumption
     that cost a month. Without this beat, the first comment
     reads as a marketing follow-up, not a founder memo.

  4. VERIFY EVERY URL RESOLVES
     - https://settlegrid.ai/learn/blog/settlegrid-templates-launch
       (the blog post — flip its `published: false → true`
       BEFORE posting to HN)
     - https://settlegrid.ai/templates
     - https://settlegrid.ai/pricing
     - https://x.com/lexwhiting (or your X handle)
     - https://github.com/lexwhiting/settlegrid
     - All 9 adapter URLs in the body (one per protocol —
       MCP/x402/AP2/MPP/ACP/UCP/Visa TAP/Mastercard VI/Circle Nano)
     - https://settlegrid.ai/compare/nevermined

  4a. FLATTEN MARKDOWN LINKS BEFORE PASTING INTO HN
     HN's submission form does NOT render markdown link syntax —
     `[MCP](https://...)` displays literally to readers. Only bare
     URLs auto-link. Two options before you submit:
       (a) Recommended: rewrite the body so the 9 protocols are
           bare names ("MCP, x402, AP2, MPP, ACP, UCP, Visa TAP,
           Mastercard VI, Circle Nano") and add ONE bare URL on
           a separate line pointing at the adapters directory:
           https://github.com/lexwhiting/settlegrid/tree/main/apps/web/src/lib/settlement/adapters
       (b) Keep this draft's per-protocol links and accept that
           readers see `[MCP](https://...)` text. Worse UX.
     Same rule applies to the FIRST COMMENT and to live replies
     in the response kit — bare URLs only.

  5. VERIFY EVERY NUMERIC CLAIM ON LAUNCH DAY
     The body cites "12,770+ MCP servers on PulseMCP" and
     "fewer than 5% generate any revenue." Both come from
     the comparison post (mcp-billing-comparison-2026.md).
     PulseMCP grows; verify the count before posting. The
     5% revenue claim is a reasoned estimate, not a survey
     — be ready to defend it if a commenter pushes.

  6. POST AT THE RIGHT TIME
     HN traffic peaks Tue-Thu, 09:00-11:00 PT. Do NOT post
     Friday afternoon or Sunday evening. Have the response
     kit (docs/launch/show-hn-response-kit.md) open before
     you submit.

  7. POST THE FIRST COMMENT WITHIN 60 SECONDS
     The HN ranking algorithm rewards the founder's first
     comment if it lands before any other comment. Have it
     copy-paste-ready.

  Voice: first-person singular. No "platform," "ecosystem,"
  "scale," "unlock," "leverage," "revolutionary," or
  "game-changing." No bullet lists in the BODY (the first
  comment can have them sparingly).
-->

# Show HN: SettleGrid

## Title (pick one — all literal, all under 80 chars)

1. **Show HN: SettleGrid – Monetize MCP servers with per-call billing**
   *(67 chars — closest to the spec template, broadest pitch)*
2. **Show HN: SettleGrid – Add billing to any MCP server in 5 minutes**
   *(67 chars — leads with the "5 minutes" specificity that HN respects)*
3. **Show HN: SettleGrid – Stripe Connect plus a settlement layer for MCP tools**
   *(75 chars — leads with the technical comparison; the "Stripe
   Connect plus" framing inoculates against the "this is just
   Stripe with extra steps" comment)*

## URL

`https://settlegrid.ai/learn/blog/settlegrid-templates-launch`

(The launch blog post written under P4.2. Flip `published:
false → true` in `apps/web/src/lib/blog-posts.ts` before
submitting the Show HN, otherwise the URL 404s and the post
gets flagged.)

## Body (3-5 sentences)

SettleGrid is the rail-neutral, protocol-neutral settlement
layer for the long tail of AI tools. Nine protocol adapters
ship today ([MCP](https://github.com/lexwhiting/settlegrid/blob/main/apps/web/src/lib/settlement/adapters/mcp.ts),
[x402](https://github.com/lexwhiting/settlegrid/blob/main/apps/web/src/lib/settlement/adapters/x402.ts),
[AP2](https://github.com/lexwhiting/settlegrid/blob/main/apps/web/src/lib/settlement/adapters/ap2.ts),
[MPP](https://github.com/lexwhiting/settlegrid/blob/main/apps/web/src/lib/settlement/adapters/mpp.ts),
[ACP](https://github.com/lexwhiting/settlegrid/blob/main/apps/web/src/lib/settlement/adapters/acp.ts),
[UCP](https://github.com/lexwhiting/settlegrid/blob/main/apps/web/src/lib/settlement/adapters/ucp.ts),
[Visa TAP](https://github.com/lexwhiting/settlegrid/blob/main/apps/web/src/lib/settlement/adapters/tap.ts),
[Mastercard VI](https://github.com/lexwhiting/settlegrid/blob/main/apps/web/src/lib/settlement/adapters/mastercard-vi.ts),
[Circle Nano](https://github.com/lexwhiting/settlegrid/blob/main/apps/web/src/lib/settlement/adapters/circle-nano.ts)) —
built on Stripe Connect Express, extended with per-call
metering in Redis and a protocol detection chain that routes
each incoming agent request to the right adapter. The unique
primitive is settlement sessions: Agent A paying Agent B
paying Agent C commits or rolls back as one atomic unit
([sessions.ts](https://github.com/lexwhiting/settlegrid/blob/main/apps/web/src/lib/settlement/sessions.ts)).
Pricing is 0% under $1,000/month and capped at 5% at scale —
designed for the long-tail wedge, not flat-rate
([Nevermined comparison](https://settlegrid.ai/compare/nevermined)).
Not yet shipped: revenue-split across composed calls, the
consumer-facing budget UI, the Cursor extension; coming next
is a Python SDK, a public x402 facilitator, and country
coverage expanding via a second rail once waitlist volume
justifies it. Try `npx settlegrid add github:owner/repo
--dry-run` and tell me which part of the codemod broke.

## First comment (post within 60 seconds of submission)

A few technical notes that didn't fit in the body, in case
they help anyone evaluating this for a serious build.

**Why Redis for metering, not Postgres.** The hot path is
validate-key + decrement-balance + record-event, called once
per tool invocation. Postgres can do the decrement atomically
(`UPDATE … SET balance = balance - 1 WHERE id = ?`), but the
connection-pool round-trip plus the WAL write pushes p50
closer to 10ms; Redis `DECRBY` lands at ~1ms p50 intra-region
with no pool contention, which is the latency envelope the
agent's request budget actually has. The validation cache is
an LRU with 5-minute TTL so the per-process key check is
in-memory after warm-up. Postgres holds the durable ledger
(invocation events, settlement records) and the consumer
balance reconciles to it on a 60-second cron. Eventual
consistency is fine because Redis is the source of truth for
the live balance and Postgres is the audit log.

**Stripe Connect is the partner, not the competitor.** SettleGrid
is built on Stripe Connect Express and extends it. Stripe owns
KYC, 1099-K, and the dispute UX; I own the per-call metering,
the protocol detection chain, the publisher dashboard, and the
multi-hop settlement sessions. The publisher signs up with their
existing Stripe account or creates one in the Express flow —
five minutes, not thirty. Express vs Standard vs Custom: I picked
Express because Standard puts the 30-minute publisher-managed
setup in the funnel, and Custom would put KYC + tax-form
responsibility directly on me, which is not where I want a solo
founder to be. Country coverage is the gap — Express supports a
smaller country set than Standard, and there's a waitlist for the
unsupported corridors. The plan is to add a second rail (Paddle
or Lemon Squeezy as MoR) once waitlist volume in a specific
corridor justifies the integration cost; that's demand-gated, not
on a date.

**How multi-hop atomic settlement works.** A research agent calls
a search tool that calls a translation tool that calls an
embeddings tool. Each is a paid MCP. SettleGrid records each hop
([`recordHop`](https://github.com/lexwhiting/settlegrid/blob/main/apps/web/src/lib/settlement/sessions.ts))
inside one session, then on finalize creates a single settlement
batch
([`finalizeSession`](https://github.com/lexwhiting/settlegrid/blob/main/apps/web/src/lib/settlement/sessions.ts)).
That batch processes atomically: it either credits every developer
in the chain
([`processSettlementBatch`](https://github.com/lexwhiting/settlegrid/blob/main/apps/web/src/lib/settlement/sessions.ts))
or, if anything goes wrong at settlement time, the whole batch
rolls back as one unit
([`rollbackSettlementBatch`](https://github.com/lexwhiting/settlegrid/blob/main/apps/web/src/lib/settlement/sessions.ts))
and no charges fire. Per-hop error handling above the settlement
layer is the caller's contract; the atomicity guarantee is at the
batch boundary. Revenue *apportionment* across the chain is the
part not yet built — today the outer tool eats the inner cost,
and I'm working on the split primitive next.

**Why a shadow directory.** Discovery is the load-bearing
problem for paid MCPs. An agent calls a tool that returns 402
and the agent has no way to find a wallet, a similar tool, or
the human who can pay. The shadow directory at `/mcp/owner/repo`
indexes the public MCP servers I could crawl (capped at a
few thousand because the long tail wasn't worth the build
time) and pre-fills the codemod command on each page. If you
maintain one of those servers and want billing, the page for
your repo already exists. If you don't, the page is still
useful to anyone who'd fork your repo to monetize it. Yes,
this raises a "you're listing repos without permission"
question, which I take seriously. There's a no-index header
for opted-out repos and a faster claim flow on the way.

**What failed.** {{FAILURE_STORY: replace with a real story
— the architectural choice that didn't survive contact with
real users, the pricing model you tried and abandoned, the
demo that broke, the wrong assumption you held for three
months. Two or three sentences. Without this beat, the comment
reads as a marketing follow-up. With it, you're a person.}}

**What I'm asking for.** Try `npx settlegrid add
github:your-mcp-server --dry-run` and tell me which part of
the codemod broke. If you've shipped your own monetization
for an MCP server and SettleGrid wouldn't have helped, I want
to hear that more than anything else. I'm at
founder@settlegrid.ai or on X at @lexwhiting (replace handle
in your final pass), and the GitHub is
`github.com/lexwhiting/settlegrid` for issues.
