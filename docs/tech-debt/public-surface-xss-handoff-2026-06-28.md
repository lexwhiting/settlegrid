# ① BUILD HANDOFF — public-surface-xss — 2026-06-28 (REVISED after pre-build plan audit)

**Launch-gate chunk #2.** Closes **G2-1** (stored XSS, account-takeover grade) and **G2-3** (open
redirect) in `docs/tech-debt/LAUNCH-GATE-roadmap-2026-06-27.md`. Queue: `launch-gate-queue.md` #2.

**TIER: HIGH-STAKES.** Security boundary (stored XSS + auth-redirect), untrusted-input boundaries
(public tool metadata + redirect params), affects a launch gate. The edits are mechanical; the risk
is **COMPLETENESS of the sink/redirect inventory** and **CORRECTNESS of the escape/validation**.

---

## ⚠ 0. PLAN-AUDIT REVISION LOG — read this first (a 5-lens audit materially corrected the plan)

A high-stakes pre-build plan audit (COMPLETENESS · ESCAPE-CORRECTNESS · REDIRECT/AUTH-BOUNDARY · SEAM
· LITERAL-EXECUTION; all claude-opus-4-8 @ high) found **two LIVE vulnerabilities the original
ld+json-only / auth-callback-only scope missed** (the exact incomplete-sweep failure this chunk
targets) and a **no-op escape helper**. The corrections that change what you build:

1. **The escape helper in the first draft was a NO-OP** (`.replace(/</g, '<')` — replace `<` with `<`,
   escapes nothing). The CORRECT, codebase-established escape is the JSON unicode escape. **COPY THE
   HELPER BODY VERBATIM from `apps/web/src/app/learn/academy/[slug]/page.tsx:39`** — it is
   `return JSON.stringify(obj).replace(/</g, '\\u003c')` (the replacement is the six characters
   backslash-u-0-0-3-c; NOT a literal `<`, NOT the HTML entity `&lt;` which would corrupt the JSON-LD
   round-trip). Do not retype it from this document. (`<`→`<` is provably sufficient — §2 G2-1a.)
2. **A LIVE stored XSS outside the ld+json class:** `apps/web/src/app/api/badge/embed.js/route.ts`
   serves JS doing `c.innerHTML='…${name}…${desc}…'` where `name`/`desc` are `tool.name`/
   `tool.description` passed through `escapeJsString` (`:25`, escapes only backslash, quotes, newline —
   **NOT `< > &`**), served `Access-Control-Allow-Origin: *` (`:124`) for cross-site
   `<script src=…embed.js>` embedding. A tool named `<img src=x onerror=…>` executes in every embedding
   site. Wrong-context escaping (JS-string-escaped, HTML-consumed). **Must fix this chunk.**
3. **A LIVE open-redirect TWIN outside auth/callback:** `apps/web/src/app/(auth)/login/page.tsx:44-45`
   `router.push(searchParams.get('redirect') ?? '/dashboard')` — UNVALIDATED, the **primary
   email/password login path**; `?redirect=https://evil.com` → cross-origin navigation after sign-in.
   **Must fix this chunk** (same validator as G2-3).
4. **The grep-guard test design was wrong:** a per-LINE check false-passes the ~23 multi-line JSX
   sinks and a `page.tsx`-only glob misses `layout.tsx:91`. Use a WHOLE-FILE check over all
   `apps/web/src/**/*.{ts,tsx}` (§2 G2-1b).
