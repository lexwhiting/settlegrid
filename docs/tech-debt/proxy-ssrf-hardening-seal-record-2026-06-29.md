# ② SEAL RECORD — proxy-ssrf-hardening — 2026-06-29

**Launch-gate chunk #3 — closes G2-2 (SSRF in the Smart Proxy + the untrusted-URL egress class).**
**VERDICT: ✅ SEAL (clean) — gate green, ZERO HIGH findings open, reviewers' evidence supports it.**
Operator finalizes: `/seal-go` + the explicit-pathspec commit (Claude cannot self-seal), then tick
G2-2 ☐→☑ in the roadmap + run `.claude/launch-gate-check.sh`, then ③ post-seal deep audit.

---

## 1. Tier
**HIGH-STAKES — re-confirmed against the realized diff, NOT escalated.** SSRF security boundary +
the proxy money rail + a PUBLIC/UNAUTHENTICATED attack surface + launch gate. The proxy money-rail
edits are additive only (swap `fetch`→`safeFetch` + ADD pre-capture `assertSafeUrlSync` on the
prepaid rails; settlement/billing/CAS byte-identical — proxy route net diff 48/4, unchanged from the
build). The ② fix-fold expanded the realized surface to `tool-registry.ts`'s `fetchJSON` helper, but
that file was already in-scope (sinks 13-14) and no new frozen surface / risk class was opened — so
no escalation.

## 2. Scope (as sealed)
A single shared fetch-time SSRF guard (`apps/web/src/lib/safe-egress.ts`) + routing every
untrusted-URL server fetch through it. The egress inventory grew across the lifecycle:
- Handoff §0 floor: 12 sinks (proxy 1-4, webhooks, health-checks, auto-detect 7-9, serve
  security-headers, notifications).
