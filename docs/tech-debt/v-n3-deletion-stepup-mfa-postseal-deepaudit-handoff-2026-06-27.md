# ③ POST-SEAL DEEP-AUDIT HANDOFF — V-N3-deletion-stepup-mfa — 2026-06-27

**Tier: HIGH-STAKES** → ③ warranted. ② SEALED PASS (record:
`docs/tech-debt/v-n3-deletion-stepup-mfa-seal-record-2026-06-27.md`).
③ audits the **integrated whole**, not the diff in isolation (② already did that).

## 0. READ FIRST
1. The ② seal record (above) — findings, fixes, accepted residuals, the outstanding manual smoke.
2. The build handoff `docs/tech-debt/v-n3-deletion-stepup-mfa-handoff-2026-06-26.md` (§3 LB-1/LB-2, §5 SEAM, §6 FROZEN).
3. The control: `apps/web/src/app/api/dashboard/developer/account/route.ts` `verifyStepUp`.

## 1. What ② already certified (do NOT re-derive — extend instead)
- `verifyStepUp` in isolation: capability-keyed TERMINAL precedence (MFA→password→accept), server-derived
  factorId, fresh challenge+verify (no session-AAL2 bypass — `getAAL` never called), `/^\d{6}$/` guard,
  fixed-string no-leak errors, probe-error fail-closed-retryable. Gate GREEN (tsc0/lint0/vitest 209f/4792).
- All 6 SEAM load-bearing claims VERIFIED at SDK source (incl. the `setAll` no-op = no elevated-cookie-leak
  freshness foundation).
- The core-invariant moat (security bypass AND Art.17 never-block) survived a `max` lens + 12 adversarial repros
  with NO break. Every account shape reaches `{ok:true}`; lost-authenticator recovery path verified real.

## 2. ③ scope — the integrated whole + the deferred seams (audit hardest here)
- **R1 / §5 — the MFA-unenroll-session-only bypass (THE headline residual).** `DELETE /api/auth/mfa`
  (`mfa/route.ts:179-234`) has no step-up + sends no notification; an attacker on a hijacked live OAuth+MFA
  session can unenroll → drop the victim to the OAuth-no-MFA ACCEPT path → delete. ② accepted this as an
  out-of-scope, operator-deferred, honestly-documented residual that this chunk does not worsen. ③ should
  (a) re-confirm the bypass is exactly OAuth+MFA-scoped (a password+MFA victim still hits the password branch),
  (b) re-confirm the "silent + self-scrubbing" framing — the unenroll audit row is written WITH ip/ua/details
  and the claim that the later deletion erases it was NOT re-verified by ② (SEAM caveat), (c) pressure-test the
  recommendation to make this the **IMMEDIATE next chunk** (step-up on unenroll, preserving a lost-authenticator
  recovery path), with the cheap interim = `notifyDeveloper(..., critical)` on unenroll so the bypass is
  out-of-band detectable.
- **R2 — pure-OAuth-no-MFA accepts** with no fresh proof-of-possession (forced-IdP-reauth deferred). Re-affirm
  the deferral is the operator's design choice (record §6) and the doc comment is honest.
- **The deletion flow end-to-end:** confirm step-up always precedes `processDataDeletion` with no path that
  scrubs on a rejected step-up, across the idempotency/find-or-reuse branches (frozen, but audit the SEAM
  between the new control and the sealed scrub).
- **The MFA endpoints as a system:** enroll → challenge → verify → list → unenroll vs the deletion step-up's
  reads — any state interaction (e.g. an enrolling-but-unverified factor, a just-unenrolled factor) that the
  per-mount UI flag or the server capability check mis-handles.

## 3. Lows ledgered to ③ (batch-verify; fix only if cheap & in-scope)
- challenge/verify THROW → 500 instead of REAUTH_FAILED (fail-CLOSED + no leak; status-inconsistent only). A
  per-factor try/catch mirroring the listFactors policy would harmonize the fail-mode — judge gold-plating vs
  consistency.
- Test mock places an `unverified` factor in `.totp` (a shape real `_listFactors` never emits); consider moving
  it to `.all` only, OR document the production filter as redundant-by-SDK-contract.
- Unpinned branches: `user.email`-unset+email-identity → ACCEPT (a security softening — worth a pin), the
  `!user` 401, all-challenges-error → REAUTH_FAILED. Optional regression pins (behaviors verified by max-repro).
- UI: U1 cross-tab/mount-fetch-failure staleness of `mfaHasVerifiedFactor` (reload-recoverable; a fetch-failure
  fallback that shows both fields could harden it); U2 fetch-failure also hides the unenroll recovery; U3 the
  "leave blank if you sign in with Google or GitHub" hint misleads LINKED email+OAuth accounts (pre-existing).
- `vi.clearAllMocks()` Once-queue fragility (latent; already DC-05-classed).

## 4. OUTSTANDING manual verification (gate ③ awareness)
The handoff §4.5 **live TOTP smoke** has NO recorded evidence and was not runnable in review (no live Supabase).
No automated test exercises the REAL challenge/verify/no-op-`setAll` path. ③ should ensure this smoke is run (or
explicitly carry it as a pre-`/push-go` operator action) — it is the only observation of the real GoTrue
integration.

## 5. FROZEN (do not perturb in ③)
Rate-limit posture, CSRF same-origin, self-scope `auth.id`, find-or-reuse, `processDataDeletion` + already-erased
guard, the email, the completion audit row. The authorized surfaces are `verifyStepUp` + the additive `mfaCode`
body field + the settings delete-section UI + `route.test.ts`.

## 6. Defect-class ledger (folded at ②; ③ confirms/extends)
DC-05 (M1 collapsed-distinct-values vacuity, count→10), DC-08 (challenge/verify-throw status note), M2 one-off
UI state-sync. No new class minted. ③ watch for: DC-03 (the step-up IS a DC-03 control), DC-08 (both fail-mode
directions), DC-12 (account-shape boundary coverage), DC-15 (this handoff's `:NNN` citations self-invalidate if
③ adds lines — re-derive before citing).

## 7. Gate / base
Gate from `apps/web`: `npx tsc --noEmit` 0; `npm run lint` 0 err; `npx vitest run` 209f/4792. Mock-based, no
pglite. Base for ③ = the ②-sealed commit (created at `/seal-go`). Allowlisted: `npx tsc *`, `npx vitest *`,
`npm run lint`, `git *`.
