# ③ POST-SEAL DEEP AUDIT — proxy-ssrf-hardening — 2026-06-29

**VERDICT: ✅ RE-CERTIFIED (HARDENED).** The integrated whole HOLDS — zero reachable SSRF
bypass and zero money-correctness defect on the live runtime. Two MED findings folded
(IPv6 classifier fail-OPEN + prepaid redirect-cap money regression) + two defense-in-depth
pins (L2 `autoSelectFamily`, doc accuracy), each live-reproduced fail-then-pass. Gate GREEN
from scratch. No frozen surface perturbed; no deferred work pulled in.

Scope = the INTEGRATED WHOLE (committed-equivalent working tree; the chunk's explicit-pathspec
commit is still pending operator action — code under audit is byte-identical to what will ship).
Entry docs: seal record `proxy-ssrf-hardening-seal-record-2026-06-29.md` (§8 residuals, §9 ledger),
handoff `proxy-ssrf-hardening-handoff-2026-06-29.md`.

---

## 1. Tier confirmation (one line)
**HIGH-STAKES — confirmed.** SSRF security boundary + proxy money rail + PUBLIC/UNAUTH attack
surface + launch gate G2-2. This phase is warranted (not incremental).

## 2. Mechanical pre-flight (integrator, handed to all reviewers)
- **Gate GREEN from scratch** (pre-fold): apps/web `tsc 0` / `lint 0` / `vitest 218f · 5029p`.
  (stderr lines = deliberate negative-path test logging from `.test.ts` failure-injection.)
- **Invariants re-derived & confirmed:** `safeFetch` at every known sink (health-checks:83;
  proxy 773/1317/1705/2653; auto-detect 63/107/149; serve/handlers:210; notifications:46/93;
  tool-registry:31/668/690; webhooks:119); `assertSafeUrlSync` pre-capture at proxy 1251 (MPP,
  before `validateMppPayment`) + 1532 (on-chain, before settle) — **both prepaid pre-capture
  orderings independently re-read and confirmed**; **no `setGlobalDispatcher`**; the 4 string
  guards (`isWebhookUrlSafe` + 3× `isPrivateUrl`) collapsed to `isPublicUrlString` delegators.
- **Integrated-whole egress completeness:** every untrusted-HOST server egress on the
  public/registration/proxy surface routes through `safeFetch`. Remaining raw `fetch()` are
  own-host internal (consumer-schedules:60 → `/api/tools/serve/{slug}`; mcp:174/231 →
  INTERNAL_PROXY/SERVE; gridbot; seed-invocations), fixed trusted APIs (openexchangerates,
  posthog, github/reddit/SO monitor crons, registry crawlers, Stripe), or the explicitly-deferred
  `ecosystem-email-resolver` (cron outreach; §8). `admin/launch-metrics` confirmed env/fixed-host
  (PostHog env, Stripe, HN firebase, Sentry slug) — NOT attacker-influenced (resolved the
  pre-flight open question).
- **Independent hostile battery 101/101** (real primitives, pre-fold) — every
  reserved/encoded/embedded/scheme bypass blocked, every public target not over-blocked.

## 3. Orchestration / policy
- **WORKFLOW** (operator-selected) — 6 integrated-whole lenses → per-finding adversarial refute →
  max collective-miss critic, realized via the Workflow `agent()` per-agent EFFORT param:
  reviewers + refuters requested **xhigh**, critic **max**; all `model:opus` → claude-opus-4-8[1m].
  (Self-reported effort 'high' — model-unreliable; the param is what was passed. SEAM-on-policy:
  the skill canonical block says `agent()` exposes no effort option — STALE in this env; the prior
  ③ + this one both used it.) 25 agents, ~1.4M tokens.
- Workflow completed cleanly (no transport failure). Fix-fold + verdict ran in the MAIN session.
- Env traps unset; allowlist GREEN (git/tsc/vitest/lint — exactly the caps; no WebFetch/MCP).
  Path-1 named-subagent defs absent — moot (the workflow realized the effort mix).

