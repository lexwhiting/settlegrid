# EXECUTION-GRADE AI EMPLOYEE DEPLOYMENT PLAN

## SettleGrid.ai Only -- Maximum Growth Strategy

### Version 3.1 -- Full Implementation Specification with Claude Code Prompts

> **Historical snapshot (2026-04-15).** This deployment plan is the
> canonical source document for the AI Employee agent system in
> `/Users/lex/settlegrid-agents/`. It was drafted before P1.MKT1 and
> embeds the original "15 payment protocols in one SDK" marketing claim
> with the full retired name list (MPP, Mastercard Agent Pay, Circle
> Nano, Alipay Trust, REST, EMVCo) throughout the system-prompt samples,
> Zod schema enum, numbered protocol lists, and code-block examples.
>
> The canonical rename and honest-framing mapping is in
> [audits/15-protocol-claim.md](audits/15-protocol-claim.md). The
> live code in the agents repo (BEACON_SYSTEM_PROMPT, PROTOCOL_SYSTEM_PROMPT,
> SETTLEGRID_ICP.protocols) has been migrated. This plan document is
> preserved as a drafting-era snapshot rather than rewritten in place
> — if you are building against the plan, treat the code in the agents
> repo as the source of truth and treat this doc's protocol names as
> historical references.

---

## TABLE OF CONTENTS

1. Strategic Context & Deployment Philosophy
2. Agent Roster -- 10 Agents, Phased Deployment
3. Infrastructure Setup -- Complete Environment Bootstrap
4. Prompt 1: Project Bootstrap
5. Prompt 2: Mem0 Schema & Memory System
6. Prompt 3: HITL Approval System
7. Prompt 4: Build Beacon Agent (Content & DevRel)
8. Prompt 5: Build Protocol Agent (Payment Protocol Intelligence)
9. Prompt 6: Orchestration & Daily Briefing System
10. Prompt 7: Observability & Evaluation (Langfuse)
11. Future Phase Prompts (Scout, Welcome, Support, Marketplace)
12. Cost Model
13. Phased Rollout -- Week-by-Week with Success Criteria
14. Risk Registry & Mitigation Protocols

---

## 1. STRATEGIC CONTEXT & DEPLOYMENT PHILOSOPHY

### Current State (April 2026)

- **Users:** 2 organic signups, 0 from outreach
- **Revenue:** $0
- **Tools indexed:** 1,444+ (29 active, 424+ unclaimed, 991 templates)
- **Outreach sent:** 234 emails, 0 claims
- **Infrastructure:** 25+ crons, crawlers across 11 sources, progressive pagination
- **Email:** DMARC/SPF/DKIM verified, click tracking enabled, `mail.settlegrid.ai` subdomain

### Why Only 2 Agents Now

Deploying growth automation before product-market fit is validated means automating an unproven loop. The two agents selected for Phase 1 are chosen because they build **compounding assets** regardless of PMF status:

1. **Beacon** creates content that builds SEO authority and developer mindshare. Even if the product pivots, the content establishes credibility.
2. **Protocol** monitors the 15 payment protocols SettleGrid integrates. Spec changes affect the product directly -- missing an x402 v2 breaking change could break production.

Every other agent is deferred until there's evidence the core loop works (developers discover SettleGrid, claim tools, earn revenue).

### Deployment Phases

| Phase | Agents | Trigger to Deploy | Est. Cost |
|-------|--------|-------------------|-----------|
| 1 (Now) | Beacon, Protocol | Immediate | $120-160/mo |
| 2 (10+ paying customers) | Scout, Welcome, Support | Manual promotion | +$100-150/mo |
| 3 (50+ customers) | Marketplace, Health, Pulse | Manual promotion | +$100-130/mo |
| 4 (Scale) | Radar, Guardian | Manual promotion | +$80-120/mo |

### Integration with Existing Infrastructure

**Critical principle:** Agents must use existing SettleGrid infrastructure where it exists. No parallel systems.

| Function | Existing System | Agent Should Use |
|----------|----------------|-----------------|
| Email sending | Resend (`mail.settlegrid.ai`) | Resend API, NOT AgentMail |
| Tool discovery | 11 crawlers + Redis pagination | Existing crawl data, NOT Exa duplication |
| Database | Supabase (Drizzle ORM) | Read via Supabase client or API |
| Caching/state | Upstash Redis | Existing Redis instance |
| Monitoring | Sentry + PostHog | Existing dashboards |

---

## 2. AGENT ROSTER -- 10 AGENTS, PHASED DEPLOYMENT

### Phase 1: Compounding Assets (Deploy Now)

**Agent #1: "Beacon" -- Content & Developer Relations**
- Creates developer tutorials, protocol explainers, comparison posts
- Researches trending topics in MCP/AI tooling/agent payments
- Drafts content for Luther's review (all content is Tier 3 gated)
- Monitors community discussions for content opportunities

**Agent #2: "Protocol" -- Payment Protocol Intelligence**
- Monitors all 15 payment protocol specs for changes
- Tracks GitHub repos, spec documents, blog posts, social discussion
- Classifies changes by severity and impact on SettleGrid
- Alerts Luther to breaking changes, new protocol versions, competitor implementations

### Phase 2: Growth Engine (After 10+ Paying Customers)

**Agent #3: "Scout" -- Developer Prospecting**
- Finds developers with MCP servers, AI tools, APIs that lack monetization
- Enriches prospects with email, company, qualification score
- Drafts personalized outreach (integrated with existing Resend pipeline)
- MUST deduplicate against existing crawl database to avoid double-contacting

**Agent #4: "Welcome" -- Onboarding & Activation**
- Trigger-based: fires when new signup detected
- Sends personalized welcome sequence based on signup source
- Monitors activation milestones: account created, first tool wrapped, first metered call, first payout
- Nudges if milestones stall (48h without next step)

**Agent #5: "Support" -- Tier-1 Customer Support**
- Responds to incoming support emails within 5 minutes
- Knowledge base: integration guide, SDK reference, payment protocol docs, pricing FAQ
- Confidence threshold: >90% autonomous, 70-90% flagged for review, <70% escalated
- Escalation triggers: billing disputes, refund requests, bug reports, legal questions

### Phase 3: Retention & Operations (After 50+ Customers)

**Agent #6: "Marketplace" -- Tool Discovery & Distribution**
- Generates SEO pages for categories, framework integrations, collections
- Calculates trending tools, refreshes weekly
- Audits catalog quality (dead links, missing descriptions, stale tools)

**Agent #7: "Health" -- Tool Monitoring & Developer Success**
- Health checks on claimed tools (uptime, latency, error rate)
- Alerts developers when their tools degrade
- Failover detection: when a tool goes down, notify alternatives

**Agent #8: "Pulse" -- Retention & Expansion**
- Monitors engagement signals (API calls, logins, tool additions)
- Identifies churn risk (declining volume, no activity in 7+ days)
- Identifies expansion signals (approaching tier limit, growing volume)
- Sends re-engagement emails using pre-approved templates

### Phase 4: Intelligence & Scale (At Scale)

**Agent #9: "Radar" -- Competitive Intelligence**
- Monitors competitors: Kite, Sponge, x402 direct, Composio, Stripe agent commerce
- Tracks pricing changes, feature launches, funding, hiring patterns
- Weekly intelligence report

**Agent #10: "Guardian" -- Quality & Compliance**
- Reviews all agent outputs before they reach external recipients
- Verifies payment protocol claims are accurate, pricing is current, code examples compile
- Checks for spam indicators, brand voice consistency
- Blocks outputs that fail quality checks

---

## 3. INFRASTRUCTURE SETUP

### 3.1 Required Accounts & API Keys (Phase 1 Only)

| Service | URL | Plan | Est. Monthly Cost | Env Variable |
|---------|-----|------|-------------------|-------------|
| Anthropic (Claude API) | console.anthropic.com | Pay-as-you-go | $50-80 | `ANTHROPIC_API_KEY` |
| Exa | dashboard.exa.ai | Pay-as-you-go | $15-30 | `EXA_API_KEY` |
| Firecrawl | firecrawl.dev | Standard ($83/mo) | $83 | `FIRECRAWL_API_KEY` |
| Mem0 | app.mem0.ai | Platform (pay-as-you-go) | $10-15 | `MEM0_API_KEY` |
| Langfuse | cloud.langfuse.com | Hobby (free) | $0 | `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY` |

**Total Phase 1 infrastructure: $158-208/month** (excluding Firecrawl if using existing crawlers for most tasks, total drops to $75-125/mo)

