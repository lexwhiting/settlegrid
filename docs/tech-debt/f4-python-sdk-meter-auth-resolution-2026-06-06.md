# (F4) Python SDK family — meter auth + validate-path repair — RESOLUTION (2026-06-06)

> Capstone for the F4 chunk. Chain: handoff → trace → build plan (PLAN_READY) → pre-build
> audit R1 → single-writer build → post-build panel → founder-gated LOCAL commit.
> Status: **SHIPPED locally (NOT pushed; NOT published to PyPI — founder-gated).**

## 1. What F4 was

Recorded in the DEBT register (F2 decision F-D1) as "Python SDK family sends `/meter` without
the now-required `X-Api-Key`". The Step-0 scope study + Phase-1 trace found it was worse —
**four defects**, of which three meant the family had *never worked against the deployed
server at all*:

1. **Meter 401 (the registered F4):** `client.py` sent the meter body with NO key on the wire
   (the buyer key was a function arg, unused for transport). Post-F2 servers reject 401
   `API_KEY_REQUIRED`.
2. **Phantom validate path:** the core POSTed `/api/sdk/keys/validate` — a route that has
   NEVER existed (no route file, no rewrite/alias; the real route is
   `/api/sdk/validate-key`). The resulting 404 → `SettleGridUnavailableError` killed
   `validate_key` and therefore the whole `wrap()` pipeline before any metering, against
   production, since the package was written. All 485 Python tests were green only against
   respx mocks of the phantom path.
3. **`KeyValidationResult` strictness:** `strict=True, extra="forbid"`, all fields required —
   but the real route returns success WITH an extra `isTestKey` and failure as **HTTP 200**
   `{valid:false, reason}` WITHOUT the id fields. Both real shapes raised `ValidationError`.
4. **`MeterResult` strictness (trace-sharpened):** 3 of the 4 real meter success shapes
   raised too — test-mode adds `billed`/`reason`; the **primary Redis fast path omits
   `invocationId`** entirely; flagged responses add `isFlagged`.

## 2. What shipped (all inside `packages/sdk-python*`; ZERO server/TS hunks)

**Core source (`settlegrid` 0.1.0 → 0.2.0):**
- `client.py` — validate paths → `/validate-key` (2 sites); `meter`/`meter_async` send
  `extra_headers={"X-Api-Key": api_key}` (mirrors TS `apiCall` `extraHeaders` from F2,
  commit `2b479a3e`); `SDK_VERSION = "0.2.0"`; F2-contract docstring.
- `_http.py` — `request`/`request_sync` gained a trailing optional
  `extra_headers: dict[str, str] | None` threaded to `client.post(..., headers=extra_headers)`
  (httpx 0.28.1 merge semantics empirically verified — client-level `Content-Type`/`User-Agent`
  survive); `HTTPConfig.user_agent` default → `settlegrid-python/0.2.0`. Retry/circuit/error
  mapping byte-stable.
- `_types.py` — `KeyValidationResult`: id/balance fields now `Optional=None` + added
  `is_test_key`/`reason`; `MeterResult`: `invocation_id` now `Optional=None` + added
  `billed`/`reason`/`is_flagged`. Both keep `strict=True / extra="forbid" / frozen=True`;
  docstrings cite the real route shapes line-by-line. `MeterRequest`/`ValidateKeyRequest`
  fields untouched (docstrings updated — the key rides the HEADER, never the meter body).
- `wrap.py` — new module-private `_require_ids()` narrowing helper (raises `InvalidKeyError`
  if a valid-True response lacks ids) + 4 call sites. Empirically forced: `mypy --strict`
  emits exactly 12 errors without it (audit-R1-verified), clean with it.
- `pyproject.toml` — version 0.2.0.

**Tests:**
- 25 FORCED mock re-paths (fail pre-fix via respx `AllMockedAssertionError`): `test_client` 6,
  `test_wrap` 17, `test_sdk_validation` 2.
- 20 paired-hygiene re-paths (HTTP-layer tests that pass the path string directly — mock+call
  move together; classified honestly as cannot-fail-pre-fix): `test_http` 12,
  `test_apicall_edge` 6, `test_defensive_paths` 2.
- 3 dump-equality pins gained `exclude_none=True` (documented convention; no-op pre-fix).
- **NEW `tests/test_wire_contract.py` — 18 tests, 18/18 proven failing on pre-fix source**:
  meter X-Api-Key (sync/async), header-merge preservation, real validate success shapes
  (incl. test-key `isTestKey:true`/999999), real failure shape → `valid=False`/ids `None`,
  wrap raises `InvalidKeyError` (not `ValidationError`) on the failure shape AND on malformed
  valid-true-without-ids (handler never runs), the four real meter shapes (fast-path without
  `invocationId`, flagged, test-mode `billed`/`reason`), request-body pin on the new path,
  `_require_ids` unit tests.
- 6 wrapper test files: validate mocks re-pathed (6/5/5/12/5/6 — all forced) + ONE
  `x-api-key` header assertion in each wrapper's first meter happy-path test. Wrapper
  runtime/pyproject/versions untouched (wrappers stay 0.1.0).

