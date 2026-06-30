# ① BUILD HANDOFF — proxy-ssrf-hardening — 2026-06-29

**Launch-gate chunk #3.** Closes **G2-2** (SSRF in the Smart Proxy) in
`docs/tech-debt/LAUNCH-GATE-roadmap-2026-06-27.md`. Queue: `launch-gate-queue.md` #3.

**TIER: HIGH-STAKES.** Security boundary (SSRF) + untrusted-input boundary (developer-supplied
upstream/webhook/health/probe URLs) + the **core money rail** (the metered proxy fetch) + a launch
gate. The edits are mechanical; the risk is **COMPLETENESS of the egress-sink inventory**,
**CORRECTNESS of the IP classifier** (under-block = SSRF survives; over-block = the money path breaks),
and **fail-closed behavior on the billing path**.

---

## ⚠ 0. SCOPING DECISION — read first (the chunk is BIGGER than the roadmap's two named files)

The roadmap names `proxy/[slug]/route.ts` + `webhooks.ts`. A full live enumeration (Explore sweep +
integrator probes + a 6-lens plan audit, 2026-06-29) found **the same SSRF seam in SIX untrusted-URL
egress classes**, all sharing ONE invariant (*validate every destination IP — literal AND DNS-resolved,
initial AND each redirect hop — against private/reserved ranges, fail closed*). Fixing only the two named
files would leave health-checks, auto-detect, the **public-unauthenticated serve `security-headers`
handler**, and the **Slack/Discord notification** fetches as live SSRF of the identical class = a DC-16
incomplete-sweep. **SCOPE MERGED** (same seam + one spec states "done" for all; no operator gate crossed,
no unrelated incremental work folded — purely completing the SSRF class). The build delivers ONE shared
egress guard and routes every untrusted-URL fetch through it.

> **⚠ AUDIT CORRECTION (plan audit, 2026-06-29 — folded below).** The 6-lens plan audit (10 sustained
> REAL findings) materially corrected this draft. THE BIG ONE: **the connect-time `lookup` is SKIPPED by
> `net.connect` for IP-literal hosts** (verified live: `fetch('http://169.254.169.254/', {dispatcher})`
> connects directly, the custom `lookup` never fires), so a `lookup`-only guard MISSES the #1 SSRF target
> (`169.254.169.254`, `127.0.0.1`, `[::1]`, `0.0.0.0`, and encodings `new URL()` normalizes to a literal
> like `2130706433`/`0177.0.0.1`). The guard therefore needs **TWO co-load-bearing layers** (synchronous
> IP-literal host check + DNS `lookup`) and **redirect handling that re-checks literal Locations** — see
> the revised §1a. Also folded: two missed sinks (serve `security-headers`, `notifications.ts`) and the
> per-rail prepaid/postpaid billing asymmetry (§1a.3). These folds are IN the plan below; the build
> implements the corrected plan.