**NOT included (use existing SettleGrid infrastructure instead):**
- AgentMail -- use Resend (already verified with DMARC/SPF/DKIM on `mail.settlegrid.ai`)
- monid.ai -- defer to Phase 2 (Scout needs social monitoring, Beacon does not)
- E2B -- defer to Phase 3 (Marketplace needs sandboxed code execution)

### 3.2 Project Structure

```
settlegrid-agents/
|-- agents/
|   |-- shared/
|   |   |-- config.ts              # Shared configuration
|   |   |-- memory.ts              # Mem0 client & schema helpers
|   |   |-- tools.ts               # Shared tool definitions
|   |   |-- hitl.ts                # Human-in-the-loop approval system
|   |   |-- observability.ts       # Langfuse tracing wrapper
|   |   |-- guardrails.ts          # Input/output validation
|   |   |-- email.ts               # Resend integration (uses existing settlegrid keys)
|   |-- beacon/                    # Agent #1: Content & DevRel
|   |   |-- index.ts
|   |   |-- graph.ts               # LangGraph workflow
|   |   |-- prompts.ts             # System prompts & templates
|   |   |-- tools.ts               # Agent-specific tools
|   |   |-- __tests__/
|   |-- protocol/                  # Agent #2: Payment Protocol Intelligence
|   |   |-- index.ts
|   |   |-- graph.ts
|   |   |-- prompts.ts
|   |   |-- tools.ts
|   |   |-- __tests__/
|-- orchestrator/
|   |-- scheduler.ts               # Cron/event-based agent scheduling
|   |-- event-bus.ts               # Inter-agent communication
|   |-- briefing.ts                # Daily briefing generator
|-- dashboard/
|   |-- hitl-queue.ts              # Pending approval queue
|   |-- metrics.ts                 # KPI dashboard
|-- .env                           # API keys (never commit)
|-- .env.example                   # Template
|-- package.json
|-- tsconfig.json
```

---

## 4. PROMPT 1: PROJECT BOOTSTRAP

```
PROMPT 1: PROJECT BOOTSTRAP

You are building an AI agent workforce system for SettleGrid.ai (AI payment
infrastructure for tool monetization). This is a TypeScript project using
LangGraph for agent workflows, Mem0 for shared memory, Langfuse for
observability, and Resend for email delivery.

TASK: Initialize the project with the following requirements:

1. Create the directory structure:
   settlegrid-agents/
   |-- agents/shared/ (config.ts, memory.ts, tools.ts, hitl.ts,
       observability.ts, guardrails.ts, email.ts)
   |-- agents/ (2 agent directories: beacon, protocol)
   |-- orchestrator/ (scheduler.ts, event-bus.ts, briefing.ts)
   |-- dashboard/ (hitl-queue.ts, metrics.ts)

2. Install dependencies:
   npm init -y
   npm install @langchain/langgraph @langchain/anthropic @langchain/core
   npm install @anthropic-ai/sdk
   npm install exa-js firecrawl mem0ai langfuse resend
   npm install zod dotenv node-cron uuid
   npm install -D typescript @types/node @types/uuid tsx vitest

3. Create tsconfig.json with:
   - target: ES2022
   - module: NodeNext
   - moduleResolution: NodeNext
   - strict: true
   - outDir: ./dist
   - rootDir: ./
   - esModuleInterop: true
   - resolveJsonModule: true
   - declaration: true
   - sourceMap: true
   - skipLibCheck: true

4. Create .env.example with all required API key placeholders:
   ANTHROPIC_API_KEY=
   EXA_API_KEY=
   FIRECRAWL_API_KEY=
   MEM0_API_KEY=
   LANGFUSE_PUBLIC_KEY=
   LANGFUSE_SECRET_KEY=
   LANGFUSE_HOST=https://cloud.langfuse.com
   RESEND_API_KEY=
   SETTLEGRID_API_URL=https://settlegrid.ai
   SETTLEGRID_SUPABASE_URL=
   SETTLEGRID_SUPABASE_ANON_KEY=
   HITL_NOTIFICATION_EMAIL=luther@settlegrid.ai

5. Create agents/shared/config.ts that:
   - Loads all env vars with dotenv
   - Validates ALL required keys are present (throw clear error with the
     specific missing key name for each one)
   - Exports a typed configuration object:
     ```typescript
     export interface AgentConfig {
       anthropic: { apiKey: string }
       exa: { apiKey: string }
       firecrawl: { apiKey: string }
       mem0: { apiKey: string }
       langfuse: { publicKey: string; secretKey: string; host: string }
       resend: { apiKey: string }
       settlegrid: {
         apiUrl: string
         supabaseUrl: string
         supabaseAnonKey: string
       }
       hitl: { notificationEmail: string }
     }
     ```
   - Exports a singleton `getConfig()` function that validates once and caches
   - Include product-specific constants:
     ```typescript
     export const SETTLEGRID_ICP = {
       segments: [
         'mcp_server_developers',
         'ai_model_creators',
         'api_builders',
         'agent_framework_builders'
       ] as const,
       signals: {
         mcp_server_developers: 'Published MCP server on GitHub without billing',
         ai_model_creators: 'Models with downloads but no monetization',
         api_builders: 'Public APIs without usage-based pricing',
         agent_framework_builders: 'Framework plugin/tool repos'
       },
       pricing: {
         free: { price: 0, ops: 50_000 },
         builder: { price: 19, ops: 200_000 },
         scale: { price: 79, ops: 2_000_000 }
       },
       takeRate: [
         { upTo: 1_000, rate: 0 },
         { upTo: 10_000, rate: 0.02 },
         { upTo: 50_000, rate: 0.025 },
         { above: 50_000, rate: 0.05 }
       ],
       protocols: [
         'MCP', 'MPP', 'x402', 'AP2', 'Visa TAP', 'UCP', 'ACP',
         'Mastercard Agent Pay', 'Circle Nano', 'REST', 'L402',
         'Alipay Trust', 'KYAPay', 'EMVCo', 'DRAIN'
       ] as const
     } as const
     ```

6. Create agents/shared/observability.ts that:
   - Initializes Langfuse client using config
   - Exports a `traceAgent(agentName, action, fn)` wrapper that:
     - Creates a Langfuse trace with agent name and action
     - Creates a span for the action
     - Times execution with `performance.now()`
     - Logs success/failure status
     - Captures token usage if the function returns it
     - Returns the result
     - Calls `langfuse.flush()` in a finally block
   - Exports a `traceToolCall(parentSpan, toolName, fn)` wrapper for
     individual tool calls within an agent run
   - All Langfuse calls must be wrapped in try/catch -- observability
     failures must NEVER crash the agent

7. Create agents/shared/email.ts that:
   - Imports Resend and initializes with config.resend.apiKey
   - Exports `sendEmail(params: { to: string; subject: string; html: string;
     from?: string; replyTo?: string })` that:
     - Defaults `from` to 'Luther from SettleGrid <luther@mail.settlegrid.ai>'
     - Defaults `replyTo` to 'luther@settlegrid.ai'
     - Returns { success: boolean; id?: string; error?: string }
     - Never throws -- logs errors and returns { success: false }
   - Exports `sendInternalAlert(subject: string, body: string)` that sends
     to config.hitl.notificationEmail

8. Create agents/shared/guardrails.ts that:
   - Exports `validateOutput(schema: ZodSchema, data: unknown)` that:
     - Parses data against the schema
     - Returns { valid: true, data: T } or { valid: false, errors: string[] }
     - Never throws
   - Exports `sanitizeForExternal(text: string)` that:
     - Removes any PII patterns (email addresses, phone numbers)
     - Removes any internal URLs (localhost, staging)
     - Removes any API keys or tokens (pattern: sk-, pk_, etc.)
     - Returns the sanitized string
   - Exports `checkContentQuality(content: string)` that returns a score
     0-100 based on:
     - Length (>200 chars = 20 points)
     - No template literals remaining like {variable} (20 points)
     - No lorem ipsum or placeholder text (20 points)
     - Proper sentence structure (20 points)
     - No excessive caps or exclamation marks (20 points)

9. Add scripts to package.json:
   ```json
   {
     "scripts": {
       "build": "tsc",
       "dev": "tsx watch orchestrator/scheduler.ts",
       "beacon": "tsx agents/beacon/index.ts",
       "beacon:research": "tsx agents/beacon/index.ts research",
       "beacon:draft": "tsx agents/beacon/index.ts draft",
       "protocol": "tsx agents/protocol/index.ts",
       "protocol:scan": "tsx agents/protocol/index.ts scan",
       "protocol:report": "tsx agents/protocol/index.ts report",
       "briefing": "tsx orchestrator/briefing.ts",
       "hitl": "tsx dashboard/hitl-queue.ts",
       "hitl:list": "tsx dashboard/hitl-queue.ts list",
       "hitl:approve": "tsx dashboard/hitl-queue.ts approve",
       "hitl:reject": "tsx dashboard/hitl-queue.ts reject",
       "test": "vitest run",
       "test:watch": "vitest",
       "typecheck": "tsc --noEmit"
     }
   }
   ```

AUDIT AFTER COMPLETION:

Run each of these checks and fix any failures before reporting success:

1. Directory structure:
   - [ ] Verify agents/shared/ contains exactly 7 files:
         config.ts, memory.ts, tools.ts, hitl.ts, observability.ts,
         guardrails.ts, email.ts
   - [ ] Verify agents/ contains exactly 2 agent directories:
         beacon/, protocol/
   - [ ] Verify orchestrator/ contains exactly 3 files:
         scheduler.ts, event-bus.ts, briefing.ts
   - [ ] Verify dashboard/ contains exactly 2 files:
         hitl-queue.ts, metrics.ts

2. Dependencies:
   - [ ] Run: npm ls --depth=0 -- verify all listed packages are installed
   - [ ] Verify no peer dependency warnings

3. TypeScript:
   - [ ] Run: npx tsc --noEmit
   - [ ] Verify ZERO type errors
   - [ ] If any errors, fix them before proceeding

4. Configuration:
   - [ ] Verify .env.example contains exactly 11 environment variables
   - [ ] Create a test: instantiate getConfig() with all vars set to
         'test-value' and verify it returns without error
   - [ ] Create a test: instantiate getConfig() with ANTHROPIC_API_KEY
         missing and verify it throws with message containing
         'ANTHROPIC_API_KEY'
   - [ ] Run the tests: npx vitest run

5. Observability:
   - [ ] Verify traceAgent() returns the function's result unchanged
   - [ ] Verify traceAgent() does not throw when Langfuse client is
         misconfigured (graceful degradation)
   - [ ] Write a test that calls traceAgent with a mock function and
         verifies the result is passed through

6. Email:
   - [ ] Verify sendEmail() returns { success: false } when Resend API
         key is invalid (not throw)
   - [ ] Verify sendEmail() defaults from/replyTo correctly
   - [ ] Write a test with a mocked Resend client

7. Guardrails:
   - [ ] Test validateOutput with a valid Zod schema and valid data
   - [ ] Test validateOutput with invalid data -- verify errors array
   - [ ] Test sanitizeForExternal removes 'sk-abc123' from text
   - [ ] Test sanitizeForExternal removes 'user@example.com' from text
   - [ ] Test sanitizeForExternal removes 'http://localhost:3000' from text
   - [ ] Test checkContentQuality returns >80 for real content
   - [ ] Test checkContentQuality returns <40 for '{placeholder} lorem ipsum'
   - [ ] Run all tests: npx vitest run
   - [ ] Verify ALL tests pass with 0 failures

8. Final verification:
   - [ ] Run: npx tsc --noEmit -- zero errors
   - [ ] Run: npx vitest run -- all tests pass
   - [ ] Run: node -e "require('./agents/shared/config.ts')" -- verify
         it throws a clear error about missing env vars (not a
         compilation error)
```

