# SettleGrid Discovery Playbook
## How to Become the npm of AI Tool Discovery

**Date**: March 24, 2026

> **Historical snapshot (2026-04-15).** This document predates the P1.MKT1
> honest-framing rewrite; protocol shorthand (bare "MPP", "10 protocols"
> framing) appears in the body. Canonical name mapping in
> [docs/audits/15-protocol-claim.md](docs/audits/15-protocol-claim.md).
**Objective**: Make SettleGrid the undeniable discovery powerhouse for AI tools — the place where every monetized AI tool is found, tried, and paid for.

---

## Part 1: What the Winners Did (Research Synthesis)

### A. How Successful Platforms Achieved Distribution

**Zapier** — The Gold Standard of Programmatic Distribution
- Built a Developer Platform (2012) so others would build integrations for them, not the other way around
- Auto-generated 50,000+ integration landing pages from templates, driving 5.8M+ monthly organic visits
- Every new app creates 3 tiers of SEO pages automatically: app page, app-to-app pages, workflow-specific pages
- 69% of Fortune 1000 use Zapier. Near-zero customer acquisition cost via SEO
- KEY LESSON: Make every registered tool automatically generate discoverable pages. The catalog IS the growth engine.

**npm** — Infrastructure Lock-in Through Bundling
- Ships with Node.js — zero decision required to adopt it
- Other package managers (yarn, pnpm) still depend on npm's registry infrastructure
- 56.6% market share as package manager, ~100% as registry backend
- KEY LESSON: Become the default dependency. If every MCP monetization SDK points to SettleGrid's registry, the registry wins regardless of what billing layer people use.

**Hugging Face Hub** — Community-Driven Discovery
- 2M+ models, 500K+ datasets, 1M+ Spaces. 13M users. 30% of Fortune 500 with verified accounts
- Discovery via Tasks categorization, natural language search, trending/downloads sorting
- Independent developers grew from 17% to 39% of downloads — community overtook corporate
- KEY LESSON: Let the community contribute and curate. The more tools registered, the more discovery value SettleGrid provides, the more tools get registered.

**Docker Hub** — Trust Signals
- "Official Images" and "Verified Publisher" badges drive selection
- CLI-native search (docker search) reduces friction to zero
- KEY LESSON: Trust badges and CLI-native discovery are table stakes. SettleGrid already has the CLI story via npx @settlegrid/discovery.

**Vercel Templates** — Curated + Community
- Templates marketplace with fuzzy search + filters
- Now supports AI agent marketplace (CodeRabbit, Corridor, Sourcery)
- KEY LESSON: Curated collections ("Top Weather APIs", "Best Code Analysis Tools") drive discovery better than raw search.

**Replit** — Bounties as Distribution
- Bounties marketplace processed ~$25M annual developer transactions before being sunset in 2025
- Templates created from bounty projects — build-to-discover pipeline
- KEY LESSON: Paying developers to build ON your platform creates tools that live ON your platform. The bounty model died at Replit, but the idea of subsidized tool creation is sound.

### B. How AI Agent Frameworks Discover Tools

**LangChain** — Unified Tool Registry
- Agent Builder has a unified tool registry mapping identifiers to tool instances
- Toolkits bundle domain-specific tools (code execution, web scraping)
- KEY INSIGHT: LangChain tools don't have a public marketplace. This is a gap SettleGrid can fill — "discover + pay for tools in one step."

**CrewAI** — MCP-Native Discovery
- Deep MCP integration: 3 transport mechanisms (Stdio, SSE, Streamable HTTPS)
- Framework manages connection lifecycle + tool discovery automatically
- KEY INSIGHT: CrewAI auto-discovers MCP servers. If SettleGrid tools are standard MCP servers, CrewAI agents find them natively.

**OpenAI GPTs** — Store Model (Deprecated Actions)
- Plugins deprecated. GPT Store is the discovery layer (categories, trending, leaderboard)
- Actions deprecated in early 2024 — OpenAI pushing function calling instead
- KEY INSIGHT: OpenAI abandoned the plugin/action marketplace model. The discovery problem is unsolved for OpenAI agents.