### Complete untrusted-URL egress inventory (the floor — re-enumerate live, do not trust line numbers)
| # | sink (file:line) | URL source (untrusted) | current guard | gap |
|---|---|---|---|---|
| 1 | `api/proxy/[slug]/route.ts:768` (api-key flow) | `auth.tool.proxyEndpoint` | reg-time `isPrivateUrl()` (string-only, https-only) | **no fetch-time guard**; follows redirects; 30s |
| 2 | `api/proxy/[slug]/route.ts:1295` (MPP) | `toolRow.proxyEndpoint` | same (reg-time only) | same |
| 3 | `api/proxy/[slug]/route.ts:1664` (protocol forward — x402/ACP/UCP/AP2/L402/…) | `toolRow.proxyEndpoint` via `lookupToolBySlug()` | same (reg-time only) | same |
| 4 | `api/proxy/[slug]/route.ts:2609` (SLA fallback) | `fallback.proxyEndpoint` | same (reg-time only) | same |
| 5 | `lib/webhooks.ts:156` | `webhookEndpoints.url` | runtime+reg `isWebhookUrlSafe()` (string-only) | rebind-bypassable; follows redirects; 10s |
| 6 | `api/cron/health-checks/route.ts:77` | `tools.healthEndpoint` | **NONE at fetch; reg zod allows `http://`, NO private-IP check** | **HIGH** — full SSRF, cleartext OK |
| 7 | `api/tools/auto-detect/route.ts:72` (probe) | request body `url` | runtime `isPrivateUrl()` (string-only), `redirect:'follow'` | rebind-bypassable |
| 8 | `api/tools/auto-detect/route.ts:115` (MCP handshake) | request body `url` | same | same |
| 9 | `api/tools/auto-detect/route.ts:155` (OpenAPI spec) | `new URL(path, baseUrl)` | same (baseUrl pre-validated string-only) | same |
| 10 | `api/tools/quick-publish/route.ts` (reg) | request body `url` → `proxyEndpoint` | reg `isPrivateUrl()` (string-only) | reg-only; feeds sinks 1-4 |
| **11** | **`api/tools/serve/[slug]/handlers.ts:198-203` (`securityHeaders`), via `fetchWithTimeout`** | **request query/body `url` (PUBLIC, UNAUTH)** | **NONE — allows `http://`, `redirect:'follow'`** | **HIGH — worst: raw attacker URL from anyone; only an IP rate-limit. Audit R1/R4.** |
| **12** | **`lib/notifications.ts:41` (Slack), `:82` (Discord)** | **`notificationWebhooks` JSONB (dev-configured)** | **string-only `isWebhookUrlSafe` pre-check; raw `fetch`, no dispatcher** | **the guard-collapse alone does NOT attach the connect-time guard here. Audit R5.** |
| — | INGRESS feeders (NOT direct sinks; destinations trusted/own-host): `api/mcp/route.ts:231` (`serveUrl`) + `api/cron/consumer-schedules/route.ts:60` (cron, every 5 min) forward user `url` INTO sink 11 → **persisted/recurring** SSRF. Fix = guard sink 11 (covers these). Audit R2. | | | |
| — | OTHER serve handlers (`ssl-labs`, `wayback`, `ip-range`, …) | user input only `encodeURIComponent`'d into FIXED hosts | n/a | **safe — host not attacker-controlled; OUT** |
| — | `lib/registry-crawlers.ts:79`, `universal-crawlers.ts` | **hardcoded** registry URLs | n/a | **TRUSTED — OUT OF SCOPE** |
| — | `api/demo/kernel/route.ts:270` | `new Request(...)` for internal kernel routing | scheme-checked | **NOT an outbound fetch — OUT OF SCOPE** |

**Guard duplication (the SEAM):** four divergent string-only implementations — `isWebhookUrlSafe`
(`webhooks.ts:44`) + three copies of `isPrivateUrl` (`developer/tools/[id]/endpoint/route.ts:17`,
`tools/auto-detect/route.ts:17`, `tools/quick-publish/route.ts:19`). All prefix/literal matchers, all
rebind-bypassable, all must be superseded by the one shared guard.

---

## 1. INTENT
A public launch lets any developer register a tool/webhook/health/probe URL that SettleGrid's server
fetches. Today the destination is validated (where validated at all) by a **string denylist on the URL**,
which is bypassable three ways: (a) **DNS resolution** — `evil.com` that resolves to `127.0.0.1` passes
every string check; (b) **DNS rebinding** — validated public at registration, flipped to private before
the fetch (validation never re-runs at fetch time); (c) **IP-literal encodings** — decimal
`2130706433`, hex `0x7f.0.0.1`, short `127.1`, IPv4-mapped IPv6 `::ffff:127.0.0.1`. The payoff for an
attacker: read cloud metadata (`169.254.169.254`), internal services, and `localhost` admin surfaces
from SettleGrid's egress IP. Consumers of the fix: the metered proxy money rail (every invocation),
webhook delivery, the health-check cron, and the tool auto-detect probe. Enables a launch that does not
expose an SSRF pivot into SettleGrid's infrastructure. **There is no network-egress firewall backstop
assumed** — the application-layer guard is the only defense, so it must be airtight and fail closed.

## ⚠ 1a. THE LOAD-BEARING DECISIONS MOST LIKELY TO BE SILENTLY WRONG

