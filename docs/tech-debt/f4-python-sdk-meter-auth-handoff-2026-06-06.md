# (F4) Python SDK family — `/meter` authentication + validate-path repair — CHUNK HANDOFF (2026-06-06)

> **Self-contained handoff for a FRESH session. Read this end-to-end before touching anything.**
> SettleGrid settles **real USDC** (x402 + circle-nano LIVE on Base mainnet; ap2 LIVE as a verification
> facilitator) → use `/effort max`. This chunk is **client-side only** (the Python SDK family) — the
> server money path is **byte-stable, read-only** — but it is the auth-correctness completion of the (F2)
> metering chunk, so the same gate discipline applies: **discovery trace FIRST → build plan → deep
> independent PRE-BUILD AUDIT (PLAN_READY, 0 blocking, ALL fixes applied) BEFORE any implementation →
> single-writer build → post-build panel + certification (0 blocking) → founder-gated LOCAL commit.**
> NOTHING ships (push / prod-env / migration / **PyPI publish**) without the founder's explicit word.

---

## 0. Why this chunk (the scope study — 2026-06-06)

(F2) closed the server-side gap (local commit `2b479a3e`, NOT pushed): `POST /api/sdk/meter` (+ the
`meter-with-metadata` twin) now **require** the consumer API key as an `X-Api-Key` header, hash it, look
up the active `api_keys` row, and reject any `keyId/consumerId/toolId` not owned by that key — before any
credit/record/revenue effect. The TS SDK (`@settlegrid/mcp` 0.3.0) sends the header. The **Python SDK
family was founder-deferred** (F2 decision F-D1) and recorded as **F4** in the DEBT register.

**The pre-handoff study found F4 is MORE broken than the register records — three confirmed defects:**
1. **Post-F2 meter 401 (the recorded F4):** the Python core sends the meter body WITHOUT the key
   (`packages/sdk-python/settlegrid/client.py:208/:233`) → against an F2 server every Python meter call
   is **401** → `InvalidKeyError`.
