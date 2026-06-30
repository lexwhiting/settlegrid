# ci-test-gate — ① handoff (build spec) — 2026-06-30

> **Chunk:** `ci-test-gate` · **Closes launch-gate blocker:** **G4-1** · **Tier (initial):** **HIGH-STAKES**
> (② may re-confirm/escalate against the realized diff)
> **Queue position:** #1 (front-run) in `docs/tech-debt/launch-gate-queue.md`.
> **Base:** local `main` HEAD `6ff11a6d` (clean working tree except the pre-existing uncommitted set in §8 — do NOT touch those).
> **This file is the standalone build spec.** The build agent reads THIS first, then builds. No build code exists yet.
> **⚠ PLAN-AUDIT FOLDED (2026-06-30):** a 5-lens high-stakes plan audit (claude-opus-4-8 @ xhigh) found **TWO CRITICAL CI-green holes** the first draft missed — see **§5 LBD-2 + LBD-3** and **§4 F1**. The naive "one workflow file" gate would be **RED on its first real CI run**. Both fixes are folded below and were **proven green in a pristine `git clone` + `npm ci`** (the faithful CI simulation). Read §5 before building.

---

## 1. Intent — why this chunk exists, who consumes it, what it enables

**Goal (one sentence):** add a GitHub Actions workflow that runs the `apps/web` typecheck + lint + vitest
suite on every change headed for `main`, so **a logic regression that breaks an existing test can no
longer ship silently to production money traffic.**

> **Honest scope of the guarantee (folded — containment lens):** the gate keeps the **existing** suite
> green; it does **not** prove untested-but-typechecking new code is correct (there is no coverage
> floor — that's deliberately each later money chunk's "pin a regression test" job). Do **not** restate
> the goal as "any regression that typechecks can't ship."

**Why now / who consumes it.** `main` auto-deploys to Vercel production (no `ignoreCommand` in
`apps/web/vercel.json`, confirmed §4 F5). Today **nothing** runs the `apps/web` vitest suite in CI —
the 9 existing workflows are codemod/publish/reconcile/template jobs (§4 F8). So every merge to `main`
— including the upcoming **money/abuse hardening chunks** (#6–#9: consumer-abuse, proxy-idempotency,
billing-correctness, containment) — currently ships **un-gated by vitest**. This chunk was deliberately
**front-run ahead of those money chunks** (2026-06-29 audit SEQ/SYS-2): the containment control that
protects the money fixes must exist **before** the money fixes land. The consumer is every future
push/PR to `main`; what it enables is that each later money chunk can "pin a regression test" the gate
keeps green forever.

**It is a launch-gate blocker (G4-1).** Roadmap row (`LAUNCH-GATE-roadmap-2026-06-27.md:95`):
> *"No CI test gate — none of the 9 workflows run the `apps/web` vitest suite; `main` auto-deploys to
> Vercel. A logic regression that typechecks ships to money traffic. → Add a workflow that runs
> `apps/web` tsc+lint+vitest on PR-to-main, blocking deploy."*

---

## 2. Scope confirmation + sequencing