## 4. Findings — 29 (6 lenses) + 3 critic-new → adversarial verify → 2 folded MED, rest documented

### FOLDED (sustained, live fail-then-pass, in-class, low-risk)

**F1 [MED→ folded] IPv6 classifier fail-OPEN (converged: classifier-core + teeth-spec lenses).**
Global unicast is ONLY `2000::/3` (RFC 4291), but `classifyV6` only blocked named sub-ranges, so
**every reserved IPv6 outside the named set classified `public`** and — as an IP literal — passed
L1 with no L2 backstop (`net.connect` skips the lookup for literals). Verified RED on shipped code:
`fec0::1` (site-local), `5f00::1` (SRv6), `64:ff9b:1::1` (local NAT64), `4000::/3` `8000::/3`
`c000::/3` (IETF-reserved), Teredo `2001::/32`, ORCHID `2001:10::/28`/`2001:20::/28`, docs
`3fff::/20` all → `public`. **FIX:** a `2000::/3` global-unicast whitelist in `classifyV6` (anything
outside → `reserved`, fail closed), after the embedded IPv4-mapped/compatible/6to4 folds; plus
`2001::/23` + `3fff::/20` added to `V6_BLOCK` for the in-global-unicast specials (V4/V6 parity with
the already-blocked IPv4 `192.0.0/24`/`198.18/15`). **Teeth:** 11 new BLOCK cases (RED→GREEN) + 5
new ALLOW cases proving real global unicast (Cloudflare/Google/APNIC `2001:0200::` boundary/RIPE/
embedded-public) is NOT over-blocked. Independent post-fold battery 44/44.

**F2 [MED→ folded] Prepaid redirect-cap charged-but-undelivered regression (money-rail lens).**
The build swapped the proxy's raw `fetch` (implicit follow, undici ~20 hops) for
`safeFetch(redirect:'manual')` with `maxRedirects` defaulting to **3**. A legitimate, fully-public
≥4-redirect upstream throws `too-many-redirects:3` AFTER the prepaid charge (MPP Stripe SPT capture
@1261; on-chain settle @2040/2196) → **charged-but-undelivered (F3)**, a new over-block class beyond
the documented DNS-rebind residual, and a regression vs the prior ~20-hop behavior. **FIX:** the 4
proxy money-rail `safeFetch` calls now pass `maxRedirects: PROXY_MAX_REDIRECTS = 10` (covers any real
chain; every hop still re-validated by L1+L2 so SSRF defense is unchanged; the shared
AbortController/`UPSTREAM_TIMEOUT_MS`=30s bounds total time regardless of hop count). `fetchJSON`
(tool-registry) keeps the tighter default 3 (fixed-host APIs). **Teeth:** a `followManual` test —
a 4-redirect public (localhost-hostname) chain throws at cap 3 but DELIVERS at cap 10.

### FOLDED (defense-in-depth pins on sustained PARTIAL/INFO findings)

**F3 [LOW/PARTIAL] L2 lookup-shape contract pinned.** `ssrfDispatcher` now constructs
`new Agent({ autoSelectFamily: true, connect: { lookup } })`. The seam lens found the array-form
`all:true` lookup contract was coupled to Node's UNPINNED process-global `autoSelectFamily` default
(verify: drift fails CLOSED, not open — so no security defect, but a latent availability/contract
risk on the security-critical L2). Pinning makes the contract explicit (already the Node ≥20 default;
no behavior change today). Gate-confirmed the real L2 dispatcher tests still pass.

**F4 [INFO] Doc accuracy.** `ssrfDispatcher` is a shared per-process singleton attached PER CALL via
`init.dispatcher` (never `setGlobalDispatcher`) — the docstrings/comment mislabeled it "per-request".
Reworded (the critic refuted any pooling/concurrency bypass: reuse targets the already-screened IP;
classify/screen are pure). Zero behavioral change.

