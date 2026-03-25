# SettleGrid Quality Monitoring System: Comprehensive Recommendation

Research synthesis from 10 developer platforms — Stripe, Vercel, Shopify, Google Play, Apple, Twilio, AWS, GitHub, Datadog, and Zapier — distilled into an actionable plan for SettleGrid.

---

## Part 1: Cross-Platform Research Findings

### 1. Stripe — Integration Health via Workbench

**What they monitor:**
- API success rate (tracks 400, 409, 429 error codes)
- Payment authorization rate declines (ML-based anomaly detection)
- Webhook delivery latency and failure rate
- Transaction volume anomalies (ML accounts for weekly/seasonal patterns)
- Integration completeness (setup checklist)

**How they score/grade:**
- No explicit letter grade. The Workbench "Health" tab uses a 30-day rolling window with real-time alerts classified as critical vs. non-critical.
- The "Insights" tab provides proactive recommendations ranked by impact.

**Automated notifications:**
- Real-time alerts for payment path issues (critical)
- Integration error trend alerts (400/409/429 spikes)
- Authorization rate decline anomaly alerts (ML-driven)
- Webhook latency change alerts
- Available via Workbench dashboard (Premium/Enterprise)

**Key pattern:** Stripe separates "Alerts" (something is broken now) from "Insights" (you should improve this). Both live in the Health tab with a 30-day history. Recommendations link directly to relevant docs.

---

### 2. Vercel — Deployment + Performance Health

**What they monitor:**
- Build success/failure rates
- Core Web Vitals (LCP, FID, CLS) via Speed Insights
- Domain SSL certificate status
- Usage against plan limits
- AI-powered anomaly detection (Vercel Agent)

**How they score/grade:**
- Core Web Vitals scored per Google's good/needs-improvement/poor thresholds
- No composite health score — metric-by-metric view

**Automated notifications:**
- Deployment failure alerts (email, Slack, webhook, push)
- Performance regression alerts (configurable thresholds on CWV)
- Usage/spend threshold alerts (including SMS for billing)
- Domain/SSL issues
- Role-based: developers get deployment alerts; billing contacts get spend alerts

**Key pattern:** Vercel uses role-based notification routing. Cannot fully disable critical alerts (can opt out of one channel but not all). Spend Management alerts support SMS — the only category that does.

---

### 3. Shopify — App Store Quality Gates

**What they monitor:**
- API response latency (must be <500ms for 95th percentile over 28 days)
- Error rates (99.9% success rate required for carrier apps)
- Lighthouse performance scores (must stay within 10% of baseline)
- App Store rating (minimum threshold required)
- Core Web Vitals impact on merchant stores

**How they score/grade:**
- Binary pass/fail quality gates for App Store listing
- "Built for Shopify" badge requires meeting all performance benchmarks
- Minimum 1,000 API requests in 28 days to qualify for assessment

**Automated notifications:**
- Dashboard notifications when Core Web Vitals data is insufficient
- App review quality feedback during submission
- Performance benchmark alerts

**Key pattern:** Shopify uses hard quality gates that directly impact distribution. Failing benchmarks means removal from the App Store. The 28-day rolling window and 95th percentile measurement are industry standards.

---

### 4. Google Play Console — Android Vitals

**What they monitor:**
- User-perceived crash rate (threshold: 1.09% of daily sessions)
- User-perceived ANR rate (threshold: 0.47% of daily sessions)
- Excessive partial wake locks
- Per-device crash/ANR rates (threshold: 8% per device model)
- All metrics use a 28-day rolling window

**How they score/grade:**
- Binary "bad behavior" thresholds — overall and per-device
- Peer group benchmarking (compare against category)
- Color-coded: green (good), yellow (approaching), red (exceeding)

**Automated notifications:**
- "Emerging issues" flagged after 7 days of anomalous behavior
- 21-day grace period to fix before store visibility impact
- Pre-launch automated testing reports on every APK upload
- Email alerts for threshold violations

