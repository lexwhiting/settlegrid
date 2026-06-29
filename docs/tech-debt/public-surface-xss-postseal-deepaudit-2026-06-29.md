# ③ POST-SEAL DEEP AUDIT — public-surface-xss (launch-gate chunk #2) — 2026-06-29

**VERDICT: ✅ RE-CERTIFIED (HARDENED).** The sealed XSS/open-redirect hardening (commit `863f5b2c`)
holds as an integrated whole — zero reachable XSS or open-redirect in the shipped surface, every
load-bearing claim re-verified live. One teeth-strengthening fold landed on the chunk's own
completeness antidote (the json-ld sink-guard). The single REAL finding is a pre-existing, frozen,
out-of-chunk availability gap → follow-up, not folded.

Scope = the INTEGRATED WHOLE at `863f5b2c` (the sealed hardening as it sits in the full app +
crawler + third-party-embed surface), distinct from the ② diff-scoped review.

---

## 1. TIER + ORCHESTRATION

- **Tier: HIGH-STAKES** (re-confirmed): stored XSS (G2-1) + open redirect (G2-3) on untrusted public
  boundaries (tool metadata, redirect params, a `*`-CORS third-party embed), **no CSP/WAF backstop**
  (`script-src 'unsafe-inline'`), launch-gate-bearing. ③ warranted.
- **Orchestration: WORKFLOW (operator-selected)**, per-agent effort. Realized via the Workflow
  `agent()` `effort` parameter — **the capability the ② seal (and the standing policy block) assumed
  did not exist** (② therefore ran at the HIGH floor). 6 decorrelated integrated-whole lenses →
  per-finding adversarial verify → a `max` collective-miss critic, every agent pinned `model:'opus'`.
  Env traps unset (`CLAUDE_CODE_EFFORT_LEVEL/SUBAGENT_MODEL/FORK_SUBAGENT` all UNSET); allowlist GREEN
  (git/tsc/vitest/lint). All agents self-reported `claude-opus-4-8[1m]`; self-reported effort `high`
  (per-agent `xhigh` was requested — effort self-report is model-unreliable; HIGH is the valid policy
  floor regardless). 28 agents, ~1.04M subagent tokens, ~31 min.
- **Workflow partial failure (recovered):** the final `max` collective-miss critic exhausted the
  StructuredOutput retry cap (5×) and the run errored AFTER all 6 lenses + all 21 verifies completed.
  Per the charge's transport-failure rule, the completed parts were integrated by hand from the run
  journal (`wf_8cac1db3-c3d/journal.jsonl`), every load-bearing claim re-run live in the main session,
  and the collective-miss pass run by the integrator (this session) — see §5.

## 2. MECHANICAL PRE-FLIGHT (scripted, fed to the lenses)

- **Gate GREEN from scratch (pre-fold):** `tsc 0 / lint 0 (0 errors) / vitest 213 files · 4896 passed`
  — matches the sealed digest exactly (gate ran on the committed code).
