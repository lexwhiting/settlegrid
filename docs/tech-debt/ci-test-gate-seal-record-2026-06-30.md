# ci-test-gate — ② seal-gating review (SEAL, clean) — 2026-06-30

> **Chunk:** `ci-test-gate` · **Closes launch-gate blocker:** **G4-1** · **Tier:** **HIGH-STAKES** (re-confirmed
> against the realized diff; **NOT escalated**) · **Base:** local `main` HEAD `6ff11a6d`.
> **Verdict: ✅ SEAL (clean) — pending operator `/seal-go`.** Gate is GREEN from a pristine clone; all four
> review lenses passed; zero HIGH/MED findings. Claude cannot self-seal — the operator runs `/seal-go` + the
> explicit-pathspec commit + the G4-1 roadmap tick (§5 below).
> **Build spec consumed:** `docs/tech-debt/ci-test-gate-handoff-2026-06-30.md` (① handoff).

---

## 1. What was reviewed (the realized diff)

The build (phase ①, durable in `cadence-state.json` `phase:"build"`) produced exactly three deliverables,
all still **uncommitted** in the working tree:

- **A — `.github/workflows/web-ci.yml`** (new): the `web-ci` gate — `tsc + lint + vitest` for `apps/web`,
  with the LBD-2 deps-build + `next typegen` prepended, on **both** `push:[main]` and `pull_request:[main]`.
- **B — LBD-3 skip-if-absent guards** (3 modified test files): `existsSync` gating so tests that read
  **deliberately-gitignored** internal docs **SKIP (visibly)** in a fresh clone instead of ENOENT-failing,
  while keeping full teeth on a machine that has the docs.
  - `apps/web/src/__tests__/privacy-notice-regression.test.ts`
  - `apps/web/src/app/__tests__/compare-nevermined.test.ts`
  - `apps/web/src/lib/__tests__/compliance-docs.test.ts`
- **C — §P operator enforcement cue** (docs, not code): lives in the handoff §12 (`OPERATOR-ONLY — do not
  execute` fenced block). The workflow header points to it. **Not executed by the build.**

---

## 2. The gate is GREEN from a pristine clone (the load-bearing evidence)

**Method (faithful clean-CI, per handoff §6):** `git clone` of local `main` into the scratchpad (tracked
files only → no `dist/`, no `.next/`, none of the gitignored docs), the three uncommitted deliverables copied
in, then the **exact `web-ci.yml` step sequence** run. The gate-runner (main session) is kept separate from
the verifiers (§4) — gate-runner ≠ verifier.

Clone sanity confirmed: `git status` in the clone showed **only** the 4 deliverables (3 `M` + 1 `??`);
`docs/launch/` absent; `docs/legal/` contained **only** the 4 tracked allowlisted docs
(`acceptable-use-policy.md`, `aup.md`, `privacy-notice-draft.md`, `terms-of-service-draft.md`);
no `packages/*/dist` pre-build.

| Step (web-ci.yml) | Command | Exit |
|---|---|---|
| 1 | `npm ci` (repo root) | **0** |
| 2 | `npx turbo run build --filter=@settlegrid/web^...` | **0** (built all 4 `@settlegrid/*` `dist/`) |
| 3 | `npx next typegen` (apps/web) | **0** (`.next/types/routes.d.ts` generated) |
| 4 | `npx tsc --noEmit` (apps/web) | **0** |
| 5 | `npm run lint` (apps/web) | **0** (warnings-only: img-element / exhaustive-deps / 1 unused eslint-disable) |
| 6 | `npx vitest run` (apps/web) | **0** |

**Normalized vitest digest (strip timestamps/durations):**
- **Test Files: 218 passed (218)** — 0 failed.
- **Tests: 4992 passed | 61 skipped (5053)** — **0 failed.**
- **Skip set — fully accounted, every skip is an LBD-3 guard (no stray skip):**
  - `src/app/__tests__/compare-nevermined.test.ts` — **1 skipped** (show-hn-response-kit cross-link; `docs/launch/` absent)
  - `src/lib/__tests__/compliance-docs.test.ts` — **55 skipped** (the gitignored `docs/legal/` compliance-doc blocks; the **tracked** AUP block still RUNS → 14 tests with full teeth)
  - `src/__tests__/privacy-notice-regression.test.ts` — **5 skipped** (stripe-dpa-status block; tracked `privacy-notice-draft.md` block still RUNS with full teeth)
  - **1 + 55 + 5 = 61 = total skipped.** No other test in the suite is skipped.

**Environment caveat (handoff F10, the one residual):** the run used **node v24.13.0**; the gate pins
**node 20**. node 20 is adequate for the stack (Next 15.5 / React 19.2 / vitest 2.1.9 / TS 5.9.3), but
node-20 behavior is empirically unverified locally → **the first real CI run is the node-20 proof.** Not a
seal blocker; carried as an expected first-run confirmation.

