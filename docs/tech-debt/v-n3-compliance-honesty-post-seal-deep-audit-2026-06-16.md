# V-N3 (compliance-honesty slice) — ③ POST-SEAL DEEP AUDIT → RE-CERTIFIED (hardened) (2026-06-16)

> ③ HIGH-STAKES post-seal deep audit of the SEALED chunk (base `main` @ `fa87333a`; LOCAL, never
> pushed). Scope = the INTEGRATED WHOLE on the working tree, distinct from the ②-seal diff scope.
> Inputs: the ③ handoff (`v-n3-compliance-honesty-post-seal-deep-audit-handoff-2026-06-16.md`), the
> ② seal (`v-n3-compliance-honesty-seal-2026-06-16.md`), the ① handoff
> (`v-n3-compliance-honesty-handoff-2026-06-15.md`), the V-N3 record
> (`v-n3-ledger-entries-gdpr-retention-gap-2026-06-14.md`).

## Verdict
**RE-CERTIFIED (hardened).** The sealed 3-surface honesty result is **sound and stands** — it does
exactly what it set out to do (the persisted record, the docstring, and the public FAQ are honest
about the `ledger_entries` payer-address gap and assert no lawful basis), and it need not be
reverted. Low-risk hardening was folded on the **chunk's own surfaces**; **new DC-16 recurrences in
adjacent, untouched surfaces were surfaced and ROUTED OUT** (not folded — separate scope). The
broader product-wide "compliance honesty" goal is **NOT complete**: at least one LIVE false public
GDPR claim sits one FAQ away from the corrected surface (see Finding N1) and needs a follow-up slice.

## Tier confirmation
HIGH-STAKES confirmed (PUBLISHED + RECORDED compliance claims at a PII/DC-16 boundary). This phase
warranted. Not incremental.

## Mechanical pre-flight (this session, clean)
- **Gate GREEN:** apps/web `tsc --noEmit` 0 · `lint` 0 err (12 pre-existing warns) · `vitest`
  **195 files / 4506 / 0** (was 4505; +1 = the new `retainedUnscrubbedNote` pin). packages/mcp
  untouched (apps/web-only diff).
- **Non-vacuity RE-PROVEN LIVE** (integrator, not inspection): revert docs only → 2 D-block RED;
  revert compliance only → 6 RED; revert the note (Fix A) only → the new note-pin RED; revert the
  docstring-linkage (Fix B) only → STILL GREEN (precision-only, test-neutral); restore → 15/15
  GREEN, working tree = exactly the 3 expected files.
- **Source re-derivation of every load-bearing claim:** the deletion txn (steps 1-9) never touches
  `ledger_entries`; the `anonymized`/`retained`/`retainedUnscrubbed` arrays are byte-accurate to the
  SQL; `operation_id`/`metadata.payer` are real columns carrying the payer EOA; the resultUrl arrays
  are static literals (no row-value leak); the disclosure is written on every `completed` path.

## Orchestration / policy (applied)
- Session effort **xhigh** (= phase baseline; `effortLevel: xhigh` in settings) — **no floor switch
  needed.** Env clean: `CLAUDE_CODE_FORK_SUBAGENT` / `CLAUDE_CODE_SUBAGENT_MODEL` /
  `CLAUDE_CODE_EFFORT_LEVEL` all unset. Allowlist GREEN (gate caps present; reviewers were READ-ONLY,
  zero capability exposure).
- **Agent-tool Path-1 spawns** (model-pinned `opus` → claude-opus-4-8, inheriting session xhigh), not
  a workflow — small single-subsystem fan-out; the workflow's off-context/large-fan-out benefits did
  not materially apply. 5 lens-distinct reviewers (DC-16 honesty · SEAM · LITERAL-EXECUTION ·
  integrated-whole/hostile-input · test-rigor) + a collective-miss critic. **Collective-miss critic
  ran at xhigh** (optional `max` bump NOT taken — no mid-run operator switch, per the no-stall rule;
  Path-1 `effort: max` definition absent). Every reviewer reported model = claude-opus-4-8.
- WARN (non-blocking): a settings model pin uses the bare alias `opus[1m]` alongside the full
  `claude-opus-4-8[1m]` — restart-downgrade trap; not active this session (ran on claude-opus-4-8).

## In-scope fixes FOLDED this phase (chunk's own surfaces; gate re-run; non-vacuity re-proven)
- **Fix A — `retainedUnscrubbedNote` over-promise (LITERAL-EXECUTION lens, MED).** "Erasure is
  pending." → "Lawful basis and any erasure path are unsettled (counsel pending)." "Pending" read as a
  committed/scheduled erasure; the truth is unsettled/counsel-pending. Now matches the docstring's
  posture — closes a DC-16-adjacent wording overstatement on the chunk's own new surface.
- **Fix B — docstring developer-linkage precision (LITERAL-EXECUTION lens; the ② seal's known LOW
  residual, extended).** "reference the developer only by the now-anonymized `developers` row" was
  loose for `purchases` (indirect via `tool.developerId`) and inaccurate for
  `settlement_batches.disbursements[].developerId` (a denormalized UUID in jsonb). Reworded to cover
  FK / via-tool / denormalized linkage, all resolving to the anonymized row. Operative conclusion
  ("carry no developer-identifying PII of their own") was and remains TRUE.
