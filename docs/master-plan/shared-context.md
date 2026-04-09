# Shared Context Appendix

**Document ID:** `MP-QL-001 §6`
**Referenced as:** `{{SHARED_CONTEXT}}`

Every execution prompt in the Quantum Leap master plan may reference `{{SHARED_CONTEXT}}` meaning this section. This document is the single source of truth for repo structure, SDK API, agent pattern, env vars, and common pitfalls.

---

## Repo Structure (absolute paths)

### Agents monorepo: `/Users/lex/settlegrid-agents/`

```
agents/
  beacon/       Content agent
                ├─ index.ts   (CLI entry, exports BEACON_SCHEDULE)
                ├─ graph.ts   (LangGraph state machine: research → draft → submit)
                ├─ tools.ts   (Claude + Exa + Firecrawl wrappers)
                ├─ prompts.ts (Claude prompts)
                └─ __tests__/beacon.test.ts (~60 tests)
  protocol/     Protocol monitor (same shape as beacon)
                └─ Tracks 16 protocols + SettleGrid brand monitoring
  indexer/      Auto-indexing agent (same shape, shipped 2026-04-07)
                └─ Phase 1 resolver triage + Phase 2 supply diagnosis + Phase 3 quality scoring
  templater/    [TO BE CREATED IN P1.1] — 4th agent, same pattern
  shared/
    config.ts         getConfig() returns typed AgentConfig
    db.ts             Read-only Postgres (pool, no writes from agents)
    email.ts          Resend wrapper + template helpers
    guardrails.ts     PII sanitization, prompt injection checks, channel blocklist
    hitl.ts           Human-in-loop approval (Tier 1/2/3), JSON file-backed queue
    memory.ts         Mem0 client, getMemoryManager, updateAgentState
    observability.ts  Langfuse: traceAgent, traceToolCall
    redis.ts          Upstash Redis REST client
    tools.ts          (empty placeholder)
orchestrator/
  scheduler.ts    node-cron-based scheduler, SCHEDULE registry, resolveAgentScript()
  briefing.ts     Morning/evening briefing generation
  event-bus.ts    Simple event emitter for agent-to-agent messaging
scripts/
  community-search.ts
  ping-indexnow.ts
  publish-feedback.ts
  sync-known-content.ts
dashboard/
  hitl-queue.ts   CLI to review HITL queue
data/             Persistent agent state (HITL queue, known-content, etc.)
package.json      Uses pnpm workspaces + tsx. Scripts use npm-style invocation.
tsconfig.json
vitest.config.ts
```

**Key commands:**
- `pnpm typecheck` → `tsc --noEmit`
- `pnpm test` → `vitest run`
- `pnpm dev` → orchestrator watcher
- `pnpm beacon` / `pnpm protocol` / `pnpm indexer` → direct agent invocation

**Current test count:** 400 tests across 11 files (as of 2026-04-08). Any new agent must add 50+ tests to maintain the pattern.

### Main web monorepo: `/Users/lex/settlegrid/`

