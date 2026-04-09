# The Canonical Execution Prompt Card Format

**Document ID:** `MP-QL-001 §4`

Every execution prompt across all 5 phases of the Quantum Leap master plan follows this exact structure. Phase agents writing prompts MUST use this template. Deviations require explicit justification at the top of the prompt.

---

## Template

```markdown
## P<phase>.<num> — <Title>

**Phase:** <1-5>
**Depends on:** <comma-separated prompt IDs, or "none">
**Blocks:** <comma-separated prompt IDs, or "none">
**Estimated effort:** <X> founder hours, ~$<Y> API cost
**Risk level:** Low | Medium | High
**Rollback complexity:** Trivial | Moderate | Hard

### Context

<3-8 sentences establishing why this prompt exists, what problem it solves, and
how it fits the 90-day plan. Cite the master plan section if helpful. Assume
the executing Claude session has NO memory of prior sessions.>

**Relevant file paths (absolute):**
- `/Users/lex/settlegrid-agents/agents/<path>`
- `/Users/lex/settlegrid/packages/<path>`
- ...

**Relevant existing code to read first:**
- `<absolute path>` — <why>
- `<absolute path>` — <why>

**Prerequisites to verify before starting:**
- [ ] <prior prompt>'s audit chain passed (check `docs/audit-failures/P<id>.md`)
- [ ] <env vars set>
- [ ] <services reachable>

### Specification

<Exact deliverables, written as unambiguous statements. No "maybe", no "consider".
Use imperative voice.>

**Files you may touch:**
- `<glob or path>` — <reason>
- `<glob or path>` — <reason>

**Files you MUST NOT touch:**
- `<glob or path>` — <reason>

**External services touched:**
- <service> — <operation> — <rate limit awareness>

**Budget constraints (if applicable):**
- Hard cap: $<X> in API costs for this prompt
- Abort if cap reached

### Implementation Steps

1. <Imperative, numbered, actionable step. Each step should be executable in one
   tool call or a small tight sequence.>
2. <...>
3. <...>
N. <Final step: run the audit chain>

### Definition of Done

- [ ] <Concrete, verifiable checkbox>
- [ ] <...>
- [ ] `pnpm typecheck` passes in affected workspace(s)
- [ ] `pnpm test` passes; new tests added for new behavior
- [ ] Smoke test executed and output matches spec
- [ ] Audit chain all three parts PASS
- [ ] Commit created with message: `<area>: <subject>` following repo convention

### Audit Chain

Execute `{{AUDIT_CHAIN_TEMPLATE}}` (see `audit-chain-template.md`). Paste all
three verdict blocks into the session transcript before committing.

### Rollback Instructions

**If the audit chain fails:**
1. Run `git stash` (or `git reset --soft HEAD~1` if already committed locally).
2. Write the failure summary to `docs/audit-failures/P<id>-<ISO-date>.md`.
3. Decide: (a) fix in-session, re-run audit; OR (b) abort and escalate.

**If a downstream prompt is broken by changes made here:**
1. Identify the blocking change via `git log --oneline -- <affected path>`.
2. Revert that specific commit: `git revert <sha>`.
3. Re-run the audit chain on the revert.
4. Flag the affected downstream prompt in the phase's dependency graph.

### Commit Message Template

\`\`\`
<area>: <one-line subject, imperative, ≤72 chars>

<Optional body explaining WHY this change, not what. Wrap at 72.>

Refs: P<phase>.<num>
Audits: spec-diff PASS, hostile PASS, tests PASS
Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
\`\`\`
```

---

## Mandatory Fields

Every prompt card MUST have:

- **Phase** — which phase (1-5)
- **Depends on** — prompt IDs this prompt requires complete
- **Blocks** — prompt IDs this prompt unblocks
- **Estimated effort** — founder hours + API cost
- **Context** — background, file paths, prerequisites
- **Specification** — exact deliverables, scope boundaries
- **Implementation Steps** — numbered, actionable
- **Definition of Done** — machine-verifiable checklist
- **Audit Chain** — reference to `{{AUDIT_CHAIN_TEMPLATE}}`
- **Rollback Instructions** — how to undo if things break
- **Commit Message Template** — pre-filled with prompt ID

## Optional Fields

Include when non-trivial:

- **Risk level** — Low/Medium/High
- **Rollback complexity** — Trivial/Moderate/Hard
- **External services** — services touched with rate-limit awareness
- **Budget constraints** — hard caps on API spend

---

## Length Guidelines

- **Target:** 500-1200 words per prompt card
- **Too short:** Probably under-specified. Add missing context or deliverables.
- **Too long:** Probably doing too much in one prompt. Split into two.
- **Maximum session time:** ~3 hours wall time. If an implementation takes longer, the prompt should have been split.

---

## Writing Rules

1. **Imperative voice.** "Create the file" not "you should consider creating".
2. **Absolute paths.** Always. Never relative. A fresh session has no cwd assumption.
3. **Reference, don't duplicate.** Use `{{AUDIT_CHAIN_TEMPLATE}}` and `{{SHARED_CONTEXT}}`. Never copy the audit chain or shared context into a prompt.
4. **No "maybe" or "consider".** If something is optional, mark it explicitly. If not, mandate it.
5. **Prerequisites are checkboxes.** Every prompt starts with a "verify before starting" block. Unchecked prerequisites = halt.
6. **Files you MUST NOT touch.** Every prompt has an explicit exclusion list to prevent scope creep.
7. **Implementation steps are numbered and atomic.** Each step should fit in one tool call or a small sequence.
8. **Definition of Done is machine-verifiable.** "Looks good" is not a DoD item. "`pnpm test` passes with N new tests" is.

**End of prompt card format.**
