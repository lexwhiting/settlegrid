# V-N3 compliance-honesty SLICE 3 — deletion-COMPLETENESS scrub (the developer-personal-data the 9-step deletion misses) — ① BUILDABLE HANDOFF (2026-06-16)

> Standalone handoff for the FRESH build session. READ THIS FIRST, before any code. Repo:
> `/Users/lex/settlegrid` (npm monorepo: `apps/web` + `packages/mcp`; use **npm**). Build base =
> `main` @ `c3b78fce` (V-N3 SLICE 2 sealed + ③ RE-CERTIFIED + PUSHED). Source-of-truth register:
> `docs/tech-debt/s-deep-audit-register-2026-06-10.md` (V-N3 entry). This chunk closes the
> deletion-COMPLETENESS watch-item that SLICE 2's ③ post-seal deep audit surfaced and routed out — see
> `docs/tech-debt/v-n3-compliance-honesty-slice2-post-seal-deep-audit-2026-06-16.md` and the DC-16
> ledger `.audit/defect-ledger/DC-16-public-claim-content-integrity.md` (the SLICE-2 ③ entry).
> **This handoff folds the ① pre-build plan-audit findings (§7) — build from it as written.**

---

## 0. Decision, tier, intent

- **Chunk:** SLICE 2 made the GDPR Art-17 deletion claim TRUE for the auth identity and made the public
  copy HONEST-ABOUT-SCOPE. SLICE 2's ③ then ground-truthed that `processDataDeletion` leaves several
  developer-keyed fields un-scrubbed. This chunk **scrubs the fields that are genuinely the data
  subject's personal data**, and **honestly DISCLOSES the fields that are legitimately retained or
  belong to a distinct entity** — closing the deletion-completeness gap behaviorally where erasure is
  warranted and by disclosure where it is not.
- **Tier: HIGH-STAKES.** Triggers: changes account-DELETION behavior (a PII/erasure boundary); edits the
  atomic anonymization transaction in `processDataDeletion`; alters a PUBLISHED/RECORDED compliance
  disclosure (the `resultUrl` JSON + docs FAQ). Low code-complexity; the GDPR/trust + the
  scrub-vs-retain judgment make it HIGH-STAKES. (② re-confirms; may escalate.)
- **Intent (WHY / who consumes / what enables):** A developer exercising GDPR erasure must have THEIR
  personal data removed. SLICE 2 deleted the auth user + anonymized the core profile; this chunk removes
  the remaining personal data the 9-step txn missed (notification webhook URLs; their marketing-waitlist
  email; PII-linked infra fields on their tools), so a deletion reaching `completed` now means the data
  subject's identifying data is gone from the operational DB — and the persisted disclosure tells the
  honest truth about what is retained and why. It does NOT resolve the on-chain payer erasure
  (legal-gated `V-N3-erasure`) or the organization-billing-email question (distinct-entity decision,
  deferred — see §1).

## 1. Scope — exactly what to build (and what NOT to)

The governing principle, applied per surface: **is the field the DATA SUBJECT's personal data (→ SCRUB),
legitimately-retained published-artifact data whose person-link is already severed (→ RETAIN, optionally
disclose), or a DISTINCT-ENTITY's data needing its own decision (→ DEFER + DISCLOSE)?**

**BUILD — SCRUB (genuine developer personal data the 9-step txn misses), all INSIDE the existing
`db.transaction` in `processDataDeletion` (`apps/web/src/lib/settlement/compliance.ts`):**

1. **`developers.notificationWebhooks` → `{}`.** Fold into the existing **step-1** developer
   `.set({...})` (which already resets `notificationPreferences: {}` but MISSES `notificationWebhooks`).
   The column is `jsonb('notification_webhooks').notNull().default('{}')` holding `{ slack?: string,
   discord?: string }` — the developer's own Slack/Discord webhook URLs (configured via
   `api/developer/notifications/configure`). Set `notificationWebhooks: {}` alongside
   `notificationPreferences: {}`. **The single cleanest, least-debatable gap.**

2. **`waitlist_signups` rows matching the developer's RAW email → DELETE.** `waitlistSignups`
   (`schema.ts:802`) has `email text NOT NULL`, `feature`, `metadata jsonb`, unique `(email, feature)`,
   and **no developer FK**. A NEW txn step deletes rows `WHERE email = <raw dev.email>`. ⚠ **Use the RAW
   `dev.email` captured BEFORE step-1 anonymizes it** (the function already reads `dev.email` raw before
   the txn for the consumer lookup — reuse that value; do NOT read `developers.email` after step 1, it is
   `deleted-<id>@…` by then). `delete` (not anonymize) — it is a marketing signup with no dependents;
   idempotent on retry (already-deleted → 0 rows).

