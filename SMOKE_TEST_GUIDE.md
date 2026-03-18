# SettleGrid -- Comprehensive Smoke Test Guide

> Manual QA checklist for verifying every surface of the SettleGrid platform.
> Target: `https://settlegrid.ai` (production) or `http://localhost:3005` (local dev).

---

## 1. Build & Compilation

- [ ] `tsc --noEmit` passes with 0 errors in `apps/web`
- [ ] `tsc --noEmit` passes with 0 errors in `packages/mcp`
- [ ] `npm run test` passes all tests (both packages)
- [ ] ESLint passes with 0 errors in `apps/web` (`npm run lint`)
- [ ] ESLint passes with 0 errors in `packages/mcp` (`npm run lint`)
- [ ] `next build` succeeds (requires env vars)
- [ ] SDK builds with `tsup` (`packages/mcp`)

---

## 2. Marketing Pages -- Homepage (`/`)

### Hero Section
- [ ] Homepage (`/`) loads without errors
- [ ] Dark hero section renders with gradient mesh background
- [ ] Hero headline reads "The Settlement Layer for the AI Economy"
- [ ] Sub-headline mentions MCP tools, REST APIs, AI agents, model endpoints
- [ ] "Now in Public Beta" badge visible with pulsing green dot
- [ ] "Start Building" primary CTA button present and links to `/register`
- [ ] "Read Docs" secondary CTA button present and links to `/docs`
- [ ] Three trust checkmarks visible: "Free tier", "No credit card", "Any AI protocol"
- [ ] GitHub badge ("Open Source SDK") links to `github.com/settlegrid/mcp`
- [ ] npm badge ("@settlegrid/mcp") links to npmjs.com
- [ ] Hero code snippet displays with 3 integration pattern tabs (MCP, REST, x402)
- [ ] Copy button on code snippet works (copies to clipboard)

### Protocol Logo Bar
- [ ] "One SDK. Every protocol." tagline visible
- [ ] Six protocol names shown: MCP, x402, AP2, Visa TAP, Stripe, REST
- [ ] Each protocol name has a tooltip with full name on hover

### How It Works (3 Steps)
- [ ] Section heading: "Monetize any AI service in 5 minutes"
- [ ] Step 1: "Wrap Any AI Service" with numbered circle
- [ ] Step 2: "Consumers Buy Credits" with numbered circle
- [ ] Step 3: "Revenue Flows Automatically" with numbered circle

### Core Platform (6 Cards)
- [ ] Section heading: "Core Platform"
- [ ] Card 1: "Real-Time Metering" with bolt icon
- [ ] Card 2: "Protocol-Agnostic" with globe icon
- [ ] Card 3: "Multi-Hop Settlement" with arrows icon
- [ ] Card 4: "Agent Identity (KYA)" with fingerprint icon
- [ ] Card 5: "Outcome-Based Billing" with check-badge icon
- [ ] Card 6: "Enterprise Ready" with building icon
- [ ] All 6 cards have hover state (border highlight + shadow)

### Built for the AI Economy (4 Highlight Blocks)
- [ ] Section heading: "Built for the AI Economy"
- [ ] Block 1: "One-Line Integration" with code sample
- [ ] Block 2: "x402 Facilitator" with code sample
- [ ] Block 3: "Multi-Currency Settlement" with code sample
- [ ] Block 4: "AP2 Credentials Provider" with code sample

### Developer Experience Checklist
- [ ] Section heading: "Developer Experience"
- [ ] 18 items displayed in 3-column grid:
  - [ ] Per-method pricing
  - [ ] Budget enforcement
  - [ ] Auto-refill
  - [ ] IP allowlisting
  - [ ] Fraud detection
  - [ ] Webhook events
  - [ ] Health monitoring
  - [ ] Audit logging
  - [ ] API key management
  - [ ] Revenue analytics
  - [ ] Referral tracking
  - [ ] Developer profiles
  - [ ] OpenAPI 3.1 spec
  - [ ] SSE streaming
  - [ ] Multi-currency
  - [ ] Dark mode dashboard
  - [ ] Cmd+K palette
  - [ ] CSV export

