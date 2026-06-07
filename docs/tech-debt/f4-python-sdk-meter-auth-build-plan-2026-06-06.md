# (F4) Python SDK family — meter auth + validate-path repair — BUILD PLAN (2026-06-06)

> **Status: PLAN_READY — pre-build audit R1 (runId `wf_b173a98e-2e9`, 2026-06-06) returned
> PLAN_READY / 0 blocking / non-degraded (0 dead lenses, 0 null verdicts; 5 findings all
> nits — 3 refuted, 2 real-cosmetic, folded below as notes). Gate passed in one round (R2 is
> conditional on blockers; none found). Verdict: `.audit/f4-prebuild/round1-verdict.txt`.**
> Inputs: handoff `f4-python-sdk-meter-auth-handoff-2026-06-06.md` + trace
> `f4-python-sdk-meter-trace-2026-06-06.md` (all claims re-derived at HEAD `24b24301`).
> Client-side only; the server money path is byte-stable read-only.

---

## 1. Goal + honest value framing

This chunk does NOT merely "add auth to the Python SDK" — it makes the Python SDK family
**work at all** against the deployed server, for the first time. At HEAD, every
`validate_key()` call 404s on a phantom path (`/api/sdk/keys/validate` does not exist), so
the whole `wrap()` pipeline dies before any meter call; and even if it got that far, the
post-F2 `/api/sdk/meter` would 401 (no `X-Api-Key` header) and 3 of the 4 real meter success
shapes (including the primary Redis fast path, which omits `invocationId`) would crash the
strict `MeterResult` model. The 485 green Python tests are green only against mocks of the
phantom path.