3. **Tools' PII-linked infra fields on the developer's OWN tools → null.** Fold into the existing
   **step-8** tools `.set({...})` (which already sets `status:'deleted', description:null,
   healthEndpoint:null`). ADD `sourceRepoUrl: null` (a `github.com/<handle>/…` URL that can embed the
   developer's GitHub handle), `proxyEndpoint: null` (the developer's infra URL), and `crawlMetadata:
   null` (jsonb that can embed crawled author/contact data). These are NOT referenced by any live route
   for a `status='deleted'` tool (verified: by-slug/integration routes filter `status='active'`), so
   nulling them has no product impact. **PRESERVE `tools.name` and `tools.slug`** — see DEFER below.

4. **Update the persisted disclosure (`resultUrl`, step-9) and re-verify the docs copy (DC-16):**
   - Add the newly-scrubbed surfaces to the `anonymized` array as **column PATHS** (e.g.
     `'developers.notification_webhooks'`, `'waitlist_signups'`, `'tools.source_repo_url'`,
     `'tools.proxy_endpoint'`, `'tools.crawl_metadata'`), gated where appropriate (e.g. the
     tool-field entries only when `toolIds.length > 0`, mirroring the existing gating).
   - Add `'organizations.billing_email'` to the `retainedUnscrubbed` array (column PATH only — NO row
     value) with a factual note that it is the data of a DISTINCT entity (an organization) and is
     pending a separate scrubbing decision. ⚠ State it as FACT — NEVER assert a lawful-basis /
     exemption conclusion (the banned-legal-conclusion CLASS the SLICE-1/2 regression test enforces:
     no `exempt`/`exemption`/`lawful basis to|for retain`).
   - **Re-run the §1-census (below) over every live deletion-claim surface and consciously rule each
     remains TRUE + non-absolute after this scrub.** The SLICE-2 ③ already made docs:615/635/639
     honest-about-scope; this scrub only makes them MORE true, so likely NO docs edit is needed — but
     RULE on each, do not silently skip (that is the SLICE-1-③ N2 census-miss class).

5. **Tests (§5):** behavioral pins for each new scrub (non-vacuous: revert the scrub → RED) + a
   source-text/disclosure pin for the resultUrl changes, extending the existing files.

**Re-run a census** before declaring done (rule each hit against the realized scrub):
`git grep -niE 'notification_webhooks|waitlist|source_repo|proxy_endpoint|crawl_metadata|billing_email' -- 'apps/web/src/lib/settlement/compliance.ts'`
and the public-claim census:
`git grep -niE 'anonymiz|delet|scrub|backup|retain|wherever|all (personal|data)' -- 'apps/web/src/app/docs/page.tsx' 'apps/web/src/app/(dashboard)/dashboard/settings/page.tsx' 'apps/web/src/lib/email.ts' 'apps/web/src/app/privacy/page.tsx'`.

**DO NOT build (reject scope creep — DEFER + DISCLOSE, or routed elsewhere):**

- **`organizations.billing_email` (N3) — DEFER (distinct-entity decision; do NOT scrub here).** There is
  no owner column on `organizations`; ownership is via `organization_members(role='owner', userId=<the
  developer.id>)`. An org is a distinct entity that may have OTHER members, the `billing_email` may be a
  shared billing contact rather than the deleting developer's personal email, and scrubbing it raises
  sole-owner/other-members/transfer/org-deletion questions that are a FOUNDER/counsel call (same flavor
  as `V-N3-erasure`). **This chunk DISCLOSES it as `retainedUnscrubbed` (honest), it does NOT scrub it,
  and it does NOT touch `organizations`/`organization_members` behavior.** (Its own future chunk.)
- **`tools.name` / `tools.slug` — RETAIN (product-artifact identity, not the data subject's personal
  data).** These are referenced across many routes and historical records (invocations/purchases/reviews
  reference the tool; `slug` is the unique URL key). The person-link (`tools.developerId` → the now
  anonymized `developers` row) is ALREADY severed. Anonymizing name/slug would corrupt the marketplace
  history for no erasure benefit. PRESERVE them.
