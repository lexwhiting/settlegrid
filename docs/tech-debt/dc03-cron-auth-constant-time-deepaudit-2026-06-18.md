# DC-03 — cron-auth constant-time compare + secret normalization — ③ POST-SEAL DEEP AUDIT (2026-06-18)

> The high-stakes post-seal deep audit of the INTEGRATED WHOLE (distinct from the ② diff-scoped
> review). Tier re-confirmed HIGH-STAKES (sole auth gate on 32 endpoints incl. money rails
> `settlement-reconcile` + `process-payouts`) → this phase is warranted. Verdict:
> **RE-CERTIFIED — hardened (one non-vacuity test pin added; shipped helper byte-unchanged).**

## 0. Verdict
**The security moat holds. Zero high, zero medium across 6 fresh-context reviewers.** One LOW
inter-lens coverage gap (a vacuous over-cap test pin) was found by the collective-miss critic and
CLOSED fix-first with a non-vacuous pin, reproduced live. The shipped helper `cron-auth.ts` is
**byte-identical to the ② seal subject throughout** (shasum `3e91f144…ccae`); only the chunk's own
test file gained a pin. Re-cert gate green. **Code seal STANDS; test suite RE-CERTIFIED.**

## 1. Mechanical pre-flight (scripted, handed to the reviewers so none re-derived)
- **Seal-subject byte identity** — `cron-auth.ts` shasum `3e91f1446ea39f6b88ba60869ae171a8d091354e155ad8ca527aece615b1ccae` == ② subject. Seal transfers; no re-review trigger.
- **Gate (clean run, from `apps/web`)** — `tsc --noEmit` exit 0 · `lint` 0 err (8 pre-existing warns, none in scope) · `vitest` 199 files / 4596 tests / 0 failed.
- **Census** — `verifyCronAuth` call-sites = 32, importers = 32. No 33rd site since ②.
- **Frozen surfaces** — `env.ts` (`getCronSecret` raw, NO crypto); `middleware.ts` (no `cron-auth` import); no surviving inline `Bearer`-template compare; no residual `cronSecret` route refs.
- **LE-09 return-discipline** — structural sweep over all 32 sites: every non-`ok` branch `return`s.
- **Money rails** — `settlement-reconcile` test-pinned `{ip,userAgent}` log + both returns; `process-payouts` `{}` meta preserved + both returns; rate-limit→auth ordering preserved.
- **Hostile-input battery (12 cases, transient file, run + DELETED)** — cap off-by-one (4096 hashed / 5000 rejected / correct token at 4096 authenticates), case-sensitive scheme, single-space-exact, EDGE-only trim (internal whitespace preserved), symmetric tab/CR/LF trim, unicode secret no-throw + fail-closed, prefix-stripping rejected, exactly-`Bearer` rejected, empty header → unauthorized, no-throw length fuzz, nested-`Bearer` literal match. ALL correct.

## 2. Six fresh-context reviewers (Agent-tool spawns, model `claude-opus-4-8`, session `xhigh` inherited, coverage mode)
| Lens | Verdict | H | M | Low/info |
|---|---|---|---|---|
| **L1 crypto constant-time END-TO-END** | moat holds; no bypass / no exploitable timing defect | 0 | 0 | info: SHA-256 input-length leaks a coarse *length* bucket (not value), rate-limited/jitter-swamped |
| **L2 behavioral-equivalence (32 sites)** | NO DRIFT (full 32-row table); per-site contract byte-identical | 0 | 0 | info: trim+constant-time broadening (intended, test-pinned), incl. github/scan (was the one pre-existing constant-time site) |
| **L3 SEAM** | all 4 seams HELD | 0 | 0 | info: traced *source* import edges, not the compiled Edge bundle (inherent static-review limit) |
| **L4 literal-execution / LE-09** | NO fail-open; all 32 `return` every non-`ok`; helper never throws | 0 | 0 | — |
| **L5 cross-chunk + ledger DC-01..20** | CLEAN; no class recurs; census exact | 0 | 0 | info: kernel `constantTimeEquals` is the same SHA-256-both-sides algorithm (intentionally separate primitive; future-drift candidate only) |
| **L6 collective-miss critic** | no seal-breaking miss; 1 LOW coverage gap | 0 | 0 | **LOW: over-cap test pin vacuous w.r.t. the cap (fixed, §3)** |

Model report-back: all reviewers `claude-opus-4-8[1m]`. Effort self-reports ("high") are
**known-unreliable per policy** — ground truth is ad-hoc Agent-tool spawns inherit the **session
effort = `xhigh`** (settings.json `effortLevel: xhigh`; env `EFFORT_LEVEL` unset).

## 3. The one finding — LOW, CLOSED fix-first (DC-05 vacuous-pin recurrence)
- **Found (L6):** `cron-auth.test.ts`'s over-`MAX_AUTH_HEADER_LEN` pin drove a WRONG 5000-char
  token → `'unauthorized'` WITH or WITHOUT the `raw.length > 4096` guard (the hash compare rejects
  a wrong token anyway). Silently deleting the cap line left the suite green → the pin named the
  cap but did not constrain its existence. This is the **DC-05 "green suite masks breakage"**
  pattern (a top-recurrence class here), on the DC-11 defense-in-depth cap.