- **Invariants re-derived clean:** safeJsonLd body = `JSON.stringify(obj).replace(/</g,'<')`
  verbatim vs the academy:39 precedent; **0** raw `__html: JSON.stringify(` sinks; **0** surviving
  inline `.replace` chained on `safeJsonLd(`; **81** `application/ld+json` tags ↔ **81** `safeJsonLd(`
  calls; all 3 redirect sinks (auth/callback:99, login:47, onboarding:39) route through the one
  validator; the onboarding SEAM drift (missing `/\` clause) is closed; `escapeJsString` survives only
  in a doc comment.
- **Hostile-input battery 147/0** (helper bodies replicated verbatim): safeJsonLd breakout +
  round-trip; isSafeRelativePath cross-origin-reject / same-origin-keep / `${origin}${next}`
  origin-lock; embed.js dual-context XSS-neutralization + served-JS parse-validity.

## 3. LENS RESULTS (6 lenses, 21 findings: 1 MED · 9 LOW · 11 INFO) → VERIFY (20 REFUTED · 1 REAL)

Coverage-mode reporting (no self-filtering); the live-reproduction + adversarial-verify steps are the
filters. **Zero findings indict the shipped XSS/redirect defenses.** Headline dispositions:

### 3a. The headline MED — REFUTED by live test (the audit's key catch)
**`javascript:` URL stored-XSS in unguarded `<a href={entry.sourceUrl}>` on the public
`mcp/[owner]/[repo]` page** (`page.tsx:164,269`) — a sink **class** (URL-protocol injection in
rendered hrefs) the sealed entity/JS-string escaping never covered; `entry.sourceUrl` is crawled
(Smithery `homepage`, pulsemcp `github_url`) and unvalidated at the write boundary; the sibling
`claim` page guards the identical field via `isSafeRepoUrl`. The XSS-completeness lens (running at the
HIGH floor) asserted *"React 19 does not sanitize `javascript:` hrefs."*
- **REFUTED — live-reproduced this session** against the installed **react/react-dom 19.2.4**
  (`renderToStaticMarkup` with the exact JSX): every `javascript:` variant (mixed-case, leading
  spaces, embedded `\t`/`\n`, leading ``) is **sanitized** to
  `javascript:throw new Error('React has blocked a javascript: URL as a security precaution.')`. The
  page is also `dynamic='force-static'` + `dynamicParams=false` (page.tsx:13-14) → non-prebuilt slugs
  404. `data:` → href-attribute-escaped + top-level-nav blocked + opaque origin; `vbscript:` → legacy
  IE only. **No reachable XSS.**
- **Residual (LOW, DiD):** the mcp `Source` link (and the admin HN link) render arbitrary external
  URLs with no host/protocol allowlist, unlike the claim page's `isSafeRepoUrl` — a phishing/DiD
  consistency gap (e.g. `vbscript:`, `/\evil.com` render as-is), **not an XSS**. → §6 follow-up.

### 3b. The ONE REAL finding (verdict#6, LOW) — frozen, out-of-chunk → NOT folded
**`/api/feed` `escapeXml` omits the C0-control-char strip** the academy `feed-builder` has
(`stripInvalidXmlChars`). Confirmed live: a developer can publish a tool whose name/description
carries a JSON-escaped form-feed/C0 control (Zod min/max only) → `GET /api/feed` emits raw U+000C →
XML-1.0-illegal → conforming RSS readers reject the whole feed (cross-tenant availability, **not
XSS**). Reachable end-to-end. **NOT folded:** `api/feed/route.ts` is NOT in the sealed diff and the
handoff (§2 G2-1d, §4) froze the markup-route escaper class; the deep-audit charge forbids perturbing
an unauthorized frozen surface. → §6 follow-up (consolidate with escaper-centralization).

### 3c. Other findings — all REFUTED / latent-non-exploitable (representative)
- **isSafeSourceUrl (compare/nevermined) missing the `/\` clause** — REFUTED: page is fully static
  (no searchParams/db/headers), `sourceUrl` is 100% curated in-repo data; unreachable. Latent parity
  nit. → §6.
- **sanitizeHighlight unclosed-tag bypass** ("contradicts the chunk's 'no bypass found'") — REFUTED on
  two grounds: (1) parse5 confirms an unterminated `<img …` (no `>`) instantiates **zero** elements
  (eof-in-tag discards the token) so `onerror` cannot fire, while the closed `<img …>` variant **is**
  stripped — the two conditions are mutually exclusive, so the sanitizer is sound for this innerHTML
  sink; (2) source is in-repo `registry.json` (trusted). The chunk's "no bypass" conclusion holds; the
  reachability rests on an undocumented trust assumption → §6 doc note.
- **escapeXml 4-replace (SVG badge) vs 5-replace (RSS)** — REFUTED: locally correct (user data only in
  double-quoted attrs / text nodes; `'` valid unescaped there). Naming/maintenance seam. → §6.
- **safeJsonLd throws on top-level `undefined`/BigInt/circular** — REFUTED: no caller passes a scalar;
  availability-only robustness nit.
- **embed.js does not escape U+2028/U+2029** (flagged by 3 lenses) — REFUTED: availability-only on
  **pre-ES2019** engines (all current browsers treat them as legal in string literals); never XSS
  (`'`→`&#39;`, `<`→`&lt;`). Declined as gold-plating an out-of-support edge (handoff §0 anti-gold-
  plating stance). → §6 optional note.
- **json-ld-sink-guard** test-robustness (extension scope / count heuristic / partial-subtree floor) —
  the actionable two were FOLDED (§4); the count-heuristic non-literal-type-attr evasion (#4) is
  documented known-limitation (covered by RAW_SINK + the no-bespoke-serializer audit fact).
- **Replicated JSON-LD escape in 2 tests** (shadow-index, academy-lessons) — REFUTED: the canonical
  `json-ld.test.ts` imports the real helper and catches both no-op and `&lt;` regressions; redundant,
  not false coverage. → §6 test-quality note.
- **Cross-chunk:** auth/callback FROZEN logic byte-identical (exchangeCodeForSession, dev/consumer
  upsert, invite/audit); only line 99 (next source) changed; all 4 redirect branches same-origin;
  V-N3 MFA/deletion step-up is API-based and does NOT route through `/auth/callback?next` → unaffected;
  every ld+json migration is serialization-only (object shapes preserved); markdown-renderer
  comment-only; meilisearch source untouched. **No cross-chunk regression.**
- **DC-18 financial-integrity:** `git show --stat 863f5b2c` filtered for money/settlement/x402/circle/
  facilitator → **no matches**. Clean.

## 4. HARDENED FOLD (the only change this audit landed) — live fail-then-pass

**`apps/web/src/__tests__/json-ld-sink-guard.test.ts`** — the chunk's DC-16 incomplete-sweep antidote.
Its own contract (header: "this guard reads EVERY source file … a future regression cannot ship
green") was not fully honored:
1. **Extension scope:** the walk collected only `.ts/.tsx`. **Live-reproduced the blind spot:** a
   planted `src/__plant__/ld-sink.jsx` raw ld+json sink → the **shipped** guard PASSED 3/3 (false-pass,
   the exact incomplete-sweep failure mode). **Fix:** `collectSourceFiles` now covers
   `.ts/.tsx/.js/.jsx/.mjs/.cjs/.mdx`. Post-fix, the same plant FAILS both the RAW_SINK and the
   safeJsonLd-count assertions; plant removed → GREEN. (Vacuous today — `find` confirms **0**
   non-`.ts/.tsx` files under `src/` — but it now honors the guard's future-regression contract.)
2. **Partial-subtree drop:** the `>800` total-file floor only catches a whole-`app/` drop. Added an
   assertion that the walk still *sees* the ld+json sink files (`filesWithSink > 30`; ~45 today) —
   trips on a glob/ignore regression that hides a sink-dense route group while leaving >800 files, and
   correctly does NOT trip when only non-sink files drop.

Prose tightened to match. **DC-17 held:** plant via Write/`rm`, edits via Edit — no
`git checkout/restore/stash` on the uncommitted tree.

**Post-fold gate GREEN from scratch:** `tsc 0 / lint 0 (0 errors) / vitest 213 files · 4897 passed`
(Δ +1 vs 4896 = exactly the new sink-file-count `it`-block, fully accounted → gate ran on the hardened
code). Working tree vs `863f5b2c`: only the guard test changed (+34/-…); pre-existing excluded deltas
(dashboard/tools slugify, SECURITY-INCIDENT doc, `.claude/`, other `docs/tech-debt/*`,
`mfa-delete-smoke.sh`) untouched.

## 5. COLLECTIVE-MISS PASS (integrator-run; the workflow's `max` critic died on the retry cap)

What the 6 lenses + verifiers, taken together, under-examined — and the resolution:
- **The crawler WRITE boundary as a systemic untrusted-data source.** The lenses audited render
  *sinks*; the through-line of every latent item (mcp Source link, isSafeSourceUrl, sanitizeHighlight-
  if-untrusted, the template-download Location, api/feed) is that crawled/registry data feeds many
  sinks with no validation at the write boundary. No live XSS today (React blocks `javascript:`;
  trusted/static sources where it matters; force-static), but this is the coherent theme of §6.
- **Email/notification HTML templates** (the XSS lens only glanced them). Out of the public-web-XSS
  scope of this chunk; email clients sanitize HTML; no evidence of a live injection. Noted as a future
  scope item, not a finding against this chunk.
- **Verifier shared blind spot check:** the one place a lens erred (asserting React renders
  `javascript:`) was *caught* by the verifier and independently re-confirmed live by the integrator —
  the verify layer added real value, not redundant agreement.

No additional reachable XSS/redirect surfaced. The integrated whole holds against real exploitation.

## 6. DISPOSITION — follow-ups (NONE folded here; frozen / out-of-chunk / latent)

A coherent **LOW / incremental, NON-launch-blocking** cluster — best consolidated with the already-
noted "5 bespoke escapers → shared util" follow-up, NOT a high-stakes build:
1. **`/api/feed` C0-control strip** (REAL/LOW, availability) — reuse `stripInvalidXmlChars`.
2. **Crawled-URL host/protocol allowlist parity** (LOW/DiD) — apply an `isSafeRepoUrl`-style guard to
   the mcp `Source` link (page.tsx:164,269), the admin HN link, and the template-download `Location`;
   add the `/\` clause to `isSafeSourceUrl`. (React already neutralizes the `javascript:` XSS; this is
   phishing/DiD + consistency.)
3. **escapeXml unification** (4-replace badge vs 5-replace feed; shared name) + the 5-escaper
   centralization.
4. **Test-quality:** have shadow-index / academy-lessons tests import `safeJsonLd`; broaden the
   guard's `type=` attribute matcher to colon/createElement/backtick forms (known-limitation #4);
   document the `registry.json` trust assumption at the SearchBar/sanitizeHighlight sink.
5. **Optional:** embed.js U+2028/U+2029 escapes (pre-ES2019 availability only).

## 7. DEFECT-CLASS LEDGER (this audit's update)
- **DC-16 (incomplete-sweep) — recurred in the ANTIDOTE itself** (the guard's `.ts/.tsx`-only walk +
  whole-subtree-only floor). Folded (§4): the completeness guard now covers all source extensions and
  asserts it still sees the sink files. Durable antidote strengthened.
- **SEAM** — re-validated clean in the shipped primitives (one serializer, one redirect validator,
  context-correct escapers); the surviving SEAM observations (isSafeSourceUrl `/\`, escapeXml naming)
  are on out-of-chunk/unreachable surfaces → §6.
- **LITERAL-EXECUTION** — clean in the shipped defenses; the literal-runtime findings (guard glob,
  React `javascript:` sanitization, ES2019 line-terminators) were the source of the key catches, all
  resolved by live execution.
- **AVAILABILITY-REGRESSION** (the ② F1 class) — recurrence search found only out-of-support
  (U+2028/U+2029) or frozen-surface (api/feed C0) instances; none in the shipped defenses.
- **DC-18 (financial-integrity)** — N/A, confirmed no money path touched.

## 8. NEW-CHUNK DETERMINATION
**No new HIGH-STAKES or launch-gating chunk surfaced** — the integrated whole could not be broken
(React blocks the only reachable script-scheme; sources are trusted/static where the render sinks are
unguarded; the page is force-static). The audit DID surface a **LOW / incremental** hardening cluster
(§6) — provisional name **`crawled-url-render-and-escaper-hardening`**, tier **incremental** — best
folded into the existing escaper-centralization follow-up; it does **not** gate launch and does not
auto-start. The next *prioritized* launch-gate chunk is unchanged: **proxy-ssrf-hardening (G2-2)**.

## 9. SEAL BOOKKEEPING NOTE (operator)
The HARDENED fold (this audit) → commit the guard test + this record (explicit pathspec). Confirm the
②-seal post-`/seal-go` bookkeeping is complete: **G2-1 / G2-3 ☐→☑** in
`LAUNCH-GATE-roadmap-2026-06-27.md` + `.claude/launch-gate-check.sh` (the launch_gate block still shows
22 open; if the G2-1/G2-3 ticks were not yet applied, apply them — the seal landed at `863f5b2c`).