---

## 5. PROMPT 2: MEM0 SCHEMA & MEMORY SYSTEM

```
PROMPT 2: MEMORY SYSTEM SETUP

Context: You are building a shared memory system for 2 AI agents (Beacon and
Protocol) serving SettleGrid.ai. The memory system uses Mem0 for persistent
storage with typed Zod schemas for data integrity.

PREREQUISITES: Prompt 1 must be completed. Verify by running:
- npx tsc --noEmit (zero errors)
- npx vitest run (all tests pass)
If either fails, fix Prompt 1 issues first.

TASK: Implement agents/shared/memory.ts with the following Mem0 schema:

MEMORY NAMESPACES (use user_id to isolate):

1. "tool:{tool_id}" -- SettleGrid tool catalog intelligence
   Fields: tool_name (string), developer_email (string | null),
   category (string), framework (string | null),
   protocol (string), call_volume_30d (number),
   revenue_30d (number), health_score (number, 0-100),
   competitors (string[]), trending_rank (number | null),
   last_health_check (string, ISO date)

2. "prospect:{email}" -- Developer prospect information
   Fields: name (string), email (string), company (string | null),
   source (enum: 'github' | 'social' | 'inbound' | 'referral' | 'crawl'),
   qualification_score (number, 0-100),
   tools_built (string[]), frameworks_used (string[]),
   last_contact_date (string | null, ISO date),
   next_action (string | null), assigned_agent (string | null),
   notes (string | null),
   outreach_status (enum: 'new' | 'contacted' | 'replied' | 'converted' | 'unresponsive')

3. "competitor:{name}" -- Competitive intelligence
   Fields: name (string),
   last_pricing (string | null), last_feature_launch (string | null),
   funding_total (string | null),
   employee_count (number | null), recent_news (string[]),
   threat_level (enum: 'low' | 'medium' | 'high'),
   last_updated (string, ISO date)

4. "content:{content_id}" -- Content pipeline
   Fields: title (string),
   type (enum: 'blog' | 'tutorial' | 'newsletter' | 'social' | 'docs'),
   status (enum: 'idea' | 'researching' | 'draft' | 'review' | 'approved' | 'published'),
   target_keywords (string[]),
   created_by_agent (string),
   review_notes (string | null),
   published_date (string | null, ISO date),
   published_url (string | null),
   performance_metrics (object | null: { views?: number, clicks?: number, signups?: number })

5. "protocol_change:{change_id}" -- Payment protocol changes
   Fields: protocol_name (string, one of the 15 SettleGrid protocols),
   change_type (enum: 'spec_update' | 'breaking_change' | 'new_version' |
     'deprecation' | 'security_advisory' | 'competitor_implementation'),
   severity (enum: 'info' | 'low' | 'medium' | 'high' | 'critical'),
   title (string), summary (string),
   source_url (string), detected_date (string, ISO date),
   impact_on_settlegrid (string),
   action_required (boolean),
   action_taken (string | null),
   resolved (boolean)

6. "agent_state:{agent_name}" -- Agent operational state
   Fields: last_run (string, ISO date),
   last_success (string | null, ISO date),
   error_count_24h (number),
   actions_taken_today (number),
   pending_hitl_count (number),
   performance_score_7d (number, 0-100)

IMPLEMENTATION REQUIREMENTS:

a) Create a MemoryManager class that wraps the Mem0 client:
   - constructor(config: AgentConfig) -- initializes Mem0 with API key
   - add(namespace: string, id: string, data: Record<string, unknown>,
     metadata?: Record<string, unknown>) -- validates against schema,
     stores with metadata, returns stored record
   - get(namespace: string, id: string) -- retrieves specific record,
     returns typed result or null
   - search(namespace: string, query: string, limit?: number) --
     semantic search within namespace, returns typed results
   - update(namespace: string, id: string, data: Partial<Record<string, unknown>>) --
     partial update, validates merged result against schema
   - list(namespace: string, filter?: Record<string, unknown>) --
     list all in namespace with optional filter
   - delete(namespace: string, id: string) -- removes record

b) Each memory operation must:
   - Be wrapped in try/catch with descriptive error logging
   - Include Langfuse trace span via traceToolCall()
   - Validate data against the Zod schema for its namespace BEFORE write
   - Return typed results (not `any`)
   - Log the namespace, id, and operation type for debugging

c) Create Zod schemas for each namespace:
   - ToolSchema, ProspectSchema, CompetitorSchema, ContentSchema,
     ProtocolChangeSchema, AgentStateSchema
   - Each schema must use z.object() with all fields defined
   - Enums must use z.enum() with the exact values listed above
   - Dates must be z.string().datetime() or z.string().nullable()
   - Numbers with ranges must use z.number().min().max()

d) Export convenience functions:
   - rememberTool(toolId, data) -> add to tool namespace
   - recallTool(toolId) -> get from tool namespace
   - searchTools(query, limit?) -> search tool namespace
   - rememberProspect(email, data) -> add to prospect namespace
   - recallProspect(email) -> get from prospect namespace
   - searchProspects(query, limit?) -> search prospect namespace
   - rememberProtocolChange(changeId, data) -> add to protocol_change namespace
   - searchProtocolChanges(query, limit?) -> search protocol_change namespace
   - rememberContent(contentId, data) -> add to content namespace
   - searchContent(query, limit?) -> search content namespace
   - updateAgentState(agentName, data) -> update agent_state namespace
   - getAgentState(agentName) -> get from agent_state namespace

e) Create a schema registry:
   ```typescript
   const SCHEMA_REGISTRY: Record<string, ZodSchema> = {
     tool: ToolSchema,
     prospect: ProspectSchema,
     competitor: CompetitorSchema,
     content: ContentSchema,
     protocol_change: ProtocolChangeSchema,
     agent_state: AgentStateSchema
   }
   ```
   The MemoryManager.add() and .update() methods must look up the schema
   from this registry based on the namespace prefix (e.g., "tool:xyz" -> ToolSchema)

AUDIT AFTER COMPLETION:

1. Schema validation:
   - [ ] Write a test for each of the 6 Zod schemas with VALID data
         and verify it parses successfully
   - [ ] Write a test for each schema with INVALID data (wrong types,
         missing required fields, out-of-range numbers, invalid enums)
         and verify it returns errors (not throws)
   - [ ] Specifically test:
         - ToolSchema: health_score must be 0-100
         - ProspectSchema: qualification_score must be 0-100
         - ProspectSchema: source must be one of the 5 enum values
         - ProtocolChangeSchema: severity must be one of 5 enum values
         - ProtocolChangeSchema: protocol_name must be one of the 15 protocols
         - AgentStateSchema: performance_score_7d must be 0-100

2. MemoryManager:
   - [ ] Write a test: MemoryManager.add() with valid data returns the
         stored record with all fields intact
   - [ ] Write a test: MemoryManager.add() with invalid data returns an
         error (not stores corrupted data)
   - [ ] Write a test: MemoryManager.get() returns null for non-existent
         records (not throws)
   - [ ] Write a test: MemoryManager.update() with a partial update
         validates the MERGED result (not just the partial)
   - [ ] Mock the Mem0 client for all tests (do not call real API)

3. Convenience functions:
   - [ ] Write a test: rememberTool("test-tool", validData) calls
         MemoryManager.add() with namespace "tool:test-tool"
   - [ ] Write a test: recallTool("test-tool") calls MemoryManager.get()
         with namespace "tool:test-tool"
   - [ ] Write a test: rememberProspect("dev@example.com", validData)
         stores with namespace "prospect:dev@example.com"

4. Schema registry:
   - [ ] Write a test: adding data with namespace "tool:xyz" validates
         against ToolSchema
   - [ ] Write a test: adding data with namespace "prospect:abc" validates
         against ProspectSchema
   - [ ] Write a test: adding data with unknown namespace prefix throws
         a descriptive error

5. Final:
   - [ ] Run: npx tsc --noEmit -- zero type errors
   - [ ] Run: npx vitest run -- ALL tests pass, zero failures
   - [ ] Verify no `any` types in memory.ts (grep for ': any' and
         'as any' -- should return zero results in this file)
```

