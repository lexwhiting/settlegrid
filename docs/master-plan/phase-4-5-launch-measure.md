# Phase 4 + 5 — Launch & Measure (Weeks 7-12)

*Generated as part of SettleGrid Quantum Leap Master Plan (MP-QL-001)*

---

# SettleGrid Phase 4 + Phase 5 Execution Prompts

## Phase 4 + 5 Summary

**Phase 4 goal (Weeks 7-8):** Execute a coordinated Show HN launch that surfaces the CLI, Skill, gallery, shadow directory, and founder narrative simultaneously, backed by full funnel instrumentation and a launch-day war room. Convert launch attention into booked customer interviews and a measurable pipeline.

**Phase 5 goal (Weeks 9-12):** Measure the funnel against hard kill criteria, synthesize customer interview insights, make a binary double-down-or-pivot decision, and draft the next 90-day master plan grounded in Phase 4 data rather than founder intuition.

### Prompt sequence overview

**Phase 4 (Weeks 7-8 — Launch)**
- **P4.1** — PostHog funnel instrumentation across gallery, CLI, SDK, shadow directory
- **P4.2** — Launch blog post draft (CONTENT — founder rewrite required)
- **P4.3** — Show HN post + comments response kit (CONTENT)
- **P4.4** — 60-second demo video script + Loom storyboard (CONTENT)
- **P4.5** — X/Twitter launch thread draft (CONTENT)
- **P4.6** — Second batch cold outreach generator (100 personalized emails)
- **P4.7** — Launch-day war room prep + rapid-response kit
- **P4.8** — Customer interview template + scheduling pipeline
- **P4.9** — Cursor extension polish vs. deprioritize decision (ADR)
- **P4.10** — Phase 4 audit gate (exit criteria verification)

**Phase 5 (Weeks 9-12 — Measure + Iterate)**
- **P5.1** — Funnel analysis script + internal dashboard
- **P5.2** — Kill criteria evaluation memo (CONTENT — go/no-go decision)
- **P5.3** — Customer interview synthesis report (CONTENT)
- **P5.4** — "Template of the Week" content cadence automation
- **P5.5** — Next 90-day master plan draft
- **P5.6** — Phase 5 + full 90-day retrospective

### Expected artifacts

**End of Phase 4:**
- PostHog funnel wired end-to-end with ≥48h of clean data
- 5 launch surfaces live: Show HN post, blog post, demo video, X thread, Product Hunt page
- 100 outreach emails sent; customer interview pipeline active
- War room runbook executed; launch-day incidents logged
- 10 customer interview slots booked (target)

**End of Phase 5:**
- `docs/memos/funnel-analysis-day60.md`
- `docs/memos/kill-criteria-evaluation.md`
- `docs/memos/customer-insights-v1.md`
- `docs/plans/next-90-day-plan.md`
- `docs/retrospectives/90-day-retrospective.md`
- Automated weekly Template of the Week cron job

### Estimated total effort

- **Phase 4:** ~68-82 hours, ~$180-240 (Anthropic API + PostHog seat + email sends + video hosting)
- **Phase 5:** ~42-54 hours, ~$60-90 (mostly analysis + writing, minimal infra)
- **Combined:** ~110-136 hours, ~$240-330

### Critical notes on content prompts

**Content prompts (P4.2, P4.3, P4.4, P4.5, P5.2, P5.3, P5.5, P5.6) produce DRAFTS ONLY.** The founder MUST rewrite in their own voice before publishing anything externally. AI-written launch copy is the fastest way to torpedo a Show HN launch — HN commenters detect marketing-speak in the first sentence. The drafts exist to give the founder a structural starting point (headline, arc, bullet structure, response tree) so they spend their rewrite time on voice and specificity, not blank-page paralysis.

**Voice bar for all external content:** first-person singular, concrete numbers only (no "scale your MCP revenue"), no adjectives that can't be backed by a link, no em-dash-heavy cadence that screams LLM, no bullet lists in Show HN body copy.

---

## P4.1 — PostHog funnel instrumentation

**Phase:** 4
**Depends on:** P3.10 (Phase 3 audit gate)
**Blocks:** P4.7, P4.10, P5.1
**Estimated effort:** 8 hours, ~$0 (PostHog free tier)
**Risk level:** Medium
**Rollback complexity:** Trivial

### Context
The entire Phase 5 decision rests on funnel data. If instrumentation is missing or noisy at launch, Phase 5 becomes guesswork. We need eight canonical events flowing from the gallery, shadow directory, CLI, and SDK, captured in a single PostHog project with a shared `distinct_id` resolution strategy. The CLI events must be captured server-side (the CLI is a Node process, not a browser) and POST to a PostHog capture endpoint we proxy through our own API to avoid leaking the PostHog key in published npm artifacts.

**Relevant file paths (absolute):**
- `/Users/lex/settlegrid/apps/web/src/lib/posthog.ts`
- `/Users/lex/settlegrid/apps/web/src/app/templates/page.tsx`
- `/Users/lex/settlegrid/apps/web/src/app/templates/[slug]/page.tsx`
- `/Users/lex/settlegrid/apps/web/src/app/mcp/[owner]/[repo]/page.tsx`
- `/Users/lex/settlegrid/apps/web/src/app/api/telemetry/capture/route.ts` (new)
- `/Users/lex/settlegrid/packages/settlegrid-cli/src/telemetry.ts` (new)
- `/Users/lex/settlegrid/packages/mcp/src/sdk.ts`

**Relevant existing code to read first:**
- `apps/web/src/lib/posthog.ts` — confirm client exists; if not, create it in step 1
- `packages/settlegrid-cli/src/commands/scaffold.ts` — inject telemetry at success point
- `packages/mcp/src/sdk.ts` — locate first-paid-call site to emit event

**Prerequisites to verify:**
- [ ] Phase 3 audit log confirms all P3 prompts PASS
- [ ] PostHog project exists, API key in `.env.local` as `POSTHOG_API_KEY`
- [ ] `NEXT_PUBLIC_POSTHOG_KEY` set for client-side capture
- [ ] `{{SHARED_CONTEXT}}` reviewed for event naming conventions

### Specification
Define eight canonical events and emit them from the correct surface:

1. `gallery_viewed` — client, on `/templates` mount
2. `template_detail_viewed` — client, on `/templates/[slug]` mount, props: `{ slug, category }`
3. `shadow_directory_viewed` — client, on `/mcp/[owner]/[repo]` mount, props: `{ owner, repo, has_claim }`
4. `cli_install_started` — server, POSTed from CLI `postinstall` hook, props: `{ cli_version, node_version, os }`
5. `scaffold_success` — server, POSTed from CLI after successful scaffold, props: `{ template_slug, duration_ms }`
6. `scaffold_failed` — server, POSTed from CLI on error, props: `{ template_slug, error_code }`
7. `sdk_first_init` — server, from SDK first `init()` per org, props: `{ sdk_version, org_id_hash }`
8. `first_billed_call` — server, from SDK first successful billed invocation, props: `{ method, amount_cents }`

Create `/api/telemetry/capture` as a thin proxy: accepts `{ event, properties, distinct_id }`, validates with Zod, adds server-side props (`ip_country`, `received_at`), forwards to PostHog. The CLI and SDK POST to this endpoint so the PostHog key never ships in published packages. Rate-limit the endpoint at 60 req/min per IP (reuse Upstash pattern from `apps/web/src/lib/rate-limit.ts`).

`distinct_id` resolution: browser uses PostHog's anonymous ID; CLI generates a stable UUID stored in `~/.settlegrid/telemetry-id`; SDK uses `org_id` hashed with SHA-256. Document this in a comment block at the top of `telemetry.ts`.

**Files you may touch:**
- `apps/web/src/lib/posthog.ts`
- `apps/web/src/app/templates/**`
- `apps/web/src/app/mcp/**`
- `apps/web/src/app/api/telemetry/capture/route.ts`
- `packages/settlegrid-cli/src/telemetry.ts`
- `packages/settlegrid-cli/src/commands/scaffold.ts`
- `packages/mcp/src/sdk.ts`
- `docs/telemetry/events.md` (new — canonical event registry)

**Files you MUST NOT touch:**
- `packages/mcp/src/cache.ts`
- Any `apps/web/src/app/learn/**` files (Phase 3 frozen)

**External services touched:**
- PostHog (capture API)
- Upstash Redis (rate limit)

### Implementation Steps
1. Audit `apps/web/src/lib/posthog.ts`. If missing, create client-side bootstrap with `NEXT_PUBLIC_POSTHOG_KEY` and `NEXT_PUBLIC_POSTHOG_HOST`.
2. Create `docs/telemetry/events.md` listing all 8 events, properties, emission sites. This is the single source of truth.
3. Build `/api/telemetry/capture` route with Zod validation, rate limiting, server-side enrichment, PostHog forward.
4. Wire client-side events (1, 2, 3) via `usePostHog()` hook in each page.
5. Build `packages/settlegrid-cli/src/telemetry.ts` with distinct_id persistence and opt-out via `SETTLEGRID_TELEMETRY=0`.
6. Emit events 4, 5, 6 from CLI at the exact call sites. Never block scaffold on telemetry failure — fire-and-forget with 2s timeout.
7. Emit events 7, 8 from SDK. Hash org_id before sending.
8. Write integration tests: mock PostHog, verify each event fires with correct shape.
9. Manual smoke test: run CLI scaffold locally, visit gallery, check PostHog Live Events view for all 8.
10. Run {{AUDIT_CHAIN_TEMPLATE}}.

### Definition of Done
- [ ] All 8 events fire and appear in PostHog Live Events view
- [ ] CLI telemetry respects `SETTLEGRID_TELEMETRY=0`
- [ ] PostHog key not present in published CLI/SDK tarballs (verify via `npm pack && tar -xf`)
- [ ] `pnpm -w typecheck` passes
- [ ] New tests in `apps/web/src/app/api/telemetry/capture/__tests__/` pass
- [ ] `docs/telemetry/events.md` committed
- [ ] Smoke test output matches spec
- [ ] {{AUDIT_CHAIN_TEMPLATE}} all three parts PASS
- [ ] Commit created

