# The Canonical 3-Part Audit Chain Template

**Document ID:** `MP-QL-001 §3`
**Referenced as:** `{{AUDIT_CHAIN_TEMPLATE}}`

Every execution prompt in the Quantum Leap master plan MUST embed this block at the end of its Definition of Done. If a prompt omits the audit chain, the prompt is malformed and must be rejected before execution.

---

## AUDIT CHAIN — MANDATORY, ALL THREE PARTS MUST PASS

This work is not done until all three audits below complete cleanly. If ANY part fails, do not proceed to the next prompt. Execute the rollback instructions in the prompt card instead.

---

### Part 1 — Spec Diff Audit

**Goal:** Verify the implementation matches the spec in this prompt card exactly. No scope creep, no missed deliverables.

**Procedure:**

1. **Re-read** the Specification section of this prompt card.
2. **Enumerate** the deliverables as a numbered list. Each "Definition of Done" bullet is one deliverable.
3. **For each deliverable**, run `git diff --stat` and `git status` and identify the files that satisfy it. Produce a table:

   | # | Deliverable | Files touched | Status (Met / Partial / Missed) |

4. **Scope boundary check:** for every file touched, confirm it was listed in the prompt card's "Files you may touch" section OR is a new file explicitly required by a deliverable. Any file touched outside this boundary is a scope violation and must be either justified in writing or reverted.

5. **Deviations log:** if any deliverable is Partial or Missed, write a 1-3 sentence justification. If any file was touched outside scope, write a 1-3 sentence justification. Deviations without justification = audit failure.

6. **Output format** (paste into the session as a code fence):

```
SPEC DIFF AUDIT — P<id>
Deliverables: N met, M partial, K missed
Scope violations: X (justified: Y)
Deviations:
  - <deliverable>: <why>
Verdict: PASS | FAIL
```

**Pass bar:** 100% of deliverables Met OR all Partial/Missed have explicit written justification AND zero unjustified scope violations.

---

### Part 2 — Hostile Reviewer Audit

**Goal:** Stress-test the implementation from an adversarial engineering perspective. Find what's broken before users do.

**Persona:** You are a cynical principal engineer who has seen every failure mode. You assume the code is wrong until proven otherwise. You do not accept "it works on my machine." You prefer to find bugs now over learning about them in production.

**Minimum requirements:**

- Challenge **at least 5 assumptions** baked into the implementation. For each: state the assumption, state why it might be wrong, state what happens if it IS wrong.
- Find **at least 3 failure modes** not covered by existing tests. For each: describe the failure, describe the trigger, describe the blast radius.
- Categories you MUST stress-test (tick each):
  - [ ] **Security:** injection, auth bypass, secret leakage, SSRF, prompt injection, path traversal
  - [ ] **Performance:** unbounded loops, N+1, hot-path allocation, blocking I/O in async contexts
  - [ ] **Edge cases:** empty input, null, undefined, zero, max int, unicode, very long strings
  - [ ] **Error handling:** swallowed exceptions, partial failures, retry storms, ambiguous errors
  - [ ] **Fragile dependencies:** hardcoded URLs, pinned non-existent versions, env var assumptions
  - [ ] **Hardcoded values:** magic numbers, test data in production paths, placeholder secrets
  - [ ] **Concurrency:** race conditions, unflushed state, shared mutable globals
  - [ ] **Observability gaps:** unlogged failures, missing traces, unclear error messages

- For each finding, classify as:
  - **BLOCKER** — must fix before audit passes (e.g., secret leak, auth bypass, crash on common input)
  - **FIX NOW** — mitigate in this prompt before marking done (e.g., missing validation, unclear error)
  - **DEBT** — document as a follow-up issue, acceptable to ship as-is

**Blocker rules:** If ANY finding is classified BLOCKER, the prompt fails. Fix the blocker, re-run Part 2 from the top. Do not proceed to Part 3 until zero blockers remain.

**Output format:**

```
HOSTILE REVIEWER AUDIT — P<id>
Assumptions challenged: X
Failure modes found: Y
Categories covered: 8/8
Findings:
  [BLOCKER] <title> — <description> — <mitigation>
  [FIX NOW] <title> — <description> — <mitigation applied>
  [DEBT]    <title> — <description> — <issue link or note>
Verdict: PASS | FAIL
```

**Pass bar:** Zero BLOCKERS, all FIX NOW items resolved in this session, all DEBT items documented.

---

### Part 3 — Tests + Verification

**Goal:** Prove the system still builds, tests pass, and the new functionality actually works end-to-end.

**Required commands (run in this order, all must succeed):**

For `/Users/lex/settlegrid-agents/`:

```
pnpm typecheck    # tsc --noEmit, zero errors
pnpm test         # vitest run, zero failures
```

For `/Users/lex/settlegrid/`:

```
pnpm -w typecheck
pnpm -w test
pnpm -w lint      # zero errors, warnings triaged
```

For any package that was touched (`packages/mcp`, `packages/create-settlegrid-tool`, etc.):

```
cd packages/<name> && pnpm build
```

**Smoke test procedure:**

1. Identify the shortest end-to-end path that exercises the new code.
2. Execute it manually (CLI command, `tsx` script, `curl`, whatever is appropriate).
3. Capture the output in the session.
4. Confirm the output matches expectations from the spec.

**Definition of Done verification:**

Re-read the Definition of Done checklist from the prompt card. Check each box only if the corresponding evidence is visible in the session transcript (file paths, test counts, smoke test output). Unchecked boxes = audit failure.

**Rollback procedure (execute if any part fails):**

1. Do NOT commit changes.
2. Run `git status` and confirm changes are still unstaged.
3. If changes are committed locally, run `git reset --soft HEAD~1` to unstage without losing the diff.
4. Copy the failing audit output into `docs/audit-failures/P<id>-<timestamp>.md` so the next session can learn from it.
5. Either (a) fix in the current session and re-run all three audits, or (b) abort the prompt and escalate to the founder.

**Output format:**

```
TESTS + VERIFICATION — P<id>
typecheck: PASS (0 errors)
test: PASS (N tests, 0 failures)
lint: PASS (0 errors)
build: PASS (all touched packages)
smoke: PASS — <command> — <expected output matched>
DoD: X/X boxes checked
Verdict: PASS | FAIL
```

**Pass bar:** All commands green, smoke test produces expected output, 100% of DoD boxes checked.

---

## Audit Chain Completion

Only after ALL THREE parts output `Verdict: PASS` is the prompt complete. Paste all three audit output blocks into the session transcript, then commit with the message template in the prompt card.

---

## Common Audit Failure Modes & Recovery

| Failure type | Action |
|---|---|
| Part 1 fail (spec diff) | Fix in session, re-run Part 1. If the spec was wrong, update the prompt card and note the edit. |
| Part 2 BLOCKER | Fix in session. Re-run Parts 2 and 3. Do NOT commit until clean. |
| Part 3 test fail | Fix tests OR fix code. If the new failure is in unrelated code, flag as a pre-existing issue and proceed (record in audit log). |
| Two consecutive prompts fail | **Phase hold.** Escalate to founder. Re-evaluate phase plan before continuing. |
| Prompt breaks a prior prompt | Revert the breaking commit. Re-run the prior prompt's smoke test. Re-plan the current prompt. |
| SDK breaking change invalidates templates | STOP. Create an emergency SDK regression recovery prompt. Roll back SDK OR pin templates. |

**End of audit chain template.**
