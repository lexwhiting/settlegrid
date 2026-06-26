# V-N3-deletion-cascade-correctness — ③ POST-SEAL DEEP-AUDIT RECORD — 2026-06-25

**Verdict: RE-CERTIFIED (hardened).** The sealed change (cb0033e6) is correct and to-spec on the
integrated whole; the three core invariants HOLD under independent re-derivation, hostile review,
and live mutation. Four sustained findings from the routed LOWs + the deep audit were resolved
fix-first (F1, F-A1, F-C1) or formally accepted (F2); one latent item (F-B1) is documented as a
DEFERRED caller-wiring hardening candidate. The hardening is staged in the working tree awaiting
the operator commit gate (Claude does not self-commit).

Tier confirmation (one line): **HIGH-STAKES** — shipped GDPR-deletion behavior on a PII/compliance
+ financial-record boundary, a new "invocations survive deletion" invariant, a DC-16 disclosure
surface, and correctness-critical test infra. ③ warranted; this pass is the integrated-whole,
post-seal hostile review distinct from the ② diff-scoped seal review.

---

## 1. Mechanical pre-flight (clean re-run on the committed tree, this session)
- `npx tsc --noEmit` → **0 errors**.
- `npm run lint` → **0 errors** (pre-existing warnings only: academy-lessons unused-directive, img/hooks).
- `npx vitest run` → **208 files / 4753 tests pass** (pre-fix baseline) → **4755** after the +2 ③ tests.
- pglite integration test executes **non-vacuously** (~4.0s, real "Pulling schema from database…").
- Invariants re-derived AT SOURCE (digest in scratchpad p3-preflight-digest.md): `invocations` has 3
  NOT-NULL ON DELETE CASCADE FKs (toolId/consumerId/apiKeyId); migration `0000:260` FK byte-identical
  to schema.ts:327; `tools`/`consumers`/`apiKeys` are only UPDATEd (never deleted) → all 3 cascade
  vectors inert; the 4 leaf DELETEs (developerApiKeys/consumerSchedules/waitlistSignups/webhookEndpoints)
  do not transitively reach invocations; 5 keyHash auth paths all reject `status!=='active'`; empty-array
  inArray gated (step 2 on consumerMatched, steps 3-4 on toolIds.length>0).

## 2. Review fan-out (Agent-tool Path-1-style spawns; model claude-opus-4-8, session effort xhigh)
Workflow not opted-in this turn; Path 1 (`effort: max` named subagent) UNAVAILABLE — no `.claude/agents/`
pool exists — so the optional `max` core-invariant bump could not run via Path 1 and (a workflow runs one
session effort) could not run inside a workflow either. Per the sanctioned no-stall escape, the
collective-miss critic ran at the in-policy **xhigh** baseline (max bump not taken; recorded as a coverage
note, not a silent gap). Env clean (FORK_SUBAGENT/SUBAGENT_MODEL/EFFORT_LEVEL all UNSET). Allowlist GREEN
(tsc/vitest/lint/git present). All six agents reported running on `claude-opus-4-8[1m]` (self-reported
effort "high" = the known Opus introspection under-report; actual session dial xhigh).

Six fresh-context hostile reviewers in coverage mode:
1. **Core-invariant / data-integrity** (the deferred core-invariant pass, at xhigh) — all three invariants
   HOLD (data survival, de-auth completeness across the full re-grepped auth surface incl. no 6th path / no
   reactivation path, no cross-principal over-deletion). F5/DC-14 residual: prod builds from schema.ts via
   `push`; cascade is what prod runs.
2. **SEAM** — all seams hold; no keyHash-UNIQUE re-use collision, no status-blind key-count quota, 'revoked'
   matches the live revoke route; **18 schema.ts tables have NO migration → prod uses drizzle-kit push**
   (re-confirms the ② F5 ACCEPTED ruling at source).
3. **LITERAL-EXECUTION** — both UPDATEs carry a correct `.where` (proven by probe: an unrelated key stayed
   active); the FK `LIKE '%invocations%api_key%'` matches exactly one constraint; pushSchema materializes
   the FK; the 4-combo disclosure JSON is self-consistent, single-bucket holds. Confirmed F1.
