# SettleGrid 5-Year Revenue Model
## MCP-Only to Universal AI Service Settlement
## March 26, 2026

> **Historical snapshot (2026-04-15).** This document predates the P1.MKT1
> honest-framing rewrite; protocol shorthand (bare "MPP", "10 protocols"
> framing) may appear in the body. Canonical name mapping in
> [docs/audits/15-protocol-claim.md](docs/audits/15-protocol-claim.md).

---

## METHODOLOGY & GROUND RULES

This model is built from the bottom up using:
- SettleGrid's actual pricing (progressive take: 0%/$1K, 2%/$10K, 3%/$50K, 5%/$50K+)
- Actual subscription tiers (Free $0/50K ops, Builder $19/200K ops, Scale $79/2M ops)
- Actual cost structure ($60/mo infrastructure, $252/mo total burn)
- Comparable company trajectories (RapidAPI, Stripe, Twilio, Zapier, Vercel)
- Market sizing from industry sources, not SettleGrid's own TAM claims
- Honest assessment of solo-founder capacity constraints

**Key principle: Investors will divide your TAM by 1,000 and then ask "is that still interesting?" This model uses realistic capture rates, not theoretical slices of trillion-dollar markets.**

---

## STATED ASSUMPTIONS

### Market Assumptions

1. **What % of each service market is addressable by a billing layer?**
   - Not all spending flows through intermediary marketplaces. Most LLM inference is billed directly by providers. Most CPaaS is billed directly by Twilio/Vonage.
   - A billing layer addresses the LONG TAIL: independent developers, small API providers, and emerging agent-to-agent transactions where neither party has billing infrastructure.
   - Addressable slice: 0.5-3% of each category's total market initially, growing as agent autonomy increases.

2. **SettleGrid's realistic market share within the addressable slice:**
   - Y1: 0.1-1% of the addressable slice (pre-revenue market, everyone is near zero)
   - Y2: 1-3% if one category gains traction
   - Y3: 2-5% with proven product-market fit
   - Y4-5: 3-8% with team and network effects
   - Reality check: There are 88+ competitors. Consolidation will occur, but SettleGrid will not be the only survivor.

3. **Expansion timeline affects when revenue starts in each category:**
   - Solo founder cannot pursue 8 categories simultaneously
   - Each new category requires: SDK wrapper (1-2 weeks), documentation (1 week), 5-10 reference integrations (2-4 weeks), content/positioning (ongoing)
   - Realistic: 1 new category every 4-6 months as solo founder, accelerating to 2-3/quarter with team

4. **Progressive take rate caps per-customer revenue:**
   - A developer doing $100K/mo pays: $0 + $180 + $1,200 + $2,500 = $3,880 in take (3.88% effective)
   - A developer doing $10K/mo pays: $0 + $180 = $180 in take (1.8% effective)
   - A developer doing $1K/mo pays: $0 in take
   - This means subscription revenue dominates until platform volume is very high

5. **The $1K/mo free bracket means most developers pay $0 in take rate:**
   - In a pre-revenue market, most tool developers will earn <$1K/mo for the first 18-24 months
   - Take rate revenue is essentially zero until Y2-Y3

### Operational Assumptions

- Solo founder through Month 18 (Y1 + first half of Y2)
- First hire (engineer or DevRel) at ~$5K MRR or with seed funding
- Team of 3-5 by end of Y3 (requires either revenue or funding)
- Infrastructure costs scale roughly: $60/mo (Y1) -> $200/mo (Y2) -> $800/mo (Y3) -> $3K/mo (Y4) -> $10K/mo (Y5)
- Founder salary: $0 in Y1, $60K in Y2 (if funded), $100K in Y3+
- Burn stays below $5K/mo through Y1 (bootstrapped)

### Competitive Assumptions

- Stripe will ship a more complete agent billing product by Y2, absorbing some market
- Paid.ai ($33M raised) will be the primary funded competitor
- 2-3 new well-funded entrants by Y3
- Market share erosion of ~10-15% per year from competition after Y2
- Counter-effect: market growth rate (50-100% YoY) exceeds share erosion

---

## BENCHMARK ANALYSIS

| Company | Y1 Revenue | Y2 Revenue | Y3 Revenue | Context |
|---------|-----------|-----------|-----------|---------|
| Stripe | ~$0 | ~$500K | ~$2M | VC-funded, 2-person team, payments for internet |
| Twilio | ~$100K | ~$1M | ~$10M | VC-funded, strong dev adoption |
| RapidAPI | ~$50K | ~$300K | ~$1M | API marketplace, slow early growth |
| Zapier | ~$50K | ~$200K | ~$1M | Bootstrapped, took 10+ years to $140M ARR |
| Vercel | ~$200K | ~$1M | ~$10M | VC-funded, strong community |
| Orb (usage billing) | ~$100K | ~$1M | ~$5M | VC-funded, B2B SaaS billing |

**SettleGrid's closest analogue is Zapier (bootstrapped) or RapidAPI (API marketplace).** The VC-funded trajectories (Stripe, Twilio, Vercel) are not directly comparable without funding.

**Bootstrapped solo-founder reality: $0-$5K MRR by end of Y1 is a strong outcome. $50K ARR by end of Y2 would be exceptional.**

---

## YEAR 1 (April 2026 - March 2027)

### Phase: MCP beachhead + LLM inference wrapper launch

**Service categories active:** MCP tool billing (primary), LLM inference wrappers (introduced Q3)

