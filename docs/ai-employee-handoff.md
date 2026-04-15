# AI Employee Agent System -- Handoff Document

> **Historical snapshot (2026-04-15).** This handoff doc predates the
> P1.MKT1 honest-framing rewrite and references "15 payment protocols"
> with the original stale name list (MPP, Mastercard Agent Pay, Circle
> Nano, Alipay Trust, REST, EMVCo, etc.). The canonical name mapping and
> honest framing (9 brokered + 2 detection + 3 emerging = 14 tracked) is
> in [audits/15-protocol-claim.md](audits/15-protocol-claim.md). Preserved
> as a drafting-era snapshot rather than rewritten in place.

## Purpose

This document provides complete context for a fresh Claude Code session to execute the AI Employee Deployment Plan for SettleGrid.ai. Read this entire document before starting any prompts.

---

## 1. What You're Building

A team of AI agents that autonomously handle growth operations for **SettleGrid.ai** -- a payment infrastructure platform for AI tool monetization. The agents use LangGraph for workflows, Mem0 for shared memory, Langfuse for observability, and Resend for email.

**Phase 1 deploys 2 agents only:**
- **Beacon** -- Content & developer relations (researches topics, drafts articles)
- **Protocol** -- Payment protocol intelligence (monitors 15 protocol specs for changes)

All other agents are deferred until customer milestones are hit. The full plan supports 10 agents total.

---

## 2. About SettleGrid.ai

- **What it is:** Payment infrastructure for the AI economy. Developers wrap any function with 2 lines of code to add per-call billing, usage metering, and automated payouts.
- **SDK:** `@settlegrid/mcp` on npm
- **Smart Proxy:** `https://settlegrid.ai/api/proxy/{slug}` -- handles auth, metering, billing transparently
- **15 payment protocols:** MCP, MPP, x402, AP2, Visa TAP, UCP, ACP, Mastercard Agent Pay, Circle Nano, REST, L402, Alipay Trust, KYAPay, EMVCo, DRAIN
- **Pricing tiers:** Free ($0, 50K ops), Builder ($19, 200K ops), Scale ($79, 2M ops)
- **Progressive take rate:** 0% on first $1K/mo, 2% to $10K, 2.5% to $50K, 5% above
- **Current state (April 2026):** 1,444+ tools indexed, 2 organic signups, 0 revenue, 234 outreach emails sent
- **Production URL:** https://settlegrid.ai
- **Main codebase:** `/Users/lex/settlegrid` (Next.js 15, Turborepo monorepo, Drizzle ORM, Supabase, Vercel)

---

## 3. Existing Infrastructure (DO NOT Duplicate)

The agent system must integrate with -- not replace -- these existing systems:

| System | What It Does | How Agents Should Use It |
|--------|-------------|------------------------|
| **11 crawlers** | Discover tools from npm, HuggingFace, Smithery, PyPI, Replicate, GitHub, etc. | Read existing tool data. Do NOT build parallel discovery with Exa. |
| **Resend email** | Send from `luther@mail.settlegrid.ai` with DMARC/SPF/DKIM/click tracking | Use Resend API directly. Do NOT add AgentMail. |
| **Claim outreach crons** | Email tool creators to claim their listings | Check outreach history before contacting anyone. |
| **Follow-up sequences** | E2/E3/E4 at Day 3/10/24 | Do not send duplicates. |
| **Supabase DB** | PostgreSQL with Drizzle ORM schema | Read via Supabase client for tool/user data. |
| **Upstash Redis** | Rate limiting, crawl offsets, suppression lists | Use existing Redis instance. |
| **Sentry** | Error tracking | Keep using for agent errors too. |
| **PostHog** | Product analytics | Keep using. |
| **Vercel Analytics** | Visitor tracking | Just deployed. |

---

## 4. The Plan Document

The full execution plan is at:
```
/Users/lex/settlegrid/docs/ai-employee-plan-settlegrid-v3.1.md
```