### Audit Chain
Execute {{AUDIT_CHAIN_TEMPLATE}}. Paste all three verdict blocks before committing.

### Rollback Instructions
`git revert` the commit. Telemetry is additive; removing it breaks no user-facing surface. If PostHog is spamming errors, flip `NEXT_PUBLIC_POSTHOG_KEY` to empty in Vercel env to silence capture without a code deploy.

### Commit Message Template
```
telemetry: wire 8-event funnel across gallery, CLI, SDK

Adds PostHog instrumentation with a proxied capture endpoint so
CLI/SDK never ship the PostHog key. Events documented in
docs/telemetry/events.md.

Refs: P4.1
Audits: spec-diff PASS, hostile PASS, tests PASS
```

---

## P4.2 — Launch blog post draft (CONTENT)

**Phase:** 4
**Depends on:** P4.1
**Blocks:** P4.3, P4.5, P4.10
**Estimated effort:** 4 hours, ~$5 (Anthropic API for draft)
**Risk level:** Low
**Rollback complexity:** Trivial

### Context
The Show HN post links to one canonical founder blog post that explains the "why" behind SettleGrid Templates. This post sets the narrative frame for every other launch surface. It must read like a founder wrote it at 11pm — specific numbers, one awkward confession, concrete MCP integration pain, no adjectives that can't be defended. This prompt produces a STRUCTURED DRAFT the founder will rewrite, not publish as-is.

**Relevant file paths (absolute):**
- `/Users/lex/settlegrid/apps/web/src/lib/blog-bodies/settlegrid-templates-launch.md` (new)
- `/Users/lex/settlegrid/apps/web/src/lib/blog-posts.ts`
- `/Users/lex/settlegrid/docs/launch/blog-draft-notes.md` (new — structural notes)

**Relevant existing code to read first:**
- `apps/web/src/lib/blog-posts.ts` — confirm frontmatter shape for registration
- `apps/web/src/lib/blog-bodies/` — sample existing posts for voice baseline
- `docs/memos/` — read any existing founder memos to match cadence

**Prerequisites to verify:**
- [ ] P4.1 PASS
- [ ] Founder has reviewed the {{SHARED_CONTEXT}} voice bar
- [ ] Real metrics available: templates count, CLI downloads to date, gallery page count

### Specification
Produce a 1,200-1,800 word draft at `apps/web/src/lib/blog-bodies/settlegrid-templates-launch.md` with this exact structure:

1. **Opening (1 paragraph):** The specific moment the founder realized MCP monetization was broken. Must reference a real pain point, not generalized "developers struggle."
2. **What's broken today (2-3 paragraphs):** Concrete list — pricing friction, no shared templates, no way to discover paid MCPs, no revenue split primitive. Each claim must link to evidence or be removable.
3. **What SettleGrid Templates is (2 paragraphs):** Describe the gallery, CLI, Skill, shadow directory in plain language. No "platform." No "ecosystem."
4. **How to try it in 60 seconds (code block):** Exact `npx settlegrid scaffold` command with expected output.
5. **What's next (1 paragraph):** Roadmap honesty — what's missing, what's planned, what might fail.
6. **Closing (1 paragraph):** Direct ask — try it, break it, tell me what sucks. Email and X handle.

At the top of the file, include a `<!-- FOUNDER REWRITE REQUIRED -->` HTML comment block listing the five things the draft cannot know: the specific origin story, the awkward confession, the real competitor comparison, the exact current metrics, and the founder's personal stake. These are the founder's job.

Register the post in `apps/web/src/lib/blog-posts.ts` with `published: false` and `slug: "settlegrid-templates-launch"`. It must not go live until the founder flips the flag post-rewrite.

**Files you may touch:**
- `apps/web/src/lib/blog-bodies/settlegrid-templates-launch.md`
- `apps/web/src/lib/blog-posts.ts`
- `docs/launch/blog-draft-notes.md`

**Files you MUST NOT touch:**
- Any existing published blog posts
- `apps/web/src/app/blog/**` routing code

**External services touched:**
- None

### Implementation Steps
1. Read 2-3 existing blog posts to match voice, paragraph length, heading style.
2. Pull real metrics from the registry, CLI install count, PostHog (if available).
3. Draft the post following the 6-section structure above.
4. Insert the `<!-- FOUNDER REWRITE REQUIRED -->` comment block at the top listing the 5 gaps.
5. Register in `blog-posts.ts` with `published: false`.
6. Write `docs/launch/blog-draft-notes.md` explaining every structural choice so the founder knows what's load-bearing vs. decorative.
7. Content quality checks: zero typos, every external link resolves, no AI-cadence patterns (scan for "furthermore," "moreover," "in essence," excessive em-dashes).
8. Run {{AUDIT_CHAIN_TEMPLATE}} — tests become content quality checks as specified.

### Definition of Done
- [ ] Draft is 1,200-1,800 words, 6-section structure intact
- [ ] `<!-- FOUNDER REWRITE REQUIRED -->` block lists all 5 gaps
- [ ] Post registered with `published: false`
- [ ] Every external link resolves (manual check)
- [ ] No typos (spell-check pass)
- [ ] No hallucinated facts (every claim has source or is flagged for founder verification)
- [ ] CAN-SPAM irrelevant (blog post, not email)
- [ ] Voice is founder-first (no "scale," "unlock," "leverage")
- [ ] {{AUDIT_CHAIN_TEMPLATE}} all three parts PASS
- [ ] Commit created

### Audit Chain
Execute {{AUDIT_CHAIN_TEMPLATE}}. Content quality checks replace code tests.

### Rollback Instructions
Delete `settlegrid-templates-launch.md` and remove the entry from `blog-posts.ts`. No user-facing impact since `published: false`.

### Commit Message Template
```
content: draft launch blog post (founder rewrite required)

Structural draft of "Why I built SettleGrid Templates" with
5 marked gaps for founder rewrite. published:false until then.

Refs: P4.2
Audits: spec-diff PASS, hostile PASS, content PASS
```

---

## P4.3 — Show HN post + comments response kit (CONTENT)

**Phase:** 4
**Depends on:** P4.2
**Blocks:** P4.7, P4.10
**Estimated effort:** 5 hours, ~$3
**Risk level:** Medium
**Rollback complexity:** Trivial

### Context
Show HN posts succeed or fail in the first 90 minutes. The title must be literal (HN downranks hype), the body must be 3-5 sentences, and the founder must have pre-written responses to the 10 most likely comment archetypes so they can respond in under 2 minutes each. This prompt produces the post draft plus a response tree. Both require founder rewrite for voice, but the structure and anticipated-objection list give the founder a scaffold.

**Relevant file paths (absolute):**
- `/Users/lex/settlegrid/docs/launch/show-hn.md` (new)
- `/Users/lex/settlegrid/docs/launch/show-hn-response-kit.md` (new)

**Relevant existing code to read first:**
- `docs/launch/blog-draft-notes.md` (from P4.2)
- Any existing founder writing in `docs/memos/`

**Prerequisites to verify:**
- [ ] P4.2 PASS
- [ ] Founder has an HN account with karma ≥ 50 (or is prepared for shadowban risk)
- [ ] Launch blog post URL is known (even if unpublished, slug is locked)

### Specification
Produce two files.

**File 1: `docs/launch/show-hn.md`** contains:
- **Title:** "Show HN: SettleGrid – Monetize MCP servers with per-call billing" (or 2-3 alternatives, all literal, all under 80 chars, all starting with "Show HN:")
- **URL:** Link to blog post
- **Body:** 3-5 sentences, first-person, concrete. Must answer: what it is, what problem it solves, what's unique, what's NOT yet working. Explicit weakness acknowledgment is HN-native.
- **First comment (founder posts immediately):** A longer follow-up explaining the technical decisions: why Redis metering, why shadow directory, why Stripe Connect Express, what failed. HN rewards technical depth in the first comment.

**File 2: `docs/launch/show-hn-response-kit.md`** is a response tree covering 10 anticipated comment archetypes:
1. "This is just Stripe with extra steps" — response with specific MCP-shaped reasons
2. "Why not use [Gumroad/Lemon Squeezy/Paddle]?" — comparison with concrete gaps
3. "MCP is hype, there's no market" — response with actual adoption numbers
4. "Your shadow directory is sketchy — you're listing repos without permission" — direct, non-defensive acknowledgment and claim-flow explanation
5. "How does this handle refunds/disputes?" — technical answer
6. "What stops me from running this myself with Redis + Stripe?" — honest answer, not defensive
7. "Pricing seems high/low" — concrete reasoning
8. "The landing page is ugly" — "you're right, I'm a solo founder, PR welcome"
9. "How is this different from [competitor X]?" — must name 2-3 real competitors
10. "Can I self-host?" — roadmap honesty

Each response is 2-4 sentences, first-person, no marketing tone. Founder will rewrite for voice but the argumentative structure is locked.

At the top of `show-hn-response-kit.md`, include a **response rules** section:
- Never argue with a user — thank and address
- Never delete a comment — defend or concede
- Respond within 10 minutes for the first 2 hours
- If a comment reveals a real bug, fix it in the same session and reply with the commit SHA
- If the founder doesn't know an answer, say so

**Files you may touch:**
- `docs/launch/show-hn.md`
- `docs/launch/show-hn-response-kit.md`

**Files you MUST NOT touch:**
- Anything in `apps/web/**` or `packages/**`

**External services touched:**
- None

### Implementation Steps
1. Study 5-10 successful recent Show HN posts in the dev tools / infra space. Note title patterns, body length, first-comment style.
2. Draft the title with 3 alternatives. All literal, all under 80 chars.
3. Draft the 3-5 sentence body. Read it aloud — if it sounds like marketing, cut it.
4. Draft the first-comment technical deep-dive (4-6 paragraphs).
5. Draft each of the 10 response archetypes.
6. Write the response rules preamble.
7. Content quality checks per {{AUDIT_CHAIN_TEMPLATE}} content rules.
8. Run {{AUDIT_CHAIN_TEMPLATE}}.

