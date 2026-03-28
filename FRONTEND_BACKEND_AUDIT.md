# SettleGrid Front-End / Back-End Alignment Audit

**Date**: 2026-03-26
**Scope**: 202 files changed, 85 new files, 45,646 lines of code
**Method**: Exhaustive read of every back-end capability and every front-end page

---

## 1. Back-End Capability Inventory

### 1.1 API Routes (159 route.ts files)

| Domain | Routes | Purpose |
|--------|--------|---------|
| `/api/proxy/[slug]` | 1 | Smart Proxy -- reverse proxy with auth, metering, budget checks, streaming |
| `/api/v1/discover` | 5 | Public discovery API with cost/rating filters, slug lookup, categories, developers, cost-based routing |
| `/api/v0.1/servers` | 6 | MCP sub-registry (v0.1 spec) with 4 extensions (pricing, revenue, reviews, stats) |
| `/api/agents` | 3 | Agent CRUD + facts management |
| `/api/consumer/*` | 11 | Consumer dashboard -- alerts, balance, budget, conversion events, explorer, keys, IP restrict, purchases, subscriptions, usage analytics |
| `/api/dashboard/*` | ~20 | Developer dashboard -- stats, tools, settings, analytics, payouts, webhooks, reviews, reputation, fraud, health, audit log, discovery |
| `/api/billing/*` | 6 | Stripe checkout, subscriptions, plan changes, manage, purchases, webhook |
| `/api/auth/*` | 7 | Developer + consumer auth (login, logout, register, me, MFA, signup-notify) |
| `/api/badge/*` | 3 | SVG badge generation (dev, tool, powered-by) |
| `/api/cron/*` | 17 | Automated jobs (health checks, crawlers, alerts, quality, reports, drip emails, etc.) |
| `/api/admin/*` | 3 | Admin metrics, reviews moderation, stats |
| `/api/stripe/*` | 1 | Stripe webhook handler |
| `/api/webhooks/github` | 1 | GitHub App webhook receiver |
| `/api/x402/*` | 3 | x402 protocol -- settle, supported, verify |
| `/api/a2a/*` | 2 | Agent-to-Agent protocol + skills |
| `/api/chat` | 1 | AI chat endpoint |
| `/api/feed` | 1 | Activity feed |
| `/api/og` | 1 | Open Graph image generation |
| `/api/sdk` | 1 | SDK endpoint |
| `/api/stream` | 1 | SSE streaming |
| `/api/support` | 1 | Support tickets |
| `/api/tools` | ~10 | Tool CRUD, auto-detect, quick-publish, versions, health |
| `/api/settlements` | 1 | Settlement records |
| `/api/sessions` | 1 | Session management |
| `/api/payouts` | 1 | Payout processing |
| `/api/orgs` | 1 | Organization management |
| `/api/outcomes` | 1 | Outcome-based billing |
| `/api/waitlist` | 1 | Waitlist signup |
| `/api/stickers` | 1 | Sticker pack |
| `/api/gate` | 1 | Access gate |
| `/api/mcp` | 1 | MCP protocol handler |
| `/api/health` | 1 | Health check |
| `/api/faq-feedback` | 1 | FAQ feedback collection |

### 1.2 Core Libraries

