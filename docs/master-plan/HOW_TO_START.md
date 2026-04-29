# How to Start Executing the Quantum Leap Master Plan

**Document:** `MP-QL-001 / HOW_TO_START`
**Audience:** The founder (Luther) + any Claude session executing a prompt
**Purpose:** Cold-start instructions for the first prompt (P1.1) and subsequent prompts

---

## Before You Start

### Open a fresh Claude Code session

The master plan was designed for handoff to fresh sessions. Do NOT continue in the session where the plan was written. Each execution prompt is self-contained and assumes no prior memory.

### Verify the repos are clean

```bash
cd /Users/lex/settlegrid && git status
cd /Users/lex/settlegrid-agents && git status
```

Both should be clean (or have only expected in-progress work). If either has uncommitted changes from a prior session, commit or stash them before starting.

### Verify both repos are on `main` and up to date

```bash
cd /Users/lex/settlegrid && git pull origin main
cd /Users/lex/settlegrid-agents && git status  # agents repo has no remote yet
```

---

## Starting Prompt P1.1 (the entry point)

### Step 1: Paste this opening message into a fresh Claude Code session

```
I'm executing the SettleGrid Quantum Leap Master Plan (MP-QL-001) starting
with prompt P1.1. Please:

1. Read /Users/lex/settlegrid/docs/master-plan/README.md end-to-end
2. Read /Users/lex/settlegrid/docs/master-plan/audit-chain-template.md
3. Read /Users/lex/settlegrid/docs/master-plan/shared-context.md
4. Read /Users/lex/settlegrid/docs/master-plan/phase-1-foundation.md and
   find the P1.1 section
5. Execute P1.1 exactly as specified
6. Run the full 3-part audit chain at the end (spec diff, hostile review,
   tests + verification)
7. Only commit if all three audits output Verdict: PASS

Do NOT execute any prompt beyond P1.1 in this session. Stop after the
audit chain passes and the commit is created.
```

### Step 2: Let the session execute

The session will read the three reference docs, then find P1.1 in the phase document, then execute. Expected wall time: 1-3 hours depending on how many reworks the audit chain triggers.

### Step 3: Review the audit output

After the session completes, verify you see three `Verdict: PASS` blocks in the transcript:
- `SPEC DIFF AUDIT — P1.1 ... Verdict: PASS`
- `HOSTILE REVIEWER AUDIT — P1.1 ... Verdict: PASS`
- `TESTS + VERIFICATION — P1.1 ... Verdict: PASS`

If any show `FAIL`, follow the rollback instructions in P1.1 and do NOT proceed to P1.2.

### Step 4: Verify the commit landed

```bash
cd /Users/lex/settlegrid-agents && git log --oneline -5
```

You should see a commit with subject `templater: scaffold agent skeleton matching beacon pattern` and trailer `Refs: P1.1`.

### Step 5: Open a new session for P1.2

Repeat from Step 1, substituting P1.2 for P1.1. Each prompt gets its own session.

---

## Known Issues in Phase 1 Prompts (Cosmetic, Not Blocking)

These were caught during the final audit. The executing Claude session will hit them and should correct on the fly. They do NOT require master plan edits — the Spec Diff Audit (Part 1) will catch them.

### Issue 1: `pnpm-workspace.yaml` doesn't exist

**Prompt affected:** P1.7 (Skill package scaffold) and possibly others that reference workspace config

**Reality:** `/Users/lex/settlegrid` uses npm/turbo workspaces via `package.json` (`"workspaces": ["apps/*", "packages/*", ...]`), not a separate `pnpm-workspace.yaml` file.

**What to do:** When a prompt asks you to update `pnpm-workspace.yaml`, instead verify the new package's directory matches the glob in `package.json`'s `workspaces` field. No file edit needed if the glob already matches.

### Issue 2: `orchestrator/__tests__/scheduler.test.ts` doesn't exist

**Prompt affected:** P1.5 (Templater orchestrator registration)

**Reality:** The actual file is `/Users/lex/settlegrid-agents/orchestrator/__tests__/orchestrator.test.ts`.

**What to do:** When the prompt references `scheduler.test.ts`, read and modify `orchestrator.test.ts` instead. Add templater-specific tests alongside the existing beacon/protocol/indexer tests.

### Issue 3: SEP placeholder numbers

**Prompt affected:** P1.10 (MCP SEP draft)

**Reality:** The draft references `SEP-XXXX` as a placeholder. This is intentional — the number is assigned when the SEP is submitted to the MCP repo.

**What to do:** Leave as `SEP-XXXX` in the draft. Phase 3's P3.6 (community feedback incorporation + formal PR) replaces it with the assigned number at submission time.

---

## After Phase 1 Completes

Do NOT start Phase 2 immediately. Execute the Phase 1 audit gate (P1.12), which verifies all Phase 1 exit criteria:

- [ ] Templater scaffold compiles, 57+ tests passing
- [ ] `@settlegrid/skill` package validated against Anthropic Skills spec
- [ ] MCP SEP draft exists at `docs/seps/experimental-payment-draft.md`
- [ ] `CANONICAL_50.json` committed
- [ ] Quality gates module + tests exist and pass
- [ ] Codemod framework foundation in place
- [ ] All 12 Phase 1 prompts' audit chains PASS

P1.12 creates a Phase 1 completion commit. Only after that commit lands on `main` should you open a new session to start P2.1.

---

## Emergency Escalation

Stop execution and notify the founder if any of these happen:

1. **Two consecutive prompts fail the audit chain.** This is a phase-hold signal. Don't retry blindly.
2. **A prompt's rollback instructions aren't recoverable** (e.g., a git reset can't undo the work).
3. **The SDK (`@settlegrid/mcp`) has a breaking change that invalidates existing tests.** Stop Phase 1 and create an emergency regression recovery prompt.
4. **Budget runaway.** If any prompt spends >50% of its stated API budget, stop and re-estimate.
5. **Founder burnout.** If you're executing prompts late at night and not auditing carefully, STOP. The plan tolerates delay. It does not tolerate rushed audits.

---

## Quick Reference

| Command | Purpose |
|---|---|
| `pnpm typecheck` (in either repo) | Verify TypeScript |
| `pnpm test` (in either repo) | Run vitest |
| `pnpm -w typecheck` | Workspace-wide typecheck in settlegrid |
| `pnpm -w test` | Workspace-wide tests in settlegrid |
| `git log --oneline -20` | Recent commits |
| `cat docs/master-plan/phase-1-foundation.md \| awk '/^## P1\.<num>/,/^## P1\.<next>/'` | Extract a specific prompt card |

---

## File Map

| File | Purpose |
|---|---|
| `docs/master-plan/README.md` | Master overview |
| `docs/master-plan/audit-chain-template.md` | Canonical 3-part audit block |
| `docs/master-plan/prompt-card-format.md` | Prompt card structure reference |
| `docs/master-plan/shared-context.md` | Repo structure, SDK API, patterns |
| `docs/master-plan/phase-1-foundation.md` | 12 prompts for Weeks 1-2 |
| `docs/master-plan/phase-2-distribution.md` | 14 prompts for Weeks 3-4 |
| `docs/master-plan/phase-3-scale-convener.md` | 12 prompts for Weeks 5-6 |
| `docs/master-plan/phase-4-5-launch-measure.md` | 16 prompts for Weeks 7-12 |
| `docs/master-plan/HOW_TO_START.md` | This file |
| `docs/audit-failures/` | Created by P1.4, contains per-failure logs |

**End of how-to-start.**