### Enterprise Section
- [ ] Dark indigo background section renders
- [ ] 8 enterprise features listed with checkmarks
- [ ] 4 security badges visible: "SOC 2 Ready", "HMAC-SHA256", "SHA-256 at Rest", "99.9% SLA"
- [ ] Webhook verification code snippet on the right

### Comparison Table
- [ ] Section heading: "How SettleGrid Compares"
- [ ] Table header columns: Feature, SettleGrid, Stripe Billing, Nevermined, Paid.ai
- [ ] 15 feature rows render with checkmarks and dashes
- [ ] SettleGrid column highlighted with brand color
- [ ] Table scrolls horizontally on small screens

### Pricing Section
- [ ] Section heading: "Simple, Transparent Pricing"
- [ ] 4 pricing tiers displayed:
  - [ ] Free: $0 forever, 1 service, 1,000 ops/month
  - [ ] Builder: $29/month, 5 services, 50,000 ops/month
  - [ ] Scale: $99/month, unlimited services, 500,000 ops/month
  - [ ] Platform: $299/month, unlimited everything
- [ ] Scale tier highlighted as "Most Popular" with badge
- [ ] Each tier has a CTA button linking to `/register`

### CTA Section
- [ ] "Ready to monetize your AI services?" heading
- [ ] "Start Building" and "Browse Marketplace" buttons

### Header & Footer
- [ ] Header: SettleGrid logo, Marketplace link, Docs link, theme toggle, Log in, Get Started
- [ ] Footer: SettleGrid logo, Marketplace, Documentation, Privacy, Terms links
- [ ] Footer copyright year is current year

### Animations
- [ ] Scroll reveal animations fire on scroll (each section fades in)

---

## 3. Marketing Pages -- Other

### Documentation (`/docs`)
- [ ] Page loads without errors
- [ ] Syntax-highlighted code blocks render
- [ ] Error boundary (`error.tsx`) exists
- [ ] Loading state (`loading.tsx`) exists

### Privacy Policy (`/privacy`)
- [ ] Page loads without errors
- [ ] Content renders correctly
- [ ] Error boundary exists
- [ ] Loading state exists

### Terms of Service (`/terms`)
- [ ] Page loads without errors
- [ ] Content renders correctly
- [ ] Error boundary exists
- [ ] Loading state exists

### Tools/Marketplace (`/tools`)
- [ ] Page loads without errors
- [ ] Tool listing renders
- [ ] Error boundary exists
- [ ] Loading state exists
- [ ] Layout wrapper exists

### Tool Detail (`/tools/[slug]`)
- [ ] Detail page loads for a valid slug
- [ ] Error boundary exists
- [ ] Loading state exists

### Gate (`/gate`)
- [ ] Gate page loads (password entry)
- [ ] Error boundary exists
- [ ] Loading state exists
- [ ] Layout wrapper exists

---

## 4. Authentication

### Login (`/login`)
- [ ] Page loads with email/password form
- [ ] Google OAuth button present
- [ ] GitHub OAuth button present
- [ ] Error boundary exists
- [ ] Loading state exists

### Register (`/register`)
- [ ] Page loads with signup form
- [ ] Google OAuth button present on register
- [ ] GitHub OAuth button present on register
- [ ] Error boundary exists
- [ ] Loading state exists

### Auth Flow
- [ ] Unauthenticated user redirected from `/dashboard` to `/login`
- [ ] Authenticated user redirected from `/login` to `/dashboard`
- [ ] Authenticated user redirected from `/register` to `/dashboard`
- [ ] Sign out works and redirects to `/login`
- [ ] `/auth/callback` route handles OAuth callback

---

## 5. Dashboard -- Overview (`/dashboard`)

- [ ] Page loads with stats cards
- [ ] 4 stat cards present (Revenue, Invocations, Active Tools, Revenue 24h)
- [ ] Charts render (invocations bar chart, revenue area chart)
- [ ] Period selector (7d/30d/90d) works
- [ ] Method breakdown table renders
- [ ] Top consumers table renders
- [ ] Breadcrumbs show "Dashboard"
- [ ] Live indicator visible
- [ ] Error boundary exists
- [ ] Loading state (skeleton) exists