- Build merged **+2** (your flag #1): `tool-registry.ts` `scan_headers`/`check_csp` (sinks 13-14),
  same public-unauth class as sink 11, reachable via `/api/tools/[slug]/call`.
- ② found **+1 live SSRF** (the headline catch): `tool-registry.ts`'s shared `fetchJSON` helper was
  still raw `fetch`, and the wikipedia handlers inject the attacker-controlled `lang` arg into the
  HOST (`https://${lang}.wikipedia.org/...`). Now routed through `safeFetch`.
**Sealed coverage: every untrusted-host server egress in `apps/web/src` routes through `safeFetch`**
(6 of the 9 sink files are now pure-safeFetch / zero raw `fetch(`; serve `handlers.ts` keeps one
legit raw `fetchWithTimeout` for FIXED-host handlers only).

## 3. http-vs-https policy decision (for the record)
- **health-checks (sink 6): http RETAINED.** The SSRF fix is the private/reserved block (L1+L2);
  cleartext-to-a-PUBLIC host is not SSRF, and many health endpoints are http. `redirect:'error'`.
- **Cheap sinks (auto-detect probes, serve security-headers, tool-registry scanners, webhooks,
  notifications): https-only + `redirect:'follow'`→`'error'`.** Deliberate tightening (handoff
  §1a-L3); a classification/scan probe has no product need to chase redirects, and https-only shrinks
  the reachable internal surface. Documented as an intended behavior change (`redirect-error-
  functional-regression`, INFO).
- **proxy (money rail): `redirect:'manual'`** + per-hop L1 re-validation, cap 3 (was default
  follow/20). **`fetchJSON` (tool-registry): `redirect:'manual'`** so legitimate fixed-host APIs
  still follow redirects (capped + re-validated) while a literal/rebind/redirect-to-internal target
  is blocked.

## 4. Gate evidence (re-run FROM SCRATCH this session, isolated)
- Build (build-evidence reconstructed — cadence JSON carried no digest → re-derived per the RED
  rule): apps/web `tsc 0` / `lint 0` / `vitest` **216 files · 5001 passed**.
- **Post-fix (sealed state): `tsc 0` / `lint 0` / `vitest` 218 files · 5029 passed.** Δ +2 files /
  +28 tests = the 2 new test files (`tool-registry-ssrf` 16, `proxy-ssrf-mpp-block` 6) + the wiring
  no-raw-fetch teeth (6); the L2 fix replaced 1 weak test with 1 discriminating one. → gate ran on
  the fixed code. settlegrid-agents UNAFFECTED. (stderr lines are intentional negative-path logging.)

## 5. Orchestration / policy
- **WORKFLOW (operator-selected)** — realized the mixed-effort fan-out via the Workflow `agent()`
  per-agent `effort` param: 6 lens-distinct reviewers (core-invariant SSRF **@ max** + spec /
  correctness / SEAM / literal-execution / test-teeth-scope-hygiene **@ xhigh**) → per-finding
  adversarial refuters **@ high**, all `model: opus` → claude-opus-4-8[1m]. Agents self-reported
  effort 'high' (per-agent xhigh/max requested; self-report is model-unreliable; HIGH = valid floor).
  **NOTE (SEAM on the policy itself):** the skill's canonical block claims the Workflow `agent()`
  call exposes no effort option — that is **stale**; this environment's Workflow tool DOES expose
  per-agent `effort`, and the prior chunk's ③ already used it. Recorded so the policy can be updated.
- Integrator (this session) ran an executable hostile-input battery (77 adversarial classifier /
  encoding / userinfo cases — all green; corroborated no classifier under-block) and live-reproduced
  every sustained finding fail-then-pass before folding.
- Env traps unset (no FORK_SUBAGENT / SUBAGENT_MODEL / EFFORT_LEVEL). Allowlist GREEN
  (git/tsc/vitest/lint — exactly the reviewer caps; no WebFetch/MCP needed). Path-1 named-subagent
  defs absent (no `.claude/agents`) — moot, the workflow realized the effort mix.

## 6. Findings (40 agents, 6 lenses + adversarial verify): 2 HIGH · 7 MED · 13 LOW · 12 INFO → triaged
### HIGH — both REAL, both FIXED (live fail-then-pass)
- **H1 `wikipedia-lang-ssrf` — LIVE, reachable, public-unauth SSRF.** `tool-registry.ts` `fetchJSON`
  was raw `fetch`; wikipedia handlers inject `lang` into the host. RED reproduced against built code
  (raw egress attempted — `169.254.169.254` hung 10.5s on the real connect). **FIX:** route
  `fetchJSON` through `safeFetch` (`redirect:'manual'`). GREEN: new `tool-registry-ssrf.test.ts`
  16/16 (private `lang` ⇒ SSRF block; public `lang` not over-blocked). 4-link reachability chain
  independently confirmed by the refuter.
- **H2 `l2-rebind-test-false-green` (4 lenses converged) — false-green test, NOT a live bypass.** The
  only L2/rebind test used `localhost:1`; port 1 is on undici's bad-ports list → short-circuits
  BEFORE `validatingLookup` → the most load-bearing security layer had zero genuine coverage.
  **FIX:** discriminating test — loopback server + ephemeral (non-bad) port + assert the rejection is
  an `SsrfBlockedError` cause AND the server is NEVER reached (`hits===0`). Teeth proven: detaching
  `dispatcher: ssrfDispatcher` makes it RED (fetch connects, `hits===1`); the old test stayed green.
  (Production L2 IS correctly wired — multiple lenses proved it live; this closed the regression gap.)

### MED — addressed or deferred
- **`mpp-precapture-no-behavioral-teeth` + `per-rail-billing-matrix-incomplete` → ADDRESSED.** Added
  `proxy-ssrf-mpp-block.test.ts`: a private endpoint on the MPP (Stripe PREPAID) rail returns 502 and
  `validateMppPayment` (the SPT capture) is NEVER called. Teeth proven: neutralizing the pre-capture
  guard makes the 5 block cases RED. **Both PREPAID rails (x402 on-chain + MPP) now have behavioral
  pre-capture block tests** (the money-critical asymmetry). Postpaid rails (api-key, SLA) remain
  code-verified only — lower risk (a block is simply not-charged; no F3 money harm possible) →
  documented residual (§8), not a blocker.
- **`wiring-test-gameable` (4 lenses converged) → ADDRESSED.** The count-only wiring test is what let
  H1 ship green. Added a `NO_RAW_FETCH` assertion: the 6 pure-untrusted-host sink files must contain
  zero raw `fetch(` (every egress is `safeFetch`). This would have caught H1.
- **`missed-sink-ecosystem-website-crawler` (your flag #2) → DEFERRED (documented, not folded).**
  `ecosystem-email-resolver.ts:716` raw-fetches a third-party-derived `sourceUrl`. Refuter confirms
  it IS a genuine residual SSRF of the same class, BUT a **different attack surface** (cron-only
  outreach crawler, blind, not request-triggerable) than the developer-registration/public-API
  surface this chunk closes. Folding cross-surface work is exactly what the seal rule forbids →
  follow-up chunk (§8).

### LOW / INFO — 1 folded, rest documented
- **FOLDED (LOW, in-class): `redirect-body-not-cancelled-on-throw`.** `followManual` leaked the undici
  connection on its two throw paths (hop-cap, blocked-Location). Moved `res.body?.cancel()` before the
  throws. Redirect tests (blocked-Location / hop-cap / happy-path) still green.
- **DOCUMENTED, not folded (disciplined — beyond spec / not live / frozen-adjacent):**
  `classifier-nat64-localuse-underblock` + `classifier-ipv6-transition-underblock` (RFC8215
  `64:ff9b:1::/48`, IPv4-translated `::ffff:0:0/96`, Teredo `2001::/32` classify 'public' — beyond the
  handoff's mandated range list AND non-routable on the Vercel deployment; refuter rated the transition
  set REFUTED); `stale-content-type-on-downgrade` (INFO, frozen money-rail header semantics);
  `redirect-error-functional-regression` (INFO, intended). See §8.
- **REFUTED by the adversarial pass (no action):** 20 of 41 findings, incl. `redirect-method-overconvert`
  (correct per HTTP spec), `undici-version-skew`/`autoselectfamily`/`comment-single-form-throws`
  (SEAM — guard contract holds; undici 5.29.0 confirmed), `commit-hygiene-confirm` (excludes correct),
  `autodetect-https-only-tightening` (authorized).

## 7. Frozen surfaces / commit hygiene
- **Frozen INTACT.** Proxy billing/settlement/fraud/CAS/payout math byte-identical (proxy route net
  diff 48/4 = the build's additive guard hunks only; my ② teeth-proof neutralize→restore left zero net
  change). No timeout / header-whitelist change. serve `handlers.ts` `fetchWithTimeout` (fixed hosts)
  left raw by design. DC-17 held — every teeth-proof reverted via inverse-Edit (no git checkout/
  restore/stash). Scratch files removed (`_ssrf_battery.tmp.test.ts`; reviewers' `zzz` probe already
  gone) — tree clean.
- **Seal commit — INCLUDE (9 modified source + 6 new):**
  - M `app/api/cron/health-checks/route.ts`, `app/api/developer/tools/[id]/endpoint/route.ts`,
    `app/api/proxy/[slug]/route.ts`, `app/api/tools/auto-detect/route.ts`,
    `app/api/tools/quick-publish/route.ts`, `app/api/tools/serve/[slug]/handlers.ts`,
    `lib/notifications.ts`, `lib/tool-registry.ts`, `lib/webhooks.ts`
  - ?? `lib/safe-egress.ts`, `lib/__tests__/safe-egress.test.ts`,
    `lib/__tests__/safe-egress-wiring.test.ts`, `lib/__tests__/tool-registry-ssrf.test.ts`,
    `app/api/proxy/[slug]/__tests__/proxy-ssrf-block.test.ts`,
    `app/api/proxy/[slug]/__tests__/proxy-ssrf-mpp-block.test.ts`
  - (Optional, this chunk's docs) `docs/tech-debt/proxy-ssrf-hardening-handoff-2026-06-29.md` + this
    seal record + the G2-2 roadmap tick.
- **EXCLUDE (pre-existing / unrelated — confirmed by diff):**
  `app/(dashboard)/dashboard/tools/page.tsx` (slugify), `docs/SECURITY-INCIDENT-2026-06-15-*.md`,
  `.claude/`, `docs/tech-debt/launch-gate-queue.md`, `docs/tech-debt/v-n3-mfa-unenroll-hardening-
  handoff-2026-06-27.md`, `scripts/mfa-delete-smoke.sh`.

## 8. Residuals / follow-ups (surfaced, not silently dropped)
1. **ecosystem-email-resolver SSRF (MED)** — route `:716` through `safeFetch` (or validate the
   crawled `sourceUrl`). Different surface (cron outreach) → its own chunk. Same DC-16 class.
2. **IPv6 classifier completeness (LOW, defense-in-depth)** — add `64:ff9b:1::/48`, IPv4-translated
   `::ffff:0:0/96`, Teredo `2001::/32` (+ ORCHID/benchmarking) to `V6_BLOCK`. Not routable on the
   current deployment; airtight-classifier hardening for a defense-in-depth pass.
3. **Postpaid rail block→billing tests (LOW)** — add api-key + SLA-fallback SSRF-block not-charged
   behavioral cases (prepaid rails are now covered; postpaid is the lower-risk half).
4. **INFO** — `stale-content-type-on-downgrade` on the proxy POST→GET redirect downgrade.

## 9. Defect-class ledger (recurrences this chunk)
- **DC-16 (incomplete-sweep) — RECURRED, caught in ②.** The build's "complete inventory" missed the
  `fetchJSON` host-injection (wikipedia `lang`) AND `ecosystem-email-resolver`. The count-only wiring
  test could not see them. **Antidotes folded:** route the shared `fetchJSON` helper through
  `safeFetch`; add the `NO_RAW_FETCH` wiring assertion (absence-of-raw-fetch, not count). The
  governing risk of this chunk, twice over — the handoff itself flagged DC-16 as THE risk.
- **LITERAL-EXECUTION — recurred.** "Route EVERY untrusted-URL fetch through safeFetch" was not
  literally true: a guarded file (`tool-registry.ts`, sinks 13-14 wired) still had an UNGUARDED
  host-injecting helper. A wrapper not CALLED at a sink is an unguarded sink.
- **TEST-TEETH / false-green — recurred (4-lens convergence each).** The L2 test passed via a
  bad-port short-circuit; the wiring test counted instead of asserting absence; the MPP pre-capture
  guard had only a count test. All three given real teeth (RED-on-regression proven).
- **SEAM — held.** undici 5.29.0 `connect.lookup` contract validated (array callback form);
  `net.BlockList` family-crossing handled by manual mapped-IPv6 normalization; the four divergent
  string guards genuinely collapsed to `isPublicUrlString` (no surviving 5th copy); no
  `setGlobalDispatcher`.

## 10. NEXT
Operator: `/seal-go` → explicit-pathspec commit (§7 include list) → tick **G2-2 ☐→☑** in
`LAUNCH-GATE-roadmap-2026-06-27.md` → run `.claude/launch-gate-check.sh` (decrements blockers_open) →
**③ post-seal deep audit (high-stakes)** on the integrated whole.