4. **Cross-chunk / disclosure-honesty (DC-16)** — F1 (no-twin note over-discloses), F2 analysis (payer clause
   attributes a PROTOCOL_SENTINEL_ID-only artifact to twin rows; live invocations-minimization is scoped to
   the …0002 sentinel rows only and never the twin-keyed rows the clause describes).
5. **Defect-class recurrence + latent** — F-A1 (keystone fixture makes step 3 redundant), F-B1 (revoke opens
   a concurrent post-scrub insert window), F-C1 (stale `:829-830` self-citation); idempotency/retry SAFE.
6. **Collective-miss critic** (xhigh) — independently re-ran the FULL gate (4753 pass, tree clean,
   not order-dependent); verified the mock revoke pins are NON-VACUOUS (assert `{status:'revoked',
   ipAllowlist:null}` AND no `.delete(apiKeys)`); processDataExport is orthogonal (excludes metadata,
   never reads api_keys); the deletion `resultUrl` is **not served** today (raw JSON, not base64 → the serve
   route 500s on it + the subject's auth is severed) so F1's over-disclosure is not user-visible; and
   **corrected the F-A1 success criterion** (see §3).

## 3. Findings — resolution
### SUSTAINED — FIXED fix-first (reproduced live)
- **F1 (DC-16, MED honesty / LOW exposure) — FIXED.** The `retainedUnscrubbedNote` foreign-tool clause was
  unconditional while the `retainedUnscrubbed` array is `consumerMatched`-gated; for a no-twin subject the
  persisted note asserted foreign-tool retention + a step-2 pseudonymization that did not occur (a positive
  false particular, safe direction). **Fix:** gate the clause on `consumerMatched` in both flag branches via
  inline template-literal conditionals — the literal text stays in source so the source-text honesty pins
  (compliance-honesty-regression.test.ts) remain valid, and the runtime omission is now pinned by a new
  integration test. **RED→GREEN:** the new "NO-TWIN DISCLOSURE (F1)" integration test failed against the
  shipped code (note contained "Invocation rows on other developers' tools" + "pseudonymizes") and passes
  after the fix; the 44 honesty-regression pins stay green. `compliance.ts` ~line 1010.
- **F-A1 (DC-05, LOW sev / coverage gap) — FIXED (test strengthening).** The keystone "THE FIX" fixture gave
  the consumer twin BOTH keys, so step 2 (consumerId-keyed) already revoked the own-tool key and step 3 was
  REDUNDANT — neutering step 3 left the keystone GREEN (the critic's mutation proof; reverting step3→delete
  *did* go RED, so the original stated criterion was already met for the wrong reason). **Fix:** a dedicated
  "STEP 3 IS LOAD-BEARING" integration test seeds a NON-TWIN third-party consumer's key on the subject's OWN
  tool (reached only by the toolId-keyed step 3; subject has no twin so step 2 never runs). **Mutation-proven:
  neutering step 3 to a no-op now turns this test RED** while the original keystone stays green (and
  revert→delete cascade-kills its invocation → RED). No code change; no frozen surface; authorized by handoff §3.
- **F-C1 (DC-15, LOW / comment-only) — FIXED.** The self-citation at `compliance.ts:967` read "(mirrors the
  :829-830 retainedUnscrubbed→anonymized gating pattern)", but line drift had moved `:829-830` onto the step-7
  tool-reviews header; the real pattern is the SLICE-4 consumer-linkage gating (~:901-908). **Fix:** replaced
  the brittle line number with a semantic anchor ("the SLICE-4 consumer-linkage … gating above"). This is the
  exact self-invalidation pattern DC-15 documents.

### SUSTAINED — formally ACCEPTED (no change)
- **F2 (DC-16, LOW) — ACCEPTED (accurate hedge).** The clause "may hold the captured on-chain payer" is
  imprecise (the SettleGrid-captured payer lands only on PROTOCOL_SENTINEL_ID `…0002` rows, which are the
  rows the live `INVOCATIONS_PAYER_MINIMIZE_ENABLED` backfill scrubs — never the twin-keyed real-consumer
  rows the clause enumerates), but the `"may"` hedge + "free-form caller context" keeps it from being false
  and it over-discloses in the SAFE direction. **Flag-gating would be WRONG** twice over: compliance.ts
  branches on the LEDGER flag (`LEDGER_PAYER_ANONYMIZE_ENABLED`), not the invocations flag, and the
  invocations-minimization never touches the twin rows — gating on it would falsely imply those rows get
  minimized. A general-phrase rewrite would also break the source-text pin at compliance-honesty-regression
  :549. Accept the hedge.