2. **PHANTOM validate path (NEW finding):** the core calls `"/keys/validate"` (`client.py:156/:170`) →
   `/api/sdk/keys/validate`. **That route does not exist** — `apps/web/src/app/api/sdk/` contains exactly
   `meter`, `meter-with-metadata`, `test-validate`, `validate-key`, and there is **no rewrite/alias** in
   `next.config.*`, `src/middleware.ts`, or `vercel.json` (grepped 2026-06-06). The real path is
   `/validate-key`. A 404 maps to `SettleGridUnavailableError` (`_http.py:195-200`) → **`validate_key`
   and therefore the whole `wrap()` pipeline dies BEFORE metering, against production TODAY.** The
   Python suites are green only against their own respx mocks of the phantom path (45 refs across 6 core
   test files + all 6 wrappers' test files).
3. **Response-model strictness hazard (NEW finding, trace must finalize):** Python `KeyValidationResult`
   (`_types.py:78-89`) is `strict=True, extra="forbid"` with required `consumerId/toolId/keyId/
   balanceCents` — but the REAL `validate-key` route returns an **extra `isTestKey` field** on success
   (`validate-key/route.ts:115-123, :146-153`) and `{valid:false, reason}` **without** the required
   fields on failure (`:63` etc.). Even after re-pathing, `model_validate` may raise `ValidationError`
   on both shapes. The trace must confirm and the plan must reconcile the model (this is part of making
   validate actually work — not scope growth).

**Conclusion: the Python SDK family has in all likelihood NEVER worked against the deployed server**
(consistent with the prod inventory: 0 live SDK traffic). F4 = *make the Python SDK family actually work
against the real, F2-authenticated server*: fix the validate path + reconcile the response model + send
`X-Api-Key` on `/meter` + update the 7 packages' tests/versions. All client-side; **zero server diff**.

**Why F4 over the alternatives (Step-0 scope decision, 2026-06-06):**
- **B4** (settlement-row account attribution; committed handoff
  `docs/tech-debt/b4-settlement-account-attribution-handoff-2026-06-04.md`, ⚠️ verified TRAP at
  `reconcile.ts:129`) is the other live thread — but it is a **heavier server-side money chunk**. Close
  the SDK auth story first (F2→F4 are one arc); B4 is the natural NEXT chunk after F4.
- **F4 unblocks the F2 deploy**: once F4 lands, the founder can push F2 + publish both SDKs as one
  coherent contract change. F4 must land **before any Python consumer onboards**.
- **(K)** HMAC-pepper stays DE-recommended (F2 handoff §0). **F1** conditional (NAT throttling not
  observed). **F3** trivial hygiene. **(C)/(A)/(H)** hygiene/externally-gated.
- Dormancy window still holds (0 funded balances, 0 live traffic) and this chunk can't touch funds anyway
  (client-only).

---

## 1. CONFIRMED facts vs. what the TRACE must establish

**CONFIRMED (read this session, 2026-06-06, at HEAD `2b479a3e`) — re-verify, don't trust line numbers:**
- **Server contract (READ-ONLY source of truth for the wire shapes):**
  - `apps/web/src/app/api/sdk/meter/route.ts` — the F2 gate at `:59-86`: `x-api-key` header → missing/
    `<16` → `401 API_KEY_REQUIRED`; `hashApiKey(rawKey)` → `api_keys` row by unique `key_hash`; no row /
    `status!=='active'` → `401 INVALID_API_KEY`; `keyRow.id/consumerId/toolId` ≠ body → one generic
    `403 KEY_BINDING_MISMATCH`. Body schema unchanged (`:33-43`): `{toolSlug, consumerId, toolId, keyId,
    method, costCents, latencyMs?, isTestKey?, referralCode?}`.
  - `apps/web/src/app/api/sdk/validate-key/route.ts` — body `{apiKey, toolSlug}`; success returns
    `{valid, consumerId, toolId, keyId, balanceCents, isTestKey}` (`:115-123` test keys w/ 999999,
    `:146-153` normal); failure returns `{valid:false, reason}` (`:63,:70,:75,:80,:87`).
- **Python core (`packages/sdk-python/settlegrid/`):**
  - `client.py:47` `SDK_VERSION = "0.1.0"`; `:125` `user_agent=f"settlegrid-python/{SDK_VERSION}"`;
    `pyproject.toml:7` `version = "0.1.0"`; `__init__.py:41` `__version__ = SDK_VERSION`.
    (`_http.py:118` has a dataclass default `user_agent: str = "settlegrid-python/0.1.0"` — client.py
    overrides it; trace must confirm whether the default is dead code and whether anything pins it.)
  - `client.py:156/:170` — `validate_key`/`validate_key_async` POST **`"/keys/validate"`** (the phantom).
  - `client.py:180-219` `meter` / `:221-244` `meter_async` — POST `"/meter"` with body `{toolSlug,
    consumerId, toolId, keyId, method, costCents}`; **NO key on the wire**; `api_key` is the 1st arg of
    both (in scope). `_types.py:53-72` `MeterRequest` docstring records `api_key` was deliberately
    REMOVED once ("Zod silently strips it") — the F2 server now requires it as a HEADER.
  - `_http.py:316-368` `request`/`request_sync` → `client.post(full_path, json=body)`; headers are
    client-level only (`:282-302`: `Content-Type` + `User-Agent`). **No per-request header support yet**
    — the change point (mirror TS `apiCall`'s additive `extraHeaders` param).
  - `wrap.py:216/:252/:358/:376` — all meter callsites go through the **public** `sg.meter`/
    `sg.meter_async` with `api_key` passed → wrap.py likely needs **zero** changes (trace confirms).
- **Core tests:** 11 files in `packages/sdk-python/tests/`. `keys/validate` mocked in 6 files (45 refs:
  `test_wrap.py` ×17, `test_http.py` ×12, `test_apicall_edge.py` ×6, `test_client.py` ×6,
  `test_defensive_paths.py` ×2, `test_sdk_validation.py` ×2). `/meter` mocked extensively (test_wrap,
  test_http, test_apicall_edge, test_client, test_sdk_validation). **The path fix FORCES all validate
  mocks to move** (respx unmatched-route behavior — trace confirms strictness).
- **The 6 wrappers** (`packages/sdk-python-{crewai,smolagents,dspy,langchain,pydantic-ai,llamaindex}`):
  ALL delegate to the core (`from settlegrid import SettleGrid`; no wrapper builds a meter/validate body
  in runtime code — refs are ONLY in their tests). Deps pin `"settlegrid>=0.1.0"` (crewai
  `pyproject.toml:27`, langchain `:34`; trace verifies the other 4) → compatible with a core bump, no
  wrapper dependency edits expected. Versions all `0.1.0` (pyproject `:7` + `__init__.py` `__version__`).
  Test files: `tests/test_tool.py` ×5 + `settlegrid_langchain/__tests__/test_tool.py` (nonstandard
  location). Each wrapper's tests mock BOTH `/api/sdk/keys/validate` and `/api/sdk/meter` → **forced
  test edits in all 6**.
- **Toolchain:** system `/usr/bin/python3` is **3.9.6** — BELOW `requires-python = ">=3.10"` — and its
  user-site pytest **INTERNALERRORs** on collection (`Unknown config option: asyncio_mode`). **Do NOT
  use it.** `uv 0.11.7` is available at `~/.local/bin/uv` — use uv to provision per-package envs. Dev
  extras exist (core `pyproject.toml:43-49`: pytest≥8, pytest-asyncio, pytest-cov, pytest-mock,
  respx≥0.20).
- **No version-pinned test strings found** in core/crewai/langchain test dirs for `0.1.0` — but the F2
  R1 audit's sole blocking finding was exactly a missed version-pinned test, so the trace must do the
  exhaustive sweep across all 7 packages (incl. `test_exports.py`, `test_sdk_validation.py` semver/
  equality assertions on `__version__`/`SDK_VERSION`).

**THE TRACE MUST ESTABLISH (each grounded in file:line, written to
`docs/tech-debt/f4-python-sdk-meter-trace-2026-06-06.md`):**
1. **Runner recipe + GREEN baselines for all 7 Python suites BEFORE any edit** (e.g. per package:
   `uv venv && uv pip install -e '.[dev]'` + `uv run pytest`, or `uv run --extra dev pytest` — finalize
   the exact incantation per package; wrappers also need their framework deps installable). Record exact
   pass/skip counts. **If any suite is RED or un-runnable at baseline, STOP and surface to the founder
   before proceeding** — do not silently fix unrelated reds, and do not build on an unverifiable
   baseline.
2. **httpx header semantics:** per-request `headers=` on `client.post` MERGES with client-level headers
   (Content-Type/UA survive unless overridden) — confirm against the installed httpx version + cover
   with a test.
3. **The full internal call graph:** every `_http.request*` caller (validate ×2, meter ×2, anything
   else?); every `validate_key`/`meter` caller (wrap.py paths, any telemetry/heartbeat); any OTHER
   phantom path in the family.
4. **Response-model reconciliation (finding #3):** exactly how `KeyValidationResult`
   (strict, extra="forbid", required fields) behaves against the REAL `validate-key` success shape
   (extra `isTestKey`) and failure shape (`{valid:false, reason}`, missing fields). Design the minimal
   fix (e.g. add optional `is_test_key`/`reason` fields, or relax `extra` for that model only) WITHOUT
   weakening MeterRequest/MeterResult strictness. Also check `MeterResult` against the real meter
   success/test-mode/zero-cost response shapes (`billed`, `reason`, `isFlagged` extras —
   `meter/route.ts:181-189, :215-221, :320-326, :415-421`).
5. **Version-pinned strings/tests across ALL 7 packages** (the F2 lesson): every `0.1.0` /
   `SDK_VERSION` / `__version__` assertion that the bump forces (and the do-NOT-touch set, e.g. pure
   semver-regex tests).
6. **Wrapper test inventory:** every `keys/validate` and `/meter` mock per wrapper that must move/gain
   header assertions; whether respx strict mode makes the path fix loudly break each suite (expected:
   yes — that proves the edits are forced, not optional).
7. **Backward/forward-compat matrix, honestly stated:** new Python SDK vs OLD deployed server (no F2:
   extra header is ignored — harmless; validate now hits the REAL path — works) and vs NEW server
   (works). Old Python SDK vs either (broken at validate — already true today). State that the fix is
   safe to land independently of the F2 deploy.
8. **Docs/readme surfaces** referencing the Python wire shapes (each package README, any docs page) —
   doc-only updates, enumerate.

---

## 2. Ground state + pre-flight (verify before touching anything)
- Repo `/Users/lex/settlegrid`, branch `main`. **HEAD = `2b479a3e`** ("(F2) authenticate sdk/meter…",
  LOCAL, NOT pushed) on top of `aa580355` ((N), local). Working tree clean (`.audit/` is gitignored).
  Confirm: `git -C /Users/lex/settlegrid status -sb && git log -3 --oneline`.
- **TS baselines (must stay BYTE-UNTOUCHED by this chunk; re-run to anchor):** `cd apps/web`:
  `npx tsc --noEmit` (**0**) · `npx vitest run` (**4261 pass / 180 files**) · `npx next build` (**0**;
  not concurrent with tsc). `cd packages/mcp`: `npx vitest run` (**1898 pass / 1 skip**) ·
  `npm run build` (**tsup+DTS 0**). The F4 diff must contain **zero** hunks under `apps/web/` or
  `packages/mcp/`.
- **Python pre-flight (the §1-Q1 baselines):** provision via **uv** (NOT system python3.9); 7 suites
  green + counts recorded BEFORE any edit.
- **Shell is zsh:** `cd` persists across calls; quote bracketed paths (`'…/[slug]/…'`) — though this
  chunk should never touch one.
- **Real-money guardrails:** do NOT push, set/change prod env, apply migrations, or **publish to PyPI**
  (all founder-gated). Any DB access read-only (none expected). Demo/sandbox must never reach a real
  settle (not in scope anyway).

## 3. DECIDED scope (Step-0, 2026-06-06) + SCOPE GUARD
- **In scope:** `packages/sdk-python` core — (a) validate path `"/keys/validate"` → `"/validate-key"`
  (2 callsites); (b) `X-Api-Key` header on `/meter` via an additive per-request-headers param on
  `_http.request`/`request_sync` (mirror the TS `apiCall extraHeaders` design from F2); (c) the minimal
  `_types.py` response-model reconciliation the trace confirms (validate success/failure shapes);
  (d) version bump `0.1.0 → 0.2.0` (SDK_VERSION + pyproject + any derived/pinned strings) + CHANGELOG if
  one exists; (e) core test updates (mocks re-pathed; meter header assertions; each new test fails on
  pre-fix code). **The 6 wrappers** — test-file updates only (re-path validate mocks, add meter header
  assertions); wrapper runtime/source/dependency edits ONLY if the trace proves one necessary. Docs-only
  register/capstone/memory updates.
- **OUT of scope (byte-stable — the diff must not touch):** **ALL of `apps/web`** (the F2 gate, both
  meter routes, `validate-key`, openapi — READ-ONLY contract references); **ALL of `packages/mcp`**
  (TS SDK 0.3.0 — done); `lib/metering.ts`, `lib/pricing.ts`, `lib/settlement/**`, `proxy/[slug]`,
  `x402/* ap2/* circle-nano/* outcomes/* settlements/* cron/*`, `lib/rate-limit.ts`,
  `lib/middleware/auth.ts`, schema/migrations; F2's settled design (X-Api-Key header transport, 401/403
  taxonomy, meter body shape — re-litigating any of these requires a NEW trace); PyPI publishing; any
  Python-SDK refactor beyond the listed fixes (no http-client rewrites, no type modernization, no retry
  redesign). **When in doubt, the smaller change wins.**

---

## 4. THE ARC — six phases. Phases 1→3 MUST complete (audit PLAN_READY, 0 blocking, all fixes) before ANY build code.

### Phase 1 — MANDATORY DISCOVERY TRACE (no plan without it)
Produce `docs/tech-debt/f4-python-sdk-meter-trace-2026-06-06.md` answering §1's eight questions, each
grounded in file:line read that session. Re-derive every number in this handoff (line numbers drift).

### Phase 2 — BUILD PLAN
Write `docs/tech-debt/f4-python-sdk-meter-auth-build-plan-2026-06-06.md` (status DRAFT until the audit
passes): goal + honest value framing (this makes the Python family work at all, not just adds auth);
the trace's conclusions; the fix design with EXACT per-file recipes (core source ×~4 files, core tests
×~6 files, wrapper tests ×6 files, version sites); the byte-stable spine list (§3); behavioral deltas
(incl. the compat matrix); the test plan (**each new/changed test must FAIL on pre-fix code**; mocks
moved, never weakened); the machine gates — all 7 Python suites green with recorded counts, `git diff
--numstat` confined to `packages/sdk-python*` + docs (ZERO `apps/web`/`packages/mcp` hunks), TS
baselines re-run unchanged (4261 / 1898/1) as the untouched-proof; the rollout note (founder-gated:
F2 push + PyPI publish sequencing); an embedded **SCOPE GUARD** (§3 verbatim).

### Phase 3 — MANDATORY DEEP, INDEPENDENT PRE-BUILD AUDIT (the founder's hard gate)
**No implementation code until the build plan is audited PLAN_READY (0 blocking) with ALL fixes applied.**
- **Mechanism:** a dynamic `Workflow` fan-out (NOT a hand-audit). Adapt
  `.audit/f2-prebuild/prebuild-audit.mjs` → `.audit/f4-prebuild/prebuild-audit.mjs`. That script already
  carries the **hardened tail** (null-guard + inline degraded fallback so a dead synthesizer can never
  crash the run or fake a pass) — KEEP it. Shape: N fresh-context lenses that **re-derive the plan's
  claims against the actual code** → **adversarial verify** of every finding (default-refuted) → guarded
  synthesis at **PLAN_READY / 0 blocking**. Suggested 5 lenses: (a) **wire-contract correctness** — the
  plan's paths/header/shapes vs the REAL server source (`meter/route.ts` gate, `validate-key/route.ts`
  responses), incl. the model-reconciliation design; (b) **Python-side factual accuracy** — every
  file:line, the call graph, httpx header-merge semantics, wrap.py zero-change claim; (c) **test
  sufficiency + forced-edit completeness** — the F2 lesson: exhaustively hunt path-pinned AND
  version-pinned assertions across all 7 packages; every new test must fail pre-fix; no mock weakened;
  (d) **toolchain/baseline integrity** — the uv recipe works, 7 suites' baseline counts are real, the
  plan's end-state arithmetic is right; (e) **scope boundary** — zero `apps/web`/`packages/mcp` hunks,
  no SDK refactor creep, no PyPI/publish action.
