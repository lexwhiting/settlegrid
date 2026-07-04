<!--
  ============================================================
  FOUNDER REWRITE REQUIRED — DO NOT PUBLISH AS-IS
  ============================================================

  This is a structural draft. Five things only you (the founder)
  can supply. Until each is filled in by you, this post stays at
  `published: false` in apps/web/src/lib/blog-posts.ts.

  1. ORIGIN STORY (search "{{ORIGIN}}" below)
     Replace with the specific moment you realized MCP
     monetization was broken. Which tool? Which call? Which
     error message? A real story has a date, a Slack thread, a
     dollar figure, or a screenshot. Not "I noticed developers
     struggle." A specific Tuesday.

  2. AWKWARD CONFESSION (search "{{CONFESSION}}" below)
     Something you got wrong early. A pricing model you tried
     and abandoned. A demo that broke on stage. The wrong
     assumption you held for three months. The post won't read
     as honest without one.

  3. COMPETITOR COMPARISON (search "{{COMPETITOR}}" below)
     The draft says SettleGrid Templates is the first place
     these four pieces ship together. That claim is removable.
     Either point to the specific competitor that has 1-2 of
     them (with a link), explain why theirs doesn't fit, or
     delete the sentence entirely if you can't back it.

  4. CURRENT METRICS (search "{{METRICS}}" below)
     Pull on the morning of publish:
       - apps/web/public/registry.json -> totalTemplates
       - npm download count for `settlegrid` (npm-stat or npmjs.com)
       - PostHog: gallery_viewed last 7 days
       - PostHog: scaffold_success last 7 days
       - GitHub stars on the monorepo
     Replace placeholder numbers; don't ship round figures
     without a source.

  5. PERSONAL STAKE (search "{{STAKE}}" below)
     Why you. Why now. The closing paragraph is a direct ask;
     it lands harder if there's a sentence about what failure
     would mean. Bootstrapper context, the runway you're on,
     the day-job you'd go back to. One line, not a page.

  Voice: first-person singular. No "platform," "ecosystem,"
  "scale," "unlock," "leverage." No em-dash-heavy LLM cadence.
  Read the draft out loud once before you publish — the
  lines you trip on are the ones to rewrite.
-->

The first time I tried to charge for an MCP server, it took me
a week. Not the billing logic. That part took an afternoon. The
week was Stripe Connect onboarding flows, webhook signature
verification, idempotency keys for retries, a database schema
for usage events, the cron job that reconciles last week's
numbers, refund handling for charges that fired before the
handler errored, dispute notification webhooks, and the email
template for the "your card expired, your tool just broke for
fifteen consumers" message. {{ORIGIN: replace with the actual
moment — what tool you were charging for, which call broke,
the specific error or invoice that pushed you over.}} I shipped
it eventually. Then I looked at the next MCP server I wanted to
charge for and realized I'd have to do the same week again, and
I'd have to do it the week after that, and every week after
until something existed that I could just call. {{CONFESSION:
one or two sentences on what you got wrong about this in the
first version. A pricing model you tried, an architectural
choice that didn't survive contact with real users, an
assumption you held for too long. Something a stranger reading
the post would respect you more for admitting.}} That's when I
started writing the thing that became SettleGrid.

## What SettleGrid actually is