### DOCUMENTED — NOT folded (disciplined: out-of-scope / not reachable / risk-disproportionate)

- **NAT64 well-known `64:ff9b::/96` wholesale over-block (REAL→LOW).** Availability-only,
  fail-closed/secure, deployment-conditional (only well-known-prefix DNS64/NAT64, e.g. AWS IPv6-only
  subnets — NOT this app's Vercel/dual-stack runtime). Kept the wholesale block (secure, conservative);
  embedded-IPv4 extraction would add complexity for a runtime SettleGrid isn't on. Residual.
- **307/308 streamed-body unreplayable on money rails (REAL→LOW).** By-design fail-closed (re-sending
  a consumed stream / dropping the body would be worse; dev credited 0; buyer idempotent retry can
  redeliver). Fix would be size-capped body buffering = scope creep. Residual.
- **Proxy money-rail not https-only at fetch (PARTIAL→LOW).** Defense-in-depth scheme divergence vs
  the https-only registration schema; NOT reachable today (all third-party writers are https-Zod-
  validated; own-host writers build https). **NOT folded** — forcing `allowedProtocols:['https:']`
  at fetch could break a legacy/pre-refine `http` `proxyEndpoint` in the DB → money-rail outage. Do a
  DB audit for `http` endpoints FIRST, then tighten. Residual / audit-first follow-up.
- **`serve/handlers.ts` carved out of `NO_RAW_FETCH` wiring teeth (PARTIAL→LOW).** No live impact (all
  21 `jsonFetch` calls are fixed-host; the lone attacker-host handler `securityHeaders` uses
  `safeFetch`). A future host-interpolating `jsonFetch` would not trip the count-only guard. Residual
  (targeted teeth or refactor fixed-host helpers behind an allowlist).
- **MPP post-capture block has no dedicated F3 alert (PARTIAL→INFO).** A reconcilable signal already
  exists (payment-keyed DB row + unambiguously-post-capture error log); only rail-parity alerting is
  missing. Observability follow-up.
- **`ecosystem-email-resolver` deferred SSRF (REFUTED→INFO).** Re-confirmed NOT currently reachable
  (the `resolveWebsiteEmail` website-scraper branch is dead for crawler-injected data — every crawler
  emits a switch-matched ecosystem that dispatches to fixed-host resolvers; the raw-`sourceUrl` fetch
  is only hit by a non-switch/`null` ecosystem that no crawler emits today). Latent, bounded. Reframe
  the §8 follow-up as **attacker-influenced-but-not-currently-reachable** (not merely "a cron surface").
- **REFUTED (no action):** `seed-invocations` unescaped slug (slug pre-sanitized to `[a-z0-9-]`,
  encode inert); `manual-redirect-stale-content-length` (undici omits CL for bodyless requests —
  refuted live); critic's `l2-honoring-unpinned-runtime` (every shippable Node honors `init.dispatcher`;
  gated by `safe-egress.test.ts:217` end-to-end; edge import is a hard error, not silent fail-open).

## 5. Collective-miss critic (max) — deployment/runtime boundary
The 6 lenses verified entirely on the local Node v24.13.0; their shared blind spot was the
DEPLOYMENT/CI boundary. Critic findings: (1) runtime coupling unpinned — **REFUTED** (no shippable
Node ignores `init.dispatcher`; the e2e test gates the driveable coupling); (2) **`ssrf-suite-absent-
from-ci-and-build-gate` (REAL→LOW)** — no `.github` workflow runs apps/web `vitest`, and
`turbo build dependsOn ['^build']` only, so the Vercel `next build` runs `tsc`+ESLint but NEVER the
SSRF behavioral suite → a behavioral regression ships GREEN unless a human runs vitest locally;
(3) singleton mislabel — folded as F4. Finding (2) is the surfaced net-new chunk (§7).

