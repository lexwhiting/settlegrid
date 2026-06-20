# V-N3-invocations-min — ③ POST-SEAL DEEP AUDIT (HIGH-STAKES, integrated whole) → **RE-CERTIFIED (hardened)** — 2026-06-20

> Post-seal deep audit of the SEALED commit `ea358d9f` (② SEALED, 5-lens fresh-context review + live PG 17.6
> SQL verify), on the committed tree (base `main` @ `bc7abc3e`). Scope = the INTEGRATED WHOLE — this chunk +
> how it composes with chunk-1 (log-redaction @bc7abc3e) and the existing proxy/settlement system — distinct
> from the ② seal-gating diff scope. Orchestration: **Agent-tool spawns** (operator opt-in, recommended —
> bypassPermissions moots a workflow's loud-pause edge; allowlist GREEN; small twice-audited surface; Path-1
> effort-bearing definitions ABSENT). Effort: 5 baseline lenses + a collective-miss critic + a fix-adversary,
> all at session `xhigh` (the optional `max` critic bump was NOT taken — no Path-1 pool, operator chose
> xhigh). All reviewers `claude-opus-4-8[1m]` (self-reported).
>
> **VERDICT: RE-CERTIFIED — hardened.** The integrated-whole audit found ONE genuine **HIGH** the diff-scoped
> ② review structurally could not: a **value-provenance leak on the drain rail** — `invocations.metadata.paymentId`
> carries the SAME raw EVM channel address as the already-minimized `drainChannelId`, so the address SURVIVED
> minimization for drain (the ② seal's "invariant holds both directions" was wrong). FIXED (drain-gated removal
> in the JS minimizer + SQL backfill, locked by a value-provenance census pin), reproduced live RED→GREEN,
> adversarially re-reviewed UNBROKEN, full gate re-run clean. New defect class **DC-23** (name-shape
> classification blind to per-rail value provenance) filed. Three carried LOW residuals closed; one LOW
> consciously deferred. Push remains the separate `/push-go` gate.

## Tier — RE-CONFIRMED HIGH-STAKES
PII / channel-correlation minimization + a DB write-path inside the money-rail proxy + a feature flag + a
disclosed-honesty gate (DC-16). ③ warranted (not incremental). The HIGH found below confirms the tier.

## Mechanical pre-flight (scripted, this session — handed to the reviewers so none re-derived)
- **Full gate, clean re-run from `apps/web` (pre-fix baseline):** `tsc=0` · `lint=0 err / 12 pre-existing warns`
  (logo/learn `<img>`, academy unused-disable — none in scope) · `vitest=207 files / 4727 tests / 0 failed`.
  Matches the ② seal digest.
