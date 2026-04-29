# ADR-004 — Cursor extension: build vs. skip

| Field | Value |
|---|---|
| Status | **Accepted** |
| Date | 2026-04-28 |
| Deciders | Lex (founder) |
| Supersedes | — |
| Superseded by | — |
| Related | `packages/settlegrid-skill/` (Phases P1-P3 — Skill as the primary AI-coding integration) |

## Context

Phases 1–3 shipped `@settlegrid/skill` — an Anthropic Skill (a SKILL.md
content artifact, no runtime code) that any LLM agent capable of reading
local skill files can load to walk a user through wrapping their MCP
server with `@settlegrid/mcp`. The package also ships a `.cursorrules`
variant under `cursor/` so Cursor IDE picks up the same playbook through
its native rule loader. Both are content-only; we do not maintain a
binary IDE plugin.

A native Cursor / Windsurf extension was scoped as "if time allows" in
the original Phase 4 plan. The argument for building it is reach — Cursor
has its own extension marketplace, and a discoverable extension would let
us claim the "search for SettleGrid in your IDE" surface that an agent
rule cannot. The argument against is that the Anthropic Skill already
covers Cursor (via the shipped `.cursorrules`), the marketplace
submission alone is 8 hours of friction, and the founder is solo with a
14-day launch window. P4.9 forces the decision so we don't drift.

## Prerequisites at decision time

Per the P4.9 spec, two prerequisites should be verified before this
decision is final:

| Prerequisite | Status today | Why |
|---|---|---|
| P4.1 PASS — 48h of PostHog data on Skill usage | **Unmet (structural)** | P4.1 telemetry instrumentation shipped, but no event data exists yet — `cli_install_started` and `scaffold_*` events fire post-launch; we are pre-launch. |
| Skill verifiably working in Cursor, Windsurf, Claude Code (manual test) | **Partial** | Static review of `cursor/.cursorrules` confirms byte-equivalence with `SKILL.md`. Manual GUI smoke (open Cursor, ask `@settlegrid monetize this` against a real MCP repo) is a founder task — not reproducible from inside the repo and not yet executed. |

Both prerequisites being unmet today does **not** invalidate the
decision: the rule's AND chain is dominated by criteria B and D, which
are structurally zero pre-launch. The decision holds even if the
prerequisites later resolve favorably — it is a soft no, not a
hard no, and the tripwire converts the prerequisite resolution into a
revisit trigger.

## Decision criteria

| ID | Criterion | Source | Threshold |
|---|---|---|---|
| A | The Skill works in Cursor via `.cursorrules` without a dedicated extension | manual test (founder) | binary: working / broken |
| B | Skill telemetry shows ≥10 distinct users successfully invoking in Cursor in 48h | PostHog query (event `cli_install_started` or `scaffold_success` with `os` / user-agent indicating Cursor) | ≥10 |
| C | Founder has ≥14 free hours in Week 7-8 after Phase 4 mandatory work | calendar review (founder) | binary: yes / no |
| D | Phase 4 customer interviews mention Cursor extension as a blocker | grep `docs/interviews/transcripts/*.md` for "cursor extension" | ≥2 mentions |

**Decision rule:** Build IF (A = working) AND (B ≥ 10) AND (C = yes) AND
(D ≥ 2). Skip otherwise.

## Measurements (2026-04-28, pre-launch)

| ID | Status | Value | Source |
|---|---|---|---|
| A | Working | The shipped `.cursorrules` at `packages/settlegrid-skill/cursor/.cursorrules` is a complete content-equivalent of `SKILL.md` (verified by file inspection — playbook steps + anti-patterns mirror SKILL.md). Manual GUI test pending; no failure signals on file. | static review |
| B | **Not measurable** | 0 | Launch hasn't happened (P4.10 is the gate). PostHog has zero `cli_install_started` events from any environment yet. |
| C | **Not measurable here** | unknown | Founder reviews calendar; not visible from inside the repo. |
| D | **Not measurable** | 0 | `docs/interviews/transcripts/` is empty (P4.8 just landed; first interview will follow first signup post-launch). |

The decision rule is an AND chain over four criteria. Three of the four
(B, D, and contingently C) are structurally zero or unknown today
because we are pre-launch and pre-interview. The rule therefore
cannot evaluate to "build" today; it evaluates to **skip**.

## Decision

**Skip.** No native Cursor / Windsurf extension this phase.

The Skill + `.cursorrules` combination is the supported integration for
all AI-coding surfaces (Claude Desktop, Claude Code, Cursor, Windsurf
through MCP). We will direct Cursor users to the existing
`.cursorrules` via the package README and a future landing-page line
item.

This is a **soft no.** It is not a judgement that an extension is
unnecessary — it is a judgement that we lack the signal to justify the
cost today. The tripwire below converts incoming evidence into a
concrete revisit trigger.