It contains **7 sequential prompts** that must be executed in order. Each prompt has embedded audit checklists that MUST pass before moving to the next prompt.

### Prompt Execution Order

| # | Name | What It Creates | Depends On |
|---|------|----------------|-----------|
| 1 | Project Bootstrap | Directory structure, config, observability, email, guardrails | Nothing |
| 2 | Memory System | Mem0 schemas, MemoryManager, 6 typed namespaces | Prompt 1 |
| 3 | HITL Approval System | 3-tier approval flow, CLI queue, file-based persistence | Prompts 1-2 |
| 4 | Beacon Agent | Content research, drafting, quality checking, LangGraph workflow | Prompts 1-3 |
| 5 | Protocol Agent | Protocol monitoring, change detection, severity classification | Prompts 1-3 |
| 6 | Orchestration | Cron scheduler, event bus, daily briefing emails | Prompts 1-5 |
| 7 | Observability | Metrics collector, KPI dashboard, Langfuse evaluation setup | Prompts 1-6 |

### How to Execute Each Prompt

1. Open the plan document and find the prompt section
2. Copy the entire prompt text (everything between the ``` code fences)
3. Before running, verify prerequisites pass:
   - `npx tsc --noEmit` -- zero type errors
   - `npx vitest run` -- all tests pass
4. Paste the prompt into the Claude Code session
5. After completion, run EVERY audit check listed under "AUDIT AFTER COMPLETION"
6. Fix any failures before proceeding to the next prompt
7. Do NOT skip audits -- errors compound across prompts

---

## 5. Project Location & Setup

The agent project should be created at:
```
/Users/lex/settlegrid-agents/
```

This is a **separate project** from the main SettleGrid app (`/Users/lex/settlegrid/`). It runs independently and communicates with SettleGrid via API and Supabase.

### Required API Keys

Before starting Prompt 1, ensure these are available:

| Key | Source | How to Get |
|-----|--------|-----------|
| `ANTHROPIC_API_KEY` | console.anthropic.com | Luther has this |
| `EXA_API_KEY` | dashboard.exa.ai | Create account, get key |
| `FIRECRAWL_API_KEY` | firecrawl.dev | Standard plan ($83/mo) |
| `MEM0_API_KEY` | app.mem0.ai | Create account, get key |
| `LANGFUSE_PUBLIC_KEY` | cloud.langfuse.com | Create project, get keys |
| `LANGFUSE_SECRET_KEY` | cloud.langfuse.com | Same project |
| `RESEND_API_KEY` | resend.com | Luther has this (settlegrid.ai domain) |
| `SETTLEGRID_SUPABASE_URL` | supabase.com | Luther has this |
| `SETTLEGRID_SUPABASE_ANON_KEY` | supabase.com | Luther has this |

---

## 6. Architecture Decisions (Non-Negotiable)

These decisions were made deliberately. Do not change them:

1. **Resend for email, NOT AgentMail.** SettleGrid already has verified DMARC/SPF/DKIM on `mail.settlegrid.ai`. Adding a second email provider creates deliverability risk.

2. **File-based storage for HITL queue and events in Phase 1.** JSON files in `./data/`. Upgrade to Redis/database in Phase 2 when volume justifies it.

3. **Sonnet for agent LLM calls, NOT Opus.** Opus is for the human developer session. Agents use Sonnet for cost efficiency. The config should use `claude-sonnet-4-6` model ID.

4. **All external content is Tier 3 gated.** No agent publishes, emails, or posts anything externally without Luther's explicit approval. No exceptions.

5. **Agents run as child processes, NOT inline.** The scheduler spawns agents via `child_process.fork()` to isolate crashes.

6. **Phase gates are hard gates.** Do not build Phase 2 agents until Phase 1 success criteria are met and Luther explicitly requests it.

---

## 7. Key Design Patterns

### Memory Namespaces
Each data type has its own namespace prefix. When storing data:
- `tool:{tool_id}` -- tool catalog intelligence
- `prospect:{email}` -- developer prospects
- `competitor:{name}` -- competitive intel
- `content:{content_id}` -- content pipeline
- `protocol_change:{change_id}` -- protocol changes
- `agent_state:{agent_name}` -- agent operational state

### HITL Tiers
- **Tier 1 (Autonomous):** Internal operations -- monitoring, research, memory writes. Logged but no approval needed.
- **Tier 2 (Supervised):** Agent acts immediately, Luther reviews within 24h. Emails using pre-approved templates, non-critical alerts.
- **Tier 3 (Gated):** Agent prepares, Luther approves BEFORE execution. All published content, new outreach categories, strategic recommendations.

### Agent File Structure
Every agent follows the same 4-file pattern:
```
agents/{name}/
  prompts.ts   -- System prompt and templates
  tools.ts     -- Tool functions (Exa, Firecrawl, Claude, Mem0)
  graph.ts     -- LangGraph workflow definition
  index.ts     -- Entry point with CLI commands and schedule export
  __tests__/   -- Vitest test files
```

### Error Handling Pattern
- Every tool call: try/catch with descriptive logging, max 3 retries with exponential backoff
- Every API call: timeout (15s default), retry on 429/503
- Every agent run: wrapped in `traceAgent()` for Langfuse
- Agent crash: logged, error_count_24h incremented, scheduler disables agent after 10 errors

---

## 8. Content Voice & Brand

When Beacon drafts content for SettleGrid:
- Technical, developer-friendly, code-first
- Show don't tell -- working code examples required
- No marketing language ("revolutionary", "game-changing")
- No emojis
- Write like a senior engineer explaining to a peer
- Cite specific numbers, protocols, and specs
- Never disparage competitors -- focus on technical trade-offs
- SEO: target keyword in title, first paragraph, H2, and meta description

---

## 9. Cost Controls

- **Per-agent daily cap:** $5/agent/day (configured in config.ts)
- **Kill switch:** If any agent exceeds 2x normal daily cost, scheduler kills it and alerts Luther
- **Monthly ceiling:** $250/mo total -- all agents pause if exceeded
- **Phase 1 target:** $148-178/mo for 2 agents

---

## 10. Success Criteria for Phase 1 (Weeks 1-3)

Before Phase 2 can begin, ALL of these must be true:
- [ ] Protocol has detected and classified 3+ protocol changes
- [ ] Beacon has produced 2+ content drafts that pass Luther's quality bar
- [ ] Zero critical errors in Langfuse traces
- [ ] HITL queue processing takes <10 minutes/day
- [ ] Total API cost <$200 for the 3 weeks

---

## 11. What NOT to Do

- Do NOT create a parallel tool discovery system (use existing crawlers)
- Do NOT add AgentMail or any email provider besides Resend
- Do NOT deploy more than 2 agents in Phase 1
- Do NOT let any agent send external communications without HITL Tier 3 approval
- Do NOT use `any` types -- everything must be typed with Zod schemas
- Do NOT skip audit checklists between prompts
- Do NOT build RegSeal agents -- this plan is SettleGrid only
- Do NOT use Opus for agent LLM calls -- use Sonnet for cost control

---

## 12. Files Reference

| File | Purpose |
|------|---------|
| `/Users/lex/settlegrid/docs/ai-employee-plan-settlegrid-v3.1.md` | Full execution plan with all 7 prompts |
| `/Users/lex/settlegrid/docs/ai-employee-plan-settlegrid-v3.1.docx` | Same, Word format |
| `/Users/lex/settlegrid/docs/ai-employee-handoff.md` | This handoff document |
| `/Users/lex/settlegrid/apps/web/src/lib/email.ts` | Existing email system (reference for Resend integration) |
| `/Users/lex/settlegrid/apps/web/src/lib/db/schema.ts` | Database schema (reference for tool/user data) |
| `/Users/lex/settlegrid/apps/web/src/lib/tier-config.ts` | Tier system (Free/Builder/Scale) |

---

*Handoff document -- April 6, 2026*
*Pass this document to the new session BEFORE executing any prompts from the plan.*