- **Hostile-input battery: 36/36** against the real `minimizeInvocationMetadata` boundary — wrong-case /
  whitespace / `String`-object `paymentMethod` correctly RETAIN `payerIdentifier` (case-sensitive +
  `typeof==='string'` rail-gate; not reachable from the proxy's lowercase literal); null-proto input;
  `__proto__` no-pollution; object/array/bigint values removed by NAME; frozen-input no-throw + no-mutation;
  empty object; per-rail idempotence; all 10 non-EVM rails keep `payerIdentifier` + drop a stray `payer`.
- **Invariants re-derived & holding (pre-fix):** `EVM_PAYER_RAILS` {x402,circle-nano,drain} ⊆ the 13-rail
  `PaymentMethod` union (route.ts:1478); JS minimizer key-set ≡ SQL backfill key-set; `PROTOCOL_SENTINEL_ID`
  `…002` matches module:61 ↔ route.ts:1538, mpp `…001` (route.ts:1445) excluded; frozen surfaces
  (`compliance.ts`, `anonymize-payer.ts`, `vercel.json`, `schema.ts`, `recordMppInvocation`) byte-untouched;
  `compliance.ts` DC-16 disclosure block (`minimized`/`minimizedNote`) lists ONLY `ledger_entries.*` → the
  runbook deferral is intact and the dark chunk creates no current over-statement.

## The fan-out — five lenses + collective-miss critic
Lenses (each fresh-context, lens-only brief, read-only + gate/repro Bash): correctness/determinism ·
spec-conformance/frozen · core-invariant/PII-census · SEAM · literal-execution.

- **Correctness/determinism — CLEAN.** `minimizeInvocationMetadata` pure/idempotent/no-mutation; the batch loop's
  `completed` flag cannot report `true` while candidates remain (the only `false`-while-drained case is a benign
  cap-boundary re-run; the dangerous direction is impossible — identical predicate on SELECT and UPDATE);
  flag-OFF persisted object byte-identical to the pre-change inline literal; extraMetadata spread BEFORE
  minimization (no bypass). Two LOW non-reachable notes (JSDoc no-throw assumes a plain data object; the
  cap-boundary false-NEGATIVE) — no action.
- **Spec-conformance/frozen — CLEAN.** Every §3 IN item present and to-spec; every §3 EXCLUDED item genuinely
  absent (flag flip / backfill RUN / `compliance.ts` amendment / honesty-test extension / `vercel.json` wiring);
  §4 zero-behavioral-change held; §7 frozen surfaces untouched; no ledger-sibling gold-plating copied; §11/DC-15
  deferral correct AND safe (no current over-statement from the dark chunk).
- **Core-invariant / PII-census — found the HIGH (below).** Re-derived the census from live source. No
  over-minimization (all non-EVM ids retained); `EVM_PAYER_RAILS` exactly the EVM set; JS ≡ SQL key-set. But the
  **no-leak direction FAILS for drain** — see finding.
- **SEAM — TIGHT (6/7), one LOW.** The jsonb `?` bound-`$N` operator, the `-` subtraction chain + F5 no-overwrite,
  the `jsonb_typeof='object'` guard on BOTH SELECT and UPDATE, the `::text` µs keyset anchor, the three-branch
  `verifyCronAuth` (DC-08 byte-parity), and the `payerIdentifier ?? null` convergence seam all re-validated
  (live PG). LOW: `PROTOCOL_SENTINEL_ID` duplicated across module ↔ route with no executable drift guard
  (silent-wrong failure mode). INFO: the module's "proven at ledger.ts:817" comment overstates the precedent
  (that site uses a string-literal RHS; the bound-`$N` variant here is verified live, not by that precedent).
- **Literal-execution — CLEAN, two LOW latents.** Traced the backfill SQL per row-shape (convergence + the
  22023 guard hold); proved the census guard CATCHES an explicit new key but MISSES shorthand/computed/spread
  keys and has classifier name false-negatives (`evmFrom`/`txOrigin`/`beneficiary`/`spender`/…) — both LATENT
  (no current source triggers them). Minimizer V8 corners (getter/Symbol/`constructor`-key) behave correctly or
  are unreachable from the plain-object write-path.

### Collective-miss critic — widened the HIGH's class; confirmed it ISOLATED
Charged to find what the five lenses collectively missed and to widen the drain finding into its full class.
Built a rail×key value-provenance table over every metadata key into the per-rail settlement/adapter modules:
**`paymentId` is a raw EVM address ONLY on drain**; on every other rail it is a tx-hash / session / token /
intent / macaroon ref; `network` is CAIP-2; no extraMeta value is an address under a non-payer-shaped name. So
the drain finding has **no value-provenance siblings**. Also confirmed: the other `db.insert(invocations)` sites
(route.ts 714/783/1004/2678) carry no payer/channel/EVM value; **nothing reads `invocations.metadata.paymentId`/
`.drainChannelId`/`.payerIdentifier`** (the GDPR export omits the metadata column; no UI/analytics/reconcile
reader) → removing `paymentId` for drain is safe; no chunk-1 log-redaction interaction (the backfill logs counts
only, no payer in memory). Flagged the **non-convergence trap**: the fix MUST be rail-gated (drain-only), not
added to the unconditional set (paymentId is written `?? null` on every protocol row), and the JS + SQL must be
extended TOGETHER.

## The HIGH — drain `paymentId` value-provenance leak (FOUND, FIXED, RE-CERTIFIED)
**Finding.** For the drain rail the proxy sets `paymentId = result.channelId` (route.ts:2465) AND
`drainChannelId = result.channelId` (route.ts:2474) — the SAME value. `result.channelId = voucher.channelAddress`
(`packages/mcp/src/adapters/drain.ts:512/585/593`), a raw EVM address validated by `EVM_ADDRESS_RE` (drain.ts:208,
the on-chain DRAIN payment-channel contract on Polygon). The minimizer removed `drainChannelId` (unconditional
by-name) but RETAINED `paymentId`, so with the flag ON a drain invocation row still exposes the raw EVM channel
address in the queryable `invocations.metadata.paymentId` — the identical value just removed from `drainChannelId`,
defeating the channel-correlation minimization (handoff §5#2) for the entire drain rail. The ② seal's
core-invariant lens certified "the invariant holds BOTH directions"; that certification was WRONG. The census
guard could not catch it: it classifies by key NAME (`paymentId` ∉ the payer-shape regex) and explicitly
whitelisted `paymentId` — a structural blindness to per-rail VALUE PROVENANCE (new class **DC-23**).

**Reachability.** DARK today (flag OFF ⇒ the write-path is byte-identical and the address is written either way;
the backfill no-ops). It becomes a FAILED-minimization leak the instant the enable-runbook flips
`INVOCATIONS_PAYER_MINIMIZE_ENABLED` — operators (and a future amended DC-16 disclosure) would believe drain
channel data is minimized while `paymentId` silently retains it on every drain row (write-path AND backfill,
since both derive from the shared key constants). Fixing it now — before the flip — is squarely in-scope (it
completes this chunk's own EVM-payer minimization; it is NOT the deferred runbook work).

**Fix (rail-gated, convergent, JS + SQL together; OFF stays byte-identical).** In
`apps/web/src/lib/settlement/invocations-payer-min.ts`:
- New `DRAIN_RAIL = 'drain'` + `DRAIN_EVM_PAYER_KEYS = ['paymentId']` (a third coverage arm: keys whose VALUE is
  an EVM address ONLY on drain — drain-gated, never unconditional, since every other rail's `paymentId` is a
  non-EVM ref that must be RETAINED).
- `minimizeInvocationMetadata`: after the unconditional + rail-gated arms, `if (paymentMethod === DRAIN_RAIL)`
  delete `DRAIN_EVM_PAYER_KEYS`.
- `candidateMetaCondition`: a `drainGated` OR-arm `(metadata->>'paymentMethod' = 'drain' AND metadata ? 'paymentId')`
  — gated on the rail so non-drain rows (which always carry a retained `paymentId`) never become perpetual
  candidates, and a minimized drain row drops out → the scan still converges to zero.
- `minimizeRow`: a three-branch CASE — drain → `(stripped - payerIdentifier - paymentId)`; other EVM rails →
  `(stripped - payerIdentifier)`; else → `stripped` (drain branch FIRST since drain ∈ railList). Removes the SAME
  key-set as the JS minimizer for every rail (the JS-minimizer ≡ SQL-backfill system invariant, preserved).

**Anti-regression.** The census guard now imports `DRAIN_EVM_PAYER_KEYS` into COVERAGE and pins the
value-provenance FACT (`route.ts paymentId = result.channelId`) + that `paymentId` is name-shape INVISIBLE +
that the minimizer covers it + that it is NOT unconditional. A revert of the fix, or a change to drain's
`paymentId` source, fails the guard and forces re-review.

**Live RED→GREEN.** A drain `paymentId` pin failed against the shipped module (`1 failed | 28 passed` — the
address survived) and passed after the fix; a "non-drain rails RETAIN paymentId" pin passed both (no
over-minimization). Adversarial re-review (fresh context) attacked 7 surfaces — residual drain leak,
over-minimization, JS↔SQL divergence, convergence/idempotence (incl. `paymentId:null`), OFF byte-identity, SQL
branch-order/`::text`/parenthesization, census-guard regressions — and reported **FIX UNBROKEN** with live proofs.

## Carried LOW residuals — disposition
1. **`PROTOCOL_SENTINEL_ID` drift (SEAM LOW) — CLOSED.** Exported the constant; the census guard now asserts the
   module literal == the proxy `recordProtocolInvocation` literal (`ROUTE.toContain(...)`). A silent divergence
   (which would scope the backfill to the wrong consumer id while reporting success) now fails the build.
2. **Census-guard classifier name-gaps (literal-exec LOW) — CLOSED.** Broadened `EVM_PAYER_SHAPED` with the
   EVM/payer synonyms (`beneficiary|spender|originator|recipient|txorigin|evmfrom`); verified ZERO false-positive
   on every current scanned key (completeness check stays green) — fail-closed on a creatively-named future key.
3. **Cosmetic comment line-drift / doc-precision (LOW) — CLOSED.** Fixed `route.ts:1536→1538` (sentinel),
   `:1476→1478` (PaymentMethod union), `:1552→1545` (the `payerIdentifier ?? null` write); corrected the
   JSDoc "every other key incl. paymentId is preserved" line (paymentId is now drain-removed); softened the
   `?`-operator "proven at ledger.ts:817" comment to state the bound-`$N` variant was verified live.
4. **Census-guard LEXER hardening (shorthand / computed / spread) — DEFERRED (documented LOW).** `propertyKeys`
   requires a trailing `:`, so a future payer key added via shorthand `{ payerEoa }` / computed `{ ["k"]: v }` /
   spread `{ ...bag }` would bypass the guard. GENUINELY LATENT (every current metadata key is an explicit
   `key: value` literal; the established pattern is explicit). A lexer extension interacts with the guard's
   intentional over-collection of `forwardAndBill` paren-spans and risks test fragility; the value-provenance
   pin (DC-23) + the broadened classifier address the SHIPPED bug and the higher-likelihood name-gap. Carried as
   a LOW for a future census-guard hardening pass; not fixed under this re-certification to avoid over-engineering.

## Frozen / unchanged (re-confirmed at ③)
`recordMppInvocation`, proxy money/control flow, the deletion scrub + retention purge, `anonymize-payer.ts`,
`compliance.ts` (DC-16 disclosure still lists only `ledger_entries.*` — runbook deferral intact), `vercel.json`
(both dark routes correctly unwired), the schema — all byte-untouched. The fix lives entirely inside the
minimizer + backfill, so the flag-OFF persisted row stays byte-identical. `tools/page.tsx` remains the known
unrelated carry-forward (EXCLUDED); `.claude/` + `.audit/` are local-only.

## Gate re-run clean on the hardened tree
`cd apps/web && npx tsc --noEmit && npm run lint && npx vitest run` → `tsc=0` · `lint=0 err / 12 pre-existing
warns` · `vitest=207 files / 4736 tests / 0 failed` (+9 over the ② digest = the drain pins + constant pin +
candidate pin + drain provenance block + sentinel drift guard). Diff scope: ONLY `invocations-payer-min.ts` +
its two test files (the write-path route.ts, the two routes, env.ts UNTOUCHED by the fix — the leak was a
minimizer coverage gap, not a write-path bug).

## Defect-class ledger
- **DC-23 (NEW, FILED) — name-shape classification blind to per-rail value provenance.** A census / redactor /
  minimizer classifies fields by NAME (or a fixed key list), but a sensitive value flows into a
  generically-named, "retained-for-correlation" field on ONE code path/rail — so it escapes the name-shape
  guard. The drain `paymentId == channelAddress` instance (and the historical `drainChannelId` miss it
  rhymes with). Cross-refs DC-16 (the honesty parent), DC-05 (a guard that looks complete but isn't),
  DC-07 (the same value in two fields disagreeing on treatment).
- **SEAM class** (recurring) — re-validated across the jsonb `?`/`-`/`jsonb_typeof` operators, the keyset µs
  anchor, `verifyCronAuth`, and the convergence seam; tight (the one LOW = the sentinel drift, now guarded).
- **LITERAL-EXECUTION class** (recurring) — discharged by tracing the backfill SQL as PG executes it and the
  census guard as vitest executes it (real lexer/classifier on real source strings).

## Routing
**RE-CERTIFIED (hardened) → the ③ hardening folded into the LOCAL seal commit (message updated to ② SEALED +
③ RE-CERTIFIED), still UNPUSHED.** Push remains the separate `/push-go` gate. AFTER this: the **V-N3-erasure
ENABLE-RUNBOOK** (separate counsel-gated act, handoff §11) is unblockable — it MUST (1) flip BOTH flags; (2) RUN
both backfills, **live-dry-run the invocations backfill on staging FIRST** (the SQL is engine-verified on
constant expressions + now covers the drain `paymentId` key, but has never run against a populated table); (3)
amend `compliance.ts` to enumerate the invocations payer paths (incl. the drain `paymentId` channel path now
that it is minimized); (4) add a flag-ON regression pin. Do NOT do any of these here.