---

## 6. Dashboard -- Tools (`/dashboard/tools`)

- [ ] Page loads with tool listing
- [ ] "Create Tool" button present
- [ ] Tool cards show name, slug, status, invocations, revenue
- [ ] Tool status badge (draft/active/disabled)
- [ ] Breadcrumbs show "Dashboard > Tools"
- [ ] Empty state shown when no tools
- [ ] Error boundary exists
- [ ] Loading state exists

---

## 7. Dashboard -- Analytics (`/dashboard/analytics`)

- [ ] Page loads with analytics charts
- [ ] Revenue over time chart renders
- [ ] Invocations over time chart renders
- [ ] Method breakdown table
- [ ] Date range selector works
- [ ] Export button (CSV) present
- [ ] Error boundary exists
- [ ] Loading state exists

---

## 8. Dashboard -- Payouts (`/dashboard/payouts`)

- [ ] Page loads with payout history
- [ ] Stripe Connect status visible
- [ ] "Connect Stripe" button (if not connected)
- [ ] Payout table with amount, period, status columns
- [ ] Trigger payout button (if balance >= minimum)
- [ ] Error boundary exists
- [ ] Loading state exists

---

## 9. Dashboard -- Webhooks (`/dashboard/webhooks`)

- [ ] Page loads with webhook endpoint listing
- [ ] "Add Endpoint" button present
- [ ] Endpoint cards show URL, events, status
- [ ] Delivery history visible
- [ ] "Test Webhook" button works
- [ ] Error boundary exists
- [ ] Loading state exists

---

## 10. Dashboard -- Audit Log (`/dashboard/audit-log`)

- [ ] Page loads with audit event listing
- [ ] Columns: action, resource, timestamp, IP
- [ ] CSV export button
- [ ] Pagination or virtual scroll
- [ ] Error boundary exists
- [ ] Loading state exists

---

## 11. Dashboard -- Health (`/dashboard/health`)

- [ ] Page loads with tool health status
- [ ] Status indicators (up/down/degraded)
- [ ] Response time metrics
- [ ] Last checked timestamp
- [ ] Error boundary exists
- [ ] Loading state exists

---

## 12. Dashboard -- Fraud (`/dashboard/fraud`)

- [ ] Page loads with fraud detection summary
- [ ] Flagged invocations listed
- [ ] Fraud rules/signals visible
- [ ] Error boundary exists
- [ ] Loading state exists

---

## 13. Dashboard -- Referrals (`/dashboard/referrals`)

- [ ] Page loads with referral program info
- [ ] Referral code visible/copyable
- [ ] Earnings table shows commission
- [ ] Error boundary exists
- [ ] Loading state exists

---

## 14. Dashboard -- Reputation (`/dashboard/reputation`)

- [ ] Page loads with reputation score
- [ ] Score breakdown: uptime, response time, review avg
- [ ] Error boundary exists
- [ ] Loading state exists

---

## 15. Dashboard -- Settings (`/dashboard/settings`)

- [ ] Page loads with settings form
- [ ] Profile fields (name, email)
- [ ] Payout settings (schedule, minimum)
- [ ] Tier display
- [ ] Error boundary exists
- [ ] Loading state exists

---

## 16. Dashboard -- Consumer Portal (`/consumer`)

- [ ] Page loads for consumer role
- [ ] Balance display
- [ ] API key management
- [ ] Usage history
- [ ] Error boundary exists
- [ ] Loading state exists

---

## 17. Dashboard Navigation & Chrome

### Sidebar
- [ ] 11 navigation items present and link correctly:
  - [ ] Overview (`/dashboard`)
  - [ ] Tools (`/dashboard/tools`)
  - [ ] Analytics (`/dashboard/analytics`)
  - [ ] Payouts (`/dashboard/payouts`)
  - [ ] Webhooks (`/dashboard/webhooks`)
  - [ ] Audit Log (`/dashboard/audit-log`)
  - [ ] Health (`/dashboard/health`)
  - [ ] Fraud (`/dashboard/fraud`)
  - [ ] Referrals (`/dashboard/referrals`)
  - [ ] Reputation (`/dashboard/reputation`)
  - [ ] Settings (`/dashboard/settings`)