**User acquisition model:**
- Month 1-3: Collison installs (5-10/mo) + content marketing (5-15/mo) + cold outreach (5-20/mo) = 15-45 signups/month
- Month 4-6: Content compounds + Show HN attempt + first organic = 30-100/month
- Month 7-12: Word-of-mouth begins if product works = 50-200/month

#### By Service Category

| Category | Total Users | Paid Users | Platform Volume/mo (ending) | SG Take/mo | Sub Rev/mo | Total Rev/mo |
|----------|-------------|------------|----------------------------|------------|------------|--------------|
| MCP Tools | 300-800 | 8-25 | $2K-$15K | $0-$80 | $152-$475 | $152-$555 |
| LLM Inference | 20-80 | 1-5 | $500-$5K | $0-$10 | $19-$95 | $19-$105 |
| **Y1 Total** | **320-880** | **9-30** | **$2.5K-$20K/mo** | **$0-$90/mo** | **$171-$570/mo** | **$171-$660/mo** |

**Why take rate is near zero:** Most developers earn <$1K/mo. The $1K free bracket means SettleGrid earns $0 in take from ~95% of developers. This is by design (land grab), but it means Y1 revenue is almost entirely subscriptions.

**Why paid conversion is low (~3%):** Developer tools typically see 2-5% free-to-paid conversion. SettleGrid's free tier is generous enough that most developers genuinely do not need to upgrade. The upgrade trigger is features (sandbox, IP allowlisting, fraud detection), not volume.

#### Y1 Aggregate

| Metric | Conservative | Base | Optimistic |
|--------|-------------|------|-----------|
| Total users (ending) | 320 | 550 | 880 |
| Paid users (ending) | 9 | 18 | 30 |
| MRR (ending) | $171 | $380 | $660 |
| ARR (ending) | $2,052 | $4,560 | $7,920 |
| Total revenue (cumulative Y1) | $1,000 | $2,500 | $5,000 |
| Costs (cumulative Y1) | $4,800 | $5,400 | $6,000 |
| Net (cumulative Y1) | -$3,800 | -$2,900 | -$1,000 |
| Headcount | 1 | 1 | 1 |

**Reality check:** Cumulative Y1 revenue of $1K-$5K from a developer tool with 0 starting users is consistent with bootstrapped companies. Zapier made ~$0 in its first year. RapidAPI had minimal revenue for 2+ years. This is not failure -- this is the standard trajectory for infrastructure without VC marketing dollars.

---

## YEAR 2 (April 2027 - March 2028)

### Phase: Universal expansion begins + first enterprise pilots

**Service categories active:** MCP tools, LLM inference, browser/search APIs (introduced Q1), REST/general APIs (ongoing)

**Key inflection points assumed:**
- Agent-to-tool payment market grows from $50K/day to $200-500K/day
- One framework integration (LangChain, CrewAI, or AutoGen officially recommends SettleGrid)
- First enterprise pilot ($200-500/mo custom pricing)
- First developer exceeds $1K/mo in tool revenue (take rate revenue begins)

#### By Service Category

| Category | Total Users | Paid Users | Platform Volume/mo (ending) | SG Take/mo | Sub Rev/mo | Total Rev/mo |
|----------|-------------|------------|----------------------------|------------|------------|--------------|
| MCP Tools | 1,500-4,000 | 60-160 | $30K-$150K | $200-$2,500 | $1,140-$3,040 | $1,340-$5,540 |
| LLM Inference | 200-600 | 10-30 | $10K-$80K | $40-$1,200 | $190-$570 | $230-$1,770 |
| Browser/Search | 50-200 | 3-10 | $2K-$20K | $0-$200 | $57-$190 | $57-$390 |
| REST/General | 100-400 | 5-15 | $5K-$30K | $0-$400 | $95-$285 | $95-$685 |
| Enterprise | 2-5 | 2-5 | $10K-$50K | $500-$2,500 | $400-$1,000 | $900-$3,500 |
| **Y2 Total** | **1,850-5,200** | **80-220** | **$57K-$330K/mo** | **$740-$6,800/mo** | **$1,882-$5,085/mo** | **$2,622-$11,885/mo** |

#### Y2 Aggregate

| Metric | Conservative | Base | Optimistic |
|--------|-------------|------|-----------|
| Total users (ending) | 1,850 | 3,200 | 5,200 |
| Paid users (ending) | 80 | 140 | 220 |
| MRR (ending) | $2,622 | $6,200 | $11,885 |
| ARR (ending) | $31,464 | $74,400 | $142,620 |
| Total revenue (cumulative Y2) | $18,000 | $42,000 | $85,000 |
| Costs (cumulative Y2) | $36,000 | $96,000 | $120,000 |
| Net (cumulative Y2) | -$18,000 | -$54,000 | -$35,000 |
| Headcount | 1 | 2 | 3 |

**Cost note:** Conservative assumes solo founder throughout Y2 (costs = infrastructure + tools). Base assumes first hire at Month 18 (half-year at $60K salary + infrastructure). Optimistic assumes seed round enables 2 hires.

**Take rate vs. subscription split:** Even in the optimistic case, subscriptions are 43% of revenue. Take rate revenue is growing but still secondary because most developers earn <$10K/mo. The progressive model's $1K free bracket is generous -- it protects developers but delays SettleGrid's take-rate revenue.

---

## YEAR 3 (April 2028 - March 2029)

### Phase: Multi-category traction + potential Series A positioning

**Service categories active:** All previous + agent-to-agent settlement (introduced Q1), media generation (introduced Q3)

**Key inflection points assumed:**
- Agent-to-tool market grows to $2-5M/day globally
- Multiple developers exceed $10K/mo in platform volume
- Agent-to-agent transactions become measurable (not just demonstrations)
- SettleGrid has proven PMF in 2-3 categories
- Enterprise pipeline generates 10-20 contracts

