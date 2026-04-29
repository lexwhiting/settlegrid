<!--
  ============================================================
  FOUNDER REWRITE REQUIRED — DO NOT POST AS-IS
  ============================================================

  An 8-tweet launch thread that runs parallel to the Show HN
  post (docs/launch/show-hn.md). The thread drives independent
  X traffic and feeds the same blog post URL.

  Pre-post tasks (≤30 min):

  1. REWRITE EACH TWEET IN YOUR VOICE
     The structure is locked (8 tweets, the per-tweet job is
     fixed). The cadence isn't yours yet. Read each one aloud;
     if it sounds like marketing or a generic "10 things I
     learned" thread, cut it.

  2. VERIFY THE METRIC IN TWEET 5
     The draft cites "97 templates in the gallery." Pull the
     live `totalTemplates` count from
     apps/web/public/registry.json on the morning of the
     launch. If you've added templates between drafting and
     posting, the number changes.

  3. VERIFY YOUR X HANDLE + URLS
     The CTA tweet (#8) links to the launch blog post and
     /templates. Both URLs assume the blog post has
     `published: false → true` flipped before posting. Verify
     in Vercel.

  4. ATTACH THE 60-SECOND VIDEO TO TWEET 1
     The hero video from docs/launch/demo-video-script.md is
     the asset on tweet 1. Render and upload BEFORE drafting
     the tweet text; X strips paths, so paste the text only
     after the upload completes.

  5. DECIDE THE POST TIME
     Same window as the Show HN: Tue-Thu 09:00-11:00 PT. The
     X thread should go up 5-10 minutes AFTER the Show HN, so
     early HN traffic seeds the X engagement (engagement
     velocity is the X algorithm's first-pass signal).

  Voice rules: first-person singular. No emoji. No hashtags.
  No "platform," "ecosystem," "scale," "unlock," "leverage,"
  "revolutionary," "game-changing." No "Here's what I learned"
  / "🧵" / "Bookmark this" tropes. URLs auto-shorten to t.co
  (23 chars) — the per-tweet character counts below assume
  raw-text length, not t.co-adjusted; X's compose box will
  show the real count when you paste.
-->

# X / Twitter Launch Thread

8 tweets, posted within 2 minutes of each other. Tweet 1 has
the 60-second hero video attached. Tweet 8 closes with the
links.

Per-tweet character counts shown inline. X counts URLs as 23
chars regardless of actual length, so the tweets that include
URLs (1 the video doesn't count, 8 has two URLs) will show a
slightly lower count in the compose box than the raw text
length.

---

## Tweet 1 — Hook + video (target: <140 chars, video attached)

> I built SettleGrid because adding billing to an MCP
> server takes a week of Stripe Connect glue. Here's why.

**Char count:** 107 (under 280, leaves room for an inline
short URL if you want one).

**Asset:** the 60-second hero video from
`docs/launch/demo-video-script.md`. Upload before drafting
the tweet text — X strips drafts when you click "Add media."

---

## Tweet 2 — Problem with real numbers

> There are over 12,000 public MCP servers. Fewer than 5%
> generate any revenue. The billing infrastructure to charge
> for a tool is a multi-day build per tool, every time, from
> scratch.

**Char count:** 182.

**Source for the numbers:** the launch blog post links the
mcp-billing-comparison-2026 source. Verify the 12,000+ count
on launch day — PulseMCP grows.

---

## Tweet 3 — What I built (gallery + CLI + shadow directory)

> SettleGrid Templates: a gallery of pre-wired MCP
> templates, a CLI codemod that adds billing to a
> recognized MCP-shaped GitHub repo in one command, and a
> shadow directory of public MCP servers with the codemod
> pre-filled per repo.

**Char count:** 229.

---

## Tweet 4 — How it works (the wrap line)

> Wrap any handler in one line:
>
> const billed = sg.wrap(handler, { costCents: 5 })
>
> The SDK validates the API key, checks balance, runs the
> handler, meters the call. Stripe Connect handles payouts.

**Char count:** 195.

---

## Tweet 5 — Proof (real metric)

> 97 templates in the gallery today, each pre-wired with
> billing. Fork, deploy, connect Stripe in the dashboard,
> and the next call charges. New templates ship weekly.

**Char count:** 164.

**Note:** "97" is the live `totalTemplates` from
`apps/web/public/registry.json` as of drafting. **Update on
launch day.** If you've added templates between draft and
post, the number changes.

---

## Tweet 6 — Honest admission

> What's still broken: revenue-split across composed tool
> calls isn't built. A research agent that calls a search
> tool that calls a translation tool eats the inner cost.
> That primitive is next on the roadmap.

**Char count:** 206.

---

## Tweet 7 — Specific ask

> What I need: try `npx settlegrid add github:your-mcp-server
> --dry-run` and tell me which part of the codemod broke.
> If you've shipped your own monetization for an MCP server
> and SettleGrid wouldn't have helped, I want to hear that
> most.

**Char count:** 236.

---

## Tweet 8 — CTA (links)

> Full story:
> settlegrid.ai/learn/blog/settlegrid-templates-launch
>
> Templates:
> settlegrid.ai/templates
>
> Reply with your repo. First-day replies get the codemod
> output back from me directly.

**Char count:** 187 raw / 158 X-counted (URLs t.co'd to 23
each). Comfortably under 280.

---

## Thread rules

These are non-negotiable for the launch day. The thread lives
or dies on the first 30 minutes of engagement.

- **Post all 8 tweets within 2 minutes.** X's algorithm
  treats fast threads as a single engagement unit. If you
  pause between tweets, each one gets ranked independently
  and tail-end tweets get buried.
- **Reply to every quote tweet in the first hour.** Quote
  tweets are X's highest-signal engagement event; a reply
  inside the first 60 minutes can extend the thread's reach
  by an order of magnitude.
- **Don't pin the thread until 24 hours of data confirms
  it's working.** Pinning a flop is a permanent monument to
  it. Wait for the morning-after impressions; if tweet 1
  cleared 5,000 impressions, pin it. If not, leave it
  unpinned and try a different hook for the next launch.
- **If tweet 1 gets under 50 impressions in 30 minutes,
  DM it to 10 friends to seed.** Cold thread + zero seed =
  zero traction. Pre-line up 10 people who'll boost in the
  first 30 minutes if needed; let them know in advance
  ("launching Tuesday morning, would appreciate a quick
  retweet if you see it").

## What NOT to do

These are the patterns that make a launch thread read as
marketing-school instead of founder-voice. Skip all of them:

- No emoji.
- No hashtags.
- No "thread" emoji or "thread" word markers in any tweet
  body. The reply chain is the marker.
- No "1/8", "2/8" tweet numbering — X numbers them
  automatically in the compose flow.
- No "Bookmark this thread" / "Retweet if you found this
  useful" / "Like and subscribe."
- No "Here's what I learned building [X]" framing.
- No "DM for the deck" — there's no deck.