**Deliverable:** Python SDK core `0.2.0` that (a) targets the real `/validate-key` route,
(b) sends `X-Api-Key` on `/meter` (mirroring TS `@settlegrid/mcp` 0.3.0's F2 design),
(c) parses every REAL server response shape on both routes, with tests that pin the wire
contract against the real shapes — plus re-pathed mocks + meter-header assertions across all
7 packages. Works against BOTH server generations (pre-F2 and F2) — safe to land
independently of the F2 deploy.

## 2. Trace conclusions adopted (see trace doc for grounding)

1. Exactly 4 `_http` callsites (validate ×2 `client.py:156/:170`, meter ×2 `:208/:233`); no
   other phantom paths; wrappers are pure delegators; `ValidateKeyRequest`/`MeterRequest`
   models are not on the runtime request path (docstring-only updates).
2. httpx 0.28.1 per-request `headers=` MERGES with client-level headers (empirically
   verified) — the additive `extra_headers` param is sound.
3. The model reconciliation must cover BOTH `KeyValidationResult` (success carries
   `isTestKey`; failure is HTTP-200 `{valid:false, reason}` without ids) AND `MeterResult`
   (Redis fast path omits `invocationId`; test-mode adds `billed`/`reason`; flagged adds
   `isFlagged`).
4. Core `mypy --strict` + `ruff` are baseline-clean and must stay clean → the Optional-ids
   model forces a minimal narrowing in `wrap.py` (1 helper + 4 sites). This consciously
   corrects the handoff's "wrap.py likely needs zero changes" (true for the header fix alone).
5. No version-equality test pins anywhere; 3 `model_dump` equality pins need
   `exclude_none=True`; respx 0.23.1 raises `AllMockedAssertionError` on unmatched routes →
   every forced mock re-path fails loudly pre-fix.

## 3. Fix design — EXACT per-file recipes

### 3.1 Core source (5 files)

**(A) `packages/sdk-python/settlegrid/_http.py`** — additive per-request headers
- `request(self, path, body)` → `request(self, path, body, extra_headers: dict[str, str] |
  None = None)`; thread to `_do_attempt_async(client, full_path, body, attempt,
  max_attempts, extra_headers)`; inside, `client.post(full_path, json=body,
  headers=extra_headers)` (httpx treats `headers=None` as no-op; merge semantics verified).
- Same for `request_sync` → `_do_attempt_sync` → `client.post(...)`.
- `_do_attempt_async` / `_do_attempt_sync` signatures gain the trailing
  `extra_headers: dict[str, str] | None` param.
- `HTTPConfig.user_agent` default (`:118`): `"settlegrid-python/0.1.0"` →
  `"settlegrid-python/0.2.0"` (live via default-constructed `HTTPConfig` in tests; nothing
  asserts the value; bump for consistency).
- Docstrings: note the additive param mirrors TS `apiCall`'s `extraHeaders`
  (`packages/mcp/src/middleware.ts:122-127/:155`).
- NOTHING else: retry loop, circuit breaker, error mapping, `_parse_*` all byte-stable.

**(B) `packages/sdk-python/settlegrid/client.py`** — paths, header, version
- `:47` `SDK_VERSION = "0.1.0"` → `"0.2.0"`.
- `:157` + `:171` `"/keys/validate"` → `"/validate-key"` (the only two path sites).
- meter `:208-218`: `self._http.request_sync("/meter", {...}, extra_headers={"X-Api-Key":
  api_key})`; meter_async `:233-243`: same on `await self._http.request(...)`. Body
  unchanged (6 fields). The key NEVER enters the body (`test_meter_request_rejects_apikey_
  field` keeps pinning that).
- Docstrings: `validate_key`/`validate_key_async` — no path mention, unchanged; `meter`
  docstring (`:190-206`) — add one sentence: the buyer key rides the `X-Api-Key` header
  (F2 server contract, `meter/route.ts:59-86`); keep the existing UUID-history paragraph.

**(C) `packages/sdk-python/settlegrid/_types.py`** — model reconciliation (keeps
`strict=True, extra="forbid", frozen=True` on BOTH models; `_Base` untouched)
- `KeyValidationResult`:
  - `consumer_id: str | None = Field(default=None, alias="consumerId")` (same for
    `tool_id`/`key_id`)
  - `balance_cents: Annotated[int, Field(ge=0)] | None = Field(default=None,
    alias="balanceCents")` (mirrors the existing `units` pattern at `:72`)
  - ADD `is_test_key: bool | None = Field(default=None, alias="isTestKey")`
  - ADD `reason: str | None = Field(default=None)`
  - Docstring: document the two REAL shapes (success `validate-key/route.ts:115-123/
    :146-153`; failure-as-200 `:63,:70,:75,:80,:87`) and that `valid=False` ⇒ ids are None.
- `MeterResult`:
  - `invocation_id: str | None = Field(default=None, alias="invocationId")` — the Redis
    fast path (`meter/route.ts:324-329`) omits it
  - ADD `billed: bool | None = Field(default=None)`, `reason: str | None =
    Field(default=None)`, `is_flagged: bool | None = Field(default=None, alias="isFlagged")`
  - Docstring: enumerate the four real success shapes.
- `ValidateKeyRequest` docstring `:47`: `/api/sdk/keys/validate` → `/api/sdk/validate-key`.
- `MeterRequest` docstring `:54-64`: append the F2 note (key now REQUIRED as the
  `X-Api-Key` HEADER; body shape unchanged).
- `valid`/`success`/`remaining_balance_cents`/`cost_cents` stay REQUIRED (present in all
  real shapes). `APIErrorBody` untouched.

**(D) `packages/sdk-python/settlegrid/wrap.py`** — minimal mypy-strict narrowing
- ADD module-private helper (after `_RESERVED_KWARG`, with `KeyValidationResult` imported
  under the existing `TYPE_CHECKING` block):
  ```python
  def _require_ids(validation: KeyValidationResult) -> tuple[str, str, str]:
      """Return (consumer_id, tool_id, key_id) or raise InvalidKeyError. ..."""
      from .errors import InvalidKeyError  # local import — keeps wrap.py decoupled
      if (
          validation.consumer_id is None
          or validation.tool_id is None
          or validation.key_id is None
      ):
          raise InvalidKeyError()
      return validation.consumer_id, validation.tool_id, validation.key_id
  ```
- 4 sites — after each existing `if not validation.valid: raise InvalidKeyError()` insert
  `consumer_id, tool_id, key_id = _require_ids(validation)` and pass the locals onward:
  `_wrap_sync` (`:209-223`), `_wrap_async` (`:248-259`), `__enter__` (`:274-285`),
  `__aenter__` (`:310-321`). The `valid` checks themselves are byte-stable.
- Behavioral delta: a malformed `valid=True`-without-ids body now raises typed
  `InvalidKeyError` instead of passing bogus values to meter. Real server responses:
  unchanged behavior.
- Design-record note (audit R1): the narrowing is empirically FORCED — mypy --strict
  produces exactly 12 errors (wrap.py:220-222/:256-258/:282-284/:318-320) on the model-only
  change and is clean with the helper. A no-new-symbol inline-guard at each site also
  type-checks; `_require_ids` is chosen for DRY + independent unit-testability (wire-contract
  test #7).

**(E) `packages/sdk-python/pyproject.toml`** — `:7` `version = "0.1.0"` → `"0.2.0"`.

### 3.2 Core tests (7 existing files + 1 new file)

- **Forced mock re-paths** (`keys/validate` → `validate-key` in `respx_mock.post(...)`
  lines only; each fails pre-fix via `AllMockedAssertionError`): `test_client.py` ×6,
  `test_wrap.py` ×17, `test_sdk_validation.py` ×2.
- **Paired-hygiene re-paths** (mock + direct `request*()` fixture strings move together;
  cannot fail pre-fix; scrubs the phantom string from the family): `test_http.py` ×12,
  `test_apicall_edge.py` ×6, `test_defensive_paths.py` ×2.
- **Forced-by-model-change** (`exclude_none=True` on dump-equality pins; no-op pre-fix):
  `test_smoke.py:153`, `test_sdk_validation.py:404`, `:418`.
- **NEW `tests/test_wire_contract.py`** (each test FAILS on pre-fix code; sync + async
  variants where applicable):
  1. meter sends `X-Api-Key: <api_key>` (assert `route.calls.last.request.headers`).
  2. header merge — metered request still carries `User-Agent: settlegrid-python/0.2.0` +
     `Content-Type: application/json` alongside `X-Api-Key`.
  3. validate_key parses REAL success shape (incl. `isTestKey: false` and test-key
     `isTestKey: true, balanceCents: 999999`).
  4. validate_key parses REAL failure shape `{valid: false, reason: "..."}` → result has
     `valid=False`, `reason` set, ids None.
  5. wrap pipeline (decorator + context manager) raises `InvalidKeyError` (not
     ValidationError) on the real failure shape.
  6. meter parses Redis-fast-path shape (no `invocationId`), test-mode shape
     (`billed`/`reason`), flagged shape (`isFlagged: true`).
  7. malformed `valid=True` WITHOUT ids → wrap raises `InvalidKeyError` (pins
     `_require_ids`).
  8. validate body still `{apiKey, toolSlug}` against the NEW path (request-body pin).
- NO mock payload is weakened; existing happy/sad-path payloads remain valid under the
  reconciled models (trace Q6).

### 3.3 Wrapper tests (6 files, test-only)

Per wrapper (`crewai ×6, smolagents ×5, dspy ×5, langchain ×12, pydantic-ai ×5,
llamaindex ×6` validate-mock re-paths — all forced, fail pre-fix):
- Re-path every `respx_mock.post("/api/sdk/keys/validate")` → `"/api/sdk/validate-key"`.
  Meter mock paths are UNCHANGED (`/api/sdk/meter` is real).
- Add ONE header assertion to the existing meter happy-path test (e.g. crewai
  `test_sync_callable_meters`, `tests/test_tool.py:127-141`): after the call,
  `assert meter_route.calls.last.request.headers["x-api-key"] == BUYER_KEY` — the changed
  test fails pre-fix (header absent). Suite counts stay 17/15/15/30/15/17 (no new tests; one
  strengthened assertion each).
- ZERO wrapper runtime/source/dependency/version edits (trace: pure delegators;
  `settlegrid>=0.1.0` floors resolve to 0.2.0; wrapper versions stay 0.1.0).

### 3.4 Out-of-code deliverables (Phase 6, listed for completeness)
Capstone resolution doc; DEBT-register F4 → RESOLVED; next-chunk handoff (B4 lead); account
memory update. No README edits (trace Q8: zero wire-path references). No CHANGELOG (none
exists).

## 4. Byte-stable spine (the diff must contain ZERO hunks under)

**ALL of `apps/web`** (incl. `api/sdk/meter*`, `validate-key`, `test-validate`, openapi,
`lib/metering.ts`, `lib/pricing.ts`, `lib/settlement/**`, `proxy/[slug]`, `x402/* ap2/*
circle-nano/* outcomes/* settlements/* cron/*`, `lib/rate-limit.ts`,
`lib/middleware/auth.ts`, schema/migrations) · **ALL of `packages/mcp`** (TS SDK 0.3.0 —
done in F2) · every other `packages/*` not named `sdk-python*` · F2's settled design
(X-Api-Key header transport, 401/403 taxonomy, meter body shape) · PyPI publishing · any
Python refactor beyond §3 (no http-client rewrite, no type modernization, no retry
redesign). Within `packages/sdk-python*`: `cache.py`, `errors.py`, `__init__.py` (exports
already include everything; `__version__` derives), Makefile, READMEs, wrapper runtime
sources — all byte-stable.

## 5. Behavioral deltas (complete list)

1. `validate_key`/`validate_key_async` hit `/api/sdk/validate-key` (real) instead of 404ing
   on the phantom path → the SDK works against production for the first time.
2. `meter`/`meter_async` send `X-Api-Key` → post-F2 server accepts (401 today); pre-F2
   server ignores the extra header (harmless).
3. REAL validate failure (`{valid:false, reason}`) now yields a parsed result
   (`valid=False`, `reason` populated, ids `None`) instead of `ValidationError`; wrap paths
   convert it to `InvalidKeyError` exactly as before-designed.
4. REAL meter successes (fast-path/test-mode/flagged) now parse instead of raising
   `ValidationError`; `invocation_id` is `None` on the Redis fast path (mirrors the wire).
5. Malformed `valid=True`-without-ids responses raise `InvalidKeyError` (typed) instead of
   leaking into a meter call.
6. `model_dump(by_alias=True)` on the two response models now includes the new optional
   fields when set (None-suppression via `exclude_none=True`, the documented convention).
7. Version/user-agent: `0.1.0` → `0.2.0` (`settlegrid-python/0.2.0` UA).
8. **Compat matrix (honest):** NEW SDK × pre-F2 server ✅ (validate-key existed pre-F2 —
   audit-verified via `git show 2b479a3e~1`; extra header ignored) · NEW SDK × F2 server ✅ ·
   OLD SDK × either ❌ (pre-existing phantom-path 404; no published consumers; unchanged by
   F4) → F4 lands safely independent of the F2 deploy.
9. **Known stale prose deliberately NOT touched (audit R1 note):** apps/web
   `compare/nevermined/data.ts:169/:264` say "v0.1.0" about the Python SDK — apps/web is
   byte-stable in F4 (its gating test pins only "not yet published", which stays true). A
   future server-side hygiene chunk may refresh the copy; "fixing" it inside F4 would breach
   the zero-server-diff gate.

## 6. Test plan + machine gates

- Every NEW test fails on pre-fix code (verified during build by running the new file
  against stashed-fix state — see Phase-4 batch order). Forced re-paths fail pre-fix by
  respx strictness. Paired-hygiene + exclude_none edits are classified honestly (cannot
  fail pre-fix; mechanical).
- **Gates (all must hold at end of build):**
  1. All 7 Python suites GREEN: core = **394** (376 baseline + 18 new wire-contract tests —
     pinned at build; wrapper counts unchanged: 17/15/15/30/15/17).
  2. Core `mypy settlegrid` clean; core `ruff check settlegrid tests` clean; each wrapper's
     ruff clean (baseline-clean recorded 2026-06-06: 5× `ruff check <pkg> tests`, langchain
     `ruff check settlegrid_langchain` — its tests live in-package; no `tests/` dir exists).
  3. `git diff --numstat` confined to `packages/sdk-python*` + `docs/tech-debt/*` —
     **ZERO `apps/web` / `packages/mcp` hunks**.
  4. TS baselines re-run UNCHANGED: apps/web tsc 0 / vitest **4261** / next build 0;
     packages/mcp vitest **1898 pass / 1 skip** / tsup 0.
  5. No `keys/validate` string anywhere in `packages/sdk-python*` (final grep = 0 hits).
- Batch order (Phase 4): (1) `_types.py` + new shape tests → core suite; (2) `_http.py` +
  `client.py` + `wrap.py` + version sites + new header tests → core suite + mypy + ruff;
  (3) core test re-paths (forced + hygiene + exclude_none) → core suite; (4) wrappers one
  at a time (re-path + header assertion → that wrapper's suite); (5) full sweep: 7 suites +
  TS baselines + numstat + phantom-grep.

## 7. Rollout note (founder-gated)

F4 produces a LOCAL, path-scoped commit only. NO push, NO PyPI publish, no prod env, no
migrations. After F4: the founder can ship the F2+F4 bundle (push `2b479a3e`+F4, deploy,
publish `@settlegrid/mcp` 0.3.0 + `settlegrid` 0.2.0 + wrappers 0.1.0 to PyPI) as one
coherent contract change. B4 (settlement-row account attribution) is the natural next chunk.

## 8. SCOPE GUARD (handoff §3, verbatim)

- **In scope:** `packages/sdk-python` core — (a) validate path `"/keys/validate"` →
  `"/validate-key"` (2 callsites); (b) `X-Api-Key` header on `/meter` via an additive
  per-request-headers param on `_http.request`/`request_sync` (mirror the TS `apiCall
  extraHeaders` design from F2); (c) the minimal `_types.py` response-model reconciliation
  the trace confirms (validate success/failure shapes); (d) version bump `0.1.0 → 0.2.0`
  (SDK_VERSION + pyproject + any derived/pinned strings) + CHANGELOG if one exists; (e) core
  test updates (mocks re-pathed; meter header assertions; each new test fails on pre-fix
  code). **The 6 wrappers** — test-file updates only (re-path validate mocks, add meter
  header assertions); wrapper runtime/source/dependency edits ONLY if the trace proves one
  necessary. Docs-only register/capstone/memory updates.
- **OUT of scope (byte-stable — the diff must not touch):** **ALL of `apps/web`** (the F2
  gate, both meter routes, `validate-key`, openapi — READ-ONLY contract references); **ALL
  of `packages/mcp`** (TS SDK 0.3.0 — done); `lib/metering.ts`, `lib/pricing.ts`,
  `lib/settlement/**`, `proxy/[slug]`, `x402/* ap2/* circle-nano/* outcomes/* settlements/*
  cron/*`, `lib/rate-limit.ts`, `lib/middleware/auth.ts`, schema/migrations; F2's settled
  design (X-Api-Key header transport, 401/403 taxonomy, meter body shape — re-litigating
  any of these requires a NEW trace); PyPI publishing; any Python-SDK refactor beyond the
  listed fixes (no http-client rewrites, no type modernization, no retry redesign). **When
  in doubt, the smaller change wins.**
- Trace-proven scope notes within the guard: the `wrap.py` narrowing (§3.1-D) is part of
  (c)'s blast radius — required to keep baseline-clean `mypy --strict` green with the
  reconciled models; the `MeterResult` reconciliation is the trace-confirmed remainder of
  (c) (handoff §1-Q4 explicitly directed checking it).