**Consequences of poor health:**
- Reduced visibility in Play Store search
- Warning label shown on store listing to users
- Partial wake lock violations affect visibility (as of March 2026)

**Key pattern:** Google ties quality directly to distribution. The "emerging issues" system gives developers early warning (7 days) before consequences kick in (21 days). Peer benchmarking shows developers where they stand relative to competitors.

---

### 5. Apple App Store Connect — Performance Metrics

**What they monitor:**
- 7 metric categories: battery, launches, hangs, memory, disk writes, scroll hitches, terminations
- Crash rates per version
- Launch time regressions
- Disk write volume (flagged when >1GB in 24 hours)

**How they score/grade:**
- Per-version regression detection (automated trend analysis)
- "Insights" section highlights performance priorities
- No composite score — category-by-category

**Automated notifications:**
- Regression alerts when a new version degrades performance
- Crash report aggregation with opt-in user diagnostics
- TestFlight auto-shares crash logs during beta

**Key pattern:** Apple's "Insights" section automatically identifies and prioritizes performance regressions. Developers don't configure thresholds — Apple's system learns what's normal and flags deviations. The 7-category breakdown gives a comprehensive view without a single score.

---

### 6. Twilio — Intelligent Alerts + Alarms API

**What they monitor:**
- Error code volumes (per mobile network code)
- Deliverability rates
- Traffic volume fluctuations
- Data sparsity signals
- Account-specific historical patterns

**How they score/grade:**
- Impact Score: 0 to 1, calculated from deliverability, data sparsity, and traffic fluctuation
- Four severity tiers: Urgent, Critical, Important, Warning
- Dynamic thresholds based on account's historical data (ML)

**Automated notifications:**
- Intelligent Alerts: ML-driven, no manual threshold configuration needed
- Traffic analyzed in 5-minute intervals
- Alerts delivered via email + in-console
- Alarms API: developer-configured thresholds with 5min/15min/1hr/12hr/24hr windows
- Notification within 15 seconds of threshold breach

**Key pattern:** Twilio runs two parallel systems: (1) Intelligent Alerts that require zero configuration and use ML to detect anomalies, and (2) the Alarms API where developers set custom thresholds. The 5-minute analysis interval and 15-second notification latency set the speed benchmark. The Impact Score (0-1) with four severity tiers is elegant.

---

### 7. AWS Trusted Advisor — Proactive Recommendations

**What they monitor:**
- 200+ checks across 5 categories: Cost Optimization, Performance, Security, Fault Tolerance, Service Limits

**How they score/grade:**
- Three-color traffic light: Red (action recommended), Yellow (investigation recommended), Green (no problems)
- Organization-level dashboard aggregates all accounts
- Trusted Advisor Priority: account team can escalate specific recommendations

**Automated notifications:**
- Weekly email summary of check results
- Trusted Advisor Priority: daily or weekly email digest
- Slack integration for Priority recommendations
- Configurable recipients (multiple contacts)

**Key pattern:** The weekly email digest with traffic-light summary is the gold standard for "at a glance" health reporting. The three-level severity (red/yellow/green) maps perfectly to action urgency. The 5-category framework ensures comprehensive coverage.

---

### 8. GitHub — Dependabot + Security Advisories

**What they monitor:**
- Dependency vulnerabilities (28,000+ reviewed advisories)
- Secret exposure in commits (push protection)
- Code scanning results

**How they score/grade:**
- Severity levels: Critical, High, Medium, Low
- Only GitHub-reviewed advisories trigger alerts (reduces false positives)

**Automated notifications:**
- Dependabot alerts with automatic fix PRs
- Push protection blocks commits containing secrets in real-time
- Security advisory notifications via email
- Delegated bypass: approval workflow for push protection overrides

**Key pattern:** GitHub's unique contribution is automated remediation — not just alerting but actually generating fix PRs. Push protection is proactive (prevents the problem) rather than reactive (alerts after the problem). The delegated bypass approval flow is a good model for escalation.

---

### 9. Datadog Watchdog — AI-Powered Anomaly Detection