### Definition of Done
- [ ] `show-hn.md` has title + 2 alternatives, body, first-comment draft
- [ ] `show-hn-response-kit.md` has all 10 archetypes + response rules
- [ ] Zero marketing language (scan for "revolutionary," "game-changing," "unlock")
- [ ] Every competitor named is real and linked
- [ ] Body is 3-5 sentences, not more
- [ ] Founder rewrite markers present
- [ ] {{AUDIT_CHAIN_TEMPLATE}} all three parts PASS
- [ ] Commit created

### Audit Chain
Execute {{AUDIT_CHAIN_TEMPLATE}}. Content quality checks replace code tests.

### Rollback Instructions
Delete both files. No external impact.

### Commit Message Template
```
content: Show HN draft + response kit

Launch post draft plus 10-archetype response tree.
Founder rewrite required before posting.

Refs: P4.3
Audits: spec-diff PASS, hostile PASS, content PASS
```

---

## P4.4 — Demo video script + Loom storyboard (CONTENT)

**Phase:** 4
**Depends on:** P4.2
**Blocks:** P4.5, P4.10
**Estimated effort:** 4 hours, ~$2
**Risk level:** Low
**Rollback complexity:** Trivial

### Context
The launch needs a 60-second demo video (Twitter/X, Product Hunt, blog embed) and a 5-8 minute Loom walkthrough (linked from HN for curious readers). Both must show, not tell. The 60-second version must be shot in one take with zero cuts mid-action — the founder records from CLI to first paid invocation in real time. This prompt produces the shot-by-shot script and pre-flight checklist; the founder records it.

**Relevant file paths (absolute):**
- `/Users/lex/settlegrid/docs/launch/demo-video-script.md` (new)
- `/Users/lex/settlegrid/docs/launch/loom-walkthrough-script.md` (new)
- `/Users/lex/settlegrid/docs/launch/recording-checklist.md` (new)

**Relevant existing code to read first:**
- `packages/settlegrid-cli/src/commands/scaffold.ts` — verify exact CLI output for timing
- `apps/web/src/app/templates/page.tsx` — confirm gallery visual state

**Prerequisites to verify:**
- [ ] P4.2 PASS
- [ ] Gallery is visually stable (no placeholder content)
- [ ] CLI scaffold command completes in <30 seconds on a clean machine

### Specification

**File 1: `demo-video-script.md`** — exactly 60 seconds, 6 shots:
- **Shot 1 (0:00-0:08):** Gallery hero — cursor lands on a template card
- **Shot 2 (0:08-0:18):** Terminal — `npx settlegrid scaffold <template>` typed live
- **Shot 3 (0:18-0:35):** Install output scrolls, repo created, `cd` into it
- **Shot 4 (0:35-0:45):** Editor opens the generated file, founder highlights the billing wrap
- **Shot 5 (0:45-0:55):** Terminal — make a test call, see Stripe dashboard ping
- **Shot 6 (0:55-1:00):** End card — settlegrid.ai URL

Include voice-over script per shot (12-20 words each). No background music direction — founder decides. Include a "things that will go wrong" list: CLI could fail, editor could be slow, Stripe webhook could delay. For each, a mitigation: pre-warm the cache, use a pre-recorded Stripe dashboard screenshot as fallback.

**File 2: `loom-walkthrough-script.md`** — 5-8 minutes, loose outline:
- 0:00-0:30 — Hook: the problem in one sentence
- 0:30-2:00 — Gallery tour, show 3 templates, explain the registry
- 2:00-4:00 — CLI scaffold end-to-end, intentionally trigger one error to show recovery
- 4:00-5:30 — SDK code walkthrough, the `wrap()` line
- 5:30-7:00 — Stripe Connect payout view
- 7:00-8:00 — Shadow directory tour, claim flow
- 8:00-end — Ask: try it, break it, email me

**File 3: `recording-checklist.md`** — pre-flight:
- Clean terminal history
- Pre-create test Stripe account in sandbox mode
- Disable notifications (Do Not Disturb)
- Browser at 1920x1080, 125% zoom for readability
- Close all other tabs
- Record screen only, voice-over separately (easier to re-record)
- Export as MP4 H.264 <10MB for Twitter
- Upload to YouTube unlisted first for QA, then public

**Files you may touch:**
- `docs/launch/demo-video-script.md`
- `docs/launch/loom-walkthrough-script.md`
- `docs/launch/recording-checklist.md`

**Files you MUST NOT touch:**
- Any app or package code

**External services touched:**
- None (scripts only)

### Implementation Steps
1. Time the actual CLI scaffold on a clean machine. Confirm it fits in the 18-second window.
2. Write the 6-shot 60-second script with voice-over lines.
3. Write the 8-minute Loom outline with timestamps.
4. Write the pre-flight checklist.
5. Dry-read the voice-over aloud with a stopwatch. Trim if over 60 seconds.
6. Identify failure modes and document mitigations.
7. Content quality checks.
8. Run {{AUDIT_CHAIN_TEMPLATE}}.

### Definition of Done
- [ ] 60-second script has 6 shots with voice-over, totals ≤60 seconds read aloud
- [ ] Loom outline has 8-minute structure
- [ ] Recording checklist is followable by a solo founder
- [ ] All failure modes have mitigations
- [ ] {{AUDIT_CHAIN_TEMPLATE}} all three parts PASS
- [ ] Commit created

### Audit Chain
Execute {{AUDIT_CHAIN_TEMPLATE}}. Content quality checks replace code tests.

### Rollback Instructions
Delete the three files. No impact.

### Commit Message Template
```
content: demo video + Loom walkthrough scripts

60s hero video + 8-minute deep-dive scripts with recording
checklist. Founder to record per script.

Refs: P4.4
Audits: spec-diff PASS, hostile PASS, content PASS
```

---

## P4.5 — X/Twitter launch thread draft (CONTENT)

**Phase:** 4
**Depends on:** P4.2, P4.4
**Blocks:** P4.10
**Estimated effort:** 2 hours, ~$2
**Risk level:** Low
**Rollback complexity:** Trivial

### Context
The X thread runs parallel to the HN post and drives traffic independently. 8 tweets, first tweet is the hook with the demo video embedded, last tweet has the CTA. No threads-as-marketing-101 tropes ("Here's what I learned..."). Founder rewrite required.

**Relevant file paths (absolute):**
- `/Users/lex/settlegrid/docs/launch/x-thread.md` (new)

**Relevant existing code to read first:**
- `docs/launch/show-hn.md` (from P4.3) — voice alignment
- `docs/launch/demo-video-script.md` (from P4.4) — video reference

**Prerequisites to verify:**
- [ ] P4.2 PASS
- [ ] P4.4 PASS
- [ ] Founder X handle known

### Specification
Produce `docs/launch/x-thread.md` with exactly 8 tweets:

1. **Hook (tweet 1):** Demo video + one sentence. Must fit in 280 chars including the video. No emoji. No hashtags. Format: `I built [thing]. Here's why.`
2. **Problem (tweet 2):** Concrete pain point, real numbers.
3. **What I built (tweet 3):** Gallery + CLI + shadow directory in plain terms.
4. **How it works (tweet 4):** The `wrap()` line as a code block.
5. **Proof (tweet 5):** One metric that exists today — template count, GitHub stars, something real.
6. **What's broken (tweet 6):** Honest admission of one missing thing. HN and X reward this.
7. **What I need (tweet 7):** Specific ask — feedback, template PRs, a first customer.
8. **CTA (tweet 8):** Link to blog post + gallery. No "retweet if you found this useful."

Each tweet under 280 characters. Include character counts inline.

Include a "thread rules" note:
- Post all 8 tweets within 2 minutes (X algorithm prefers fast threads)
- Reply to every quote tweet in the first hour
- Don't pin the thread until 24 hours of data confirms it's working
- If tweet 1 gets under 50 impressions in 30 min, DM it to 10 friends to seed

**Files you may touch:**
- `docs/launch/x-thread.md`

**Files you MUST NOT touch:**
- Anything else

**External services touched:**
- None

### Implementation Steps
1. Study 5 recent dev-tool launch threads that worked. Note tweet 1 patterns.
2. Draft 8 tweets with character counts.
3. Verify links, add founder rewrite markers.
4. Run {{AUDIT_CHAIN_TEMPLATE}}.

### Definition of Done
- [ ] 8 tweets, each ≤280 chars with count shown
- [ ] No hashtags, no marketing tropes
- [ ] One specific ask in tweet 7
- [ ] Thread rules included
- [ ] {{AUDIT_CHAIN_TEMPLATE}} all three parts PASS
- [ ] Commit created

### Audit Chain
Execute {{AUDIT_CHAIN_TEMPLATE}}. Content quality checks.

### Rollback Instructions
Delete file.

### Commit Message Template
```
content: X launch thread draft

8-tweet thread draft with founder rewrite markers.

Refs: P4.5
Audits: spec-diff PASS, hostile PASS, content PASS
```

---

## P4.6 — Second batch cold outreach generator

**Phase:** 4
**Depends on:** P4.1, P4.2
**Blocks:** P4.10
**Estimated effort:** 6 hours, ~$15 (Anthropic API for personalization)
**Risk level:** Medium
**Rollback complexity:** Trivial

### Context
Phase 2 sent 100 cold emails as a pre-launch warmup. Phase 4 sends a second batch of 100 with a "we're live" message. Targets are prioritized: (a) developers who forked a Phase 2 template (hot), (b) MCP list contributors on GitHub (warm), (c) repos in the shadow directory with ≥10 stars (cold). Every email must be personalized with at least one specific line referencing the recipient's actual work. CAN-SPAM compliance is non-negotiable: physical address, unsubscribe link, no deceptive subject lines.