## Consequences

### Immediate (this card)

- `packages/settlegrid-skill/README.md` gets a top-level "Using with
  Cursor" section pointing to `cursor/.cursorrules` so the path is
  obvious to anyone landing on the package page from npm.
- No `P4.9a` follow-up card created (would only exist on the build path).

### Deferred (post-launch, scope-permitting)

- **Landing-page line item.** The spec calls for a snippet on the
  marketing site: "SettleGrid works in Cursor via the Anthropic Skill —
  here's how." This card's may-touch list does not include the landing
  page, so the change is deferred to a launch-week content card. Wording
  approved here for re-use:

  > **Already use Cursor?** SettleGrid ships a `.cursorrules` file with
  > the Skill. `cp node_modules/@settlegrid/skill/cursor/.cursorrules .`
  > and ask Cursor "@settlegrid monetize this". Same 12-step playbook
  > the Anthropic Skill runs.

- **Marketplace research.** As of this ADR, Cursor does not publish a
  public extension-submission flow comparable to VS Code's. Re-check
  before any future build path; the build estimate (6h to working,
  +8h marketplace) assumed marketplace work that may not exist.

## Tripwire — when to revisit

Re-open this ADR (file ADR-004a or supersede with ADR-005) **if any
of these fire:**

1. **Customer signal:** ≥20 customers mention "Cursor extension" as a
   blocker in interview transcripts (`docs/interviews/transcripts/*.md`).
   The original spec wrote this threshold as "≥20 customers"; with the
   first 10 interviews planned, this requires at least one full second
   batch + a clear pattern. If 10/10 of the first batch mention it,
   revisit early — consensus on a single point is itself the signal.
2. **Telemetry signal:** Skill invocations in Cursor environment exceed
   100/week sustained for 4 weeks AND scaffold-completion rate from
   that cohort is <50% of the Claude-Desktop cohort. That delta would
   indicate the rule-file path has higher friction than a packaged
   extension.

   **Caveat:** detecting "Cursor environment" from CLI telemetry is
   itself an open problem — the P4.1 `cli_install_started` payload
   captures `process.platform` (`darwin` / `linux` / `win32`), not the
   parent IDE. Cursor inherits VS Code's environment fingerprint
   (`TERM_PROGRAM=vscode`); a Cursor-only signal would require either
   (a) probing for `process.env.CURSOR_TRACE_ID` in the CLI scaffold
   step and adding it to the event payload, or (b) a server-side
   referrer header check on the docs/install path. This tripwire
   cannot fire until that detection is shipped — gate this revisit
   on solving the cohorting problem first.
3. **Calendar signal:** Phase 5 plan reaches a point where founder has
   ≥14 contiguous hours and no higher-priority work is queued. Build
   becomes opportunistic, not strategic.
4. **Cursor-side change:** Cursor publishes a marketplace with a
   one-command publish flow (today the route is unclear). Lowers the
   8-hour "submission friction" cost line dramatically.

## Verification queries (founder runs after launch)

These belong to the founder's launch-week ritual, not to this card. They
exist here so that the data path for re-evaluation is reproducible.

```sql
-- Criterion B (PostHog) — proxy via OVERALL Skill activity until we
-- ship a Cursor-specific cohort signal (see Tripwire #2 caveat).
-- A clean per-IDE breakdown requires adding a `parent_ide` field to
-- the cli_install_started payload first.
SELECT
  countIf(event = 'cli_install_started') AS total_cli_installs,
  countIf(event = 'scaffold_success')    AS total_scaffold_success,
  countIf(event = 'scaffold_failed')     AS total_scaffold_failed,
  uniq(distinct_id)                      AS distinct_users
FROM events
WHERE timestamp > now() - INTERVAL 48 HOUR
```

```bash
# Criterion D (grep transcripts) — `-E` for portable alternation
# (BSD grep on macOS does not support `\|` in BRE).
grep -riEl "cursor extension|cursor plugin|cursor add-on" docs/interviews/transcripts/
```

```bash
# Criterion A (manual smoke) — open Cursor against a throwaway project
# and confirm the rule loads + the playbook runs end-to-end.
mkdir -p /tmp/test-cursor-smoke
cp packages/settlegrid-skill/cursor/.cursorrules /tmp/test-cursor-smoke/
cd /tmp/test-cursor-smoke && cursor . &  # then ask: "@settlegrid monetize this"
```

## Why this ADR is not "Proposed"

ADR convention treats *Proposed* as "we're discussing this." That's the
wrong status here — this is a binary decision with a deterministic
default. Today, the data is structurally zero on B and D, so the rule
fires SKIP, period. Marking it *Accepted* makes the call concrete and
forces any future change to come through a new ADR (the rollback path
in the spec).