- **Run the audit twice if it finds blockers:** R1 → apply ALL fixes to the plan → R2 must be PLAN_READY
  0-blocking (precedents: (N) and (F2) both went R1 `PLAN_NEEDS_FIXES` → R2 `PLAN_READY`).
- **DEGRADED-RUN GUARD:** before trusting any verdict, confirm ALL lenses produced output and no
  verify-verdict is null (a dead lens silently yields zero findings → fake PASS). The hardened script
  surfaces `deadLenses`/`nullVerdicts`/`degraded` in its return — **a degraded result is NOT a pass.**
- **Transient-death / session-limit recovery:** `Workflow({scriptPath, resumeFromRunId})` replays cached
  agents. **Account session-limit caveat (hit TWICE in this series):** (F2)'s first R2 died wholesale on
  "You've hit your session limit · resets 6pm (America/New_York)" — if that happens, re-run after the
  reset (no usable cache when ALL agents die) or switch accounts per the cross-account memory; if ONLY
  the synthesizer dies, the hardened tail already synthesizes a deterministic fallback verdict inline.
- **⚠️ SPINE-SAFEGUARD / OVER-AUDITING CLAUSE (embed VERBATIM in this gate AND the post-build gate):**
  Objective confidence, NOT finding-count. **Zero findings is a valid outcome.** A finding that grows
  scope is `rejected-scope-expansion`, NOT blocking, unless it proves a PLANNED change is itself wrong.
  Hold the line against: ANY edit to `apps/web` or `packages/mcp`; changing the take model / pricing /
  `deductCreditsRedis` / ledger writes / `balanceCents` authority / dedup / B4; re-keying/raising/
  lowering any limiter or its prefix; re-litigating F2's settled design (X-Api-Key header transport,
  401/403 taxonomy, meter body shape, founder F-D1/F-D2/F-D3) or H1/M/N-settled items (fail-open,
  left-most-XFF, `getClientIp`, `auth.id` keying) without a NEW trace; Python-SDK refactors beyond the
  listed fixes; PyPI publishing. Re-opening a settled decision requires a concrete new trace.