- [ ] Sidebar collapse/expand works
- [ ] Active page highlighted in sidebar

### Command Palette
- [ ] `Cmd+K` (or `Ctrl+K`) opens command palette
- [ ] Search input focused on open
- [ ] Navigation commands listed
- [ ] Escape closes palette

---

## 18. API Routes -- Public / Unauthenticated

- [ ] `GET /api/health` returns 200 with status object
- [ ] `GET /api/x402/supported` returns facilitator info
- [ ] `GET /api/openapi.json` returns valid OpenAPI spec
- [ ] `GET /api/a2a` returns AP2 agent card
- [ ] `GET /api/a2a/skills` returns skill listing
- [ ] `POST /api/sdk/validate-key` validates API key
- [ ] `POST /api/sdk/meter` meters an invocation
- [ ] `POST /api/sdk/meter-with-metadata` meters with metadata
- [ ] `POST /api/sdk/test-validate` validates key in test mode
- [ ] `POST /api/waitlist` accepts email signups
- [ ] `POST /api/gate` validates gate password
- [ ] `GET /api/tools/directory` returns tool directory
- [ ] `GET /api/tools/categories` returns category list
- [ ] `GET /api/tools/public/[slug]` returns public tool info
- [ ] `GET /api/tools/by-slug/[slug]/reviews` returns reviews
- [ ] `GET /api/tools/by-slug/[slug]/pricing-widget` returns widget data
- [ ] `GET /api/tools/by-slug/[slug]/integration` returns integration info
- [ ] `GET /api/stream` returns SSE stream

### x402 Protocol
- [ ] `POST /api/x402/verify` verifies payment header
- [ ] `POST /api/x402/settle` settles payment

### Sessions (Multi-Hop)
- [ ] `POST /api/sessions` creates a workflow session
- [ ] `GET /api/sessions/[id]` retrieves session state
- [ ] `POST /api/sessions/[id]/hop` records a service hop
- [ ] `POST /api/sessions/[id]/delegate` delegates budget to child session
- [ ] `POST /api/sessions/[id]/complete` completes a session
- [ ] `POST /api/sessions/[id]/finalize` finalizes settlement

### Settlements
- [ ] `GET /api/settlements/[id]` retrieves settlement batch

### Agents (KYA)
- [ ] `POST /api/agents` registers an agent identity
- [ ] `GET /api/agents/[id]` retrieves agent identity
- [ ] `PUT /api/agents/[id]` updates agent identity
- [ ] `GET /api/agents/[id]/facts` returns AgentFacts profile

### Outcomes
- [ ] `POST /api/outcomes` creates outcome verification
- [ ] `GET /api/outcomes/[id]` retrieves outcome
- [ ] `POST /api/outcomes/[id]/verify` submits outcome result
- [ ] `POST /api/outcomes/[id]/dispute` opens a dispute

### Organizations
- [ ] `POST /api/orgs` creates organization
- [ ] `GET /api/orgs/[id]` retrieves org
- [ ] `PUT /api/orgs/[id]` updates org
- [ ] `GET /api/orgs/[id]/members` lists members
- [ ] `POST /api/orgs/[id]/members` adds member
- [ ] `PUT /api/orgs/[id]/members/[userId]` updates member role
- [ ] `DELETE /api/orgs/[id]/members/[userId]` removes member
- [ ] `GET /api/orgs/[id]/allocations` retrieves cost allocations
- [ ] `POST /api/orgs/[id]/allocations` creates allocation

---

## 19. API Routes -- Authenticated (Developer)