#### By Service Category

| Category | Total Users | Paid Users | Platform Volume/mo (ending) | SG Take/mo | Sub Rev/mo | Total Rev/mo |
|----------|-------------|------------|----------------------------|------------|------------|--------------|
| MCP Tools | 5,000-12,000 | 250-600 | $200K-$1M | $3,000-$25,000 | $4,750-$11,400 | $7,750-$36,400 |
| LLM Inference | 800-2,500 | 40-125 | $80K-$500K | $1,200-$12,500 | $760-$2,375 | $1,960-$14,875 |
| Browser/Search | 300-1,000 | 15-50 | $20K-$150K | $200-$3,500 | $285-$950 | $485-$4,450 |
| Agent-to-Agent | 100-500 | 5-25 | $10K-$100K | $100-$2,500 | $95-$475 | $195-$2,975 |
| REST/General | 500-2,000 | 25-100 | $30K-$200K | $400-$5,000 | $475-$1,900 | $875-$6,900 |
| Media Generation | 50-200 | 3-10 | $5K-$50K | $0-$1,000 | $57-$190 | $57-$1,190 |
| Enterprise | 10-30 | 10-30 | $100K-$500K | $5,000-$25,000 | $2,000-$6,000 | $7,000-$31,000 |
| **Y3 Total** | **6,760-18,230** | **348-940** | **$445K-$2.5M/mo** | **$9,900-$74,500/mo** | **$8,422-$23,290/mo** | **$18,322-$97,790/mo** |

#### Y3 Aggregate

| Metric | Conservative | Base | Optimistic |
|--------|-------------|------|-----------|
| Total users (ending) | 6,760 | 11,500 | 18,230 |
| Paid users (ending) | 348 | 600 | 940 |
| MRR (ending) | $18,322 | $48,000 | $97,790 |
| ARR (ending) | $219,864 | $576,000 | $1,173,480 |
| Total revenue (cumulative Y3) | $130,000 | $350,000 | $720,000 |
| Costs (cumulative Y3) | $180,000 | $360,000 | $540,000 |
| Net (cumulative Y3) | -$50,000 | -$10,000 | $180,000 |
| Headcount | 2-3 | 4-5 | 6-8 |

**Milestone:** In the base case, Y3 is the first year SettleGrid approaches break-even. In the optimistic case, it is modestly profitable. The conservative case still requires founder subsidy or a small funding round.

**Take rate crosses subscriptions:** In the optimistic case, take rate revenue ($74.5K/mo) is 3.2x subscription revenue ($23.3K/mo) by end of Y3. This is the proof point that the marketplace model works. In the base case, take rate and subscriptions are roughly equal by end of Y3.

---

## YEAR 4 (April 2029 - March 2030)

### Phase: Scale + potential acquisition interest

**Service categories active:** All categories. Agent-to-agent becomes meaningful.

**Key assumptions:**
- Agent economy has arrived (Morgan Stanley $385B by 2030 is in motion)
- SettleGrid has 3-5 categories with proven traction
- Enterprise is 20-40% of revenue
- Competition has consolidated: 3-5 serious players remain
- Market share erosion from well-funded competitors partially offset by market growth

#### By Service Category

| Category | Total Users | Paid Users | Platform Volume/mo (ending) | SG Take/mo | Sub Rev/mo | Total Rev/mo |
|----------|-------------|------------|----------------------------|------------|------------|--------------|
| MCP Tools | 12,000-30,000 | 600-1,500 | $800K-$5M | $15,000-$125,000 | $11,400-$28,500 | $26,400-$153,500 |
| LLM Inference | 3,000-8,000 | 150-400 | $500K-$3M | $10,000-$75,000 | $2,850-$7,600 | $12,850-$82,600 |
| Browser/Search | 1,000-3,000 | 50-150 | $100K-$800K | $1,500-$20,000 | $950-$2,850 | $2,450-$22,850 |
| Agent-to-Agent | 500-3,000 | 25-150 | $100K-$1M | $1,500-$25,000 | $475-$2,850 | $1,975-$27,850 |
| REST/General | 2,000-5,000 | 100-250 | $150K-$1M | $2,500-$25,000 | $1,900-$4,750 | $4,400-$29,750 |
| Media Generation | 300-1,500 | 15-75 | $50K-$500K | $500-$12,500 | $285-$1,425 | $785-$13,925 |
| Code Execution | 200-800 | 10-40 | $30K-$300K | $300-$7,500 | $190-$760 | $490-$8,260 |
| Enterprise | 25-80 | 25-80 | $500K-$3M | $25,000-$150,000 | $5,000-$16,000 | $30,000-$166,000 |
| **Y4 Total** | **19,025-51,380** | **975-2,645** | **$2.23M-$14.6M/mo** | **$56,300-$440,000/mo** | **$23,050-$64,735/mo** | **$79,350-$504,735/mo** |

#### Y4 Aggregate

| Metric | Conservative | Base | Optimistic |
|--------|-------------|------|-----------|
| Total users (ending) | 19,025 | 32,000 | 51,380 |
| Paid users (ending) | 975 | 1,700 | 2,645 |
| MRR (ending) | $79,350 | $230,000 | $504,735 |
| ARR (ending) | $952,200 | $2,760,000 | $6,056,820 |
| Total revenue (cumulative Y4) | $600,000 | $1,700,000 | $3,800,000 |
| Costs (cumulative Y4) | $500,000 | $1,200,000 | $2,000,000 |
| Net (cumulative Y4) | $100,000 | $500,000 | $1,800,000 |
| Headcount | 4-5 | 8-12 | 12-18 |