```
apps/
  web/                                Next.js 15 App Router
    src/
      app/
        (dashboard)/                  Authenticated routes
        (marketing)/                  Public marketing pages
        api/                          REST + cron routes
          cron/
            claim-outreach/route.ts   Daily 10am UTC, emails unclaimed tool devs
            crawl-registry/route.ts   Every 6h, rotates MCP sources
            crawl-services/route.ts   Daily noon, rotates universal crawlers
            claim-follow-up/route.ts  Daily 2pm, follow-up emails
        templates/page.tsx            [STUB — Phase 2 rebuilds this into gallery]
        learn/blog/[slug]/page.tsx    Blog post renderer (markdown bodies)
        learn/academy/                [TO BE CREATED IN P3.8] — Monetization Academy
        admin/templater/              [TO BE CREATED IN P3.4] — cost/quality dashboard
        mcp/[owner]/[repo]/           [TO BE CREATED IN P2.12] — shadow directory SSG
      lib/
        db/                           Drizzle client + schema (tools, developers, etc.)
        blog-bodies/                  Markdown bodies for blog posts
        blog-posts.ts                 Blog post registry
        indexer-quality.ts            Cron-side Indexer interop (from 2026-04-07)
        redis.ts                      Upstash Redis client
        email.ts                      Resend wrapper + templates
        api.ts                        successResponse/errorResponse helpers
        env.ts                        Typed env var accessors
    public/
      robots.txt                      Static robots (secondary to dynamic robots.ts)
      registry.json                   [TO BE CREATED IN P2.7] — template registry
    drizzle/                          Database migrations
  
packages/
  mcp/                                @settlegrid/mcp SDK v0.1.1 (tsup-built)
    src/
      index.ts                        Main exports
      config.ts                       normalizeConfig, validatePricingConfig
      cache.ts                        LRU cache
      errors.ts                       Error classes (see SDK API below)
      middleware.ts                   REST middleware (Web Fetch, Next.js, Hono, Express)
      payment-capability.ts           MCP experimental.payment capability builder
      rest.ts                         settlegridMiddleware (HTTP wrapper)
      server-card.ts                  generateServerCard / generateServerCardBilling
      types.ts                        PricingConfig, PricingModel, GeneralizedPricingConfig
  create-settlegrid-tool/             Existing scaffolder (pre-Quantum Leap)
    templates/
      blank/
      mcp-server/
      rest-api/
      openapi/
    src/scaffold.ts                   Placeholder replacement ({{TOOL_SLUG}}, {{PRICE_CENTS}}, etc.)
  settlegrid-cli/                     [TO BE CREATED IN P2.1] — npx settlegrid add
  settlegrid-skill/                   [TO BE CREATED IN P1.7] — Anthropic Skill package
  langchain-settlegrid/               Existing: LangChain SettleGridTool adapter
  discovery-server/                   Existing: Discovery MCP server
  settlegrid-cursor/                  Existing: Cursor integration
  settlegrid-mcpb/                    Existing: MCP Bundle
  n8n-settlegrid/                     Existing: n8n node
  publish-action/                     Existing: GitHub Action

open-source-servers/                  1,022 existing MCP server templates (Pre-Quantum Leap)
  settlegrid-anthropic/
  settlegrid-alpha-vantage/
  settlegrid-...                      Each has: package.json, src/server.ts, Dockerfile,
                                      vercel.json, README.md, LICENSE
scripts/
  gen/
    core.mjs                          164-line template generator (spec → full package)
    batch3a.mjs                       Batch specs that produced the 1,022 templates
    batch3b-g.mjs                     (36,030 lines total across all batches)
  codemods/                           [TO BE CREATED IN P1.11] — jscodeshift transforms
  build-registry.ts                   [TO BE CREATED IN P2.7] — emits registry.json

docs/
  master-plan/                        THIS DIRECTORY
  seps/                               [TO BE CREATED IN P1.10] — MCP SEP drafts
  audit-failures/                     [TO BE CREATED IN P1.4 as .gitkeep] — audit log
  decisions/                          ADR-style decision memos
  launch/                             [TO BE CREATED IN P4.2-P4.5] — launch assets

turbo.json                            Turborepo config
pnpm-workspace.yaml
```

**Key commands:**
- `pnpm -w typecheck` → workspace-wide tsc
- `pnpm -w test` → workspace-wide vitest
- `pnpm -w lint` → workspace-wide eslint
- `pnpm -w build` → turbo build
- `cd packages/<name> && pnpm build` → single package build

**Current test count:** 2670 tests across 98 files (as of 2026-04-08).

---

## SDK API Summary (`@settlegrid/mcp`)

**Version:** `0.1.1` (exported as `SDK_VERSION`)

**Entry point:**

```ts
import { settlegrid } from '@settlegrid/mcp'
```

**Core flow:**

```ts
const sg = settlegrid.init({
  toolSlug: 'my-tool',           // required, matches registered slug
  pricing: {
    defaultCostCents: 1,         // required
    methods: {
      search: { costCents: 5, displayName: 'Web Search' },
      analyze: { costCents: 10 },
    },
  },
  apiUrl?: string,               // default: https://settlegrid.ai
  debug?: boolean,               // synchronous metering + verbose logs
  cacheTtlMs?: number,           // default: 300_000 (5 min)
  timeoutMs?: number,            // default: 5_000, range: 100-30_000
})

// Wrap a handler with billing:
const billed = sg.wrap(
  async (args: { query: string }) => runSearch(args.query),
  { method: 'search' }
)

// Invoke with key in headers (REST) or MCP metadata:
await billed(args, { headers: { 'x-api-key': 'sg_live_...' } })
// or
await billed(args, { metadata: { 'settlegrid-api-key': 'sg_live_...' } })
```

**Additional exports:**

- `settlegridMiddleware({ toolSlug, pricing })` — REST middleware for Web Fetch / Next.js / Hono / Express
- `createPaymentCapability({ toolSlug, pricing })` — MCP `capabilities.experimental.payment`
- `generateServerCard({ ..., freeTier })` — machine-readable pricing manifest
- `generateServerCardBilling(...)` — alias used by existing templates
- `extractApiKey(headers, metadata)` — resolves key from `x-api-key` → Bearer → MCP `_meta`
- `normalizeConfig(input)` — validates + normalizes init config
- `validatePricingConfig(pricing)` — schema check on pricing config
- `LRUCache` class — exported for advanced use
- `PAYMENT_ERROR_CODES` — `{ INSUFFICIENT_CREDITS: 32042, ... }`

**Error classes** (all extend `SettleGridError`):

