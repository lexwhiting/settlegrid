# P4.2 — Launch blog post structural notes

This file documents the structural choices behind
`apps/web/src/lib/blog-bodies/settlegrid-templates-launch.md`
so the founder knows what's load-bearing before rewriting.

## Status

- **Draft:** `published: false` in `apps/web/src/lib/blog-posts.ts`
- **Slug:** `settlegrid-templates-launch`
- **Body:** `apps/web/src/lib/blog-bodies/settlegrid-templates-launch.md`
- **Word count:** 1,280 prose words (target: 1,200-1,800)
- **Route when published:** `https://settlegrid.ai/learn/blog/settlegrid-templates-launch`

While `published: false`, `BLOG_SLUGS` filters it out of
`generateStaticParams`, and `getBlogPostBySlug` returns
`undefined` for the slug — the route returns the same 404 a
truly missing slug would. There is no oracle that the draft
exists.

## Five gaps you must fill before flipping `published: true`

The body has a `<!-- FOUNDER REWRITE REQUIRED -->` block at
the top. Five `{{PLACEHOLDER}}` tokens are inline in the prose,
each with a sentence describing what to write there:

1. `{{ORIGIN}}` — Section 1 (Opening). Replace with the
   specific moment you realized MCP monetization was broken.
   The current text says "I shipped it eventually" — that's
   true but generic. The real story has a tool name, a date,
   a Slack thread, an invoice, or a screenshot. Without it
   the post reads like a product page, not a founder memo.
2. `{{CONFESSION}}` — Section 1 (Opening), inline near the
   end. One or two sentences on what you got wrong in the
   first version. A pricing model you tried, an architectural
   choice that didn't survive contact with real users, an
   assumption you held for three months too long. Something a
   stranger reading the post would respect you more for
   admitting. Without one, the post is too clean to be honest.