- **N4** (the `data-retention` cron purging completed data-DELETION rows at 30d vs the "90 days" claim) —
  separate backlog chunk. Do NOT touch the cron.
- **N5** ("anonymized" vs "pseudonymized" framing) — counsel terminology. Do NOT re-word.
- **`V-N3-erasure`** — the on-chain payer-address / `ledger_entries` scrub (legal-gated). Leave the
  existing `retainedUnscrubbed` ledger disclosure exactly as-is (add to it; do not remove/re-word it).
- Do NOT change the deletion status-machine SHAPE (pending→processing→completed|failed), the
  idempotent-`completed` no-op, the SLICE-2 pre-txn auth-delete wiring, or any of steps 1-9 beyond the
  three additive scrubs above + the disclosure update.

## 2. ⚠ THE LOAD-BEARING DECISIONS (where audit judgment concentrates — most likely to be silently wrong)

**LB-1 — the SCRUB-vs-RETAIN-vs-DEFER classification (the core judgment).** The defect in BOTH
directions is real: **over-scrub** corrupts legitimately-retained artifact/history data and breaks
referential integrity (e.g. anonymizing `tools.name`/`slug` breaks invocation/purchase/review display
and the unique URL key — FORBIDDEN); **under-scrub** leaves the data subject's personal data behind
(the whole point). The classification above is the plan's position — re-validate each surface: is
`notificationWebhooks`/`waitlist email` genuinely the data subject's personal data (yes → scrub)? Are
the tool infra fields (`sourceRepoUrl`/`proxyEndpoint`/`crawlMetadata`) person-identifying enough to
warrant nulling on a delisted tool, and does nulling them break anything (verified: not referenced for
`status='deleted'` tools)? Is `organizations.billing_email` correctly DEFERRED (distinct entity) rather
than scrubbed? Is `tools.name/slug` correctly RETAINED (artifact identity)?

**LB-2 — atomicity, ordering, idempotency, and the SLICE-2 moat invariant.** All three scrubs go INSIDE
the existing `db.transaction` so they are atomic with steps 1-9 and inherit the retry-safety proof
(`'completed'` is written ONLY at step 9 inside the txn; any throw → the function `catch` →
`status='failed'`, retry sees pristine DB). Preserve: (a) the moat invariant `completed ⇒ (auth user
deleted ∧ DB anonymized)` — now extended to include the new scrubs; (b) the idempotent-`completed`
no-op; (c) each new scrub must be IDEMPOTENT on a `failed` retry (a re-run `UPDATE …={} / null` and a
`DELETE …` are naturally idempotent — confirm). ⚠ The waitlist DELETE keys on the **RAW `dev.email`**,
which MUST be captured before step-1 anonymizes it — read it from the pre-txn `dev` lookup (already
selected), NOT from inside/after step 1. Do NOT alter the frozen status-machine shape or the catch.

**LB-3 — disclosure honesty (DC-16) stays TRUE + mutually consistent.** After the scrub the `resultUrl`
`anonymized`/`retainedUnscrubbed` arrays and the docs FAQ (`:615`/`:635`/`:639`), email, and
`settings:2117` must ALL remain TRUE and mutually consistent. The new `retainedUnscrubbed` entry for
`organizations.billing_email` must be a column PATH + a factual note, NEVER a lawful-basis conclusion
(the banned-conclusion class). The docs copy was made honest-about-scope by SLICE 2's ③ — this scrub
only makes it more true; RULE on each surface in the census, do not silently skip one (the SLICE-1 ③ N2
census-miss class), and do NOT re-introduce an absolute ("all"/"wherever"/"any backup").

## 3. Frozen / existing surfaces + mechanical facts (pre-flight — do NOT re-derive; DO re-run the §1 census)

- **`processDataDeletion` shape (`compliance.ts`, ~`:413-650` on the current tree):** marks `processing`
  (outside txn); `try { lookup dev (selects id,email,supabaseUserId); pre-txn consumer lookup by
  dev.email; SLICE-2 pre-txn auth-delete loop; toolIds = select tools WHERE developerId; db.transaction(
  steps 1-9, sets `completed` at step 9) } catch { set `failed` }`. **Step 1** (`:~499`) anonymizes the
  developer row (`notificationPreferences:{}` is here — add `notificationWebhooks:{}`). **Step 2**
  anonymizes the consumer twin. **Step 8** (`:~580`) marks the developer's tools `status:'deleted'`,
  `description:null`, `healthEndpoint:null` (add `sourceRepoUrl/proxyEndpoint/crawlMetadata: null`).
  **Step 9** writes `status:'completed'` + the `resultUrl` JSON (`anonymized`/`retained`/
  `retainedUnscrubbed`/`retainedUnscrubbedNote`/`toolCount`). The pre-txn `dev.email` (raw) is available
  for the new waitlist DELETE.
