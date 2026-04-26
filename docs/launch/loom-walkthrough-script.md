<!--
  ============================================================
  FOUNDER RECORDING REQUIRED — DO NOT EDIT WITHOUT PRE-FLIGHT
  ============================================================

  The Loom walkthrough is the deeper companion to the
  60-second hero (demo-video-script.md). It lives at the
  end of the launch blog post and is linked from the Show
  HN first comment for "curious readers" who want technical
  depth.

  Pre-record decisions:

  1. PICK A REAL EXAMPLE
     The script uses `my-search-api` as the placeholder
     project name. Pick a real-feeling name that matches a
     plausible MCP tool you might actually ship — viewers
     read the name and decide whether the demo applies to
     them. Avoid generic names ("test-tool", "demo").

  2. INTENTIONALLY TRIGGER ONE ERROR
     Section 2 (CLI scaffold) script says to deliberately
     trigger one error and recover. Pick the failure mode
     in advance:
        a. Run `npx settlegrid add` against a non-MCP repo
           and show the "unknown-type" error + --force
           recovery.
        b. Misspell a template name on
           create-settlegrid-tool and show the prompt's
           validation.
     Either is fine; pick (a) — it shows confidence that
     the codemod fails closed instead of corrupting code.

  3. TIME EACH SECTION
     The 8-minute envelope is a soft target. Going to 9-10
     is fine if the content is dense. Going under 5 is a
     red flag — viewers expecting depth got a sales pitch.

  Voice rules: first-person singular. No banned words. The
  Loom is more conversational than the 60s hero — tangents
  are OK if they teach something, not OK if they sound like
  filler.
-->

# Loom Walkthrough — 5-8 Minute Deep Dive

## Total runtime target

8 minutes. Drift to 7 or 9 is acceptable. Under 5 means
not enough content; over 10 means it should be split into
two videos.

The walkthrough is a single unbroken Loom recording —
viewers come for the depth and don't expect production
polish. Pause-and-think moments are fine and make the
voice land more honestly than a tightly-edited cut.

---

## Section 1 — Hook: the problem in one sentence (0:00-0:30)

**On screen:** founder webcam in upper-right, settlegrid.ai
homepage in main view.

**Talk track (~70 words):**
"I built SettleGrid because adding per-call billing to an
MCP server takes about a week of Stripe Connect glue, and
I didn't want to spend that week again on every tool I
ship. There are over 12,000 public MCP servers
in the wild and fewer than 5% generate any revenue. This
walkthrough shows how SettleGrid wraps a tool with
metering and Stripe payouts in five minutes flat."

**Notes:** if viewers bounce here, they weren't going to
watch anyway. Don't try to hook with energy; hook with the
specific number ("a week," "5%," "five minutes"). Numbers
land harder than adjectives.

---

## Section 2 — Gallery tour, three templates, the registry (0:30-2:00)

**On screen:** browser at `https://settlegrid.ai/templates`,
scroll through the gallery.

**Talk track:**

1. **Open the gallery (0:30-0:50).** Land on the
   `/templates` page. Scroll once through the full grid.
   "These are pre-wired templates. Every one ships with
   `sg.wrap()` already on the handler, a Stripe Connect
   onboarding hook, and a deploy YAML for Vercel or
   Railway."

2. **Click a template from the data or research category
   (0:50-1:20).** Walk through the detail page: the hero,
   the per-call price, the deploy button, the source link,
   the standalone-value note ("works without SettleGrid").
   "I want to call out the standalone-value beat. Every
   template works without SettleGrid. You can rip the
   billing layer out in five lines and the tool still
   functions."

3. **Click a second template, ideally a different category
   (1:20-1:50).** Show the gallery's filtering across the
   six categories (ai, data, devtools, media, productivity,
   research). "The category filter narrows the list without
   scrolling. There are about a hundred templates today;
   I'm adding more weekly."

4. **Mention the registry briefly (1:50-2:00).** "The
   registry that drives this gallery is a JSON file in
   the repo — adding a template is a PR, not a CMS
   workflow. Drop a `template.json`, ship a tag, the
   gallery rebuilds."

**Notes:** Don't read every template name. Pick the 3 that
look the cleanest at 1080p and walk those.

---

## Section 3 — CLI scaffold end-to-end, with a deliberate error (2:00-4:00)

**On screen:** terminal at full screen, browser minimized.

**Talk track:**

1. **Run the codemod against a non-MCP public repo
   (2:00-2:30).** Pick a public repo that clones cleanly
   but isn't an MCP server (a tiny static-site repo of
   your own works fine). Run `npx settlegrid add
   github:<owner>/<not-an-mcp-repo>`. Show the error:
   clean message, "unknown repo type" with `--force`
   suggestion, exit code 1. "This is the codemod refusing
   to act on a repo it can't classify. Failing closed is
   the load-bearing behavior. The codemod never silently
   corrupts code."

2. **Run the codemod against a real MCP repo (2:30-3:20).**
   Use a pinned public repo prepared in advance: pin one
   to a known commit so the demo state is reproducible.
   Run `npx settlegrid add github:<owner>/<repo>
   --dry-run`. Walk the output: detection, transform
   summary, files that would change, deps that would be
   added.

3. **Drop --dry-run, apply the change (3:20-3:50).**
   IMPORTANT: the codemod modifies real files on disk.
   Run this against a throwaway directory or a fresh
   clone so the recording does not leave a dirty repo
   behind. Show the changed files: the wrapped handler,
   the SDK added to package.json, the env-vars-required
   output. "This is what would land in the repo. If you
   ran this with a GitHub token set, the next step would
   open a PR."

4. **Bonus: show the Anthropic Skill alternative
   (3:50-4:00).** Quick demo of the skill activating in
   Claude Code: ask "monetize this server" with `src/index.ts`
   open. The skill walks the same codemod from inside the
   editor.