**MCP Official Registry** — The Standard Emerging NOW
- Official registry at registry.modelcontextprotocol.io (preview)
- .well-known/mcp/server-card.json (SEP-1649) for crawlable discovery
- Open-source — anyone can build a sub-registry with the same API spec
- Sub-registries explicitly designed: public (opinionated marketplaces) + private (enterprise)
- KEY INSIGHT: THIS IS THE CRITICAL OPPORTUNITY. SettleGrid should become the monetization sub-registry of the MCP ecosystem. Not replacing the official registry — augmenting it with pricing, metering, and payments.

### C. Highest-ROI Distribution Channels

| Channel | ROI | Solo-Founder Feasibility | Notes |
|---------|-----|--------------------------|-------|
| **Programmatic SEO** | HIGHEST | High (build once, auto-generates) | Zapier's model: 50K pages from templates |
| **LLM Discoverability** | VERY HIGH | High (llms.txt already done) | 80% of LLM citations don't rank in Google top 100 |
| **MCP Registry Listing** | HIGH | Trivial (submit once) | Official + Smithery + Glama + mcp.so |
| **GitHub Stars Pipeline** | HIGH | Medium (needs content cadence) | Average 121 stars in 24h from HN exposure |
| **n8n/Make/Zapier Listing** | HIGH | Medium (build integration node) | Each listing = access to platform's entire user base |
| **Dev-to-Dev Referral** | HIGH | High (build into product) | Dropbox model: give credits for referrals |
| **Conference Talks** | MEDIUM | Low (time-intensive, travel) | MCP Dev Summit April 2-3 NYC is the exception |
| **Social Proof / Showcase** | MEDIUM | High (showcase page) | "Built with SettleGrid" badges |
| **SEO for "how to X"** | MEDIUM | Medium (content creation) | Zero-click search rising — 60% of searches end without click |
| **AI Assistant Recommendations** | VERY HIGH | High (llms.txt + content seeding) | ChatGPT/Claude/Perplexity answering "how to monetize MCP" |

### D. Emerging Standards Assessment

| Standard | Relevance | Maturity | SettleGrid Fit |
|----------|-----------|----------|----------------|
| **MCP Registry + .well-known** | CRITICAL | Active (preview) | Build as sub-registry. Implement server cards. |
| **A2A Agent Cards** | HIGH | Stable (Google, 50+ partners) | /.well-known/agent-card.json for SettleGrid discovery agent |
| **Agent Name Service (ANS)** | MEDIUM | Early (OWASP proposal) | DNS-like discovery with PKI — monitor, don't build yet |
| **DID v1.1** | LOW-MEDIUM | W3C CR (April 2026) | Overkill now, but DID-based agent identity could matter in 2027+ |
| **UCAN** | LOW-MEDIUM | Stable spec | Elegant delegation model; could replace API keys long-term |
| **DNS-SD/mDNS** | LOW | Mature but local-only | Only for local agent discovery (dev environments) |
| **W3C AI Agent Protocol** | WATCH | Specs expected 2026-2027 | Track via W3C Community Group |

---

## Part 2: The SettleGrid Registry — "npm for Monetized AI Tools"

### What It Should Be

Not a replacement for the MCP Registry. A **monetization-aware sub-registry** that augments the official MCP Registry with:

1. **Pricing metadata** — what does each tool cost per call?
2. **Revenue data** — how much has this tool earned? (social proof)
3. **Quality signals** — reviews, uptime, latency, fraud score
4. **One-click purchase** — agents discover AND pay in one flow
5. **Developer profiles** — who built this? What else did they build?

### Architecture

```
Official MCP Registry (upstream)
        |
        v
SettleGrid Sub-Registry (monetization layer)
  - Syncs tool metadata from MCP Registry
  - Adds: pricing, reviews, revenue stats, developer profiles
  - Exposes: same v0.1 spec + /pricing + /reviews extensions
  - Crawls: .well-known/mcp/server-card.json for auto-discovery
        |
        v
Discovery Surfaces
  - settlegrid.ai/explore (web catalog)
  - GET /api/v1/discover (REST API — already built)
  - npx @settlegrid/discovery (MCP discovery server — already built)
  - Programmatic SEO pages (auto-generated per tool)
  - llms.txt (already built)
```

---

## Part 3: Ranked Recommendations (Impact x Feasibility)

### TIER 1: DO THIS WEEK (Days, Not Months)