### Tools CRUD
- [ ] `POST /api/tools` creates a tool
- [ ] `GET /api/tools` lists developer's tools
- [ ] `GET /api/tools/[id]` retrieves tool detail
- [ ] `PUT /api/tools/[id]` updates tool
- [ ] `DELETE /api/tools/[id]` deletes tool
- [ ] `GET /api/tools/[id]/health` retrieves health data
- [ ] `GET /api/tools/[id]/status` retrieves status
- [ ] `PUT /api/tools/[id]/status` updates status
- [ ] `GET /api/tools/[id]/versions` lists versions
- [ ] `POST /api/tools/[id]/version` publishes new version
- [ ] `GET /api/tools/[id]/changelog` retrieves changelog
- [ ] `POST /api/tools/[id]/pricing-simulator` simulates pricing

### Dashboard Stats
- [ ] `GET /api/dashboard/developer/stats` returns dashboard stats
- [ ] `GET /api/dashboard/developer/stats/analytics` returns analytics
- [ ] `GET /api/dashboard/developer/stats/attribution` returns attribution
- [ ] `GET /api/dashboard/developer/stats/export` returns CSV export
- [ ] `GET /api/dashboard/developer/stats/funnel` returns funnel data
- [ ] `GET /api/dashboard/developer/profile` returns/updates profile

### Developer Webhooks
- [ ] `GET /api/developer/webhooks` lists webhooks
- [ ] `POST /api/developer/webhooks` creates webhook
- [ ] `GET /api/developer/webhooks/[id]` retrieves webhook
- [ ] `PUT /api/developer/webhooks/[id]` updates webhook
- [ ] `DELETE /api/developer/webhooks/[id]` deletes webhook
- [ ] `GET /api/developer/webhooks/[id]/deliveries` lists deliveries
- [ ] `POST /api/developer/webhooks/[id]/test` sends test webhook

### Developer Referrals
- [ ] `GET /api/developer/referrals` lists referrals
- [ ] `POST /api/developer/referrals` creates referral
- [ ] `GET /api/developer/referrals/[id]` retrieves referral
- [ ] `PUT /api/developer/referrals/[id]` updates referral
- [ ] `GET /api/developer/referrals/[id]/earnings` retrieves earnings

### Payouts
- [ ] `GET /api/payouts` lists payouts
- [ ] `POST /api/payouts/trigger` triggers payout

### Audit Log
- [ ] `GET /api/audit-log` lists audit events
- [ ] `GET /api/audit-log/export` exports CSV

### Developer Profiles
- [ ] `GET /api/developers/[id]/profile` retrieves public profile
- [ ] `GET /api/developers/[id]/reputation` retrieves reputation

### Stripe Connect
- [ ] `POST /api/stripe/connect` initiates Connect onboarding
- [ ] `GET /api/stripe/connect/callback` handles OAuth callback

---

## 20. API Routes -- Authenticated (Consumer)

- [ ] `GET /api/consumer/balance` retrieves balance
- [ ] `GET /api/consumer/usage` retrieves usage
- [ ] `GET /api/consumer/usage/analytics` retrieves usage analytics
- [ ] `GET /api/consumer/keys` lists API keys
- [ ] `POST /api/consumer/keys` creates API key
- [ ] `GET /api/consumer/keys/[id]` retrieves key
- [ ] `DELETE /api/consumer/keys/[id]` revokes key
- [ ] `PUT /api/consumer/keys/[id]/ip-restrict` sets IP allowlist
- [ ] `GET /api/consumer/budget` retrieves budget
- [ ] `PUT /api/consumer/budget` updates budget
- [ ] `GET /api/consumer/subscriptions` lists subscriptions
- [ ] `POST /api/consumer/subscriptions` creates subscription
- [ ] `GET /api/consumer/alerts` lists alerts
- [ ] `POST /api/consumer/alerts` creates alert
- [ ] `GET /api/consumer/alerts/[id]` retrieves alert
- [ ] `PUT /api/consumer/alerts/[id]` updates alert
- [ ] `DELETE /api/consumer/alerts/[id]` deletes alert
- [ ] `POST /api/consumer/conversion-events` logs conversion

---

## 21. API Routes -- Billing & Webhooks

- [ ] `POST /api/billing/checkout` creates Stripe checkout session
- [ ] `GET /api/billing/purchases` lists purchases
- [ ] `POST /api/billing/webhook` handles Stripe webhook

---

## 22. API Routes -- Auth

