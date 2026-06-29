# SEAL RECORD — public-surface-xss (launch-gate chunk #2) — 2026-06-28

**Status: ② SEAL-GATING REVIEW PASSED — SEALED (pending operator `/seal-go` + commit). Claude cannot self-seal.**
Closes **G2-1** (stored XSS) and **G2-3** (open redirect) in `LAUNCH-GATE-roadmap-2026-06-27.md`.
Built to the REVISED handoff `public-surface-xss-handoff-2026-06-28.md` (incl. its §0 plan-audit folds).
The ② review (3 integrator-folded fixes + findings disposition) is recorded in **§6** below.

> Roadmap-box ticking (G2-1 / G2-3 ☐→☑) + `.claude/launch-gate-check.sh` + the commit are **post-②
> seal actions** and are intentionally NOT done in this build session (no silent green; a blocker is
> GREEN only with committed/cited evidence). This record is the readiness handoff + evidence for ②.

---

## 1. WHAT SHIPPED (by handoff scope item)

### G2-1a/b — Centralized `safeJsonLd` + migrate EVERY ld+json sink + whole-file grep-guard
- **New `apps/web/src/lib/json-ld.ts`** — `safeJsonLd(obj)` = `JSON.stringify(obj).replace(/</g, '<')`,
  body copied verbatim from `learn/academy/[slug]/page.tsx:39` (the unicode `<` escape, NOT a no-op
  `<`, NOT `&lt;`).
- **Migrated all 71 raw `__html: JSON.stringify(...)` ld+json sinks across 45 files → `safeJsonLd(...)`**
  (incl. the one non-page sink `app/layout.tsx` multi-line literal, and the framework/explore/claim
  sinks named in G2-1). Re-enumerated live (`git grep` + whole-file perl) — count matched the floor.
- **Collapsed the divergent local escapers to the shared import:** the two academy local helpers
  (`learn/academy/[slug]/page.tsx` `safeJsonLd`, `learn/academy/page.tsx` `safe`) and the inline escape
  at `marketplace/trending/page.tsx:234` (`JSON.stringify(jsonLd).replace(...)`).
- **Whole-file grep-guard** `apps/web/src/__tests__/json-ld-sink-guard.test.ts`:
  - Negative tripwire: every `src/**/*.{ts,tsx}` (excl. `lib/json-ld.ts` + the guard itself) must contain
    NO `/__html:\s*JSON\.stringify\(/` (whole-file regex → catches multi-line sinks; line-independent).
  - Positive guard: every `type="application/ld+json"` script must have a matching `safeJsonLd(` call
    (catches a future sink that serializes via something OTHER than `JSON.stringify`).
  - **Prove-fails-first (no destructive revert):** authored + run BEFORE migration → RED, 45 offender
    files / 71 sinks. After migration → GREEN.
  - **Teeth verified:** a planted raw sink in a throwaway file was caught by BOTH checks; probe removed.
- **`safeJsonLd` unit test** `apps/web/src/lib/__tests__/json-ld.test.ts`: security clause
  (`</script>` breakout neutralized, no surviving `<`) + DIRECT `JSON.parse` round-trip (no manual
  un-escape) — both load-bearing (a no-op helper fails clause 1, a `&lt;` helper fails clause 2).

### G2-1c — FIXED the live embed.js stored XSS
- `apps/web/src/app/api/badge/embed.js/route.ts`: replaced `escapeJsString` (escaped only `\ ' " \n` —
  wrong context) with a shared-pattern **`escapeHtml`** (`& < > " '`, mirroring
  `api/widget/[slug]/route.ts:13`) for every value landing in `c.innerHTML`: tool `name`, `description`,
  `price`, `calls`, the `toolUrl` href slug, and the element-id slug. HTML-entity output is also safe
  inside the wrapping single-quoted JS string (entities carry no quote/backslash/newline), so one
  escaper covers both contexts.
- **Test** `apps/web/src/app/api/__tests__/badge-embed-xss.test.ts`: a tool named
  `<img src=x onerror=alert(1)>` is served as `&lt;img …` (no raw `<img`); desc, slug-quote, and the
  benign-passthrough cases too.
- **FOLD (beyond the literal handoff list — the kickoff designates the list a floor):** the not-found
  diagnostic at `:82` echoed the raw `?tool=` param into a JS block comment (`/* … "${slug}" … */`),
  a `*/`-breakout. Now charset-restricted via `safeSlugForComment`. **Exploitability is LOW** (no internal
  page embeds `embed.js` with a user-controlled `?tool=` — purely a third-party embed surface, so it is
  outside the documented stored-data-in-legit-embed threat model; a legit embedder controls their own
  `?tool=`). Folded because it is a real injection in the exact file being hardened. ② may re-scope.