| Library | Purpose |
|---------|---------|
| `pricing.ts` | Progressive take rate: 0% on first $1K, 2% to $10K, 3% to $50K, 5% above |
| `pricing-utils.ts` | Cost extraction across 6 pricing models + auto-pricing from category benchmarks |
| `metering.ts` | Redis-accelerated balance checks, budget enforcement, credit deduction, referral commission |
| `achievements.ts` | 12 badges, auto-check/unlock logic, progress tracking |
| `ai-classify.ts` | Claude-powered endpoint classification (6 service types, 23 categories) |
| `seed-invocations.ts` | 3 automated test calls after tool publish |
| `analytics.ts` | MRR, signups, referral stats, invocation counts, organic traction |
| `github.ts` | GitHub App JWT auth, webhook verification, repo scanning, file fetching |
| `developer-email-resolver.ts` | GitHub profile/commit email extraction for claim outreach |
| `registry-crawlers.ts` | 4 registry sources: Official MCP Registry, PulseMCP, Smithery, npm |
| `crawlers/*.ts` | Additional crawlers: Hugging Face Spaces, npm AI packages, Replicate models |
| `mcp-registry/*` | Full MCP v0.1 sub-registry implementation (constants, helpers, mapper, types) |
| `solutions.ts` | 8 solution definitions with code examples, providers, FAQs |
| `categories.ts` | 23 tool categories |
| `frameworks.ts` | 6 framework integrations (LangChain, CrewAI, smolagents, AutoGen, Semantic Kernel, Mastra) |
| `collections.ts` | 5 curated editorial collections |
| `blog-posts.ts` | Blog post data |
| `howto-guides.ts` | How-to guide data |
| `integration-guides.ts` | Framework integration guide data |
| `revenue.ts` | Revenue tier display helpers (anonymized tiers, leaderboard) |
| `fraud.ts` | Fraud detection engine |
| `quality-gates.ts` | Tool quality validation |
| `settlement/*` | Settlement engine |
| `auto-refill.ts` | Automatic Stripe charge on low balance |
| `content-filter.ts` | Content moderation |
| `webhooks.ts` | Webhook delivery system |
| `notifications.ts` | Alert/notification system |

### 1.3 Cron Jobs (17 scheduled)

| Cron | Schedule | Purpose | Front-end visibility |
|------|----------|---------|---------------------|
| health-checks | */5 min | Monitor tool uptime | Dashboard /health page |
| webhook-retry | */2 min | Retry failed webhooks | Not visible to users |
| alert-check | */5 min | Consumer spending alerts | Consumer alerts page |
| abandoned-checkout | Hourly | Recovery emails for incomplete purchases | Not visible |
| expire-sessions | */10 min | Session cleanup | Not visible |
| aggregate-usage | Daily | Roll up usage stats | Powers analytics |
| onboarding-drip | Hourly | Welcome email sequence | Not visible |
| quality-check | */15 min | Tool quality monitoring | Dashboard alerts |
| monthly-summary | 1st of month | Developer earnings email | Not visible |
| crawl-registry | Every 6 hrs | Index MCP servers from 4 registries | Powers /explore |
| monitor-reddit | Every 4 hrs | Reddit mention tracking | Not visible |
| monitor-github-repos | Daily 8am | GitHub repo scanning for new tools | Not visible |
| weekly-report | Monday 9am | Weekly performance email | Not visible |
| claim-outreach | Daily 10am | Email unclaimed tool developers | Powers /claim flow |
| crawl-services | Daily noon | Crawl non-MCP service directories | Powers /explore |
| data-retention | Not in vercel.json | Data cleanup | Not visible |
| ecosystem-metrics | Not in vercel.json | Aggregate ecosystem stats | Not visible |

### 1.4 Packages

| Package | Purpose |
|---------|---------|
| `@settlegrid/mcp` | Core TypeScript SDK |
| `create-settlegrid-tool` | CLI scaffolding tool |
| `@settlegrid/discovery` | MCP Discovery Server |
| `langchain-settlegrid` | LangChain integration package |
| `n8n-settlegrid` | n8n community node |
| `publish-action` | GitHub Action for CI/CD publish |

### 1.5 Scripts

| Script | Purpose |
|--------|---------|
| `gridbot/` | Demand simulator (scheduler + index) |
| `founder-tools/` | 5 utilities: code-metrics, hash-generator, json-formatter, url-analyzer, word-counter |
| `demo-agents/` | 3 reference agents: code-review, content, research |
| `service-templates/` | 6 non-MCP templates: browser-scraper, code-sandbox, email-sender, image-generator, llm-proxy, search-api |
| `extract-mcp-developers.ts` | Prospect extraction from registries |
| `update-template-readmes.ts` | Template README auto-updater |

### 1.6 Open-Source Templates

1,017 server templates in `/open-source-servers/`

---

## 2. Front-End Page Inventory

### 2.1 Marketing Pages

| Route | Content |
|-------|---------|
| `/` (homepage) | Hero, 3-step flow, 6 core features, comparison table, pricing, DX features, FAQ |
| `/pricing` | 3 plans, progressive take rate table, competitor comparison, FAQ |
| `/about` | Company information |
| `/api-monetization` | "Not just MCP" -- any API positioning, code examples, DIY comparison |
| `/use-cases` | Use case scenarios including Smart Proxy mention |
| `/changelog` | Feature changelog (Smart Proxy, cost-based routing listed) |
| `/stickers` | Physical sticker pack ordering |
| `/start` | Paste-Price-Publish 3-step onboarding flow |
| `/try` | Interactive trial |
| `/faq` | Comprehensive FAQ page |
| `/privacy` | Privacy policy |
| `/terms` | Terms of service |
| `/review-policy` | Review moderation policy |