---

## 3. LBD-2 + LBD-3 proven load-bearing (deterministic facts + empirical confirmation)

Per handoff §6, proven via deterministic read-only facts (NOT a destructive `rm` dance; a nested worktree
cannot reproduce the `dist` failure because workspace symlinks resolve `@settlegrid/*` back to the main
tree's built `dist/`):

- **LBD-2(b) `dist`:** all four `packages/{client,langchain,mcp,rails}/dist` are `git check-ignore`-hit and
  have **0** `git ls-files` entries; their `package.json` `exports` are **dist-only** (no `src`/dev
  condition); none has a `prepare`/`postinstall` (only `prepublishOnly`, which `npm ci` skips) → `npm ci`
  never builds them. In a fresh clone, bare `tsc` would be 88 errors (62× TS2307) and vitest would fail to
  resolve `@settlegrid/mcp`. The `turbo run build --filter=@settlegrid/web^...` step (exit 0 above) is the fix.
- **LBD-2(a) `.next/types`:** `apps/web/next-env.d.ts:3` hard-references `./.next/types/routes.d.ts` (absent
  in a clone → TS6053). `next typegen` (exit 0 above) regenerates it.
- **LBD-3 docs:** `stripe-dpa-status.md`, `show-hn-response-kit.md`, and the gitignored `docs/legal/`
  compliance docs are all `git check-ignore`-hit → absent in any clone. Without the guards those reads
  ENOENT (3 suites fail → RED); with them they skip cleanly (proven by the 61-skip digest, all green).

**Both fixes are confirmed working by the empirical clean-clone run AND proven necessary by the facts.**

---

## 4. Review lenses — 4 decorrelated fresh-context audits (Agent tool), all PASS

Orchestration: 4 lens-distinct fresh-context Agent-tool reviewers (the gate-runner ran the gate; these
audited the artifacts/evidence independently). Env traps unset (`CLAUDE_CODE_FORK_SUBAGENT` confirmed unset
at the start; no `CLAUDE_CODE_EFFORT_LEVEL`/`SUBAGENT_MODEL`); session allowlist GREEN (`git`/`tsc`/`vitest`/
`lint`); `next typegen` + `turbo build` ran in the foreground (main session), per directive (a). HIGH-STAKES
review depth.

1. **Spec-conformance + YAML structural** → **CONFORMS — seal-ready.** All 9 spec items satisfied with
   quoted evidence (both triggers; `permissions:contents:read`; `concurrency` on `github.ref` +
   `cancel-in-progress`; **no** `paths:` filter; single job **id == name == `web-ci`** so the future
   branch-protection check-run context is non-vacuous; exact step order; node 20 + cache npm; `npm ci` +
   `turbo` at root). YAML valid (PyYAML parse OK, no tabs, 2-space). Secret-free; no `continue-on-error`;
   deps-build only (no full `next build`). (The PyYAML `on:`→`true` coercion is a YAML-1.1 display artifact;
   GitHub's parser keeps `on` — not a defect.)
2. **LBD-3 teeth + completeness** → **COMPLETE + TEETH INTACT — no hole.** Independently swept all
   `apps/web/src/**/*.test.ts`: **exactly 3** files read repo-root `docs/` paths — the same 3 modified.
   Every gitignored-doc read is guarded to **SKIP** (not silent-pass: assertions live only inside the gated
   block; `compliance-docs` `readDoc` returns `''` so the `describe.skip` factory can't ENOENT at
   collection). Tracked docs (`privacy-notice-draft.md`, `acceptable-use-policy.md`/`aup.md`) keep full
   unconditional teeth. False matches (`launchSrc` = tracked `blog-bodies/*.md`; `DOCS_PAGE_TSX` = tracked
   route source) verified not docs.
3. **Commit-hygiene + scope/frozen** → **HYGIENE CLEAN.** INCLUDE set is exactly the deliverables; the 3
   test diffs are **purely** `existsSync` skip-guards (no assertion/logic change). EXCLUDE set
   (dashboard/tools `slugify` UI edit; SECURITY-INCIDENT status edit; `.claude/`; launch-gate-queue;
   v-n3-mfa-unenroll handoff; mfa-delete-smoke.sh) confirmed pre-existing, unrelated, **unstaged** (index
   empty). No scope creep: `apps/web/vercel.json` **not** edited; no other workflow added/modified; no NEW
   tests authored; no full `next build`; **no gitignored doc committed**; branch-protection **not executed**
   (`branches/main/protection` appears ONLY in the handoff §12 OPERATOR-ONLY fenced block).

**Zero HIGH, zero MED, zero LOW findings requiring a fix.** No integrator fixes needed — the build was
correct as delivered.

---

## 5. SEAL BOOKKEEPING — the operator's `/seal-go` steps (Claude did NOT perform these)

1. **Stage with the EXACT explicit pathspec** (never `git add -A`/`.`; emit this literal line):
   ```
   git add .github/workflows/web-ci.yml \
     apps/web/src/__tests__/privacy-notice-regression.test.ts \
     apps/web/src/app/__tests__/compare-nevermined.test.ts \
     apps/web/src/lib/__tests__/compliance-docs.test.ts \
     docs/tech-debt/ci-test-gate-handoff-2026-06-30.md \
     docs/tech-debt/ci-test-gate-seal-record-2026-06-30.md
   ```
   (**CORRECTION at bookkeeping:** `LAUNCH-GATE-roadmap-2026-06-27.md` is **gitignored** via `.gitignore:27
   `*ROADMAP*.md`` — it is LOCAL cadence-orchestration state, NOT a committed artifact. The G4-1 tick below
   is therefore local-only; it is **not** part of the chunk commit. The original §5 pathspec listing the
   roadmap was a plan imperfection caught here — the 6 paths above are the complete committable set.)
2. **Tick G4-1** `☐→☑` in `LAUNCH-GATE-roadmap-2026-06-27.md:95` (LOCAL-only — gitignored). The Edit fires
   the PostToolUse hook (`launch-gate-check.sh --on-edit`) which auto-recounts: **open 17 → 16** (still RED;
   do **not** hand-edit the count). Optionally run `.claude/launch-gate-check.sh` to confirm the banner.
3. **Commit** straight to `main` (the team's direct-push seal flow) with an explicit message.
4. **EXCLUDE — leave untouched/unstaged:** `apps/web/src/app/(dashboard)/dashboard/tools/page.tsx`,
   `docs/SECURITY-INCIDENT-2026-06-15-exposed-pg-credential.md`, `.claude/`,
   `docs/tech-debt/launch-gate-queue.md`, `docs/tech-debt/v-n3-mfa-unenroll-hardening-handoff-2026-06-27.md`,
   `scripts/mfa-delete-smoke.sh`.

---

## 6. Deliverable C — §P branch-protection enforcement (OPERATOR; the gate YAML alone does NOT block deploys)

> **LBD-1, do not gloss:** `web-ci.yml` produces a **post-hoc signal** (a `web-ci` check that races Vercel's
> git auto-deploy). It does **not** block a bad deploy by itself. The thing that blocks un-tested code from
> prod is a **GitHub branch-protection rule on `main`** requiring the `web-ci` check. The exact `gh api`
> command is in **handoff §12** (`OPERATOR-ONLY — do not execute`). It was **not** run.

The operator must enable **all four** (a partial config is silently toothless):
1. Require the **`web-ci`** status check (context = the job `name:`, kept == job id `web-ci`).
2. Require a **PR before merging** (a required check is incompatible with direct-push *as such*).
3. **Include administrators** (`enforce_admins:true`) — else the sealer pushes past the check.
4. **Lock the non-git bypass paths** — `vercel deploy --prod`, **promote-a-preview**, **Deploy Hooks** all
   reach prod without touching `main`; disable/forbid or explicitly accept+document them.

> ⚠️ **TENSION the operator must accept:** (2)+(3) **forbid the current direct-push-to-`main` seal flow** for
> the remaining ~10 queue chunks — enabling enforcement means switching all future seals to a PR-merge flow.
> The `web-ci` workflow itself is harmless to ship now (it just starts emitting the signal); only the
> *enforcement* carries the tension. Optional `vercel.json` `ignoreCommand`: **default DECLINE** (ask-first).

---

## 7. Tier re-confirmation + lifecycle

- **Tier = HIGH-STAKES, NOT escalated.** It *is* a launch-gate protective control (G4-1) with false-green
  risk — but the realized diff is config infra + mechanical `existsSync` test guards; it touched **no**
  money/auth/crypto code and **no** deploy-config (`vercel.json` 0-diff, confirmed). The two false-green
  traps the plan-audit flagged (LBD-2 dist, LBD-3 docs) are both closed and **empirically proven green from a
  clean clone**, with the deterministic facts proving they would otherwise be RED.
- **Defect class recorded:** `false-green / toothless-control` — a gate green for the wrong reason. Bit the
  plan twice (LBD-2, LBD-3) + F1's own baseline; all three closed here.
- **Lifecycle:** scope-confirm ✓ → plan + pre-build audit ✓ → build ✓ → **executable gate GREEN from clean
  clone ✓ → ② seal-gating review PASSED (this record) ✓** → **operator `/seal-go`** (§5) → **③ post-seal deep
  audit** (high-stakes).
- **NEXT after seal:** the queue's `--next` advances to chunk #5 `secrets-config-hardening` (G0-2). Launch
  gate stays **RED** (16 open after the G4-1 tick) until 0.