---

## 6. PROMPT 3: HITL APPROVAL SYSTEM

```
PROMPT 3: HUMAN-IN-THE-LOOP APPROVAL SYSTEM

Context: 2 AI agents (expandable to 10) need a structured approval system
with three tiers. This serves SettleGrid.ai only.

PREREQUISITES: Prompts 1-2 must be completed. Verify:
- npx tsc --noEmit (zero errors)
- npx vitest run (all pass)

TASK: Implement agents/shared/hitl.ts and dashboard/hitl-queue.ts

TIER DEFINITIONS:

Tier 1 -- AUTONOMOUS (logged, auditable, no approval needed):
- Internal data gathering and research
- Memory reads and writes
- Protocol monitoring and change detection
- Content topic research (not drafting)
- Agent state updates
- Internal analytics and reporting

Tier 2 -- SUPERVISED (agent acts, Luther reviews within 24 hours):
- Content drafts (held for review before publish)
- Outreach emails using pre-approved templates
- Tool health alerts to developers
- Protocol change alerts (non-breaking)
- Social media monitoring reports

Tier 3 -- GATED (agent prepares, Luther must approve BEFORE action):
- All content published under brand name
- Any outreach to a new prospect category never seen before
- Protocol change recommendations that affect SettleGrid implementation
- Competitive response strategies
- Any financial or binding commitment
- Upgrade/pricing communications

IMPLEMENTATION:

a) Create ApprovalRequest type:
   ```typescript
   interface ApprovalRequest {
     id: string                    // uuid
     agent: string                 // agent name
     tier: 1 | 2 | 3
     action_type: string           // e.g., 'publish_content', 'send_outreach'
     summary: string               // human-readable description (1-2 sentences)
     full_payload: unknown         // the actual content/action to execute
     created_at: Date
     status: 'pending' | 'approved' | 'rejected' | 'expired' | 'auto_approved'
     reviewed_at?: Date
     reviewer_notes?: string
     expires_at: Date              // 24h for Tier 2, 72h for Tier 3
     execution_result?: unknown
   }
   ```

b) Create HITLManager class:
   - constructor() -- initializes with a file-based JSON store at
     ./data/hitl-queue.json (create directory if not exists)

   - requestApproval(agent, tier, action_type, summary, payload) ->
     ApprovalRequest:
     - Tier 1: auto-approve immediately, log to Langfuse, return
       with status 'auto_approved'
     - Tier 2: store in queue, proceed with action, mark for post-review.
       Log to Langfuse with tag 'needs_review'
     - Tier 3: store in queue, BLOCK execution, return with status
       'pending'. Send email notification to Luther via sendInternalAlert()
       with subject "[HITL Tier 3] {agent}: {summary}"

   - approve(requestId, notes?) -> executes the queued action if Tier 3,
     marks as approved, logs to Langfuse

   - reject(requestId, notes?) -> marks rejected, notifies agent via
     agent_state memory update, logs to Langfuse

   - getPending(tier?) -> returns all pending requests, sorted by tier
     (Tier 3 first, then Tier 2), then by created_at ascending

   - getHistory(agent?, days?) -> returns historical requests for audit

   - expireStale() -> marks any pending requests past their expires_at
     as 'expired', logs warning. Called by scheduler every hour.

c) Create notification system:
   - When Tier 3 request created: send immediate email via sendInternalAlert()
     with the summary, agent name, and action type
   - When Tier 2 request created: batch into daily summary (7 AM briefing)
   - Expiration: auto-expire if not reviewed within window, log warning

d) Create dashboard/hitl-queue.ts:
   - CLI interface that displays pending approvals
   - Commands (via process.argv):
     - `list` -- show all pending, grouped by tier, with id, agent,
       summary, age, tier
     - `list --all` -- include historical (last 7 days)
     - `approve <id>` -- approve by id
     - `approve <id> --notes "reason"` -- approve with notes
     - `reject <id>` -- reject by id
     - `reject <id> --notes "reason"` -- reject with reason
     - `history` -- show last 50 actions
     - `history --agent beacon` -- filter by agent
   - Format output as a clean table using console.table or aligned columns
   - Show: id (first 8 chars), agent, tier, action_type, summary (truncated
     to 60 chars), age (e.g., "2h ago", "1d ago")

AUDIT AFTER COMPLETION:

1. Tier behavior:
   - [ ] Write test: Tier 1 requestApproval() returns immediately with
         status 'auto_approved' (no blocking, no queue entry for review)
   - [ ] Write test: Tier 2 requestApproval() stores in queue with status
         'pending' and does NOT block
   - [ ] Write test: Tier 3 requestApproval() stores in queue with status
         'pending' and BLOCKS (does not return execution_result)
   - [ ] Write test: Tier 3 approve() changes status to 'approved' and
         stores reviewer_notes

2. Expiration:
   - [ ] Write test: Tier 2 request created 25 hours ago is marked
         'expired' by expireStale()
   - [ ] Write test: Tier 3 request created 73 hours ago is marked
         'expired' by expireStale()
   - [ ] Write test: Tier 2 request created 23 hours ago is NOT expired
   - [ ] Write test: Tier 3 request created 71 hours ago is NOT expired

3. Queue operations:
   - [ ] Write test: getPending() returns Tier 3 items before Tier 2
   - [ ] Write test: reject() marks status as 'rejected' and stores notes
   - [ ] Write test: getPending() does not return approved/rejected/expired items
   - [ ] Write test: getHistory() returns items from the last N days

4. Notification:
   - [ ] Write test: Tier 3 request triggers sendInternalAlert() call
         (mock the email function)
   - [ ] Write test: Tier 1 request does NOT trigger email

5. CLI:
   - [ ] Verify `tsx dashboard/hitl-queue.ts list` runs without error
         (may show empty queue)
   - [ ] Verify `tsx dashboard/hitl-queue.ts history` runs without error

6. Persistence:
   - [ ] Write test: create a request, restart the HITLManager, verify
         the request is still in the queue (file-based persistence works)
   - [ ] Verify ./data/ directory is in .gitignore

7. Audit trail:
   - [ ] Write test: every approve/reject action has a timestamp in
         reviewed_at
   - [ ] Write test: getHistory() returns items in chronological order

8. Final:
   - [ ] Run: npx tsc --noEmit -- zero type errors
   - [ ] Run: npx vitest run -- ALL tests pass
   - [ ] Run: tsx dashboard/hitl-queue.ts list -- runs without crash
   - [ ] Verify no `any` types in hitl.ts (except full_payload and
         execution_result which are intentionally unknown)
```