### 2.2 Solutions & Explore Pages

| Route | Content |
|-------|---------|
| `/solutions` | Hub for 8 solution categories |
| `/solutions/[category]` | Per-category landing pages with code examples |
| `/explore` | Tool browsing |
| `/explore/category/[cat]` | Category-filtered views |
| `/explore/category/[cat]/cheapest` | Price-sorted view |
| `/explore/category/[cat]/reliable` | Reliability-sorted view |
| `/explore/category/[cat]/top` | Popularity-sorted view |
| `/explore/collections` | Curated collections hub |
| `/explore/collections/[slug]` | Individual collection pages |
| `/explore/for/[framework]` | Framework-specific tool pages |

### 2.3 Learn Pages

| Route | Content |
|-------|---------|
| `/learn` | Learning hub |
| `/learn/blog/[slug]` | Blog posts |
| `/learn/compare/[slug]` | Competitor comparisons |
| `/learn/discovery` | Discovery API documentation |
| `/learn/glossary` | AI billing glossary (includes Smart Proxy, cost-based routing) |
| `/learn/handbook` | Developer handbook |
| `/learn/how-to/[slug]` | How-to guides |
| `/learn/integrations` | Framework integration hub |
| `/learn/integrations/[slug]` | Per-framework integration guides |
| `/learn/mcp-zero-problem` | MCP monetization problem explanation |
| `/learn/protocols/[slug]` | Payment protocol pages |
| `/learn/state-of-mcp-2026` | Industry report |

### 2.4 Dashboard Pages

| Route | Purpose |
|-------|---------|
| `/dashboard` | Main developer dashboard with stats, achievements, invite card |
| `/dashboard/analytics` | Revenue and usage analytics |
| `/dashboard/audit-log` | Audit log viewer |
| `/dashboard/discovery` | Tool discoverability settings |
| `/dashboard/fraud` | Fraud detection dashboard |
| `/dashboard/health` | Tool health monitoring |
| `/dashboard/payouts` | Payout management |
| `/dashboard/referrals` | Referral tracking |
| `/dashboard/reputation` | Reputation score |
| `/dashboard/reviews` | Review management |
| `/dashboard/settings` | Account settings, Stripe connect |
| `/dashboard/tools` | Tool management |
| `/dashboard/webhooks` | Webhook configuration |

### 2.5 Consumer Pages

| Route | Purpose |
|-------|---------|
| `/consumer` | Consumer dashboard home |
| `/consumer/budgets` | Budget management |
| `/consumer/explorer` | Transaction explorer with anomaly detection |
| `/consumer/onboard` | Consumer onboarding |

### 2.6 Other Pages

| Route | Purpose |
|-------|---------|
| `/docs` | Full documentation (FAQ-style, 50+ questions, templates section, badge API) |
| `/tools` | Tool showcase/directory |
| `/tools/[slug]` | Individual tool pages |
| `/tools/[slug]/with/[framework]` | Tool x framework integration pages |
| `/servers` | 1,017 open-source template browser |
| `/developers` | Developer directory |
| `/developers/[id]` | Developer profile pages |
| `/dev/[slug]` | Developer public profile |
| `/guides` | Guide hub |
| `/guides/[slug]` | Individual guides |
| `/claim/[token]` | Claim-your-listing flow |
| `/register` | Registration (with First 100 banner) |
| `/login` | Login |
| `/admin` | Admin panel |
| `/gate` | Access gate |

---

## 3. Gap Matrix: Back-End Capability x Front-End Visibility

### Rating Key
- **GREEN** -- Well positioned: prominent on marketing pages, clear value prop, CTA
- **YELLOW** -- Mentioned: referenced but not prominent, no dedicated section
- **RED** -- Hidden: exists in back-end but invisible or nearly invisible to visitors

