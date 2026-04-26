# cursor.directory submission packet

Packet for the [cursor.directory](https://cursor.directory) submission of
the SettleGrid **MCP Monetization** rule. Distinct from the rest of
`scripts/directory-submissions/packets/` because cursor.directory's
submission has a discrete asset (the screenshot) and the submitted
artifact (the rule body) is itself a file the founder updates over time
— a single `cursor.directory.md` packet wouldn't capture both cleanly.

## Files

| File | Purpose |
|------|---------|
| `submission.md` | Step-by-step submission instructions + Open Plugins manifest format + plugin-repo layout the founder needs before submitting. |
| `mdc-rule.md`   | The actual rule body. The founder copies its full contents (frontmatter + body) into a sibling plugin repo at `rules/settlegrid-mcp-monetization.mdc` (extension changes from `.md` to `.mdc`); cursor.directory's auto-detector reads it from there. |
| `screenshot.png` | One Cursor-session screenshot showing the rule firing on an MCP server file. **Founder captures manually** — see `submission.md` § "Screenshot capture". cursor.directory's auto-detector does not currently consume a screenshot; capture is for launch announcements. The committed file is a 1×1 placeholder. |
| `README.md`     | This file. Submission tracker + hostile-review checklist + cross-links. |

## Submission tracker

| Field | Value |
|-------|-------|
| Directory          | [cursor.directory](https://cursor.directory) |
| Submission entry   | https://cursor.directory/plugins/new |
| Submission type    | `form` (web only — paste GitHub repo URL; auto-detect via Open Plugins spec) |
| Verification       | `verified` (against `pontusab/cursor.directory` repo, 2026-04-26) |
| Status             | `not-sent` |
| Sent date          | — |
| Reviewer           | — |
| Result URL         | — |
| Plugin slug        | `settlegrid-mcp-monetization` |
| Plugin-repo path   | _to be created — see `submission.md` § "Two ways to ship that"_ |
| Last packet update | 2026-04-26 |

### Status values

- `not-sent` — Packet ready, founder has not yet filed.
- `sent` — Submitted; awaiting cursor.directory maintainer review.
- `accepted` — Listed publicly; record the resulting URL above.
- `rejected` — Declined; record the reason in "Notes" below.
- `withdrawn` — Founder pulled the submission post-filing.

## Hostile-review checklist

Before submitting, founder MUST confirm each item below. The cursor.directory
maintainers reject rules that read as marketing copy or fire on
non-applicable files.

- [ ] **Trigger specificity**: `mdc-rule.md`'s "Trigger heuristics"
      section names *files that import `@modelcontextprotocol/sdk` or
      `fastmcp` or call `server.tool` / `setRequestHandler`*. Generic
      filename or extension globs alone are too loose.
- [ ] **Negative test**: Open a non-MCP TypeScript file (e.g. a React
      component, a Next.js API route that isn't an MCP server) in
      Cursor with the rule installed and confirm it does NOT fire /
      suggest billing.
- [ ] **Positive test**: Open a real MCP server file in Cursor with
      this rule installed — e.g. one of the quickstarts at
      [`modelcontextprotocol/servers`](https://github.com/modelcontextprotocol/servers)
      or any user-owned MCP server that imports `@modelcontextprotocol/sdk`
      or `fastmcp`. (The SettleGrid repo's `examples/kernel-demo` is a
      Hono REST kernel demo — NOT an MCP server — so the rule won't
      fire on it; don't use it as the positive-test fixture.) Confirm
      the rule fires and the suggested edits actually apply:
      `@settlegrid/mcp` imports compile, `sg.wrap` typechecks, and the
      verification commands in the canonical playbook
      (`packages/settlegrid-skill/cursor/.cursorrules` § "Step-by-step
      Playbook" steps 10-11) return a billed call.
- [ ] **Anti-pattern coverage**: Rule explicitly says "do NOT hardcode
      the API key", "do NOT wrap non-MCP files", "do NOT set
      `defaultCostCents: 0`". These are the failure modes most likely
      to slip past a quick review.
- [ ] **Source-of-truth link**: Rule's "Source of truth" section
      references `packages/settlegrid-skill/cursor/.cursorrules` so
      cursor.directory readers can find the canonical playbook for
      framework-specific examples (Express, Next.js, fastmcp streaming).
- [ ] **Screenshot honesty**: `screenshot.png` shows Cursor *actually
      applying the rule*, not a marketing splash. Captured on a real
      MCP file; the chat panel visibly references `@settlegrid/mcp`
      install / init / wrap suggestions.
- [ ] **Pricing example sanity**: All example pricing in the rule uses
      a positive integer (≥ 1 cent). No 0c examples — that anti-pattern
      is explicitly called out and reviewers spot-check it.

## Cross-links

- Source of truth for the playbook (full preflight checks +
  framework-specific examples):
  [`packages/settlegrid-skill/cursor/.cursorrules`](../../../../packages/settlegrid-skill/cursor/.cursorrules)
- Parent packet tracker (cursor.directory is **not** in the
  auto-generated tracker — see "Why standalone" below):
  [`scripts/directory-submissions/packets/README.md`](../README.md)
- Phase-3 verifier check that gates this packet:
  `scripts/phase-3-verify.ts` § Check 25 (cursor.directory submission packet).

## Why standalone (and not a single `cursor.directory.md` file)

The other directories in `packets/` are PR / form submissions where the
*submitted artifact* is a paragraph of metadata. cursor.directory's
*submitted artifact* is the rule body itself — a multi-section markdown
document plus a screenshot. Keeping both in a directory:

- Lets the founder iterate on `mdc-rule.md` without rewriting the
  submission instructions.
- Makes the screenshot a tracked asset for launch announcements
  (cursor.directory's auto-detector does NOT currently consume a
  screenshot — see `submission.md` § "Screenshot capture" — but
  founder will want one regardless when posting the listing to
  Twitter / Show HN / Reddit).
- Matches the phase-3-verify check (`Check 25`) which expects
  `packets/cursor.directory/` (a directory) with ≥ 4 artifacts.

If cursor.directory ever changes its submission flow to "paste a
single string" (no screenshot, no separate rule file), this packet
should collapse to `cursor.directory.md` matching the other directories.

## Notes & outcomes

_(Add per-attempt notes here as submissions move through the lifecycle.)_

- **2026-04-26**: Packet scaffolded. `screenshot.png` is a 1×1
  placeholder pending founder capture. Submission status: `not-sent`.
- **2026-04-26 (P3.13 R3 hostile review)**: `mdc-rule.md` originally
  said the free tier was "1,000 free invocations per month" — copied
  from the canonical playbook at
  `packages/settlegrid-skill/cursor/.cursorrules` (line ≈122).
  The actual published free tier is **50,000 operations per month**
  (`apps/web/src/app/pricing/page.tsx`). The MDC rule in this packet
  was corrected to the published number; the canonical playbook still
  carries the stale claim and should be updated separately (out of
  scope for P3.13, which only edits this packet directory). When that
  fix lands, mirror the correction back into this packet.
- **2026-04-26 (P3.13 R3 hostile review)**: `mdc-rule.md` originally
  carried non-standard Cursor MDC frontmatter (`name`, `slug`,
  `author`, `source`, `homepage`, `tags`). Cursor's parser only
  consumes `description` / `globs` / `alwaysApply`; the doc metadata
  was moved into `submission.md` (paste-ready values), and the rule
  frontmatter trimmed to the canonical three keys plus an HTML
  comment explaining the relocation.
- **2026-04-26 (P3.13 deeper spec-diff)**: `submission.md` originally
  described a "paste-each-field" form at `cursor.directory/generate`
  with a "Path B — GitHub PR fallback" against `pontusab/cursor.directory`.
  Both were inaccurate. Verification via WebFetch on
  https://github.com/pontusab/cursor.directory and
  https://open-plugins.com/plugin-builders/specification (2026-04-26)
  confirmed: (1) the canonical submission entry is
  `cursor.directory/plugins/new`, (2) submission is by GitHub repo URL
  paste, not per-field form, (3) cursor.directory follows the Open
  Plugins spec — repos must contain `plugin.json` at root with
  `rules/*.mdc` files for auto-detection, (4) the README explicitly
  states "no pull requests needed for data" — Path B does not exist.
  `submission.md` was rewritten end-to-end to reflect the real flow:
  Open Plugins manifest format, plugin-repo layout, two shipping
  options (separate plugin repo vs. monorepo addition), and
  step-by-step submission. The `mdc-rule.md` content is unchanged but
  is now correctly described as becoming
  `rules/settlegrid-mcp-monetization.mdc` (extension `.mdc`, not `.md`)
  in the founder's plugin repo.
- **2026-04-26 (P3.13 second hostile review)**: five additional
  findings, all fixed.
    - **HF1 broken example refs.** `submission.md` § "Screenshot
      capture" and `README.md` Hostile-review checklist both
      pointed at `examples/mcp-quickstart` for the positive-test
      fixture; that path doesn't exist (verified via `ls`). The only
      `examples/` subdirectory is `examples/kernel-demo`, which is a
      Hono REST kernel demo — NOT an MCP server importing
      `@modelcontextprotocol/sdk`, so the rule wouldn't fire on it.
      Both references were updated to point at
      `modelcontextprotocol/servers` quickstarts instead, with an
      explicit note that `kernel-demo` is the wrong fixture.
    - **HF2 internal screenshot contradiction.** README § "Why
      standalone" claimed "cursor.directory's listing card requires
      one" — but README § "Files" + `submission.md` correctly note
      cursor.directory's auto-detector does NOT consume a
      screenshot. Aligned the "Why standalone" wording with the
      authoritative claim (auto-detector ignores it; we keep it for
      launch announcements).
    - **HF4 broken playbook step reference.** README hostile-review
      checklist's positive-test bullet referenced "step 10 of the
      playbook" — but `mdc-rule.md`'s playbook only has 7 steps
      (the canonical `.cursorrules` is the one with 12 steps,
      including step 10 "Test"). Reference re-pointed at
      `packages/settlegrid-skill/cursor/.cursorrules` § "Step-by-step
      Playbook" steps 10-11 (the verification commands) so the
      cross-link actually resolves.
    - **HF6 glob negation patterns.** `mdc-rule.md` frontmatter
      previously listed `!**/node_modules/**`, `!**/dist/**`,
      `!**/build/**`. Cursor's documented MDC parser doesn't specify
      negation support, so these may be silently ignored — at which
      point the rule would attempt to fire on every TS/JS file in
      `node_modules`. Cursor's built-in ignored-paths list already
      excludes those directories, so the negation patterns were
      redundant in the best case and silently broken in the worst.
      Trimmed to a single positive glob.
    - **HF7 fabricated trigger heuristic.** `mdc-rule.md` § "Trigger
      heuristics" listed "exports an object literal with a `tools`
      field whose values are functions (plain MCP-style
      registration)" — this isn't a documented MCP-server pattern
      and isn't in the canonical `.cursorrules` (verified via
      `grep`). It would have caused false positives on any TS file
      exporting `{ tools: { ... } }`. Removed; the remaining three
      heuristics (imports `@modelcontextprotocol/sdk`, imports
      `fastmcp`, calls `server.tool` / `addTool` / `mcpServer.tool`
      / `setRequestHandler`) are concrete and grounded in real
      MCP-server code.