- [ ] `GET /api/auth/developer/me` returns current developer
- [ ] `GET /api/auth/consumer/me` returns current consumer

---

## 23. API Routes -- Cron Jobs

- [ ] `POST /api/cron/aggregate-usage` aggregates usage data
- [ ] `POST /api/cron/alert-check` checks alert thresholds
- [ ] `POST /api/cron/expire-sessions` expires stale sessions
- [ ] `POST /api/cron/health-checks` pings tool health endpoints
- [ ] `POST /api/cron/webhook-retry` retries failed webhook deliveries

---

## 24. Dark Mode

- [ ] Theme toggle (light/dark/system) works on marketing pages
- [ ] Homepage renders correctly in dark mode (dark hero, dark cards)
- [ ] Dashboard renders correctly in dark mode
- [ ] Charts render correctly in dark mode (axis labels visible)
- [ ] All text passes WCAG AA contrast in both modes
- [ ] No white flashes on page transitions in dark mode
- [ ] Footer and header adapt to theme

---

## 25. Responsive Design

### Mobile (375px)
- [ ] Homepage hero stacks vertically
- [ ] Protocol logo bar wraps
- [ ] How It Works cards stack to single column
- [ ] Core Platform cards stack to single column
- [ ] Pricing cards stack vertically
- [ ] Comparison table scrolls horizontally
- [ ] Header nav collapses (Marketplace/Docs links hidden on mobile)

### Dashboard (Mobile)
- [ ] Sidebar collapses on mobile
- [ ] Stat cards stack vertically
- [ ] Tables scroll horizontally on mobile
- [ ] Charts resize responsively

### Tablet (768px)
- [ ] How It Works shows 3 columns
- [ ] Pricing shows 2 columns
- [ ] Dashboard shows collapsed sidebar + main content

---

## 26. Security Headers

- [ ] `X-Frame-Options: DENY` present
- [ ] `X-Content-Type-Options: nosniff` present
- [ ] `Referrer-Policy: strict-origin-when-cross-origin` present
- [ ] `Permissions-Policy: camera=(), microphone=(), geolocation=()` present
- [ ] `Content-Security-Policy` present with correct directives
- [ ] `Strict-Transport-Security: max-age=31536000; includeSubDomains` present

---

## 27. Error Handling

- [ ] 404 page (`not-found.tsx`) renders for unknown routes
- [ ] Global error boundary (`error.tsx`) catches errors
- [ ] Global loading state (`loading.tsx`) renders during navigation
- [ ] Every dashboard page has its own `error.tsx`
- [ ] Every dashboard page has its own `loading.tsx`
- [ ] Every marketing page has its own `error.tsx`
- [ ] Every marketing page has its own `loading.tsx`

---

## 28. SDK (`@settlegrid/mcp`)

- [ ] `settlegrid.init()` returns valid instance
- [ ] `sg.wrap()` wraps a handler function
- [ ] `sg.validateKey()` validates an API key
- [ ] `sg.meter()` meters an invocation
- [ ] `sg.clearCache()` clears validation cache
- [ ] `settlegrid.version` returns `'0.1.0'`
- [ ] `settlegrid.extractApiKey()` extracts from headers/metadata
- [ ] `settlegridMiddleware` exported for REST middleware
- [ ] `createPaymentCapability` exported
- [ ] `generateServerCard` exported
- [ ] `generateServerCardBilling` exported
- [ ] Error classes exported (8 total): `SettleGridError`, `InvalidKeyError`, `InsufficientCreditsError`, `ToolNotFoundError`, `ToolDisabledError`, `RateLimitedError`, `SettleGridUnavailableError`, `NetworkError`, `TimeoutError`
- [ ] `LRUCache` exported
- [ ] `normalizeConfig`, `validatePricingConfig`, `getMethodCost`, `resolveOperationCost` exported
- [ ] Zod schemas exported: `pricingConfigSchema`, `generalizedPricingConfigSchema`

---

## 29. Database Schema