### Check 1: Smart Proxy
| Question | Answer |
|----------|--------|
| Back-end exists? | Yes -- `/api/proxy/[slug]` with full metering, budget checks, streaming |
| Homepage? | **YELLOW** -- Listed as a Scale plan feature ("Smart Proxy & Transaction Explorer") |
| Solutions pages? | No dedicated section |
| Docs? | Referenced in FAQ answers but no dedicated Smart Proxy section |
| Pricing? | Listed as Scale feature |
| Glossary? | Yes -- full definition |
| Changelog? | Yes -- dedicated entry |
| Use-cases? | Yes -- mentioned in API wrapper use case |
| /start page? | **GREEN** -- The entire /start flow IS the Smart Proxy in action (paste URL, auto-detect, publish) |
| Code example? | No standalone Smart Proxy code example |
| **Rating** | **YELLOW** -- The /start page uses it but never names it. A visitor looking for "zero-code billing" would not find a dedicated page explaining Smart Proxy. |

### Check 2: Cost-Based Routing
| Question | Answer |
|----------|--------|
| Back-end exists? | Yes -- `/api/v1/discover?sort=price&max_cost=X&min_rating=Y` + `/api/v1/discover/route` with fallback chains |
| Homepage? | Not mentioned |
| Docs? | Not documented as a feature |
| Glossary? | Yes -- definition exists |
| Changelog? | Yes -- mentioned in changelog metadata |
| Explore pages? | **GREEN** -- `/explore/category/[cat]/cheapest` sorts by price |
| Discovery page? | **YELLOW** -- mentioned in `/learn/discovery` |
| Code example? | No |
| **Rating** | **YELLOW** -- The routing API (`/route` endpoint with fallback chains) is a major competitive differentiator but has no dedicated marketing section, no documentation, and no code example showing how an agent would use it. |

### Check 3: Transaction Explorer
| Question | Answer |
|----------|--------|
| Back-end exists? | Yes -- `/api/consumer/explorer` with anomaly detection (spending spikes, error rate spikes, budget warnings), per-agent breakdown |
| Consumer dashboard? | **GREEN** -- Full `/consumer/explorer` page with anomaly cards, filtering, agent breakdown |
| Marketing? | **YELLOW** -- Listed as Scale plan feature on homepage ("Smart Proxy & Transaction Explorer") |
| Docs? | Not specifically documented |
| **Rating** | **YELLOW** -- Fully built in the consumer dashboard but not marketed as a feature. No screenshots, no feature section on the homepage or marketing pages. |

### Check 4: Progressive Pricing
| Question | Answer |
|----------|--------|
| Back-end exists? | Yes -- `lib/pricing.ts` with marginal bracket calculations |
| Pricing page? | **GREEN** -- Full table with brackets, comparison vs 15% flat, examples |
| Homepage? | **GREEN** -- Pricing section with all tiers and progressive rate callout |
| /api-monetization? | **GREEN** -- Progressive rate cards displayed |
| Dashboard? | **GREEN** -- `calculateTakeCents` imported and used in dashboard |
| Docs? | **GREEN** -- Referenced in FAQ answers |
| llms.txt? | **GREEN** -- Fully described |
| **Rating** | **GREEN** -- Well positioned everywhere. |

### Check 5: Gamification/Achievements
| Question | Answer |
|----------|--------|
| Back-end exists? | Yes -- 12 badges, auto-unlock logic, progress tracking |
| Dashboard? | **GREEN** -- Achievement grid with progress bars, social sharing, toast notifications on unlock |
| Marketing? | **RED** -- Not mentioned on any marketing page |
| Docs? | Not documented |
| llms.txt? | Not mentioned |
| **Rating** | **YELLOW** -- Fully wired in the dashboard with toasts and social sharing, but zero marketing visibility. A prospect evaluating SettleGrid would never know gamification exists. |

### Check 6: Claim-Your-Listing
| Question | Answer |
|----------|--------|
| Back-end exists? | Yes -- claim-outreach cron, claim API, claim tokens, developer email resolver |
| /claim/[token] page? | **GREEN** -- Full claim flow with auth, tool details, CTA |
| Marketing? | **RED** -- No mention of "claim your listing" on any marketing page |
| Docs? | Not documented |
| Homepage? | Not mentioned |
| **Rating** | **RED** -- The entire claim-outreach pipeline (cron crawls registries, resolves developer emails, sends claim emails) is invisible. Developers who receive a claim email can act on it, but the marketing site never positions this as a feature or explains the concept. |

