# SettleGrid Quantum Leap Master Plan (MP-QL-001)

**Document ID:** `MP-QL-001`
**Owner:** Luther (solo founder)
**Status:** Approved — execution-ready
**Created:** 2026-04-08
**Horizon:** 90 days

---

## What This Document Is

This is the canonical execution plan for SettleGrid.ai's 90-day Quantum Leap strategic initiative: a coordinated bet that converts founder time into permanent distribution surface area via 8 coordinated plays executed in 5 phases, with mandatory 3-part audit chains gating every prompt.

**The plan governs:**
- 54 pristine execution prompts (each self-contained, executable in a fresh Claude session)
- A mandatory 3-part audit chain at the end of every prompt
- Cross-phase hard gates that cannot be crossed without exit-criteria PASS
- A shared context appendix so no prompt has to re-establish project state

**The plan does NOT govern:**
- What SettleGrid does after day 90 (Phase 5 produces the next-90-day plan)
- How to respond to unexpected opportunities mid-phase (those need founder judgment)
- The specific content of marketing copy (content prompts produce drafts; founder rewrites)

---

## Structure

| File | Contents |
|---|---|
| [`README.md`](./README.md) | This file — overview, dependency graph, kill criteria, resource requirements |
| [`audit-chain-template.md`](./audit-chain-template.md) | The canonical 3-part audit chain every prompt embeds |
| [`shared-context.md`](./shared-context.md) | Repo structure, SDK API, agent pattern, env vars, common pitfalls |
| [`prompt-card-format.md`](./prompt-card-format.md) | The canonical execution prompt card format |
| [`phase-1-foundation.md`](./phase-1-foundation.md) | Weeks 1-2: **12 prompts** — Templater scaffold, quality gates, Skill, SEP, canonical audit |
| [`phase-2-distribution.md`](./phase-2-distribution.md) | Weeks 3-4: **14 prompts** — CLI, shadow directory, gallery, 20 polished templates, quality CI |
| [`phase-3-scale-convener.md`](./phase-3-scale-convener.md) | Weeks 5-6: **12 prompts** — Templater scale run, WG outreach, directory submissions, Academy |
| [`phase-4-5-launch-measure.md`](./phase-4-5-launch-measure.md) | Weeks 7-12: **16 prompts** — Show HN launch, instrumentation, funnel analysis, kill decision |

**Total: 54 execution prompts across 5 phases (12 + 14 + 12 + 16).**

---

## The 90-Day Bet

SettleGrid is at 3 users and near-zero traction. The 90-day Quantum Leap is a deliberate, compounding bet that ships 8 coordinated surfaces in sequence:

1. **Templater agent** — 4th agent in the existing team (Beacon, Protocol, Indexer). Uses Claude Opus 4.6 to generate 75-150 templates across every major AI tool category. Built in Phase 1, scales in Phase 3. Budget cap: $300 hard.
2. **Anthropic Skill + Cursor rule** — Cross-compatible with Cursor, Codex CLI, Gemini CLI, Antigravity via the unified Skills spec. Top Anthropic Skill has 277K installs. Built in Phase 1.
3. **`npx settlegrid add` CLI** — Detects repo type, adds SettleGrid wrapping, opens a PR. Zero cold-start friction for existing MCP servers. Built in Phase 2.
4. **Shadow directory** — Auto-scraped landing page per MCP server on the web. 1000+ long-tail SEO pages at launch. Built in Phase 2.
5. **MCP SEP for `experimental/payment`** — Protocol-level contribution to the MCP spec. Precedent: SEP-1865 (MCP Apps) was merged from a solo contributor. Drafted in Phase 1, submitted in Phase 3.
6. **Template gallery** — Unified `settlegrid.ai/templates`, MIT-licensed, standalone-value-first design. 20 hand-polished + 75-150 Templater-generated. Built in Phase 2, scaled in Phase 3.
7. **MCP Billing Interop Working Group** — Convener play via cold outreach to Stripe, Coinbase, Cloudflare, Anthropic, Smithery, PulseMCP, Zuplo, Neon. Executed in Phase 3.
8. **Show HN launch** — Coordinated across all 5 surfaces in Weeks 7-8. Week 7-8 of Phase 4.