- **Schema (`apps/web/src/lib/db/schema.ts`):** `developers.notificationWebhooks =
  jsonb('notification_webhooks').notNull().default('{}')` (`~:37`). `tools.sourceRepoUrl` (`:115`),
  `tools.proxyEndpoint` (`:113`), `tools.crawlMetadata` (jsonb), `tools.name`(notNull)/`tools.slug`
  (notNull,unique). `waitlistSignups` (`:802`): `email`(notNull), `feature`, `metadata`, unique
  `(email,feature)`, NO developer FK. `organizations.billingEmail`(notNull, `:1113`),
  `organization_members(orgId, userId text, role)` (`:1133`).
- **Tools name/slug are referenced widely** (health/report/status/by-slug/integration/listed-in-
  marketplace routes + history) — anonymizing them is FORBIDDEN (referential breakage). The tool infra
  fields (`sourceRepoUrl`/`proxyEndpoint`/`crawlMetadata`) are NOT referenced for `status='deleted'`
  tools (by-slug/integration filter `status='active'`).
- **The deletion has NO HTTP route caller today** (SLICE-2 ③ confirmed: only tests + `settlement/index.ts`
  re-export). The behavioral change is dormant in prod until a deletion trigger ships — but it MUST be
  correct now.
- **Gate baseline @ `c3b78fce`:** `cd apps/web && npx tsc --noEmit && npm run lint && npx vitest run` →
  **tsc 0 · lint 0 err (pre-existing warns only) · vitest 4525 / 197 / 0**. `packages/mcp` UNTOUCHED
  (apps/web-only diff). Re-run the FULL gate after the change; vitest should be 4525 + your new tests.
  ⚠ Gate hazard: never run apps/web `vitest` concurrently with packages/mcp `npm run build`
  (dist-rebuild race) — N/A here (mcp untouched). The gate chain's bash `${PIPESTATUS}` is empty under
  zsh — read the printed `Test Files`/`Tests` summary lines, not just the chain exit code.

## 4. Lifecycle + defect classes

- **Lifecycle:** scope-confirm → draft plan → **pre-build plan audit (DONE this ① session — folded
  §7)** → build → executable gate → ② seal-gating review → seal + bookkeeping. Founder-close (LOCAL
  commit; push only on explicit `/push-go`).
- **Defect classes** (`.audit/defect-ledger/`): **DC-16** (public/recorded-claim integrity — the
  disclosure must stay TRUE; do NOT introduce a new false claim or a lawful-basis conclusion). **DC-17**
  (status-machine non-idempotent rerun — each new scrub must be idempotent on a `failed` retry).
  **DC-05** (the new tests non-vacuous). **DC-15** (keep the docstring/disclosure in sync with the new
  behavior). **DC-11** (the `resultUrl` discloses column PATHS only — never a row value). **DC-13**
  (latent — the over-scrub-breaks-referential-integrity hazard is the latent trap here). **SEAM** +
  **LITERAL-EXECUTION** (standing).

## 5. Tests — strategy

Extend the existing files; every assertion non-vacuous (revert the change → RED).