| Error | HTTP Code | When |
|---|---|---|
| `InvalidKeyError` | 401 | Missing/malformed/not-found key |
| `InsufficientCreditsError` | 402 | Valid key, zero balance. Includes `topUpUrl` |
| `RateLimitedError` | 429 | Rate limit hit. Includes `retryAfterSeconds` |
| `ToolNotFoundError` | 404 | toolSlug not registered |
| `ToolDisabledError` | 403 | Tool is disabled |
| `SettleGridUnavailableError` | 503 | SettleGrid API is down |
| `NetworkError` | 503 | Network failure |
| `TimeoutError` | 503 | Request timeout |

**Instance methods:**

- `sg.wrap(handler, { method, costCents? })` → billed handler
- `sg.validateKey(apiKey)` → `{ valid, consumerId, balanceCents }` (reads balance without consuming)
- `sg.meter(apiKey, method)` → `{ success, remainingBalanceCents, costCents }` (consumes credits)
- `sg.clearCache()` → clears in-memory LRU cache

**Key resolution order:**
1. `x-api-key` header
2. `Authorization: Bearer <key>` header
3. MCP `_meta.settlegrid-api-key`

---

## Agent Pattern

Every agent in `/Users/lex/settlegrid-agents/agents/<name>/` follows this exact shape:

### `index.ts`

- CLI entry point: `if (require.main === module) { main() }`
- Exports `<NAME>_SCHEDULE` constant (cron string per command)
- `main()` wraps graph execution in `traceAgent(name, command, fn)`
- Updates `updateAgentState()` fire-and-forget on completion
- Imports from `../shared/observability.js` and `../shared/memory.js`

### `graph.ts`

- LangGraph-inspired state machine (function composition, not the library)
- Exports `run<Name>Graph(command): Promise<<Name>State>`
- Exports the `<Name>State` type
- Each node is `async function <name>Node(state) → state`
- Errors within nodes push to `state.errors` instead of throwing (resilience)

### `tools.ts`

- Wraps external services: Anthropic, Exa, Firecrawl, HITL, Mem0
- Each tool wrapped in `traceToolCall(null, name, fn)` for Langfuse
- Exports typed result schemas (Zod)
- Helper `callClaudeJson<T>(toolName, userPrompt, schema, maxTokens)` for JSON-mode responses
- Balanced-brace JSON extraction (NOT regex) for robustness

### `prompts.ts`

- `<NAME>_SYSTEM_PROMPT` constant
- Per-action user prompt templates as functions
- Docstrings explaining design rationale

### `__tests__/<name>.test.ts`

- Vitest suite, 50-400 tests
- ALL external deps mocked: Anthropic SDK, Exa, Firecrawl, Mem0, HITL, DB, Redis, fetch
- `beforeEach(() => { Object.assign(process.env, ALL_ENV); /* mockReset all */ })`
- Test categories: schemas, schedule, tools, graph nodes, report generation, full graph integration

### Orchestrator registration

Every new agent must:

1. Add to `orchestrator/scheduler.ts` SCHEDULE constant:
   ```ts
   <name>_<command>: { interval: '<cron>', agent: '<name>', command: '<command>' },
   ```

2. Add to `resolveAgentScript()`:
   ```ts
   if (agent === '<name>') return path.resolve(__dirname, '../agents/<name>/index.ts')
   ```

3. Add to `package.json` scripts:
   ```json
   "<name>": "tsx agents/<name>/index.ts",
   "<name>:<command>": "tsx agents/<name>/index.ts <command>"
   ```

---

## Shared Infrastructure Modules (`agents/shared/`)

| Module | Exports | Notes |
|---|---|---|
| `config.ts` | `getConfig()`, `resetConfig()`, `SETTLEGRID_ICP` | Required env vars listed below |
| `memory.ts` | `getMemoryManager()`, `updateAgentState()`, `rememberX/searchX/recallX` helpers | Mem0-backed, fire-and-forget on failure |
| `hitl.ts` | `getHITLManager()`, `HITLManager` class | JSON file-backed queue at `data/hitl-queue.json` |
| `observability.ts` | `traceAgent()`, `traceToolCall()`, `resetLangfuse()` | Graceful degradation if Langfuse unreachable |
| `email.ts` | `sendEmail()`, `sendInternalAlert()`, template helpers | Resend-backed |
| `db.ts` | Read-only Pool + query helpers | No write functions exposed |
| `redis.ts` | Upstash REST client + `fetchAllCrawlerStates()`, `publishIndexerQualityScores()` | |
| `guardrails.ts` | `sanitizeForExternal()`, `checkContentQuality()`, `isBlockedChannel()` | PII redaction, channel blocklist (MCP block incident) |

---

## Required Environment Variables

### Agents repo (`/Users/lex/settlegrid-agents/.env`)