- **Source of truth:** `docs/tech-debt/launch-gate-queue.md` line 20 (chunk #4 in file order, front-run to
  #1 by `--next`); roadmap row **G4-1** (`LAUNCH-GATE-roadmap-2026-06-27.md:95`, box `☐`).
- **Prior chunk's "next" cross-check:** the proxy-ssrf-hardening ③ (2026-06-29) named `ci-test-gate
  (G4-1)` as next via `--next`, and its critic surfaced *"ssrf-suite-absent-from-ci (REAL LOW) =
  NET-NEW chunk."* **Sequencing note (NOT a merge):** the committed SSRF **unit** tests already live
  under `apps/web/src/**` and run automatically under this gate's `vitest run` — covered for free. The
  separate *dedicated SSRF e2e network suite* the critic flagged is its **own** future item — **do NOT
  pull it in** (scope creep; needs network + a different harness).
- **No earlier sequencing dependency** blocks this chunk: pure CI/config infra; touches **no**
  app/money/auth/crypto code (the only `apps/web/src` edits are the §5 LBD-3 skip-if-absent test guards,
  which are CI-enablement, not logic).

**Sizing / merge decision: KEEP AS PLANNED — do NOT merge.** Adjacent queue item #5
`secrets-config-hardening` (G0-2) shares **no seam** (it edits `lib/env.ts` + `lib/settlement/ap2/
credentials.ts` money/secret logic). Merging would fold an unrelated incremental item into this
high-stakes infra chunk and break single-writer focus. No merge.

---

## 3. Tier classification — **HIGH-STAKES**

Triggering criteria (multiple apply):
- **Affects a gate** — this chunk *is* a launch-gate control (G4-1).
- **Misleading-result risk on a protective control** — the load-bearing "blocks the deploy" + "GREEN
  means the money surface was tested" claims are exactly the kind that can be **silently toothless** (a
  green check + a still-un-gated deploy; a green suite that didn't actually run the money packages). The
  plan audit found **two** such false-greens already (§5). A toothless containment gate gives a **false
  GREEN on the whole launch-gate process** that downstream money chunks trust.
- **Touches the deploy-config surface** — if `apps/web/vercel.json` is edited it governs what ships to
  money traffic (and carries 18 crons + the facilitator rewrite that must not be clobbered, §4 F5).

The diff is small. **The high-stakes part is the correctness of a protective control, not the line
count.** Tier = HIGH-STAKES, audited at high-stakes lens depth (done — §5/§4 reflect the folded result).

---

## 4. Settled facts (mechanical probes — feed these in; do not re-derive)

Probes on `main` HEAD `6ff11a6d`, this session. **F1 corrected post-audit.**

| # | Claim | Result |
|---|---|---|
| **F1** | **Full `apps/web` vitest suite — the TRUE clean-CI baseline** | **⚠ CORRECTED.** On the **dev box** (with local untracked docs + built `dist/` present) the suite reports **218 files / 5053 tests, all green** — but that was a **FALSE-GREEN**. In a **pristine `git clone` + `npm ci` + the corrected build sequence**, the honest baseline is **215 files pass / 3 fail (4948–4949 tests pass, the 3 doc-coupled suites ENOENT)** until the §5 LBD-3 fix lands. After **both** LBD-2 (dist build) and LBD-3 (skip-if-absent) fixes: **green from a pristine checkout.** Hermetic otherwise: the only injected env is `API_KEY_PEPPER` (set in `apps/web/vitest.config.ts`); no `.env`, no real network (§4 F9). |
| **F2** | **`apps/web` typecheck** (`npx tsc --noEmit` from `apps/web`) | exit 0 in ~8.5s **LOCALLY ONLY** — green for **TWO** reasons that are both ABSENT in clean CI: (a) `.next/` exists; (b) `packages/*/dist` exists. In a clean clone, bare `tsc` = **exit 2, 88 errors (62× `TS2307 Cannot find module '@settlegrid/{mcp,rails,client,langchain}'`)**. See LBD-2. |
| **F3** | **`apps/web` lint** (`npm run lint` → `next lint`) | exit 0 in ~4.2s; **warnings only** (img-element, exhaustive-deps, one unused eslint-disable) — warnings do **not** fail. Needs neither `.next/` nor `dist/` (green even on an un-built clone). `next lint` is **deprecated in Next 15.5** (prints a notice, still exits 0; will break only at Next 16). Lint contributes ~no teeth today — do not count it toward the gate's protective value. |
| **F4** | **`next typegen`** (`npx next typegen` from `apps/web`) | **exit 0, generates `.next/types/routes.d.ts` in seconds, NO env/secrets, no build artifact needed** (runs before `dist` exists). Confirmed fix for the `.next` half of LBD-2. Next resolved at **15.5.12** (typegen present). |
| **F-A** | **Workspace dist build** (`npx turbo run build --filter=@settlegrid/web^...` from repo root) | **exit 0 in ~6.2s, secret-free**, builds all four `@settlegrid/*` `dist/` (both `.d.ts` for tsc and `.mjs` for vitest). After it: clean-clone `tsc` = **0 errors**, the previously-failing vitest files resolve. The confirmed fix for the `dist` half of LBD-2. Builds only web's **deps** (`^...`), NOT web itself — stays inside the `apps/web` scope boundary; this is NOT the all-package turbo CI §7 rules out. |
| **F5** | **Vercel deploy gating today** | `apps/web/vercel.json` has **NO `ignoreCommand`** → `main` auto-deploys to prod un-gated. File carries **18 `crons` + 1 `rewrites`** (`facilitator.settlegrid.ai → /api/x402/...`) — must NOT be dropped if ever edited. Vercel build = `cd ../.. && npx turbo build --filter=@settlegrid/web` (root `turbo.json` `build` has `dependsOn:["^build"]` — i.e. **Vercel builds the packages' `dist/` first, then web**; that `^build` is exactly what the gate must replicate, see LBD-2). |
| **F6** | **Team's merge flow** | **Direct-push-to-`main`** — `git log --merges` shows **zero** merge commits; seals via `/seal-go` + an explicit-pathspec commit pushed straight to `origin/main`. **⇒ a `pull_request`-only trigger would NEVER fire** (LBD-1). |
| **F7** | **Git remote** | `https://github.com/lexwhiting/settlegrid.git` (GitHub Actions available). `gh` is authenticated in this session (`lexwhiting`, scopes incl. `repo`,`workflow`) — so the operator `gh api` cue in §6-B would *succeed if run*; it is OPERATOR-only, do NOT run it from the build (LBD-1). |
| **F8** | **CI convention** | `python-sdk-ci.yml` is the model: `on:{push:{branches:[main],paths:[…]}, pull_request:{paths:[…]}}`, `actions/setup-node@v4` node **'20'** + `cache:'npm'`, `npm ci`, `permissions:{contents:read}`, `concurrency` with `cancel-in-progress`. **8 of the 9 workflows use Node; 7 use '20'** (only template-of-the-week uses '24'). `concurrency` keyed on `${{ github.ref }}` is correct for a combined push+PR workflow (template-quality's `pull_request.number` is empty on `push`). **`template-quality.yml` runs `npm --workspace @settlegrid/mcp run build` before its checks — the fleet already encodes "build workspace deps first" (the LBD-2 fix).** |
| **F9** | **Hermeticity** | The 6 secret/network-env-referencing test files (`env.test.ts`, `{health,launch-metrics}.test.ts`, `circle-nano/{settle-engine,transport-isolation}.test.ts`, `x402.test.ts`) are **confirmed hermetic** — each self-mocks viem/db/redis/fetch/logger and sets env inline; the clean-clone run had **zero** secret/network failures. **The ONLY non-hermeticity in the 218-file suite is the gitignored-docs filesystem coupling — LBD-3** (a class the original watch-list, scoped to env names, did not cover). |
| **F10** | **node-version caveat** | All session probes (F1–F4, F-A) ran on **node 24** locally; the gate pins **node 20**. node 20 is adequate for Next 15.5 + React 19.2 + vitest 2.1.9 + TS 5.9.3, but node-20-specific behavior is empirically unverified locally → treat the **first CI run as the node-20 proof** (or run once under `node:20` Docker). |

**No consolidated defect-class ledger file exists** (DC-NN classes live inline in audit records). The
class central to THIS chunk is **false-green / toothless-control**: a gate green for the wrong reason. It
bit the plan **twice** (LBD-2 dist, LBD-3 docs) and even bit F1's own baseline. ② creates the ledger at
first bookkeeping if still absent; record this class.

---

## 5. The load-bearing decisions most likely to be SILENTLY WRONG (audit concentrates here)

### LBD-1 — "blocking the deploy" is NOT achieved by the workflow file alone
A GitHub Actions workflow runs **in parallel** with Vercel's git auto-deploy; a green/red check does
**not**, by itself, stop Vercel from deploying `main`. And the team **direct-pushes to `main`** (F6), so
a `pull_request`-only trigger never even runs. The honest deliverable is **two parts**:

1. **(CODE — this chunk)** trigger on **BOTH `push:{branches:[main]}` AND `pull_request:{branches:
   [main]}`**. The `push:[main]` leg is what makes the gate fire on the real direct-push flow today — but
   note it produces a **post-hoc signal** (the run starts *after* the commit is on `main`, racing
   Vercel's deploy), **not deploy-containment.** It yields a stable status check (e.g. `web-ci`) that
   enforcement can later require.
2. **(OPERATOR / §P — CUE, do NOT silently perform)** the *enforcement* that actually blocks un-tested
   code from prod is a **GitHub branch-protection** rule on `main`. The §P cue must specify, exactly:
   - require the status check by its **contextual check-run name** (= the **job id**, `web-ci`; a wrong
     name silently attaches enforcement to nothing);
   - **"require a PR before merging"** AND **"include/do-not-allow-bypass for administrators"** (else a
     repo admin — the very person who seals — pushes past the required check);
   - **Tension to surface (do NOT gloss):** requiring a PR/required-check **forbids the cadence's current
     direct-push-to-`main` seal flow** for *every* remaining direct-push seal in the queue (~10 chunks) —
     the operator must accept switching seals to a PR-merge flow. (GitHub's required-status-check is
     incompatible with direct-push *as such*: the check can't have passed on a SHA that doesn't exist
     until pushed.)
   - **Non-git bypass lockdown:** `vercel deploy --prod`, **promote-a-preview** (`vercel promote`/
     dashboard), and **Deploy Hooks** each reach prod **bypassing `main` and the gate entirely.** Add to
     §P: lock production to git-`main` + branch protection and disable/forbid CLI prod deploys + preview
     promotion (or explicitly accept + document them as out-of-band). **Drop any absolute "no bypass"
     framing.**

   The build **may** embed the exact `gh api` command for the operator, but must wrap it in a fenced
   block prefixed **"OPERATOR-ONLY — do not execute"**, must **NOT** run it (it mutates repo settings +
   changes the team's workflow; `gh api` is non-allowlisted and `gh` is authed so it would *succeed*),
   and must **NOT** claim "deploys are now blocked" on the strength of the YAML alone.

   *Optional `vercel.json` `ignoreCommand`:* **default DECLINE** (it runs on Vercel, would need to query
   GH Actions status → extra secret + a CI-still-running race; roadmap says minimal). Adding it at all is
   an **ask-first** action per directive (d) — never self-author it.

**Failure mode if mis-decided:** workflow green, check exists, everyone believes the money surface is
gated — but production still deploys un-tested code. Passes every test, still wrong.

### LBD-2 — clean-CI build gotcha: `tsc`/`vitest` are green LOCALLY for TWO reasons absent in CI
Local green (F2) rests on **two artifacts a fresh `actions/checkout` does NOT have**, and the gate must
regenerate **both** before typecheck/test:

- **(a) `.next/types/routes.d.ts`** — `apps/web/next-env.d.ts:3` hard-references it. Absent in CI →
  `tsc` fails `TS6053`. **Fix:** run **`npx next typegen`** first (F4 — fast, secret-free, exit 0).
- **(b) `packages/{client,langchain,mcp,rails}/dist/`** — `apps/web` imports these four `@settlegrid/*`
  packages in **90 source files** (incl. money routes ap2/settle, ap2/verify, proxy/[slug], chat). They
  resolve **only via built `dist/`** (their `package.json` `exports` are dist-only — no `src`/dev
  condition; `tsconfig`/`vitest.config` alias only `@→src`, never `@settlegrid/*`). `dist/` is
  **gitignored, 0 git-tracked files**, and **none has a `prepare`/`postinstall`** (only `prepublishOnly`,
  which `npm ci` does not run) → **`npm ci` never builds them.** In a clean clone, bare `tsc` =
  **exit 2 / 62× TS2307** and `vitest` = **"Failed to resolve entry for package '@settlegrid/mcp'"**
  across many of the 218 files. **Fix (F-A, proven green):** run **`npx turbo run build
  --filter=@settlegrid/web^...`** (repo root) **before** typegen/tsc/lint/vitest. The fleet already does
  this (F8: `template-quality.yml` builds `@settlegrid/mcp` first).

This is the **false-green/toothless-control** trap: green locally because the dev box happens to have
`.next/` + `dist/`. The first draft caught only (a) and missed (b) — the structurally identical, larger
case. **A plan that runs bare `tsc`/`vitest` without the deps-build is RED on its first CI run** → pressure
to `continue-on-error`/drop the steps → gutted gate.

### LBD-3 — the vitest baseline itself is a false-green: tests read DELIBERATELY-gitignored docs
**(NET-NEW — caught only by the clean-clone run; even §4 F1's original "5053 green" was wrong.)** At least
3 existing tests `readFileSync` docs that are **intentionally gitignored** (`.gitignore:14` *"Sensitive/
internal docs — NEVER commit"*; `:119` `docs/legal/` blanket-ignored with a 4-file public allowlist;
`:105` `docs/launch/` internal):
- `apps/web/src/__tests__/privacy-notice-regression.test.ts` → `docs/legal/stripe-dpa-status.md`
- `apps/web/src/lib/__tests__/compliance-docs.test.ts` → `docs/legal/{ofac-program,ofac-training-log}.md`
- `apps/web/src/app/__tests__/compare-nevermined.test.ts` → `docs/launch/show-hn-response-kit.md`

These are present on the dev disk but **untracked + gitignored**, so they ENOENT in **any** fresh clone
(exit 1: 3 suites fail / ~104 of their tests never run). **Blast radius:** ~8 test files `readFileSync`
from `docs/`; ~14 referenced docs are untracked — only 3 fired this run, others can flip red later.

**RESOLUTION (operator-chosen 2026-06-30 — skip-if-absent; do NOT commit the sensitive docs):** add an
**`existsSync` guard** to **every** test that reads a `docs/` path not guaranteed-tracked, so the test
**SKIPS** (via `it.skip`/`describe.skip` or an early guarded return) with a clear reason when the doc is
absent — instead of failing. This: honors the never-commit-sensitive-docs policy; preserves **full test
teeth on any machine that HAS the docs** (the founder's dev box); makes CI **honestly green with a
**visible skip count** (the §11(a) evidence model captures skips, so a reviewer sees exactly what was
skipped). The guard edits are **CI-enablement, not logic changes** — but they touch test files authored
by the honest-claims-sweep chunk, so they join this chunk's INCLUDE commit set (§8). **Sweep ALL
doc-reading tests, not just the 3 that fired**, or another flips red later.

**Failure mode if mis-decided:** the gate is RED on its first CI run for a doc-coupling reason → either
someone commits a sensitive compliance doc (policy breach / data leak) or guts the test step.

---

## 6. Build plan (the builder executes this; it owns minor choices)

**Deliverable A — the workflow** `.github/workflows/web-ci.yml`:
- `name:` `web-ci`; single job id **`web-ci`** (this is the check-run name the §P branch-protection cue
  must reference — keep it stable).
- `on:` **both** `push:{branches:[main]}` **and** `pull_request:{branches:[main]}`. **No path filter** —
  `apps/web` imports `packages/**`, so an `apps/web/**`-only filter would miss a regression in a shared
  package; and a `paths:` filter on a **required** check is a known GitHub footgun (a PR not touching the
  filtered paths leaves the required check stuck-pending → merge blocked). State the choice. (Cost: every
  direct-push seal — incl. docs-only — runs full CI ~2–4 min; acceptable, and the no-filter choice is
  what keeps the future required-check non-vacuous.)
- `permissions:{contents:read}`; `concurrency:{group: web-ci-${{ github.ref }}, cancel-in-progress:
  true}` (on rapid direct-push seals this drops the earlier run's verdict — tolerable for a signal gate;
  branch protection moots it).
- One job, `runs-on: ubuntu-latest`, `timeout-minutes:`~15. Steps:
  1. `actions/checkout@v4`
  2. `actions/setup-node@v4` — `node-version:'20'`, `cache:'npm'`
  3. `npm ci` **at repo root** (workspaces install)
  4. **`npx turbo run build --filter=@settlegrid/web^...`** at repo root — **LBD-2(b) fix** (builds the 4
     dep `dist/`; ~6s; secret-free). Keep it deps-only (`^...`), not a full `next build` (see boundary
     below).
  5. **`npx next typegen`** from `apps/web` — **LBD-2(a) fix** (generates `.next/types`).
  6. **`npx tsc --noEmit`** from `apps/web`.
  7. **`npm run lint`** from `apps/web` (→ `next lint`). Default: do **not** fail on warnings (current
     output is warnings-only; failing on them would red the gate day one for pre-existing warnings).
  8. **`npx vitest run`** from `apps/web`.
- The job needs **NO secrets** — keep it that way (steps 4–8 are all secret-free). A secret-free gate
  can't flake on missing secrets and can't leak.

**Deliverable B — LBD-3 skip-if-absent guards:** add `existsSync` guards to every `apps/web` test that
reads an un-guaranteed `docs/` path (start with the 3 in LBD-3; sweep the ~8 doc-reading test files).
Skip with a clear reason when absent; keep the assertion when present.

**Deliverable C — enforcement cue (docs, NOT silent code):** add a **§P operator item** to the roadmap
(or this chunk's seal record) capturing the LBD-1 branch-protection requirement — exact check-run name,
require-PR + include-administrators, the direct-push↔required-check tension, AND the non-git bypass
lockdown — with the exact `gh api` command in an **"OPERATOR-ONLY — do not execute"** fenced block. Do
not enable it yourself.

**Verification the build MUST do (the heart of the chunk):**
- **Green baseline = a fresh `git clone` + `npm ci` + the corrected step sequence**, NOT the dev tree
  (the dev tree is a known false-green — F1/LBD-2/LBD-3). Use the scratchpad for the clone. Run the exact
  CI sequence (steps 3–8) and confirm **exit 0 / all green** (after the LBD-3 guards). Capture the
  normalized vitest digest (pass/skip/fail counts + the skipped-test-id set).
- **Prove the LBD-2 + LBD-3 fixes are load-bearing via the DETERMINISTIC FACTS, not a destructive `rm`
  dance** (do NOT `rm -rf .next`/`packages/*/dist` in the dev tree, and note a nested `git worktree`
  won't reproduce the dist failure — npm-workspace symlinks resolve `@settlegrid/*` back to the main
  tree's built `dist/`). The facts are already proven and re-checkable read-only: `git check-ignore` +
  `git ls-files` (dist & docs untracked/ignored), the dist-only `exports`, the absent `prepare` hooks,
  `next-env.d.ts:3`. The fresh-clone green run is the empirical confirmation the FIXED gate works; the
  facts are the proof it would otherwise be RED.
- Optionally validate the YAML parses (Read-based structural review; `actionlint` would prompt — nice to
  have, not required).
- The build cannot run GitHub Actions locally — the fresh-clone run is the faithful CI sim; the first
  real CI run is also the node-20 proof (F10).

---

## 7. Scope boundaries (reject creep / gold-plating)
- **IN:** one `web-ci.yml` gating `apps/web` typecheck+lint+vitest (with the LBD-2 deps-build prepended)
  on push/PR to main; the LBD-3 skip-if-absent test guards; the §P enforcement cue; chunk docs; the G4-1
  roadmap tick.
- **OUT (do NOT build):** a full `next build` in the gate (deps-build only — keeps it fast + secret-free;
  a `next build` failure is **fail-safe** anyway: Vercel rejects the deploy, code doesn't ship — document
  this, don't gate on it); running the **packages' own** vitest suites (`turbo run test ...`) — the gate
  covers `packages/**` only as `apps/web`'s tests exercise them; state this coverage boundary, don't
  expand it; a dedicated SSRF e2e network suite (separate future chunk); all-package/turbo-wide CI; a
  `vercel.json` `ignoreCommand` (default-decline; adding it is **ask-first** per (d)); committing any
  gitignored doc (LBD-3 forbids it); authoring NEW regression tests (other chunks own theirs — this chunk
  only makes the runner + guards existing tests for CI).
- **Do NOT** silently enable branch protection, push to main, or edit `vercel.json` deploy behavior
  (operator gates).

---

## 8. Commit hygiene (explicit include / exclude)
**Stage with an EXPLICIT PATHSPEC — never `git add -A`/`git add .`** (the build must emit the literal
`git add <paths>` line in its manifest so ② can eyeball that nothing else was staged).
**INCLUDE in the chunk commit:** `.github/workflows/web-ci.yml`; the LBD-3-guarded test files (e.g.
`apps/web/src/__tests__/privacy-notice-regression.test.ts`,
`apps/web/src/lib/__tests__/compliance-docs.test.ts`,
`apps/web/src/app/__tests__/compare-nevermined.test.ts`, + any other doc-reading test the sweep guards);
this handoff + the ②/③ records; the roadmap G4-1 tick (at seal); the §P cue addition.
**EXCLUDE (pre-existing uncommitted — leave untouched, do not stage):**
`apps/web/src/app/(dashboard)/dashboard/tools/page.tsx`,
`docs/SECURITY-INCIDENT-2026-06-15-exposed-pg-credential.md`, `.claude/`,
`docs/tech-debt/launch-gate-queue.md`, `docs/tech-debt/v-n3-mfa-unenroll-hardening-handoff-2026-06-27.md`,
`scripts/mfa-delete-smoke.sh`. (Same exclude set the prior seals carried.)

## 9. Seal bookkeeping (do at ② seal, not during build)
On seal, tick **G4-1** `☐→☑` in `LAUNCH-GATE-roadmap-2026-06-27.md:95`, then run
`.claude/launch-gate-check.sh` (PostToolUse hook auto-recounts; do not hand-edit). Verified: ticking G4-1
moves open **17→16** (the script counts `^| G[0-9]` rows before the §P header; the 3 `➖` MOOT rows are
correctly excluded).

## 10. Chunk lifecycle
scope-confirm ✓ → draft plan ✓ → **pre-build plan audit (this session — DONE, 2 CRITICAL + folded)** →
build → executable gate (fresh-clone green, steps 3–8) → ② seal-gating review → seal + bookkeeping (§9)
→ ③ post-seal deep audit.

---

## 11. Build directives (carry verbatim into the build session)
(a) **Self-verify at intervals with fresh-context subagents**, not self-critique. The verifier returns
positive EVIDENCE: the exact gate command(s), exit code(s), and a NORMALIZED digest (exit code + canonical
pass/skip/fail counts + the test-id set incl. the **skipped** ids; strip timestamps/durations/paths; a
raw summary hash is NOT an acceptable key). Any evidence-free "green" = RED. `git`, `npx tsc`, `npx
vitest`, `npm run lint` are session-allowlisted; **`npx next typegen` and `npx turbo run build` are NOT —
they PROMPT** (foreground: approve once; a fresh SUBAGENT cannot satisfy the prompt → run those two
yourself in the foreground and have the subagent AUDIT the produced evidence: gate-runner ≠ verifier).
Verify `CLAUDE_CODE_FORK_SUBAGENT` is unset at the start of each verification pass (it's currently unset;
`=1` forces background auto-deny and breaks the subagent path).
(b) **Ground every claim in a tool result from this session.** Run the real command; never report "looks
done." The green baseline is the fresh-clone run, not the dev tree.
(c) **Act once you have enough to act** — no re-deriving settled facts (§4), no surveying options you
won't take.
(d) **Calibrate autonomy:** own minor choices (workflow `name` cosmetics, whether lint-warnings fail, job
timeout, the exact skip-guard idiom) and note them; for scope changes or irreversible/outward actions
(enabling branch protection, pushing, editing `vercel.json` deploy behavior, committing any gitignored
doc) **ask first**.
(e) **Delegate + search explicitly:** fan out to fresh-context subagents for independent checks
(YAML-structural review vs fresh-clone gate-green are independent); search the repo when a convention
isn't known (sweep ALL doc-reading tests for LBD-3). Trigger: parallelizable verification → subagents;
unknown convention → search.
(f) **Don't over-narrate** — silence between routine tool calls; lead the final summary with the outcome.
(g) **Don't stop the WORK on account of context** (the harness manages it) — but DO honor the standing
context-degradation alert if it triggers.
(h) **End with a cadence-status report when the gate is green** — attach the interval self-verification
EVIDENCE (gate commands + exit codes + normalized digest incl. skip set) + a short diff/build manifest
(incl. the literal `git add` pathspec line) so ② can confirm the gate ACTUALLY RAN from a clean state.
Evidence-free green = RED.
(i) **Escalate effort only for a genuinely hard sub-problem** (none expected — this is config infra +
mechanical test guards). The build runs at the session's pinned `xhigh`. If a real snag appears, queue an
operator `/effort max` for that stretch then revert (you can't switch effort yourself); don't stall —
note it, proceed at `xhigh`, flag for ②.

---

### Quick reference — the AUDIT-CORRECTED gate (builder confirms each leg green from a fresh clone)
```yaml
name: web-ci
on:
  push: { branches: [main] }
  pull_request: { branches: [main] }
permissions: { contents: read }
concurrency: { group: web-ci-${{ github.ref }}, cancel-in-progress: true }
jobs:
  web-ci:                                   # <- this id is the branch-protection check-run name
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'npm' }
      - run: npm ci                                          # repo root (workspaces)
      - run: npx turbo run build --filter=@settlegrid/web^...# LBD-2(b): build dep dist/ (~6s, secret-free)
      - run: npx next typegen
        working-directory: apps/web                          # LBD-2(a): generate .next/types
      - run: npx tsc --noEmit
        working-directory: apps/web
      - run: npm run lint
        working-directory: apps/web
      - run: npx vitest run
        working-directory: apps/web                          # green only after LBD-3 skip-guards
```
*(Shape only — verify each leg is green from a pristine `git clone`, with the LBD-3 guards in place,
before committing. Default-job working-directory vs per-step `working-directory` is the builder's call;
`npm ci` + `turbo run build` run at root, the rest in `apps/web`.)*

---

## 12. §P OPERATOR ENFORCEMENT CUE — branch protection (Deliverable C; **the build did NOT execute this**)

> **Why this section exists (LBD-1).** The `web-ci.yml` workflow, by itself, does **NOT** block a bad
> deploy. A GitHub Actions run races Vercel's git auto-deploy; a red/green check does not stop Vercel
> from shipping `main`. The workflow produces a **post-hoc signal** (a stable `web-ci` check). The thing
> that actually *blocks un-tested code from prod* is a **GitHub branch-protection rule on `main`** that
> **requires** that check. Enabling it **changes repo settings and the team's seal workflow**, so it is an
> **operator decision — the build did not run it.** Do **not** read "`web-ci` is green" as "the deploy was
> gated" until this is in place.

**What the operator must enable (all four — a partial config is silently toothless):**

1. **Require the `web-ci` status check.** The required context is the **check-run name**, which equals the
   job's `name:` — kept deliberately identical to the job **id `web-ci`** in `web-ci.yml` (a descriptive
   job name would make the real check-run name a longer string and the `context: "web-ci"` below would
   then **attach enforcement to nothing**). If you rename the job, update this context in lockstep.
2. **Require a pull request before merging** (`required_pull_request_reviews`). A required status check is
   technically incompatible with direct-push *as such*: the check cannot have passed on a SHA that does
   not exist until it is pushed. So requiring the check **forces a PR-merge flow.**
3. **Include administrators** (`enforce_admins: true`). Without this, a repo admin — the same person who
   runs `/seal-go` — can push straight past the required check, which defeats the entire gate.
4. **Lock the non-git bypass paths.** Branch protection only governs **git → `main`**. These reach prod
   **without touching `main`** and thus **bypass the gate entirely** — each must be disabled or explicitly
   accepted-and-documented as out-of-band:
   - `vercel deploy --prod` (CLI prod deploy),
   - **promote-a-preview** (`vercel promote` / the dashboard "Promote to Production" button),
   - **Deploy Hooks** (the webhook URLs that trigger a prod build).
   Lock production to **git-`main` + branch protection** and disable/forbid CLI prod deploys + preview
   promotion, **or** record them as a known, accepted out-of-band path. (Do **not** frame this as an
   absolute "no bypass" — promotion and hooks are legitimate features; the point is they must be a
   conscious choice, not an unmonitored hole.)

> ⚠️ **TENSION THE OPERATOR MUST ACCEPT (do not gloss).** Requirements (2)+(3) **forbid the cadence's
> current direct-push-to-`main` seal flow** for **every** remaining direct-push seal in the launch-gate
> queue (~10 chunks). Turning this on means switching all future seals to a **PR-merge flow**. That is a
> real workflow change, not a no-op — accept it deliberately before enabling, or defer enabling until the
> queue is ready to switch. (The `web-ci` workflow itself is harmless to ship now and starts producing the
> signal immediately via its `push:[main]` leg; only the *enforcement* below carries the tension.)

**Optional `vercel.json` `ignoreCommand` — DEFAULT DECLINE.** It runs on Vercel and would need to query
GitHub Actions status (extra secret + a CI-still-running race), and the roadmap wants this minimal. Adding
it at all is an **ask-first** action — it was **not** authored by this build.

```bash
# ╔═══════════════════════════════════════════════════════════════════════════╗
# ║  OPERATOR-ONLY — DO NOT EXECUTE FROM THE BUILD.                            ║
# ║  This MUTATES repo settings AND changes the team's seal workflow (see the  ║
# ║  TENSION note above). `gh` is authed in-session, so it WOULD succeed —     ║
# ║  that is exactly why the build must not run it. Run it yourself, knowingly.║
# ╚═══════════════════════════════════════════════════════════════════════════╝
# Requires: the `web-ci` workflow merged to main + at least one completed run so
# GitHub knows the `web-ci` check-run context exists.
gh api -X PUT repos/lexwhiting/settlegrid/branches/main/protection \
  --input - <<'JSON'
{
  "required_status_checks": {
    "strict": true,
    "checks": [ { "context": "web-ci" } ]
  },
  "enforce_admins": true,
  "required_pull_request_reviews": { "required_approving_review_count": 1 },
  "restrictions": null,
  "required_linear_history": false,
  "allow_force_pushes": false,
  "allow_deletions": false
}
JSON
# Verify afterwards:
#   gh api repos/lexwhiting/settlegrid/branches/main/protection \
#     --jq '{checks: .required_status_checks.checks, admins: .enforce_admins.enabled, pr: .required_pull_request_reviews}'
# Expect: checks=[{context:"web-ci",...}], admins=true, pr present.
```

**Failure mode if mis-decided:** workflow green + `web-ci` check exists + everyone believes the money
surface is gated — but production still deploys un-tested code (no branch protection, or it required the
wrong context name, or a `vercel promote` slipped past it). Passes every test, still wrong.