- Record `.audit/f4-prebuild/round{1,2}-verdict.txt` + a `CHECKPOINT.md` (recovery procedures, mirroring
  `.audit/f2-prebuild/CHECKPOINT.md`).

### Phase 4 — BUILD (single-writer)
Implement strictly to the PLAN_READY plan. **Single-writer core** (fan-out is for the audit gates only).
Line-surgical; touch only the planned sites. Per-batch suite runs (the affected package's suite after
each batch; all 7 + TS baselines at the end). Ground every conclusion in actual tool output. If a
wrapper suite proves environmentally un-runnable mid-build, STOP at the batch boundary and surface —
no blind edits to a package whose tests can't run.

### Phase 5 — MANDATORY POST-BUILD PANEL + CERTIFICATION (0 blocking BEFORE any commit)
Client-side chunk → a **security/correctness panel** (not a funds-SEAL), but with a mandatory
**zero-server-diff lens**. Adapt `.audit/f2-postbuild/funds-seal.mjs` → `.audit/f4-postbuild/panel.mjs`
(keep the hardened tail). Lenses: (a) wire-contract correctness of the SHIPPED code vs the real server
source (paths, header, model shapes — incl. a re-derivation that validate now targets `/validate-key`
and meter carries `X-Api-Key`); (b) **ZERO-SERVER-DIFF**: `git diff --name-only` (and `--numstat`)
contains NOTHING under `apps/web/` or `packages/mcp/` and nothing outside `packages/sdk-python*` +
docs; (c) test integrity (each new test fails pre-fix; mocks moved not weakened; baseline arithmetic);
(d) packaging/version consistency (SDK_VERSION ↔ pyproject ↔ user-agent ↔ `__version__` ↔ any pinned
tests); (e) compat-matrix honesty (new SDK × old/new server; old SDK unchanged-broken — documented).
Embed the §Phase-3 SPINE-SAFEGUARD clause verbatim. Degraded-run guard + resume recovery. Record
verdicts to `.audit/f4-postbuild/` + `.audit/f4-certify/`. **0 blocking before ANY commit.**