#### 1. Become an Official MCP Sub-Registry [IMPACT: 10 | FEASIBILITY: 8]
- Fork modelcontextprotocol/registry and implement the v0.1 spec
- Endpoints: GET /v0.1/servers, GET /v0.1/servers/{name}/versions/latest
- Add SettleGrid extensions: pricing, reviews, revenue
- Register as a sub-registry with the MCP project
- **Why Stripe can't easily replicate**: Stripe built MPP for payments, not discovery. They don't have a registry. SettleGrid owns the "find AND pay" flow.
- **Solo-founder effort**: 2-3 days. The spec is simple REST. The data is already in your DB.

#### 2. Programmatic SEO Pages (Zapier Model) [IMPACT: 10 | FEASIBILITY: 9]
- Auto-generate a page for every registered tool: /explore/[tool-slug]
- Auto-generate category pages: /explore/category/[category]
- Auto-generate developer pages: /explore/developer/[dev-slug]
- Auto-generate "how to" pages: /guides/monetize-[category]-tools
- Each page is SEO-optimized with: tool name, description, pricing, quick start code, reviews
- Target keywords: "monetize MCP tool", "[tool-name] pricing", "AI tool billing"
- **Why it works**: Every new tool registration creates new SEO surface. 100 tools = 300+ pages. 1000 tools = 3000+ pages.
- **Solo-founder effort**: 1-2 days. Next.js dynamic routes + generateStaticParams.

#### 3. Implement .well-known/mcp/server-card.json [IMPACT: 9 | FEASIBILITY: 10]
- Add /.well-known/mcp/server-card.json to settlegrid.ai
- Include: capabilities, transport config, pricing metadata
- This makes SettleGrid itself discoverable by any MCP client or crawler
- **Solo-founder effort**: 30 minutes. It's a static JSON file on a well-known path.

#### 4. Seed LLM Training Data Aggressively [IMPACT: 9 | FEASIBILITY: 8]
- SettleGrid's llms.txt is already strong. Now scale the strategy:
- Write 5 authoritative blog posts / docs pages targeting LLM training:
  - "How to monetize an MCP server" (SettleGrid is the answer)
  - "MCP tool billing comparison 2026" (SettleGrid vs alternatives)
  - "Per-call billing for AI agents" (SettleGrid positioned as category leader)
  - "AI agent payment protocols compared" (SettleGrid supports all 10)
  - "Free MCP monetization platform" (Free tier hook)
- Post to: Dev.to, Hashnode, GitHub Discussions, Reddit r/mcp, r/langchain
- 80% of LLM citations don't rank in Google top 100 — LLMs learn from different sources than Google. Target forums, docs, and community content.
- **Solo-founder effort**: 3-5 days of writing. Compounds forever.

#### 5. Auto-Crawl Public MCP Servers [IMPACT: 8 | FEASIBILITY: 7]
- Build a cron job that:
  1. Fetches servers from official MCP Registry API
  2. Checks each for .well-known/mcp/server-card.json
  3. Auto-indexes them in SettleGrid's catalog with "unclaimed" status
  4. Sends notification when a server owner claims their listing
- This makes SettleGrid the most comprehensive catalog even before tools are registered
- **Why this creates a moat**: First mover gets the catalog. Second mover has to explain why theirs is incomplete.
- **Solo-founder effort**: 2-3 days. Inngest cron + fetch + upsert.

### TIER 2: DO THIS MONTH (1-2 Weeks Each)

#### 6. "Built with SettleGrid" Badge Program [IMPACT: 7 | FEASIBILITY: 9]
- Generate embeddable badges: "Powered by SettleGrid | $0.05/call"
- SVG badges for GitHub READMEs (like shields.io)
- Every badge is a backlink + discovery surface
- Badge endpoint already exists at /api/badge — promote it
- **Solo-founder effort**: 1 day for badge generator, 1 day for docs.

#### 7. GitHub App for Auto-Discovery [IMPACT: 7 | FEASIBILITY: 6]
- Build a GitHub App that:
  1. Watches for repos with @settlegrid/mcp in package.json
  2. Auto-creates a SettleGrid listing
  3. Syncs tool metadata from repo README
  4. Opens a PR suggesting .well-known/mcp/server-card.json