---

## YEAR 5 (April 2030 - March 2031)

### Phase: Market leader in 2-3 categories or acquisition target

**Key assumptions:**
- Agentic commerce is mainstream (~$100B+ in AI-intermediated transactions)
- Agent-to-agent is the fastest-growing category
- SettleGrid has either raised a Series A/B or is a profitable bootstrapped company
- Enterprise is 30-50% of revenue
- Cross-category network effects are real: developers who monetize MCP tools also wrap their LLM inference and browser automation through SettleGrid

#### By Service Category

| Category | Total Users | Paid Users | Platform Volume/mo (ending) | SG Take/mo | Sub Rev/mo | Total Rev/mo |
|----------|-------------|------------|----------------------------|------------|------------|--------------|
| MCP Tools | 25,000-60,000 | 1,250-3,000 | $2M-$15M | $40,000-$375,000 | $23,750-$57,000 | $63,750-$432,000 |
| LLM Inference | 8,000-20,000 | 400-1,000 | $2M-$12M | $40,000-$300,000 | $7,600-$19,000 | $47,600-$319,000 |
| Browser/Search | 3,000-8,000 | 150-400 | $500K-$4M | $7,500-$100,000 | $2,850-$7,600 | $10,350-$107,600 |
| Agent-to-Agent | 3,000-15,000 | 150-750 | $500K-$8M | $7,500-$200,000 | $2,850-$14,250 | $10,350-$214,250 |
| REST/General | 5,000-12,000 | 250-600 | $500K-$4M | $7,500-$100,000 | $4,750-$11,400 | $12,250-$111,400 |
| Media Generation | 1,500-5,000 | 75-250 | $200K-$2M | $3,000-$50,000 | $1,425-$4,750 | $4,425-$54,750 |
| Code Execution | 800-3,000 | 40-150 | $100K-$1M | $1,500-$25,000 | $760-$2,850 | $2,260-$27,850 |
| CPaaS Wrappers | 500-2,000 | 25-100 | $50K-$500K | $500-$12,500 | $475-$1,900 | $975-$14,400 |
| Enterprise | 50-200 | 50-200 | $2M-$15M | $100,000-$750,000 | $10,000-$40,000 | $110,000-$790,000 |
| **Y5 Total** | **46,850-125,200** | **2,390-6,450** | **$7.85M-$61.5M/mo** | **$207,500-$1,912,500/mo** | **$54,460-$158,750/mo** | **$261,960-$2,071,250/mo** |

#### Y5 Aggregate

| Metric | Conservative | Base | Optimistic |
|--------|-------------|------|-----------|
| Total users (ending) | 46,850 | 75,000 | 125,200 |
| Paid users (ending) | 2,390 | 4,000 | 6,450 |
| MRR (ending) | $261,960 | $800,000 | $2,071,250 |
| ARR (ending) | $3,143,520 | $9,600,000 | $24,855,000 |
| Total revenue (cumulative Y5) | $2,200,000 | $6,500,000 | $16,000,000 |
| Costs (cumulative Y5) | $1,500,000 | $4,000,000 | $8,000,000 |
| Net (cumulative Y5) | $700,000 | $2,500,000 | $8,000,000 |
| Headcount | 6-8 | 15-20 | 25-35 |

---

## 5-YEAR SUMMARY TABLE

### Conservative Scenario

| Metric | Y1 | Y2 | Y3 | Y4 | Y5 |
|--------|-----|-----|-----|-----|-----|
| Total users | 320 | 1,850 | 6,760 | 19,025 | 46,850 |
| Paid users | 9 | 80 | 348 | 975 | 2,390 |
| MRR (ending) | $171 | $2,622 | $18,322 | $79,350 | $261,960 |
| ARR (ending) | $2,052 | $31,464 | $219,864 | $952,200 | $3,143,520 |
| Revenue (year) | $1,000 | $18,000 | $130,000 | $600,000 | $2,200,000 |
| Costs (year) | $4,800 | $36,000 | $180,000 | $500,000 | $1,500,000 |
| Net (year) | -$3,800 | -$18,000 | -$50,000 | $100,000 | $700,000 |
| Headcount | 1 | 1 | 2-3 | 4-5 | 6-8 |

### Base Scenario

| Metric | Y1 | Y2 | Y3 | Y4 | Y5 |
|--------|-----|-----|-----|-----|-----|
| Total users | 550 | 3,200 | 11,500 | 32,000 | 75,000 |
| Paid users | 18 | 140 | 600 | 1,700 | 4,000 |
| MRR (ending) | $380 | $6,200 | $48,000 | $230,000 | $800,000 |
| ARR (ending) | $4,560 | $74,400 | $576,000 | $2,760,000 | $9,600,000 |
| Revenue (year) | $2,500 | $42,000 | $350,000 | $1,700,000 | $6,500,000 |
| Costs (year) | $5,400 | $96,000 | $360,000 | $1,200,000 | $4,000,000 |
| Net (year) | -$2,900 | -$54,000 | -$10,000 | $500,000 | $2,500,000 |
| Headcount | 1 | 2 | 4-5 | 8-12 | 15-20 |

### Optimistic Scenario