**The moat is the coordinated play, not any single surface.** Each reinforces the others: the CLI drives installs, the directory drives SEO, the Skill drives AI-IDE distribution, the SEP drives protocol-level positioning, the gallery is the legible proof that all four work together.

---

## Phase Sequence & Hard Gates

```
Phase 1 (Weeks 1-2) — Foundation
    ↓ [HARD GATE: Templater compiles + 57 tests + Skill valid + SEP drafted + CANONICAL_50 committed]
Phase 2 (Weeks 3-4) — Distribution Surfaces
    ↓ [HARD GATE: CLI installable + shadow dir 1000+ pages + gallery v1 live + 20 polished + CI green]
Phase 3 (Weeks 5-6) — Scale + Convener
    ↓ [HARD GATE: 75+ Templater templates + 2+ WG replies + 5 Academy lessons + 5+ directory submissions]
Phase 4 (Weeks 7-8) — Launch
    ↓ [HARD GATE: Show HN posted + 4 of 5 surfaces live + 48h funnel data]
Phase 5 (Weeks 9-12) — Measure + Iterate
    ↓ [EXIT: Kill criteria evaluated + pivot or double-down decision + next 90-day plan drafted]
```

**Hard gates are not optional.** Phase agents cannot cross a gate with failing exit criteria. Each gate ends with an audit-gate prompt (P1.12, P2.14, P3.12, P4.10, P5.6) that explicitly verifies every exit criterion before allowing progression.

---

## Dependency Graph (Critical Path)

```
P1.1 Templater scaffold ──┬─> P1.2 Templater tools ──> P1.3 Templater tests
                          └─> P3.1 Templater scale run (needs P1.4 gates)

P1.4 Quality gates ───────┬─> P1.6 CANONICAL_50 audit
                          └─> P2.13 Template CI workflow

P1.5 Orchestrator reg ────> P3.2 Templater scale execution

P1.7 Skill scaffold ──> P1.8 Skill content ──> P1.9 Cursor rule ──> P4.2 Launch

P1.10 SEP draft ──────> P3.6 SEP community feedback ──> ongoing conversation

P1.6 CANONICAL_50 ────> P2.8 20 polished templates ──> P3.2 Templater scale output

P2.1 CLI scaffold ──> P2.2 detection ──> P2.3 transform ──> P2.4 PR ──> P2.5 smoke tests
                                                                    └─> P4.1 Launch asset

P2.6 Metadata schema ──> P2.7 Registry build ──> P2.9 Gallery SSG ──> P2.10 Search

P2.11 Shadow schema ──> P2.12 Shadow SSG ──> P3.7 Directory submissions

P2.13 Template CI ────> P3.11 Renovate + codemods pipeline

P3.* Templater scale ──> P4.1 Instrumentation (funnel events on generated templates)

P4.1 PostHog ──> P4.2-P4.6 Launch assets ──> P4.7 War room ──> P5.1 Funnel analysis
                                                               └─> P5.2 Kill criteria ──> P5.5 Next plan
```

Prompts within a phase are mostly sequential. Parallelizable prompts are explicitly called out in each phase document.

---

## Resource Requirements

### Founder hours

| Phase | Weeks | Hours | Notes |
|---|---|---|---|
| Phase 1 | 1-2 | 80 | Scaffold-heavy |
| Phase 2 | 3-4 | 90 | CLI + shadow directory both sizable |
| Phase 3 | 5-6 | 80 | Outreach + ops-heavy, less code |
| Phase 4 | 7-8 | 90 | Launch sprint + response management |
| Phase 5 | 9-12 | 60 | Analysis + decision-making |
| **Total** | | **~400** | ~4.4 hrs/day average over 90 days |

### API + infrastructure costs

| Category | 90-day Total |
|---|---|
| Claude Opus (Phase 3 Templater scale = bulk) | ~$420 |
| Claude Sonnet (spec generation, content) | ~$120 |
| Firecrawl + Exa (research) | ~$160 |
| Other APIs | ~$50 |
| Vercel, Supabase, Redis, Meilisearch, domain | ~$150 |
| **Total** | **~$900** |

### Critical budget cap

**Phase 3 Templater scale run: $300 hard cap.** Abort-on-cap, NOT retry-on-cap. If the Templater hits $300 before producing 75 templates, the run STOPS. Tune the prompts and re-run. Do not raise the cap without explicit founder review.

---

## Global Kill Criteria (Day 60 Evaluation)