---

## 7. PROMPT 4: BUILD BEACON AGENT (Content & DevRel)

```
PROMPT 4: BUILD BEACON AGENT (#1)

Context: Beacon is a content and developer relations agent for SettleGrid.ai
(AI payment infrastructure for tool monetization). It researches trending
topics, drafts developer tutorials and protocol explainers, monitors
community discussions for content opportunities, and submits all drafts
for Luther's review (Tier 3 gated).

PREREQUISITES: Prompts 1-3 must be completed. Verify:
- npx tsc --noEmit (zero errors)
- npx vitest run (all pass)

TASK: Implement agents/beacon/ with 4 files.

FILE 1: agents/beacon/prompts.ts

Export the following system prompt:

```typescript
export const BEACON_SYSTEM_PROMPT = `You are Beacon, a content and developer
relations agent for SettleGrid.ai -- the settlement layer for the AI economy.

ABOUT SETTLEGRID:
- Payment infrastructure for AI tool monetization
- Developers wrap any function with 2 lines of code to add per-call billing
- Smart Proxy at settlegrid.ai/api/proxy/{slug} handles auth, metering, billing
- 15 payment protocols in one SDK: MCP, MPP, x402, AP2, Visa TAP, UCP, ACP,
  Mastercard Agent Pay, Circle Nano, REST, L402, Alipay Trust, KYAPay, EMVCo, DRAIN
- Pricing: Free (50K ops), Builder $19 (200K ops), Scale $79 (2M ops)
- Progressive take rate: 0% first $1K, 2% to $10K, 2.5% to $50K, 5% above
- npm package: @settlegrid/mcp
- 1,444+ tools indexed, 29 active, 991 forkable templates

YOUR ROLE: Research and draft high-quality technical content that positions
SettleGrid as the authoritative voice in AI tool monetization and agent payments.

CONTENT VOICE:
- Technical, developer-friendly, code-first
- Show don't tell -- always include working code examples
- Never use marketing language ("revolutionary", "game-changing", "unleash")
- Never use emojis
- Write like a senior engineer explaining to a peer, not like marketing copy
- Cite specific numbers, protocols, and specs -- never be vague
- When discussing competitors or alternatives, focus on technical trade-offs,
  never disparage

CONTENT TYPES WITH TARGETS:
- Developer tutorial: 1,500-2,500 words with 3+ code blocks
- Protocol explainer: 1,000-1,500 words with comparison table
- State of the market: 1,200-2,000 words with data and trends
- Newsletter section: 200-400 words per item, 5-8 items per issue

SEO REQUIREMENTS:
- Target keyword must appear in title, first paragraph, H2, and meta description
- Use related keywords naturally throughout
- Include internal links to settlegrid.ai pages where relevant
- Canonical URL format: https://settlegrid.ai/learn/blog/{slug}

OUTREACH PRINCIPLES (for community engagement drafts):
- Lead with genuine value, not promotion
- Answer the specific question asked
- Only mention SettleGrid if directly relevant to the answer
- Never be the first to promote -- respond to existing discussions
- Short (under 150 words for community responses)

IMPORTANT: You NEVER publish content directly. All content drafts are
submitted as Tier 3 HITL requests for Luther's review and approval.
You research, outline, draft, and submit. Luther publishes.`

export const CONTENT_CALENDAR = {
  weekly: [
    { day: 'monday', type: 'developer_tutorial', description: 'Tutorial on a specific SettleGrid use case or integration' },
    { day: 'wednesday', type: 'protocol_explainer', description: 'Deep dive on one of the 15 payment protocols or MCP ecosystem topic' },
    { day: 'friday', type: 'market_analysis', description: 'Trends, data, or analysis about AI tool monetization' }
  ],
  monthly: [
    { week: 1, type: 'comparison', description: 'Technical comparison of approaches to a specific problem' },
    { week: 3, type: 'newsletter', description: 'Monthly roundup of protocol changes, new tools, and trends' }
  ]
} as const

export const RESEARCH_QUERIES = [
  // Topic discovery
  "MCP server monetization",
  "AI tool billing",
  "agent payment protocol",
  "per-call API pricing",
  "MCP server tutorial",
  "AI agent payments 2026",
  "x402 protocol",
  "Model Context Protocol billing",
  // Community monitoring
  "how to charge for MCP server",
  "monetize AI tool",
  "MCP server revenue",
  "AI API pricing model",
  // Competitor tracking (for content positioning, not direct comparison)
  "agent payment infrastructure",
  "AI commerce platform"
] as const
```

FILE 2: agents/beacon/tools.ts

Implement the following tool functions:

- researchTopic(query: string, dateRange?: string):
  - Uses Exa search with category:"blog" and date filter
  - Returns top 10 results with title, url, snippet, date
  - Wrapped in Langfuse trace span
  - Retry logic: max 3 retries with exponential backoff (1s, 2s, 4s)
  - Returns typed result via Zod validation:
    z.array(z.object({ title: z.string(), url: z.string(),
    snippet: z.string(), date: z.string().nullable() }))

- analyzeExistingContent(url: string):
  - Uses Firecrawl to scrape and extract main content
  - Returns { title, content, wordCount, headings, codeBlocks }
  - Wrapped in Langfuse trace span
  - Timeout: 15 seconds
  - Returns typed result

- checkSettlegridContent(query: string):
  - Searches settlegrid.ai/learn/blog/* for existing content on the topic
  - Uses Exa search with site:settlegrid.ai filter
  - Returns list of existing pages to avoid duplication
  - Returns typed result

- draftContent(outline: ContentOutline):
  - Uses Claude API (Sonnet for drafting, not Opus) to generate content
  - Passes the BEACON_SYSTEM_PROMPT as system message
  - Includes the outline as user message
  - Returns { title, body, meta_description, target_keywords, word_count }
  - Validates output with checkContentQuality() -- must score >70
  - If quality check fails, retry with feedback (max 2 retries)

- submitForReview(content: DraftContent):
  - Creates a Tier 3 HITL request with the full content
  - Stores content metadata in Mem0 content namespace
  - Returns the HITL request ID

- searchCommunityDiscussions(keywords: string[]):
  - Uses Exa search with category:"tweet" and category:"reddit"
  - Filters to last 48 hours
  - Returns discussions where SettleGrid could add genuine value
  - Does NOT draft responses (that's a separate Tier 3 action)

Each tool must:
- Be wrapped in Langfuse trace span via traceToolCall()
- Handle errors gracefully with retry logic (max 3, exponential backoff)
- Return typed results with Zod validation
- Log tool name, input params, and execution time

FILE 3: agents/beacon/graph.ts

Implement LangGraph workflow:

- State type:
  ```typescript
  interface BeaconState {
    command: 'research' | 'draft' | 'full-cycle'
    topics: ResearchResult[]
    existingContent: string[]
    selectedTopic: { topic: string; angle: string; targetKeyword: string } | null
    outline: ContentOutline | null
    draft: DraftContent | null
    hitlRequestId: string | null
    report: string | null
    errors: string[]
  }
  ```

- Nodes:
  1. research_topics -- runs RESEARCH_QUERIES through Exa, collects results
  2. check_existing -- searches settlegrid.ai for existing coverage
  3. select_topic -- uses Claude to pick the highest-value uncovered topic,
     considering content calendar and existing coverage gaps
  4. generate_outline -- uses Claude to create a structured outline with
     target keyword, H2s, code example placeholders, internal link opportunities
  5. write_draft -- uses draftContent() to generate the full article
  6. quality_check -- runs checkContentQuality(), sanitizeForExternal(),
     verifies no template literals, verifies word count meets target
  7. submit_for_review -- submits to HITL Tier 3

- Edges:
  research_topics -> check_existing -> select_topic -> generate_outline ->
  write_draft -> quality_check -> submit_for_review

  quality_check has conditional edge: if score < 70, return to write_draft
  with feedback (max 2 loops, then submit with quality warning)

- Error handling: if any node fails, log error to errors array,
  skip to next node if possible, or abort with error report

FILE 4: agents/beacon/index.ts

- Main entry point
- Accepts command via process.argv[2]:
  - "research" -- runs research_topics + check_existing + select_topic only
  - "draft" -- runs full pipeline from outline to submission
  - "full-cycle" -- runs entire LangGraph pipeline
  - no argument -- runs "full-cycle"
- Wraps entire execution in traceAgent('beacon', command, fn)
- Updates agent_state:beacon in Mem0 after each run
- Logs execution summary to console
- Exports schedule configuration for the orchestrator:
  ```typescript
  export const BEACON_SCHEDULE = {
    research: { interval: '0 4 * * *' },    // 4 AM daily
    draft: { interval: '0 5 * * 1,3,5' },   // 5 AM Mon/Wed/Fri
  }
  ```

AUDIT AFTER COMPLETION:

1. Prompts:
   - [ ] Verify BEACON_SYSTEM_PROMPT contains all 15 SettleGrid protocols
   - [ ] Verify BEACON_SYSTEM_PROMPT explicitly says "You NEVER publish
         content directly"
   - [ ] Verify CONTENT_CALENDAR has 3 weekly entries and 2 monthly entries
   - [ ] Verify RESEARCH_QUERIES has at least 10 queries

2. Tools:
   - [ ] Write test: researchTopic("MCP server") returns an array of
         objects with title, url, snippet fields (mock Exa)
   - [ ] Write test: researchTopic with Exa failure retries 3 times
         then returns empty array (not throws)
   - [ ] Write test: draftContent with quality score <70 retries once
         with feedback
   - [ ] Write test: submitForReview creates a Tier 3 HITL request
         (mock HITL manager)
   - [ ] Write test: submitForReview stores content in Mem0 content
         namespace (mock memory manager)
   - [ ] Verify all tools are wrapped in traceToolCall (grep for
         'traceToolCall' in tools.ts -- should match number of tool functions)

3. Graph:
   - [ ] Write test: full-cycle with mocked tools produces a draft
         with word count > 1000
   - [ ] Write test: quality_check with score <70 loops back to write_draft
   - [ ] Write test: quality_check loops maximum 2 times then submits
         with warning
   - [ ] Write test: research command only runs first 3 nodes
   - [ ] Write test: node failure logs to errors array and aborts gracefully

4. Index:
   - [ ] Verify `tsx agents/beacon/index.ts research` runs without crash
         (with mocked API keys)
   - [ ] Verify agent_state is updated after each run
   - [ ] Verify BEACON_SCHEDULE exports cron expressions

5. Integration:
   - [ ] Run dry-run: tsx agents/beacon/index.ts research -- verify it
         completes without errors (real Exa API call)
   - [ ] Verify Langfuse trace appears in dashboard after dry-run

6. Final:
   - [ ] Run: npx tsc --noEmit -- zero type errors
   - [ ] Run: npx vitest run -- ALL tests pass
   - [ ] Verify no content is published or emailed without HITL approval
         (grep for sendEmail in beacon/ -- should only appear in
         submitForReview context)
```