| Metric | Y1 | Y2 | Y3 | Y4 | Y5 |
|--------|-----|-----|-----|-----|-----|
| Total users | 880 | 5,200 | 18,230 | 51,380 | 125,200 |
| Paid users | 30 | 220 | 940 | 2,645 | 6,450 |
| MRR (ending) | $660 | $11,885 | $97,790 | $504,735 | $2,071,250 |
| ARR (ending) | $7,920 | $142,620 | $1,173,480 | $6,056,820 | $24,855,000 |
| Revenue (year) | $5,000 | $85,000 | $720,000 | $3,800,000 | $16,000,000 |
| Costs (year) | $6,000 | $120,000 | $540,000 | $2,000,000 | $8,000,000 |
| Net (year) | -$1,000 | -$35,000 | $180,000 | $1,800,000 | $8,000,000 |
| Headcount | 1 | 3 | 6-8 | 12-18 | 25-35 |

---

## ANSWERING THE SPECIFIC QUESTIONS

### 1. Does the universal expansion meaningfully change the revenue trajectory vs. MCP-only?

**Yes, but not until Y3.** Here is the comparison:

| Scenario | MCP-Only Y5 ARR | Universal Y5 ARR | Delta |
|----------|----------------|-----------------|-------|
| Conservative | $1.8M | $3.1M | +72% |
| Base | $4.5M | $9.6M | +113% |
| Optimistic | $8M | $24.9M | +211% |

**Why it matters more in the optimistic case:** Cross-category network effects only compound when multiple categories have real traction. In the conservative case, SettleGrid never achieves meaningful traction outside MCP, so the expansion adds incremental revenue from a handful of non-MCP developers using the same SDK. In the optimistic case, the "universal" positioning creates genuine cross-sell: an MCP developer also wraps their LLM inference and search calls, tripling their platform volume and SettleGrid's take.

**The honest answer:** The universal expansion is a 1.7-3x multiplier on MCP-only, not a 10x. The biggest impact is on the STORY (fundraising positioning, enterprise sales pitch), not on Y1-Y2 revenue. It becomes a real revenue driver in Y3+ only if SettleGrid achieves category traction outside MCP.

### 2. At what point does non-MCP revenue exceed MCP revenue?

| Scenario | Crossover Point |
|----------|----------------|
| Conservative | Y5 (barely -- MCP is still 40% of revenue) |
| Base | Mid-Y4 (MCP is 30% by Y5, LLM inference + enterprise drive the rest) |
| Optimistic | Early Y4 (MCP drops to 21% by Y5; LLM inference, agent-to-agent, and enterprise each exceed it) |

**Key dynamic:** MCP tool billing is the beachhead but NOT the long-term cash cow. LLM inference wrapping and enterprise agent budget management have higher per-customer revenue because the underlying transaction volumes are larger. A single enterprise customer running agent fleets generates more platform volume than 100 indie MCP tool developers.

### 3. What is the realistic Year 5 ARR under each scenario?

| Scenario | Y5 ARR | Comparable Company |
|----------|--------|-------------------|
| Conservative | $3.1M | Similar to RapidAPI at Year 5 (~$3M ARR) |
| Base | $9.6M | Between RapidAPI and Zapier trajectories |
| Optimistic | $24.9M | Approaching Vercel's early trajectory, but Vercel was VC-funded |

**Sanity check against benchmarks:**
- RapidAPI: $300K (Y1) to $45M (Y8) = ~$3M at Y5
- Zapier (bootstrapped): ~$5M ARR at Y5, reached $140M at Y10+
- Twilio: $10M at Y3, but VC-funded with 50+ employees
- Stripe: ~$10M at Y3, but VC-funded with transformative product

**The conservative case ($3.1M ARR) is a realistic outcome for a solo-founder-started company with limited funding.** The base case ($9.6M) requires either seed funding or exceptional organic growth. The optimistic case ($24.9M) requires significant funding, a team of 25+, and multiple market catalysts aligning.

### 4. Does the expansion change the fundraising math?

**Yes, meaningfully.** Here is what each scenario looks like to investors:

**MCP-only pitch:** "We bill MCP tool calls. TAM is $50M today, maybe $500M by 2030."
- Investor response: "Too small. Pass."

**Universal settlement pitch:** "We are the billing layer for ALL AI-invoked services. TAM is $175B today, $6T by 2030. We start with MCP, expand to inference, search, agent-to-agent."
- Investor response: "Interesting market. Show me traction in 2+ categories."

**Seed round metrics that would justify funding (any scenario):**
- $10K+ MRR (demonstrates willingness to pay)
- 500+ total users (demonstrates developer interest)
- 2+ service categories with active users (proves "universal" is not just a claim)
- 5+ enterprise pilots (shows upmarket potential)
- 50%+ MoM growth for 3+ months (shows momentum)

**Timeline to fundable metrics:**
- Conservative: Month 18-24 (early Y2)
- Base: Month 12-15 (late Y1 to early Y2)
- Optimistic: Month 8-10 (late Y1)

**The expansion does not change Y1 traction, but it makes the Y1 traction MORE FUNDABLE.** An investor seeing $5K MRR from MCP-only thinks "niche." An investor seeing $5K MRR split across MCP + LLM inference thinks "platform."

### 5. What is the revenue composition by category at Year 5?

#### Base Scenario Y5 Revenue Composition

| Category | % of Revenue | $ Annual |
|----------|-------------|----------|
| MCP Tools | 24% | $2,300,000 |
| LLM Inference | 19% | $1,800,000 |
| Enterprise (cross-category) | 25% | $2,400,000 |
| Agent-to-Agent | 10% | $960,000 |
| REST/General APIs | 8% | $770,000 |
| Browser/Search | 6% | $580,000 |
| Media Generation | 4% | $380,000 |
| Code Execution | 2% | $190,000 |
| CPaaS Wrappers | 2% | $120,000 |

