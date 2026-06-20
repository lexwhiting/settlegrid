# V-N3-log-redaction — ② SEAL-GATING REVIEW → **BLOCKED** (do NOT seal) — 2026-06-19

> High-stakes ② seal-gating review of the BUILT V-N3-log-redaction diff (uncommitted working tree on
> `main` @ base `769ab9c0`). Orchestration: 6 fresh-context Agent-tool reviewers, model `claude-opus-4-8`
> pinned, inherited session `xhigh`, coverage mode (5 lens-distinct + 1 collective-miss critic; core-invariant
> max-depth deferred to ③ per the up-front operator opt-in). Gate independently re-run clean+isolated by the
> integrator: `tsc 0 · lint 0 err (8 pre-existing warns) · vitest 204 files / 4658 tests / 0 failed`.
>
> **VERDICT: BLOCKED.** The chunk as built does NOT achieve its core thesis ("no raw payer/nonce in our
> logs/Sentry"). FOUR high-severity findings remain open, THREE of them LIVE leaks on distinct rails/channels.
> Routed to the recovery loop → back to BUILD. This doc is the BINDING fix spec for that build.

## Tier — RE-CONFIRMED HIGH-STAKES (not lowered)
The realized diff touches `logger.ts emit()` — a **global-blast-radius** surface (`redactLogString` now runs on
EVERY error-level log's `err.message`/`err.stack` and the free-text meta keys for EVERY `emit()` call app-wide,
~828 logger sites), plus the money-rail settlement observability the runbooks depend on, two operator runbooks,
and the DC-16 honesty claim. One scope expansion vs. the plan: the §11 `packages/mcp` wiring question resolved
to **WIRED** (the plan hoped it might be out-of-scope) — see M1.

---

## BLOCKING findings (HIGH — all must close before re-entering ②)

### F1 [HIGH, reproduced RED] — `redactLogString` leaks a payer/nonce packed inside a longer contiguous hex run
`apps/web/src/lib/settlement/log-redaction.ts:41-42,79-84`. `STANDALONE_HEX64`/`STANDALONE_HEX40` each require an
EXACT length (`{64}`/`{40}`) **and** a trailing `(?![0-9a-fA-F])` boundary, with no leading boundary. When the
`from` (40-hex) and `nonce` (64-hex) appear INSIDE a single longer contiguous hex run — exactly how viem formats
ABI calldata / revert `data` / a JSON-RPC request body — every interior 40/64 window is blocked by the lookahead
(next char is still hex) and the run as a whole is neither 40 nor 64 from its own `0x`, so **nothing matches and
the PII survives**.
- **Integrator repro (RED):** a `transferWithAuthorization` calldata run `0x e3ee160e <12-zero-byte word+40-addr>
  …<64-nonce>…` → `redactLogString(msg) === msg`; raw 40-hex payer survives `true`, 64-hex nonce survives `true`.
  The cleanly-separated form (`from = 0x.., nonce = 0x..`) the test DOES cover is correctly redacted — so the
  suite is GREEN while the real viem shape leaks.
- **Reachable LIVE:** `x402/settle.ts:294` (`x402.settle_exact_failed`), `x402/verify.ts:384` / `:459`
  (`x402.verify_exact_failed` — **verify.ts is NOT modified by the diff; the central `emit()` sanitizer is its ONLY
  defense**). Egresses to stdout (`entry.error`/`entry.stack`) AND `Sentry.captureException` (the clone is built
  from the still-leaking redacted message). Falsifies the DC-16 claim.
- **Fix direction:** redact ANY long hex run in free-text — e.g. replace the two exact-length standalone patterns
  with a single `/0[xX][0-9a-fA-F]{40,}/g → '0x<redacted>'` (greedy, NO trailing lookahead, so the whole
  calldata blob is consumed; over-redaction of a recipient/tx-hash inside a free-text err STRING is explicitly
  acceptable per handoff §5#4 — it never runs on structured `txHash`/`recipient`/`to` fields). Keep
  `EMBEDDED_PAYER_OPID → '$1:$2:anon'` FIRST. Also covers **F4** (`0[xX]` handles the uppercase prefix). Verify
  idempotence (`0x<redacted>` has no hex tail). Add test fixtures: a packed-calldata blob, a `0x<64>`-then-hex
  trailing residue, and a `0X`-prefixed address — each asserted fully redacted.

### H1 [HIGH, code-confirmed] — `circle-nano-proxy.ts:135` logs the raw EVM payer to stdout
`apps/web/src/lib/circle-nano-proxy.ts:135-139`:
```ts
appLogger.info('circle_nano.payment_validated', {
  toolSlug: toolConfig.slug,
  payer: result.payerAddress,        // raw 0x<40> EVM payer  ← LEAK
  amountBaseUnits: result.amountBaseUnits,
})
```
`appLogger.info → logger.info` (`@/lib/logger`). This is the AUTHORITATIVE live verifier
(`validateCircleNanoCredentialString`) used by all three settling paths (kernel `/verify`, kernel `/settle`
`circle-nano/settle/route.ts:129`, direct proxy `proxy/[slug]/route.ts:2087`). `info`-level → stdout
(Vercel/Datadog) — in scope ("logs/Sentry" includes stdout). A §6-inventory MISS.
- **Fix direction:** covered by the sanitizing-`appLogger` seam (see M1) — OR drop `payer` per-site. Prefer the
  seam so the whole aliased-logger class is closed at once.

### M1 [HIGH/CRITICAL, code-confirmed — §11 question RESOLVED to WIRED] — `packages/mcp` adapters leak raw payer(+nonce) to stdout via the `@/lib/logger`-backed `appLogger`
The handoff §11 left this to resolve at ②: "confirm SettleGrid's hosted MCP does NOT wire `@/lib/logger` into
those adapters — if it does, they become live SettleGrid leaks and **must be added**." **It DOES.** Each proxy
file defines `appLogger` (forwarding to `@/lib/logger`) and injects it as `logger: appLogger` into the adapter
core: `circle-nano-proxy.ts:29/49`, `x402-proxy.ts:26/50`, `drain-proxy.ts:21/42`. Live adapter log sites that
then egress raw PII to stdout:
- **`packages/mcp/src/adapters/x402.ts:546` `x402.payment_accepted_local { payerAddress }`** — the
  no-facilitator branch = SettleGrid's hosted path (self-settles, no external facilitator URL). **LIVE** on every
  accepted x402 proxy payment. (`x402.ts:527` `x402.payment_settled` is the facilitator branch — dormant for
  hosted.)
- **`packages/mcp/src/adapters/drain.ts:583` `drain.payment_accepted { payerAddress, nonce }`** — via
  `validateDrainPayment` (`route.ts:2450`). **LIVE** — raw payer AND raw channel nonce.
- `packages/mcp/src/adapters/circle-nano.ts:520` `circle_nano.proof_structurally_valid { payer }` — DORMANT
  (`validateCircleNanoPayment` is "currently unused by app code"; the live circle-nano leak is H1). Cover it for
  durability.

These are STRUCTURED meta keys, so the central `emit()` channel-B sanitizer (free-text keys only) does NOT touch
them. The DC-16 "no payer in our logs" claim is FALSE for x402 + drain.
- **Fix direction (do NOT edit `packages/mcp`):** redacting inside the SDK would change behavior for self-hosters
  (a self-hoster's raw payer in THEIR injected logger is THEIR data, not a SettleGrid leak). Fix at the SettleGrid
  seam: make the `appLogger` wrapper sanitize known payer keys before forwarding to `@/lib/logger`. Build a shared
  helper (e.g. `createSanitizingAdapterLogger()` in apps/web) that strips/redacts the payer key set
  (`payer`, `payerAddress`, `payerIdentifier`, `from`, `nonce`, `drainNonce`) from the meta — redacting hex-shaped
  values via `redactLogString`/`redactOpId` and preserving correlation where a row id is available — and use it in
  EVERY proxy file's `appLogger`. ENUMERATE all proxy files defining `appLogger` (x402, circle-nano, drain, ap2,
  …) — the build must sweep, not assume three. This single seam closes H1 + M1 + future adapter log additions.

### F2 + M3 [HIGH/MED, reviewer-reproduced E2E] — conditional Sentry clone ships the original error's `.cause`/`.errors[]`/`.metaMessages`/`.args` to Sentry
`apps/web/src/lib/logger.ts:101-103,126-127`. The sanitized `sanitizedErrorClone` is substituted into
`Sentry.captureException` ONLY when `redactLogString` changed `err.message` OR `err.stack`. If a viem error carries
the raw from/nonce ONLY in ancillary own-props (`.cause`, AggregateError `.errors[]`, `.metaMessages`, `.args`,
`.shortMessage`) and NOT in `.message`/`.stack`, NO clone is made, the ORIGINAL err reaches Sentry, and
`@sentry/nextjs`'s DEFAULT `linkedErrors` integration (instrumentation.ts has no custom `integrations`) serializes
the `.cause` chain (and AggregateError `.errors[]`) UNREDACTED. The author's own `sanitizedErrorClone` comment
("dropping them strictly improves the no-PII posture") is the intent — but the conditional gate defeats it exactly
when the top message looks clean. **This compounds with F1:** the packed-calldata blob leaves `.message` unchanged
(F1) → no clone → the cause chain ALSO leaks.
- **Fix direction:** make the sanitized clone UNCONDITIONAL for `err instanceof Error` (drop the
  `if (message !== err.message || stack !== err.stack)` guard) so `.cause`/`.errors[]`/`.metaMessages`/`.args`
  NEVER reach `captureException`. Update the `logger.test.ts` pin that asserts "does NOT clone when clean
  (capturedErr === clean)" → assert the captured error is a sanitized COPY (distinct identity; `.cause`/`.errors`
  absent; `.name`/redacted message preserved). Cover AggregateError. Weigh the modest DC-18 cost (Sentry loses
  cause chains app-wide) — acceptable and consistent with the author's stated posture; the primary exception
  (name + redacted message + redacted stack) is preserved.

---

## MEDIUM findings (fix in the same build)

### H2 / M2 [MED, code-confirmed] — the grep-guard (the durable DC-16 anti-regression) is blind to the exact class that leaked
`apps/web/src/lib/settlement/__tests__/log-redaction-guard.test.ts`:
- **Call regex `/\blogger\.(info|warn|error)\s*\(/`** does NOT match `appLogger.info(` (the `\b` boundary) — so
  H1 and every aliased-wrapper site are invisible. The guard is GREEN while H1 ships.
- **`SRC_ROOT = apps/web/src`** never walks `packages/mcp/src` — the M1 adapter sites are out of reach by
  construction (mitigated if the fix uses the apps/web `appLogger` seam, but the guard must still SEE the seam).
- **`logger['error'](…)` dynamic form** unmatched (one live instance: `cron/gas-balance-check/route.ts:65` —
  benign for PII today, but proves the class).
- **Quoted/computed keys** `'operationId':` / `['operationId']:` not flagged (the key-detector keys off the char
  after the identifier being `:`; a quote/`]` defeats it).
- **`…Id`-suffix auto-allow** (`isAllowedValue`): any value whose last dotted segment ends in `Id`/`id` PASSES by
  NAME, not provenance — `{ operationId: someId }` passes even if `someId` holds a raw op_id.
- **Fix direction:** broaden the call regex to aliased/wrapped loggers (`\b\w*[Ll]ogger\.(info|warn|error)\s*\(`
  plus the `logger['…'](…)` dynamic form); detect quoted + computed object keys; tighten the `…Id` allow to a
  provenance check (only the sanctioned PK reads `id`/`row.id`/`rowId`/`settlementEntryId(...)`); ensure the guard
  scans the `appLogger` seam (and decide explicitly whether to also walk `packages/mcp/src` adapter log sites or
  rely on the seam). Add a self-test for EACH new form (must RED on the raw `appLogger`/quoted/computed/dynamic
  leak, GREEN on the sanitized seam). A guard that cannot see a whole class of real logger calls is not "durable."

### M5 / L5-F4 [MED, reproduced] — `emit()` throws on a non-string `err.message`
`apps/web/src/lib/logger.ts:97` calls `redactLogString(err.message)` with no `typeof` guard, OUTSIDE the Sentry
`try`. An Error with a coerced non-string `.message` → `TypeError: s.replace is not a function` thrown out of
`emit()` — and `logger.error(...)` runs inside `catch` blocks, so the throw alters control flow and ALSO drops the
log line (a DC-18 observability regression — the pre-diff code only ASSIGNED `err.message`, never called a method
on it). Low reachability (standard Errors carry string messages) but a NEW unguarded failure mode.
- **Fix direction:** `redactLogString(typeof err.message === 'string' ? err.message : String(err.message))`;
  apply the same guard wherever `err.stack` could be non-string.

---

## LOW / residual (record; fix-now optional, M4 may DEFER)

- **M4 [LOW, latent] — no Sentry `beforeSend`; `onRequestError` (`instrumentation.ts:26`) + `global-error.tsx:13`
  bypass `emit()`/`redactLogString` entirely.** Not currently reachable (settlement catches its viem errors at
  `settle.ts:282` and does NOT rethrow to the route boundary), so latent. A `beforeSend` that runs
  `redactLogString` over `event.exception` would be the durable defense-in-depth that also belt-and-suspenders
  F1/F2/M3 at the Sentry boundary. **Recommendation: DEFER** to the hardened enable-runbook / a follow-up (adding
  it now is defensible defense-in-depth but is beyond the per-site/emit() design and touches a global Sentry hook)
  — OR include it if the build wants one durable Sentry scrubber. Document the decision either way.
- **F5 [LOW, latent] — free-text sanitizer keyed to only 5 key names** (`error/reason/message/details/stack`). A
  PII string under any other key (`errorReason`, `errMsg`, …) survives. No currently-reachable settlement log site
  does this (confirmed). Record as a latent class.

---

## CONFIRMED CLEAN (do NOT re-litigate in the fix build)
The 6-lens convergence + integrator ground-truth certified these as sound — the fix build should PRESERVE them:
- **Per-site settlement redaction (the §6 inventory minus the aliased/adapter class):** every payer-bearing
  `logger.*` site in reconcile/orchestrate/circle-nano-settle/settled-value/ledger/proxy-route is redacted (PK key
  `settlementEntryId`, `redactOpId`, `.id`, or dropped field). The two `operationIds` arrays
  (`reconcile.ts:980` + `:1138`) are handled.
- **`settlementEntryId`** is pure sha256 over `settlement:${invocationId}`, no DB round-trip, row-unique, and ==
  the stored PK `id` (`ledger.ts:424`) → runbook grep-by-`id` works. Export (E1) changes nothing.
- **`redactOpId` grammar** matches the canonical payer-op_id grammar (`reconcile.ts:107-108`,
  `anonymize-payer.ts` `PAYER_OPID_SQL_REGEX`) char-for-char; no over-redaction of UUIDs / bare tx-hash / bare
  address / other rails; `null → 'unknown'`; idempotent; no `/g` `.exec()` statefulness; no ReDoS (fixed
  quantifiers, linear; 5 MB stack ≈ 6 ms).
- **Zero-behavioral-change:** every settlement edit touches only the `logger.*(key,{meta})` token (or the emit()
  sanitizer); no `const operationId` binding / WHERE / CAS / lock / idempotency key altered. E2 (`reconcile.ts:962`
  `.select()` `operationId → id`) is a read-only projection feeding only the `reconcile.uncredited_settled` log;
  WHERE/ORDER/LIMIT byte-unchanged.
- **Runbook lockstep:** both runbooks key closure SQL on the PK `id` and recover `(from,nonce)` from the row by id;
  off-band-refund step documented to use txHash.
- **Existing test edits:** the ~16 updated assertions are faithful redacted-form updates using the REAL
  `settlementEntryId` (`importOriginal`); NONE loosened/deleted to mask a regression.
- **Correctly out of scope:** `invocations.metadata` payer (`route.ts:2110/2175`, `drainNonce` `:2461`) flows ONLY
  to the DB write, never a logger — correctly deferred to chunk 2; HTTP response-body `operationId` intact; no
  V-N3-erasure file touched. webhooks / audit_logs / `console.*` independently confirmed to carry no settlement
  payer/op_id. No log cardinality / Sentry grouping-key change.

---

## Process / policy record
- **Orchestration:** Agent-tool spawns (operator opt-in, recommended default — bypassPermissions moots the
  workflow loud-pause edge; Path-1 effort-bearing definitions absent so a single workflow couldn't host a
  mixed-effort/max lens). 5 baseline lenses spawned concurrently + the collective-miss critic after.
- **Effort:** all 6 reviewers + integrator at session `xhigh` (operator opt-in: max-depth core-invariant DEFERRED
  to ③). All reviewers self-reported `claude-opus-4-8[1m]`; effort self-report unreliable per policy, ground-truth
  = session xhigh. PATH 1 UNAVAILABLE (no effort-bearing named-subagent definitions) — surfaced; the xhigh fan-out
  via Agent-tool spawns + max deferred resolved it with no session switch.
- **Env clean** (FORK_SUBAGENT/SUBAGENT_MODEL/EFFORT_LEVEL all unset). **Gate** independently re-run
  clean+isolated: `tsc 0 · lint 0 err · vitest 204/4658/0` (the green gate masks the leaks — every leaking shape
  is untested; this is the central lesson).
- **Real assurance** = 6-lens convergence (F1 found independently by 3 lenses; M1 by the critic) + integrator
  source-level ground-truth of the §11 wiring + LIVE RED repro of F1.

## ROUTING
**BLOCKED → recovery loop → BUILD.** This doc is the binding fix spec. Build sequence (single-writer, fresh
context, `claude-opus-4-8` + `xhigh`): F1 long-hex regex (+F4) → F2/M3 unconditional Sentry clone (+ test) → M5
non-string guard → H1+M1 sanitizing-`appLogger` seam (shared helper, sweep ALL proxy files; do NOT edit
packages/mcp) → H2/M2 grep-guard rework (aliased/dynamic/quoted/computed + provenance allow + seam coverage +
self-tests) → decide M4 (defer vs include) → add the missing test fixtures (packed-calldata, AggregateError,
aliased-logger guard cases) → gate green + interval self-verify → re-enter ② seal-gating review. Then ③ (this
chunk stays high-stakes). AFTER this chunk: chunk 2 = `invocations.metadata` dark minimization; V-N3-erasure
enable unblocks only after BOTH land.