### G2-1d — Markup-route class guard + sanitizeHighlight audit + markdown invariant
- **sanitizeHighlight audit** (`meilisearch-client.ts:37`, rendered via `dangerouslySetInnerHTML` in
  `components/templates/SearchBar.tsx:120,131`): string-predicate bypass test added to
  `src/__tests__/meilisearch-client.test.ts` — for each adversarial input "bypass" ⇔ output STILL matches
  `/<(?!\/?mark\s*>)[^>]*>/i`. Cases: `<svg/onload=1>`, unclosed `<img onerror=1` at EOS, `<<mark>`,
  `<mark x=">" onerror=1>`, newline-in-tag, uppercase, `<marker …>`. **NO bypass found** → added as
  passing tests, NO hardening (pipeline unchanged, per FROZEN list).
- **renderMarkdownBody invariant** (`components/blog/markdown-renderer.tsx`, `allowDangerousHtml:true`):
  verified the only `MarkdownRenderer` JSX callers are `learn/academy/[slug]` + `learn/blog/[slug]`
  (the `error.tsx` hit is a comment mention, not a caller), and the body sources never read DB/network
  (`git grep supabase|fetch(|createClient` over `academy-bodies`/`blog-bodies` → empty). Added a
  TRUST-INVARIANT comment (callers MUST pass trusted in-repo markdown; DB/user bodies require
  `rehype-sanitize`). **No code change.**
- **Markup-route class checklist (manual, per handoff allowance — these are safe-today + FROZEN):**
  | route | sink | escaper | status |
  |---|---|---|---|
  | `api/badge/embed.js` | `c.innerHTML` | `escapeHtml` (this build) | FIXED |
  | `api/widget/[slug]` | HTML string | `escapeHtml` | safe |
  | `api/badge/tool/[slug]` | SVG text | `escapeXml` | safe |
  | `api/badge/dev/[slug]` | SVG text | `escapeXml` | safe |
  | `api/feed`, `api/support`, `learn/academy/rss.xml` | XML/markup | `&lt;`-escape | safe |
  A future regression in any of these is the documented follow-up (full escaper-centralization → shared
  util is a noted, not-now item).

