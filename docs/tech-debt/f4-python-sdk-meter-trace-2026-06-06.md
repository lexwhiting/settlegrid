# (F4) Python SDK family — DISCOVERY TRACE (2026-06-06)

> Phase-1 trace for the F4 chunk (handoff:
> `f4-python-sdk-meter-auth-handoff-2026-06-06.md`). Every claim below grounded in file:line
> **read this session** at HEAD `24b24301` (F4 handoff doc, on F2 `2b479a3e`, on (N) `aa580355`;
> local, NOT pushed; tree clean). Answers the eight §1 questions. Pre-flight artifacts in
> `.audit/f4-preflight/` (gitignored).

---

## Q1 — Runner recipe + GREEN baselines (recorded BEFORE any edit)

**TS baselines (re-run this session; must remain byte-untouched):**
| Check | Result |
|---|---|
| apps/web `npx tsc --noEmit` | exit 0, **0 bytes** output |
| apps/web `npx vitest run` | **4261 passed / 180 files** |
| apps/web `npx next build` | exit 0 |
| packages/mcp `npx vitest run` | **1898 passed / 1 skipped / 52 files** |
| packages/mcp `npm run build` | exit 0 (tsup + DTS) |

**Python baselines — all 7 GREEN (logs: `.audit/f4-preflight/pytest-*.log`):**
| Package | Result |
|---|---|
| sdk-python (core) | **376 passed** |
| sdk-python-crewai | **17 passed** |
| sdk-python-smolagents | **15 passed** |
| sdk-python-dspy | **15 passed** |
| sdk-python-langchain | **30 passed** |
| sdk-python-pydantic-ai | **15 passed** |
| sdk-python-llamaindex | **17 passed** |

Total **485 passed / 0 failed / 0 skipped**.