**Key insight:** Enterprise is the largest single revenue category by Y5 in all scenarios. This is because enterprise contracts have higher ARPU ($200-$2,000/mo vs. $19-$79/mo for self-serve) and higher platform volume (agent fleets generate 10-100x the volume of individual developers). The universal expansion is MOST valuable for enterprise sales because CIOs want one billing layer across all their AI services, not separate solutions per category.

### 6. When does SettleGrid need to hire its first employee?

| Scenario | First Hire | Trigger |
|----------|-----------|---------|
| Conservative | Month 24-30 | Revenue covers salary OR small angel round |
| Base | Month 15-18 | $5K MRR + seed round OR $10K MRR bootstrapped |
| Optimistic | Month 10-12 | Seed round closed based on growth trajectory |

**What to hire first:**
- **If bootstrapped:** Developer advocate / content marketer (full-stack person who writes code AND blog posts). This is the highest-leverage hire because the #1 gap is distribution, not product.
- **If funded:** Second engineer to maintain the platform while the founder does sales and content. Then a DevRel hire.

**Solo founder capacity ceiling:** A solo founder can maintain the product, handle support for up to ~200-300 users, write 2-4 articles/month, and do 10-20 outreach emails/day. Beyond ~500 active users, support burden alone consumes 10+ hours/week. Beyond 1,000 users, the founder must choose between product development and growth activities.

### 7. At what revenue level does the progressive take rate generate more than subscriptions?

**Mathematical crossover analysis:**

The average paid subscriber pays ~$35/mo (weighted blend of $19 Builder and $79 Scale, skewing 70/30 toward Builder).

For take rate to match subscription revenue per user, a developer must generate enough platform volume:
- At 2% marginal rate (revenue between $1K-$10K/mo): developer must do $1,750/mo in revenue for take rate ($15) to equal a Builder subscription ($19). Not quite.
- At 3% marginal rate ($10K-$50K/mo): a developer doing $10K/mo pays $180/mo in take -- far exceeding their $79 Scale subscription.

**Crossover at the portfolio level:**
- When 20%+ of developers earn >$1K/mo in tool revenue, take rate begins to exceed subscriptions
- When 5-10% of developers earn >$10K/mo, take rate is 2-3x subscriptions
- When top 1% of developers earn >$50K/mo, those accounts alone drive more take rate than ALL subscriptions combined

**Timeline:**
| Scenario | Take Rate > Subscriptions |
|----------|--------------------------|
| Conservative | Mid-Y4 |
| Base | End-Y3 |
| Optimistic | Mid-Y3 |

**This is the key strategic insight: subscriptions sustain the business during the land-grab phase (Y1-Y2). Take rate revenue is the long-term cash cow (Y3+). The progressive model is designed to delay take-rate revenue in exchange for faster user acquisition. This is the correct tradeoff IF the market grows as projected.**

### 8. What are the unit economics per category?

#### Customer Acquisition Cost (CAC)

| Channel | Cost per Signup | Conversion to Paid | CAC (Paid) |
|---------|----------------|-------------------|------------|
| Content/SEO (organic) | $0 | 3-5% | $0 |
| Cold email (Instantly) | $0.50-$2.00 | 1-3% | $17-$200 |
| Collison Install (manual) | $0 (time only) | 30-50% | $0 |
| Paid ads (future) | $15-$50 per signup | 3-5% | $300-$1,667 |
| Framework partnership | $0 | 5-10% | $0 |

**Blended CAC by year:**
- Y1: $5-$15 (mostly organic + cold email)
- Y2: $15-$40 (cold email at scale + some paid)
- Y3: $30-$60 (paid channels enter)
- Y4-5: $50-$100 (paid + sales team for enterprise)

#### Lifetime Value (LTV) by Category

| Category | Avg Monthly Revenue per Paid User | Avg Lifespan (months) | LTV | LTV:CAC (Y2) |
|----------|----------------------------------|----------------------|-----|--------------|
| MCP Tools (indie) | $25 (sub) + $5 (take) = $30 | 18 | $540 | 13-36x |
| LLM Inference | $25 (sub) + $15 (take) = $40 | 24 | $960 | 24-64x |
| Browser/Search | $25 (sub) + $10 (take) = $35 | 18 | $630 | 16-42x |
| Agent-to-Agent | $35 (sub) + $20 (take) = $55 | 24 | $1,320 | 33-88x |
| Enterprise | $300 (sub) + $500 (take) = $800 | 36 | $28,800 | 288-720x |

**Payback period:** At blended Y2 CAC of $25 and average ARPU of $35/mo, payback is <1 month for organic/outreach customers. Paid acquisition payback is 3-12 months depending on channel.

**Key insight: Unit economics are excellent because the product has near-zero marginal cost.** Infrastructure cost per user is $0.006-$2.00/mo. Every paid subscriber is profitable from Month 1. The challenge is not unit economics -- it is scale. Getting from 0 to 100 paid subscribers is harder than maintaining 10,000.

---

## REVENUE STREAM ANALYSIS: TAKE RATE vs. SUBSCRIPTIONS

### How the Progressive Take Rate Behaves at Scale

| Developer Monthly Revenue | Take Amount | Effective Rate | SG Revenue per Developer |
|--------------------------|-------------|---------------|--------------------------|
| $500 | $0 | 0% | $0 (sub only) |
| $1,000 | $0 | 0% | $0 (sub only) |
| $2,000 | $20 | 1.0% | $20 + sub |
| $5,000 | $80 | 1.6% | $80 + sub |
| $10,000 | $180 | 1.8% | $180 + sub |
| $25,000 | $630 | 2.52% | $630 + sub |
| $50,000 | $1,380 | 2.76% | $1,380 + sub |
| $100,000 | $3,880 | 3.88% | $3,880 + sub |
| $500,000 | $23,880 | 4.78% | $23,880 + sub |

