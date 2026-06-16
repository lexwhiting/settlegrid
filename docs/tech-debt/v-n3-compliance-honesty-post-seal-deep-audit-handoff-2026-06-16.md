# V-N3 (compliance-honesty slice) → ③ POST-SEAL DEEP-AUDIT HANDOFF (2026-06-16)

> ② SEAL-GATING REVIEW COMPLETE → operator `/seal-go` CONFIRMED → cadence phase `sealed`. LOCAL only,
> never pushed. Base = `main` @ `fa87333a`. This is the input to ③ (the HIGH-STAKES post-seal deep
> audit). Read the ②-seal record (`v-n3-compliance-honesty-seal-2026-06-16.md`) and the ①-handoff
> (`v-n3-compliance-honesty-handoff-2026-06-15.md`) first; the V-N3 record is
> `v-n3-ledger-entries-gdpr-retention-gap-2026-06-14.md` (§2,§3,§5).

---

## 0. What ② did
Independent, hostile, fresh-context review of the BUILT diff (3 files: `compliance.ts` docstring +
`resultUrl` JSON, `docs/page.tsx:615`, the new regression test; +28/-4 prod + a 199-line test). 5
lens-distinct Opus-4.8 reviewers (correctness/determinism · spec-conformance · DC-16 core-invariant ·
SEAM · literal-execution/test-rigor); the integrator reproduced every load-bearing claim at source.
The full gate was re-run CLEAN ISOLATED (twice) — 4505/195, exit 0.

**Effort/orchestration note (policy):** PATH 1 (effort-bearing named subagents) was unavailable — the
available agent types are all generic, none carry `effort: max/xhigh` frontmatter, and a running agent
cannot stand up an effort-bearing definition mid-run. The operator chose "spawn now at current effort"
for a 30-line prose diff, so the seal reviewers ran at session effort (Opus 4.8, model-pinned), NOT a
per-agent `max` DC-16 lens / `xhigh` mix. The integrator compensated by grounding every decisive claim
at source and reproducing non-vacuity live. **③ should run the DC-16 wording / core-invariant lens at
`/effort max`** (Path-2 operator switch or Path-3 process) — the one coverage element ② could not
realize at the policy's preferred tier.

## 1. Gate evidence (RE-VERIFIED clean isolated, 2026-06-16)
| check | baseline @ `fa87333a` | ② re-run |
|--|--|--|
| apps/web `tsc --noEmit` | 0 | **0** |
| apps/web `lint` | 0 err | **0 err** (12 pre-existing warns) |
| apps/web `vitest` | 4491 / 194 | **4505 / 195** exit 0 (+14 = the new regression file, nothing else moved) |
| packages/mcp | untouched | NOT re-run (apps/web-only diff; `git status` confirms no mcp file changed) |

⚠ GATE-RUN HAZARD (recorded by prior seals): never run apps/web `vitest` concurrently with
packages/mcp `npm run build` (dist-rebuild race on `proxy-equivalence.test.ts`). N/A here (mcp
untouched) but holds for ③ if it builds mcp.

## 2. Tier — RE-CONFIRMED HIGH-STAKES (no escalation, no silent lowering)
Affects PUBLISHED (public docs FAQ) + RECORDED (developer-downloadable deletion `resultUrl`)
compliance claims at a PII/compliance boundary (DC-16). Low code-complexity; the legal/trust surface +
DC-16 false-claim risk make it HIGH-STAKES. Realized diff stayed WITHIN ①-handoff scope; no
frozen-surface touch (steps 1-9 unchanged; no erasure; export/privacy-notice untouched; only 3 files +
the test changed).

## 3. What ② VERIFIED at source (load-bearing — ground-truthed, NOT inspected)
- No surface asserts a lawful basis for the payer address — only "unsettled / counsel pending /
  erasure pending"; the 7-yr IRS/Stripe basis is applied only to the developer's own financial
  records.
- The new `resultUrl` keys are STATIC string literals (zero interpolation) → column PATH names only,
  no row-value / EVM-address leak in the developer-downloadable artifact.
- Developer-PII claim says "anonymized," never "erased/unlinkable" (email → deterministic
  `deleted-<id>@…`; `developerId` UUID still joins).
- Each corrected claim checks against deletion steps 1-9 (developer row anonymized at source; API
  keys/webhooks deleted; audit-log IP/UA removed; financial records retained, no inline developer
  PII). `ledger_entries` payer columns (`operation_id` `{rail}:{network}:{payer}:{nonce}` +
  `metadata.payer`) confirmed against the x402/circle-nano writers + schema.
- All 3 surfaces honest AND mutually consistent; account-deletion email makes no scrub claim (no 5th
  surface); adjacent FAQs defensible.
- Non-vacuity reproduced LIVE by the integrator: revert `docs/page.tsx` → 2 D-block RED; revert
  `compliance.ts` → 5 RED (4 docstring + 1 resultUrl); restore → 14/14 GREEN, tree byte-identical.