**Additional baseline gates discovered:** core `mypy settlegrid` = **clean** ("no issues in 7
source files", strict per `pyproject.toml:95-103`) and core `ruff check settlegrid tests` =
**clean**. The fix must keep both green (they are part of the package's documented `make
lint`/`make type` surface, `Makefile:30-35`).

**Recipe (validated this session):**
- Core: `.venv` provisioned via `uv run --extra dev pytest` (uv 0.11.7 at `~/.local/bin/uv`;
  Python **3.11.15**). ⚠️ `uv run` writes an untracked `uv.lock` — it was deleted; all re-runs
  use **`cd packages/sdk-python && .venv/bin/pytest -q`** (no lock side effect).
- Wrappers: **pre-existing healthy `.venv`s** (Python 3.11.15) with framework deps + dev extras
  + `settlegrid` installed as **local editable** (`import settlegrid` →
  `/Users/lex/settlegrid/packages/sdk-python/settlegrid` — verified per wrapper). Re-run:
  `cd packages/sdk-python-<w> && .venv/bin/pytest -q`.
  - Consequence: **core source edits propagate to all 6 wrapper suites instantly.**
  - Fresh provisioning (if ever needed) must force the local core—`uv venv --python 3.11 &&
    uv pip install -e ../sdk-python -e '.[dev]'`—because wrappers declare `settlegrid>=0.1.0`
    with **no `[tool.uv.sources]`** anywhere (grepped: zero hits); a naive `uv run` would try
    PyPI for `settlegrid`.
- System `/usr/bin/python3` = 3.9.6 → below `requires-python >=3.10`; its user-site pytest
  INTERNALERRORs. Never used.
- Installed libs (core venv): **httpx 0.28.1, respx 0.23.1, pydantic 2.13.4**.

---

## Q2 — httpx per-request header semantics (empirical, httpx 0.28.1)

Verified in-venv with respx (`.audit` session run):
- `client.post(path, json=body, headers={"X-Api-Key": k})` **MERGES** with client-level
  headers: sent request carried `x-api-key` AND the client-level `User-Agent`
  (`settlegrid-python/0.1.0`) AND `Content-Type: application/json`.
- A per-request header with the same name **overrides** the client-level value (verified with
  `User-Agent: override/9.9.9`).
- → The additive `extra_headers` param can be threaded to `client.post(...,
  headers=extra_headers)` with no header loss. A regression test will pin this (assert UA +
  Content-Type + X-Api-Key all present on the metered request).

---

## Q3 — Full internal call graph (complete; no other phantom paths)

**`_http.request` / `request_sync` callers — exactly 4, all in `client.py`:**
| Site | Path | Notes |
|---|---|---|
| `client.py:156` | `"/keys/validate"` (sync) | PHANTOM — real route is `/validate-key` |
| `client.py:170` | `"/keys/validate"` (async) | PHANTOM |
| `client.py:208` | `"/meter"` (sync) | body has NO key; `api_key` is 1st arg (in scope, unused on wire) |
| `client.py:233` | `"/meter"` (async) | same |

`_http.py:316-368`: both entry points prefix `/api/sdk` (`:324`, `:350`) and call
`client.post(full_path, json=body)` (`:388`, `:410`) — **no per-request header support**
(client-level headers only, `:285-288`/`:297-300`). This is the change point, mirroring TS
`apiCall`'s `extraHeaders` (`packages/mcp/src/middleware.ts:122-127`, spread at `:155`; the F2
TS meter passes `{ 'X-Api-Key': apiKey }` as the 5th arg, `middleware.ts:419-427`).

**`validate_key`/`meter` callers:**
- `wrap.py` — validate: `:209` (`_wrap_sync`), `:248` (`_wrap_async`), `:274` (`__enter__`),
  `:310` (`__aenter__`); meter: `:216`, `:252`, `:358`, `:376` — **all through the public
  `sg.meter`/`sg.meter_async` with `api_key` as 1st positional arg** → the header fix needs
  ZERO wrap.py changes. (The MODEL reconciliation does force a minimal wrap.py delta — see Q4.)
- The 6 wrappers (each `settlegrid_<fw>/tool.py` + `__init__.py`): pure delegation; **zero**
  grep hits for `validate_key`/`.meter`/`request_sync`/`_http` in wrapper runtime code. All
  path refs live in their tests only.
- No telemetry/heartbeat/other callers anywhere in the family. The ONLY phantom path is
  `keys/validate`; `test-validate` and `meter-with-metadata` have **0 Python references**.
- `ValidateKeyRequest`/`MeterRequest` (`_types.py:46-72`): defined + exported
  (`__init__.py:12-18`) but **NOT used in the runtime request path** (client.py builds dict
  literals) — docstring-only updates.
- `cache.py:131` `KeyValidationCache = LRUCache[KeyValidationResult]` — stores model instances;
  caching is keyed on the raw api_key string (`client.py:153/:161`); invalid results are cached
  too (`test_client.py:151+` pins this). Model field additions don't disturb the cache.

**meter-with-metadata parity note:** the F2 gate exists there too (`route.ts:41-64`:
`x-api-key` → 401 `API_KEY_REQUIRED` / 403 `KEY_BINDING_MISMATCH`) — read-only context; the
Python family never calls it.

---

## Q4 — Response-model reconciliation (the worst finding lives here)

**Server envelope:** `successResponse` = plain `NextResponse.json(data, {status})` — **no
envelope** (`apps/web/src/lib/api.ts:9-17`). `errorResponse` = `{error, code?}` + status
(`:23-35`) → handled by `_http._map_status_to_error`, never reaches the models.

**REAL `/api/sdk/validate-key` shapes (`validate-key/route.ts`):**
- Success (HTTP 200): `{valid: true, consumerId, toolId, keyId, balanceCents, isTestKey}` —
  `isTestKey` ALWAYS present (`:115-123` test keys w/ balance 999999; `:146-153` normal).
- Failure (**HTTP 200**, NOT 4xx — `successResponse` at `:63`, `:70`, `:75`, `:80`, `:87`):
  `{valid: false, reason}` — **no consumerId/toolId/keyId/balanceCents**.
- 429s (IP-blocked `:29`, flat `:35`, tiered `:103`) are `errorResponse` → `RateLimitedError`
  via `_http` — not a model concern.

**Current `KeyValidationResult` (`_types.py:78-89`)**: `strict=True, extra="forbid",
frozen=True` (`_Base:29-40`), ALL fields required → `model_validate` raises `ValidationError`
on **BOTH** real shapes: success (extra `isTestKey`) and failure (4 missing + extra `reason`).
So even after re-pathing, validate dies. Confirmed: handoff finding #3 is real, on both arms.

**REAL `/api/sdk/meter` success shapes (`meter/route.ts`) — FOUR distinct:**
| Path | Shape | vs `MeterResult` (`_types.py:92-103`, all-required + forbid) |
|---|---|---|
| Test mode `:181-188` | `{success, remainingBalanceCents: 999999, costCents: 0, invocationId, billed: false, reason: 'TEST_MODE'}` | extras `billed`,`reason` → **raises** |
| Zero-cost `:218-223` | `{success, remainingBalanceCents: 0, costCents: 0, invocationId}` | exact match → OK |
| **Redis fast path `:324-329`** | `{success, remainingBalanceCents, costCents, isFlagged?}` — **NO `invocationId`** (`recordInvocationAsync` is fire-and-forget; `isFlagged: flagged \|\| undefined` → key dropped when falsy) | missing required `invocationId` → **raises on the PRIMARY production path** |
| DB fallback `:415-421` | `{success, remainingBalanceCents, costCents, invocationId, isFlagged?}` | extra `isFlagged` when flagged → **raises when flagged** |

→ `MeterResult` must be reconciled too (the handoff's Q4 anticipated exactly this).

**TS precedent (design anchor):** TS `KeyValidationResult`/`MeterResult`
(`packages/mcp/src/types.ts:109-139`) declare all-required but TS does **no runtime
validation**; `middleware.ts:377-390` even documents the failure shape ("the API might return
{ valid: false } without the other fields — runtime types don't match TS declarations") and
negative-caches with `?? ''` fallbacks. The Python SDK must mirror the TS **runtime
tolerance**, not its type declarations.

**Fix design (minimal, keeps `strict=True`/`extra="forbid"`/`frozen=True` on both models):**
- `KeyValidationResult`: `consumer_id`/`tool_id`/`key_id` → `str | None = None`;
  `balance_cents` → `int(ge=0) | None = None`; ADD `is_test_key: bool | None`
  (alias `isTestKey`) and `reason: str | None`. Extra fields stay forbidden — the two real
  shapes are now exactly representable.
- `MeterResult`: `invocation_id` → `str | None = None`; ADD `billed: bool | None`,
  `reason: str | None`, `is_flagged: bool | None` (alias `isFlagged`).
- `MeterRequest`/`ValidateKeyRequest`/`APIErrorBody`: **byte-identical except docstrings**
  (`_types.py:47` names the phantom path; `:53-64` records the pre-F2 "Zod strips api_key"
  history → add the F2 header-transport note).
- **Forced consequence (corrects the handoff's "wrap.py likely needs zero changes"):** core
  `mypy --strict` is clean at baseline and `wrap.py` feeds `validation.consumer_id/tool_id/
  key_id` (now `str | None`) into `sg.meter(consumer_id: str, ...)` at 4 sites
  (`wrap.py:216-223`, `:252-259`, `:278-285`, `:314-321`). Minimal narrowing required: one tiny
  module-private helper (`_require_ids(validation) -> tuple[str, str, str]`, raising
  `InvalidKeyError` — `errors.py:74-84`, message-only ctor — if any id is None on a
  valid=True result) + 4 call-site touches. Semantics: today a malformed valid-True body
  without ids would AttributeError-free pass bogus values into meter; post-fix it raises a
  typed error. Behavior on REAL server responses: unchanged (server always sends ids on
  valid=True).
  - Alternative considered + REJECTED: sentinel defaults (`consumer_id: str = ""`) — zero
    wrap.py delta but lies on the public surface (`""` UUIDs on failure), diverges from TS
    runtime semantics (undefined ≈ None), and masks malformed-success responses.

---

## Q5 — Version-pinned strings/tests across ALL 7 packages (the F2 lesson)

**Bump sites (0.1.0 → 0.2.0), core only:**
- `pyproject.toml:7` `version = "0.1.0"`
- `client.py:47` `SDK_VERSION = "0.1.0"`
- `_http.py:118` dataclass default `user_agent: str = "settlegrid-python/0.1.0"` — NOT dead
  code (tests construct `HTTPConfig()` without `user_agent`: `test_http.py:276-304,:500,:584,
  :602`, `test_apicall_edge.py:29`, `test_defensive_paths.py:40`) but **nothing asserts its
  value** (zero grep hits for `settlegrid-python/` in any test). Bump the literal for
  consistency.
- Derived (auto-update, no edit): `client.py:125` f-string UA; `__init__.py:41`
  `__version__ = SDK_VERSION`.

**Version-assertion inventory — NO equality pins to "0.1.0" anywhere; the do-NOT-touch set:**
- `test_exports.py:21-31` — isinstance / `__version__ == SDK_VERSION` / non-empty / semver
  3-part-digits ("0.2.0" passes).
- `test_smoke.py:43-44`, `test_sdk_validation.py:69-77` — same invariant style.
- langchain `__tests__/test_tool.py:659-664` — isinstance/len only.
- Wrapper `__init__.py` `__version__ = "0.1.0"` ×6 + wrapper `pyproject.toml:7` ×6 — **stay
  0.1.0** (zero wrapper runtime delta; their `settlegrid>=0.1.0` floors resolve to 0.2.0 when
  published together; publish bundling is the founder's call). No CHANGELOG file exists in any
  of the 7 packages (`ls CHANGELOG*` → none). READMEs: **zero** wire-path / header / version
  references (grepped).

---

## Q6 — Test/mock inventory: FORCED vs PAIRED-HYGIENE (respx strictness proven)

**respx 0.23.1 is strict by default** — empirically verified: a request to
`/api/sdk/validate-key` against a router that only mocks `/api/sdk/keys/validate` raises
`AllMockedAssertionError` ("not mocked!"). → Every FORCED mock breaks loudly on the path fix.

**FORCED re-paths** (test drives the real `SettleGrid` client → client.py builds the path; on
pre-fix code the re-pathed mock is unmatched → test FAILS pre-fix ✓):
| File | validate refs | meter refs |
|---|---|---|
| core `tests/test_client.py` | 6 | 4 |
| core `tests/test_wrap.py` | 17 | 17 |
| core `tests/test_sdk_validation.py` | 2 | 2 |
| crewai `tests/test_tool.py` | 6 | 6 |
| smolagents `tests/test_tool.py` | 5 | 5 |
| dspy `tests/test_tool.py` | 5 | 5 |
| langchain `settlegrid_langchain/__tests__/test_tool.py` (nonstandard loc) | 12 | 12 |
| pydantic-ai `tests/test_tool.py` | 5 | 5 |
| llamaindex `tests/test_tool.py` | 6 | 6 |

**PAIRED-HYGIENE re-paths** (tests pass the path string DIRECTLY to
`request`/`request_sync` — mock + call move together; cannot fail pre-fix; scrubbed so zero
`keys/validate` strings survive in the family):
- `test_http.py` — 12 refs (e.g. `:318/:330`, `:339/:345`, `:511/:523`, `:530+`)
- `test_apicall_edge.py` — 6 refs (`:51/:55`, `:99/:103`, `:166/:170`)
- `test_defensive_paths.py` — 2 refs (`:136`, `:152` — direct calls, no mocks)

**Mock payload note:** wrapper + core happy-path mocks use helpers (e.g. crewai
`_validate_response()` `tests/test_tool.py:43-53` = `{valid, balanceCents, consumerId, toolId,
keyId}`; `_meter_response()` `:56-65`). These payloads remain VALID under the reconciled
models (new fields optional) — **no mock weakened**. New-shape coverage lands as NEW tests.

**FORCED-BY-MODEL-CHANGE edits (pass pre-fix, would BREAK post-fix without the edit —
honest classification: compatibility-tracking, not fail-pre-fix):**
- `test_smoke.py:153` and `test_sdk_validation.py:404` — `KeyValidationResult.model_dump(
  by_alias=True) == wire` equality pins: post-fix dumps emit `isTestKey`/`reason` as None →
  add `exclude_none=True` (a no-op pre-fix; matches the module's documented convention,
  `_types.py:14-16`, and the existing style at `test_sdk_validation.py:331/:351/:363`).
- `test_sdk_validation.py:418` — same for `MeterResult` (`billed`/`reason`/`isFlagged`).
- Verified survivors (no edit): `test_smoke.py:179-190` `test_extra_field_rejected` uses
  `unexpected_field` (still forbidden); `:156` negative-balance and `:166` strict-coercion
  pins (ge=0 + strict survive on the now-optional fields);
  `test_sdk_validation.py:366-382` `test_meter_request_rejects_apikey_field` (MeterRequest
  untouched — correctly pins that the key rides the HEADER, not the body, post-F2);
  `test_client.py:152-170` + `test_wrap.py:53-62` `{valid:false}` fixtures carry all-required
  sentinel fields → parse under both old and new models.

**NEW tests (each FAILS on pre-fix code):**
1. Core: meter (sync + async) sends `X-Api-Key: <api_key>` — assert via
   `route.calls.last.request.headers` (fails pre-fix: header absent).
2. Core: header-merge preservation — UA + Content-Type survive alongside X-Api-Key.
3. Core: validate_key parses REAL success shape incl. `isTestKey` (fails pre-fix:
   ValidationError) + REAL failure shape `{valid:false, reason}` (fails pre-fix) — sync+async.
4. Core: meter parses Redis-fast-path shape (no invocationId), test-mode shape
   (billed/reason), flagged shape (isFlagged) (each fails pre-fix).
5. Core: wrap pipeline raises `InvalidKeyError` on `{valid:false, reason}` (today:
   ValidationError — asserting the typed error fails pre-fix).
6. Each wrapper: ONE meter-header assertion on its happy path (fails pre-fix), re-using the
   existing `_meter_response` route handle.

---

## Q7 — Backward/forward-compat matrix (honest)

| Client | OLD deployed server (pre-F2) | NEW server (F2 `2b479a3e`) |
|---|---|---|
| **NEW Python SDK (post-F4)** | ✅ works — `/validate-key` exists pre-F2; extra `X-Api-Key` header is ignored by the old meter route | ✅ works — header required + provided |
| **OLD Python SDK (0.1.0)** | ❌ broken — validate 404s (phantom path) → `SettleGridUnavailableError` before any meter | ❌ broken — same 404 first; meter would also 401 |
| TS SDK 0.3.0 (F2) | ✅ | ✅ |

→ **F4 is safe to land independently of the F2 deploy** (new SDK works against BOTH server
generations). The old Python SDK was never functional against production (consistent with 0
live SDK traffic) and has no published consumers; its breakage is pre-existing and unchanged.
Founder sequencing: push F2 + publish TS 0.3.0 + Python 0.2.0 as one contract bundle.

---

## Q8 — Docs/readme surfaces

- Package READMEs (core + 6 wrappers): **zero** path/header/version references → no edits.
- In-code docstrings needing updates (part of the source fix, not separate docs):
  `_types.py:47` (phantom path in `ValidateKeyRequest` docstring), `_types.py:53-64`
  (`MeterRequest` history note — add F2 header transport), `client.py:145-162/:164-176`
  (validate docstrings fine, no path mention), `client.py:190-206` (meter docstring — add the
  X-Api-Key sentence), model docstrings for the new optional fields.
- `docs/tech-debt/*` historical records (F2 handoff/capstone etc.): **do not touch** — they
  document history. Register + capstone updates happen in Phase 6 as planned.

---

## Trace verdict

All three handoff defects CONFIRMED + one sharpened: (1) meter sends no key
(`client.py:208/:233`; F2 server gate `meter/route.ts:62-86` rejects 401); (2) phantom
`/keys/validate` (`client.py:156/:170`; real routes dir = `meter, meter-with-metadata,
test-validate, validate-key`; **no rewrite** — re-grepped `next.config.*`, `src/middleware.ts`,
`apps/web/vercel.json` this session: zero `keys/validate` hits); (3) `KeyValidationResult`
strict-mismatch on BOTH real shapes; (3b — sharpened) `MeterResult` ALSO mismatches 3 of 4
real success shapes, including the **primary Redis fast path** (missing `invocationId`).
The family has never worked against the deployed server; F4 makes it work against both server
generations. Scope remains exactly `packages/sdk-python*` + docs.