**Fail-pre-fix empirical record** (`.audit/f4-build/prefix-proof.log`): new file vs pristine
source → 18/18 fail; source-stash run → core **43 failed** (= 18 new + 25 forced) / 351 pass,
crewai **6 failed** (its forced set) / 11 pass; stash popped → all green.

## 3. Machine gates at close (all GREEN)

| Gate | Result |
|---|---|
| Python suites | core **394** (376+18) · crewai 17 · smolagents 15 · dspy 15 · langchain 30 · pydantic-ai 15 · llamaindex 17 (wrapper counts unchanged) |
| Core mypy --strict / ruff | clean / clean |
| Wrapper ruff ×6 | all clean |
| apps/web (byte-untouched proof) | tsc 0 · vitest **4261**/180 · next build 0 — identical to baseline |
| packages/mcp (byte-untouched proof) | vitest **1898 / 1 skip** · tsup 0 — identical |
| `git diff --numstat` | exclusively `packages/sdk-python*` (18 files) + new test file + 2 docs — **zero `apps/web` / `packages/mcp` hunks** |
| Phantom-path grep | 0 `keys/validate` refs anywhere in the family |

## 4. Audit chain

- **Pre-build audit R1** (`wf_b173a98e-2e9`, 11 agents, 5 lenses): **PLAN_READY / 0
  blocking / non-degraded** (0 dead lenses, 0 null verdicts). 5 findings, all nits (3
  refuted, 2 real-cosmetic — folded into the plan). Gate passed in ONE round (R2 conditional
  on blockers; none found — precedents (N)/(F2) needed R2 because R1 found blockers).
  Verdict: `.audit/f4-prebuild/round1-verdict.txt`.
- **Post-build panel** (`wf_1dc9faf6-8e2`, 6 agents, 5 lenses incl. the mandatory
  ZERO-SERVER-DIFF lens): **CERTIFIED / 0 blocking / non-degraded** — 0 dead lenses, 0 null
  verdicts, and **zero findings raised by any lens** ("Safe to commit"). Three certifier
  notes, all non-blocking (doc-count drift from this capstone being drafted mid-run;
  stash-run summaries hand-recorded but independently re-derived as consistent; pre-existing
  inert `MeterRequest.units`). Verdict: `.audit/f4-postbuild/verdict.txt` +
  `.audit/f4-certify/CERTIFICATION.md`.

## 5. Honest framing

This was not "add a header." The Python family was **structurally incapable of talking to
the deployed server** (phantom route + over-strict models), and its 485 green tests proved
only mock-consistency. F4's real deliverable is the first Python SDK that actually matches
the production wire contract — header, paths, and all six real response shapes — with the
contract now pinned by tests that fail on any regression to the old behavior.

## 6. Compat matrix (verified, incl. `git show 2b479a3e~1` route-existence check)

| Client | pre-F2 deployed server | F2 server (`2b479a3e`, local) |
|---|---|---|
| Python SDK 0.2.0 (this chunk) | ✅ works (`validate-key` pre-exists F2; extra header ignored) | ✅ works |
| Python SDK 0.1.0 (old) | ❌ broken (phantom-path 404 — pre-existing, no published consumers) | ❌ broken |
| TS SDK 0.3.0 (F2) | ✅ | ✅ |

→ F4 is **safe to land independently of the F2 deploy**. Founder bundle now actionable:
push F2+F4 → deploy → publish `@settlegrid/mcp` 0.3.0 + `settlegrid` 0.2.0 (+ wrappers
0.1.0) to npm/PyPI as one coherent contract change.

## 7. Residuals (all deliberate, none blocking)

1. **Wrappers stay 0.1.0** — zero runtime delta; `settlegrid>=0.1.0` floors resolve to 0.2.0
   at install time when published together.
2. **apps/web `compare/nevermined/data.ts:169/:264`** still says "v0.1.0" about the Python
   SDK — apps/web is byte-stable in F4; its gating test pins only "not yet published" (still
   true). Defer to a future server-side hygiene chunk.
3. **Old Python SDK 0.1.0 remains broken** against every server generation — pre-existing,
   never published, unchanged by F4 (documented, not a regression).
4. **PyPI publish + F2 push** — founder-gated, sequenced per §6.

## 8. Artifacts

- Trace: `docs/tech-debt/f4-python-sdk-meter-trace-2026-06-06.md`
- Plan (PLAN_READY): `docs/tech-debt/f4-python-sdk-meter-auth-build-plan-2026-06-06.md`
- Pre-build audit: `.audit/f4-prebuild/{prebuild-audit.mjs, round1-verdict.txt, CHECKPOINT.md}`
- Build proofs: `.audit/f4-build/{prefix-proof.log, *-final.log}` + `.audit/f4-preflight/BASELINES.md`
- Panel: `.audit/f4-postbuild/{panel.mjs, verdict.txt}` + `.audit/f4-certify/CERTIFICATION.md`
- Register: `docs/tech-debt/publisher-api-keys-audit-2026-05-28.md` (F4 → RESOLVED)
