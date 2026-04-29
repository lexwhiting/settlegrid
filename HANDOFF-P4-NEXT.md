# Phase 4 — Handoff for Next Session

**As of:** 2026-04-26, end of Phase 3 implementation + cross-module integration audit.
**Working directory:** `/Users/lex/settlegrid/` (env probe flags it as non-git, but `git -C /Users/lex/settlegrid` works — it IS a regular repo).
**Branch:** `main`, **175 commits ahead of `origin/main`**. **Do not push** (per user's `feedback-push-policy.md` memory: pushes trigger Vercel builds and burn the monthly limit).

---

## Mission

Phase 4 is **Launch & Measure** (Weeks 7-8 of the SettleGrid Quantum Leap Master Plan). The goal is to execute a coordinated Show HN launch surfacing the CLI, Skill, gallery, shadow directory, and founder narrative simultaneously, backed by full funnel instrumentation and a launch-day war room. Convert launch attention into booked customer interviews and a measurable pipeline.

This is structurally **different from Phase 3**:
- Phase 3 was incremental engineering — small audit-chain cards each touching a narrow code surface.
- Phase 4 is **launch-coordinated** — fewer cards, more cross-cutting (instrumentation across product surfaces), and a meaningful chunk is **CONTENT generation** (drafts the founder rewrites in their voice), not code.

The audit-chain protocol still applies for **engineering** prompts (P4.1, P4.6, P4.7, P4.8, P4.10), but **CONTENT prompts (P4.2–P4.5)** produce drafts only — the founder MUST rewrite before publishing externally. AI-written launch copy is the fastest way to torpedo a Show HN launch (HN commenters detect marketing-speak in the first sentence).

**Voice bar for all external content** (per the Phase 4 plan, page 1): first-person singular, concrete numbers only (no "scale your MCP revenue"), no adjectives that can't be backed by a link, no em-dash-heavy cadence that screams LLM, no bullet lists in Show HN body copy.

---

## Phase 4 prompt sequence (10 cards)

| ID | Topic | Type | Effort |
|----|-------|------|--------|
| P4.1 | PostHog funnel instrumentation across gallery, CLI, SDK, shadow directory | Engineering | 8h |
| P4.2 | Launch blog post draft | **CONTENT** (founder rewrite) | 4h |
| P4.3 | Show HN post + comments response kit | **CONTENT** | 4h |
| P4.4 | 60-second demo video script + Loom storyboard | **CONTENT** | 6h |
| P4.5 | X/Twitter launch thread draft | **CONTENT** | 2h |
| P4.6 | Second-batch cold outreach generator (100 personalized emails) | Engineering + content | 8h |
| P4.7 | Launch-day war room prep + rapid-response kit | Engineering | 6h |
| P4.8 | Customer interview template + scheduling pipeline | Engineering | 4h |
| P4.9 | Cursor extension polish vs. deprioritize decision (ADR) | Decision memo | 3h |
| P4.10 | Phase 4 audit gate (exit criteria verification) | Verifier | 4h |

**Total estimate:** ~68-82 hours, ~$180-240 (Anthropic API + PostHog seat + email sends + video hosting).

**Authoritative source:** `/Users/lex/settlegrid/private/master-plan/phase-4-5-launch-measure.md` (2753 lines) — the private version has full per-prompt detail. The public version at `/Users/lex/settlegrid/docs/master-plan/phase-4-5-launch-measure.md` (1747 lines) is the trimmed redistribution.

A `.docx` of the private version was generated at `/Users/lex/settlegrid/private/master-plan/phase-4-5-launch-measure.docx` for the founder to read offline.

---

## The audit-chain protocol (unchanged from Phase 3)

For engineering prompts (P4.1, P4.6, P4.7, P4.8, P4.10), the user runs **4 verbatim rounds**:

### Round 1 — Scaffold (the card prompt itself)
Build the spec-literal implementation. **Apply hostile-lens pre-checks at scaffold time** (timing-safe compare, fail-closed on error, no info leak in 4xx, frozen audit data, idempotent migrations). Don't leave hostile findings for round 3 to catch.

### Round 2 — Spec-diff
> "Read the original spec/prompt for this phase. Diff every requirement against what was built. List anything missing, partially implemented, or deviating from spec. Then fix each item."

Output a numbered diff (D1, D2, …) with `file:line` references, then close each.

### Round 3 — Hostile
> "Review all code generated in this phase as a hostile code reviewer. Find: incorrect behavior, unhandled edge cases, security issues, broken error paths, data that doesn't round-trip correctly, APIs that return wrong status codes. Fix each finding."

Output numbered findings (H1, H2, …). Categorize as scaffold-discipline failures vs. acceptable boundaries. Fix scaffold-discipline ones; justify why the rest are acceptable.

### Round 4 — Tests
> "Run all tests. Fix failures. Add tests for any code path that isn't covered. Verify the build. Zero errors."

This round is for **coverage, not functional gaps** — functional gaps mean rounds 1–3 missed something.

For **content prompts** (P4.2–P4.5), the audit chain folds to: produce the draft → spec-diff against the prompt → hostile review (does it sound like marketing copy? would a HN commenter call it out?) → ship to founder for rewrite.

---

## Phase 3 closing state — IMPORTANT context for Phase 4

### Verifier result: 22 PASS / 3 DEFER / 2 FAIL (of 27 total)

**Phase 4 is NOT blocked on the 2 FAILs** — they are founder-manual operational checks, not implementation gaps:

| ID | Status | Notes |
|----|--------|-------|
| **C1** | FAIL | ≥75 new templates in `open-source-servers/` — only 72. Founder runs the templater to close. Out of scope for Phase 4 cards. |
| **C5** | FAIL | ≥5 directory submissions sent — 0 logged. Founder files via the packets in `scripts/directory-submissions/packets/`. Out of scope. |

**3 DEFERs** — also not Phase 4 blockers:
- C4 — WG outreach replies logged (founder-manual)
- C7 — push origin/main to enable weekly template CI
- C27 — settlement-layer expansion audit chains (Phase-3 follow-on; not Phase 4 scope)

### Phase 3 implementation — fully complete + verified

| Test surface | Count |
|----|----|
| sdk-python | 376 |
| sdk-python-langchain | 30 |
| sdk-python-llamaindex | 17 |
| sdk-python-crewai | 17 |
| sdk-python-pydantic-ai | 15 |
| sdk-python-dspy | 15 |
| sdk-python-smolagents | 15 |
| **Python total** | **485** |
| packages/mcp | 1778 (+ 1 skip) |
| apps/web | 3336 |
| scripts | 290 |
| **TS total** | **5404** |
| **Grand total** | **5889 tests** |

All `tsc --noEmit` clean (mcp + apps/web). All Python `mypy` clean (7 packages). All Python `ruff` clean (7 packages). `tsup` build clean.

---

## CRITICAL — Cross-module bug found + fixed in this session

The cross-module integration audit at the end of Phase 3 surfaced a **production-critical handoff break** between the Python SDK and the TS meter endpoint. **You must know about this** because Phase 4 includes funnel instrumentation (P4.1) that may add new event-emitting code from Python — same risk class.

**The bug:** `apps/web/src/app/api/sdk/meter/route.ts` defines a Zod schema requiring `consumerId`, `toolId`, `keyId` (all UUIDs). The Python SDK's `client.py:meter()` was posting only `{apiKey, toolSlug, method, costCents}` — every metering call from all 6 Python adapters (langchain, llamaindex, crewai, pydantic-ai, dspy, smolagents) returned 400 in production. The TS SDK works because `middleware.ts:meter()` posts the right shape. The Python `wrap.py` already validated the key (got the UUIDs) but discarded them.

**The fix** (commits `85dd401d`, `ad8fc03d`):
- `packages/sdk-python/settlegrid/client.py` — `meter()` and `meter_async()` now require `consumer_id`/`tool_id`/`key_id` as kwargs and forward them as camelCase wire keys.
- `packages/sdk-python/settlegrid/_types.py` — `MeterRequest` model updated; drops `api_key` (Zod doesn't accept it), adds the three UUIDs; `extra="forbid"` pins the wire shape.
- `packages/sdk-python/settlegrid/wrap.py` — `Invocation` carries the three UUIDs from `__enter__` to `__exit__`; both decorator and context-manager paths thread validation IDs to the meter call.
- `packages/sdk-python/tests/test_client.py::test_wire_body_contains_consumer_tool_key_ids` — captures the actual POST body via respx and asserts the four required wire keys; would have caught this at SDK release time.

**Why this matters for Phase 4:** P4.1 (PostHog funnel) and P4.6 (cold outreach generator) may add new client→server endpoints. Apply the same wire-shape integration test pattern (capture request body via respx/MSW; assert key set) at scaffold time, not at audit-chain round 3.

---

## File map worth knowing for Phase 4

### PostHog funnel instrumentation (P4.1)
- **Per-prompt detail:** `private/master-plan/phase-4-5-launch-measure.md` § "P4.1" (starts ~line 68).
- **Eight canonical events** to capture: gallery view → CLI install → SDK import → tool wrapped → first metered call → shadow directory click → docs page view → signup. Names + payloads defined in the prompt.
- **Server-side capture for CLI** — CLI is a Node process (not browser). POST to a PostHog capture endpoint we proxy through our own API to avoid leaking the PostHog key in published npm artifacts.
- **`distinct_id` resolution strategy** — shared across surfaces; founder's call on whether to use installation UUID, account ID, or something else.
- Likely files to touch:
  - `apps/web/src/lib/analytics/` (new) — server-side PostHog client + proxy route.
  - `apps/web/src/app/api/posthog/` (new) — capture proxy.
  - `packages/settlegrid-cli/` — CLI events (server-side capture).
  - `apps/web/src/app/(marketing)/page.tsx`, `apps/web/src/app/gallery/page.tsx`, `apps/web/src/app/directory/page.tsx` — client-side event emitters.

### Launch surfaces (P4.2–P4.5)
- **Show HN, blog, video, X thread** — all CONTENT, draft files in `docs/launch/` or `private/launch/`.
- Read the prompts before scaffolding — each has voice/structural constraints (no em-dashes, first-person singular, etc.).

### Cold outreach (P4.6)
- 100 personalized emails. Generator script + email content.
- Likely lives in `scripts/launch/` or `private/launch/`.
- Will need the prior outreach context (P3.4 / P3.5 founder-sent batches — check `data/wg-outreach/`).

### War room (P4.7)
- Runbook + rapid-response kit. Pre-written replies for likely HN comment threads, Twitter pile-on patterns, support ticket spike.
- Likely lives in `docs/runbooks/launch-war-room.md`.

### Customer interview pipeline (P4.8)
- Template + Cal.com (or similar) scheduling integration.
- Likely lives in `apps/web/src/app/customer-interview/` or `docs/templates/`.

### Phase 4 audit gate (P4.10)
- **New gate script.** Pattern: copy `scripts/phase-3-verify.ts` → `scripts/phase-4-verify.ts`, replace criteria with Phase 4 exit checks (PostHog events live, ≥48h data, 5 launch surfaces published, 100 emails sent, 10 interview slots booked, etc.).
- The criteria list comes from the Phase 4 plan's "End of Phase 4" expected artifacts.

---

## Hostile-lens invariants (apply at scaffold, same as Phase 3)
- Timing-safe compare on any secret comparison.
- Fail-closed on internal errors (return deny/error, never allow on exception).
- No information leak in 4xx error responses.
- Frozen audit data (`Object.freeze` on every readonly array returned to callers).
- Idempotent SQL migrations.
- Validate at boundaries (Zod on POST routes, Content-Type on webhooks).
- Bounded I/O (`.take(N)` on Convex/DB collects, capped arrays in JSONB).
- **NEW for Phase 4:** Wire-shape integration tests on every new client→server endpoint (capture request body, assert key set). The Python SDK meter bug was invisible to mock-only tests.

---

## Verification commands (run from `/Users/lex/settlegrid/`)

```bash
# TS type checks
(cd packages/mcp && npx tsc --noEmit)
(cd apps/web && npx tsc --noEmit)

# Python type + lint (per-package; module names are settlegrid_<framework>)
(cd packages/sdk-python && .venv/bin/python -m mypy settlegrid && .venv/bin/python -m ruff check settlegrid tests)
(cd packages/sdk-python-langchain && .venv/bin/python -m mypy settlegrid_langchain && .venv/bin/python -m ruff check settlegrid_langchain)
# (repeat per adapter — see Phase 3 verifier for the full set)

# Builds
(cd packages/mcp && npm run build)
npx turbo build --filter=@settlegrid/mcp --filter=@settlegrid/web

# Tests
(cd packages/mcp && npm test)
(cd apps/web && npm test -- --run)
npx vitest run scripts/directory-submissions/__tests__/ scripts/__tests__/ scripts/phase-3-verify.test.ts
(cd packages/sdk-python && .venv/bin/python -m pytest)
# (repeat .venv/bin/python -m pytest for each adapter — see Phase 3 verifier)

# Phase 3 gate (still useful for regression detection)
npx tsx scripts/phase-3-verify.ts

# Phase 4 gate (to be authored in P4.10)
npx tsx scripts/phase-4-verify.ts
```

---

## Recent commit history (last 12 — all Phase 3 work)

```
ad8fc03d  style(sdk-python): rename test method to satisfy ruff N802
85dd401d  fix(sdk-python): meter() must thread consumerId/toolId/keyId
0db00376  test(P3.13): pin hostile-review findings on the cursor.directory packet
7b310cd3  fix(P3.13): hostile review — broken refs, glob negation, fabricated heuristic
24893aa9  fix(P3.13): spec-diff — submission.md described wrong cursor.directory flow
bfd8e8a6  feat(directory): cursor.directory submission packet
cd2c0138  test(P3.PROT1): close coverage gaps to ~100% on mastercard-vi adapter
994f813c  fix(P3.PROT1): hostile-review findings — breadcrumb 404, dead export, lying comment, toJSON shape divergence
ef5c005f  fix(adapter): P3.PROT1 spec-diff — expose buildChallenge() no-arg form returning 503
46865e48  feat(adapter): Mastercard Verifiable Intent detection stub
15694f8f  fix(sdk-python-dspy): P3.PYTHON5 spec-diff — pin canonical PyPI name `dspy` (not `dspy-ai`)
99b9ee25  feat(sdk-python): dspy + smolagents adapter packages
```

Commit message convention:
- `feat(<scope>): P<phase>.<card> <round> — <one-line summary>` for scaffold/spec-diff/hostile.
- `fix(<scope>): P<phase>.<card> tests — fill coverage gaps + regenerate gate log` for tests round.
- Body: 2–3 lines with verification numbers (test counts, coverage delta, gate state).
- Always include `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`.

---

## Lessons learned across Phase 3 (don't relearn these)

1. **Cross-module wire-shape drift is invisible to mock-only tests.** The Python SDK meter bug shipped because every test mocked the endpoint without inspecting the captured POST body. Fix: at every cross-module seam, capture the actual request body and assert the key set against the receiving Zod schema. Pattern is `respx.calls.last.request.content` for Python, `vi.fn()` capture for TS.
2. **Spec text can be wrong about package names.** P3.13 prompt referenced `@settlegrid/sdk` — the actual package is `@settlegrid/mcp`. Always grep `package.json` to verify before using a name from a spec.
3. **Documentation packets need integrity tests** (`scripts/directory-submissions/__tests__/cursor-directory-packet.test.ts`) — file-path references, internal contradictions, fabricated heuristics will all drift without a test pinning them.
4. **Cursor MDC frontmatter is `description`/`globs`/`alwaysApply` only** — submission metadata (name, slug, author, tags) lives in the cursor.directory submission form, not in the rule frontmatter.
5. **Cursor.directory uses Open Plugins spec** — submission is a single GitHub repo URL paste at `cursor.directory/plugins/new`; the repo must contain `plugin.json` + `rules/*.mdc`. There is NO PR-based submission path; the README explicitly says "no pull requests needed for data."
6. **Mastercard VI is a detection stub** — never returns 200; throws `ProtocolNotYetSupportedError` which `formatError` routes to a 503 with the spec-literal `{ status: 'protocol_detected', protocol, message, expected_at }` body. Don't try to "fix" the stub to validate envelopes — the validation API doesn't ship until 2026-Q3.
7. **Pricing claim source-of-truth** is `apps/web/src/app/pricing/page.tsx` (50K ops/month free tier). The canonical `.cursorrules` playbook was stale (claimed "1,000 free invocations") — if you touch monetization-adjacent docs, verify against the pricing page, not the playbook.
8. **`packages/mcp` ↔ `apps/web` decoupling**: dependency injection via config function types. No imports across.
9. **Push policy**: never `git push origin main` — user pushes manually. 175 commits ahead as of this handoff.

---

## Memory entries worth checking before you start

User auto-memory at `/Users/lex/.claude-account1/projects/-Users-lex/memory/`:
- `feedback-push-policy.md` — never push origin/main (Vercel build budget).
- `feedback-vercel-preview-builds.md` — preview builds are per-project, not team-wide.
- `feedback-shared-worktree-hazard.md` — parallel sessions in the same repo SHARE the working tree; checkouts in one silently switch the other's branch. Use `git worktree` for parallel sessions.
- `settlegrid-operational-status.md` — full prod status.
- `MEMORY.md` index (28KB; only ~200 lines auto-loaded).

---

## Open questions for the user when Phase 4 kicks off

1. **PostHog seat decision** — Phase 4 plan assumes free-tier; confirm the team has a seat or use the open-source self-hosted variant.
2. **Launch date** — anchors P4.7 war room and P4.6 outreach send timing. Without a target date, P4 cards run open-ended.
3. **Founder writing slot** — P4.2–P4.5 produce drafts only. Founder needs blocked time to rewrite (estimate: 6-10h across the four content artifacts).
4. **Cursor extension decision** — P4.9 is an ADR (architecture decision record) on whether to polish or deprioritize the Cursor extension; needs founder input on Cursor as a distribution channel given cursor.directory submission is now packaged (P3.13).

---

## Picking up

When the user pastes the first Phase 4 card prompt:
1. Read the card carefully — extract spec, files-may-touch, files-must-not-touch, DoD, hostile requirements.
2. **Distinguish engineering vs. content prompts** — content prompts (P4.2–P4.5) are draft → founder rewrite; don't try to "audit" voice the way you'd audit code.
3. Use `TaskCreate` to track the 4 rounds (scaffold → spec-diff → hostile → tests) for engineering prompts. Content prompts collapse to 2-3 rounds (draft → spec-diff → founder handoff).
4. Run scaffold round with hostile pre-checks baked in.
5. **At every cross-module seam, write a wire-shape integration test** before the audit chain catches the gap.
6. Wait for the user's verbatim spec-diff / hostile / tests prompts before each subsequent round.
7. Close with gate regen + commit (Phase 4 gate authored in P4.10; until then, run `phase-3-verify.ts` for regression detection).

The user is precise and the audit chain is strict. Match the format of the existing Phase 3 commits.
