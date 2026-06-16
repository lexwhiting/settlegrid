# V-N3 (compliance-honesty slice) — honest GDPR Art-17 deletion claim → SEALED (2026-06-16)

> ② seal-gating review PASSED; operator `/seal-go` confirmed → cadence phase `sealed`. LOCAL only,
> **NOT pushed** (push is a separate `/push-go` gate). Base = `main` @ `fa87333a`. Closes the LIVE
> DC-16 false-compliance claim that GDPR deletion "scrubbed PII across all tables" while
> `ledger_entries` retains the anonymous on-chain payer's raw EVM address un-scrubbed. The ACTUAL
> erasure remains the legal-gated **V-N3-erasure** chunk (counsel pending).

## Verdict
**SEALED** — gate green, zero high-severity findings open, reviewers' evidence supports it.

## What shipped (one line)
The GDPR Article-17 deletion claim is now HONEST and mutually consistent across all three surfaces —
the `processDataDeletion` docstring (A/B), the developer-downloadable `resultUrl` JSON (C, new
`retainedUnscrubbed` / `retainedUnscrubbedNote` keys = column PATH names only), and the public docs
FAQ (D, the "across all tables" over-claim dropped) — stating the `ledger_entries` payer-address gap
as FACT (retained, un-scrubbed, erasure pending) and **NEVER** asserting a lawful basis; pinned by a
new non-vacuous source-text regression test.

## Gate (re-verified clean isolated, this session, twice)
apps/web `tsc` 0 · `lint` 0 err (12 pre-existing warns) · **`vitest` 4505 / 0 (195 files), exit 0**
(baseline 4491/194 → delta = exactly the **+14** new regression tests, nothing else moved).
packages/mcp UNTOUCHED (diff is apps/web-only; not re-run, per ①-handoff §3 — `git status` confirms
no mcp file changed).

## Review shape
5 fresh-context, lens-distinct Opus-4.8 reviewers on the real diff (correctness/determinism ·
spec-conformance · **DC-16 core-invariant** · SEAM · literal-execution/test-rigor) + integrator live
source-grounding. **Policy note:** PATH 1 (effort-bearing named subagents) was unavailable — the
available agent types are all generic, none carry `effort: max/xhigh` frontmatter, and a running agent
cannot stand up an effort-bearing definition mid-run. The operator chose "spawn now at current effort"
for a 30-line prose/comment diff, so reviewers ran at session effort (Opus 4.8, model-pinned), NOT a
per-agent `max` DC-16 lens / `xhigh` mix. The `max`-depth DC-16 wording pass is routed to ③.
Allowlist pre-flight GREEN (all gate/repro caps present); reviewers were read-only.

## Verified at source (load-bearing)
- **No lawful-basis claim.** No surface asserts the payer address is "exempt"/justified/permitted —
  only "unsettled / counsel pending / erasure pending". The 7-yr IRS/Stripe basis appears only on the
  developer's own financial records, never on the payer address (the DC-16 "fix-introduces-a-new-false
  -claim" trap).
- **No PII leak in the recorded artifact.** The new `resultUrl` keys are STATIC string literals (zero
  interpolation) → column PATH names + a generic note only; no row value / EVM address in the
  developer-downloadable JSON.
- **No over-escalation.** Developer-PII claim says "anonymized," never "erased/unlinkable" (email →
  deterministic `deleted-<id>@…`, `developerId` UUID still joins rows).
- **Truth vs code.** Every corrected claim checks against deletion steps 1-9 (developer row anonymized
  at source; API keys/webhooks deleted; audit-log IP/UA removed; financial records retained, carry no
  inline developer PII).
- **Completeness + consistency.** All 3 surfaces honest AND mutually consistent (machine C ↔ human
  A/B ↔ public D); consistent with adjacent FAQ `:635`. Census re-run: the account-deletion email
  makes NO scrub claim (no 5th surface); `:607/:635/:639/:652` are developer-scoped and defensible.
- **Non-vacuity reproduced LIVE by the integrator** (not inspection): revert `docs/page.tsx` → 2
  D-block RED; revert `compliance.ts` → 5 RED (4 docstring + 1 resultUrl); restore → 14/14 GREEN, tree
  byte-identical (`git diff --stat` = the 2 as-built files).

## Frozen-surface compliance
Diff = exactly 3 files (`compliance.ts` docstring + resultUrl JSON; `docs/page.tsx:615`; the new
test). Deletion transaction steps 1-9 UNCHANGED; **no** `delete(ledgerEntries)` /
`operation_id`/`metadata.payer` anonymization; export path (`collectDeveloperData`) untouched;
`docs/legal/privacy-notice-draft.md` untouched; the other 3 financial tables NOT re-framed as leaking
PII. No legal-gated work pulled in.

## Open residuals (NON-BLOCKING → ③ / V-N3-erasure)
- **MED (SEAM / DC-15):** the deletion `resultUrl` is PERSISTED but NOT actually served by the
  download route — `api/dashboard/developer/data-export/[id]` only decodes
  `data:application/json;base64,` URLs; a deletion record's raw-JSON `resultUrl` hits the `else` →
  `NextResponse.redirect(rawJson)` fallback (invalid URL). So the honest disclosure is recorded but
  not currently developer-reachable; the ①-handoff's "developer-downloadable, confirmed" framing is
  aspirational. PRE-EXISTING route behavior, explicitly scoped OUT by ①-handoff §1. The built-code
  honesty is correct regardless. ③/V-N3-erasure: decide base64-encode deletion `resultUrl`s (so the
  route serves them) vs. gate them, and soften the "downloadable" framing in docs/handoff/test
  comments.
- **LOW (test robustness, DC-05-adjacent):** the resultUrl region end-marker `completedAt: new
  Date(),` is non-unique (2× in file) — works only because the start marker `resultUrl:
  JSON.stringify({` is unique; prefer anchoring on the unique `retained: [`. `/all tables/i` is a
  broader substring than the actual old `"across all tables"` (cosmetic false-RED risk on future
  copy). Surface-C non-vacuity is single-stranded. None block; optional test-only hardening at ③.
- **LOW (DC-16 wording):** docstring "[financial records] reference the developer only by the
  now-anonymized developers row" is slightly loose for `purchases` (references `consumerId`/`toolId`;
  developer linkage is indirect via `tool.developerId`) — the operative "carry no
  developer-identifying PII of their own" conclusion is TRUE. Optional tighten at ③.

## Defect-class ledger
DC-16 LIVE false claim → **CLOSED** for the claim-honesty surfaces (recorded). NEW SEAM recurrence
recorded: **DC-15** (the persisted-not-served `resultUrl` + handoff "downloadable" drift). Touchpoints:
DC-05 (the new test is non-vacuous, integrator-reproduced live), DC-15 (keep the corrected comment in
sync with code).

## Next
HIGH-STAKES → ③ post-seal deep audit
(`v-n3-compliance-honesty-post-seal-deep-audit-handoff-2026-06-16.md`), DC-16 wording / core-invariant
lens at `/effort max`, prioritizing the SEAM persisted-not-served question (does the recorded honest
disclosure ever reach the developer, and is the "downloadable" framing accurate?). Founder-close LOCAL
commit (path-scoped), then `/push-go` only on explicit founder say-so.