1. **BEHAVIORAL (extend `apps/web/src/lib/__tests__/compliance-deletion-auth.test.ts` or
   `settlement-moat.test.ts`'s `processDataDeletion` rig).** Assert the txn:
   - sets `notificationWebhooks: {}` in the developer update (step 1) — pin the `.set` payload includes
     it (the existing rigs capture `updateCalls`/`set` payloads);
   - nulls `sourceRepoUrl`/`proxyEndpoint`/`crawlMetadata` in the tools update (step 8) when
     `toolIds.length > 0`;
   - issues a `delete` against `waitlistSignups` keyed on the RAW `dev.email` (captured pre-txn);
   - **non-vacuity:** revert each scrub → the corresponding assertion goes RED.
   Use the lightest seam that genuinely pins the behavior (the existing mock rigs already model the txn
   `set`/`delete` capture — extend them, don't rebuild).
2. **DISCLOSURE / SOURCE-TEXT (extend `compliance-honesty-regression.test.ts`).** Pin: the `resultUrl`
   `anonymized` array now records the new column paths; `retainedUnscrubbed` now records
   `organizations.billing_email` (region-sliced to the array, as the existing pins do); the
   banned-legal-conclusion CLASS assertions still pass (no `exempt`/`lawful basis`); the docs FAQ
   (`:615`/`:635`/`:639`) remain honest (no absolute re-introduced — keep the SLICE-2 ③ `.not.toMatch`
   pins green). Mirror the existing region-slice style; keep every assertion non-vacuous.

## 6. Operator / infra preconditions (surface, do not silently assume)

- **No new external side effect.** Unlike SLICE 2 (which added `auth.admin.deleteUser`), this chunk is
  pure in-DB scrubbing inside the existing txn — no new service-role call, no new secret, no new infra
  precondition. (The SLICE-2 `SUPABASE_SERVICE_ROLE_KEY` precondition is unchanged and unrelated here.)
- **`organizations.billing_email` is DEFERRED, not resolved.** The disclosure tells the truth (retained);
  the actual scrub-or-retain decision for org data on member deletion remains a founder/counsel call.
  Record it so it travels.
- **Pre-existing `completed` data-deletion rows** (the SLICE-2 no-op-backfill caveat) still applies and
  is unchanged by this chunk — a row that reached `completed` under older code is NOT re-scrubbed by the
  idempotent no-op. Strong prior zero (no HTTP caller). Not a blocker; note it travels.

## 7. PLAN-AUDIT FINDINGS — FOLDED (the build MUST honor these; they refine/override §1-§6 where more specific)

The ① pre-build plan audit (5 lens-distinct Opus-4.8 reviewers @ xhigh — correctness/atomicity · scrub-
classification & missed-surfaces · DC-16 disclosure-honesty · SEAM · literal-execution/test-realizability;
coverage mode) found the plan's CORE judgment SOUND (LB-1 scrub/retain/defer classification, LB-2
atomicity/idempotency, LB-3 disclosure honesty all validated). The integrator LIVE-re-confirmed every
material finding at source. Concrete refinements the build MUST honor:

**A. ADD A 4th SCRUB — `audit_logs.details` retains the data subject's RAW EMAIL (the chunk's own
purpose demands closing it).** `auth/callback/route.ts:202` writes `details: { provider, email:
user.email }` on EVERY login, in an `auditLogs` row keyed by the developer's `developerId`. The existing
deletion **step 5** (`compliance.ts`) scrubs only `ipAddress`/`userAgent` — it NEVER touches `details`,
so the developer's raw email survives a `completed` deletion (verified live). This is the exact
DC-16/completeness gap this chunk exists to close. **FOLD:** extend step 5's `.set({...})` to also set
`details: null` (alongside `ipAddress:null, userAgent:null`, same `WHERE developerId = <devId>`).
`auditLogs.details` is nullable jsonb and every reader handles null (`audit-log/export/route.ts:91`
`row.details ? … : ''`; `audit-log/route.ts:84`) — nulling is safe. (Nulling the whole column is the
SAFE-COMPLETE choice — it removes ALL potential PII in `details`, not just the top-level `email` key,
since other actions may embed PII in other `details` shapes. If the build prefers a surgical
`details - 'email'` jsonb strip, it MUST first verify no other `details` shape for this developer holds
PII; the recommended default is `details: null`.) Disclose `'audit_logs.details'` in the `anonymized`
array (unconditional, like the existing `audit_logs.ip_address`/`audit_logs.user_agent` entries).

**B. WAITLIST DELETE must key on NORMALIZED email (correctness + makes the disclosure TRUE).** The
waitlist writer stores `email = body.email.toLowerCase().trim()` (`api/waitlist/route.ts:149`), but
`developers.email` is the raw `user.email` (NOT force-lowercased). A raw-email match would miss
mixed-case rows → the developer's marketing email SURVIVES and `'waitlist_signups'` would be a FALSE
recorded claim. **FOLD:** key the DELETE on the writer's normalization, e.g.
`tx.delete(waitlistSignups).where(sql\`lower(${waitlistSignups.email}) = ${dev.email.toLowerCase().trim()}\`)`
(or the drizzle equivalent). Add a behavioral test that a MIXED-CASE waitlist email is still deleted
(non-vacuous: revert to exact-match → RED).

