# NEXT-CHUNK HANDOFF — post-(F4) (2026-06-06, Step-0-gated)

> (F4) is **CLOSED + CERTIFIED** (`f4-python-sdk-meter-auth-resolution-2026-06-06.md`): the Python SDK
> family now actually works against the real server (phantom validate path fixed, `X-Api-Key` on
> `/meter`, all six real response shapes parse). Local commit on top of F2 `2b479a3e` — **NOT pushed,
> NOT published**. This carries the post-F2 menu **minus F4**. **Pick the next chunk at Step-0
> (founder).** SettleGrid settles real USDC → `/effort max`; the next chunk gets its own discovery
> trace → plan → pre-build audit (PLAN_READY 0-blocking) → build → post-build panel/SEAL → founder-gated
> commit.

## NOW FOUNDER-ACTIONABLE (not a chunk — a founder decision)
**The F2+F4 deploy/publish bundle.** With both SDK-auth chunks closed, the founder can ship the whole
contract change as one unit: push the local stack (`aa580355` → `2b479a3e` → F4 commit) → deploy →
publish `@settlegrid/mcp` 0.3.0 (npm) + `settlegrid` 0.2.0 + the 6 wrappers 0.1.0 (PyPI). The new
Python SDK works against BOTH server generations, so deploy order is safe either way. All of this
remains explicitly founder-gated.

## The menu (no item is pre-decided)
- **B4 — settlement-row account attribution (the natural lead).** The other live thread; heavier
  SERVER-SIDE money chunk. Committed handoff:
  `docs/tech-debt/b4-settlement-account-attribution-handoff-2026-06-04.md` — ⚠️ mind its verified TRAP
  at `reconcile.ts:129` (read the handoff end-to-end before anything). Full money-surface discipline:
  funds-SEAL post-build, read-only DB, founder-gated everything.
- **(K) HMAC-pepper — DE-recommended** (F2 handoff §0): for 256-bit random keys SHA-256 is already
  preimage-safe; marginal value; touches the live `proxy/[slug]` settlement-auth path. Keep deferred.
- **(C)/(A)/(H)** — hygiene / externally-gated. The small bundle (F3 + #4 + #8) is low value (#8
  "email XSS" already mitigated by pervasive `escapeHtml`; the gap is only a missing Settings-UI
  client test).
- **F1** — NAT-fairness IP-raise on session routes (deferred; new limiter export → ~84-file mock sweep
  + a flood-posture loosening; do only if NAT throttling is observed).
- **F3** — remove the dead `lib/middleware/auth.ts:155 requireApiKey` export (separate decision).
- **(server-copy nit, absorbable into any future apps/web chunk):** `compare/nevermined/data.ts:169/
  :264` still says "v0.1.0" about the Python SDK (now 0.2.0). Byte-stable in F4 by design; its gating
  test pins only "not yet published" (still true until the founder publishes).

## Recommendation (for Step-0, not a decision)
**B4** — it is the last live heavyweight thread, and the SDK-auth arc (F2→F4) is now fully closed
behind it. If a lighter session is preferred, F3 is trivial hygiene.

## Ground state for the next session
- HEAD after the F4 local commit = `24b24301` + F4 commit (on F2 `2b479a3e`, on (N) `aa580355`) —
  branch `main`, LOCAL, **NOT pushed**.
- Baselines to re-confirm GREEN at that HEAD: apps/web tsc 0 / vitest **4261** / next build 0;
  packages/mcp vitest **1898 / 1 skip** + tsup build 0. Python (if touched): core **394**, wrappers
  17/15/15/30/15/17 via per-package `.venv/bin/pytest -q` (Python 3.11.15 venvs in place; wrappers
  import the core as a LOCAL EDITABLE; never system python3 = 3.9 broken; `uv run` writes an
  untracked `uv.lock` — use the venv binaries directly).
- Real-money guardrails unchanged: do NOT push, set/change prod env, apply migrations, or publish
  packages (all founder-gated); any DB access read-only; single-writer core, fan-out only for the
  audit gates; flag context degradation the moment it risks quality.
- Audit templates to adapt (hardened tail: null-guard + inline degraded fallback — keep it):
  `.audit/f4-prebuild/prebuild-audit.mjs` · `.audit/f4-postbuild/panel.mjs` (client-side panel shape)
  · `.audit/f2-postbuild/funds-seal.mjs` (money-surface SEAL shape — B4 wants THIS one) ·
  `.audit/f4-prebuild/CHECKPOINT.md` (recovery patterns). Session-limit caveat (resets 6pm ET) bit
  this series twice; the hardened scripts degrade cleanly; resume via
  `Workflow({scriptPath, resumeFromRunId})` or re-run after reset.