**What they monitor:**
- Infrastructure metrics, traces, and logs (all telemetry)
- Latency spikes in microservices
- Elevated error rates on endpoints
- Network issues in cloud provider zones
- Cross-service anomaly correlation

**How they score/grade:**
- No score — anomaly-based detection
- Watchdog "stories" group related anomalies across services
- Root Cause Analysis (RCA) identifies the originating service

**Automated notifications:**
- Zero-configuration anomaly detection (learns baseline automatically)
- Watchdog Alerts convertible to monitors for team notification
- Each notification includes actionable insights and root cause
- Cross-service correlation reduces alert noise

**Key pattern:** Watchdog's zero-configuration approach is the gold standard for anomaly detection. It groups related anomalies into "stories" (reducing alert fatigue) and provides automated root cause analysis. The key insight: don't just say "something is wrong" — say "this is wrong because of that."

---

### 10. Zapier — Partner Integration Health Score

**What they monitor:**
- Open bug reports (weighted by user impact)
- Open feature requests (weighted by vote count)
- Team responsiveness to issues
- Active user count

**How they score/grade:**
- Daily health score calculation
- Score factors: bug count, feature request count, resolution speed
- Bug with 100 voters impacts score more than bug with 1 voter
- Tiers: evaluated quarterly (Jan/Apr/Jul/Oct)
- Downgrade if you don't meet tier requirements at evaluation

**Automated notifications:**
- Monthly partner newsletter with updates
- Dashboard shows current metrics and tier status
- Quarterly tier evaluation results

**Key pattern:** Zapier ties health score directly to business outcomes (partner tier affects distribution). The weighted scoring (bugs with more affected users count more) is smart. Quarterly evaluation with potential downgrade creates urgency to maintain quality.

---

## Part 2: Universal Patterns Across All 10 Platforms

### Pattern 1: Two-Layer Alerting (ML + Manual)
**Used by:** Stripe, Twilio, Datadog, Google Play
- Layer 1: Zero-config ML anomaly detection (learns your baseline)
- Layer 2: User-configured threshold alerts
- Best practice: Start with ML defaults, let developers add custom thresholds

### Pattern 2: Rolling Window Assessment
**Used by:** Shopify (28 days), Google Play (28 days), Stripe (30 days)
- Quality is never a point-in-time snapshot
- 28-30 day windows smooth out noise
- Peer comparison within the same time window

### Pattern 3: Traffic-Light Severity
**Used by:** AWS (red/yellow/green), Twilio (urgent/critical/important/warning), GitHub (critical/high/medium/low)
- 3-4 levels of severity
- Clear mapping from severity to required action
- Color-coded for instant recognition

### Pattern 4: Consequences Tied to Quality
**Used by:** Google Play (reduced visibility), Shopify (app removal), Zapier (tier downgrade)
- Poor quality directly reduces distribution/visibility
- Grace periods before consequences (Google gives 21 days)
- Clear communication of thresholds and timelines

### Pattern 5: Proactive Recommendations with Direct Links
**Used by:** Stripe (Insights tab), AWS (Trusted Advisor), Apple (Insights section)
- Don't just report problems — suggest specific fixes
- Link directly to the settings page or docs that resolve the issue
- Prioritize by impact

### Pattern 6: Weekly/Monthly Digest Emails
**Used by:** AWS (weekly), Zapier (monthly), Twilio (real-time + digest)
- Summary email prevents alert fatigue
- Traffic-light summary at the top
- Detailed breakdown below
- Direct action links

### Pattern 7: Setup Completeness Tracking
**Used by:** Stripe (Workbench setup), SettleGrid (security-status — already exists)
- Checklist of required/recommended setup steps
- Progress percentage
- Priority levels (critical vs. recommended vs. nice-to-have)

---

## Part 3: SettleGrid Quality Monitoring System Design