- **Fix (test-only; shipped helper untouched):** added a pin driving an OTHERWISE-CORRECT token
  that exceeds the cap (mock secret 4090 chars → `Bearer …` = 4097 > 4096) — authenticates IFF the
  cap is removed, uniquely killing the cap-removal mutant.
- **Live reproduction:** new pin PASSES on the shipped (capped) helper; against a cap-removed
  mutant exactly ONE test FAILS (the new pin); helper restored **byte-identical** (shasum
  `3e91f144…ccae`); full re-cert gate green **199 files / 4597 tests / 0 failed** (= 4596 + the 1
  new pin).
- **Ledger:** the LOW vacuous-pin slotted under `DC-05` with an extended detection cue
  (*mutation-test a load-bearing pin against the invariant it claims to protect*).

## 3a. DC-03 ledger-ID collision — RESOLVED (operator-authorized, 2026-06-18)
**Finding (research).** The chunk's working label "DC-03" was inherited from the **V-N4 post-seal
finding register** (`.audit/v-n4-postseal/findings-register.md`, finding L5-VI: "cron reconcile
authenticates `CRON_SECRET` with a plain string compare … recorded for a future chunk"), where
V-N4 loosely tagged a weak-auth-on-a-money-rail risk "DC-03". It is **not** a ledger-class claim and
collides with the unrelated ledger class `DC-03-unauthenticated-forgeable-money-mutation.md`.
**The defect structures differ:** ledger DC-03 = an *absent / forgeable* identity-or-ownership check;
the cron-auth defect = a *present but side-channel-leaky comparison primitive*.

**Resolution — minted `DC-21` (next free id), left ledger DC-03 untouched.** The cron-auth class is
a genuinely distinct, recurring structure (≥4 in-repo surfaces: the 32 inline `!==` compares;
github/scan's `length !==`-precheck "constant-time fix" done WRONG — the smoking-gun independent
instance; the parallel-correct kernel `constantTimeEquals` duplicate; a **live OPEN** `demo/sandbox`
`===` on `DEMO_TOOL_SECRET`). It is not DC-03 (absent check), not DC-07 (multi-copy drift —
orthogonal; the leak exists at one site), not DC-08/DC-11. Ledger edits (all LOCAL, `.audit/`
untracked): `DC-21-non-constant-time-secret-comparison.md` created; `INDEX.md` adds DC-21 + the
secret-compare recurrence-lens cross-ref; `DC-07` strengthened with the 32-site cron-auth DRIFT
instance. The live `demo/sandbox` `===` is recorded under DC-21 for a **future chunk** (out of this
chunk's scope — not folded). The chunk keeps "DC-03-cron-auth-constant-time" as a historical handle.

## 4. Integrator independent ground-truth (re-ran every load-bearing claim live)
- `indexnow` multi-handler check (the one HIGH-candidate surface): `POST` is gated via
  `verifyCronAuth`; `GET` returns the public `INDEXNOW_KEY` (`text/plain`, no auth, no side-effect,
  does NOT read `CRON_SECRET`) — correct by the IndexNow verification-key protocol. Not a defect.
- Helper byte-identity asserted before AND after the mutant cycle (shasum unchanged).
- Re-cert gate re-run from scratch: tsc 0 / lint 0 err / vitest 199f-4597t-0fail.

## 5. Info-level residuals (carried, none require a fix)
1. **SHA-256 input-length timing** — leaks at most a coarse secret-*length* bucket (fixed per
   deployment), never the value; rate-limited on the money rails. Non-exploitable.
2. **Edge-bundle assurance via source trace** — SEAM-6 closed at source-import level (node:crypto
   confined to `cron-auth.ts`; no Edge-runtime importer; `instrumentation.ts` imports only Sentry);
   the compiled `.next` Edge chunk was not built. Inherent to read-only review; strong as traced.
3. **Kernel `constantTimeEquals` algorithm duplication** — the telemetry/kernel primitive uses the
   same SHA-256-both-sides→`timingSafeEqual` shape for a DIFFERENT secret. Intentionally separate;
   recorded as a future-drift candidate only (no current divergence; consolidation out of remit).
4. **Symmetric-trim broadening** — the one conscious behavior change (closes S-D17, avoids the
   Vercel raw-env lockout); intended, test-pinned.

## 6. Frozen surfaces — re-asserted unchanged
`getCronSecret()` raw; `env.ts` crypto-free; `middleware.ts`; edge routes; no new deps/migration;
every route's status/error codes, body messages, log keys+fields, and check ordering. All verified
untouched. In-scope set = `cron-auth.ts` (byte-identical) + 2 test files (+1 pin in
`cron-auth.test.ts`) + 32 routes. `tools/page.tsx` EXCLUDED (unrelated carry-forward).

━━ Verdict: **③ RE-CERTIFIED** — code seal STANDS (helper byte-identical), test suite hardened with
one non-vacuous cap pin. Founder-close + /push-go are separate later gates. ━━