**Relevant file paths (absolute):**
- `/Users/lex/settlegrid/apps/web/src/lib/outreach/targets.ts` (new)
- `/Users/lex/settlegrid/apps/web/src/lib/outreach/personalize.ts` (new)
- `/Users/lex/settlegrid/apps/web/src/lib/outreach/templates/launch-live.md` (new)
- `/Users/lex/settlegrid/scripts/build-outreach-batch.ts` (new)
- `/Users/lex/settlegrid/docs/launch/outreach-batch-2.md` (new — review output)

**Relevant existing code to read first:**
- Any existing Phase 2 outreach scripts (grep for `outreach`)
- `scripts/build-registry.ts` — pattern for script structure
- `apps/web/src/lib/posthog.ts` — for tracking email opens if applicable

**Prerequisites to verify:**
- [ ] P4.1 PASS (telemetry wired to track click-through)
- [ ] P4.2 PASS (blog post exists for linking)
- [ ] SettleGrid has a verified sending domain
- [ ] Physical mailing address exists for CAN-SPAM footer

### Specification
Build a script, not a runtime system. The script generates 100 email drafts into a single review file that the founder manually sends via their personal email (Gmail/Superhuman) — NOT via transactional email automation. This preserves the "personal email from a founder" signal and dodges spam filters.

`scripts/build-outreach-batch.ts` does:
1. Load 3 target lists:
   - **Hot:** Phase 2 template forkers (from GitHub API, filter forks of `settlegrid/templates-*`)
   - **Warm:** Contributors to `punkpeye/awesome-mcp-servers` and similar lists (GitHub API)
   - **Cold:** Repos in the shadow directory with ≥10 stars
2. For each target, fetch public data: name, GitHub bio, recent repo commit messages, top language, one specific recent PR or issue.
3. Use Claude (Anthropic API) to generate ONE personalization line per target. Prompt: "Given this developer's public work, write one sentence that proves I read their profile. 20 words max. No flattery. Reference specific repo name or PR title."
4. Compose email from `templates/launch-live.md` with `{{personalization}}`, `{{recipient_name}}`, `{{unsubscribe_link}}` tokens.
5. Output `docs/launch/outreach-batch-2.md` as a single reviewable markdown file: 100 email blocks, each with recipient info, subject line, body, and a `[ ] sent` checkbox.