### What SettleGrid Already Has
Based on codebase analysis:
- **Health checks**: Cron pings tool health endpoints every 5 min, records up/down/degraded
- **Consumer alerts**: low_balance, budget_exceeded, usage_spike (with 1hr cooldown)
- **Security status**: 8-item checklist (Stripe Connect, 2FA, IP allowlist, webhooks, budget, key rotation, audit, sessions)
- **Email infrastructure**: 30+ email templates via Resend, including alert emails
- **Usage aggregation**: Daily cron aggregates cost allocations per org
- **Webhook retry**: Cron retries failed webhook deliveries
- **Usage warning emails**: Templates exist for 80% and 90% thresholds (not yet wired to cron)
- **Fraud detection**: Session fingerprinting, flagged invocations

### What SettleGrid Should Build

---

### A. Developer Health Score (Composite Score: 0-100)

Inspired by: Zapier (health score), AWS (5-category framework), Stripe (Insights)

**5 scoring dimensions, each worth 20 points:**

#### 1. Integration Quality (20 pts)
| Metric | Scoring | Source |
|--------|---------|--------|
| Error rate (4xx+5xx) | <1% = 20, 1-5% = 15, 5-10% = 10, >10% = 5 | invocations.status |
| Average latency | <200ms = 20, 200-500ms = 15, 500-1000ms = 10, >1s = 5 | invocations.latencyMs |
| Health endpoint configured | Yes = 20, No = 10 | tools.healthEndpoint |
| Health check uptime (28d) | >99.5% = 20, 95-99.5% = 15, <95% = 5 | toolHealthChecks |

*Final dimension score: average of applicable metrics, scaled to 20*

#### 2. Security Posture (20 pts)
| Metric | Points |
|--------|--------|
| Stripe Connect active | 5 |
| 2FA enabled | 4 |
| Webhook endpoint configured | 3 |
| IP allowlist on all keys | 3 |
| No API keys older than 90 days | 3 |
| Budget controls enabled | 2 |

*Already computed by /api/dashboard/developer/security-status — extend with scoring*

#### 3. Operational Health (20 pts)
| Metric | Scoring |
|--------|---------|
| Webhook delivery success rate (28d) | >99% = 8, 95-99% = 5, <95% = 2 |
| Consumer support responsiveness | Reviews responded to within 48h = 6 |
| Tool versioning active | Using semver changelogs = 3 |
| Audit log retention configured | Default or higher = 3 |

#### 4. Consumer Satisfaction (20 pts)
| Metric | Scoring |
|--------|---------|
| Average review rating | 4.5+ = 10, 4.0-4.5 = 7, 3.5-4.0 = 4, <3.5 = 2 |
| Review response rate | >80% = 5, 50-80% = 3, <50% = 1 |
| Refund/dispute rate | <1% = 5, 1-5% = 3, >5% = 0 |

#### 5. Growth Trajectory (20 pts)
| Metric | Scoring |
|--------|---------|
| Active consumers (28d) | >100 = 8, 50-100 = 6, 10-50 = 4, <10 = 2 |
| Revenue trend (MoM) | Growing = 6, Stable = 4, Declining = 2 |
| Invocation volume trend | Growing = 6, Stable = 4, Declining = 2 |

**Letter grades (for dashboard display):**
- A+ = 95-100, A = 90-94, A- = 85-89
- B+ = 80-84, B = 75-79, B- = 70-74
- C+ = 65-69, C = 60-64, C- = 55-59
- D = 40-54
- F = Below 40

**Recalculation cadence:** Daily at 3 AM UTC (after usage aggregation at 2 AM)

---

### B. Consumer Health Score (0-100)

Simpler, focused on usage patterns:

| Metric | Weight |
|--------|--------|
| Balance health (% of typical spend remaining) | 25 |
| Payment method validity (card not expiring soon) | 20 |
| Budget utilization (not consistently hitting limits) | 20 |
| Error rate on their API calls | 20 |
| Auto-refill configured | 15 |

---

### C. Automated Email System (7 Email Types)

#### Email 1: Weekly Developer Health Digest
**Trigger:** Every Monday at 9 AM in developer's timezone (fallback: UTC)
**Inspired by:** AWS Trusted Advisor weekly email