All 30 tables/relations present in `schema.ts`:
- [ ] `developers`
- [ ] `developersRelations`
- [ ] `tools`
- [ ] `toolsRelations`
- [ ] `consumers`
- [ ] `consumersRelations`
- [ ] `consumerToolBalances`
- [ ] `consumerToolBalancesRelations`
- [ ] `apiKeys`
- [ ] `apiKeysRelations`
- [ ] `invocations`
- [ ] `invocationsRelations`
- [ ] `purchases`
- [ ] `purchasesRelations`
- [ ] `payouts`
- [ ] `payoutsRelations`
- [ ] `webhookEndpoints`
- [ ] `webhookEndpointsRelations`
- [ ] `webhookDeliveries`
- [ ] `webhookDeliveriesRelations`
- [ ] `auditLogs`
- [ ] `auditLogsRelations`
- [ ] `toolReviews`
- [ ] `toolReviewsRelations`
- [ ] `toolChangelogs`
- [ ] `toolChangelogsRelations`
- [ ] `conversionEvents`
- [ ] `conversionEventsRelations`
- [ ] `consumerAlerts`
- [ ] `consumerAlertsRelations`
- [ ] `toolHealthChecks`
- [ ] `toolHealthChecksRelations`
- [ ] `referrals`
- [ ] `referralsRelations`
- [ ] `developerReputation`
- [ ] `developerReputationRelations`
- [ ] `waitlistSignups`
- [ ] `accounts`
- [ ] `ledgerEntries`
- [ ] `workflowSessions`
- [ ] `settlementBatches`
- [ ] `agentIdentities`
- [ ] `organizations`
- [ ] `organizationMembers`
- [ ] `organizationMembersRelations`
- [ ] `costAllocations`
- [ ] `complianceExports`
- [ ] `outcomeVerifications`

---

## 30. Settlement Layer Modules

- [ ] Protocol Registry: 4 adapters registered (mcp, x402, ap2, visa-tap)
- [ ] Detection priority: x402 > ap2 > visa-tap > mcp
- [ ] Ledger: `postLedgerEntry`, `computeBalanceFromLedger`, `reconcileAccount`, `verifyLedgerIntegrity`
- [ ] Sessions: `createSession`, `checkSessionBudget`, `recordSessionSpend`, `completeSession`, `finalizeSession`, `processSettlementBatch`, `rollbackSettlementBatch`, `expireStaleSessionsBatch`
- [ ] Identity: `registerAgent`, `resolveAgent`, `listAgentsByProvider`, `generateAgentFactsProfile`, `computeTrustScore`, `computeFingerprint`
- [ ] Outcomes: `evaluateOutcome`, `createOutcomeVerification`, `verifyOutcome`, `openDispute`, `resolveDispute`
- [ ] Currency: `convertCurrency`, `formatCurrency`, `getExchangeRate`, `isSupportedCurrency`
- [ ] Compliance: `requestDataExport`, `requestDataDeletion`, `getExportStatus`
- [ ] x402: `verifyExactPayment`, `verifyUptoPayment`, `settleExactPayment`, `generateReceipt`
- [ ] AP2: `getEligiblePaymentMethods`, `provisionCredentials`, `processPayment`, `verifyIntentMandate`, `verifyCartMandate`, `signJwt`, `verifyJwt`
- [ ] Visa TAP: adapter registered and functional
- [ ] RBAC: role-based access control module exists
- [ ] Organizations: multi-tenant module exists

---

## Final Checklist Summary

| Area | Items |
|------|-------|
| Build & Compilation | 7 |
| Marketing -- Homepage | 62 |
| Marketing -- Other Pages | 20 |
| Authentication | 9 |
| Dashboard Overview | 10 |
| Dashboard Pages (10 pages) | 62 |
| Dashboard Nav & Chrome | 16 |
| API Routes -- Public | 42 |
| API Routes -- Developer | 35 |
| API Routes -- Consumer | 17 |
| API Routes -- Billing/Auth | 5 |
| API Routes -- Cron | 5 |
| Dark Mode | 7 |
| Responsive Design | 13 |
| Security Headers | 6 |
| Error Handling | 7 |
| SDK Exports | 17 |
| Database Schema | 48 |
| Settlement Modules | 13 |
| **Total** | **~400** |