Evaluate ALL of the following at day 60. **If 3 or more are red**, pause all phases and write a pivot memo before continuing.

- [ ] Gallery has ≥50 published templates
- [ ] CLI has ≥100 installs (npm stats + telemetry)
- [ ] Gallery has ≥10 distinct users who completed first-install flow
- [ ] At least 1 external contributor PR merged
- [ ] PostHog funnel shows ≥1% gallery → CLI install conversion
- [ ] Founder burnout self-assessment ≥6/10

## Global Success Criteria (Day 90)

- [ ] ≥100 CLI installs
- [ ] ≥25 activated users (installed CLI + wrapped at least one tool)
- [ ] ≥3 paying consumers (first dollar from external user)
- [ ] Gallery live with ≥75 templates
- [ ] Show HN result documented (pass or fail is OK, no data is not)
- [ ] ≥2 MCP Billing Interop WG conversations live
- [ ] Founder still has runway and sanity

**Any hit on these → double down. Full miss → pivot memo.**

---

## Top 10 Risks

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| 1 | Templater produces low-quality templates at scale | High | High | Quality gate CI in Phase 2 before scale. Reject rate must be < 30%. |
| 2 | SDK breaking change cascades across templates | Medium | High | Pin SDK per batch. Codemods + Renovate from Phase 1. |
| 3 | MCP SEP rejected or ignored | Medium | Medium | Ship capability in SDK regardless. SEP is bonus, not critical path. |
| 4 | Show HN bombs (<20 upvotes) | Medium | Medium | HN is one of 5 surfaces, not THE launch. Other 4 continue. |
| 5 | Directory submissions rejected | Low | Low | Appeal once, then move on. Not critical path. |
| 6 | WG cold outreach = zero replies | Medium | Medium | Deprioritize if <2 replies by end of Phase 3. Reframe as blog post. |
| 7 | Founder burnout from 4.4 hrs/day pace | High | Critical | 1 rest day/week mandatory. Audit chain prevents re-work spirals. |
| 8 | Anthropic Skills spec changes mid-build | Low | Medium | Pin target spec version. Treat breaking change as new prompt. |
| 9 | Shadow directory flagged as spam | Medium | High | Respect robots.txt. User-Agent identifies crawler. DMCA policy. |
| 10 | 90-day plan is the wrong plan | Medium | Critical | Phase 5 kill criteria evaluation at day 60. Monthly thesis review. |

---

## How to Execute

1. **Read this README end-to-end.** Understand the 90-day arc before touching any prompt.
2. **Read [`shared-context.md`](./shared-context.md) and [`audit-chain-template.md`](./audit-chain-template.md).** These are referenced by every prompt.
3. **Start with Phase 1, prompt P1.1.** Execute sequentially unless the phase document explicitly marks a prompt as parallelizable.
4. **After every prompt, run the full 3-part audit chain.** No exceptions. Do not commit until all three output `Verdict: PASS`.
5. **Log audit failures to `docs/audit-failures/P<id>-<timestamp>.md`.** This is the only source of truth for what went wrong and how it was recovered.
6. **At every hard gate, run the phase audit-gate prompt.** It explicitly verifies exit criteria. Do not proceed if it fails.
7. **At Day 60, stop and evaluate kill criteria.** Pivot memo if 3+ red.
8. **At Day 90, run the retrospective.** Produce the next 90-day plan based on data, not intuition.

---

## When to Ask for Help

- Audit chain fails twice on the same prompt → the prompt is wrong, not the implementation. Edit the prompt card and note the edit in the commit.
- Two consecutive prompts fail in the same phase → phase hold. Escalate. Re-evaluate scope before continuing.
- Breaking SDK change invalidates >10% of templates → STOP. Roll back the SDK. Do not try to fix templates.
- Founder burnout self-assessment drops below 6/10 → pause and rest. The plan tolerates delay; it does not tolerate collapse.

---

## Document Maintenance

This master plan is the single source of truth. If a phase document ever contradicts this README, the phase document is wrong. If the canonical audit chain ever contradicts a prompt's embedded audit, the canonical chain wins.

**Update protocol:** changes to the master plan require a commit with `master-plan: <change>` subject and must reference which phase(s) are affected. If a phase's exit criteria change, the phase audit-gate prompt must be updated to match.

**End of README.**