**Notes:** keep terminal output legible — set `COLUMNS=120`
or wider before recording. Tiny terminal text is the #1
viewer complaint on infra walkthroughs.

---

## Section 4 — SDK code walkthrough, the wrap() line (4:00-5:30)

**On screen:** editor open on the wrapped file.

**Talk track:**

1. **Show the import (4:00-4:15).** `import { settlegrid }
   from '@settlegrid/mcp'`. "The SDK is a single import.
   Three exports matter: settlegrid.init, sg.wrap, and
   sg.validateKey."

2. **Show settlegrid.init (4:15-4:45).** Walk through the
   pricing config. "I can set defaultCostCents, override
   per-method, switch to per-token or per-byte models if
   the tool isn't a fixed-cost-per-call shape. Six pricing
   models supported; per-call is the default."

3. **Show sg.wrap (4:45-5:15).** Highlight the wrapped
   handler. "This is the entire integration. The wrap
   reads the API key from headers or MCP metadata,
   validates it against the SettleGrid API (cached
   locally for 5 minutes), checks the consumer balance,
   runs the handler, then meters the invocation
   asynchronously. If validation fails, the handler
   never runs."

4. **Show the runtime guarantees (5:15-5:30).** Quick
   mention: timing-safe key compare, fail-closed on
   network errors, idempotency via the invocation ID,
   bounded retries. "These are the things you'd build
   yourself if you wrote the integration from scratch.
   They're already in the SDK."

**Notes:** don't open every file. Stay on the entry file
the codemod modified. Tangents into the SDK internals
belong in a separate "internals" video, not this one.

---

## Section 5 — Stripe Connect payout view (5:30-7:00)

**On screen:** SettleGrid dashboard at
`/dashboard/payouts` (or wherever the payout view lives —
verify before recording).

**Talk track:**

1. **Open the dashboard (5:30-5:50).** Land on the
   payouts view. "This is what a publisher sees after a
   handful of paid calls. Earnings, take rate, payout
   schedule, Stripe Connect link status."

2. **Click into a single invocation (5:50-6:20).** Show
   the per-call detail: timestamp, consumer ID (hashed),
   method, cost, latency, Stripe transfer ID. "Every
   call has an audit trail. If a consumer disputes a
   charge, the chargeback event lands here with the
   original invocation linked."

3. **Show the take-rate breakdown (6:20-6:50).** "Free
   tier is 50,000 ops a month with 0% take rate on the
   first $1,000 of revenue. After that it climbs to 5%
   above $50,000. The whole pricing page is at
   settlegrid.ai/pricing."

4. **Show Stripe Connect onboarding briefly (6:50-7:00).**
   "Onboarding is Stripe Connect Express — Stripe
   handles KYC, dispute UX, and tax-form filing. I
   handle the publisher dashboard. The two responsibilities
   split cleanly."

**Notes:** if the dashboard has any visible UI bugs at
recording time, point them out in the moment. "Yes,
that widget renders weird, working on it" lands more
honestly than pretending the UI is finished. Don't
fabricate a bug that isn't there; if the dashboard looks
fine, just walk it.

---

## Section 6 — Shadow directory tour, claim flow (7:00-8:00)

**On screen:** browser at `https://settlegrid.ai/mcp` then
into a per-repo page.

**Talk track:**

1. **Show the index (7:00-7:20).** "These are public MCP
   servers I crawled and built per-repo pages for. The
   index is capped at a few thousand because the long tail
   wasn't worth the build time. If your server is here,
   the codemod command is pre-filled."

2. **Click a per-repo page (7:20-7:45).** Show the page
   structure: the header, the codemod command box, the
   monetization math, the source attribution. "If you
   maintain this repo, click claim and the page flips
   from noindex to indexed. If you don't maintain it,
   the codemod still runs against any GitHub URL, so the
   page is useful to anyone who'd fork."

3. **Show the claim flow (7:45-8:00).** Walk the click
   path. "Claim verifies repo ownership before flipping
   the page from noindex to indexed. The dispute path
   for false claims isn't built yet. That's an honest
   gap I'm shipping in the next milestone." If you know
   the exact verification mechanism (GitHub OAuth + repo
   write access, email-against-commits, etc.), describe
   that specifically; otherwise stay generic.

**Notes:** the shadow directory is the most controversial
surface of the launch. Don't soft-pedal it. "I crawled
public repos, here's the path to opt out, here's the path
to claim, here's where it's still rough" lands better
than a marketing tour.

---

## Section 7 — Ask: try it, break it, email me (8:00-end)

**On screen:** SettleGrid homepage with a clear CTA, or a
static "thanks for watching" card.

**Talk track:**
"That's the walkthrough. The launch is a list of things to
test, not a list of features. If you ship MCP servers,
fork a template and tell me which part of the codemod
broke. If you've shipped your own monetization for a tool
and SettleGrid wouldn't have helped, I want to hear that
more than anything else. Email me at founder@settlegrid.ai
or DM on X at @lexwhiting. Thanks for watching."

**Notes:** keep this section short. Long CTAs read as
desperate. The ask is "try it" not "buy it."

---

## Recording mechanics

The mechanics live in `recording-checklist.md`. Two specific
notes for this Loom that don't apply to the 60-second hero:

- **Webcam in upper-right.** Loom convention. Resists the
  "no face" temptation — viewers trust the speaker, not
  the screencast, and the sit-down style is what readers
  expect when they click through from HN's first comment.

- **Single take.** No cuts. Pause, breathe, restart a
  sentence — that's normal. A perfectly-edited Loom reads
  as marketing material; a single-take Loom reads as a
  founder who knows their thing.