`templates/launch-live.md` structure:
- Subject: `SettleGrid is live — thought you'd want to see it` (or per-target variant)
- Greeting by first name
- Personalization line (from Claude)
- 2-sentence context: "I emailed you 6 weeks ago about SettleGrid. We're live today."
- 1-sentence ask: "30 seconds to click the gallery and tell me what's broken: [link]"
- 1-sentence CTA for a call: "Or reply with a time if you want a 15-min walkthrough."
- Sign-off with first name
- CAN-SPAM footer: physical address + "Reply STOP to unsubscribe" (since these are personal emails, an unsubscribe link isn't required, but a reply-based opt-out is best practice)

Hot targets get variant copy referencing their specific fork. Warm targets get the general template. Cold targets get a softer opener that acknowledges we're reaching out without prior contact.

**Files you may touch:**
- `apps/web/src/lib/outreach/**`
- `scripts/build-outreach-batch.ts`
- `docs/launch/outreach-batch-2.md`

**Files you MUST NOT touch:**
- Any transactional email infrastructure (Resend, Postmark) — this batch is manual

**External services touched:**
- GitHub API (public, no auth for low volume; use auth to raise limits)
- Anthropic API (Claude for personalization)

### Implementation Steps
1. Define the 3 target list sources and data shapes in `targets.ts`.
2. Write fetchers for each source, rate-limited, with caching to disk.
3. Write the Claude personalization function in `personalize.ts` with a strict system prompt: "20 words max, must reference specific work, no flattery."
4. Write the email template and variant logic.
5. Write the batch generator script that outputs the review markdown.
6. Run the script, inspect 10 random emails for quality.
7. Verify CAN-SPAM: physical address present, opt-out mechanism present, no deceptive subject line.
8. Content quality checks: no hallucinated repo names, no flattery, personalization actually specific.
9. Run {{AUDIT_CHAIN_TEMPLATE}}.

### Definition of Done
- [ ] Script generates 100 emails into review file
- [ ] Spot check 10 emails: each has a specific, non-hallucinated personalization line
- [ ] CAN-SPAM compliance: physical address + opt-out in every email
- [ ] Hot/warm/cold variants differentiated
- [ ] No subject line starts with "Re:" (deceptive)
- [ ] `pnpm -w typecheck` passes
- [ ] Script is idempotent (re-running doesn't spam)
- [ ] {{AUDIT_CHAIN_TEMPLATE}} all three parts PASS
- [ ] Commit created

### Audit Chain
Execute {{AUDIT_CHAIN_TEMPLATE}}. Content quality + CAN-SPAM compliance check.

### Rollback Instructions
Delete generated files. No emails sent by the script itself.

### Commit Message Template
```
outreach: second batch generator for launch week

Builds 100 personalized emails (hot/warm/cold) into a review
file. Founder sends manually via personal email.

Refs: P4.6
Audits: spec-diff PASS, hostile PASS, content PASS
```

---

## P4.7 — Launch-day war room prep

**Phase:** 4
**Depends on:** P4.1, P4.3, P4.6
**Blocks:** P4.10
**Estimated effort:** 6 hours, ~$5
**Risk level:** High
**Rollback complexity:** Trivial

### Context
Launch day is the highest-stakes 48-hour window of the quarter. Things will break: CLI install will fail on some Node version, a Stripe webhook will miss, a template will have a typo, a database query will time out under load. The founder needs a war room runbook that predicts the top 15 failure modes and prescribes a 2-minute fix for each, plus a monitoring dashboard that surfaces problems before HN commenters find them.

**Relevant file paths (absolute):**
- `/Users/lex/settlegrid/docs/launch/war-room-runbook.md` (new)
- `/Users/lex/settlegrid/docs/launch/incident-log-template.md` (new)
- `/Users/lex/settlegrid/apps/web/src/app/admin/launch-dashboard/page.tsx` (new)
- `/Users/lex/settlegrid/apps/web/src/app/api/admin/launch-metrics/route.ts` (new)
- `/Users/lex/settlegrid/scripts/launch-day-smoke.sh` (new)

**Relevant existing code to read first:**
- `apps/web/src/lib/posthog.ts` — query helper for dashboard
- Any existing admin pages
- `apps/web/src/lib/rate-limit.ts` — understand current limits

**Prerequisites to verify:**
- [ ] P4.1 PASS (telemetry live)
- [ ] P4.3 PASS (response kit ready)
- [ ] P4.6 PASS (outreach ready)
- [ ] Sentry or equivalent error monitoring wired
- [ ] Vercel deployment monitoring accessible

### Specification

**File 1: `docs/launch/war-room-runbook.md`** — 15 incident playbooks. Each playbook:
- Symptom (what the founder sees)
- Likely cause
- 2-minute fix (command or link)
- Escalation (if 2-min fix fails)
- Communication (what to say on HN/X)

Required incidents:
1. CLI install fails on Node 18
2. CLI install fails on Node 20+
3. CLI fails behind corporate proxy
4. Scaffold command hangs
5. Gallery page 500s under load
6. Shadow directory 404s for specific repo
7. PostHog stops receiving events
8. Stripe webhook fails
9. Database connection pool exhausted
10. Rate limit triggered on legitimate traffic
11. Template registry build fails mid-launch
12. Someone posts a security issue on HN
13. Someone files a bogus DMCA against the shadow directory
14. HN post is flagged/killed
15. Vercel deployment fails during hotfix

**File 2: `docs/launch/incident-log-template.md`** — append-only log:
- Timestamp, incident ID, symptom, action, outcome
- Founder fills in real-time during launch

**File 3: Launch dashboard at `/admin/launch-dashboard`** — single page, no auth-fancy, protected by existing admin guard. Shows:
- Live PostHog funnel counts (last 15 min, 1 hour, 24 hours)
- CLI install count (from telemetry)
- Scaffold success/fail ratio
- Active Stripe connections
- Database response time p50/p95
- HN post URL + vote count scraper
- Show HN rank (scraped from HN API)
- Error rate (from Sentry or log aggregator)

API route fetches all metrics server-side in parallel with 30-second revalidate.

**File 4: `scripts/launch-day-smoke.sh`** — single script that in <90 seconds runs:
- `curl` gallery homepage, expect 200
- `curl` a template detail page, expect 200
- `npx settlegrid --version`, expect version string
- `npx settlegrid scaffold test-template` in a temp dir, expect success
- PostHog event ping
- Stripe webhook test endpoint

Founder runs this every 30 minutes during launch day. Output is a green/red summary.

**Files you may touch:**
- `docs/launch/war-room-runbook.md`
- `docs/launch/incident-log-template.md`
- `apps/web/src/app/admin/launch-dashboard/page.tsx`
- `apps/web/src/app/api/admin/launch-metrics/route.ts`
- `scripts/launch-day-smoke.sh`

**Files you MUST NOT touch:**
- Production CLI/SDK code (no "fixes" — only hotfix capability)

**External services touched:**
- PostHog, Sentry, Stripe, HN API, Vercel

### Implementation Steps
1. Write the 15 incident playbooks. Each must have a real 2-minute fix.
2. Build the dashboard page with 7 metric cards.
3. Build the admin API route that queries all sources in parallel.
4. Write the smoke test shell script. Make it executable, add to `package.json` as `launch:smoke`.
5. Write the incident log template with example rows.
6. Run the smoke test end-to-end. Fix anything that doesn't pass.
7. Manually simulate 3 incidents (e.g., break a template, verify the 2-minute fix actually works).
8. Run {{AUDIT_CHAIN_TEMPLATE}}.

### Definition of Done
- [ ] 15 incident playbooks with tested 2-minute fixes
- [ ] Dashboard renders all 7 metrics with real data
- [ ] Smoke test passes in <90 seconds
- [ ] Incident log template ready for use
- [ ] 3 simulated incidents resolved in <2 minutes each
- [ ] `pnpm -w typecheck` passes
- [ ] Dashboard access gated by admin auth
- [ ] {{AUDIT_CHAIN_TEMPLATE}} all three parts PASS
- [ ] Commit created

### Audit Chain
Execute {{AUDIT_CHAIN_TEMPLATE}}.

### Rollback Instructions
Dashboard can be disabled by removing the route. Runbook is docs-only. Smoke script is script-only.

### Commit Message Template
```
launch: war room runbook, dashboard, and smoke script

15 incident playbooks, live launch dashboard at /admin/launch-dashboard,
90-second smoke test. Ready for launch day.

Refs: P4.7
Audits: spec-diff PASS, hostile PASS, tests PASS
```

---

## P4.8 — Customer interview template + scheduling pipeline

**Phase:** 4
**Depends on:** P4.1
**Blocks:** P4.10, P5.3
**Estimated effort:** 4 hours, ~$3
**Risk level:** Low
**Rollback complexity:** Trivial

### Context
Phase 5 decisions depend on 10 customer interview transcripts. This prompt sets up the infrastructure: interview template, Calendly link, transcription workflow, storage location. Every Phase 4 signup gets an automated (but personally-signed) follow-up within 24 hours asking for 20 minutes. The template is structured to extract the jobs-to-be-done framing, not to pitch.

**Relevant file paths (absolute):**
- `/Users/lex/settlegrid/docs/interviews/template.md` (new)
- `/Users/lex/settlegrid/docs/interviews/transcripts/.gitkeep` (new)
- `/Users/lex/settlegrid/docs/interviews/scheduling-script.md` (new)
- `/Users/lex/settlegrid/apps/web/src/lib/email/templates/interview-request.ts` (new)
- `/Users/lex/settlegrid/apps/web/src/app/api/admin/signup-followup/route.ts` (new)

**Relevant existing code to read first:**
- Existing email templates if any
- `apps/web/src/lib/db/schema.ts` — signup/user table shape

**Prerequisites to verify:**
- [ ] P4.1 PASS
- [ ] Calendly or similar scheduler account exists
- [ ] Founder email configured for outbound

### Specification

**Interview template** follows a 6-section JTBD structure, 20 minutes total:
1. **Context (2 min):** What are you building? Who's it for?
2. **Current state (5 min):** How do you handle [the problem SettleGrid solves] today? Walk me through it.
3. **Pain points (4 min):** Where does it break? What do you wish worked differently? No leading questions.
4. **SettleGrid reaction (5 min):** Open the gallery while on the call. What do you click first? What confuses you?
5. **Willingness (2 min):** If this worked perfectly, would you pay for it? What's fair? No pressure.
6. **Close (2 min):** Who else should I talk to? Can I follow up?

Each section has 3-5 script questions and "DO NOT" notes ("DO NOT pitch SettleGrid in section 3").

**Scheduling script** — the process when someone signs up:
1. PostHog fires `signup_completed` event
2. Founder sees it in the launch dashboard (P4.7)
3. Within 24 hours, founder sends personal email using the template
4. Email has one Calendly link with three 20-min slots over next 3 days
5. On confirmation, founder sends a Loom of the product (from P4.4) as pre-read
6. Post-call, founder uploads recording to Otter.ai or similar, transcript saves to `docs/interviews/transcripts/YYYY-MM-DD-username.md`

**Follow-up email template** at `interview-request.ts`:
- Subject: `Quick question about [their username]` or similar personal line
- First line: "Thanks for signing up to SettleGrid earlier today."
- Middle: "I'm the founder. I'm trying to learn what people actually need from MCP monetization. Would you have 20 minutes this week? I'll share everything I'm learning with you."
- CTA: Calendly link
- Sign-off: First name + phone number

**Admin endpoint** at `/api/admin/signup-followup` lists recent signups with: email, signup time, outreach status (not sent / sent / scheduled / interviewed), notes field. Founder manually marks status as they work through the list. No automation — this is deliberately manual to maintain personal signal.

**Files you may touch:**
- `docs/interviews/**`
- `apps/web/src/lib/email/templates/interview-request.ts`
- `apps/web/src/app/api/admin/signup-followup/route.ts`

**Files you MUST NOT touch:**
- Automated email sending infrastructure (this is manual)

**External services touched:**
- Calendly (scheduling)
- Otter.ai or equivalent (transcription)

### Implementation Steps
1. Write interview template with JTBD structure.
2. Set up Calendly event type, 20 min, 3 slots/day capacity.
3. Write email template (non-automated, copy-pasteable).
4. Build admin endpoint listing recent signups + status.
5. Write the scheduling script document.
6. Test the full flow: fake signup, receive in admin view, copy email, send to self, check Calendly link works.
7. Run {{AUDIT_CHAIN_TEMPLATE}}.

### Definition of Done
- [ ] Interview template covers 6 sections with script questions
- [ ] Scheduling script documents end-to-end flow
- [ ] Email template ready to copy-paste
- [ ] Admin endpoint shows recent signups with status
- [ ] Calendly link tested and working
- [ ] `pnpm -w typecheck` passes
- [ ] {{AUDIT_CHAIN_TEMPLATE}} all three parts PASS
- [ ] Commit created

### Audit Chain
Execute {{AUDIT_CHAIN_TEMPLATE}}.

### Rollback Instructions
Delete files and endpoint. No impact.

### Commit Message Template
```
interviews: template + scheduling pipeline for launch week

JTBD interview template, Calendly flow, admin endpoint for
signup follow-ups. Founder runs manually.

Refs: P4.8
Audits: spec-diff PASS, hostile PASS, tests PASS
```

---

## P4.9 — Cursor extension polish vs. deprioritize decision (ADR)

**Phase:** 4
**Depends on:** P4.1
**Blocks:** P4.10
**Estimated effort:** 3 hours (decision only) OR 14 hours (build path), ~$5 or $30
**Risk level:** Medium
**Rollback complexity:** Trivial

### Context
Phases 1-3 shipped the Anthropic Skill, which is the primary AI coding integration. A dedicated Cursor/Windsurf extension was listed as "if time allows." Time is not unlimited. This prompt runs a decision gate: evaluate Skill telemetry from Phase 3, measure Skill invocations in Cursor specifically (via user-agent or detected environment), and make a binary call. The output is an ADR; if the call is "build," a follow-up prompt is created. If the call is "skip," the ADR documents why with a tripwire for revisiting.

**Relevant file paths (absolute):**
- `/Users/lex/settlegrid/docs/decisions/ADR-004-cursor-extension.md` (new)
- `/Users/lex/settlegrid/packages/settlegrid-skill/README.md`

**Relevant existing code to read first:**
- `packages/settlegrid-skill/` — verify Skill is working across AI tools
- PostHog data from P4.1 — Skill invocation events if available
- Any Phase 3 retro notes

**Prerequisites to verify:**
- [ ] P4.1 PASS (48 hours of PostHog data on Skill usage)
- [ ] Skill is verifiably working in Cursor, Windsurf, Claude Code (manual test)

### Specification
Produce `docs/decisions/ADR-004-cursor-extension.md` with the ADR format:

**Status:** Proposed / Accepted / Rejected
**Context:** 2 paragraphs on the Skill vs. extension tradeoff
**Decision criteria:**
- Criterion A: Does the Skill work in Cursor via MCP without a dedicated extension? (manual test)
- Criterion B: Does Skill telemetry show ≥10 distinct users successfully invoking in Cursor in 48 hours? (PostHog query)
- Criterion C: Does the founder have ≥14 free hours in Week 7-8 after Phase 4 mandatory work? (calendar check)
- Criterion D: Has any Phase 4 customer interview mentioned Cursor extension as a blocker? (zero signal = skip)

**Decision rule:**
- Build IF A = working, B ≥ 10 users, C = true, D ≥ 2 mentions
- Skip otherwise

**Decision:** Fill in based on actual measurement.

**Consequences:**
- If build: adds P4.9a prompt to ship minimum viable extension
- If skip: document the tripwire — "revisit when ≥20 customers mention Cursor extension gap in interviews"

**Implementation if build path:**
- Fork Cursor extension boilerplate
- Package the Skill manifest as an extension config
- Submit to Cursor extension marketplace (if one exists) or document sideload process
- Target: 6 hours to working extension, 8 hours to marketplace submission

**Implementation if skip path:**
- Update Skill README with a "Using with Cursor" section (1-hour task)
- Add a landing page snippet: "SettleGrid works in Cursor via the Anthropic Skill — here's how"
- Close decision

**Files you may touch:**
- `docs/decisions/ADR-004-cursor-extension.md`
- `packages/settlegrid-skill/README.md` (if skip path)

**Files you MUST NOT touch:**
- New extension code (unless decision = build)

**External services touched:**
- PostHog (query), Cursor marketplace (if build)

### Implementation Steps
1. Query PostHog for Skill invocation events in Cursor environment over last 48 hours.
2. Manually test Skill in Cursor, Windsurf, Claude Code. Document status.
3. Review customer interview notes for Cursor mentions (from P4.8, if any exist yet).
4. Check calendar honestly for 14 free hours in remaining Week 7-8.
5. Apply decision rule. Write ADR with the numbers that drove the call.
6. If skip: update Skill README with Cursor instructions.
7. If build: create follow-up `P4.9a` prompt card for the extension work.
8. Run {{AUDIT_CHAIN_TEMPLATE}}.

### Definition of Done
- [ ] ADR written with actual measured criteria (not guesses)
- [ ] Decision is binary and defensible
- [ ] If skip: Skill README updated with Cursor section
- [ ] If build: P4.9a prompt card drafted
- [ ] Tripwire condition defined for future revisit
- [ ] {{AUDIT_CHAIN_TEMPLATE}} all three parts PASS
- [ ] Commit created

### Audit Chain
Execute {{AUDIT_CHAIN_TEMPLATE}}.

### Rollback Instructions
ADRs are immutable once accepted. A new ADR supersedes an old one.

### Commit Message Template
```
decisions: ADR-004 Cursor extension build-or-skip

Decision: <BUILD|SKIP>. Based on <N> Cursor invocations in
48h, <M> customer mentions, and calendar reality.

Refs: P4.9
Audits: spec-diff PASS, hostile PASS, content PASS
```

---

## P4.10 — Phase 4 audit gate

**Phase:** 4
**Depends on:** P4.1, P4.2, P4.3, P4.4, P4.5, P4.6, P4.7, P4.8, P4.9
**Blocks:** P5.1
**Estimated effort:** 3 hours, ~$2
**Risk level:** Low
**Rollback complexity:** Trivial

### Context
Phase 4 has 9 prior prompts spanning code and content. Before Phase 5 can start, each exit criterion must be verified with evidence, not intuition. This prompt is the gate.

**Relevant file paths (absolute):**
- `/Users/lex/settlegrid/docs/phase-gates/phase-4-audit.md` (new)

**Relevant existing code to read first:**
- All P4.x commit messages
- PostHog dashboard
- HN post (if launched)

**Prerequisites to verify:**
- [ ] P4.1-P4.9 all PASS

### Specification
Produce `docs/phase-gates/phase-4-audit.md` verifying each Phase 4 exit criterion with linked evidence:

1. **Show HN posted** — link to HN post, timestamp, karma score
2. **≥4 of 5 launch surfaces live** — checklist of blog, video, X thread, HN, Product Hunt with links
3. **PostHog funnel events flowing ≥48h** — screenshot of event counts per event
4. **Launch content published** — links to each
5. **Funnel data collected** — export of event counts
6. **Customer interviews booked** — count from P4.8 admin view

For each criterion: PASS / FAIL / PARTIAL with a one-sentence justification. If any criterion is FAIL, document the remediation plan before Phase 5 starts. If PARTIAL, decide whether to block Phase 5 or accept the gap.

Also verify no Phase 4 commit broke a Phase 3 test: `pnpm -w test` full suite run. No regressions allowed.

**Files you may touch:**
- `docs/phase-gates/phase-4-audit.md`

**Files you MUST NOT touch:**
- Any production code

**External services touched:**
- PostHog, HN, Product Hunt (read-only)

### Implementation Steps
1. Run full test suite. Confirm zero regressions.
2. Capture PostHog event counts for all 8 events.
3. Verify each launch surface is live (HTTP 200, content correct).
4. Count customer interviews booked.
5. Write PASS/FAIL/PARTIAL for each of the 6 criteria.
6. If any FAIL, write remediation.
7. Sign the gate (founder initial + date).
8. Run {{AUDIT_CHAIN_TEMPLATE}}.

### Definition of Done
- [ ] All 6 exit criteria evaluated with evidence
- [ ] Full test suite passes with zero Phase 3 regressions
- [ ] Gate signed
- [ ] Any FAIL has remediation plan
- [ ] {{AUDIT_CHAIN_TEMPLATE}} all three parts PASS
- [ ] Commit created

### Audit Chain
Execute {{AUDIT_CHAIN_TEMPLATE}}.

### Rollback Instructions
If gate fails, halt Phase 5. Document failure, revise, re-run gate.

### Commit Message Template
```
gate: Phase 4 audit — <PASS|PARTIAL|FAIL>

All 6 exit criteria evaluated. <summary>. Phase 5 <cleared|blocked>.

Refs: P4.10
Audits: spec-diff PASS, hostile PASS, tests PASS
```

---

## P5.1 — Funnel analysis script + dashboard

**Phase:** 5
**Depends on:** P4.10
**Blocks:** P5.2, P5.3
**Estimated effort:** 8 hours, ~$10
**Risk level:** Medium
**Rollback complexity:** Trivial

### Context
Phase 5 is data-driven. This prompt builds the queries that turn raw PostHog events into a funnel memo. The script runs against PostHog's API (or exported parquet/csv if the API is rate-limited) and outputs numbers for each stage: gallery views → template detail views → CLI installs → scaffold successes → first billed calls. The conversion rates between stages are the load-bearing numbers for the kill criteria evaluation.

**Relevant file paths (absolute):**
- `/Users/lex/settlegrid/scripts/funnel-analysis.ts` (new)
- `/Users/lex/settlegrid/apps/web/src/app/admin/funnel/page.tsx` (new)
- `/Users/lex/settlegrid/apps/web/src/app/api/admin/funnel/route.ts` (new)
- `/Users/lex/settlegrid/docs/memos/funnel-analysis-day60.md` (output, written manually)

**Relevant existing code to read first:**
- `apps/web/src/lib/posthog.ts` — server-side client
- `docs/telemetry/events.md` — canonical event names
- `apps/web/src/app/admin/launch-dashboard/page.tsx` — reuse patterns

**Prerequisites to verify:**
- [ ] P4.10 PASS
- [ ] ≥ 14 days of PostHog data (day 60 from launch)
- [ ] PostHog API key has read access to project events

### Specification

**Script** `scripts/funnel-analysis.ts`:
- Fetches event counts from PostHog API for the past 30 days (Phase 4 window + Phase 5 runway)
- For each of the 8 canonical events, outputs: total count, unique users, daily breakdown
- Computes conversion rates: `gallery → template_detail`, `template_detail → cli_install`, `cli_install → scaffold_success`, `scaffold_success → first_billed_call`
- Computes time-to-conversion (median minutes between stages)
- Outputs JSON to `docs/memos/funnel-data-day60.json`
- Outputs a markdown summary block to stdout the founder pastes into `funnel-analysis-day60.md`

**Dashboard** `/admin/funnel`:
- Renders the same data visually: 5-step funnel chart with dropoff percentages
- Daily event counts for last 30 days
- Top templates by scaffold success
- Top error codes (from `scaffold_failed` event)
- Geographic breakdown (from `ip_country`)

Dashboard reads from `/api/admin/funnel` which caches results for 5 minutes.

**Memo template** at `docs/memos/funnel-analysis-day60.md`:
- Section 1: Raw numbers table
- Section 2: Conversion rate analysis
- Section 3: Dropoff diagnosis (where are we losing people?)
- Section 4: Anomalies (spikes, dips, timezone effects)
- Section 5: Comparison to pre-launch hypothesis (what we expected vs. reality)
- Section 6: Three recommendations for Phase 5 action

The script scaffolds sections 1-4 with numbers. The founder writes sections 5 and 6 manually — these require judgment.

**Files you may touch:**
- `scripts/funnel-analysis.ts`
- `apps/web/src/app/admin/funnel/page.tsx`
- `apps/web/src/app/api/admin/funnel/route.ts`
- `docs/memos/funnel-analysis-day60.md`

**Files you MUST NOT touch:**
- PostHog configuration
- Event emission code (frozen since P4.1)

**External services touched:**
- PostHog API (read)

### Implementation Steps
1. Read PostHog API docs for event query endpoint.
2. Write the script with parallel queries for 8 events.
3. Compute conversion and time-to-conversion.
4. Write the JSON output and markdown summary.
5. Build the dashboard page with funnel chart (recharts or similar already in the repo).
6. Build the admin API route with 5-min cache.
7. Run the script once with current data to verify output shape.
8. Scaffold the memo template with current numbers. Leave sections 5-6 as TODOs for founder.
9. Run {{AUDIT_CHAIN_TEMPLATE}}.

### Definition of Done
- [ ] Script outputs JSON + markdown with all 8 event counts and 4 conversion rates
- [ ] Dashboard renders live data
- [ ] Memo template has scaffolded sections 1-4
- [ ] `pnpm -w typecheck` passes
- [ ] Script tested against real PostHog data
- [ ] {{AUDIT_CHAIN_TEMPLATE}} all three parts PASS
- [ ] Commit created

### Audit Chain
Execute {{AUDIT_CHAIN_TEMPLATE}}.

### Rollback Instructions
Remove script, dashboard, API route. Memo is docs-only.

### Commit Message Template
```
analysis: funnel analysis script + dashboard

Queries PostHog for 8 canonical events, computes 4 conversion
rates, outputs memo scaffold for day-60 analysis.

Refs: P5.1
Audits: spec-diff PASS, hostile PASS, tests PASS
```

---

## P5.2 — Kill criteria evaluation memo (CONTENT)

**Phase:** 5
**Depends on:** P5.1
**Blocks:** P5.5
**Estimated effort:** 4 hours, ~$5
**Risk level:** High
**Rollback complexity:** Trivial

### Context
The master plan §8 defined six kill criteria. This prompt evaluates each against actual data and produces a binary go/no-go decision memo. The memo is the most consequential document of the quarter — it determines whether the next 90 days build on SettleGrid or pivot. The founder must resist motivated reasoning; the template is structured to force honest numbers first, interpretation second.

**Relevant file paths (absolute):**
- `/Users/lex/settlegrid/docs/memos/kill-criteria-evaluation.md` (new)
- `/Users/lex/settlegrid/docs/decisions/ADR-005-double-down-or-pivot.md` (new)

**Relevant existing code to read first:**
- `docs/memos/funnel-analysis-day60.md` (from P5.1)
- PostHog dashboard data
- Registry count and signup count from database

**Prerequisites to verify:**
- [ ] P5.1 PASS
- [ ] Funnel memo sections 1-4 populated
- [ ] Day 60 reached (≥60 days since Phase 4 launch)

### Specification

**Memo structure** at `docs/memos/kill-criteria-evaluation.md`:

**Header:** Date, days since launch, author.

**Section 1: The six criteria** (from master plan §8), each with:
- Target
- Actual
- Source of truth (query or file path)
- PASS / FAIL

1. ≥50 templates in registry
2. ≥100 CLI installs
3. ≥10 distinct users
4. ≥1 external PR to templates
5. ≥1% gallery→CLI conversion
6. Founder sanity ≥6/10 (self-assessed, honest)

**Section 2: Aggregate verdict.** If ≥4 of 6 PASS → "continue." If ≤3 of 6 PASS → "pivot." If exactly 4/6 PASS but criterion 5 or 6 fails → "cautious continue with tripwire."

**Section 3: The one-sentence story.** What's actually happening? Write one sentence that summarizes the truth of the 60 days. No hedging.

**Section 4: The counter-narrative.** What would a hostile reviewer say? Force the opposite interpretation of the data. This section exists to kill motivated reasoning.

**Section 5: Recommendation.** Based on sections 1-4, the recommended path forward. This is input to P5.5.

**ADR** at `docs/decisions/ADR-005-double-down-or-pivot.md`:
- Status: Proposed → Accepted after founder signs
- Context: links to funnel memo and kill criteria memo
- Decision: binary, no hedging
- Consequences: what changes in the next 90 days

**Files you may touch:**
- `docs/memos/kill-criteria-evaluation.md`
- `docs/decisions/ADR-005-double-down-or-pivot.md`

**Files you MUST NOT touch:**
- Funnel analysis script
- Any product code

**External services touched:**
- PostHog (read), database (read for signup count)

### Implementation Steps
1. Pull actual numbers for all 6 criteria from the canonical sources.
2. Fill in section 1 table. No rounding up, no "almost."
3. Apply the aggregate verdict rule mechanically.
4. Write the one-sentence story. Rewrite until it sounds like a friend, not a pitch.
5. Write the counter-narrative. Force yourself to inhabit the hostile view.
6. Write the recommendation.
7. Draft ADR-005 with the decision.
8. Hold the memo for 24 hours before signing. Re-read with fresh eyes.
9. Content quality checks.
10. Run {{AUDIT_CHAIN_TEMPLATE}}.

### Definition of Done
- [ ] All 6 criteria have actual numbers and PASS/FAIL
- [ ] Aggregate verdict applied mechanically
- [ ] One-sentence story written without hedging
- [ ] Counter-narrative forces the hostile view
- [ ] ADR-005 drafted with binary decision
- [ ] Memo held 24h before signing
- [ ] {{AUDIT_CHAIN_TEMPLATE}} all three parts PASS
- [ ] Commit created

### Audit Chain
Execute {{AUDIT_CHAIN_TEMPLATE}}. Content checks + motivated-reasoning hostile review.

### Rollback Instructions
ADR is immutable once accepted. If decision is reversed, a new ADR must supersede it.

### Commit Message Template
```
memo: kill criteria evaluation day-60

6 criteria evaluated, <N>/6 PASS. Decision: <continue|pivot>.
ADR-005 filed.

Refs: P5.2
Audits: spec-diff PASS, hostile PASS, content PASS
```

---

## P5.3 — Customer interview synthesis (CONTENT)

**Phase:** 5
**Depends on:** P4.8, P4.10
**Blocks:** P5.5
**Estimated effort:** 6 hours, ~$8
**Risk level:** Medium
**Rollback complexity:** Trivial

### Context
10+ customer interview transcripts were collected during Phase 4. Raw transcripts are useless for decision-making — they need synthesis into themes, jobs-to-be-done clusters, and actionable insights. This is a content prompt: the synthesis requires founder judgment, not LLM summarization. The output feeds directly into the next 90-day plan.

**Relevant file paths (absolute):**
- `/Users/lex/settlegrid/docs/interviews/transcripts/` (input directory)
- `/Users/lex/settlegrid/docs/memos/customer-insights-v1.md` (new)

**Relevant existing code to read first:**
- `docs/interviews/template.md` (the interview structure)
- All transcripts in `docs/interviews/transcripts/`

**Prerequisites to verify:**
- [ ] ≥10 transcripts exist (or honest count if fewer — work with what's real)
- [ ] P5.2 PASS (so synthesis can reference kill criteria findings)

### Specification

**Synthesis memo** at `docs/memos/customer-insights-v1.md`:

**Header:** Count of interviews, date range, interviewer.

**Section 1: Who we talked to.** Table of interviewees: role, company size, MCP experience, current tool. No names if privacy matters.

**Section 2: The jobs-to-be-done.** Cluster the "current state" answers (interview section 2) into 3-5 jobs. Each job: label, count of mentions, representative quote.

**Section 3: The pain points.** Cluster the "pain points" answers (interview section 3) into 3-5 themes. Each theme: label, count, representative quote, severity estimate.

**Section 4: SettleGrid reactions.** What did people click first in the gallery? What confused them? What did they love? Ranked by frequency.

**Section 5: Willingness to pay.** Distribution of answers from section 5. Specific price points mentioned. Who said yes vs. no and why.

**Section 6: Surprise findings.** Anything that wasn't in any hypothesis. These are the most valuable. Count them honestly.

**Section 7: What to build next.** Based on sections 2-6, the 3 highest-leverage things to build or fix in the next 90 days. Must be specific — "improve onboarding" is not acceptable; "replace the template filter with a keyword search because 7/10 interviewees tried to type in the filter" is acceptable.

**Process rules:**
- Read every transcript end-to-end before writing anything
- Quote directly, never paraphrase to make a point land harder
- If a theme has <3 mentions, mark it "weak signal"
- If two themes contradict, include both — don't resolve prematurely
- No claim without a transcript line number reference

**Files you may touch:**
- `docs/memos/customer-insights-v1.md`

**Files you MUST NOT touch:**
- Transcripts (read-only)
- Any product code

**External services touched:**
- None

### Implementation Steps
1. List all transcripts. Record the count honestly even if <10.
2. Read each transcript end-to-end. Take notes per section.
3. Build the interviewee table.
4. Cluster JTBD answers into 3-5 jobs with quote evidence.
5. Cluster pain points into themes with severity.
6. Record gallery reactions ranked by frequency.
7. Tabulate willingness to pay.
8. Capture surprise findings — be honest about what you didn't expect.
9. Write the 3 recommended next-90-day actions with specific evidence.
10. Run {{AUDIT_CHAIN_TEMPLATE}}.

### Definition of Done
- [ ] All transcripts read
- [ ] 3-5 JTBD clusters with quote evidence
- [ ] 3-5 pain point themes with severity
- [ ] Gallery reactions ranked
- [ ] Willingness to pay distribution captured
- [ ] Surprise findings section non-empty
- [ ] 3 specific next-action recommendations
- [ ] No claim without transcript reference
- [ ] {{AUDIT_CHAIN_TEMPLATE}} all three parts PASS
- [ ] Commit created

### Audit Chain
Execute {{AUDIT_CHAIN_TEMPLATE}}. Content checks + evidence-traceability check.

### Rollback Instructions
Docs-only. Delete the memo if superseded.

### Commit Message Template
```
memo: customer insights v1 from <N> interviews

Synthesized JTBD, pain points, pricing signals, and 3 next
actions from Phase 4 customer interviews.

Refs: P5.3
Audits: spec-diff PASS, hostile PASS, content PASS
```

---

## P5.4 — Template of the Week content cadence

**Phase:** 5
**Depends on:** P4.10
**Blocks:** P5.6
**Estimated effort:** 6 hours, ~$8
**Risk level:** Low
**Rollback complexity:** Trivial

### Context
Post-launch momentum dies without weekly content. "Template of the Week" is the smallest sustainable cadence: pick one template, write 300-500 words about why it's interesting, publish to blog + X. This prompt automates the pipeline so the founder spends 30 minutes per week, not 3 hours. The pipeline picks a candidate from the registry, scaffolds a draft, and opens a PR for the founder to rewrite.

**Relevant file paths (absolute):**
- `/Users/lex/settlegrid/scripts/template-of-the-week.ts` (new)
- `/Users/lex/settlegrid/apps/web/src/lib/blog-bodies/totw/.gitkeep` (new)
- `/Users/lex/settlegrid/.github/workflows/template-of-the-week.yml` (new)
- `/Users/lex/settlegrid/docs/content/totw-playbook.md` (new)

**Relevant existing code to read first:**
- `scripts/build-registry.ts`
- `apps/web/src/lib/blog-posts.ts`
- PostHog data for most-scaffolded template (picks the winner)

**Prerequisites to verify:**
- [ ] P4.10 PASS
- [ ] Registry has ≥10 templates
- [ ] GitHub Actions enabled

### Specification

**Script** `scripts/template-of-the-week.ts`:
- Reads the registry
- Queries PostHog for scaffold success counts by template (last 7 days)
- Scores candidates: `scaffold_count * 2 + view_count + freshness_bonus`
- Picks the top candidate not already featured (check `docs/content/totw-history.json`)
- Scaffolds a 300-500 word blog post draft with structure: hook, what it does, code snippet, why interesting, CTA
- Uses Claude for the draft with a prompt that explicitly asks for founder-voice, not marketing
- Saves to `apps/web/src/lib/blog-bodies/totw/YYYY-MM-DD-<template>.md`
- Registers in `blog-posts.ts` with `published: false`
- Appends to `totw-history.json`

**GitHub Action** `template-of-the-week.yml`:
- Runs every Monday 9am
- Executes the script
- Opens a PR titled "Template of the Week: <name>"
- Adds a PR comment with the draft preview
- Founder reviews, rewrites, merges, and publishes

**Playbook** `docs/content/totw-playbook.md`:
- Cadence rules: one per week, skip if no good candidate, no catchup posts
- Voice rules: first person, concrete, no adjectives
- Publishing checklist: blog → X → Show HN if exceptional
- When to kill this series: if 3 consecutive posts get <100 views, revisit

**Files you may touch:**
- `scripts/template-of-the-week.ts`
- `apps/web/src/lib/blog-bodies/totw/**`
- `.github/workflows/template-of-the-week.yml`
- `docs/content/totw-playbook.md`

**Files you MUST NOT touch:**
- Registry source files
- Existing blog posts

**External services touched:**
- PostHog (read), Anthropic (draft), GitHub (PR)

### Implementation Steps
1. Write the scoring and selection logic.
2. Write the Claude draft prompt with founder-voice instructions.
3. Build the script with idempotent history tracking.
4. Write the GitHub Action.
5. Run the script manually once. Verify the draft quality.
6. Write the playbook.
7. Test by creating a dummy PR.
8. Run {{AUDIT_CHAIN_TEMPLATE}}.

### Definition of Done
- [ ] Script picks a candidate based on real scoring
- [ ] Draft quality passes content rules (spot check)
- [ ] PR opens with preview
- [ ] Playbook documents cadence, voice, kill conditions
- [ ] History file prevents duplicates
- [ ] `pnpm -w typecheck` passes
- [ ] {{AUDIT_CHAIN_TEMPLATE}} all three parts PASS
- [ ] Commit created

### Audit Chain
Execute {{AUDIT_CHAIN_TEMPLATE}}.

### Rollback Instructions
Disable the workflow via GitHub UI. Delete script and playbook.

### Commit Message Template
```
content: Template of the Week automation

Weekly pipeline scores candidates, drafts 300-500 word post
with Claude, opens PR for founder rewrite and publish.

Refs: P5.4
Audits: spec-diff PASS, hostile PASS, tests PASS
```

---

## P5.5 — Next 90-day plan draft

**Phase:** 5
**Depends on:** P5.2, P5.3
**Blocks:** P5.6
**Estimated effort:** 8 hours, ~$10
**Risk level:** High
**Rollback complexity:** Trivial

### Context
The current 90-day master plan ends with Phase 5. The next plan must be grounded in Phase 4-5 data, not founder intuition. This prompt produces a draft using the same master plan format as the current one, filled with real numbers and the kill criteria / customer insight findings. The draft exists to structure the founder's thinking; the founder rewrites sections that require strategic judgment.

**Relevant file paths (absolute):**
- `/Users/lex/settlegrid/docs/plans/next-90-day-plan.md` (new)
- `/Users/lex/settlegrid/docs/plans/current-90-day-plan.md` (assume exists; read for format)

**Relevant existing code to read first:**
- `docs/plans/current-90-day-plan.md` — exact format to match
- `docs/memos/kill-criteria-evaluation.md` (from P5.2)
- `docs/memos/customer-insights-v1.md` (from P5.3)
- `docs/memos/funnel-analysis-day60.md` (from P5.1)

**Prerequisites to verify:**
- [ ] P5.2 PASS (kill criteria decision made)
- [ ] P5.3 PASS (customer insights synthesized)
- [ ] ADR-005 signed

### Specification

Plan structure matches current plan: 5 phases over 12 weeks, each phase with goals, exit criteria, prompts count estimate.

**Section 1: Recap.** 1 paragraph summarizing what the last 90 days did and what the kill criteria showed. Honest.

**Section 2: North star.** The metric the next 90 days optimize for. Must be a single number. Example: "$1,000 MRR" or "50 paying users" or "1 million CLI invocations." Not a vague goal.

**Section 3: The bet.** 1 paragraph on what the next 90 days assume is true. If this assumption is wrong, the plan fails. Naming it is mandatory.

**Section 4: Phase breakdown.**
- **Phase 1 (Weeks 1-2):** Foundation — what infrastructure is needed for the bet
- **Phase 2 (Weeks 3-4):** Build — the main thing being built
- **Phase 3 (Weeks 5-6):** Distribute — how the thing reaches users
- **Phase 4 (Weeks 7-10):** Convert — turning users into revenue
- **Phase 5 (Weeks 11-12):** Measure — the next kill-criteria evaluation

Each phase has: goal (2 sentences), exit criteria (5 bullets), estimated prompts (count), risk (1-5).

**Section 5: Kill criteria for the next 90 days.** 6 criteria with numeric targets. These must be harder than the current kill criteria if the current ones passed. If they didn't pass, the next criteria must target the specific failure modes.

**Section 6: Explicit tradeoffs.** What the plan is NOT doing. Example: "Not building Cursor extension. Not building enterprise features. Not hiring." Tradeoffs are as important as the plan.

**Section 7: Open questions.** Things the founder doesn't know that the plan depends on. The first 2 weeks must answer them or the plan fails.

**Voice:** Honest, specific, no hedge words. "We will" not "we hope to." If the founder genuinely doesn't know, say so.

The draft leaves sections 2, 3, 5, 7 as TODOs — these require founder strategic judgment. Sections 1, 4, 6 can be scaffolded from Phase 5 data.

**Files you may touch:**
- `docs/plans/next-90-day-plan.md`

**Files you MUST NOT touch:**
- Current 90-day plan (read-only reference)

**External services touched:**
- None

### Implementation Steps
1. Read current 90-day plan. Internalize the format.
2. Read kill criteria memo, customer insights, funnel memo.
3. Draft section 1 recap from actual data.
4. Scaffold section 4 phase breakdown based on the kill criteria decision: if continue, the phases build on SettleGrid; if pivot, the phases test the new bet.
5. Scaffold section 6 tradeoffs from customer insights (what users didn't ask for).
6. Leave sections 2, 3, 5, 7 with TODO markers and specific questions for the founder.
7. Content quality checks.
8. Run {{AUDIT_CHAIN_TEMPLATE}}.

### Definition of Done
- [ ] Plan matches current plan format
- [ ] Sections 1, 4, 6 scaffolded with real data
- [ ] Sections 2, 3, 5, 7 marked TODO for founder
- [ ] Explicit tradeoffs listed
- [ ] Open questions listed
- [ ] {{AUDIT_CHAIN_TEMPLATE}} all three parts PASS
- [ ] Commit created

### Audit Chain
Execute {{AUDIT_CHAIN_TEMPLATE}}. Content checks + plan coherence check.

### Rollback Instructions
Docs-only. Delete if superseded.

### Commit Message Template
```
plan: next 90-day plan draft

Scaffolded from Phase 5 data. Sections 2, 3, 5, 7 marked TODO
for founder strategic judgment.

Refs: P5.5
Audits: spec-diff PASS, hostile PASS, content PASS
```

---

## P5.6 — Phase 5 + 90-day retrospective (CONTENT)

**Phase:** 5
**Depends on:** P5.1, P5.2, P5.3, P5.4, P5.5
**Blocks:** nothing (end of plan)
**Estimated effort:** 5 hours, ~$5
**Risk level:** Low
**Rollback complexity:** Trivial

### Context
Every 90 days should end with a retrospective that captures what worked, what didn't, and specific lessons. This retrospective is also the transition document to the next 90-day plan. It's written last so all Phase 5 outputs are available as evidence.

**Relevant file paths (absolute):**
- `/Users/lex/settlegrid/docs/retrospectives/90-day-retrospective.md` (new)

**Relevant existing code to read first:**
- All Phase 4 and Phase 5 memos, ADRs, commit history
- `docs/plans/next-90-day-plan.md` (from P5.5)

**Prerequisites to verify:**
- [ ] P5.1, P5.2, P5.3, P5.4, P5.5 all PASS

### Specification

**Retrospective structure** at `docs/retrospectives/90-day-retrospective.md`:

**Header:** Period, phases completed, total prompts executed, total hours.

**Section 1: The numbers.** Single table:
- Templates shipped
- CLI installs
- Distinct users
- External PRs
- Gallery→CLI conversion
- MRR (if any)
- Customer interviews conducted
- Prompts completed
- Founder hours worked
- Honest sanity score at end

**Section 2: What worked.** 3-5 bullets with specifics. Not "the team worked hard" — "the shadow directory hit 40% of all traffic in week 9 despite zero marketing."

**Section 3: What didn't work.** 3-5 bullets, equally specific. Not "marketing was hard" — "the X thread got 2,000 impressions and 0 signups, which means Twitter is not our channel for this audience."

**Section 4: What surprised me.** Things the founder didn't predict. These are the most valuable lessons.

**Section 5: What I'd do differently.** Specific process changes, not platitudes. Example: "I would have started PostHog instrumentation in Phase 1 instead of Phase 4, because launching without it meant the first 6 weeks had no measurement."

**Section 6: Thanks.** Names (or handles) of people who helped. Non-negotiable — acknowledge who showed up.

**Section 7: Handoff.** One paragraph explaining what state the next 90 days starts in, and what the founder's headspace is entering it.

**Voice rules:**
- First person throughout
- Specific numbers in every claim
- No passive voice on failures ("the post didn't land" → "I wrote a bad post")
- No hedging on wins ("it might have helped" → "it helped")
- Hold the doc for 48 hours after first draft, then re-read and cut hedging

**Files you may touch:**
- `docs/retrospectives/90-day-retrospective.md`

**Files you MUST NOT touch:**
- Any other Phase 5 outputs (retrospective is a summary, not a revision)

**External services touched:**
- None

### Implementation Steps
1. Re-read every Phase 4-5 memo, ADR, and retrospective artifact.
2. Pull the numbers for section 1.
3. Write section 2 "what worked" with specifics.
4. Write section 3 "what didn't work" equally specifically, owning failures.
5. Write section 4 "what surprised me" — genuine surprises only.
6. Write section 5 "what I'd do differently" as specific process changes.
7. Write section 6 thanks.
8. Write section 7 handoff.
9. Hold 48 hours. Re-read. Cut hedging.
10. Content quality checks.
11. Run {{AUDIT_CHAIN_TEMPLATE}}.

### Definition of Done
- [ ] All 7 sections populated
- [ ] Numbers in section 1 match source memos
- [ ] Specifics in every bullet
- [ ] No passive voice on failures
- [ ] Held ≥48h before finalizing
- [ ] Thanks section non-empty
- [ ] Handoff paragraph written
- [ ] {{AUDIT_CHAIN_TEMPLATE}} all three parts PASS
- [ ] Commit created

### Audit Chain
Execute {{AUDIT_CHAIN_TEMPLATE}}. Content checks + hedge-word scan.

### Rollback Instructions
Retrospectives are historical. Never delete; supersede with a follow-up if needed.

### Commit Message Template
```
retro: 90-day retrospective (Weeks 1-12)

Full retrospective across all 5 phases with numbers, wins,
failures, surprises, and handoff to next 90-day plan.

Refs: P5.6
Audits: spec-diff PASS, hostile PASS, content PASS
```

---

**End of Phase 4 + Phase 5 execution prompts. 16 prompts total (10 P4 + 6 P5). Ready for sequential execution against the audit chain.**