## 4. RESIDUALS for ③ (all NON-BLOCKING; claims/behavior correct, verified)

### MED — the honest deletion disclosure is PERSISTED but NOT developer-reachable (SEAM / DC-15)
`processDataDeletion` writes `resultUrl: JSON.stringify({...})` — a RAW JSON string. The download
route `api/dashboard/developer/data-export/[id]/route.ts` only decodes resultUrls beginning
`data:application/json;base64,` (the EXPORT path's format, `compliance.ts:319`); anything else hits the
`else` → `return NextResponse.redirect(exportRecord.resultUrl)` (`route.ts:71`). A bare `{...}` is not
a valid URL, so the deletion disclosure is **not served** to the developer today — it is persisted in
the `complianceExports` row only. The ①-handoff's "developer-downloadable — confirmed via GET …"
premise (and the test/handoff comments repeating it) overstated realized behavior.
- **Why non-blocking:** the chunk's purpose was to make the RECORDED claim honest; the persisted record
  IS honest. The route's handling of deletion resultUrls is PRE-EXISTING and explicitly scoped OUT by
  ①-handoff §1 ("the route serving any completed resultUrl regardless of requestType … OUT of this
  chunk").
- **③ actions:** (a) confirm whether ANY path delivers the deletion disclosure to the developer
  (support/legal-access/DB) or it is purely internal today; (b) decide base64-encode deletion
  resultUrls (so the existing route serves them) vs. gate the deletion case — a behavior change, do NOT
  fold under this seal; (c) soften the "developer-downloadable, confirmed" framing in the docs/handoff
  and the test's comments. Run the DC-16/SEAM lens at `/effort max`. Entangles with V-N3-erasure and
  the access-control note the ①-audit raised (route serves any completed resultUrl regardless of
  `requestType`).

### LOW — test robustness (DC-05-adjacent; test-only)
- Region end-marker `completedAt: new Date(),` is non-unique (2× in `compliance.ts`) — the slice is
  correct ONLY because the start marker `resultUrl: JSON.stringify({` is unique; prefer anchoring the
  end on the unique `retained: [`.
- `/all tables/i` is a broader substring than the actual old `"across all tables"` — cosmetic
  false-RED risk if future honest FAQ copy contains "…all tables" as a substring; `/across all
  tables/i` already covers the old string.
- Surface-C non-vacuity rests on a single assertion (single-stranded vs A/B's 4 and D's 2) — still
  genuinely non-vacuous.
- ③ may harden the test (test-only, low-risk) with non-vacuity re-proven, if it judges fit.

### LOW — docstring `purchases` linkage imprecision (DC-16; comment-only)
The docstring's "[financial records] reference the developer only by the now-anonymized developers
row" is loose for `purchases` (references `consumerId`/`toolId`; developer linkage is indirect via
`tool.developerId`). The operative conclusion "carry no developer-identifying PII of their own" is
TRUE. Optional comment tighten.

### Adjacent / OUT-OF-SCOPE (do NOT fold under this seal — legal-gated)
- The ACTUAL payer-address erasure / tombstoning / dedup-key redesign → **V-N3-erasure** (lawful basis
  + retention + dedup-key redesign need founder + counsel; V-N3 record §5).
- `docs/legal/privacy-notice-draft.md` (legal-gated; founder+counsel).
- The compliance EXPORT path (`collectDeveloperData`) `ledger_entries` omission (legal-gated;
  payer-vs-developer data-subject distinction).
- The `/v1/verify` transient payer-address echo (the THIRD payer-PII surface per V-N3 record §1) —
  transient, not a stored/claimed record → V-N3-erasure.
- Adjacent FAQ `:639` "your PII will no longer exist in any backup" — developer-PII-scoped, predates
  this chunk, does NOT contradict the corrected claim; revisit if a backup-erasure chunk lands.

## 5. Defect-class touchpoints (folded at seal)
- **DC-16** — the LIVE false claim CLOSED for the honesty surfaces (recorded in the ledger).
- **DC-15** — NEW SEAM recurrence: the persisted-not-served `resultUrl` + the handoff
  "downloadable, confirmed" drift (recorded in the ledger).
- **DC-05** — the new regression test is non-vacuous (integrator-reproduced live).

## 6. ③ scope & method
HIGH-STAKES integrated-whole audit. Run the DC-16 wording / core-invariant lens at `/effort max`
(Path-2 operator switch or Path-3 process). Prioritize the MED SEAM (does the recorded honest
disclosure ever reach the developer; is the "downloadable" framing accurate?). ③ MAY correct the LOW
residuals (test hardening + docstring tighten) — all test/comment-only, low-risk — if it judges fit,
with non-vacuity re-proven and the gate re-run. Do NOT pull in V-N3-erasure or any legal-gated work.
Founder-close is a LOCAL commit (path-scoped, NEVER push); `/push-go` is a separate explicit gate.