### Phase 6 — FOUNDER-GATED CLOSE-OUT (nothing ships without the founder's word)
1. **LOCAL commit, path-scoped, atomic** (shared-worktree hazard — never `git add -A`):
   `git add <paths> && git -c user.name="Luther Whiting-Collins" -c user.email="lexwhiting@gmail.com"
   commit -m "<msg>" -- <paths>`, trailer `Co-Authored-By: Claude <model> <noreply@anthropic.com>`
   (match the exact model you run as). **NO push. NO PyPI publish.**
2. **Capstone:** `docs/tech-debt/f4-python-sdk-meter-auth-resolution-2026-06-06.md` (what shipped, all
   three defects, the audit chain R1→R2 + panel/cert verdicts, honest framing, compat matrix, residuals).
3. **DEBT register** (`docs/tech-debt/publisher-api-keys-audit-2026-05-28.md`): mark **F4 RESOLVED**
   (note the phantom-validate + model-strictness findings it absorbed); F1/F3/(K) dispositions stand.
4. **Next-chunk handoff** (Step-0-gated): carry the menu minus F4 — **B4** (committed handoff
   `b4-settlement-account-attribution-handoff-2026-06-04.md`, mind its reconcile.ts:129 TRAP) is the
   natural lead; also note the F2+F4 deploy/publish bundle is now founder-actionable.