- **Fix C — regression-test hardening (TEST-RIGOR lens).** (1) Pin the previously-100%-unguarded
  `retainedUnscrubbedNote` (slice the note value; assert its honest text + non-committal posture, ban
  "erasure is pending"). (2) Ban the comprehensive-scrub claim as a CLASS (`BANNED_COMPREHENSIVE_SCRUB`
  — paraphrase guards `scrubbed (from|across|in) (all|every)`, `(wiped|purged|erased) … (all|every)
  tables`), not just the one fixed phrasing. (3) Extend `BANNED_LEGAL_CONCLUSIONS` with synonym guards
  (`permitted to retain/keep`, `legally entitled/allowed to retain/keep`, `legitimate interest in
  retaining`) — verified none false-RED the honest "lawful basis … unsettled" text. (4) Dropped the
  over-broad `/all tables/i` guard (redundant with `/across all tables/i`; false-RED risk on honest
  future copy).
- **Fix D — comment honesty (③ handoff §4c).** Softened the test's "developer-downloadable" framing to
  "persisted record" + a NOTE documenting the persisted-not-served reality (see N4-adjacent below).

## NEW findings — ROUTED OUT (separate scope; NOT fixed under this seal)
| # | Finding | Sev | Disposition |
|---|---|---|---|
| **N1** | **`docs/page.tsx:635` "Supabase auth records are deleted" is FALSE** — deletion only nulls `developers.supabaseUserId`; NO `auth.admin.deleteUser` tree-wide, so the Supabase auth user (email) persists. A LIVE public DC-16 false claim one FAQ below the corrected `:615`. | **HIGH** | → **compliance-honesty SLICE 2** (founder). Fix is either reword the FAQ (auth linkage severed, not deleted) OR actually delete the auth user (behavioral / GDPR-design — founder call). |
| **N2** | The LIVE public privacy policy is `app/privacy/page.tsx` (generic, no false scrub claim) — the census/handoffs referenced the `docs/legal/*.md` DRAFT instead. Account-deletion email (`email.ts:733`) says "**permanently deleted**" for an anonymize-in-place. | MED | → SLICE 2 / V-N3-erasure §5.5 must target the `.tsx`. Email phrasing = founder call (common SaaS idiom vs strict GDPR). |
| **N3** | Deletion-COMPLETENESS gap: the 9 steps never touch `organizations.billing_email` (raw email, un-anonymized if the developer owns an org); FAQ "anonymize … wherever it appears" over-claims vs the schema. (`signup_invites` UUID-only — NO gap.) | MED | → deletion-completeness audit (separate chunk). |
| **N4** | `data-retention` cron purges completed `compliance_exports` with NO `requestType` filter → hard-deletes completed data-DELETION records (incl. this disclosure) at 30d, vs the "completes within 90 days" claim; erodes the erasure audit trail. PRE-EXISTING. | MED | → backlog (scope the purge to `request_type='data-export'`). |
| **N5** | "Anonymized" vs pseudonymization: the `developers.id` UUID is preserved and the anonymized email embeds it (`deleted-<id>@`). ①-consciously adopted "anonymized" (not "erased/unlinkable"). | LOW | → founder/counsel (GDPR Recital 26 terminology). |
| **N6** | Latent (dormant — NO HTTP route triggers/serves data-deletion today): the download route's `else` redirects a raw-JSON deletion `resultUrl` → `new URL()` throws → caught → generic 500 (no leak); the `processing` guard is non-atomic (TOCTOU). | LOW | → backlog (address before any account-deletion route ships). |
| **N7** | No shared type/interface for the `resultUrl` JSON shape (inline `JSON.stringify`); no changelog. | LOW | → backlog (nicety). |

**Verified NOT-sustained** (recorded so not re-raised): the shipped disclosure's "operation_id +
metadata.payer" is COMPLETE for the payer EOA — `ledger_entries.description` is a static template,
`external_ref` = txhash, `authorization_artifact` unset by the writer (V-N3 record's "exactly two"
holds). The download route is hostile-input-safe (UUID validation, owner-scoped 404 with no
existence-leak, contained try/catch, no open-redirect). No coupling to V-N1/V-N2 ledger writers. The
idempotent re-run / failed-retry paths are correct.

## Defect-class ledger
- **DC-16** — recurrences N1/N2 recorded in `.audit/defect-ledger/DC-16-public-claim-content-integrity.md`
  (the adjacent-surface false claim + the live-vs-draft privacy-surface census gap). No NEW class
  required; N3 is a DC-16-adjacent deletion-completeness sub-theme.
- **DC-15** — the persisted-not-served residual stands (now sharpened: format mismatch → 500, not a
  silent redirect; + auth severance; + 30d cron purge per N4). Comment honesty folded (Fix D).
- **DC-05** — the regression test re-confirmed non-vacuous and hardened from a revert-detector toward a
  falsehood-class invariant (Fix C).

## Next
Founder-close = a LOCAL commit (path-scoped: `compliance.ts`, `docs/page.tsx`, the test, the register,
this doc, the DC-16 ledger; NEVER push). `/push-go` is a separate explicit gate. **Open the
compliance-honesty SLICE 2** for N1 (and N2/N3) — a LIVE false public GDPR claim should not wait.