```
Subject: Your SettleGrid Health Report — Score: 87/100 (A)

[Traffic-light summary bar]
  Integration Quality: GREEN (18/20)
  Security Posture:    YELLOW (14/20) — 2 API keys need rotation
  Operational Health:  GREEN (19/20)
  Consumer Satisfaction: GREEN (18/20)
  Growth Trajectory:   GREEN (18/20)

[Top 3 Action Items]
1. RECOMMENDED: Rotate 2 API keys older than 90 days → [Manage Keys]
2. TIP: Enable IP allowlisting on your production keys → [Security Guide]
3. INSIGHT: Your latency improved 12% this week → Keep it up

[Quick Stats This Week]
  Invocations: 12,450 (+8% vs last week)
  Revenue: $248.90 (+12%)
  Error Rate: 0.3% (excellent)
  Avg Latency: 145ms

[View Full Dashboard →]
```

#### Email 2: Anomaly Alert (Real-Time)
**Trigger:** ML detects anomaly in error rate, latency, or traffic volume
**Inspired by:** Twilio Intelligent Alerts, Datadog Watchdog

```
Subject: ALERT: Error rate spike on [Tool Name] — 12.5% (normally 0.8%)

[Severity badge: CRITICAL / WARNING / INFO]

What happened:
  Error rate jumped from 0.8% to 12.5% at 14:32 UTC
  Affected: 847 requests in the last 30 minutes

Likely cause:
  429 "Rate Limit Exceeded" errors increased 15x
  Most errors from consumer "acme-corp" (API key sg_live_abc...)

Recommended action:
  1. Check if the consumer's integration is retry-looping
  2. Review rate limit settings → [Rate Limit Docs]
  3. Contact the consumer if the pattern continues

[View Invocation Logs →]
```

#### Email 3: Setup Completeness Reminder (Drip)
**Trigger:** 24h, 72h, 7d after signup if setup is incomplete
**Inspired by:** Stripe Workbench, general onboarding best practices

```
Subject: Complete your SettleGrid setup — 3 steps remaining

Hi [Name],

You've published your first tool — nice work! Here's what's left
to go live and start earning:

  [x] Create account
  [x] Publish a tool
  [ ] Connect Stripe (required for payouts) → [Connect Now]
  [ ] Set pricing → [Pricing Guide]
  [ ] Add a health endpoint → [Health Check Docs]

Completing these steps unlocks your tool in the SettleGrid directory
and enables consumer discovery.

[Complete Setup →]
```

#### Email 4: Quality Gate Warning (Grace Period)
**Trigger:** When a tool's error rate or latency exceeds thresholds for 7 consecutive days
**Inspired by:** Google Play "emerging issues" (7-day flag, 21-day action)

```
Subject: Quality warning: [Tool Name] error rate has been elevated for 7 days

Your tool "[Tool Name]" has maintained a 4xx/5xx error rate above
5% for 7 consecutive days (current: 7.2%).

If this continues for 14 more days, your tool may be:
  - Deprioritized in directory search results
  - Flagged with a quality warning badge

What to do:
  1. Review your error logs → [View Logs]
  2. Check your health endpoint response → [Health Dashboard]
  3. Common fixes: [Error Handling Best Practices]

Timeline:
  Day 0 (today): Warning issued
  Day 14: Quality badge applied if unresolved
  Day 21: Directory deprioritization if unresolved

[View Tool Health →]
```

#### Email 5: Monthly Consumer Usage Summary
**Trigger:** 1st of each month
**Inspired by:** Standard SaaS usage reports

```
Subject: Your SettleGrid usage for March 2026

[Tool-by-tool breakdown]
  Tool: "Translation API"
    Invocations: 8,450
    Spend: $84.50
    Budget used: 67% of $125 limit
    Avg latency: 230ms

  Tool: "Sentiment Analyzer"
    Invocations: 2,100
    Spend: $21.00
    Balance remaining: $14.00 ⚠️ (auto-refill: OFF)

[Recommendations]
  - Enable auto-refill on "Sentiment Analyzer" to avoid service interruption
  - Your Translation API usage grew 23% — consider upgrading your budget

[View Full Dashboard →]
```