## 6. Frozen surface / gate (post-fold)
- **Frozen INTACT.** Proxy billing/settlement/fraud/CAS/payout math byte-identical (the diff is
  exclusively the chunk's SSRF-guard adds + my const/`maxRedirects` params; no money-math line
  changed). No header-whitelist / timeout change. `safeFetch` wiring unchanged. No new
  `setGlobalDispatcher`. The classifier fold is purely ADDITIONAL blocking (ALLOW test proves zero
  over-block of real global unicast).
- **Gate GREEN from scratch (post-fold):** `tsc 0` / `lint 0` / `vitest 218f · 5046p` (Δ+17 vs seal =
  11 IPv6 BLOCK + 5 ALLOW + 1 redirect-delivery test → gate ran on fixed code). settlegrid-agents
  UNAFFECTED. Temp battery files removed; tree clean.

## 7. Defect-class ledger (③ recurrences + new)
- **DC-16 (incomplete-sweep) — RECURRED on the classifier-completeness axis, caught + folded.** The
  build/② classifier blocked named ranges but left the whole non-`2000::/3` reserved space classifying
  `public` (fail-OPEN). Antidote: the global-unicast WHITELIST (allowlist the only routable range, block
  the rest) replaces the whack-a-mole blocklist as the primary IPv6 decision. (The egress-sink sweep
  itself re-verified COMPLETE — no missed live sink; the DC-16 recurrence was inside the classifier.)
- **DC-18 (financial-integrity) — RECURRED, folded.** A guard PARAMETER (redirect cap 3) introduced a
  prepaid charged-but-undelivered over-block — the exact "over-block = money harm" class the chunk's
  pre-capture guards target, but via hop-count not address. Antidote: raise the money-rail cap (every
  hop still revalidated). Confirms ② was right to scrutinize the block→billing seam; ③ extends it to
  the redirect-hop seam.
- **LITERAL-EXECUTION — held + reinforced.** The fail-open mattered precisely because L1 is the SOLE
  adjudicator for IP literals (L2 lookup skipped) — the whitelist closes it at the only layer that runs.
- **SEAM — held; one new pin.** undici 5.29 lookup contract validated; the `autoSelectFamily` global
  coupling pinned (F3). The `safeFetch`↔proxy `fetchInit` (signal/duplex/headers) preserved across the
  raised redirect cap.
- **TEST-TEETH — held + extended.** All ② teeth re-confirmed discriminating; ③ added IPv6 BLOCK/ALLOW
  matrix + redirect-delivery teeth (all RED-on-regression proven).
- **NEW class surfaced (process): CI-GATE-ABSENCE.** Security test suites with teeth that no automated
  gate executes — the deploy-time tripwire is missing (§5 finding 2 / §7 chunk).

## 8. Residuals (carried forward — none block the seal)
1. `ecosystem-email-resolver` SSRF (latent, bounded; §8 of seal) — its own chunk (different surface).
2. NAT64 well-known-prefix availability (LOW, deployment-conditional) — embedded-extract if ever on
   DNS64/NAT64.
3. Proxy fetch-time https-only (LOW, defense-in-depth) — DB-audit `http` endpoints, then tighten.
4. `serve/handlers` `NO_RAW_FETCH` carve-out teeth (LOW); MPP F3 alert parity (INFO); runtime pin
   `engines.node`/`.nvmrc` (INFO).

## 9. Verdict
**RE-CERTIFIED (HARDENED).** Integrated whole holds: no reachable SSRF bypass, no money-correctness
defect on the live runtime; the IPv6 classifier fail-OPEN and the prepaid redirect-cap money
regression are closed fix-first with teeth; the L2 contract is pinned. Operator's pending
explicit-pathspec commit now carries the ③ hardening (no separate ③ commit — ② was never committed,
so the folds join the single pending chunk commit).
