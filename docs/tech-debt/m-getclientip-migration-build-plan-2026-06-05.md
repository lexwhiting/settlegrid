# (M)+(E) — `getClientIp` call-site migration (finish DEBT #1) + `processDataExport` symmetric guard — BUILD PLAN (2026-06-05)

> Pre-build-audit-gated build plan. Read order: the post-H1 handoff
> (`next-chunk-handoff-2026-06-05-post-h1.md` §3) → the H1 build plan
> (`h1-rate-limit-availability-build-plan-2026-06-05.md` §3 SCOPE GUARD shape) → THIS plan.
> Status: **PLAN_READY** (independent pre-build audit, round 2, **0 blocking** —
> `.audit/m-prebuild/` runs `wf_56f78526-d8e` round-1 → 2 blocking fixed; `wf_c834c0f0-5cb`
> round-2 → PLAN_READY + 3 improvements/1 nit all applied). Cleared for implementation.
> Chunk class: **OFF the funds spine** (no settlement/ledger/payout/pricing LOGIC is touched;
> the migration changes ONLY the per-request IP-derivation line + a `getClientIp` import in
> settlement-surface route files). Post-build gate is the **security/regression panel with a
> dedicated spine-line diff lens**, not a funds-SEAL.

---

## 1. Step-0 record (founder decision, 2026-06-05) + verified ground truth

**Founder picked: (M) `getClientIp` call-site migration + (E) `processDataExport` symmetric
guard, BUNDLED**, with the **7→(broader) settlement-adjacent files handled LINE-SURGICAL,
option (i)** (migrate the ip-derivation + import lines only; a post-build spine-line diff lens
verifies everything else byte-identical). This finishes DEBT #1 (capstone §5.1) and the
symmetric §5.2 follow-on.