1. **VALIDATE EVERY DESTINATION IP — LITERAL *AND* DNS-RESOLVED — AT FETCH TIME (the crux; REVISED by the
   plan audit).** String/URL validation alone is the exact bug being closed, BUT a connect-time `lookup`
   ALONE is ALSO insufficient: **`net.connect` SKIPS the custom `lookup` when the host is already an IP
   literal** (`isIP(host)!==0` short-circuits DNS). **VERIFIED LIVE (probe, 2026-06-29):** with a
   per-request `Agent({connect:{lookup}})`, `fetch('http://example.com/')` fired the `lookup`, but
   `fetch('http://127.0.0.1:9/')`, `fetch('http://169.254.169.254/')`, `fetch('http://[::1]/')` and
   `fetch('http://2130706433/')` **all SKIPPED the lookup and connected directly** — a `lookup`-only guard
   leaves the #1 SSRF target (`169.254.169.254`) and every bare-IP payload WIDE OPEN. The guard needs
   **TWO co-load-bearing layers, both at FETCH time, both fail-closed — neither alone is complete:**
   - **(L1) Synchronous IP-literal host check (load-bearing, NOT just UX):**
     `const h = stripBrackets(new URL(url).hostname)`; if `net.isIP(h) !== 0` → `classifyAddress(h)` (with
     IPv4-mapped/embedded-IPv6 normalization) → **reject before issuing the fetch**. Catches `127.0.0.1`,
     `169.254.169.254`, `[::1]`, `0.0.0.0`, and the encodings `new URL()` normalizes to a literal
     (`2130706433`, `0x7f.0.0.1`, `0177.0.0.1`→`127.0.0.1`, `127.1`). (`new URL()` interprets octal;
     `dns.lookup` does not — so literals MUST be classified from the URL host, not via the resolver.)
   - **(L2) DNS `lookup` for hostname hosts (rebind defeat):** per-request **undici `Agent` with a custom
     `connect.lookup`** — SETTLED: honored by Node v24 global `fetch` AND `undici.fetch` (a throwing
     `lookup` propagated). `validatingLookup(hostname, opts, cb)`: `dns.lookup(hostname,{all:true})` →
     `classifyAddress` EACH → if ANY private/reserved `cb(new Error('SSRF_BLOCKED'))` else `cb(null, addrs)`.
     **Match undici 5.29's lookup callback contract EXACTLY** (mirror `dns.lookup`; the SEAM lens flagged
     this — a wrong shape silently breaks the agent; read `node_modules/undici/lib/core/connect.js`).
     **PER-REQUEST dispatcher on untrusted fetches only — never `setGlobalDispatcher`** (would route
     trusted crawler/Stripe fetches through it).
   - **(L3) Redirects (REVISED):** "the same dispatcher re-validates each hop" is **FALSE for an IP-literal
     `Location`** (the redirect connect also skips the lookup). So: cheap sinks (health / auto-detect /
     serve / webhooks / notifications) → **`redirect:'error'`** (no product need to follow). The **proxy**
     (may legitimately follow) → **`redirect:'manual'` + a re-validation loop**: on each `3xx` run L1 on
     the `Location`, re-issue through the L2 dispatcher, cap hops (~3). **VERIFY LIVE that a redirect whose
     `Location` is a bare private IP (`http://169.254.169.254/`) is blocked**, not just a hostname Location.
   ```
   import { Agent } from 'undici'
   const ssrfAgent = new Agent({ connect: { lookup: validatingLookup } })
   // safeFetch(url, init): assertHttpUrl(url) → L1 literal-host check → reject-or-fetch(url, {
   //   ...existingFetchInit, dispatcher: ssrfAgent, redirect: init.redirect ?? 'error' })
   // proxy: pass redirect:'manual' and run the per-hop L1+L2 re-validation loop.
   ```