### NOTED — INFO / accepted
- `api_keys` bucketed under `anonymized` as a bare path: only `ip_allowlist` (the sole PII jsonb) is nulled;
  keyHash/keyPrefix retained on the surviving revoked row (one-way hash + non-personal prefix, key
  de-authenticated). Honest at the PII level; survival is disclosed in the note prose. Single-bucket holds.
- `invocations.metadata` (anonymized own-tool / retained foreign-tool, prose-disclosed) and `tools`
  (name/slug retained-by-design) bucket entries: accepted by design.
- `apiKeys.lastUsedAt` survives on the revoked row (critic #4): a behavioral timestamp, not a direct
  identifier; the key is de-authenticated. Marginal single-bucket asymmetry, no correctness impact. Accept.

### DEFERRED — caller-wiring hardening (DC-13)
- **F-B1 (DC-13, MED conf / LOW sev) — DEFERRED, documented.** Because steps 2-3 now KEEP the key row alive,
  a request that authenticated *before* the revoke committed can INSERT an invocation *after* step 4's
  metadata-null, landing fresh PII (the already-public on-chain payer + free-form metadata) that escapes the
  scrub (under the old delete the insert would FK-fail). The window is narrow, requires a live-traffic account
  during deletion, and the function is DORMANT (zero prod callers). **Do NOT fix now** — the correct remedy is
  a "deactivate-before-delete" gate that belongs to the future caller-wiring chunk (fixing it here would pull
  in deferred deactivation logic). Recorded as a binding hardening requirement for when processDataDeletion is
  wired to a live caller.

## 4. Hygiene / staging
Working-tree diff vs cb0033e6: `apps/web/src/lib/settlement/compliance.ts` (+F1 note gating +F-C1 comment) and
`apps/web/src/lib/__tests__/compliance-deletion-cascade.integration.test.ts` (+2 tests). **EXCLUDE** at commit:
`apps/web/src/app/(dashboard)/dashboard/tools/page.tsx` (untouched slugify carry-forward), `.claude/`
(untracked), `.audit/` (gitignored — ledger update stays local), `.env*`. Stage explicit paths only; verify
`git diff --cached --name-only` before any commit. Config-dir model repin (`opus[1m]`→`claude-opus-4-8`)
recommendation from ② still stands (restart-downgrade hazard) — operator action.

## 5. Defect-class ledger (local, .audit/) — recurrence instances appended
- **DC-16**: F1 resolution (conditional-clause vs gated-array honesty asymmetry in a persisted record).
- **DC-05**: F-A1 (a real-PG keystone whose fixture made a whole prod step redundant → that step's behavior
  proven only by composition; closed by a non-twin own-tool seed).
- **DC-15**: F-C1 (line-number self-citation invalidated by the function's own growth; fixed with a semantic anchor).
- **DC-13**: F-B1 (revoke-not-delete opens a post-scrub concurrent-insert window; deferred to caller-wiring).
- **DC-14**: NO recurrence — prod-builds-from-schema.ts confirmed (18 schema-only tables); F5 ACCEPTED holds.
No NEW defect class; SEAM and LITERAL-EXECUTION lenses found no sustained findings.

## 6. Post-fix gate (clean re-run)
`npx tsc --noEmit` → **0**; `npm run lint` → **0 errors**; `npx vitest run` → **208 files / 4755 tests pass**;
the integration test (now 4 tests) executes non-vacuously. F1 RED→GREEN and the F-A1 neuter→RED mutation both
reproduced live this session.

## 7. Verdict
**RE-CERTIFIED (hardened).** The sealed result stands, hardened by three fix-first resolutions (F1 honesty
gating, F-A1 keystone load-bearing test, F-C1 comment) and one formal acceptance (F2), with F-B1 recorded as
a binding caller-wiring hardening. No frozen surface was perturbed beyond the F1 resolution that handoff §2
explicitly authorized; the DEFERRED FK migration was not pulled in. Hardening staged in the working tree
awaiting the operator commit gate.
