# NEXT-CHUNK HANDOFF — post-(F2) (2026-06-06, Step-0-gated)

> (F2) is **CLOSED + CERTIFIED** (`f2-sdk-meter-auth-resolution-2026-06-06.md`); local commit pending the
> founder's word (not pushed). This carries the post-(N) menu **minus (F2)**, plus the new **F4** that F2
> opened. **Pick the next chunk at Step-0 (founder).** SettleGrid settles real USDC → `/effort max`, and
> the next chunk gets its own discovery trace → plan → pre-build audit → (funds-SEAL if on the money
> surface) → founder-gated commit.

## The menu (no item is pre-decided)
- **F4 — Python SDK `/meter` authentication (the direct F2 follow-on).** `packages/sdk-python` core + 6
  framework wrappers omit `X-Api-Key` → **401 at runtime** against an F2 server. The natural completion of
  the auth story: re-add `apiKey` to the core meter call (it was removed once — see `_types.py` comment),
  update the 6 wrappers' test assertions, bump the Python SDK. **Lower-risk than F2** (no server change; no
  money math; the server contract is already settled). Should be done **before any Python consumer
  onboards**. Mirrors the TS work already shipped at `@settlegrid/mcp` 0.3.0. *Caveat:* needs the Python
  toolchain (pytest/respx) runnable to verify — confirm at Step-0.
- **(K) HMAC-pepper — DE-recommended** (handoff §0): for 256-bit random keys SHA-256 is already
  preimage-safe; marginal value; touches the live `proxy/[slug]` settlement-auth path. Keep deferred.
- **(C)/(A)/(H)** — hygiene / externally-gated. The small bundle (F3 + #4 + #8) is low value (#8 "email
  XSS" already mitigated by pervasive `escapeHtml`; the gap is only a missing Settings-UI client test).
- **F1** — NAT-fairness IP-raise on session routes (deferred; new limiter export → ~84-file mock sweep +
  a flood-posture loosening; do only if NAT throttling is observed).
- **F3** — remove the dead `lib/middleware/auth.ts:155 requireApiKey` export (separate decision).

## Recommendation (for Step-0, not a decision)
**F4** is the cleanest next pick: it completes F2 across all first-party SDKs, is materially lower-risk
than F2 (no server/money change), and removes the one accepted residual before it can bite a real consumer.
If the Python toolchain isn't readily runnable, fall back to F3 (trivial hygiene) or hold for an
externally-gated item.

## Ground state for the next session
- HEAD after the F2 local commit (once founder-approved) = `aa580355` + the F2 commit (NOT pushed).
- Baselines to re-confirm GREEN at that HEAD: apps/web tsc 0 / vitest **4261** / next build 0; packages/mcp
  vitest **1898 / 1 skip** + `npm run build` (tsup+DTS) 0.
- Real-money guardrails unchanged: do NOT push, set/change prod env, or apply migrations (all
  founder-gated); any DB access read-only; single-writer core, fan-out only for the audit gates; flag
  context degradation the moment it risks quality.
- Audit templates to adapt: `.audit/f2-prebuild/prebuild-audit.mjs` (hardened: null-guard + inline degraded
  fallback) · `.audit/f2-postbuild/funds-seal.mjs`. The session-limit caveat (resets 6pm ET) bit the 1st
  R2 this chunk — the hardened scripts now degrade cleanly instead of crashing; resume via
  `Workflow({scriptPath, resumeFromRunId})` or re-run after reset.