---

## 8. PROMPT 5: BUILD PROTOCOL AGENT

```
PROMPT 5: BUILD PROTOCOL AGENT (#2)

Context: Protocol is a payment protocol intelligence agent for SettleGrid.ai.
It monitors all 15 payment protocols for spec changes, breaking updates,
new versions, and competitor implementations. It alerts Luther to anything
that affects SettleGrid's integrations.

PREREQUISITES: Prompts 1-3 must be completed. Verify:
- npx tsc --noEmit (zero errors)
- npx vitest run (all pass)

TASK: Implement agents/protocol/ with 4 files.

FILE 1: agents/protocol/prompts.ts

Export the following:

```typescript
export const PROTOCOL_SYSTEM_PROMPT = `You are Protocol, a payment protocol
intelligence agent for SettleGrid.ai.

SETTLEGRID INTEGRATES 15 PAYMENT PROTOCOLS:
1. MCP (Model Context Protocol) -- primary protocol for AI tool billing
2. MPP (Model Payment Protocol) -- emerging alternative to MCP billing
3. x402 -- Coinbase's HTTP 402-based crypto payment protocol (v2 current)
4. AP2 -- Agent Payment Protocol 2
5. Visa TAP -- Visa's tokenized agent payment system
6. UCP -- Universal Commerce Protocol
7. ACP -- Agent Commerce Protocol
8. Mastercard Agent Pay -- Mastercard's agent payment rails
9. Circle Nano -- Circle's stablecoin nano-payment system
10. REST -- Standard REST API billing via API keys
11. L402 -- Lightning Network 402 payments
12. Alipay Trust -- Alipay's trusted agent payment system
13. KYAPay -- Know Your Agent payment verification
14. EMVCo -- EMVCo's agent transaction standard
15. DRAIN -- Decentralized Revenue Allocation for Intelligent Networks

YOUR ROLE: Monitor these protocols for any changes that affect SettleGrid.
You are SettleGrid's early warning system.

WHAT TO MONITOR:
- GitHub repos: spec changes, new releases, merged PRs, open RFCs
- Blog posts and announcements from protocol maintainers
- Social media discussion about protocol adoption or criticism
- Competitor implementations of these protocols
- New protocols emerging that SettleGrid should consider supporting

SEVERITY CLASSIFICATION:
- critical: Breaking change with deadline, or security vulnerability
- high: Breaking change without immediate deadline, or major new version
- medium: New feature or significant update, or competitor implementation
- low: Minor update, documentation change, or informational
- info: General news, social discussion, no action needed

WHEN ANALYZING CHANGES, ALWAYS INCLUDE:
1. What changed (specific, not vague)
2. Which SettleGrid integration is affected
3. What action SettleGrid needs to take (or "none")
4. Timeline (when does this need to happen)
5. Source URL for verification

NEVER speculate about protocol changes you haven't verified. If you find
a rumor or unconfirmed report, classify it as 'info' severity and note
that it's unconfirmed.`

export const PROTOCOL_SOURCES: Record<string, {
  github_repos: string[]
  spec_urls: string[]
  search_queries: string[]
}> = {
  MCP: {
    github_repos: [
      'modelcontextprotocol/modelcontextprotocol',
      'modelcontextprotocol/typescript-sdk',
      'modelcontextprotocol/servers'
    ],
    spec_urls: ['https://modelcontextprotocol.io/specification'],
    search_queries: ['MCP protocol update', 'Model Context Protocol change']
  },
  x402: {
    github_repos: ['coinbase/x402'],
    spec_urls: ['https://github.com/coinbase/x402/blob/main/specs/x402-specification-v2.md'],
    search_queries: ['x402 protocol update', 'Coinbase x402']
  },
  L402: {
    github_repos: [],
    spec_urls: [],
    search_queries: ['L402 Lightning payment', 'Lightning 402 protocol']
  },
  // ... define sources for all 15 protocols
  // For protocols without known GitHub repos (Visa TAP, Mastercard Agent Pay, etc.),
  // use search_queries only
}
```

FILE 2: agents/protocol/tools.ts

Implement:

- scanGitHubRepo(owner: string, repo: string, since?: string):
  - Uses GitHub API (unauthenticated or with token if available) to fetch:
    - Recent releases (last 30 days)
    - Recent merged PRs with labels containing 'spec', 'breaking', 'RFC'
    - Recent issues with 'breaking' or 'deprecation' labels
  - Returns typed array of { type, title, url, date, body_preview }
  - Rate limit aware: if 403, log warning and skip

- searchProtocolNews(protocol: string, queries: string[]):
  - Uses Exa search with date filter (last 7 days)
  - Returns top 5 results per query
  - Deduplicates by URL
  - Returns typed results

- analyzeChange(change: RawChange):
  - Uses Claude API (Sonnet) to classify severity, summarize impact,
    and determine action required
  - System prompt includes PROTOCOL_SYSTEM_PROMPT
  - Returns typed ProtocolChangeSchema-compliant object

- storeChange(change: ProtocolChange):
  - Stores in Mem0 protocol_change namespace
  - If severity is 'critical' or 'high': creates Tier 2 HITL request
  - If action_required: creates Tier 3 HITL request
  - Returns the stored change

- generateReport(changes: ProtocolChange[], period: string):
  - Generates a markdown summary of all changes in the period
  - Groups by protocol, sorted by severity
  - Includes action items at the top
  - Returns formatted markdown string

FILE 3: agents/protocol/graph.ts

LangGraph workflow:

- State:
  ```typescript
  interface ProtocolState {
    command: 'scan' | 'report' | 'full-cycle'
    scannedRepos: RawChange[]
    searchResults: RawChange[]
    analyzedChanges: ProtocolChange[]
    newChanges: ProtocolChange[]  // only changes not already in Mem0
    report: string | null
    errors: string[]
  }
  ```

- Nodes:
  1. scan_github -- iterate over all PROTOCOL_SOURCES GitHub repos,
     collect recent activity
  2. scan_news -- run search queries for each protocol
  3. deduplicate -- merge results, remove already-known changes (check Mem0)
  4. analyze -- classify each new change via analyzeChange()
  5. store_and_alert -- store all new changes, create HITL requests for
     high-severity items
  6. generate_report -- create summary report if any new changes found

- Edges: scan_github + scan_news (parallel) -> deduplicate -> analyze ->
  store_and_alert -> generate_report

FILE 4: agents/protocol/index.ts

- Entry point with commands: "scan", "report", "full-cycle"
- Schedule:
  ```typescript
  export const PROTOCOL_SCHEDULE = {
    scan: { interval: '0 */4 * * *' },      // Every 4 hours
    report: { interval: '0 6 * * 1' },       // Monday 6 AM weekly report
  }
  ```

AUDIT AFTER COMPLETION:

1. Protocol coverage:
   - [ ] Verify PROTOCOL_SOURCES has entries for ALL 15 protocols
   - [ ] Verify each entry has at least search_queries defined
   - [ ] Verify MCP has 3 GitHub repos listed
   - [ ] Verify x402 has 1 GitHub repo listed

2. Tools:
   - [ ] Write test: scanGitHubRepo returns typed results (mock fetch)
   - [ ] Write test: scanGitHubRepo handles 403 rate limit gracefully
   - [ ] Write test: analyzeChange returns valid ProtocolChangeSchema
         object (mock Claude)
   - [ ] Write test: storeChange with severity 'critical' creates
         HITL Tier 2 request
   - [ ] Write test: storeChange with action_required=true creates
         HITL Tier 3 request
   - [ ] Write test: storeChange with severity 'info' does NOT create
         HITL request

3. Deduplication:
   - [ ] Write test: a change already in Mem0 is not re-analyzed
   - [ ] Write test: a new change not in Mem0 IS analyzed and stored

4. Report:
   - [ ] Write test: generateReport with 0 changes returns
         "No protocol changes detected in {period}"
   - [ ] Write test: generateReport groups by protocol name
   - [ ] Write test: generateReport lists action items first

5. Final:
   - [ ] Run: npx tsc --noEmit -- zero type errors
   - [ ] Run: npx vitest run -- ALL tests pass
   - [ ] Run dry-run: tsx agents/protocol/index.ts scan -- verify it
         attempts to scan GitHub repos (may fail on rate limit, that's OK)
```