#### Email 6: Payout + Revenue Milestone
**Trigger:** Monthly payout processed OR revenue milestone hit ($100, $1K, $10K, $50K, $100K)
**Inspired by:** SettleGrid already has revenueMilestoneEmail and monthlyEarningsSummaryEmail

*Already exists in email.ts — integrate with health score in the template*

#### Email 7: Re-engagement for Dormant Developers
**Trigger:** No invocations on any tool for 14 consecutive days
**Inspired by:** General PLG re-engagement patterns

```
Subject: Your SettleGrid tools haven't received traffic in 14 days

Hi [Name],

Your tools haven't received any API calls since [date].
Here are some things that might help:

  - Verify your health endpoint is responding → [Check Now]
  - Review your pricing — is it competitive? → [Pricing Guide]
  - Share your tool listing → [Your Listing URL]
  - Check the directory to see trending tools → [Directory]

Need help? Reply to this email or visit our docs.

[View Dashboard →]
```

---

### D. Developer Health Dashboard (UI)

**Location:** `/dashboard/health` (new page)

#### Section 1: Health Score Hero
- Large circular gauge showing composite score (0-100) with letter grade
- Color: green (>80), yellow (60-80), red (<60)
- Trend arrow: improving, stable, declining (vs. last week)
- "Last updated: [timestamp]"

#### Section 2: Five-Dimension Breakdown
- Five horizontal bar charts, one per dimension
- Each bar shows current score + 4-week trend sparkline
- Clickable — expands to show individual metric details
- Traffic-light icon for each dimension (green/yellow/red)

#### Section 3: Action Items (Priority-Sorted)
- Inspired by AWS Trusted Advisor recommendations
- Three priority tiers with badges:
  - **Critical** (red): Must fix — affects payouts or visibility
  - **Recommended** (yellow): Should fix — improves score
  - **Optimization** (blue): Nice to have — boosts growth
- Each item includes:
  - Description of the issue
  - Impact on health score ("Fixing this adds +5 points")
  - Direct link to the fix page
  - Expandable step-by-step guide (like security-status already does)
  - "Dismiss" option (with "remind me in 7 days")

#### Section 4: Anomaly Timeline
- Inspired by Datadog Watchdog stories
- Chronological feed of detected anomalies (last 30 days)
- Each anomaly card shows:
  - Timestamp + severity badge
  - What happened (error spike, latency regression, traffic drop)
  - Root cause analysis (if determinable)
  - Resolution status (active / resolved / dismissed)

#### Section 5: Peer Benchmarking
- Inspired by Google Play Android Vitals peer comparison
- Show developer's metrics vs. percentile of all SettleGrid developers
- "Your error rate: 0.8% — better than 85% of developers"
- "Your avg latency: 340ms — better than 62% of developers"
- Categories: same tool category peer group

#### Section 6: Trend Charts
- 30-day line charts for: invocations, revenue, error rate, latency, health score
- Annotations for anomaly events
- Compare to previous 30-day period

---

### E. Quality Gates (Consequences)

Inspired by Google Play and Shopify:

| Threshold | Grace Period | Consequence |
|-----------|-------------|-------------|
| Error rate >5% for 7 days | 14 more days | "Needs Attention" badge on listing |
| Error rate >10% for 7 days | 7 more days | Deprioritized in directory search |
| Health endpoint down >48h | 24h | "Unreliable" badge on listing |
| Health score <40 for 30 days | 14 days | Listing hidden from directory |
| No invocations for 60 days | 7-day warning email | Listing moved to "inactive" |

All consequences are reversible once the issue is fixed. Grace period emails are sent at: trigger, midpoint, and 24h before consequence.

---

### F. Anomaly Detection Engine

Inspired by Twilio Intelligent Alerts and Datadog Watchdog:

**Implementation approach (no external ML needed):**