5. **Memory:** update `settlegrid-debt-chunks.md` (account memory) pointing at the capstone.

---

## 5. Guardrails (non-negotiable)
- **Single-writer core**; fan-out only for the two audit gates.
- **Ground every conclusion in ACTUAL tool output** (suites run, greps shown — no green-suite vibes).
- **Line-surgical**; §3 byte-stable spine; smaller change wins.
- Do NOT push, change prod env, apply migrations, or publish packages. Read-only DB if any.
- **Flag context degradation the moment it risks quality** (founder standing order). If work outgrows
  context, stop at a phase/batch boundary, write `.audit/f4-prebuild/CHECKPOINT.md` (or update it), and
  recommend a continuation session — partial state is safe by construction.

## 6. File-path index (absolute)
- **This handoff:** `/Users/lex/settlegrid/docs/tech-debt/f4-python-sdk-meter-auth-handoff-2026-06-06.md`
- **Python core (primary target):** `/Users/lex/settlegrid/packages/sdk-python/settlegrid/{client.py,
  _http.py, _types.py, wrap.py, __init__.py}` + `pyproject.toml` + `tests/` (11 files)
- **The 6 wrappers:** `/Users/lex/settlegrid/packages/sdk-python-{crewai,smolagents,dspy,langchain,
  pydantic-ai,llamaindex}/` (tests: `tests/test_tool.py`; langchain:
  `settlegrid_langchain/__tests__/test_tool.py`)
