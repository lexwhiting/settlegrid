# Next-chunk handoff — post-(R) (Step-0-gated) — 2026-06-07

> Written at the close of the **(R) register close-out bundle** (capstone
> `r-register-closeout-resolution-2026-06-07.md`). The publisher-API-keys register's entire remaining
> **non-gated** tail is now drained. What's left is founder-gated. Read this before picking the next
> chunk.

## State at this handoff

- **(R) is COMPLETE** (LOCAL commit, NOT pushed): F3 + DEBT #2 + #4 + #7 + #8 RESOLVED, #6
  documented-wontfix, the F4 nevermined version-copy nit closed. Pre-build R1→R2 PLAN_READY/0-blocking;
  post-build panel CERTIFIED/0-blocking (incl. ZERO-SPINE-DIFF). apps/web tsc 0 / vitest 4282 / build 0
  / eslint 0; packages/mcp 1898/1 unchanged; zero `packages/sdk-python*` / `drizzle/` / money-spine
  hunks; zero migrations.
- **Local stack (NOT pushed)** sits on top of `origin/main` (which has advanced since the (R) handoff
  snapshot — it was `9d22fd2e` this session, with B4 `be43b501` + the getClientIp chunk already
  pushed). The unpushed local commits are the (N)/(F2)/(F4)/(R) stack plus their docs. **Prod runs
  `origin/main`; none of the local stack is deployed.**
- **The founder's F2+F4 deploy/publish bundle remains actionable and unaffected** by (R): (R) is
  schema-clean (zero migrations) and off the money spine, so it does not perturb that bundle.

## The remaining menu (all founder-gated except (C))

- **(C) — `revenueSharePct` legacy cleanup — the natural FIRST POST-DEPLOY chunk (Step-0 decision).**
  Last MED item: ~26 files reference `revenueSharePct`; the meter route still computes + writes
  `effectiveRevenueSharePct` per-invocation while payout ignores it — a B4-class "two take models"
  latent hazard. It **wants a migration + a funds-SEAL**, so it was deliberately deferred to *after*
  the founder pushes/deploys the current stack, to keep the deploy bundle schema-clean. Do it as its
  own chunk (full gate discipline: trace → plan → pre-build audit → build → funds-SEAL panel →
  founder-gated commit). **This is the recommended lead once the deploy bundle ships.**
- **(K) HMAC-pepper (DEBT #3) — DE-RECOMMENDED.** 256-bit keys are preimage-safe unsalted; the
  all-keys-lockout blast radius of a pepper rotation is the bigger risk. Leave unless a concrete threat
  model changes. (F2 handoff §0.)
- **(A) ACP-dark — BD-gated.** Needs a business-development trigger, not an engineering one.
- **(H) hop extension — demand-gated** (carries a documented reconciler-starvation trap). **F1
  NAT-fairness IP-raise — demand-gated** (costed: new limiter export → ~84-test-file mock sweep + a
  deliberate flood-posture loosening; do if NAT throttling is observed).

## Do NOT re-open (settled; require a NEW trace to revisit)

B4 account_id semantics (RESOLVED `be43b501`), F2/F4 wire contract, N auth.id keying, M getClientIp,
H1 fail-open, the take model. And per the (R) scope: the money spine, `lib/rate-limit.ts` keying,
`hashApiKey`/key formats, `packages/mcp`, `packages/sdk-python*`.

## Recommended next action

Founder pushes/deploys the current local stack + runs the F2+F4 publish bundle → **then** open **(C)**
as the first post-deploy chunk. If the deploy is not imminent, there is no non-gated engineering chunk
queued; (C) is the only MED item and it intentionally waits for the schema-clean deploy.