### G2-3 — ONE redirect validator applied to all three sinks
- **New `apps/web/src/lib/safe-redirect.ts`**: `isSafeRelativePath(raw)` (the load-bearing 3-clause
  predicate — single leading `/`, not `//`, not `/\` — plus a control-char/CRLF defense-in-depth check)
  and `safeRelativePath(raw, fallback='/dashboard')`.
- Applied to **all three** sinks:
  1. `auth/callback/route.ts:95` — `const next = safeRelativePath(searchParams.get('next'))` (before the
     `${origin}${next}` construction at `:101`).
  2. `(auth)/login/page.tsx:44` — `safeRelativePath(searchParams.get('redirect'))` (the primary
     email/password login path — the live twin the §0 audit folded).
  3. `onboarding/continue-button.tsx` — the drifted local path-branch (which omitted the `\` clause) now
     delegates to `isSafeRelativePath`; the Stripe-host HTTPS branch is preserved (it legitimately
     redirects to `connect.stripe.com`). Eliminates the SEAM divergence at root.
- **Pure-function unit matrix** `apps/web/src/lib/__tests__/safe-redirect.test.ts`: `@evil.com`,
  `.evil.com`, `//evil.com`, `/\evil.com`, `https://evil.com`, leading tab/newline, embedded CRLF, ``,
  `null`/`undefined` → `/dashboard`; `/dashboard`, `/settings?tab=1`, `/`, `/path#frag` kept.

---

## 2. GATE EVIDENCE (build-runner; run from `apps/web`)

| command | exit | result |
|---|---|---|
| `npx tsc --noEmit` | **0** | clean |
| `npm run lint` | **0** | **0 errors** (pre-existing warnings only: `<img>`, react-hooks deps, unused eslint-disable; none in changed files) |
| `npx vitest run` | **0** | **213 test files passed · 4895 tests passed · 0 failed** |

New/changed security tests (all GREEN): `json-ld-sink-guard` (3), `json-ld` (4), `badge-embed-xss` (5),
`safe-redirect` (17), `meilisearch-client` (24, incl. 8 new adversarial). settlegrid-agents UNAFFECTED
(no files touched outside `apps/web`).

> Independent fresh-context verifier digest: **see §4** (appended after the verifier re-ran the gate).

---

## 3. CHANGE MANIFEST

- **New (6):** `lib/json-ld.ts`, `lib/safe-redirect.ts`, `__tests__/json-ld-sink-guard.test.ts`,
  `lib/__tests__/json-ld.test.ts`, `lib/__tests__/safe-redirect.test.ts`,
  `app/api/__tests__/badge-embed-xss.test.ts`.
- **Modified (53):** 45 ld+json migrations + 2 academy helper-collapses + `marketplace/trending` (in the
  45) + `api/badge/embed.js/route.ts` + `auth/callback/route.ts` + `(auth)/login/page.tsx` +
  `onboarding/continue-button.tsx` + `__tests__/meilisearch-client.test.ts` + `markdown-renderer.tsx`.
- **No net change:** `vitest.config.ts` (a temporary loader-plugin experiment was fully reverted — see
  the build note below).
- **NOT touched by this build (pre-existing uncommitted deltas — do NOT attribute):**
  `(dashboard)/dashboard/tools/page.tsx` (slugify), the SECURITY-INCIDENT doc, `.claude/`, the other
  `docs/tech-debt/*` untracked files, `scripts/mfa-delete-smoke.sh`.

**Build note (transparency):** a `*/` accidentally embedded in a new embed.js JSDoc comment closed the
block comment early and broke the file's parse — initially mis-read as a Vite `.js`-directory loader
quirk; a temporary `vitest.config.ts` plugin was added while diagnosing, then the real cause (the `*/`)
was found and fixed, and the plugin fully reverted. `vitest.config.ts` has zero net diff. This bug would
also have failed `tsc`; it is fixed and the gate is green.

---

## 4. INDEPENDENT VERIFIER DIGEST

Fresh-context verifier (separate agent; re-ran the gate itself — gate-runner ≠ verifier):
- `npx tsc --noEmit` → **TSC_EXIT=0**
- `npm run lint` → **LINT_EXIT=0**, **0 `Error:` lines** (warnings only — acceptable)
- `npx vitest run` → **VITEST_EXIT=0** · **213 test files passed · 4895 tests passed · 0 failed · 0 skipped**
- Focused security files: `json-ld-sink-guard` 3 · `json-ld` 4 · `badge-embed-xss` 5 · `safe-redirect` 17
  · `meilisearch-client` 24 → **53 passed**
- **VERDICT: GATE GREEN** (TSC=0 ∧ LINT=0 ∧ 0 lint errors ∧ VITEST=0 ∧ 0 failures)
- Method note: the verifier captured exit codes via `$?` on un-piped commands (this env's zsh returns
  empty `${PIPESTATUS[0]}`), so the exit codes are real and not masked by `tail`.

## 5. DEFERRED / FOLLOW-UP (flagged, not fixed)
- **embed.js `:82` not-found JS-comment echo** — folded + fixed THIS build (see G2-1c); recorded here in
  case ② prefers to re-scope it out.
- **`api/dashboard/developer/data-export/[id]/route.ts:71`** `NextResponse.redirect(exportRecord.resultUrl)`
  — dormant `else` branch, server-set + auth/ownership-gated value; not exploitable today. Future
  follow-up (per handoff NOTE).
- **Full escaper-centralization** (5 bespoke markup escapers → shared utils) — noted follow-up, NOT now.

---

## 6. ② SEAL-GATING REVIEW OUTCOME — 2026-06-28 — ✅ PASSED (SEALED, pending `/seal-go`)

**Tier:** HIGH-STAKES (re-confirmed against the realized diff: security boundary — stored XSS +
open redirect; launch gate G2-1/G2-3). NOT escalated — no frozen surface touched. Since high-stakes,
② is NOT terminal: ③ post-seal deep audit follows.

**Gate (independently re-run FROM SCRATCH this session):**
- Build digest re-confirmed: `tsc 0 / lint 0 (0 errors) / vitest 213 files · 4895 passed`.
- Post-fix digest: `tsc 0 / lint 0 (0 errors) / vitest 213 files · 4896 passed` — Δ +1 = the new
  embed.js newline-regression guard (F1 test), fully accounted → the gate ran on the fixed code.

**Orchestration / policy:** 5 decorrelated fresh-context Agent-tool lenses + an integrator-run
hostile-input battery (script), all `claude-opus-4-8[1m]` @ **HIGH** (xhigh/max target UNMET —
PATH 1 unavailable: no `.claude/agents` effort-bearing defs + the Agent tool exposes no effort param;
HIGH is the policy floor → valid; recorded per the effort report-back guard — each lens reported its
own model+effort). Env traps unset (no `CLAUDE_CODE_EFFORT_LEVEL/SUBAGENT_MODEL/FORK_SUBAGENT`).
Allowlist GREEN (git/tsc/vitest/lint). Operator chose Agent-tool @ high over a workflow (allowlist-GREEN
moots the loud-pause edge; Path-1 absent → a workflow can't realize a mixed-effort/max core lens anyway).
Lenses: (1) security core-invariant (XSS/redirect inventory completeness + primitive correctness),
(2) test-teeth/literal-execution, (3) spec-conformance, (4) SEAM, (5) scope/frozen+commit-hygiene.

**Cross-lens verdict:** security moat **INTACT** — no reachable XSS or open redirect (L1); all 5 spec
items DONE (L3); no toothless test — completeness guard proven RED on a planted sink, reverted via
inverse edit (L2); frozen surfaces clean + the embed.js `safeSlugForComment` fold justified-and-in-scope
(L5). **Zero HIGH findings.**

### Fixes folded by the integrator (each live-reproduced fail-then-pass; DC-17 inverse-edit only — no `git checkout/restore/stash`)

- **F1 [MED] — embed.js availability REGRESSION (converged SEAM L4 + security L1).** The build swapped
  `escapeJsString` (escaped `\ ' " \n`) for `escapeHtml` (`& < > " '` only). The values are consumed
  in a DUAL context — HTML assigned to `c.innerHTML`, itself a single-quoted JS string literal in the
  served `.js`. `escapeHtml` passes `\`/`\n`/`\r` through, so a tool name/description containing a
  newline emitted a raw line break inside the `'…'` literal → **SyntaxError → the badge silently
  failed to render on every embedding site**. NOT XSS (quotes are entity-escaped). **Reproduced live:**
  `new Function(servedJs)` threw `SyntaxError` for a newline name (XSS still neutralized). **Fix:**
  `escapeHtml` now appends `.replace(/\\/g,'\\\\').replace(/\n/g,'\\n').replace(/\r/g,'\\r')` AFTER the
  5 HTML replaces (entity output has no backslash, so order is safe) — one escaper correct for both
  layers; doc comment rewritten (the old "one HTML-escape covers both contexts" reasoning was false).
  This also closes L1's backslash-in-stored-slug defense-in-depth note (a `\` at the id string's end
  is now `\\`-escaped). **Test added:** `badge-embed-xss.test.ts` — newline/backslash/CR name ⇒
  `new Function(js)` does not throw + the newline is serialized as `\n`. Post-fix repro: PASS.
- **F2 [MED] — completeness-guard sanity floor too loose (L2).** `json-ld-sink-guard.test.ts` is the
  chunk's DC-16 antidote, but its walk-sanity was `SOURCE_FILES.length > 100` while the real tree is
  **914 files (app/ subtree = 548, non-app = 366)**. A regression that silently dropped the entire
  sink-dense `app/` subtree from the walk would leave 366 files and still pass `>100` — defeating the
  very completeness the guard exists to enforce. **Reproduced:** non-app count 366 > 100 (false-pass
  demonstrated). **Fix:** floor raised to `> 800` (914 passes today; an app/ drop → 366 < 800 fails;
  headroom for ordinary churn). Mechanical constant change → reduced re-review.
- **F3 [LOW] — surviving redundant double-escape (converged L1 + L3 + L4).**
  `mcp/[owner]/[repo]/page.tsx:141` was `safeJsonLd(jsonLd).replace(/</g,'<')` — a no-op
  (`safeJsonLd` already replaced every `<`) but a *surviving local escaper* the G2-1a migration claims
  to have collapsed, contradicting `json-ld.ts`'s "single source of truth" doc. **Fix:** removed the
  redundant `.replace` + the now-stale comment → clean `safeJsonLd(jsonLd)`. Tree grep confirms zero
  surviving inline `.replace` on `safeJsonLd` anywhere in `src`. Mechanical → reduced re-review.

### Findings disposition — accepted / documented as follow-ups (LOW, non-blocking; spot-reproduced)

- **claim-button.tsx:70** `router.push(data.redirectUrl)` is not run through `safeRelativePath` (SEAM
  parity gap vs the onboarding defense-in-depth gate). NOT exploitable today: `/api/tools/claim` returns
  a server-side constant (`redirectUrl: settingsUrl`, route :218), not an attacker value. Not named in
  the handoff's three-sink scope. → **follow-up parity** (alongside data-export below).
- **data-export/[id]/route.ts:71** `NextResponse.redirect(exportRecord.resultUrl)` — dead `else`
  fallback "for future external storage"; today `resultUrl` is gated `data:application/json;base64,`
  and is a system-generated, ownership-gated DB value. → **follow-up** (already noted §5).
- **sanitizeHighlight** (`meilisearch-client.ts`) — pre-existing regex tag-stripper; audited, NO bypass
  found (the predicate is the sanitizer's own regex, so it's a same-sink oracle — the unclosed-tag case
  is browser-safe because the sink feeds the COMPLETE innerHTML at parse-EOF). Pipeline FROZEN, unchanged.
  → **follow-up** consider entity-encoding/DOMPurify if this output is ever concatenated before innerHTML.
- **json-ld-sink-guard positive check** is a per-file count heuristic; a bespoke-serializer sink could
  slip past it if the file independently has ≥ as many `safeJsonLd(` calls. Closed TODAY by the pre-build
  audit (no bespoke serializers exist). → documented known-limitation.
- **Stripe `checkoutUrl`/`portalUrl`** sinks (settings/credits/buy-credits) assign server-supplied
  Stripe-SDK URLs to `window.location.href` without the onboarding-style gate — pre-existing, trusted
  source, out of scope. → noted.
- **compare/nevermined `isSafeSourceUrl`** — a *different* primitive (static curated citations,
  deliberately permits cross-origin https); correctly NOT unified with `isSafeRelativePath`.

### COMMIT-HYGIENE — explicit include / exclude for the operator's `/seal-go` commit (use an explicit pathspec, NOT `git add -A`)

**COMMIT (this chunk — 8 new + 53 modified, all under `apps/web/src` except the 2 intended docs):**
- New: `apps/web/src/lib/json-ld.ts`, `apps/web/src/lib/safe-redirect.ts`,
  `apps/web/src/__tests__/json-ld-sink-guard.test.ts`, `apps/web/src/lib/__tests__/json-ld.test.ts`,
  `apps/web/src/lib/__tests__/safe-redirect.test.ts`, `apps/web/src/app/api/__tests__/badge-embed-xss.test.ts`,
  `docs/tech-debt/public-surface-xss-handoff-2026-06-28.md`, `docs/tech-debt/public-surface-xss-seal-record-2026-06-28.md`.
- Modified: the ~46 ld+json `page.tsx`/`layout.tsx` migrations + the 2 academy helper collapses +
  `marketplace/trending` + `api/badge/embed.js/route.ts` + `auth/callback/route.ts` + `(auth)/login/page.tsx` +
  `onboarding/continue-button.tsx` + `__tests__/meilisearch-client.test.ts` + `components/blog/markdown-renderer.tsx`
  + `mcp/[owner]/[repo]/page.tsx` (F3).

**EXCLUDE (pre-existing / cross-chunk — do NOT attribute or commit here):**
- `apps/web/src/app/(dashboard)/dashboard/tools/page.tsx` (unrelated slugify feature).
- `docs/SECURITY-INCIDENT-2026-06-15-exposed-pg-credential.md` (incident status edit).
- `.claude/` (cadence-state, workflow, launch-gate-check, settings), `docs/tech-debt/launch-gate-queue.md`,
  `docs/tech-debt/v-n3-mfa-unenroll-hardening-handoff-2026-06-27.md`, `scripts/mfa-delete-smoke.sh`.
- Sibling repo `settlegrid-agents`: untouched (verified clean).

### POST-`/seal-go` actions (operator)
1. `/seal-go` + the explicit-pathspec commit above. 2. Tick **G2-1 / G2-3 ☐→☑** in
`LAUNCH-GATE-roadmap-2026-06-27.md`. 3. Run `.claude/launch-gate-check.sh` (updates the launch_gate
block; GREEN only at 0). 4. Proceed to ③ post-seal deep audit (high-stakes).

### Defect-class ledger (this chunk's recurrences)
- **DC-16 (incomplete-sweep)** — the governing class. ② found two residual incompletenesses of the
  chunk's OWN sweep: F3 (one un-collapsed local escaper) and F2 (the completeness guard's own floor
  too loose to catch a subtree-drop). Both folded. The whole-file grep-guard (now with a tight floor)
  is the durable antidote.
- **SEAM** — F1 (wrong-context escaper: HTML-only escaper used in an HTML-in-JS-string sink → the
  newline regression). Antidote recorded: match the escaper to the FULL consumption context, not just
  the innermost layer.
- **LITERAL-EXECUTION** — clean (all primitives are pure string functions; the guard is fs-text; the
  redirect matrix tests the extracted pure validator; the GET handler stays un-mocked-out).