2. **THE IP CLASSIFIER MUST BE COMPLETE — under-block = SSRF survives; OVER-block = the money path breaks.**
   Block ALL of, IPv4: `0.0.0.0/8 10/8 100.64/10 127/8 169.254/16 172.16/12 192.0.0/24 192.0.2/24
   192.88.99/24 192.168/16 198.18/15 198.51.100/24 203.0.113/24 224/4 240/4 255.255.255.255/32`; IPv6:
   `::/128 ::1/128 fc00::/7 fe80::/10 ff00::/8 2001:db8::/32 64:ff9b::/96 100::/64`; **and IPv4-mapped /
   embedded IPv6** (`::ffff:a.b.c.d`, `::a.b.c.d`, `2002:wxyz::/16` 6to4, `64:ff9b::` NAT64) — extract the
   embedded IPv4 and classify it (probe confirmed `dns.lookup('::ffff:127.0.0.1')` stays mapped → you
   MUST normalize it; `net.BlockList.check` will NOT auto-cross families). Recommended primitive:
   **`node:net` `BlockList`** (built-in, confirmed present) with `addSubnet` per range + explicit
   mapped-IPv6 normalization; or `ipaddr.js` (`.range()`) if you add it. **The adversarial test matrix MUST
   include ALLOW cases** (`8.8.8.8`, `1.1.1.1`, a normal public hostname) — a false positive here blocks a
   legitimate developer upstream and breaks billing. Under-block is a vuln; over-block is an outage.

3. **FAIL CLOSED + PRESERVE THE MONEY-PATH SEMANTICS — and MIND THE PER-RAIL BILLING ASYMMETRY (REVISED).**
   - On block / DNS error / resolver timeout → **block (error), never bypass**.
   - **The four proxy rails do NOT charge uniformly (audit R7, verified):** api-key (`:768`) and
     SLA-fallback (`:2609`) are **POSTPAID** — a block records `costCents:0` / never debits → genuinely
     not-charged ✓. **MPP (`:1295`) is PREPAID** (Stripe SPT capture in `validateMppPayment` BEFORE the
     fetch) and **on-chain `forwardAndBill` (`:1664`) is PREPAID/irreversible** — for these, a block at
     fetch time lands as **charged-but-undelivered (F3)**, NOT not-charged, and an over-block false-positive
     is **direct money harm + refund-runbook load**, not a mere outage. **THE FIX:** because `proxyEndpoint`
     is a stored DB value known at the START of the request, run the **synchronous guard (L1 literal check +
     scheme + a best-effort host classify) BEFORE any payment capture/settlement** for ALL rails — so a bad
     endpoint is rejected pre-charge. The L2 connect-time (rebind) block on a prepaid rail is a rare
     residual (requires a registered public host that flips at fetch) → document it as F3 (refund runbook);
     do NOT pretend it is not-charged. Per-sink block-path tests must assert the ACTUAL charge outcome per
     rail (not-charged for postpaid; pre-capture-reject or documented-F3 for prepaid).
   - **Do NOT alter** the existing `fetchInit` (method, whitelisted `upstreamHeaders`,
     `AbortController`/timeout, `body` forwarding, `duplex:'half'` streaming) — only ADD `dispatcher` +
     `redirect`. The dispatcher must not disable streaming/keep-alive/timeout. Keep the proxy's
     billing/settlement/fraud/CAS logic byte-identical. Over-block is an OUTAGE (postpaid) or MONEY HARM
     (prepaid) — the §2.4 ALLOW-case matrix is mandatory.

4. **REDIRECTS — see LBD-1 (L3).** NOT redirect-safe by the dispatcher alone (a literal-IP `Location`
   skips the lookup). Cheap sinks → `redirect:'error'`; proxy → `redirect:'manual'` + per-hop L1+L2
   re-validation, capped. **Verify the redirect-to-LITERAL-private-IP case is blocked live** (a hostname
   Location would false-pass the test).