### Check 7: MCP Sub-Registry
| Question | Answer |
|----------|--------|
| Back-end exists? | Yes -- Full v0.1 spec at `/api/v0.1/servers` with 4 extensions |
| Marketing? | **YELLOW** -- "Listed on the Official MCP Registry" referenced but SettleGrid's own sub-registry is not highlighted |
| Docs? | **GREEN** -- Discovery API section documents the MCP Discovery Server |
| Can developers browse? | Indirectly via /tools and /explore, but not via /api/v0.1/ directly |
| **Rating** | **YELLOW** -- The sub-registry exists and works but is not positioned as a differentiator. The fact that SettleGrid IS a registry (not just listed on registries) is undersold. |

### Check 8: Auto-Crawlers
| Question | Answer |
|----------|--------|
| Back-end exists? | Yes -- 4 registry crawlers + 3 additional crawlers + 15 cron jobs |
| "20,000+ services indexed"? | Not claimed. Homepage says "8+ registries" and "1,017 templates" |
| Auto-indexing explained? | **YELLOW** -- `/learn/discovery` mentions auto-listing, tools page mentions auto-indexing |
| Marketing? | **YELLOW** -- Referenced but not prominently positioned |
| **Rating** | **YELLOW** -- The crawling infrastructure is massive (4 registries, 3 supplementary crawlers, 6-hour rotation) but the marketing doesn't convey the scale. |

### Check 9: GitHub App
| Question | Answer |
|----------|--------|
| Back-end exists? | Yes -- webhook handler, repo scanning, JWT auth, file fetching |
| Documentation? | **RED** -- No documentation on how to install it |
| Marketing? | **RED** -- Not mentioned on any marketing page |
| Dashboard? | **RED** -- No "Connect GitHub" section visible |
| **Rating** | **RED** -- The GitHub App integration is fully built (webhook handler, installation token exchange, repo scanning) but completely invisible. No install link, no documentation, no marketing mention. |

### Check 10: n8n Node + LangChain Package + Publish Action
| Question | Answer |
|----------|--------|
| Packages exist? | Yes -- all 3 packages in /packages/ |
| n8n mentioned? | **RED** -- Not mentioned anywhere in the front-end |
| LangChain mentioned? | **GREEN** -- Integration guide exists at `/learn/integrations/langchain`, referenced in docs FAQ, blog post mentions it |
| Publish Action mentioned? | **RED** -- Not mentioned anywhere in the front-end |
| npm links? | **YELLOW** -- `@settlegrid/mcp` linked, but `langchain-settlegrid`, `n8n-settlegrid`, and `publish-action` are not linked |
| **Rating** | n8n: **RED**, LangChain: **GREEN**, Publish Action: **RED** |

### Check 11: Framework Integrations
| Question | Answer |
|----------|--------|
| Back-end exists? | Yes -- 6 frameworks with full code templates |
| /learn/integrations? | **GREEN** -- Hub page + per-framework pages |
| /explore/for/[framework]? | **GREEN** -- Framework-specific tool pages |
| /tools/[slug]/with/[framework]? | **GREEN** -- Tool x framework integration pages |
| Code examples? | **GREEN** -- Full code examples for all 6 frameworks |
| **Rating** | **GREEN** -- Thorough coverage across multiple page types. |

### Check 12: Broader Positioning ("Any API")
| Question | Answer |
|----------|--------|
| Back-end supports any handler? | Yes -- SDK wraps any function |
| /api-monetization page? | **GREEN** -- Dedicated page saying "Not just MCP" with REST + serverless examples |
| Homepage? | **GREEN** -- "LLM inference, browser automation, media generation, code execution, data APIs, MCP tools" |
| llms.txt? | **GREEN** -- Explicitly covers all service types |
| SDK package name? | **YELLOW** -- Still `@settlegrid/mcp` which implies MCP-only |
| **Rating** | **GREEN** -- The messaging is clearly "any AI service" across all pages. The SDK name is the only holdover. |