**Required (9):**
- `ANTHROPIC_API_KEY`
- `EXA_API_KEY`
- `FIRECRAWL_API_KEY` (can be `placeholder-add-when-needed`)
- `MEM0_API_KEY`
- `LANGFUSE_PUBLIC_KEY`
- `LANGFUSE_SECRET_KEY`
- `RESEND_API_KEY`
- `SETTLEGRID_SUPABASE_URL`
- `SETTLEGRID_SUPABASE_ANON_KEY`

**Optional:**
- `LANGFUSE_HOST` (default: `https://us.cloud.langfuse.com`)
- `SETTLEGRID_API_URL` (default: `https://settlegrid.ai`)
- `HITL_NOTIFICATION_EMAIL` (default: `luther@settlegrid.ai`)
- `DATABASE_URL` (direct Postgres for Indexer read-only)
- `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`
- `CRON_SECRET`
- `GITHUB_TOKEN` (recommended for GitHub API in Templater)

### Web repo (`/Users/lex/settlegrid/apps/web/.env.local`)

Already configured. Templater agent will share secrets via the same `.env` pattern.

---

## Git & Commit Conventions

- **Branch:** work on a dedicated branch per phase (`phase-1-foundation`, `phase-2-distribution`, etc.) or per prompt if the phase branch grows large
- **Commit subject:** `<area>: <imperative summary>`, ≤72 chars
  - Examples: `templater: scaffold graph.ts and index.ts`, `sdk: add payment capability exports`, `gallery: seed 20 canonical templates`
- **Commit body:** WHY, not what. Wrap at 72.
- **Trailers:**
  - `Refs: P<phase>.<num>`
  - `Audits: spec-diff PASS, hostile PASS, tests PASS`
  - `Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>` when AI-assisted
- **Never force-push** on `main`. Force-push on phase branches only with explicit intent.
- **Never commit** `.env`, secrets, `node_modules`, `dist/`, `tsconfig.tsbuildinfo`.

---

## Common Pitfalls (from prior sessions)

1. **`tsconfig.tsbuildinfo` drift.** If typecheck is weirdly fast or slow, delete it and re-run.
2. **pnpm vs npm in `settlegrid-agents`.** Scripts use `npm run` pattern. Check `package.json` before invoking.
3. **Mem0 / Langfuse downtime.** Never let observability failures crash the agent. Wrap in try/catch, log, continue.
4. **Claude rate limits on Opus 4.6.** Templater scale runs MUST implement exponential backoff and a budget cap. Hitting the cap = stop, not retry.
5. **SDK breaking changes.** `packages/mcp` tests must run before any template regeneration. A bad SDK release can silently invalidate 1,022 templates.
6. **`scripts/gen/core.mjs` quirks.** Already handles 1,022 servers via batch specs. Don't rewrite from scratch; wrap/extend.
7. **HITL queue growth.** Every agent creates HITL items; Templater will create a lot. Include a bulk-approve path early.
8. **Template license hygiene.** Canonical templates must be MIT. Upstream licenses MUST be preserved when porting.
9. **Shadow directory crawl politeness.** Respect `robots.txt`, cap concurrency, identify the crawler in `User-Agent`.
10. **Anthropic Skills cross-compatibility.** Spec is evolving. Pin the version the Skill targets in the Skill file header.
11. **JSON parsing from Claude responses.** Use balanced-brace extraction, not greedy regex. Learned from Indexer's first-run failure.
12. **mockClear() doesn't reset mockResolvedValueOnce queues.** Use `mockReset()` in `beforeEach` when tests have cross-pollution.
13. **Route vs test schema mismatch.** When adding tier checks to a route, update tests to queue the tier query mock first.
14. **Blog post pattern.** `apps/web/src/lib/blog-bodies/*.md` registered in `apps/web/src/lib/blog-posts.ts`. Academy follows same pattern.
15. **HITL Tier 3 email notification.** Wire through `sendInternalAlert` for urgent alerts, but never let email failure crash the request.

---

## MCP GitHub Org Block Incident (Read Before Content Prompts)

On 2026-04-07, the founder was blocked from the `modelcontextprotocol` GitHub org by a maintainer because an AI-drafted community post was perceived as promotional/spammy, even though intended as genuine.

**Durable rule (enforced in `guardrails.ts isBlockedChannel()`):** No AI-drafted content for external community feeds (GitHub issues, Discord, Reddit, HN, SO, dev.to comments). Agents may DRAFT content for founder review, but founder rewrites before posting to any community channel.

**Applies to Quantum Leap:** Phase 3 WG outreach emails, Phase 4 Show HN post, Phase 4 X thread, any community forum post. All must be drafted as content prompts and explicitly marked "requires founder review and rewrite before publishing."

**Does NOT apply to:** SettleGrid's own blog, SettleGrid's docs, code comments, README files in SettleGrid-owned repos, internal memos.

**End of shared context.**