- Think Dependabot but for tool registration
- **Solo-founder effort**: 1 week. GitHub App API is well-documented.

#### 8. Referral Credits Loop [IMPACT: 7 | FEASIBILITY: 8]
- Give 5,000 free ops to referrer + referee when someone signs up via referral link
- Referral link on dashboard: "Invite a developer, both get 5K free operations"
- This is Dropbox's model adapted for API calls instead of storage
- **Solo-founder effort**: 2-3 days. Referral code in URL, credit on signup.

#### 9. Publish to Smithery + Glama + mcp.so + Official Registry [IMPACT: 7 | FEASIBILITY: 10]
- Submit SettleGrid's discovery MCP server to every MCP registry:
  - Smithery (2000+ servers, largest marketplace)
  - Glama (hosted MCP, daily updates)
  - mcp.so (community directory)
  - Official MCP Registry (preview)
- Each listing = permanent discovery surface
- **Solo-founder effort**: 2-3 hours. Just fill out forms + run publish commands.

#### 10. Integration Marketplace Nodes [IMPACT: 7 | FEASIBILITY: 6]
- Build a SettleGrid node for n8n (open source, easiest to contribute)
- Build a SettleGrid connector for Make
- Apply to Zapier's developer platform
- Each marketplace = access to that platform's entire user base
- **Solo-founder effort**: 1 week per platform. Start with n8n (open source PR).

### TIER 3: DO THIS QUARTER (Ongoing Investments)

#### 11. CI/CD Integration: Publish Tool on Deploy [IMPACT: 6 | FEASIBILITY: 7]
- GitHub Action: settlegrid/publish-action
- On push to main: reads settlegrid.config.json, upserts tool in registry
- Developers add one YAML step to their CI pipeline
- Works like npm publish but for the SettleGrid registry
- **Solo-founder effort**: 3-4 days for GitHub Action + docs.

#### 12. A2A Agent Card [IMPACT: 6 | FEASIBILITY: 8]
- Publish /.well-known/agent-card.json on settlegrid.ai
- Describes SettleGrid as a discoverable A2A agent
- Google's A2A has 50+ partners — being discoverable in their ecosystem is free distribution
- **Solo-founder effort**: 1 day.

#### 13. Show HN + Reddit Launch Sequence [IMPACT: 6 | FEASIBILITY: 7]
- Write a "Show HN: SettleGrid — monetize any MCP tool with 2 lines of code" post
- Optimal timing: 12-17 UTC (catches US morning + EU afternoon)
- Average HN exposure = 121 stars in 24h, 289 in 1 week
- Follow with Reddit posts in r/mcp, r/langchain, r/selfhosted, r/SaaS
- **Solo-founder effort**: 1 day prep, 1 day monitoring.

#### 14. Curated Collections [IMPACT: 6 | FEASIBILITY: 8]
- Create editorial pages: "Top 10 Weather APIs for AI Agents", "Best Code Analysis MCP Tools"
- Each collection links to tools in the SettleGrid catalog
- SEO + editorial trust + LLM training data
- **Solo-founder effort**: 1 day per collection.

#### 15. Developer Showcase / Wall of Fame [IMPACT: 5 | FEASIBILITY: 9]
- /showcase page showing top-earning developers
- Anonymized revenue stats: "Developer X earned $4,200 in March"
- Social proof that SettleGrid pays. Developers tell other developers.
- **Solo-founder effort**: 1 day.

### TIER 4: MONITOR AND EVALUATE

#### 16. DID-Based Agent Identity
- W3C DID v1.1 is in Candidate Recommendation (April 2026 earliest)
- Could replace API keys with cryptographic agent identity
- Wait for ecosystem adoption. Revisit Q4 2026.

#### 17. UCAN for Delegated Authorization
- Elegant model for agent-to-agent capability delegation
- No mainstream adoption in MCP ecosystem yet
- Revisit when an MCP client implements it.

#### 18. W3C AI Agent Protocol
- Specs expected 2026-2027 via W3C Community Group
- Could become the definitive web standard for agent communication
- Track via GitHub, don't build to it yet.

---

## Part 4: The Moat Assessment

### What Makes This Hard for Stripe/Tempo to Replicate