### Check 13: 1,017 Templates
| Question | Answer |
|----------|--------|
| Templates exist? | Yes -- 1,017 files in `/open-source-servers/` |
| Homepage? | **GREEN** -- Hero badge "1,017 open-source templates", prominent link to /servers |
| /servers page? | **GREEN** -- Browse page exists |
| Docs? | **GREEN** -- Templates section with MCP and REST categories |
| **Rating** | **GREEN** -- Well positioned with prominent hero placement. |

### Check 14: Referral System
| Question | Answer |
|----------|--------|
| Back-end exists? | Yes -- invite codes, 5K ops bonus, commission tracking, metering integration |
| Dashboard? | **GREEN** -- Prominent "Invite Developers" card with copy URL, stats, link to /dashboard/referrals |
| Marketing? | **YELLOW** -- Listed as Builder plan feature ("CSV export & referral system") |
| Docs? | **GREEN** -- FAQ answer explains referral system |
| **Rating** | **YELLOW** -- Visible in dashboard but not prominently marketed. No dedicated referral landing page. |

### Check 15: First 100 Campaign
| Question | Answer |
|----------|--------|
| Back-end exists? | Yes -- developer count query, banner logic |
| Homepage? | **GREEN** -- `First100Banner` component renders when count < 100 |
| Register page? | **GREEN** -- "You're joining the first 100 -- lifetime free tier included" |
| **Rating** | **GREEN** -- Well wired on both homepage and register page. |

---

## 4. Additional Hidden Capabilities Discovered

### 4.1 Features Built But Not Marketed

| Feature | Back-end | Front-end visibility | Rating |
|---------|----------|---------------------|--------|
| **Fraud detection** (12 signals) | Full engine in `lib/fraud.ts` | Dashboard page exists, listed as Scale feature | YELLOW |
| **Quality gates** | `lib/quality-gates.ts` with automated checks | Mentioned in docs FAQ | YELLOW |
| **A2A protocol** | `/api/a2a` with skills endpoint | No marketing mention | RED |
| **x402 protocol** | `/api/x402/settle`, `/verify`, `/supported` | Listed in comparison table, no dedicated page | YELLOW |
| **Auto-refill credits** | `lib/auto-refill.ts` | Listed in comparison table feature list | YELLOW |
| **Content filtering** | `lib/content-filter.ts` | Not mentioned anywhere | RED |
| **Webhook retry system** | Cron every 2 minutes | Not mentioned in marketing | RED |
| **Onboarding drip emails** | Cron hourly | Not visible | RED |
| **Monthly summary emails** | Cron 1st of month | Not visible | RED |
| **Reddit monitoring** | Cron every 4 hours | Not visible (internal growth tool) | N/A |
| **Abandoned checkout recovery** | Cron hourly | Not visible | RED |
| **Developer reputation system** | Full scoring algorithm | Dashboard page exists, not marketed | YELLOW |
| **Consumer alerts** | API + UI with spending/error alerts | Consumer dashboard only, not marketed | RED |
| **IP allowlisting** | API + settings | Listed in comparison table | YELLOW |
| **Audit logging** | Full audit trail with CSV export | Dashboard page, Scale feature | YELLOW |
| **Outcome-based billing** | `/api/outcomes` | Listed in comparison table, solution pages | YELLOW |
| **Agent identity (KYA)** | Listed as feature | Mentioned in comparison table | YELLOW |
| **OpenAPI 3.1 spec** | `/api/openapi.json` | Listed in DX features, not linked | YELLOW |
| **SSE streaming** | `/api/stream` | Listed in DX features | YELLOW |
| **Sticker packs** | `/stickers` page + API | Has dedicated page | GREEN |
| **GridBot demand generator** | `scripts/gridbot/` | Not visible (internal) | N/A |
| **Founder tools** | `scripts/founder-tools/` | Not visible (internal) | N/A |
| **Demo agents** | `scripts/demo-agents/` | Not visible (internal) | N/A |
| **6 non-MCP service templates** | `scripts/service-templates/` | Not visible | RED |
| **Prospect extraction** | `scripts/extract-mcp-developers.ts` | Not visible (internal) | N/A |
| **create-settlegrid-tool CLI** | Published package | **GREEN** -- Prominent on homepage, docs, guides |
| **Discovery Server** | Published package | **GREEN** -- Documented in docs and learn |

---

## 5. Priority-Ranked Action Items

### CRITICAL (Revenue/conversion impact)