5. **The auth-callback test matrix was unexecutable** through the un-mockable `GET` handler ("tests
   likely exist" was false — none do). **Extract a pure validator function and unit-test that** (§2 G2-3).

CONFIRMED-CORRECT by the audit (no change): `<`-only escaping is XSS-sufficient; CSP is correctly
out-of-scope (no nonce path exists; escaping is load-bearing); JSON-LD must be inline; the
auth-callback predicate is airtight FOR ITS SINK; the markup sibling routes (feed/badge-tool/badge-dev/
widget/support) already `&lt;`-escape and are safe-today; no HTML-sanitizer lib is in deps.

---

## 1. INTENT
A public launch invites adversaries. Close every reachable public-surface XSS and open-redirect hole
before the funnel reactivates. Consumers: every visitor + every crawler (JSON-LD is SEO data) + every
third-party site embedding the badge. Enables a launch that ships neither an account-takeover XSS nor
a phishing redirect. There is no WAF/CSP backstop (`script-src 'unsafe-inline'`, `middleware.ts:86`),
so escaping at the sink + validation at the redirect are the only defenses.

## ⚠ 1a. THE LOAD-BEARING DECISIONS MOST LIKELY TO BE SILENTLY WRONG
1. **Inventory COMPLETENESS (DC-16 incomplete-sweep — the audit already PROVED this risk real:
   embed.js + login were missed).** The fix MUST be: centralized helpers + **a whole-file grep-guard
   regression test** that fails on any raw sink — covering BOTH the ld+json class AND the redirect
   call-sites — so a missed or future sink can't ship green.
2. **The escape STRING.** `<` (round-trips) — not `<` (no-op) and not `&lt;` (corrupts the
   structured data). Copy from source (§0.1).
3. **Redirect predicate completeness + ONE validator** — reject `//`, leading `\`, require a single
   leading `/`; apply the SAME validator to all three redirect sinks (a third copy already drifted:
   `onboarding/continue-button.tsx isAllowedRedirect` omits the `\` check).

---

## 2. SCOPE — IN

### G2-1a — Centralize `safeJsonLd` and migrate EVERY ld+json sink
- Create `apps/web/src/lib/json-ld.ts` exporting `safeJsonLd(obj: unknown): string`, body **copied
  verbatim** from `learn/academy/[slug]/page.tsx:39` (`JSON.stringify(obj).replace(/</g, '\\u003c')`).
  Escaping `<`→`<` is **provably sufficient**: the HTML tokenizer ends a `<script>` only on a
  literal `</script` (case-insensitively), and the `<!--`/`<script` script-data states also require a
  literal `<`; removing every `<` neutralizes all breakouts. `application/ld+json` is parsed as DATA
  (never executed), so U+2028/U+2029 need not be escaped. Do NOT add `>`/`&` (cosmetic; match the
  `<`-only precedent; avoid gold-plating). Do NOT use `&lt;` (corrupts round-trip).
- Migrate **every** `dangerouslySetInnerHTML={{ __html: JSON.stringify(x) }}` in an
  `application/ld+json` script to `safeJsonLd(x)`. **Re-enumerate live** —
  `git grep -nE 'application/ld\+json' apps/web/src` (pre-flight counted ~75 tags across 47 files;
  most in `app/**/page.tsx`; the ONE non-page sink is `app/layout.tsx:91-94`; the 4 academy sinks are
  already escaped). Collapse the two academy-local helpers (`learn/academy/[slug]:38`,
  `learn/academy/page.tsx:127`) and the inline escape at `marketplace/trending/page.tsx:234` to the
  shared import. Sweep ALL sinks (static included) — uniform + regression-proof.

### G2-1b — XSS regression tests (whole-file; teeth required)
1. **`safeJsonLd` unit test:** `expect(safeJsonLd({x:'</script><script>alert(1)</script>'})).not.toMatch(/<\/script/i)` (the security property), AND `expect(JSON.parse(safeJsonLd(input))).toEqual(input)`
   — **direct `JSON.parse`, no manual un-escape** (the round-trip property; a no-op helper would leave
   a literal `</script` and fail clause 1, a `&lt;` helper would fail clause 2 — so both clauses are
   load-bearing).
2. **Whole-file grep-guard COMPLETENESS test** (the tripwire). Read every
   `apps/web/src/**/*.{ts,tsx}` with `fs.readFileSync` (precedent: `honest-framing-regression.test.ts`,
   `shadow-index.test.ts` do fs-based source assertions) and assert per file
   `expect(src).not.toMatch(/__html:\s*JSON\.stringify\(/)`. (Audit-verified: zero `__html:` sinks use
   any serialization other than `JSON.stringify`, so this is false-positive-free; it is line-independent
   so it catches the ~23 multi-line sinks; the glob is not `page.tsx`-only so it covers `layout.tsx`.)
   EXCLUDE the helper file `lib/json-ld.ts` (its body legitimately contains `JSON.stringify`). Optional
   positive check per file: `count(/application\/ld\+json/) <= count(/safeJsonLd\(/)`.
   **Prove-fails-first WITHOUT a destructive revert:** author + run this test BEFORE the migration —
   the un-built tree already has ~71 raw hits, so it is RED by construction; migrate; re-run GREEN.

### G2-1c — FIX the embed.js stored XSS (the live one)
- `api/badge/embed.js/route.ts`: the values landing in `c.innerHTML` (`name`:88, `desc`:89,
  `price`:90, `calls`:91, the `toolUrl` href:92 and the `slug` in the element id:100,102) must be
  **HTML-escaped** (`& < > "`), not JS-string-escaped. HTML-entity output is also safe inside the outer
  single-quoted JS string (entities contain no quote/backslash/newline), so one HTML-escape covers BOTH
  contexts. Reuse the established `escapeHtml` pattern (`api/widget/[slug]/route.ts:13`) — ideally a
  shared `escapeHtml` util — instead of `escapeJsString` for these. Add a test: a tool name
  `<img src=x onerror=alert(1)>` must appear as `&lt;img …` in the served JS (no raw `<img`).

### G2-1d — Cover the markup-route class with the guard; audit `sanitizeHighlight`; doc the markdown invariant
- The other untrusted-tool-data→markup routes (`api/feed`, `api/badge/tool/[slug]`,
  `api/badge/dev/[slug]`, `api/widget/[slug]`, `api/support`, `learn/academy/rss.xml/feed-builder.ts`)
  already `&lt;`-escape (verified safe-today) — do NOT rewrite them, but extend the guard (or a
  documented manual checklist in the seal record) so a future regression in this class is caught.
  (Full escaper-centralization — five bespoke escapers → shared utils — is a noted follow-up, NOT now.)
- **Audit `sanitizeHighlight`** (`meilisearch-client.ts:37` `html.replace(/<(?!\/?mark\s*>)[^>]*>/gi,'')`)
  for regex bypass on untrusted tool names (search dropdown). Bounded + string-decidable: for each
  adversarial input (`<svg/onload=1>`, an unclosed `<img onerror=1` at end-of-string, `<<mark>`,
  `<mark x=">" onerror=1>`), **"bypass" ⇔ `sanitizeHighlight(input)` STILL matches
  `/<(?!\/?mark\s*>)[^>]*>/i`** (a surviving non-`mark` tag) — assert with vitest. If a bypass is found,
  harden (escape `<>&`, then re-insert the Meilisearch highlight from sentinel markers) + add the case.
  If none, add the adversarial cases as passing tests. Do NOT redesign the search pipeline.
- **`renderMarkdownBody`** (`markdown-renderer.tsx`, `allowDangerousHtml:true`) is SAFE only because its
  two callers feed in-repo bodies. CONFIRM with `git grep -nE 'supabase|fetch\(|createClient' --
  apps/web/src/lib/academy-bodies apps/web/src/lib/blog-bodies` (must be empty) AND
  `git grep -l 'MarkdownRenderer' -- apps/web/src/app` (only `learn/academy/[slug]` + `learn/blog/[slug]`).
  Add a comment asserting the invariant (callers MUST pass trusted in-repo markdown; DB/user-sourced
  bodies require `rehype-sanitize`). No code change.

### G2-3 — Centralize redirect validation; apply to all three sinks
- Create ONE validator, e.g. `apps/web/src/lib/safe-redirect.ts`
  `safeRelativePath(raw: string | null, fallback = '/dashboard'): string`, returning a same-origin
  PATH. Accept `raw` only if ALL hold: `raw.startsWith('/')`, `!raw.startsWith('//')`, and
  `!raw.startsWith('/\\')` (a single leading slash, not protocol-relative, not backslash). Else return
  `fallback`. This rejects `@evil.com`, `.evil.com`, `//evil.com`, `/\evil.com`, `https://evil.com`,
  and any value not starting with a single `/`. **Control chars:** a LEADING control char fails
  `startsWith('/')` → fallback (sufficient — the audit confirmed the 3-clause predicate is airtight for
  the `${origin}${path}` sink); optionally also reject any char with code-point < 32 via
  `[...raw].every((c) => c.charCodeAt(0) >= 32)` as defense-in-depth — but the 3 startsWith clauses are
  the load-bearing guard. Apply to:
  1. **`auth/callback/route.ts:95,101`** — `const next = safeRelativePath(searchParams.get('next'))`;
     redirect to `` `${origin}${next}` ``. (The origin-prefix is the real host-lock; a relative path
     keeps it; the validation must land before the `:101` construction.)
  2. **`(auth)/login/page.tsx:44-45`** — `router.push(safeRelativePath(searchParams.get('redirect')))`.
  3. **`onboarding/continue-button.tsx`** — replace the local `isAllowedRedirect` (which omits the
     backslash check) with the shared validator (or add the `&& !raw.startsWith('/\\')` clause); it
     feeds a bare `window.location.assign`, so the backslash hole is a real (server-input-gated) bypass.
- **Unit-test `safeRelativePath`** as a PURE function (NOT via the un-mockable GET handler): matrix
  `@evil.com`→`/dashboard`, `.evil.com`→`/dashboard`, `//evil.com`→`/dashboard`, `/\evil.com`→`/dashboard`,
  `https://evil.com`→`/dashboard`, a LEADING tab/newline value→`/dashboard`, `/dashboard`→`/dashboard`,
  `/settings?tab=1`→kept, `null`/missing→`/dashboard`.
- NOTE (no fix): `api/dashboard/developer/data-export/[id]/route.ts:71`
  `NextResponse.redirect(exportRecord.resultUrl)` is a dormant `else` branch (server-set value,
  auth+ownership gated) — flag in the seal record for a future follow-up; not exploitable today.

---

## 3. SCOPE — OUT
- **CSP hardening / nonces** — no nonce path exists; escaping is the correct fix (`middleware.ts` CSP
  FROZEN). **G2-2 SSRF** — separate chunk #3. **Full escaper-centralization** of the 5 markup escapers
  — noted follow-up. **Markdown renderer redesign** — correct for trusted content; doc only. No Supabase
  session-exchange / schema / auth-logic changes beyond the redirect validation.

## 4. FROZEN / DO-NOT-PERTURB
- The Supabase `exchangeCodeForSession` flow + the developer/consumer upsert + invite/audit logic in
  `auth/callback/route.ts` (only ADD `next` validation). `middleware.ts` CSP. The JSON-LD object SHAPES
  (only the serialization escape changes). The Meilisearch pipeline (only `sanitizeHighlight` if a
  bypass is proven). The safe-today markup escapers (feed/badge/widget/support) — guard, don't rewrite.

## 5. BUILD SEQUENCE
1. **Read this handoff + the roadmap G2-1/G2-3 rows + `launch-gate-queue.md` #2 first.** Re-enumerate
   live every ld+json sink AND every `NextResponse.redirect`/`router.push`/`location.assign` of a user
   param — this inventory is a floor.
2. `lib/json-ld.ts` `safeJsonLd` (copy the `<` body from `academy/[slug]:39`).
3. **Author + run the whole-file grep-guard test FIRST (RED on the un-migrated tree)**, then migrate
   ALL ld+json sinks → GREEN. Add the `safeJsonLd` unit test.
4. Fix `embed.js` (HTML-escape the innerHTML interpolations) + its test.
5. `lib/safe-redirect.ts` `safeRelativePath` + the pure-function unit matrix; apply to auth/callback,
   login, onboarding.
6. Audit `sanitizeHighlight` (string-predicate bypass test); document the `renderMarkdownBody` invariant.
7. Gate (§6). Self-verify at the kickoff's stated interval with a fresh-context subagent.

## 6. GATE
- From `apps/web`: `npx tsc --noEmit` → 0; `npm run lint` → 0 errors; `npx vitest run` → all pass
  (incl. the `safeJsonLd` unit test, the whole-file grep-guard, the `safeRelativePath` matrix, the
  embed.js escape test, the `sanitizeHighlight` cases). settlegrid-agents UNAFFECTED.
- **Allowlist (verified):** `Bash(npx tsc *)`, `Bash(npx vitest *)`, `Bash(npm run lint)`,
  `Bash(npm test)`, `Bash(git *)` — all present. Env traps unset; no model pin → Opus 4.8. No
  WebFetch/MCP needed (every claim is provable by unit test + code reading; the gate has no live
  browser — do NOT plan manual exploitation).

## 7. SEAL BOOKKEEPING (LAUNCH-GATE — required)
On seal, tick **G2-1 G2-3 ☐→☑** in `docs/tech-debt/LAUNCH-GATE-roadmap-2026-06-27.md`, then run
`.claude/launch-gate-check.sh` (hook updates `cadence-state.json → launch_gate`; GREEN only at 0). Seal
record → `docs/tech-debt/public-surface-xss-seal-record-2026-06-28.md`; record the embed.js + login-twin
folds, the markup-route guard coverage, and the data-export follow-up note.

## 8. DEFECT-CLASS LEDGER (relevant standing classes; no central ledger file — classes live in chunk docs)
- **DC-16b/d (incomplete-sweep) — THE governing risk, already realized once here** (the audit found
  embed.js + login outside the named scope). Antidote: centralized helpers + the whole-file grep-guard
  covering BOTH sink classes. ② must re-confirm the guard actually scans every sink.
- **SEAM** — the escape STRING must match the codebase primitive (`<` at academy:39 +
  `shadow-index.test.ts:155`), not diverge to `<`/`&lt;`; the redirect validator must be ONE helper,
  not a 3rd divergent copy (onboarding already drifted). Wrong-context escaping (JS-escape on
  HTML-consumed data) is the embed.js root cause — match the escaper to the CONSUMPTION context.
- **LITERAL-EXECUTION** — `safeJsonLd`/`safeRelativePath` are pure functions returning strings; the
  grep-guard is fs-text (no DOM); the redirect matrix tests the EXTRACTED pure function (the GET
  handler is un-mockable in the gate); "bypass found" for `sanitizeHighlight` is a string predicate.
- **DC-18b / financial-integrity** — N/A (no money path).

## 9. CHUNK LIFECYCLE
scope-confirm ✓ → draft plan ✓ → **pre-build plan audit (done; this revision folds every sustained
finding)** → build (fresh single-writer agent) → executable gate → ② seal-gating review → seal +
bookkeeping (tick G2-1/G2-3). The kickoff (single fenced block) is the last thing the ① session emits;
the build agent reads THIS file at file-fidelity as step zero.