---

## 9. PROMPT 6: ORCHESTRATION & DAILY BRIEFING

```
PROMPT 6: ORCHESTRATION & DAILY BRIEFING SYSTEM

Context: You need a scheduler that runs Beacon and Protocol agents on their
defined schedules, an event bus for inter-agent communication, and a daily
briefing system that summarizes agent activity for Luther.

PREREQUISITES: Prompts 1-5 must be completed. Verify:
- npx tsc --noEmit (zero errors)
- npx vitest run (all pass)

TASK: Implement orchestrator/scheduler.ts, orchestrator/event-bus.ts,
and orchestrator/briefing.ts

FILE 1: orchestrator/scheduler.ts

```typescript
import { CronJob } from 'cron'

const SCHEDULE = {
  // Beacon
  beacon_research: { interval: '0 4 * * *', agent: 'beacon', command: 'research' },
  beacon_draft: { interval: '0 5 * * 1,3,5', agent: 'beacon', command: 'draft' },

  // Protocol
  protocol_scan: { interval: '0 */4 * * *', agent: 'protocol', command: 'scan' },
  protocol_report: { interval: '0 6 * * 1', agent: 'protocol', command: 'report' },

  // System
  hitl_expire: { interval: '0 * * * *', agent: 'system', command: 'expire_stale' },
  morning_briefing: { interval: '0 7 * * *', agent: 'system', command: 'morning_brief' },
  evening_briefing: { interval: '0 18 * * *', agent: 'system', command: 'evening_brief' },
}
```

Implementation:
- For each schedule entry, create a CronJob that:
  - Logs "Starting {agent}:{command}" with timestamp
  - Spawns the agent via child_process.fork() (not inline, to isolate crashes)
  - Captures stdout/stderr
  - Updates agent_state in Mem0 on completion
  - Logs "Completed {agent}:{command} in {duration}ms" or
    "Failed {agent}:{command}: {error}"
  - If an agent crashes, increment error_count_24h in agent_state
  - Kill switch: if error_count_24h > 10, disable that agent's schedule
    and send alert email

- Main function:
  - Starts all cron jobs
  - Logs active schedules on startup
  - Handles SIGINT/SIGTERM gracefully (stop all jobs, flush Langfuse)

FILE 2: orchestrator/event-bus.ts

Simple file-based event bus for Phase 1 (upgrade to Redis in Phase 2):

```typescript
interface AgentEvent {
  id: string
  type: string
  producer: string
  payload: Record<string, unknown>
  created_at: string
  consumed_by: string[]
}

const EVENT_DEFINITIONS = {
  'protocol.changed': {
    producer: 'protocol',
    consumers: ['beacon'],
    description: 'New protocol change detected -- Beacon may want to write about it'
  },
  'content.drafted': {
    producer: 'beacon',
    consumers: [],  // No consumers in Phase 1
    description: 'New content draft submitted for review'
  },
  'content.approved': {
    producer: 'system',  // From HITL approval
    consumers: ['beacon'],
    description: 'Content approved -- Beacon updates content status in Mem0'
  }
}
```

- emit(type, producer, payload) -- write event to ./data/events.jsonl
- consume(consumerName) -- read unconsumed events for this consumer
- acknowledge(eventId, consumerName) -- mark event as consumed

FILE 3: orchestrator/briefing.ts

Generates two daily reports sent via email to Luther:

MORNING BRIEFING (7 AM):
1. "Protocol Changes" -- from Protocol's last 12h of detections
   (count, severity breakdown, any action required)
2. "Content Pipeline" -- from Beacon's content namespace
   (drafts pending review, published in last 7 days)
3. "Pending Approvals" -- count of Tier 2 and Tier 3 items in HITL queue
4. "Agent Health" -- per-agent status (last run, error count, score)
5. "Today's Schedule" -- what agents are scheduled to run today

EVENING BRIEFING (6 PM):
1. "Today's Activity" -- per-agent action counts and success rates
2. "Content Ready for Review" -- any Tier 3 content drafts awaiting approval
3. "Protocol Alerts" -- any high/critical changes detected today
4. "Tomorrow's Priority" -- highest-impact pending HITL item

Format: Clean markdown rendered in email HTML using a simple template.
Send via sendInternalAlert().

AUDIT AFTER COMPLETION:

1. Scheduler:
   - [ ] Verify all 7 schedule entries create valid CronJob instances
   - [ ] Write test: scheduler logs "Starting" on job trigger
   - [ ] Write test: agent crash increments error_count_24h
   - [ ] Write test: error_count_24h > 10 disables the agent (mock scenario)
   - [ ] Verify SIGINT handler stops all jobs

2. Event bus:
   - [ ] Write test: emit() writes event to events.jsonl
   - [ ] Write test: consume() returns only unconsumed events for the
         specified consumer
   - [ ] Write test: acknowledge() marks event as consumed (not returned
         by subsequent consume() calls)
   - [ ] Write test: events persist across event-bus restarts

3. Briefing:
   - [ ] Write test: morning briefing includes all 5 sections
   - [ ] Write test: evening briefing includes all 4 sections
   - [ ] Write test: empty data shows "Nothing to report" (not errors)
   - [ ] Write test: briefing sends via sendInternalAlert (mock)
   - [ ] Verify briefing renders as valid HTML (no broken tags)

4. Final:
   - [ ] Run: npx tsc --noEmit -- zero type errors
   - [ ] Run: npx vitest run -- ALL tests pass
   - [ ] Run: tsx orchestrator/briefing.ts -- generates and displays
         a briefing without crash (will show empty sections, that's OK)
```

---

## 10. PROMPT 7: OBSERVABILITY & EVALUATION (Langfuse)