```
Anomaly detection uses z-score on 28-day rolling baseline:

1. For each tool, compute daily/hourly aggregates:
   - error_rate, avg_latency, invocation_count, revenue

2. Rolling baseline (28 days):
   - mean and std_dev for each metric
   - Account for day-of-week patterns (separate weekday/weekend baselines)

3. Anomaly scoring:
   - z_score = (current_value - mean) / std_dev
   - |z| > 2.0 = WARNING
   - |z| > 3.0 = CRITICAL
   - |z| > 4.0 = URGENT

4. Minimum data requirement:
   - At least 7 days of data before anomaly detection activates
   - At least 100 invocations in baseline period
```

**Analysis interval:** Every 5 minutes (piggyback on existing health-check cron)

**Impact score (0-1):** Inspired by Twilio
- error_rate weight: 0.4
- traffic_volume weight: 0.3
- latency weight: 0.2
- data_sparsity weight: 0.1

---

### G. Implementation Priority

#### Phase 1: Foundation (Week 1-2)
1. Wire up existing `usageWarning80Email` and `usageWarning90Email` in the aggregate-usage cron (TODO already noted in code)
2. Create `developerHealthScores` DB table (developerId, score, dimensions JSONB, calculatedAt)
3. Build daily health score calculation cron
4. Build `/dashboard/health` page with score display + dimension breakdown

#### Phase 2: Notifications (Week 3-4)
5. Weekly Developer Health Digest email template + cron (Monday 9 AM)
6. Setup completeness drip emails (24h, 72h, 7d triggers)
7. Quality gate warning emails (7-day threshold breach)
8. Monthly consumer usage summary email

#### Phase 3: Intelligence (Week 5-6)
9. Anomaly detection engine (z-score based, 5-min interval)
10. Anomaly alert email template
11. Action items engine (generate recommendations from score components)
12. Anomaly timeline on health dashboard

#### Phase 4: Consequences (Week 7-8)
13. Quality gate system (badges on tool listings)
14. Directory deprioritization logic
15. Grace period tracking + countdown emails
16. Dormant tool/developer detection + re-engagement emails

#### Phase 5: Peer Benchmarking (Week 9-10)
17. Aggregate percentile calculations across all developers
18. Peer comparison UI on health dashboard
19. Category-based peer grouping
20. Trend comparison charts

---

### H. Database Changes Required

```sql
-- New table: developer health scores (daily snapshots)
CREATE TABLE developer_health_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  developer_id UUID NOT NULL REFERENCES developers(id) ON DELETE CASCADE,
  score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
  grade VARCHAR(2) NOT NULL, -- A+, A, A-, B+, etc.
  dimensions JSONB NOT NULL, -- { integration: 18, security: 14, ... }
  action_items JSONB NOT NULL DEFAULT '[]', -- [{ id, title, priority, points, href }]
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX dhs_developer_id_idx ON developer_health_scores(developer_id);
CREATE INDEX dhs_calculated_at_idx ON developer_health_scores(calculated_at);

-- New table: anomaly events
CREATE TABLE anomaly_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tool_id UUID NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
  developer_id UUID NOT NULL REFERENCES developers(id) ON DELETE CASCADE,
  metric TEXT NOT NULL, -- 'error_rate', 'latency', 'traffic_volume'
  severity TEXT NOT NULL, -- 'warning', 'critical', 'urgent'
  z_score NUMERIC(6,2) NOT NULL,
  impact_score NUMERIC(4,3) NOT NULL, -- 0.000 to 1.000
  baseline_value NUMERIC NOT NULL,
  current_value NUMERIC NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active', -- 'active', 'resolved', 'dismissed'
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX ae_tool_id_idx ON anomaly_events(tool_id);
CREATE INDEX ae_developer_id_idx ON anomaly_events(developer_id);
CREATE INDEX ae_created_at_idx ON anomaly_events(created_at);

-- New table: quality gate states
CREATE TABLE quality_gates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tool_id UUID NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
  gate_type TEXT NOT NULL, -- 'error_rate', 'health_down', 'low_score', 'dormant'
  triggered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  grace_deadline TIMESTAMPTZ NOT NULL,
  consequence_applied BOOLEAN NOT NULL DEFAULT FALSE,
  consequence_type TEXT, -- 'badge', 'deprioritized', 'hidden', 'inactive'
  resolved_at TIMESTAMPTZ,
  UNIQUE(tool_id, gate_type)
);
CREATE INDEX qg_tool_id_idx ON quality_gates(tool_id);

-- New table: notification tracking (prevent duplicate emails)
CREATE TABLE notification_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id UUID NOT NULL, -- developer or consumer ID
  recipient_type TEXT NOT NULL, -- 'developer' or 'consumer'
  notification_type TEXT NOT NULL, -- 'weekly_digest', 'anomaly', 'quality_gate', etc.
  notification_key TEXT, -- dedup key, e.g., 'usage_warning_80_2026-03'
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(recipient_id, notification_type, notification_key)
);
CREATE INDEX nl_recipient_idx ON notification_log(recipient_id, notification_type);
```