3. `{{COMPETITOR}}` — Section 2 ("No way for agents to
   discover paid MCPs"). The draft asserts a discovery gap.
   If a competitor solves it (Nevermined, MCPize, AgenticTrade,
   or someone else), name them and explain why theirs doesn't
   fit your case. If not, the sentence stands as-is. Be
   careful: claims you can't back will be the first thing HN
   commenters latch onto.
4. `{{METRICS}}` — Section 3 (template count) and Section 5
   (Cursor Skill telemetry). Pull on publish day:
   - `apps/web/public/registry.json` → `totalTemplates`
   - npm download count for `@settlegrid/cli`
   - PostHog `gallery_viewed` last 7 days
   - PostHog `scaffold_success` last 7 days
   - GitHub stars on the monorepo
   Replace placeholder numbers; don't ship round figures
   without a source.
5. `{{STAKE}}` — Section 6 (Closing). One line on why this
   matters to you specifically. Bootstrapper status, the
   runway, the day-job you'd go back to. Not a paragraph —
   one sentence. Without it the closing ask reads as a
   marketing CTA, not a personal one.

## Voice rules baked into the draft

These aren't decorative. Each one was chosen against the
spec's voice bar (`first-person singular, concrete numbers
only, no adjectives that can't be backed by a link, no
em-dash-heavy LLM cadence, no "platform" or "ecosystem"`).

- **First-person singular throughout.** "I" not "we." The
  voice degrades the moment you switch to "the team" or "our
  platform." If you change author attribution to a team voice
  later, you'll need to rewrite the post.
- **No "platform," "ecosystem," "scale," "unlock," or
  "leverage."** The draft doesn't contain any of these. Add
  them at your peril.
- **Em-dashes used sparingly.** ~5 across 1,354 prose words.
  HN commenters trained on LLM-detector scoring tools react
  to em-dash density before they react to anything else; an
  em-dash every 270 words reads as human cadence, an em-dash
  every 50 reads as Claude.
- **One bulleted list, deliberately placed.** Section 2 uses
  a 4-item bullet list because the spec explicitly says
  "Concrete list — pricing friction, no shared templates,
  no way to discover paid MCPs, no revenue split primitive,"
  and the 2-3-paragraph structural target rules out 4 bolded
  sub-paragraphs. Section 3 deliberately uses prose paragraphs
  — bullet lists in launch copy read as marketing collateral
  when overused, so we limit to one.
- **Every claim links to evidence or is removable.** The
  12,770/17,194/6,000 numbers link to the existing
  `mcp-billing-comparison-2026` post, which sources them.
  The pricing tier (50K free ops, 0% take rate) links to
  `/pricing`. The `{{COMPETITOR}}` placeholder is the
  template's escape valve — if you can't back the claim,
  delete the sentence.

## Section structure (what's load-bearing vs. decorative)

| Section | Spec target | Load-bearing |
|---|---|---|
| 1 — Opening (1 paragraph) | "specific moment you realized MCP monetization was broken" | YES — the founder voice anchor for the rest of the post |
| 2 — What's broken today (2-3 paragraphs) | concrete list of 4 holes | YES — sets up sections 3 + 5 |
| 3 — What SettleGrid Templates is (2 paragraphs) | gallery, CLI, Skill, shadow directory in plain language | YES — links the launch surfaces |
| 4 — Try it in 60 seconds (code block) | exact `npx` command + expected output | LOAD-BEARING but FLEXIBLE — see "Spec deviation" below |
| 5 — What's next (1 paragraph) | roadmap honesty | YES — the credibility multiplier |
| 6 — Closing (1 paragraph) | direct ask, email + X handle | YES — the conversion event |

## Spec deviation in Section 4

The P4.2 spec literal says:

> Exact `npx settlegrid scaffold` command with expected output.

There is no `settlegrid scaffold` subcommand in
`packages/settlegrid-cli`. The actual codemod for existing
repos is `npx settlegrid add` (defined in
`packages/settlegrid-cli/src/commands/add.ts`); a separate
package, `npx create-settlegrid-tool`, scaffolds new projects
from the templater.

Section 4 uses `npx settlegrid add github:owner/repo
--dry-run` as the single command per the spec's "Exact ...
command" wording. The expected-output block reproduces the
actual `add` command's stdout from `add.ts` (the `detection +
parsed options` and `transform summary` blocks are real, not
invented). Section 3 mentions `create-settlegrid-tool`
in prose for completeness, but it is not the "60-second" hook.

This is the same lesson Phase 3 hit at P3.13 ("spec text can
be wrong about package names — grep before using"). Flagged
here so you don't accidentally restore the broken `scaffold`
command during your rewrite.

## Author attribution

The draft uses `name: 'Lex Whiting'` and links to
`https://x.com/lexwhiting`. If your X handle is different,
update both the body's closing paragraph and the
`author.url` field in `blog-posts.ts`. The bio line is
intentionally bare — replace with whatever you want public
on a launch-day post.

## Publishing checklist

Before flipping `published: false → true`:

- [ ] All 5 gaps filled (`{{ORIGIN}}`, `{{CONFESSION}}`,
      `{{COMPETITOR}}`, `{{METRICS}}` x2, `{{STAKE}}`)
- [ ] FOUNDER REWRITE comment block deleted
- [ ] Word count still 1,200-1,800 after your rewrite
      (run `wc -w` on the body, subtract code-block content
      and headings — there's a Python snippet in the P4.2
      spec-diff round that does this)
- [ ] Every external link resolves (the existing internal
      links to `/learn/blog/mcp-billing-comparison-2026`
      and `/pricing` are stable; verify the X handle URL)
- [ ] Author name + bio match what you want on the live page
- [ ] `datePublished` updated to publish day
- [ ] `dateModified` matches `datePublished` on first publish
- [ ] tsc clean (no schema break from your edits)
- [ ] One read-out-loud pass — the lines you trip on are
      the ones to rewrite

## Rollback

`git revert` the commit. The post is gated by
`published: false` and the draft `BLOG_SLUGS` filter, so
nothing user-facing changes when you revert. The body file
and the `blog-posts.ts` entry can also be deleted by hand:

```bash
rm apps/web/src/lib/blog-bodies/settlegrid-templates-launch.md
# then remove the import + array entry in blog-posts.ts
```

There's no published URL to redirect, no email mention, no
external surface that points at this post yet. Rollback is
zero-impact.