```
PROMPT 7: LANGFUSE OBSERVABILITY CONFIGURATION

Context: All agents and orchestrator components use Langfuse for tracing.
This prompt configures evaluation criteria, dashboards, and alerting.

PREREQUISITES: Prompts 1-6 must be completed. Verify:
- npx tsc --noEmit (zero errors)
- npx vitest run (all pass)

TASK: Create dashboard/metrics.ts with KPI tracking and Langfuse evaluation setup.

1. Create a MetricsCollector class that:
   - Reads agent_state from Mem0 for all agents
   - Reads HITL queue for approval metrics
   - Reads content namespace for content pipeline metrics
   - Reads protocol_change namespace for protocol coverage metrics
   - Computes and displays:
     - Per-agent: last run, success rate (7d), avg execution time,
       error count (24h), actions taken (today)
     - HITL: pending count by tier, avg approval time, rejection rate
     - Content: drafts in pipeline, published (30d), avg quality score
     - Protocol: changes detected (30d), by severity, unresolved action items
   - Outputs as formatted console table AND JSON for programmatic access

2. Create Langfuse evaluation definitions (as code comments documenting
   the manual setup in Langfuse dashboard):
   - Beacon quality score: track checkContentQuality() output per draft
   - Protocol detection latency: time from source change to detection
   - HITL response time: time from request to approval/rejection
   - Agent reliability: success rate per agent per day

3. CLI: `tsx dashboard/metrics.ts` displays current metrics

AUDIT:
- [ ] Metrics display runs without error
- [ ] All computed values are numbers (not NaN or undefined)
- [ ] Empty state (no data) shows 0s, not errors
- [ ] npx tsc --noEmit -- zero type errors
- [ ] npx vitest run -- all pass
```

---

## 11. FUTURE PHASE PROMPTS (Summaries)

These prompts should be executed only after Phase 1 agents are operational
and the deployment triggers are met (10+ paying customers for Phase 2, etc.).
Full detailed prompts will be written when needed. Summaries for planning:

### Prompt 8: Scout Agent (Phase 2)

**Critical requirement:** Scout MUST integrate with SettleGrid's existing
crawl pipeline, NOT create a parallel discovery system. Specifically:
- Read from the existing `tools` table in Supabase to know what's already indexed
- Use the existing Resend email infrastructure (NOT AgentMail)
- Check existing claim outreach history before contacting anyone
- Supplement existing crawlers with Exa search for prospects NOT in the database

### Prompt 9: Welcome Agent (Phase 2)

- Trigger-based: listens for new signups via Supabase webhook or polling
- Milestones: account -> first tool -> first metered call -> first payout
- Uses existing Resend for email sequences

### Prompt 10: Support Agent (Phase 2)

- Receives emails via Resend inbound webhook
- Knowledge base built from settlegrid.ai/docs content
- Confidence-based escalation

### Prompt 11: Marketplace Agent (Phase 3)

- SEO page generation for categories, frameworks, collections
- Trending calculation from existing tool invocation data
- Integrates with existing Next.js app via API or direct DB

### Prompt 12: Health Agent (Phase 3)

- Health checks on claimed tools (extends existing health crons)
- Developer notifications via existing Resend templates

### Prompt 13: Pulse Agent (Phase 3)

- Engagement analysis from existing analytics data
- Churn detection, expansion signals
- Re-engagement emails via existing templates

### Prompt 14: Radar Agent (Phase 4)

- Competitive monitoring for Kite, Sponge, x402 direct, Composio

### Prompt 15: Guardian Agent (Phase 4)

- Reviews all agent outputs before external delivery
- Quality gate for content, outreach, support responses

---

## 12. COST MODEL -- PHASE 1 ONLY

### Per-Service Cost Breakdown

| Service | Usage Estimate | Unit Cost | Monthly Cost |
|---------|---------------|-----------|-------------|
| Anthropic Claude API | ~200K tokens/day (Beacon drafts + Protocol analysis) | $3/M input, $15/M output (Sonnet) | $40-60 |
| Exa Search | ~100 searches/day (Beacon research + Protocol news) | $5/1K requests | $15-25 |
| Firecrawl | ~50 pages/day (Beacon competitor analysis) | Standard $83/mo | $83 |
| Mem0 | ~300 operations/day | ~$0.01/op | $10 |
| Langfuse | All tracing | Hobby (free) | $0 |
| Resend | Already included in SettleGrid costs | -- | $0 |
| **Phase 1 Total** | | | **$148-178/mo** |

### Cost vs. Human Equivalent

| Function | Human Cost/Month | AI Agent Cost/Month | Savings |
|----------|-----------------|-------------------|---------|
| Content / DevRel (Beacon) | $4,000-7,000 | ~$60 | 97-99% |
| Protocol Analyst (Protocol) | $6,000-10,000 | ~$40 | 99%+ |
| **Total** | **$10,000-17,000** | **~$100** | **99%** |

### Cost Controls

- Per-agent daily budget cap in config.ts (default: $5/agent/day)
- If any agent exceeds 2x normal daily cost, scheduler kills it and alerts
- Monthly hard ceiling: $250/mo -- if exceeded, all agents pause
- Firecrawl: can downgrade to pay-as-you-go if usage is lower than expected

---

## 13. PHASED ROLLOUT -- WEEK BY WEEK

### Phase 1: Compounding Assets (Weeks 1-3)

**Week 1: Foundation**
- Monday-Tuesday: Run Prompts 1-3 (bootstrap, memory, HITL). Verify all audits pass.
- Wednesday-Thursday: Run Prompt 4 (Beacon). Dry-run research mode.
- Friday: Run Prompt 5 (Protocol). Dry-run scan mode.

**Week 2: First Agents Live**
- Monday: Deploy Protocol in scan mode. Verify first Mem0 entries.
- Tuesday: Deploy Beacon in research-only mode. Verify topic selection quality.
- Wednesday: Run Prompts 6-7 (orchestrator, metrics). Start scheduled runs.
- Thursday: Review first Beacon content draft. Approve or reject with feedback.
- Friday: Review all agent outputs. Approve/reject HITL queue. Debug issues.

**Week 3: Calibration**
- Daily: Review outputs, adjust prompts, fix quality issues
- Success criteria to advance:
  - [ ] Protocol has detected and classified 3+ protocol changes
  - [ ] Beacon has produced 2+ content drafts that pass your quality bar
  - [ ] Zero critical errors in Langfuse traces
  - [ ] HITL queue processing takes <10 minutes/day
  - [ ] Total API cost <$200 for the 3 weeks

**Phase 1 STOP Criteria (Do Not Advance If):**
- Agent outputs consistently fail quality review (>50% rejection rate)
- API costs exceed $250/month
- HITL queue overwhelms you (>20 minutes/day to process)
- Any agent sends unauthorized external communications

### Phase 2: Growth Engine (After 10+ Paying Customers)

- Week 4: Scout (discovery-only mode, no outreach for 3 days)
- Week 4: Welcome (connect to signup events)
- Week 5: Support (route support emails)
- Week 6: Calibration

### Phase 3: Retention & Operations (After 50+ Customers)

- Week 7: Marketplace + Health
- Week 8-9: Pulse
- Week 10: Calibration

### Phase 4: Intelligence & Scale (At Scale)

- Week 11: Radar
- Week 12: Guardian
- Week 13-14: Full system optimization

---

## 14. RISK REGISTRY & MITIGATION PROTOCOLS

| # | Risk | Probability | Impact | Mitigation |
|---|------|------------|--------|------------|
| 1 | Beacon publishes low-quality content | Medium | High | All content Tier 3 gated. checkContentQuality() enforces >70 score. Luther reviews every draft. |
| 2 | Protocol misclassifies severity | Low | High | Conservative classification in prompt ("if unsure, classify higher"). Luther reviews high/critical changes. |
| 3 | API cost spike | Low | Medium | Per-agent daily budget caps. Kill switch at 2x normal. Monthly ceiling $250. |
| 4 | Mem0 data corruption | Low | High | Zod validation on every write. Namespace isolation. Weekly JSON backup export. |
| 5 | HITL queue overwhelm | Medium | Medium | Only 2 agents in Phase 1. If queue >10 items, pause Tier 2 actions. Alert Luther. |
| 6 | Agent hallucination in protocol analysis | Medium | Critical | Protocol agent always cites source URL. Never speculates. Guardian agent (Phase 4) cross-references claims. |
| 7 | Resend deliverability degradation | Low | Medium | SPF/DKIM/DMARC already configured. Monitor bounce rates. Separate subdomain isolates reputation. |
| 8 | LLM API outage | Medium | High | Retry with exponential backoff. Graceful degradation (agents queue work for when API returns). No agent crashes on API failure. |
| 9 | Exa/Firecrawl rate limits | Medium | Low | Respect rate limits. Cache results in Mem0. Degrade gracefully (skip search, use cached data). |
| 10 | Privacy/data leak via agent outputs | Low | Critical | sanitizeForExternal() on all outgoing content. No customer data in outreach templates. Mem0 access scoped by namespace. |

---

*Document version 3.1 -- April 5, 2026*
*SettleGrid.ai only. Full implementation specification with Claude Code prompt chains and embedded audits.*
*By Alerterra LLC. Total document: ~4,200 lines of specification.*