SettleGrid is the rail-neutral, protocol-neutral settlement
layer for the long tail of AI tools. Nine protocol adapters
ship today, each running its own detection on the incoming
request:
[MCP](https://github.com/lexwhiting/settlegrid/blob/main/apps/web/src/lib/settlement/adapters/mcp.ts),
[x402](https://github.com/lexwhiting/settlegrid/blob/main/apps/web/src/lib/settlement/adapters/x402.ts),
[AP2](https://github.com/lexwhiting/settlegrid/blob/main/apps/web/src/lib/settlement/adapters/ap2.ts),
[MPP](https://github.com/lexwhiting/settlegrid/blob/main/apps/web/src/lib/settlement/adapters/mpp.ts),
[ACP](https://github.com/lexwhiting/settlegrid/blob/main/apps/web/src/lib/settlement/adapters/acp.ts),
[UCP](https://github.com/lexwhiting/settlegrid/blob/main/apps/web/src/lib/settlement/adapters/ucp.ts),
[Visa TAP](https://github.com/lexwhiting/settlegrid/blob/main/apps/web/src/lib/settlement/adapters/tap.ts),
[Mastercard VI](https://github.com/lexwhiting/settlegrid/blob/main/apps/web/src/lib/settlement/adapters/mastercard-vi.ts),
and [Circle Nano](https://github.com/lexwhiting/settlegrid/blob/main/apps/web/src/lib/settlement/adapters/circle-nano.ts).
Whatever protocol an incoming agent request arrives with, the
runtime routes it. Stripe Connect powers the underlying fiat
settlement; SettleGrid is built on top of it, not against it,
and adds the per-call metering, the multi-protocol detection
chain, and what I'm calling settlement sessions: in an Agent A
paying Agent B paying Agent C call chain, each hop is metered
and settled as it completes, so a publisher gets paid when its
own hop succeeds
([sessions.ts](https://github.com/lexwhiting/settlegrid/blob/main/apps/web/src/lib/settlement/sessions.ts)).
Pricing is 0% under $1,000/month of revenue and capped at 5%
at scale, which makes the long-tail (the 12,770+ unmonetized
MCP servers I'll get to next) the part of the market this is
built for.

## What's broken about MCP monetization right now

MCP is enormous and almost entirely free. The
[2026 MCP billing comparison](https://settlegrid.ai/learn/blog/mcp-billing-comparison-2026)
counts 12,770 servers on PulseMCP, 17,194 on mcp.so, 6,000+
on Smithery. The MCP TypeScript SDK has been downloaded over
97 million times. Less than five percent of those servers
generate any revenue. The ones that do mostly got there by
hand-rolling Stripe Connect against a homemade metering
schema, which is a week of work I'd rather not repeat. There
are four specific holes I keep hitting.

- **Pricing friction.** Every billing system I looked at made
  me commit to a schema before I'd measured a single real
  consumer call. A search tool wants per-call. A research tool
  that thinks for thirty seconds wants per-second. A bulk-data
  tool returning ten megabytes wants per-byte. A code-review
  tool that's wrong half the time wants outcome-based, where
  the consumer only pays when the patch lands. Switching
  schemas later means a migration. I wanted to flip pricing
  models in one line.
- **No shared templates.** Every MCP author starts from a
  blank file. The codemod, the pricing config, the test
  harness, the deploy YAML — written from scratch every time.
  There are 6,000+ servers on Smithery and no canonical "fork
  this and charge five cents per call" starting point.
- **No way for agents to discover paid MCPs.** A coding agent
  running in Claude Code or Cursor or Windsurf can install an
  MCP server, but it has no idea which ones charge, what they
  charge, or whether the consumer wallet has the credit. The
  actual experience: an agent calls `foo-tool`, the handler
  returns a 402 with a payment URL, the agent pastes the URL
  into the chat, and the human types in a card. Every step
  past "agent calls tool" is friction the agent can't resolve
  on its own. {{COMPETITOR: this bullet asserts the discovery
  gap. If a competitor solves it, name them and explain why
  theirs doesn't fit your case. Otherwise the bullet stands.}}
- **Composed-call billing was half-built.** When a research
  agent calls a search tool that calls a translation tool
  that calls an embeddings tool, the outer tool used to either
  eat the inner cost (loss leader) or hide the inner call
  from the invoice (consumer can't audit, inner author never
  gets credited). The per-hop settlement-session half of this
  is shipped in SettleGrid — every hop is metered and settled
  as a session hop as it completes, so a publisher gets paid
  when its own hop succeeds. The revenue-*apportionment* half (who
  gets what cut of the outer fee) is the next piece I'm
  working on.

## What SettleGrid Templates is

SettleGrid Templates is four things that ship together. The
gallery at [settlegrid.ai/templates](https://settlegrid.ai/templates)
is a list of {{METRICS: 97 templates as of today — replace
with the live `totalTemplates` count from registry.json on
publish day}} pre-wired MCP servers, each with billing already
hooked up. Fork one, deploy it to Vercel, point a card at
Stripe Connect, and the first call charges. The CLI is `npx settlegrid add github:owner/repo` for repos you already have
and `npx create-settlegrid-tool` for new projects; the codemod
wraps every tool handler with `sg.wrap()`, adds the SDK to
`package.json`, and either applies the change locally or opens
a pull request. The Anthropic Skill at `@settlegrid/skill`
does the same thing from inside Claude Code or any agent that
loads skills — you ask it to monetize the file you're looking
at and it walks the codemod.

The shadow directory is the honest part. There are thousands
of MCP servers in the wild that aren't on SettleGrid yet, and
pretending I had full coverage would be a lie I'd get caught
on within a day. So I crawled the popular ones — capped at a
few thousand because the long tail wasn't worth the build
time — and indexed them at
[settlegrid.ai/mcp](https://settlegrid.ai/mcp), with a
per-repo page at `/mcp/owner/repo` preloaded with the exact
codemod command. None of this asks you to host on a runtime
I control, fit your code into an abstraction I designed, or
accept lock-in beyond two lines of TypeScript you can delete
in five seconds. It's a settlement layer plus a way to find
each other.

## Try it in 60 seconds

```bash
npx settlegrid add github:owner/repo --dry-run
```

If the codemod can identify the entry file, you'll see
something like:

```text
detection + parsed options
  source:       github:owner/repo
  resolved dir: /tmp/sg-XXXXXX/repo
  type:         mcp-server
  confidence:   0.95
  language:     typescript
  entry points: src/server.ts

transform summary
  mode:          dry-run (no files written)
  changed files:
                 - src/server.ts
                 - package.json
  deps to add:   @settlegrid/mcp@latest
  env required:  SETTLEGRID_TOOL_SLUG
```

Drop `--dry-run`, point a Stripe account at the dashboard,
and the next call from a Claude or Cursor agent meters and
settles in a few hundred milliseconds. Free tier is 50,000
operations a month with a 0% take rate on your first $1,000
of revenue, climbing to 5% above $50,000/mo
([pricing](https://settlegrid.ai/pricing)).

## What's still missing

A few things I won't pretend are solved. The revenue-*split*
primitive (who gets what cut of an outer fee when a tool calls
another tool) isn't built; today the outer tool eats the
inner cost, and the workaround is to bake the inner price into
your outer price and hope nobody runs the math. The agent-side
spend cap (`settlegrid-max-cost-cents`) is wired through the
SDK but the consumer-facing UI for budget alerts is still on a
Figma canvas, not in production. The shadow directory has
indexed coverage but not every tool is claim-able yet — the
claim flow needs an email match against the GitHub commit
history and I haven't built the dispute path for false claims.
The Cursor extension exists as a question mark on a roadmap; I
might ship it, I might decide the Anthropic Skill covers
Cursor well enough through MCP and spend the time on something
else. The decision is gated on Phase 5 telemetry, not on a
hunch.
{{METRICS: if you have hard PostHog numbers for Skill
invocations in Cursor, cite them here; otherwise leave the
sentence as-is so the roadmap honesty stands.}}

What's coming next, in order: a Python SDK on PyPI, a public
x402 facilitator under a settlegrid.ai subdomain, and country
coverage expansion via a second MoR rail (Paddle or Lemon
Squeezy) — the second-rail integration is demand-gated, not
date-gated. It ships when waitlist volume in a specific
corridor (LATAM, India, Southeast Asia) justifies the
integration cost, not before. There was an earlier plan to use
Polar as that second rail; Polar declined SettleGrid's
merchant application as a marketplace use case in April, so
the architecture is now a single Stripe Connect rail with an
extensible adapter for the second one when it comes. If you've
got a corridor blocker that should jump the queue, tell me.


## Try it. Break it. Tell me what sucks.

The launch is a list of things to test, not a list of features.
If you ship MCP servers, fork a template and tell me which
parts of the codemod failed. If you run an AI agent, point it
at a paid tool and tell me which protocol detection misfired.
If you've shipped your own monetization for an MCP server and
SettleGrid wouldn't have helped, I want to hear that more than
anything else. {{STAKE: one line on why this matters to you
specifically — bootstrapper status, the runway, the next thing
you'd build if this didn't work.}} Email me at
[founder@settlegrid.ai](mailto:founder@settlegrid.ai), DM me
on X at [@lexwhiting](https://x.com/lexwhiting), or open an
issue on [github.com/lexwhiting/settlegrid](https://github.com/lexwhiting/settlegrid).
The fastest way to make this thing better is to tell me where
it broke for you.

---

If you're evaluating SettleGrid against
[Nevermined](https://nevermined.io) — the closest direct
competitor on the agent-payments side — there's a side-by-side
honest comparison at
[settlegrid.ai/compare/nevermined](https://settlegrid.ai/compare/nevermined),
including the pieces where Nevermined is genuinely stronger
(named reference customer, Python SDK on PyPI today, public
x402 facilitator).