**Is the progressive take rate sustainable at scale?**

Yes, but with a caveat. At scale, the take rate generates massive revenue from high-volume developers. A single developer doing $500K/mo generates $23,880/mo for SettleGrid -- more than 300 Builder subscribers. The progressive model correctly aligns incentives: small developers are not taxed, and SettleGrid earns proportionally from success.

**The risk:** High-volume developers ($50K+/mo) may negotiate lower rates or build their own billing. At $100K/mo, a developer is paying $3,880/mo to SettleGrid -- motivation to self-build is real. Mitigation: switching costs (analytics, fraud detection, discovery presence, consumer base) must exceed the take rate cost.

**Comparison to competitors:**
- MCPize: 15% flat = $75,000 on $500K/mo (SettleGrid is 3.1x cheaper)
- Apify: ~30-40% effective = $150-200K on $500K/mo (SettleGrid is 6-8x cheaper)
- xpay: 1.5-2.5% = $7,500-$12,500 on $500K/mo (xpay is 1.9-2.0x cheaper than SettleGrid at this volume)

**At high volume, xpay's flat rate beats SettleGrid's progressive rate.** This is a potential problem for retaining whale developers. The counter-argument: SettleGrid's subscription features (fraud detection, discovery, analytics) provide value that xpay's proxy model does not. The real defense is switching costs, not pricing.

---

## DOES UNIVERSAL EXPANSION CHANGE THE FUNDRAISING MATH?

### Pre-Expansion (MCP-Only) Fundraising Narrative

"We monetize MCP tool calls. The MCP ecosystem has 11,000 servers, <5% monetized. We have 10 payment protocols and 1,017 templates. TAM is $50M growing to $500M."

**Investor assessment:**
- TAM: Too small for venture returns
- Timing: Market is pre-revenue
- Defensibility: Stripe can trivially enter (and just did with MPP)
- Verdict: Interesting but not fundable at seed without exceptional traction

### Post-Expansion (Universal) Fundraising Narrative

"We are the settlement layer for ALL AI-invoked services. Our SDK wraps any async function with metering, billing, and fraud detection. We start with MCP tools (beachhead with 1,017 templates), then expand to LLM inference metering (cross-provider cost control), browser automation billing, and agent-to-agent settlement. TAM is $175B today, $6T by 2030. We already support all 10 agent payment protocols."

**Investor assessment:**
- TAM: Compelling ($175B+)
- Timing: Early to the biggest wave in software
- Defensibility: Multi-protocol + multi-category creates compounding moat
- Execution risk: Can a solo founder capture this?
- Verdict: Fundable IF showing traction in 2+ categories

**The expansion changes the narrative from "niche MCP tool" to "infrastructure layer for the AI economy." This is the difference between a $2-5M seed and a pass.**

### Seed Round Parameters (if pursuing)

| Metric | Target for $2-3M Seed |
|--------|----------------------|
| MRR | $10K-$25K |
| Users | 1,000+ |
| Categories with traction | 2+ |
| MoM growth | 30-50% for 3+ months |
| Enterprise pipeline | 5-10 named prospects |
| Revenue trajectory | Credible path to $1M ARR in 12 months |

**Timeline to these metrics:**
- Base case: Month 12-18
- Optimistic: Month 8-12

---

## HONEST REALITY CHECKS

### 1. Solo Founder Cannot Capture 8 Categories Simultaneously

**True.** The model assumes sequential expansion, not parallel:
- Y1: MCP + LLM inference (2 categories)
- Y2: Add browser/search + REST (4 total)
- Y3: Add agent-to-agent + media (6 total)
- Y4: Add code execution + CPaaS (8 total)

Even this is aggressive for a solo founder. Realistically, Y1 is 90% MCP and 10% LLM inference. The "universal" positioning is a story told to the market; the execution is focused.

### 2. "Universal" Is a Claim, Not a Moat

**True.** The `sg.wrap()` SDK works on any async function, but so does wrapping any function with Stripe's metering API or Orb's usage-based billing. The technical capability is not unique.

What would make it a moat:
- **Discovery network effect:** If agents discover tools through SettleGrid across categories, the marketplace becomes the moat (like Shopify's app store vs. individual Stripe integrations)
- **Cross-category data:** Fraud signals from MCP tool calls improve fraud detection for LLM inference wrappers. This is a real data moat, but only materializes at 10K+ users.
- **Developer lock-in:** If a developer wraps 5 different service types through SettleGrid, switching to 5 separate billing providers is painful.

Until these materialize (Y3+), "universal" is positioning, not defensibility.

### 3. Horizontal Billing Platforms Have Massive Advantages in Non-MCP Categories

**True and this is the biggest risk.** For LLM inference billing specifically:
- Stripe + Orb already serve inference companies (Together AI, Fireworks use Stripe/Orb)
- These platforms have enterprise sales teams, SOC2, HIPAA, 99.99% uptime SLAs
- A developer choosing between "SettleGrid (solo founder, 0 users)" and "Stripe/Orb (Fortune 500 customers)" will choose the latter for anything mission-critical

**SettleGrid's counter-argument:** Stripe/Orb bill the PROVIDER (Together AI bills its customers through Stripe). SettleGrid bills the DEVELOPER (an indie developer wrapping Together AI's API to resell it as an MCP tool). Different buyer, different use case. But this is a narrower market than "universal billing."