**C. EXISTENTIALLY GATE the `'waitlist_signups'` disclosure entry (don't claim a scrub that didn't
happen).** The common case is a developer who never joined the waitlist (0 rows deleted) — recording
`'waitlist_signups'` unconditionally is a false claim. **FOLD:** capture the delete's row count
(`.returning()`), and gate the disclosure like the existing `consumers`/`tool_reviews` entries:
`...(deletedWaitlist ? ['waitlist_signups'] : [])`. (The DELETE statement still executes unconditionally
— see test fold E2 — only the DISCLOSURE entry is gated.) The tool-field paths (D) are likewise gated on
`toolIds.length > 0` (mirror the existing `['tools']` gating); `developers.notification_webhooks` and
`audit_logs.details` are UN-gated (those rows are always updated). `consumer twin` waitlist: the deletion
already assumes one-email-per-identity (the consumer lookup keys on `dev.email`), so keying the waitlist
DELETE on `dev.email` covers the twin — **accept and document this bound; do NOT add a second
consumer-email capture.**

**D. CORRECTED SEAM JUSTIFICATION for nulling the tool infra fields (the conclusion holds; the plan's
stated proof was too narrow).** §1.3/§3 claimed safety because "by-slug/integration routes filter
`status='active'`" — incomplete: `templates/[slug]/download/route.ts:53` reads `sourceRepoUrl` on
`status='template'`, and `proxy/stats/route.ts:47` reads `proxyEndpoint` with NO status filter (but only
to COUNT, never returning the value). The correct proof: **step 8 only flips the *deleting developer's
OWN* tools to `status='deleted'`; template-status tools are platform-seeded (no developer-owned
`status='template'` write path exists in `apps/web/src`), so a deleted developer's tool is never a
template-download target; and `proxy/stats` surfaces only a count, never the endpoint value.** Nulling
`sourceRepoUrl`/`proxyEndpoint`/`crawlMetadata` on the dev's `status='deleted'` tools is therefore
product-safe. Use THIS justification, not the `status='active'` one. (`crawl_metadata` is a precaution
null — for crawled tools its content is third-party-authored; nulling is harmless and the `anonymized`
entry means "nulled," which is TRUE.)

**E. TEST-INFRASTRUCTURE — these are REQUIRED edits to EXISTING assertions/mocks, NOT additive
extensions; the gate FAILS without them (DC-05/DC-15):**
- **E1 — add `waitlistSignups` to BOTH deletion test schema mocks.** `compliance.ts` must `import {
  waitlistSignups }` (it is exported, `schema.ts:802`, but not currently imported). Neither
  `compliance-deletion-auth.test.ts` (`vi.mock('@/lib/db/schema')`, ~`:77-94`) nor
  `settlement-moat.test.ts` (its schema mock) defines `waitlistSignups` — so `eq(waitlistSignups.email,
  …)` resolves to `undefined.email` → TypeError → the run goes `'failed'` → currently-GREEN tests turn
  RED. ADD `waitlistSignups` (with at least `email`) to BOTH mocks.
- **E2 — update the moat-test `tx.delete` count.** `settlement-moat.test.ts` pins
  `expect(txChain.delete).toHaveBeenCalledTimes(2)` (the `processes a pending deletion` AND `retries a
  failed deletion` tests). The new waitlist DELETE executes unconditionally → count becomes **3**. Update
  both to `(3)` (or assert the waitlist delete target explicitly).
- **E3 — route the `.set`-payload behavioral pins to `compliance-deletion-auth.test.ts`, NOT
  `settlement-moat.test.ts`.** The moat rig's `txChain` re-creates an anonymous `set: vi.fn()` per
  `.update()` call and captures NOTHING. The auth rig has a shared `set: (vals) => { updateCalls.push(vals)
  }` — pin `notificationWebhooks: {}`, the tool nulls, and `details: null` against `updateCalls` there.
  No schema-stub COLUMN edit is needed for these (they are literal `.set` KEYS, not `tools.X`/`developers.X`
  column dereferences).
- **E4 — add a DELETE-target capture seam.** BOTH rigs' `delete()/.where()` discard their args, so neither
  can currently pin the waitlist DELETE *target* (only a count). Extend the chosen rig's tx so
  `delete(table)`/`where(pred)` record into a `deleteCalls` array, then pin the waitlist target
  non-vacuously (revert the DELETE → RED).