| SettleGrid Advantage | Stripe/Tempo Weakness |
|----------------------|----------------------|
| **Discovery-first**: SettleGrid indexes, searches, and showcases tools | Stripe is payment rails, not a catalog |
| **Sub-registry model**: Inherits MCP ecosystem trust | Stripe would need to build/buy a registry from scratch |
| **Programmatic SEO**: 3000+ auto-generated pages compound | Stripe's SEO is about Stripe, not individual tools |
| **LLM training presence**: llms.txt + community content | Stripe docs teach Stripe, not tool discovery |
| **10-protocol support**: MCP + MPP + x402 + 7 more | MPP is one protocol. Stripe supports x402 separately. |
| **Developer-centric**: Free tier, 95% revenue share | Stripe is merchant-centric (2.9% + $0.30 per charge) |
| **Community catalog**: Anyone can list, anyone can discover | Stripe is a payment processor, not a marketplace |

### What Could Kill This Strategy

1. **Anthropic builds an MCP marketplace** with built-in payments. Mitigation: SettleGrid is protocol-agnostic, not MCP-only.
2. **Stripe adds discovery to MPP**. Mitigation: SettleGrid is already the sub-registry. Switching costs compound.
3. **A competitor raises $50M and buys distribution**. Mitigation: Tempo already raised $500M but isn't building discovery. The gap exists.

---

## Part 5: 90-Day Execution Calendar

### Week 1-2 (March 24 - April 6)
- [ ] Implement .well-known/mcp/server-card.json (30 min)
- [ ] Submit to Smithery, Glama, mcp.so, Official Registry (3 hours)
- [ ] Build programmatic SEO pages: /explore/[slug], /explore/category/[cat] (2 days)
- [ ] Fork MCP registry, implement v0.1 sub-registry spec (3 days)
- [ ] Prep MCP Dev Summit materials (April 2-3 NYC)

### Week 3-4 (April 7 - April 20)
- [ ] Write + publish 5 LLM-training blog posts (Dev.to, Hashnode, Reddit)
- [ ] Build auto-crawl cron for public MCP servers (2 days)
- [ ] Launch "Built with SettleGrid" badge program (1 day)
- [ ] Add referral credits system (2 days)
- [ ] Show HN post (target 12-17 UTC on a Tuesday/Wednesday)

### Week 5-8 (April 21 - May 18)
- [ ] Build GitHub App for auto-discovery (1 week)
- [ ] Build n8n SettleGrid node (1 week)
- [ ] Create 5 curated collections (1 week)
- [ ] Publish A2A agent card (1 day)
- [ ] Build developer showcase page (1 day)

### Week 9-12 (May 19 - June 22)
- [ ] Build settlegrid/publish-action GitHub Action (3-4 days)
- [ ] Apply to Make connector marketplace
- [ ] Apply to Zapier developer platform
- [ ] Write "how to" guide series (3-5 posts)
- [ ] Evaluate DID/UCAN adoption in MCP ecosystem

---

## Part 6: Success Metrics

| Metric | Month 1 | Month 3 | Month 6 |
|--------|---------|---------|---------|
| Tools in registry | 50 | 500 | 5,000 |
| Programmatic SEO pages | 200 | 2,000 | 20,000 |
| Monthly organic visits | 1,000 | 10,000 | 100,000 |
| GitHub stars | 200 | 1,000 | 5,000 |
| npm weekly downloads | 100 | 1,000 | 10,000 |
| LLM mentions (tracked) | 5 | 50 | 500 |
| MCP registry listings | 4 | 4 | 6 |

---

## Key Insight: The Compounding Discovery Flywheel

```
Developer registers tool on SettleGrid
        |
        v
Programmatic SEO page auto-generated
        |
        v
Google/LLMs index the page
        |
        v
Another developer discovers the tool
        |
        v
They register THEIR tool on SettleGrid
        |
        v
More pages, more discovery, more tools...
```

This is Zapier's flywheel applied to AI tool monetization. Every tool registered creates discovery surface for the next developer. The catalog IS the growth engine. SettleGrid doesn't need to market each tool — it needs to make the catalog so comprehensive that NOT being in it is a competitive disadvantage.

The single most important thing to build: **the sub-registry that auto-indexes every public MCP server and gives developers a one-command way to claim, price, and monetize their listing.** That is the npm moment.