---

### I. New Cron Jobs Required

| Cron | Schedule | Purpose |
|------|----------|---------|
| calculate-health-scores | Daily 3 AM UTC | Compute developer health scores |
| detect-anomalies | Every 5 min | Z-score anomaly detection |
| weekly-health-digest | Monday 9 AM UTC | Send developer digest emails |
| monthly-consumer-summary | 1st of month, 9 AM UTC | Send consumer usage summaries |
| quality-gate-check | Daily 4 AM UTC | Evaluate quality gates, apply consequences |
| setup-completeness-drip | Hourly | Check new signups, send drip emails |
| dormant-detection | Daily 5 AM UTC | Find dormant tools, send re-engagement |

---

### J. New API Routes Required

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/dashboard/developer/health-score` | GET | Current health score + history |
| `/api/dashboard/developer/health-score/actions` | GET | Priority-sorted action items |
| `/api/dashboard/developer/health-score/anomalies` | GET | Anomaly timeline |
| `/api/dashboard/developer/health-score/peers` | GET | Peer benchmarking data |
| `/api/dashboard/developer/health-score/dismiss` | POST | Dismiss an action item |
| `/api/dashboard/consumer/usage-summary` | GET | Monthly usage summary data |
| `/api/cron/calculate-health-scores` | GET | Health score calculation |
| `/api/cron/detect-anomalies` | GET | Anomaly detection |
| `/api/cron/weekly-health-digest` | GET | Weekly email dispatch |
| `/api/cron/quality-gate-check` | GET | Quality gate evaluation |

---

## Part 4: Summary of Key Design Decisions

1. **Composite score (0-100) with letter grades** rather than per-metric dashboards. Developers want one number to know if they're healthy. Inspired by Zapier's health score and school grading.

2. **Two-layer alerting** (automatic anomaly detection + user-configured alerts). The anomaly detection requires zero setup. Inspired by Twilio Intelligent Alerts.

3. **28-day rolling windows** for all quality assessments. Industry standard (Shopify, Google Play, Stripe).

4. **Grace periods before consequences**. Never punish without warning. 7-day detection, 14-21 day grace, clear countdown. Inspired by Google Play.

5. **Weekly digest + real-time anomaly alerts**. Digest prevents fatigue; real-time alerts prevent outages. Inspired by AWS + Twilio.

6. **Action items with point values**. "Fixing this adds +5 points" creates clear incentive. Inspired by AWS Trusted Advisor recommendations.

7. **Peer benchmarking**. "Better than 85% of developers" is more motivating than raw numbers. Inspired by Google Play Android Vitals.

8. **Z-score anomaly detection** (no ML dependency). Simple, explainable, runs in a cron job. Good enough for SettleGrid's scale. Upgrade to ML later if needed.

9. **Notification deduplication via notification_log table**. Prevent spam while ensuring coverage. Inspired by SettleGrid's existing 1-hour cooldown pattern in alert-check.

10. **Build on existing infrastructure**. The security-status endpoint, alert-check cron, health-checks cron, and 30+ email templates are the foundation. This plan extends them rather than replacing them.