5. **ONE SHARED GUARD MODULE (kills the SEAM).** Create `apps/web/src/lib/safe-egress.ts` exporting
   (a) `safeFetch(url, init)` (runs L1 literal check + scheme pre-filter, then fetch with the L2 dispatcher
   + redirect policy), (b) the validating `dispatcher`, (c) pure `classifyAddress(ip): 'public' | <reason>`
   + `isPublicAddress(ip)` (used by BOTH L1 and L2), and (d) `assertHttpUrl(url)` (scheme allowlist
   `http:`/`https:`; reject `file:`/`data:`/`blob:`/etc.). **Replace** the four divergent string guards
   (`isWebhookUrlSafe` + 3× `isPrivateUrl`) by delegating to the shared module (keep a cheap string/URL
   pre-check at REGISTRATION for UX, but the LOAD-BEARING guards are L1+L2 at FETCH). **The block path is
   not done until every untrusted sink (incl. the audit's missed serve handler + notifications) actually
   calls `safeFetch` — a wrapper that a sink forgets to call is an unguarded sink (LITERAL-EXECUTION).**

---

## 2. SCOPE — IN
1. **`lib/safe-egress.ts`** — the shared module (LBD-1, LBD-2, LBD-5): validating undici dispatcher
   (`connect.lookup` → resolve all → classify each → block-or-pass), `classifyAddress`/`isPublicAddress`
   (complete range set, IPv4 + IPv6 + mapped/embedded), `assertHttpUrl` scheme pre-filter, and a
   `safeFetch(url, init)` wrapper attaching the dispatcher. Fail closed throughout.
2. **Route EVERY untrusted-URL fetch through `safeFetch`:** proxy sinks 1-4 (add `dispatcher`+redirect to
   each `fetchInit`; per-rail block→billing per LBD-3; run the L1+scheme synchronous guard EARLY — before
   payment capture — for prepaid rails); webhooks (5); **health-checks (6 — ADD the guard it entirely
   lacks; recommend https-only or at least private-IP block)**; auto-detect (7-9); **serve `security-headers`
   handler (11 — `handlers.ts:198-203`; route its `fetchWithTimeout` through `safeFetch`, `redirect:'error'`,
   reject `http://`) — audit R1/R4, the public-unauth SSRF**; **`notifications.ts` Slack/Discord (12 —
   `:41`,`:82`; route both raw fetches through `safeFetch`) — audit R5**. (The serve INGRESS feeders — MCP
   `serveUrl`, consumer-schedules cron — need NO dispatcher; guarding sink 11 covers them — audit R2.)
3. **Collapse the four string-only guards** (`isWebhookUrlSafe` + 3× `isPrivateUrl`) to delegate to
   `safe-egress` (registration-time cheap pre-check retained for UX; the load-bearing guards are L1+L2 at fetch).
4. **Tests (teeth required — END-TO-END, no guard mock; audit R6/R10):**
   - **`classifyAddress` unit matrix** — BLOCK every reserved range incl. IPv4-mapped IPv6
     (`::ffff:127.0.0.1`, `::ffff:169.254.169.254`), `[::]`, `fc00::`, `fe80::`; **ALLOW** `8.8.8.8`,
     `1.1.1.1`, `2606:4700::` and a public hostname (no over-block).
   - **`safeFetch` END-TO-END literal-IP block (THE one the lookup-only design missed)** — assert via the
     REAL `safeFetch` (NO `lookup` stub) that `http://127.0.0.1`, `http://169.254.169.254`, `http://[::1]`,
     `http://0.0.0.0`, `http://2130706433`, `http://0x7f.0.0.1`, **`http://0177.0.0.1`** (octal), `http://127.1`
     each **REJECT SYNCHRONOUSLY (L1) before any connect** — these would FALSE-GREEN if asserted only against
     `classifyAddress(resolvedIP)`.
   - **`safeFetch` hostname/rebind block** — a hostname resolving to a private IP is blocked by L2 (loopback
     server or a `dns.lookup` that returns a private addr); a public target is allowed.
   - **Redirect-to-LITERAL-private** — a loopback server that `302`s to `http://169.254.169.254/` is blocked
     (NOT a hostname Location — that would false-pass).
   - **Per-rail block→billing** — postpaid (api-key, SLA) block ⇒ NOT charged; prepaid (MPP, on-chain)
     ⇒ rejected pre-capture OR documented-F3 (assert the actual charge outcome per rail, per LBD-3).

## 3. SCOPE — OUT / FROZEN
- **Proxy billing / settlement / fraud / CAS / payout math** — FROZEN. Only ADD `dispatcher` (+ optional
  `redirect`) to the fetch and route the block through the EXISTING upstream-failure (not-charged) path.
- **Protocol-proxy libs** (`x402/acp/ucp/ap2/l402/alipay/mastercard/emvco/circle-nano/drain/kyapay/visa-tap`)
  — they delegate to the central proxy fetch (verified); **no change** beyond inheriting the guarded fetch.
- **Registry crawlers** (`registry-crawlers.ts`, `universal-crawlers.ts`) — hardcoded trusted URLs; OUT.
- **`api/demo/kernel`** — no outbound fetch (internal routing); OUT.
- **Network-firewall / egress-IP allowlisting at the infra layer** — OUT (ops; this is the app-layer fix).
- Do NOT redesign the proxy, change the header whitelist, or alter timeouts.

## 4. SETTLED TECHNICAL FACTS (probe evidence, 2026-06-29 — do not re-derive)
- Node **v24.13.0**; `undici` **5.29.0** importable (`fetch` + `Agent` present); `net.BlockList` present.
- **Global `fetch` honors a per-request `dispatcher`** (custom `connect.lookup` ran — sentinel error
  propagated); so does `undici.fetch`. → per-request validating dispatcher is viable; no `setGlobalDispatcher`.
- `dns.lookup` canonicalizes decimal/hex/short IPv4 (`2130706433`,`0x7f.0.0.1`,`127.1`→`127.0.0.1`) but
  **NOT octal** (`0177.0.0.1`→`177.0.0.1`), while `new URL()` **does** interpret octal (→`127.0.0.1`) — a
  string-vs-resolver discrepancy that **proves validation must be on the connect-time resolved IP**.
- `dns.lookup('::ffff:127.0.0.1')` stays IPv4-mapped (family 6) → the classifier MUST normalize mapped/
  embedded IPv6, `net.BlockList` won't cross families automatically.
- **⚠ VERIFIED (audit, the load-bearing correction): `net.connect` SKIPS the custom `connect.lookup` for
  IP-LITERAL hosts.** Probe: with `Agent({connect:{lookup}})`, `fetch('http://example.com/')` fired the
  lookup, but `fetch('http://127.0.0.1:9/')`, `fetch('http://169.254.169.254/')`, `fetch('http://[::1]/')`,
  `fetch('http://2130706433/')` ALL skipped it and connected directly. → the connect-time `lookup` covers
  ONLY hostname→DNS; IP-literal hosts (incl. octal/decimal that `new URL()` normalizes to a literal) need
  the synchronous L1 URL-host check, and IP-literal redirect Locations need `redirect:'manual'`+re-check.
- **Per-rail billing (audit R7, verified):** api-key (`:768`) + SLA (`:2609`) = POSTPAID (block ⇒ not
  charged); MPP (`:1295`) = PREPAID (Stripe SPT capture in `validateMppPayment` BEFORE the fetch); on-chain
  `forwardAndBill` (`:1664`) = PREPAID/irreversible (`options.irreversibleOnChain`). → run the synchronous
  guard pre-capture; a fetch-time block on a prepaid rail is charged-but-undelivered (F3).
- **Serve handlers:** only `security-headers` has an attacker-controlled HOST; `ssl-labs`/`wayback`/
  `ip-range` embed user input as `encodeURIComponent` into FIXED hosts (safe). The serve route is PUBLIC /
  unauthenticated (IP rate-limit only) and reachable via the MCP `serveUrl` + consumer-schedules cron.

## 5. BUILD SEQUENCE
1. **Read this handoff + the roadmap G2-2 row + `launch-gate-queue.md` #3 first.** Re-enumerate live every
   untrusted-URL `fetch`/`new Request` (the §0 table is a floor) — `git grep -nE "fetch\(|new Request\("`.
2. Build `lib/safe-egress.ts`: `classifyAddress`/`isPublicAddress` (L2 ranges + L1 literal share it),
   `assertHttpUrl`, the validating `connect.lookup` dispatcher (L2), and **`safeFetch` = L1 literal check +
   scheme + L2 dispatcher + redirect policy**, fail-closed throughout.
3. **Author the END-TO-END bypass matrix FIRST** — `classifyAddress` block+ALLOW cases AND `safeFetch`
   literal-IP rejects (`169.254.169.254`/`127.0.0.1`/octal/decimal/`[::1]`, no stub) + redirect-to-literal
   → RED → implement → GREEN.
4. Wire the proxy (sinks 1-4): `safeFetch`/`dispatcher` + `redirect:'manual'`+re-validate; run the
   synchronous guard PRE-CAPTURE for the prepaid rails (MPP/on-chain); per-rail block→billing test (LBD-3).
5. Wire webhooks (5), health-checks (6 — add the missing guard), auto-detect (7-9), **serve `security-headers`
   (11)**, **notifications Slack/Discord (12)**; collapse the 4 string guards to delegate.
6. Live-verify: literal-IP block, hostname-rebind block, redirect-to-LITERAL-private block, public-target
   ALLOW (no over-block).
7. Gate (§6). Self-verify at the kickoff's stated interval with a fresh-context subagent.

## 6. GATE
- From `apps/web`: `npx tsc --noEmit` → 0; `npm run lint` → 0 errors; `npx vitest run` → all pass (incl.
  the `classifyAddress` matrix, the `safeFetch`/dispatcher integration, the redirect-block, the per-sink
  block-path, and the bypass-regression tests). settlegrid-agents UNAFFECTED.
- **Allowlist (verify present):** `Bash(npx tsc *)`, `Bash(npx vitest *)`, `Bash(npm run lint)`,
  `Bash(git *)` — all present. No WebFetch/MCP needed (every claim is provable by unit test + local
  loopback server + code reading; do NOT plan real external egress in the gate). Env traps unset → Opus 4.8.

## 7. SEAL BOOKKEEPING (LAUNCH-GATE — required)
On seal, tick **G2-2 ☐→☑** in `docs/tech-debt/LAUNCH-GATE-roadmap-2026-06-27.md`, then run
`.claude/launch-gate-check.sh` (hook updates `cadence-state.json → launch_gate`; GREEN only at 0). Seal
record → `docs/tech-debt/proxy-ssrf-hardening-seal-record-2026-06-29.md`; record the merged scope (the
four sink classes), the shared-guard collapse, and the http-vs-https policy decision for health-checks.

## 8. DEFECT-CLASS LEDGER (relevant standing classes; classes live in chunk docs)
- **DC-16 (incomplete-sweep) — THE governing risk, RECURRED IN THIS PLAN ITSELF** (the draft's "complete
  inventory" missed the serve `security-headers` SSRF + `notifications.ts` — caught by the plan audit; folded).
  Also: string-only denylist + reg-time-only + the uncovered health-checks sink + 4 divergent copies.
  Antidote: ONE shared fetch-time guard (L1 literal + L2 lookup) + the END-TO-END bypass matrix; the sweep
  covers ALL untrusted-URL fetches (12 in §0), not just the 2 named files.
- **SEAM** — the four divergent guards collapse to one; the IP classifier must match the threat
  (every destination IP, all ranges, mapped IPv6), not a prefix string. **The undici `lookup` callback
  contract must match 5.29 exactly** (a wrong shape silently breaks the agent).
- **LITERAL-EXECUTION — the chunk's defining trap (audit caught 3 HIGH here):** `net.connect` SKIPS the
  `lookup` for IP-literal hosts → the connect-time guard ALONE misses `169.254.169.254`/`127.0.0.1` (incl.
  redirect-to-literal); the L1 synchronous literal check is co-load-bearing. Also: `safeFetch` must
  actually be CALLED at every sink (a forgotten sink = an unguarded sink).
- **DC-18 / financial-integrity** — the proxy is the money rail: fail-closed must NOT charge on block,
  and the guard must not over-block legitimate upstreams (outage) — both are money-correctness, not just
  security. ② must scrutinize the block→billing seam.

## 9. CHUNK LIFECYCLE
scope-confirm ✓ → draft plan ✓ → **pre-build plan audit (runs in the ① orchestrator session; closes
before any build code)** → build (fresh single-writer agent) → executable gate → ② seal-gating review →
seal + bookkeeping (tick G2-2). The kickoff (single fenced block) is the last thing the ① session emits;
the build agent reads THIS file at file-fidelity as step zero.