**C1. GitHub App -- Complete invisibility**
- **Gap**: Full GitHub App integration built (webhook, JWT, repo scanning) but zero front-end presence
- **Fix**: Add "Connect GitHub" section to `/dashboard/settings` with install link. Add `/learn/integrations/github` guide page. Mention on homepage in DX features list.
- **Page**: `/dashboard/settings`, `/learn/integrations/github`, `/docs`
- **Copy**: "Install the SettleGrid GitHub App to auto-discover and list MCP servers from your repositories. Push code, get listed."

**C2. n8n Community Node -- Zero mention**
- **Gap**: Published package `n8n-settlegrid` has no front-end visibility whatsoever
- **Fix**: Add to `/learn/integrations` hub. Create `/learn/integrations/n8n` guide page. Link to npm.
- **Page**: `/learn/integrations/n8n`
- **Copy**: "Use SettleGrid tools in n8n workflows. The n8n-settlegrid community node lets you discover, invoke, and manage billing for any SettleGrid tool directly from your n8n automations."

**C3. GitHub Publish Action -- Zero mention**
- **Gap**: Published GitHub Action for CI/CD publishing has no documentation or marketing
- **Fix**: Add to docs "Deployment" section. Create brief guide.
- **Page**: `/docs` (deployment section), `/learn/how-to/ci-cd-publish`
- **Copy**: "Automate tool publishing with the SettleGrid GitHub Action. Add to your CI/CD pipeline to publish or update tools on every push."

### HIGH (Competitive advantage not communicated)

**H1. Cost-Based Routing -- Undersold differentiator**
- **Gap**: The `/api/v1/discover/route` endpoint with fallback chains is a unique competitive feature but has no dedicated marketing section, no code example, and no documentation
- **Fix**: Add dedicated section on homepage ("Cost-Based Routing" core feature card). Create `/learn/how-to/cost-based-routing` guide. Add to docs.
- **Page**: Homepage (core features), `/docs`, `/learn/how-to/cost-based-routing`
- **Copy**: "Agents automatically find the cheapest tool meeting their quality threshold. SettleGrid's routing engine compares price, latency, and reliability across all providers and routes to the optimal endpoint -- with automatic fallback chains."

**H2. Smart Proxy needs a dedicated section**
- **Gap**: The /start page IS the Smart Proxy experience but never names it. The concept of "zero-code billing via reverse proxy" deserves its own marketing section.
- **Fix**: Add Smart Proxy section to homepage. Add to docs with code example showing curl through the proxy.
- **Page**: Homepage, `/docs`
- **Copy**: "Zero-code billing. Point any API at the SettleGrid Smart Proxy -- authentication, balance checks, and metering happen transparently. No SDK required."

**H3. Transaction Explorer -- Unmarked competitive feature**
- **Gap**: Full anomaly detection (spending spikes, error rate spikes, budget warnings) is built but not marketed
- **Fix**: Add to homepage features. Add screenshot to marketing. Mention in /pricing as Scale feature detail.
- **Page**: Homepage, `/pricing`
- **Copy**: "Transaction Explorer with anomaly detection. See every call, spot spending spikes, catch error patterns, and get proactive budget warnings -- before your users file complaints."

**H4. A2A Protocol Support -- Hidden**
- **Gap**: `/api/a2a` with skills endpoint exists but has zero marketing presence
- **Fix**: Add to protocols list on homepage. Consider adding to `/learn/protocols/a2a`.
- **Page**: Homepage (protocol list), `/learn/protocols`
- **Copy**: "Native support for Google's Agent-to-Agent protocol. Your tools are automatically discoverable by A2A-compatible agents."

**H5. Claim-Your-Listing -- Powerful growth lever, zero visibility**
- **Gap**: The entire claim pipeline (crawl registries, resolve emails, send outreach, claim page) exists but is never mentioned in marketing
- **Fix**: Add to /about or /docs. Consider a "For existing MCP server developers" section on marketing pages.
- **Page**: Homepage or `/about`
- **Copy**: "Already have an MCP server? We've indexed it. Check your email for a claim link, or search for your tool on SettleGrid to claim it and start earning."

### MEDIUM (Polish and completeness)