### 4. Progressive Take Rate Caps Revenue per Customer

**Partially true.** The 5% cap means SettleGrid captures less from whale customers than competitors with higher rates. But:
- The cap ATTRACTS whales (they choose SettleGrid over 15% MCPize)
- Subscription revenue is additive (whale pays $79/mo Scale + $3,880/mo take = $3,959/mo)
- The real question is whether the cap discourages self-build. At $3,880/mo ($46,560/yr), the answer is: not yet. Self-building metering, fraud detection, discovery, and multi-protocol support costs $200K+ in engineering time.

**Break-even for self-build: ~$8K/mo in take ($96K/yr).** Above this, a well-funded developer might consider building their own billing. Below this, SettleGrid is clearly the rational choice.

### 5. The $1K Free Bracket Delays Revenue Significantly

**True and intentional.** In a pre-revenue market where most developers earn $0-$500/mo, a 2% take rate on $500 = $10/mo. This is not worth the friction it creates. The $1K free bracket is a bet that developer goodwill and adoption speed are worth more than $10/mo/developer in Y1-Y2. The bet pays off IF the market grows as projected and those developers' volumes increase to $10K+/mo by Y3-Y4.

**If the market does NOT grow:** The $1K free bracket means SettleGrid earns almost nothing from take rates, and the business is a pure SaaS company competing on $19-$79/mo subscriptions. This is still viable (many developer tools are subscription-only) but the TAM ceiling is much lower (~$10M ARR vs. ~$100M ARR with take rate revenue).

---

## RISK-ADJUSTED EXPECTED VALUE

Weighting the three scenarios at 30% conservative, 50% base, 20% optimistic:

| Metric | Expected Value |
|--------|---------------|
| Y1 Revenue | $2,400 |
| Y2 Revenue | $41,400 |
| Y3 Revenue | $333,000 |
| Y4 Revenue | $1,590,000 |
| Y5 Revenue | $6,060,000 |
| Y5 ARR | $9,453,000 |
| Y5 Cumulative Revenue | $7,927,000 |
| Y5 Cumulative Net | $2,210,000 |

**This expected value of ~$9.5M ARR at Y5 is comparable to:**
- RapidAPI at Year 6-7
- Zapier at Year 5-6 (bootstrapped)
- A decent SaaS company but not a venture-scale outcome without the optimistic scenario materializing

---

## STRATEGIC RECOMMENDATIONS BASED ON THE MODEL

1. **Do not chase all categories in Y1.** MCP + LLM inference wrappers only. Build reference integrations, not just SDK support. The universal story is for marketing and fundraising, not for Y1 execution.

2. **Enterprise is the unlock.** A single enterprise contract at $500/mo equals 26 Builder subscribers. Prioritize 5-10 enterprise pilots by Month 12. Enterprise also validates the "universal" claim because CIOs want one billing layer.

3. **The $1K free bracket is correct for Y1-Y2.** Do not lower it. The land-grab is more valuable than $10/mo per developer. Revisit in Y3 when the market has real volume.

4. **Pursue seed funding at Month 12-15 if base-case metrics are tracking.** The universal positioning makes the fundraise viable. MCP-only does not. Target $2-3M at $10-15M post-money. Use funds for: first 2 hires (engineer + DevRel), paid acquisition testing, enterprise sales support.

5. **Track the ratio of take-rate to subscription revenue monthly.** When this ratio exceeds 1.0, the marketplace model is working. Until then, SettleGrid is a SaaS business and should be operated as one.

6. **Build the cross-category data moat early.** Even in Y1, track how many developers use SettleGrid for 2+ service types. This is the leading indicator of whether "universal" will become a real competitive advantage.

7. **xpay is the pricing threat at high volume.** If a developer compares SettleGrid's 5% top bracket to xpay's 1.5% volume rate, SettleGrid loses. The defense is feature superiority (fraud detection, multi-protocol, discovery), not price. Do not enter a race to the bottom on take rates.

---

## APPENDIX: PROGRESSIVE TAKE RATE REVENUE SENSITIVITY

What happens if the market stays smaller than projected?

### Scenario: MCP market reaches only $5M/day by Y5 (vs. Morgan Stanley's $385B agentic commerce)

| Metric | Impact |
|--------|--------|
| Total platform volume | $150M/year (vs. $750M base case) |
| SettleGrid share (3%) | $4.5M/year |
| Take rate revenue | $90K-$180K/year (effective 2-4% blended) |
| Subscription revenue | $400K-$600K/year (from features, not volume) |
| Total Y5 revenue | $500K-$800K/year |
| Y5 ARR | $600K-$960K |

**In this downside scenario, SettleGrid is a $600K-$1M ARR SaaS company.** This is a viable lifestyle business but not a venture-scale outcome. The universal expansion is valuable here because it diversifies away from MCP-only risk.

### Scenario: Agent economy inflects faster (Galaxy Research $3-5T by 2030)

| Metric | Impact |
|--------|--------|
| Total platform volume | $5B+/year (of which SettleGrid captures 0.1%) |
| SettleGrid share | $5M/year in platform volume |
| Take rate revenue | $100K-$200K/mo |
| Y5 ARR | $30M-$50M |

**In this upside scenario, SettleGrid is in Vercel/Twilio territory.** This requires the agent economy to truly arrive AND SettleGrid to capture meaningful share. Probability: 5-10%.

---

*Model prepared March 26, 2026. All projections are estimates based on stated assumptions. Actual results will vary based on market development, competitive dynamics, and execution quality.*
