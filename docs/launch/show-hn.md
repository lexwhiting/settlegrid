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

I built SettleGrid because adding per-call billing to an MCP
server takes a week of Stripe Connect glue, and I didn't want
to spend that week again on every tool I shipped. Right now
there are 12,770+ MCP servers on PulseMCP and fewer than 5%
generate any revenue
([source](https://settlegrid.ai/learn/blog/mcp-billing-comparison-2026)).
SettleGrid wraps any MCP handler with `sg.wrap()`, meters
each call in Redis, settles via Stripe Connect Express, and
ships a gallery of pre-wired templates plus a shadow directory
of public MCP repos with the codemod pre-filled at
`/mcp/owner/repo`. Revenue-split across composed tool calls
isn't built yet, the consumer-facing budget alert UI is
sketched, not built, and the Cursor extension is a question
mark while I lean on the Anthropic Skill instead. Free tier
is 50,000 ops/month with a 0% take rate on your first $1,000
of revenue; try `npx settlegrid add github:owner/repo
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

**Why Stripe Connect Express, not Standard or Custom.** The
publisher signup flow has to be 5 minutes for the funnel to
work, which rules out Standard (the publisher manages their
own Stripe account, which is a 30-minute setup). Custom would
let me brand the onboarding entirely, but it puts KYC,
disputes, and tax-form responsibility directly on me, which
is not where I want a solo founder to be. Express splits the
difference: Stripe owns KYC + 1099-K + dispute UX, I own the
publisher dashboard, and the publisher signs up with their
existing Stripe account or creates one in the Express flow.
Country coverage is the gap. Express supports a smaller
country set than Standard, and there's a waitlist for the
unsupported ones.

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