**HONEST VALUE FRAMING (carried from H1 correction #3 — SETTLED, do not re-litigate):** on
Vercel this is **consistency/portability hygiene, NOT a vulnerability fix.** Vercel overwrites
inbound `x-forwarded-for` (official docs, cited in the `getClientIp` docstring at
`rate-limit.ts:181-189`), so all existing inline styles already resolve to the same correct
value in prod. Merit: kills the multi-style drift forever, completes DEBT #1, adds a consistent
`x-real-ip` fallback + a single sentinel everywhere, makes any future off-Vercel move safe.

**Ground truth — every claim below re-verified LIVE at HEAD `33d632fa` (over `e0c9c504` H1),
2026-06-05, via tool output. The audit MUST re-verify each against actual source.**

### 1.1 The migration set (authoritative census)
- **`getClientIp(headers: Headers): string`** is the single source of truth, shipped by H1 at
  `apps/web/src/lib/rate-limit.ts:194-203`. Semantics: left-most `x-forwarded-for` entry (split
  on `,`, trimmed, non-empty) → `x-real-ip` (trimmed, non-empty) → `'unknown-ip'` sentinel.
- **Migration set = 209 non-test files** that BOTH call `checkRateLimit`/`checkTieredRateLimit`
  AND derive the IP inline from `x-forwarded-for`. Verified by set-intersection:
  `comm -12 <(rg -l 'checkRateLimit|checkTieredRateLimit' src --glob '!**/__tests__/**' | sort)
  <(rg -l 'x-forwarded-for' src --glob '!**/__tests__/**' | sort)` → **209** (saved at
  `/tmp/migration-set.txt` during planning; the implementer + audit re-derive it).
  **⚠ 209 = the intersection INCLUDING `src/lib/rate-limit.ts` itself** (it both defines
  `checkRateLimit`/`checkTieredRateLimit` AND contains `x-forwarded-for` in the `getClientIp`
  body `:195` + docstring `:183`). The helper is §3 byte-stable and has NO inline
  limiter-feeding derivation, so the taxonomy naturally no-ops on it. **Files actually migrated
  = 208** (209 − the helper). §5.1 keeps `rate-limit.ts` as a done-check allow-list entry.
  (213 total limiter-caller files; the 4 limiter-callers WITHOUT an inline XFF derivation are
  out by other means: `tools/serve/[slug]`, `unsubscribe`, `mcp` (H1's 3, already on the helper)
  + `stickers/request` (email-keyed limit, reads no `x-forwarded-for` — nothing to migrate).)

### 1.2 Recipe taxonomy — the migration is mechanical but NOT a single uniform 1-liner
The handoff §3's "uniform 1-line-per-file recipe" is an oversimplification. The grounded reality
is **one canonical replacement target** — `const <var> = getClientIp(<receiver>.headers)` —
reached from **eight source patterns**, of which **~189 files are trivially uniform single-line
(U1/U2, receiver `request`)** and **19 files need explicit handling** (7 U3 two-line wraps + 2 U4 +
6 U5 `req`-named + 1 N1 + 1 N2 + 2 N3). Every pattern resolves to the SAME helper call; the only
variation is how many physical lines collapse, the **variable name** (`<var>`), and the
**Request-param receiver name** (`<receiver>`). The 19 explicitly-named files are individually
enumerated below + in §4; the ~189 remainder are blind one-line replacements.

**⚠ TWO placeholders, not one (blocking-grade — a hardcoded literal breaks tsc):** `<var>` is the
existing LHS identifier (almost always `ip`; `proxy` uses `rawForwardedFor`, `telemetry/capture`
uses `xff`). `<receiver>` is the **handler's actual Request-param identifier** — usually `request`,
but **6 in-set files name it `req`** (pattern U5 below) and have NO `request` binding in scope.
Emitting a literal `getClientIp(request.headers)` into a `req`-only handler ⇒ **TS2552 'Cannot
find name request'** ⇒ tsc + next build RED. The implementer MUST read each file's handler
signature and use its real receiver name. (This is a SECOND reason a blind global sed is unsafe,
on top of the var-name variance.)

**Authoritative totals: 189 trivially-uniform single-line (U1+U2 combined) + 19 explicitly-named
(U3 7, U4 2, U5 6, N1 1, N2 1, N3 2) = 208.** The U1/U2 split is not implementation-relevant (both
are blind one-line replacements); per-pattern counts below are left as "—" for the two blind classes.

| Pattern | Shape (before) | Count | Handling |
|---|---|---|---|
| **U1** split-style one-liner | `const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'` | — | blind: replace the one line |
| **U2** whole-header one-liner | `const ip = request.headers.get('x-forwarded-for') ?? 'unknown'` | — | blind: replace the one line *(carries delta (iii), §1.4)* |
| **U3** 2-physical-line wrap (`const ip =` then expr on next line) | `const ip =\n  …get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'` (or `\|\| 'unknown'` for gate) | **7** | replace BOTH physical lines with the single `const ip = getClientIp(request.headers)` — a blind one-LINE replace would orphan the dangling `const ip =` |
| **U4** whole-header + split-in-identifier | `const ip = …get(xff) ?? 'unknown'` then `` `key:${ip.split(',')[0]?.trim() ?? 'unknown'}` `` (`admin/chargeback-watch/unpause:48-49`, `payouts/schedule:83-84`) | 2 | replace the derivation line ONLY; leave the identifier template byte-identical (its `.split` becomes a harmless no-op on the already-first-hop value — §1.4 proof) |
| **N1** proxy 2-line named var | `const rawForwardedFor = …get(xff) ?? 'unknown'`\n`const ip = rawForwardedFor.split(',')[0].trim()` (`proxy/[slug]:434-435`) | 1 | replace BOTH lines with the helper call; verify `rawForwardedFor` has no other reference |
| **N2** `firstHopIp` helper fn | a 10-line local `function firstHopIp(request){…XFF→x-real-ip→'unknown'…}` (`telemetry/capture:99-108`) + its single call site (`:155`) | 1 | DELETE the helper; repoint the call site to `getClientIp(request.headers)` |
| **N3** 3-line XFF→x-real-ip→`'anonymous'` | `const ip =\n  …?.split(',')[0]?.trim() ??\n  …get('x-real-ip') ??\n  'anonymous'` (`telemetry/kernel:126-129`, `admin/kernel-health:130-133`) | 2 | replace the 3-line derivation with the helper call |
| **U5** `req`-named handler (whole-header) | `const ip = req.headers.get('x-forwarded-for') ?? 'unknown'` — handler param is `req`, NOT `request` | 6 | replace with `const ip = getClientIp(req.headers)` (receiver = `req`) |

**The 7 U3 2-physical-line-wrap files (verified `const ip =` + wrapped expr, all collapse to the
one-liner): `gate:18-19`, `ap2/settle:74-75`, `ap2/verify:80-81`, `circle-nano/settle:79-80`,
`circle-nano/verify:80-81`, `eligibility:81-82`, `tools/claim:59-60`** (5 of the 7 are spine-diff
set — ap2×2, circle-nano×2 — so they also get hunk verification).
**The 7 OTHER line-surgical (named) files: `proxy/[slug]` (N1), `admin/chargeback-watch/unpause` +
`payouts/schedule` (U4), `telemetry/capture` (N2), `telemetry/kernel` + `admin/kernel-health` (N3),
and the U3 set above.** Each pattern gets an explicit before/after in §4.
**The 6 U5 `req`-named files (verified `GET/POST(req: NextRequest)` + `req.headers.get('x-forwarded-for') ?? 'unknown'`,
all whole-header, all in-set, all import `@/lib/rate-limit`):** `a2a/route.ts:24`,
`a2a/skills/route.ts:39`, `chat/route.ts:135`, `feed/route.ts:20`, `stream/route.ts:24`,
`support/route.ts:30` — each → `const ip = getClientIp(req.headers)`. The other ~189 are U1/U2
blind one-line replacements with receiver `request`.

**⚠ Multi-derivation files (~30 files have >1 limiter derivation — migrate EVERY one):** the
"one line per file" mental model undercounts. Densest: **`auth/mfa/route.ts` — 4 derivations
(`:15, :60, :101, :165`) to migrate + 2 `ipAddress:` audit captures (`:143, :205`) to PRESERVE**
(§5.1). `tools/[id]/route.ts` (`:150, :204, :310`) and `developer/tools/[id]/endpoint/route.ts`
(`:67, :154, :219`) have 3 derivations each; `developer/webhooks/[id]/route.ts` has 2 (`:32, :81`).
**Recipe rule: per file, migrate ALL `= <receiver>.headers.get('x-forwarded-for')…` derivation
lines; NEVER touch an `ipAddress:` audit-capture line (§5.1).** The §5.1 derivation-grep backstops
any missed line.

**Import:** all 208 migrated targets import via `@/lib/rate-limit` (the path alias); **none** use
`./rate-limit` (the only `./rate-limit` importer is `demo-rate-limit.ts`, which is NOT in the
set). Recipe: add `getClientIp` to the file's EXISTING `@/lib/rate-limit` named import; do NOT
add a second import statement.

### 1.3 Three distinct sentinels exist — the handoff census saw only one
Inline derivations terminate in **three** sentinels, all of which the migration unifies to
`'unknown-ip'`:
- `'unknown'` — the bulk (U1/U2/U3/U4 + proxy + `telemetry/capture`'s `firstHopIp`).
- `'anonymous'` — `telemetry/kernel:129`, `admin/kernel-health:133` (the N3 files). **The
  handoff §3 missed this entirely.**
- (`'unknown-ip'` already, in the H1-migrated `demo-rate-limit`/serve/unsubscribe/mcp — OUT of
  the set.)

### 1.4 Behavioral deltas to enumerate (small but REAL — the audit must verify each)
- **(i) sentinel re-key (all three → `'unknown-ip'`):** a header-less request's bucket key
  changes `…:unknown` / `…:anonymous` → `…:unknown-ip`. One-time re-key for anonymous traffic;
  sliding windows just restart. Harmless.
- **(ii) `x-real-ip`-only requests** now resolve to that IP instead of the sentinel (U1/U2/U4
  files had no `x-real-ip` fallback). On Vercel `x-real-ip ≡ x-forwarded-for` so **no prod
  delta**; matters only in dev/tests. The N3 files already had this fallback (value-preserving
  there).
- **(iii) whole-header → first-hop (U2 + U4 + U5 + N1):** a hypothetical MULTI-entry `x-forwarded-for`
  on a U2/U4/U5/N1 file currently yields the WHOLE comma-joined header as the bucket key; after
  migration it yields the left-most entry. On Vercel XFF is single-client-IP-shaped so **no prod
  delta**; this removes a cross-style inconsistency by construction. **U4 proof:** after replacing
  the derivation, the residual `${ip.split(',')[0]?.trim() ?? 'unknown'}` runs on getClientIp's
  output — a single IP (`'1.2.3.4'.split(',')[0]` = `'1.2.3.4'`) or the sentinel
  (`'unknown-ip'.split(',')[0]` = `'unknown-ip'`, truthy ⇒ `?? 'unknown'` never fires) — so the
  identifier value is unchanged for real IPs and `'unknown-ip'` for sentinels. No path yields
  `'unknown'`.

### 1.5 Forced-test-edit surface (COMPLETE census — re-verified across ALL sentinels)
Identifier-arg assertions on `checkRateLimit` exist in 6+ route tests, but only the **sentinel**
ones change value under migration. Census of test assertions pinning a sentinel identifier
(`rg ":(unknown|anonymous|unknown-ip)'" src --glob '**/__tests__/**'`):
- **`src/app/api/tools/[id]/listed-in-marketplace/__tests__/route.test.ts:153`** —
  `'tool-listed:unknown'` → **EDIT to `'tool-listed:unknown-ip'`** (its route
  `tools/[id]/listed-in-marketplace/route.ts:32` is in the set).
- **`src/app/api/__tests__/x402-facilitator.test.ts:403`** — `'x402-facilitator-settle:unknown'`
  → **EDIT to `'x402-facilitator-settle:unknown-ip'`** (its route
  `x402/facilitator/v1/settle/route.ts:67` is in the set).
- `src/lib/__tests__/demo-rate-limit.test.ts:132` — `'demo-kernel:unknown-ip'` — ALREADY on the
  new sentinel (H1); route NOT in the set; **no edit**.
- **No `:anonymous'` test assertion exists** (verified empty) — so migrating `telemetry/kernel`
  and `admin/kernel-health` off `'anonymous'` breaks **zero** tests.

The 6 *value-stable* identifier-pinning tests (`eligibility:203.0.113.7`,
`telemetry:198.51.100.1`, `kernel-telemetry:203.0.113.7`, `waitlist:203.0.113.7`,
`tool-listed:9.9.9.9`, the x402-facilitator non-sentinel cases) **pass UNEDITED**: their routes
are already split-style (or send single-IP / first-hop-asserting inputs), and `getClientIp`
reproduces the identical value. **Net forced edits: exactly 2 test files** (matches the handoff's
bottom line; its supporting "0 identifier-pinning tests" phrasing was imprecise).

### 1.6 (E) `processDataExport` — guard symmetry, retry-proof RE-DERIVED (not copied)
`apps/web/src/lib/settlement/compliance.ts:278-279` — `if (record.status !== 'pending') throw
new Error('Export already processed: …')` — the same wedge pattern as the OLD deletion guard.
**Verified honest framing (capstone §5.2): NOT prod-reachable as a wedge** — the only caller
(`api/dashboard/developer/data-export/route.ts:77-80`) creates a FRESH export row per request
(`requestDataExport('provider', auth.id)`) and processes it immediately; a `failed`/`completed`
row is simply abandoned. So (E) is pure hygiene/symmetry.

**Retry-safety proof RE-DERIVED from the actual write shape (the handoff's TRACE-IT warning —
`processDataExport` does NOT match the deletion's txn shape):** `processDataExport` uses **NO
`db.transaction`.** Its writes are three standalone `db.update`s on its OWN
`compliance_exports` row: (1) `status='processing'`; (3a happy) `status='completed' +
resultUrl + completedAt`; (3b catch) `status='failed'`. Between them, `collectDeveloperData`
is **read-only** on developer data. Therefore: a `failed` export performed **no destructive
write** — only its own status row changed — and a retry re-collects fresh data and re-encodes.
The proof is *simpler* than deletion's (no multi-table atomicity to reason about) and is stated
from the export's real write shape, **not** lifted from the deletion docstring.

---

## 2. Scope — what ships (IN)

- **M1. The migration sweep** across the **208 migrated files** (the 209 intersection − the
  `rate-limit.ts` helper): every inline XFF rate-limit derivation replaced with
  `const <var> = getClientIp(<receiver>.headers)` per the §1.2 taxonomy — preserving each call
  site's existing variable name AND its handler's Request-param receiver name (`request` for ~189
  files, `req` for the 6 U5 files), and its identifier template line. ALL derivation lines per
  file migrate (~30 files have >1; `auth/mfa` has 4 — §1.2). `getClientIp` added to each file's
  existing `@/lib/rate-limit` import. The 7 line-surgical files + the 6 U5 files (§1.2) handled
  with explicit before/after (§4); the rest via the blind one-line replacement.
- **M2. The 2 forced test-sentinel edits** (§1.5): `tool-listed` + `x402-facilitator`,
  `:unknown` → `:unknown-ip`.
- **M3. Done-check** (§5.1): the **derivation-targeted** grep
  `rg "= (request|req)\.headers\.get\('x-forwarded-for'\)" apps/web/src --glob '!**/__tests__/**'`
  returns EMPTY (zero residual inline rate-limit derivations); the broad
  `rg "x-forwarded-for" …` returns ONLY the §5.1 allow-list (the helper + the 9 audit-capture
  lines + comments). **Audit captures (`ipAddress: …`) are NOT derivations and are NEVER migrated.**
- **E1. `processDataExport` status machine** (`compliance.ts`): `completed` → idempotent no-op
  returning the stored `resultUrl`; `failed` → retryable (re-process); `processing` →
  concurrency guard (throw). Docstring updated to the real machine + the §1.6 retry proof. The
  `requestType !== 'data-export'` and not-found guards above it are PRESERVED.
- **E2. `settlement-moat.test.ts` surgery** (§4-E): rewrite the `'throws when export already
  processed'` test to the no-op assertion; add `failed`-retry + `processing`-guard tests.
- **Docs/registers (post-panel):** capstone doc; capstone §5.1/§5.2 → resolved; the
  publisher-keys register DEBT #1 → CLOSED; memory pointer. This plan committed alongside.

**Net source files:** **208 route/lib files** (import + 1-to-4 derivation lines each: ~30 files
migrate >1 derivation; the N2 file also deletes a ~10-line helper) + **1 settlement lib**
(`compliance.ts` — the `processDataExport` guard block + docstring ONLY) + **2 edited test files**
(the sentinel pins) + **1 edited test file** (`settlement-moat.test.ts`, (E) cases). **NO
migration. NO schema change. NO `packages/mcp` change. NO SDK rebuild. NO new limiter, NO
limiter-number change, NO new rate limit on any route, NO change to any identifier PREFIX, NO
change to any `ipAddress:` audit-log capture.**

---

## 3. ⚠️ SCOPE GUARD (§6a — reject audit findings that grow scope)

**Byte-stable — do NOT modify:**
- The entire settlement spine: `lib/settlement/ledger.ts`, `reconcile.ts`, `payouts/process.ts`,
  `lib/pricing.ts`, the orchestrators (`x402/orchestrate.ts`, `circle-nano/settle.ts`), on-chain
  engines/verifiers, all 4 settlement writer call sites, `(from,nonce)` dedup,
  `developers.balanceCents` as the only authoritative balance, the take model (`take_bps=0`), the
  B4 semantic (`account_id` IS developer id). **In `compliance.ts`: ONLY the `:278-279`
  `processDataExport` status-guard region + its function docstring change — `processDataDeletion`
  (H1's machine), `collectDeveloperData`, the 9-step deletion txn, and the financial-record
  retention list stay byte-identical.**
- **In the settlement-surface route files (§7.2 spine-diff set — proxy, the x402/circle-nano/ap2
  settle+verify routes, the x402 facilitator v1 routes, hop, the payout/billing-webhook routes):
  ONLY the ip-derivation line(s) + the `getClientIp` import line may change.** Writer call sites
  (`accountId: toolRow.developerId`), settle/verify/dispatch logic, enforce-exact, the identifier
  template strings, response shapes — **byte-identical** (hunk-by-hunk panel-verified, §7.2).
- `lib/rate-limit.ts` (the helper itself), `lib/demo-rate-limit.ts` (H1's re-export) — NOT in the
  migration set; **untouched** beyond already being the source of truth.
- **All 9 `ipAddress:` audit-log captures** (`x-forwarded-for ?? undefined`, NOT rate-limit
  derivations) across 8 files: `auth/callback/route.ts:203`, `data-export/route.ts:103`,
  `stripe/connect/route.ts:200`, `billing/change-plan/route.ts:204`, `auth/mfa/route.ts:143`,
  `auth/mfa/route.ts:205`, `dashboard/developer/notification-preferences/route.ts:124`,
  `dashboard/developer/profile/route.ts:129`, `dashboard/developer/payout-settings/route.ts:63`.
  **ALL EXCLUDED + documented (§5.1).** **7 of these 8 files** ALSO have a rate-limit derivation
  that DOES migrate (all except `auth/callback`, which has 0 derivations and is not even in the 208
  set) — the recipe touches the derivation line only, leaving every `ipAddress:` capture
  byte-identical (migrating one would flip `?? undefined` → `'unknown-ip'`, a forbidden semantic
  change to audit logs).
- Limiter choices, fail-mode posture, limiter numbers, Upstash `timeout` — all H1-SETTLED;
  **untouched.**

**Explicitly OUT of scope (deferred/documented, NOT this chunk) — the §6a growth vectors to HOLD
THE LINE against:**
- **Keying authenticated routes on `auth.id`** (register sketch (c)) — a SEPARATE chunk.
- **Adding rate limits to more routes / removing any** — none added, none removed.
- **Tuning limiter numbers / fail-modes / Upstash timeout** — all H1-SETTLED.
- **"Improving" the settlement-surface files while in there** — line-surgical ONLY.
- **Migrating `auth/callback`'s (or any) audit-log `ipAddress` capture** — different purpose;
  excluded.
- **Making the `processDataExport` route reuse `failed`/`completed` rows** — caller still creates
  a fresh row per request; (E) only fixes the function's own idempotency.
- **Re-deriving any identifier PREFIX, "cleaning" the U4 residual split, or normalizing the
  `'anonymous'`/`'unknown'` LOG strings elsewhere** — the migration changes the derivation
  expression only.
- (A) ACP, (H) hop-route schema, (C) `revenueSharePct`, (K) HMAC-pepper — Step-0 non-picks.

**Any audit finding that adds the above is REJECT-with-rationale
(`severityFinal: 'rejected-scope-expansion'`), not auto-apply — unless it proves a PLANNED change
is itself wrong (e.g., a value delta that DOES break a caller, a missed forced test edit, a
non-byte-stable hunk in a settlement file). The H1 standing decisions (fail-open posture,
left-most-XFF correctness, sentinel `'unknown-ip'`) are SETTLED; a finding re-litigating them
needs a concrete NEW trace to be anything but rejected. Zero findings is a valid outcome.**

---

## 4. Change detail

### 4-M (the 7 line-surgical files + the 6 U5 files — explicit before/after; the rest follow §1.2)

**`proxy/[slug]/route.ts` (N1, spine-diff set), lines 434-435 →** (line 433 is the retained comment)
```ts
    // Rate limit by IP — extract first IP from x-forwarded-for (client IP)
    const ip = getClientIp(request.headers)
    const rateLimit = await checkRateLimit(sdkLimiter, `proxy:${ip}`)
```
(delete the `rawForwardedFor` line; keep the comment — still accurate; `rateLimit`/identifier
line byte-identical. Verify `rawForwardedFor` is referenced nowhere else: confirmed single-use.)

**The 7 U3 2-physical-line-wrap files →** collapse the `const ip =` line + its wrapped expression
line into the single `const ip = getClientIp(request.headers)`; the identifier line untouched:
`gate:18-19` (`|| 'unknown'`), `ap2/settle:74-75`, `ap2/verify:80-81`, `circle-nano/settle:79-80`,
`circle-nano/verify:80-81`, `eligibility:81-82`, `tools/claim:59-60` (all `?? 'unknown'`). ⚠ a
blind one-LINE replace of only the expression line would leave a dangling `const ip =`.

**`admin/chargeback-watch/unpause/route.ts` (U4), line 48 →**
`const ip = getClientIp(request.headers)` (line 49 `` `chargeback-unpause:${ip.split(',')[0]?.trim() ?? 'unknown'}` ``
left BYTE-IDENTICAL — §1.4 (iii)/U4 proof: harmless no-op on the helper output).

**`payouts/schedule/route.ts` (U4, spine-diff set), line 83 →**
`const ip = getClientIp(request.headers)` (line 84
`` `payout-schedule:${ip.split(',')[0]?.trim() ?? 'unknown'}` `` left BYTE-IDENTICAL).

**`telemetry/capture/route.ts` (N2), lines 99-108 →** DELETE the `firstHopIp` function (the `}`
closes at :108; :110+ is the unrelated `ipCountry` docstring); at its one call site
(`:155` `const ip = firstHopIp(request)`) replace `firstHopIp(request)` with
`getClientIp(request.headers)`. (Add `getClientIp` to the `@/lib/rate-limit` import; remove the
now-dead helper. Re-grep `firstHopIp` to confirm the single call site before deleting.)

**`telemetry/kernel/route.ts` (N3), lines 126-129 →** `const ip = getClientIp(request.headers)`
(replaces the 3-line XFF→x-real-ip→`'anonymous'` block; `kernel-telemetry:${ip}` untouched).

**`admin/kernel-health/route.ts` (N3), lines 130-133 →** `const ip = getClientIp(request.headers)`
(replaces the 3-line block; `admin-kernel-health:${ip}` untouched).

**The 6 U5 `req`-named files** (`a2a:24`, `a2a/skills:39`, `chat:135`, `feed:20`, `stream:24`,
`support:30`) → `const ip = getClientIp(req.headers)` — receiver is `req` (NOT `request`); a
literal `request.headers` here = TS2552. Add `getClientIp` to the existing `@/lib/rate-limit`
import.

**`auth/mfa/route.ts` (4 derivations + 2 audit captures) →** migrate ALL FOUR derivation lines
(`:15, :60, :101, :165`, each `const ip = request.headers.get('x-forwarded-for') ?? 'unknown'`)
to `const ip = getClientIp(request.headers)`; **leave the 2 `ipAddress:` audit captures
(`:143, :205`) BYTE-IDENTICAL.** (Other multi-derivation files — `tools/[id]` :150/204/310,
`developer/tools/[id]/endpoint` :67/154/219, `developer/webhooks/[id]` :32/81 — same rule:
migrate every derivation line, preserve every audit capture.)

**The ~189 remaining U1/U2 single-line files:** for each, replace each inline derivation line with
`const <var> = getClientIp(request.headers)` (preserve the existing `<var>` name — almost always
`ip`; receiver `request`) and add `getClientIp` to the existing `@/lib/rate-limit` import.
**Single-writer, file-by-file** — NOT a global sed (variable-name
AND receiver-name AND import-shape variance, §1.2, makes a blind sed unsafe — it would emit
`request.headers` into the 6 `req`-named handlers ⇒ TS2552). Each file is independently
tsc/eslint-clean after edit.

### 4-E `processDataExport` (`compliance.ts`)

**E1. Replace the `:278-279` guard** (mirror the H1 deletion machine; preserve the `:274-275`
`requestType` guard and the not-found guard above it):
```ts
  if (record.status === 'completed') {
    // (E) idempotent no-op — the export already ran to completion. Re-runs
    // must not throw (symmetry with processDataDeletion). Returns the stored URL.
    logger.info('compliance.data_export_already_completed', { exportId })
    return { status: 'completed', resultUrl: record.resultUrl ?? null }
  }

  if (record.status === 'processing') {
    // Concurrency guard: another run is (or appears to be) in flight.
    throw new Error(`Export already in progress: ${exportId}`)
  }

  // 'pending' (first run) and 'failed' (retry) both proceed. Retry safety:
  // processDataExport performs NO destructive write — collectDeveloperData is
  // read-only and the only state is this export's own status row — so 'failed'
  // implies nothing was persisted and a retry re-collects fresh. (No db.transaction;
  // proof differs from processDataDeletion's atomicity proof — see the build plan §1.6.)
```
**E2. Docstring** (above `processDataExport`, currently `:255-258`) — replace with the real
status machine + the §1.6 retry proof. **E3. `settlement-moat.test.ts`:** rewrite
`'throws when export already processed'` (`:626-633`) → `'returns completed as an idempotent
no-op when already completed'` (fixture `status:'completed', resultUrl:'data:application/json;base64,e30='`
→ expect `{status:'completed', resultUrl:'data:…'}`; assert `mockDbUpdate` NOT called); ADD
`'retries a failed export to completion'` (fixture `status:'failed'`, happy-path thenable rig →
expect `{status:'completed'}` + a `resultUrl`); ADD `'throws when an export is already in
progress'` (fixture `status:'processing'` → `rejects.toThrow('already in progress')`). The
not-found / wrong-type tests (`:610-624`) pass unchanged.

---

## 5. Done-check + forced-edit completeness

### 5.1 Done-check greps (TWO forms — the PRIMARY is derivation-targeted)

**PRIMARY (machine-checkable, the real gate) — derivation-targeted, MUST return EMPTY post-sweep:**
```
rg -n "= (request|req)\.headers\.get\('x-forwarded-for'\)" apps/web/src --glob '!**/__tests__/**'
```
This matches single-line assignment-style rate-limit derivations (`const ip = request.headers.get(…)`,
`const ip = req.headers.get(…)`, incl. all 6 U5 `req`-named files and N1 `proxy`'s single-line
`const rawForwardedFor = request.headers.get(…)`) — exactly what the bulk sweep eliminates. It does
NOT match the helper's internal `const forwarded = headers.get(…)` (no `request.`/`req.` receiver),
the `ipAddress: request.headers.get(…)` audit captures (no `= ` assignment — object-property `:`
colons), the demo deny-list string literal, or comments. **Empty (exit-1) = the single-line bulk is
done.**
⚠ **PRIMARY blind spot — 9 MULTI-LINE shapes the PRIMARY grep CANNOT see** (the `=` is on the line
ABOVE the `<receiver>.headers.get`): the **7 U3 two-physical-line wraps** (`gate`, `ap2/{settle,verify}`,
`circle-nano/{settle,verify}`, `eligibility`, `tools/claim`) + the **2 N3 three-line** files
(`telemetry/kernel`, `admin/kernel-health`). The PRIMARY returns exit-1 on these whether or not they
migrated, so it is NOT their gate. **Their gate is the SECONDARY broad grep** (an un-migrated U3/N3
leftover surfaces in `rg x-forwarded-for` and is NOT in the §5.1 allow-list ⇒ false-fails ⇒ caught)
**plus the explicit §4 before/after** for all 9. (`proxy:434` is single-line, so the PRIMARY DOES
catch it — it is NOT in this blind-spot class.)

**SECONDARY (broad, human-reviewed allow-list) —** `rg "x-forwarded-for" apps/web/src --glob
'!**/__tests__/**'` returns ONLY these legitimate keepers:
- `src/lib/rate-limit.ts` — the `getClientIp` helper body `:195` + docstring `:183` (the canonical
  reader; the 209th intersection member, NOT a migration target).
- **The 9 `ipAddress:` audit-log captures (`?? undefined`, EXCLUDED §3) across 8 files** —
  `auth/callback:203`, `data-export:103`, `stripe/connect:200`, `billing/change-plan:204`,
  `auth/mfa:143`, `auth/mfa:205`, `dashboard/developer/notification-preferences:124`,
  `dashboard/developer/profile:129`, `dashboard/developer/payout-settings:63`. (7 of the 8 files
  — all except `auth/callback` — ALSO migrated their rate-limit derivation; the audit capture is a
  DIFFERENT line that stays.)
- `src/app/api/demo/kernel/route.ts:67` — `'x-forwarded-for'` string literal in a header
  **deny-list array** (strip-list, defense-in-depth; NOT a derivation).
- `src/lib/demo-rate-limit.ts` — `x-forwarded-for` only in **docstring comments** (it imports +
  re-exports `getClientIp`; no derivation).
- Any pure comment occurrences.

**The handoff's done-check ("returns ONLY rate-limit.ts + auth/callback") would FALSE-FAIL on
correct code** (it omits the other 7 audit captures + the 2 demo files). **The PRIMARY grep is the
gate** because it is invariant to how many audit captures exist; the SECONDARY is the human
allow-list sanity check. The implementer records the exact expected SECONDARY set and the audit
re-verifies both.

### 5.2 Forced-edit completeness
A literal follow of §4 yields GREEN suites in BOTH packages at the NEW baseline:
- The **2** sentinel test edits (§1.5) are the ONLY forced route-test changes; all other
  identifier-pinning tests are value-stable (§1.5).
- (E) edits are confined to `settlement-moat.test.ts`'s `processDataExport` describe block.
- `packages/mcp`: untouched, no SDK rebuild.
- Expected post-change: apps/web **0 failed / 4250 pass** (4248 baseline + (E)'s 2 new cases; the
  2 sentinel edits + the (E) rewrite are modifications, not additions) / **179 test files**
  (unchanged — (E) adds cases to existing `settlement-moat.test.ts`, the 2 sentinel edits modify
  existing files; NO new test file) — exact counts recorded at §6 close. tsc 0, eslint 0 (changed
  files), next build 0.

---

## 6. No-regression invariants (correctness lens for an off-funds chunk)

- **No legitimate caller is newly limited / un-limited:** the migration changes ONLY the
  IP-DERIVATION expression. No `checkRateLimit` call is added, removed, or re-keyed by PREFIX;
  every limiter object + number is unchanged. The only value deltas are §1.4 (i)/(ii)/(iii) —
  all no-ops on Vercel; (i) is a one-time anonymous-bucket re-key.
- **No identifier collision / cross-bucket merge introduced:** prefixes are untouched, so two
  routes never share a bucket; within a route, `getClientIp` is a function of the same headers
  the inline code read, so distinct clients keep distinct keys (and on Vercel the value is
  identical to before).
- **The settlement spine is untouched:** in the §7.2 spine-diff set, only the ip-derivation +
  import lines change (panel-verified hunk-by-hunk). No writer call site, no settle/verify/
  dispatch logic, no enforce-exact, no response shape changes. `git diff --stat` shows NO
  `lib/settlement/*` file except `compliance.ts` (guard + docstring).
- **(E) idempotency + retention:** `completed` re-runs are no-ops (return stored URL); `failed`
  retryable with the §1.6 proof; `processing` guarded. No funds move (export is read-only on
  developer data; financial tables are not deleted/altered).
- **Privacy:** no new log carries PII; the (E) `data_export_already_completed` log carries only
  `exportId` (existing practice). The migration adds no logs.

---

## 7. Verification + post-build panel

### 7.1 Gates (handoff §9)
`cd apps/web`: `npx tsc --noEmit` (0 — **the receiver-name gate: any `req`-named file emitting
`getClientIp(request.headers)` is TS2552 here**) · `npx vitest run` (**0 failed / 4250 pass**) ·
`npx eslint <changed files>` (0) · `npx next build` (0; NOT concurrent with tsc) · the §5.1
done-check greps (PRIMARY derivation-grep EMPTY; SECONDARY allow-list matches) · a U5 spot-check
`rg -n "getClientIp\(request\.headers\)" <the 6 U5 files>` returns EMPTY (they must use
`req.headers`). **PLUS** `cd packages/mcp && npx vitest run` (1896/1 skip, untouched — no SDK
rebuild). No migration to generate. DB-affecting (E) behavior proven with the REAL
`processDataExport` (the moat rig drives the real function, not a mocked writer).

### 7.2 Post-build security/regression panel (MANDATORY before commit — handoff §7, off-funds shape)
Adapt `.audit/h1-postbuild/security-panel.mjs` → `.audit/m-postbuild/`. **A green suite is NOT
sufficient.** Lenses (each re-derives against the actual diff):
- **(a) spine-line diff lens (the named requirement):** in EVERY settlement-surface route file,
  ONLY the ip-derivation + `getClientIp` import lines changed — writer call sites, settle/verify/
  dispatch logic, enforce-exact, identifier templates, response shapes BYTE-IDENTICAL
  (hunk-by-hunk). **The spine-diff set is the explicit AUTHORITATIVE UNION below (NOT a single
  grep — no one grep captures it cleanly: `payouts/{trigger}`+`cron/process-payouts` import
  `processPayout` from `@/lib/payouts/process` (a `@/lib/settlement/*` grep misses them), and
  `payouts/schedule` imports no settlement symbol at all):**
  `proxy/[slug]`, `circle-nano/{settle,verify}`, `ap2/{settle,verify}`,
  `sessions/{route,[id]/route,[id]/hop,[id]/finalize,[id]/complete,[id]/delegate}`,
  `x402/{supported,verify,settle}`, `x402/facilitator/v1/{settle,verify,supported}`,
  `cron/{process-payouts,settlement-reconcile,expire-sessions}`, `payouts/{trigger,schedule}`,
  `billing/webhook`, `settlements/[id]`, `sdk/{meter,meter-with-metadata}` (direct balance
  writers), `outcomes/[id]/verify`. **Cross-check grep (a SUPERSET helper, not authoritative —
  reconcile against the union):**
  `rg -l "recordSettlementEntry|creditSettlement|markSettlement|settleExact|verifyExact|verifyOutcome|consumerToolBalances|@/lib/metering|@/lib/settlement/(sessions|ledger|reconcile|payouts|x402|circle-nano|outcomes)" $(cat /tmp/migration-set.txt)`
  (≈32 files — it ADDS settlement-READERS like `consumer/{balance,budget}` (harmless extra
  byte-verification) but MISSES the 3 payout-process importers above, which the union restores).
  All union files are in the 208 migrated set and migrate via clean U1/U2/U4/N1 recipes regardless
  — the lens changes NONE of them beyond the recipe. **Pure ADDITIVE verification breadth**; the
  handoff's "7" undercounted what to byte-verify, not the change scope.
- **(b) value-delta lens:** the §1.4 deltas are the ONLY behavioral changes; each is bounded +
  no-op on Vercel; no caller wrongly limited; the U4 residual-split proof holds; no `'unknown'`
  path survives where `'unknown-ip'` was intended.
- **(c) no-protection-lost lens:** diff-audit ALL `checkRateLimit`/`checkTieredRateLimit` call
  sites — none removed, re-keyed by prefix, or limiter-swapped.
- **(d) completeness lens:** the done-check greps (§5.1) hold; the 2 sentinel test edits pin the
  new value; no inline derivation residual outside the allow-list; `firstHopIp` fully removed +
  all call sites repointed.
- **(e) (E) lens:** export idempotent (no-op on `completed`), retry-safe on `failed` (§1.6 proof
  re-derived), `processing`-guarded; retention/financial tables intact; no txn-shape confusion
  with deletion.
- **(f) scope-regression lens (§3):** `git diff` confined to the §2 file set; byte-stable
  surfaces untouched; no growth-vector crept in.
Adversarial verify every finding (≥1 fresh refuter; default "refuted" unless a concrete trace
proves it real). Verdict **PASS / 0 blocking** before the founder-gated, path-scoped LOCAL commit
(no push, no prod env, no migrations), with §3 applied to panel findings too.

---

## 8. Sequencing
Pre-flight ✓ (done) → Step-0 ✓ (M+E, option i) → trace ✓ (this plan) → **PRE-BUILD AUDIT until
PLAN_READY, all fixes applied (handoff §6)** → implement single-writer (the ~189 blind files in
batches by directory, then the 7 named files, then (E), then the 2 sentinel edits) → post-build
verify (§7.1) → **post-build panel (§7.2) PASS/0 blocking** → founder-gated local path-scoped
commit + capstone/register/memory updates → (push + any prod action remain FOUNDER-GATED).