**M1. Gamification/Achievements -- Dashboard-only**
- **Gap**: 12 badges with progress tracking, toasts, and social sharing exist in the dashboard but are never mentioned in marketing
- **Fix**: Add to homepage DX features list or as a callout. Mention in docs.
- **Copy**: "Earn badges as you grow -- First Tool Published, First Dollar, Going Viral, $1K Milestone. Share achievements on social media."

**M2. 6 Non-MCP Service Templates -- Hidden in scripts**
- **Gap**: Browser scraper, code sandbox, email sender, image generator, LLM proxy, and search API templates exist in `scripts/service-templates/` but are not browsable on the site
- **Fix**: Add to `/servers` page or create a "REST API Templates" section. Link from docs.
- **Page**: `/servers`, `/docs`

**M3. Consumer Alerts -- Not marketed**
- **Gap**: Spending alerts, error rate alerts, and budget warnings are fully built but not mentioned in any marketing
- **Fix**: Add to consumer-facing marketing (if targeting consumers) or mention in "platform features"
- **Page**: Homepage or dedicated consumer page

**M4. MCP Sub-Registry positioning**
- **Gap**: SettleGrid IS a registry (v0.1 spec compliant) but positions itself as "listed on registries" rather than being one
- **Fix**: Add "SettleGrid is a fully v0.1-compliant MCP registry" to docs and /learn/discovery
- **Page**: `/docs`, `/learn/discovery`

**M5. Referral system marketing**
- **Gap**: Working referral system with 5K ops bonus but no dedicated marketing
- **Fix**: Add referral program section to pricing page or create a /referrals landing page
- **Page**: `/pricing` or new `/referrals`

### LOW (Nice-to-have improvements)

**L1. OpenAPI spec link** -- `/api/openapi.json` exists but is not linked from docs
**L2. Webhook retry system** -- Mention in docs that failed webhooks auto-retry every 2 minutes
**L3. Onboarding drip emails** -- Mention in onboarding flow that welcome emails are coming
**L4. Monthly summary emails** -- Mention in dashboard settings that monthly summaries are sent
**L5. Content filtering** -- Document what content filtering is in place
**L6. Abandoned checkout recovery** -- Not user-facing but could be mentioned as a platform feature
**L7. SDK package name** -- `@settlegrid/mcp` still implies MCP-only despite "any API" positioning
**L8. Demo agents** -- 3 reference agents (code-review, content, research) could be showcased

---

## 6. Summary Statistics

| Metric | Count |
|--------|-------|
| Total API routes | 159 |
| Cron jobs | 17 (15 in vercel.json) |
| Front-end pages | ~65 unique routes |
| Published packages | 6 |
| Open-source templates | 1,017 |
| Solution categories | 8 |
| Tool categories | 23 |
| Framework integrations | 6 |
| Curated collections | 5 |
| Achievement badges | 12 |

### Alignment Score

| Rating | Count | Percentage |
|--------|-------|------------|
| GREEN (well positioned) | 12 | 40% |
| YELLOW (mentioned, not prominent) | 12 | 40% |
| RED (hidden from visitors) | 6 | 20% |

### Top 5 Revenue-Impact Gaps

1. **GitHub App** -- Complete integration built, zero visibility. Could drive automatic developer onboarding.
2. **Cost-Based Routing** -- Unique competitive moat, not marketed. This is THE feature that makes SettleGrid a "settlement layer" vs a "billing wrapper."
3. **n8n + Publish Action** -- Two published packages with zero front-end presence. n8n has 400K+ users.
4. **Claim-Your-Listing** -- Growth engine that converts existing MCP developers into SettleGrid users, but never mentioned.
5. **Smart Proxy dedicated section** -- The /start page demonstrates it but never names it; visitors cannot evaluate it as a feature.

---

## 7. Conclusion

SettleGrid's back-end is significantly more capable than its front-end communicates. The core billing and pricing features are well-represented (progressive take rate, templates, framework integrations, "any API" positioning). However, six substantial capabilities are completely hidden from visitors, and twelve more are mentioned but not prominently positioned.

The highest-impact fixes are all documentation and marketing page additions -- no new back-end work is required. The GitHub App, n8n node, Publish Action, cost-based routing, and claim-your-listing features represent completed engineering work that is delivering zero marketing value. Surfacing these would strengthen SettleGrid's competitive position against Stripe MPP, Nevermined, and Paid.ai without writing a single line of back-end code.