- **E5 — disclosure pins are SOURCE-TEXT.** The `compliance-honesty-regression.test.ts` `region()` pins
  assert the literal column-path strings exist in the `anonymized`/`retainedUnscrubbed` arrays — they do
  NOT prove runtime gating. Cover the runtime gating (`toolIds>0`, `deletedWaitlist`) via the E3/E4
  behavioral pins. Adding the new paths to the `anonymized`/`retainedUnscrubbed` regions is compatible
  with the existing `region(resultUrl,'anonymized: [','retained:')` slice and the
  `.not.toMatch(/ledger_entries/)` / `supabase_auth_user` pins (no collision; new entries contain no
  `ledger_entries`).

**F. DISCLOSURE-NOTE wording for `organizations.billing_email` (avoid the banned-conclusion CLASS).** Add
`'organizations.billing_email'` to the `retainedUnscrubbed` ARRAY (column PATH only — DC-11, never the
value). Fold any prose into the SINGLE existing `retainedUnscrubbedNote` string (do NOT add a 2nd note
key — the test slices the note via `region('retainedUnscrubbedNote:','toolCount:')` and a 2nd key would
escape the pin). The `BANNED_LEGAL_CONCLUSIONS` regexes run over the WHOLE `resultUrl` region
(`compliance-honesty-regression.test.ts:142-150,251`), banning: `\bexempt\b`, `\bexemption\b`, `lawful
basis (for|to) retain`, `permitted to (retain|keep)`, `legally (entitled|allowed) to (retain|keep)`,
`legitimate interest .*(retain|keep)`. Bare "retain"/"unsettled"/"lawful basis … unsettled" is permitted
(the existing ledger note uses it). **Sanctioned phrasing** (verified clean against all regexes):
*"`organizations.billing_email` belongs to a distinct entity (an organization, which may have other
members) and is not scrubbed by this developer-deletion; whether and how to scrub organization data on
member deletion is unsettled and routed separately."* Add a test asserting the note names the org /
distinct-entity AND that the banned-conclusion class still `.not.toMatch` the resultUrl region.

**G. CENSUS / COMMENT rulings (rule each consciously — do NOT silently skip; the SLICE-1-③ N2
census-miss class):**
- **Update the stale test comment** `compliance-honesty-regression.test.ts:113-116`: it lists
  `developers.notification_webhooks` (and the waitlist email) as PII that "survives … routed to the
  follow-up" — after THIS chunk those ARE scrubbed, so the comment becomes false. Remove
  `notification_webhooks`/waitlist from the "survives" list (leave `organizations.billing_email`, and
  `tools.name/slug` which are RETAIN-by-design). Comment-only (no test goes RED) → MUST be called out or
  it silently rots.
- **`settings/page.tsx:2117`** ("Permanently delete your account and personal data…") — the
  "Permanently delete your account" vs anonymize-in-place tension is a **SLICE-2-class residual** (the
  framing question SLICE 2 softened in the EMAIL but left here), NOT the completeness gap this chunk
  closes. RULE: **left untouched this chunk; note it travels** (a future copy-honesty pass). Do not edit.
- **`docs/page.tsx:615/:635/:639`, `email.ts accountDeletedEmail`, `app/privacy/page.tsx`** — the scrub
  only makes them MORE true; re-verify each in the §1 census and leave untouched (no absolute
  re-introduced). RULE each explicitly in the build's done-report.

**H. DEFERRED WATCH-ITEMS (record so they travel; do NOT build here):**
- `consumers.stripeCustomerId` is left un-scrubbed by step 2 while the developer's `stripeCustomerId` IS
  nulled by step 1 — an undisclosed asymmetry (a pseudonymous external billing linkage). Out of THIS
  chunk's scope (financial-linkage, consumer-side); record alongside the `organizations.billing_email`
  decision as a future watch-item. Not a blocker.
- `agent_identities` (providerId from a free-text header, no `developers` FK), and every developerId/
  consumerId-FK table walked by the audit (`payouts`/`referrals`/`achievements`/`purchases`/
  `kernelTelemetry`/`costAllocations`/etc.) correctly need NO scrub (internal IDs only; person-link
  already severed; `kernelTelemetry.props` is sanitized at emit-time). Recorded so they are not
  re-litigated.
- **Do NOT mirror `notificationWebhooks` onto the step-2 consumer `.set()`** — `consumers` has no such
  column (a literal-executor over-reach that would be a tsc error).