- **Server contract (READ-ONLY):** `apps/web/src/app/api/sdk/meter/route.ts` (F2 gate `:59-86`) ·
  `apps/web/src/app/api/sdk/validate-key/route.ts` · `apps/web/src/app/api/sdk/meter-with-metadata/
  route.ts` · `apps/web/src/lib/crypto.ts` (`hashApiKey`)
- **TS-SDK mirror of the fix (design reference):** `packages/mcp/src/middleware.ts` (`apiCall`
  `extraHeaders` + `meter(context, apiKey)`) — shipped in F2, commit `2b479a3e`
- **F2 record:** `docs/tech-debt/f2-sdk-meter-auth-resolution-2026-06-06.md` (capstone) ·
  `f2-sdk-meter-trace-2026-06-06.md` · `f2-sdk-meter-auth-build-plan-2026-06-06.md` · register
  `publisher-api-keys-audit-2026-05-28.md` (F4 entry) · menu `next-chunk-handoff-2026-06-06-post-f2.md`
- **Audit templates to adapt (gitignored):** `.audit/f2-prebuild/prebuild-audit.mjs` (hardened tail) ·
  `.audit/f2-postbuild/funds-seal.mjs` · `.audit/f2-prebuild/CHECKPOINT.md` (recovery patterns)
- **Toolchain:** `uv` at `~/.local/bin/uv` (0.11.7); `requires-python >=3.10`; system python3.9 +
  its user-site pytest are BROKEN for this repo — do not use.
- **Competing thread (next after F4):** `docs/tech-debt/b4-settlement-account-attribution-handoff-2026-06-04.md`
