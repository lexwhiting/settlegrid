# SettleGrid — Comprehensive Smoke Test Guide

> This guide targets **production** at `https://settlegrid.ai`. All test URLs point to the live `.ai` domain.

## Production Testing

You only need valid test credentials to run these smoke tests against production. No local setup required.

| Field | Value |
|-------|-------|
| Email | `lexwhiting@gmail.com` |
| Password | `You@r3enough!` |
| Role | Developer (enterprise tier) |
| Revenue Share | 90% |

---

<details>
<summary><strong>Local Development Setup</strong> (optional — for running against localhost)</summary>

### 1. Environment Setup
```bash
cp apps/web/.env.example apps/web/.env.local
# Fill in all required values:
#   DATABASE_URL, JWT_SECRET, REDIS_URL, STRIPE_SECRET_KEY,
#   STRIPE_CONNECT_CLIENT_ID, STRIPE_WEBHOOK_SECRET,
#   RESEND_API_KEY, NEXT_PUBLIC_APP_URL
```

### 2. Database
```bash
# Start local Postgres (Docker)
docker run -d --name settlegrid-pg -p 5433:5432 \
  -e POSTGRES_DB=settlegrid -e POSTGRES_PASSWORD=postgres \
  postgres:16

# Push schema
pnpm -F web exec drizzle-kit push
```

### 3. Redis
```bash
docker run -d --name settlegrid-redis -p 6380:6379 redis:7
```

### 4. Seed Admin Account
```bash
SEED_PASSWORD='You@r3enough!' pnpm -F web exec tsx scripts/seed-admin.ts
```

### 5. Start Dev Server
```bash
pnpm dev --filter web   # → http://localhost:3005
```

</details>

---

## Phase 1: Authentication & Access Control

### 1.1 Gate Access
- [ ] Visit `https://settlegrid.ai` — gate page or marketing page loads
- [ ] If gated: enter gate password → marketing page renders

### 1.2 Developer Registration
- [ ] Click "Get Started" → developer registration page
- [ ] Fill in: name, email, password
- [ ] Submit → redirected to developer dashboard
- [ ] Verify: sidebar shows developer name

### 1.3 Consumer Registration
- [ ] Visit `/register` → consumer registration page
- [ ] Fill in: email, password
- [ ] Submit → redirected to consumer dashboard

### 1.4 Login (seeded account)
- [ ] Navigate to `/login`
- [ ] Enter `lexwhiting@gmail.com` / `You@r3enough!`
- [ ] Submit → redirected to developer dashboard
- [ ] Verify: "Enterprise" tier badge visible

### 1.5 Session Persistence
- [ ] Refresh page → still logged in
- [ ] DevTools > Cookies → `sg-token` exists (httpOnly)

### 1.6 Logout
- [ ] Click logout → redirected to login
- [ ] Visit `/dashboard` → redirected to login

---

## Phase 2: Developer Dashboard

### 2.1 Overview
- [ ] Dashboard loads with revenue/usage cards
- [ ] Charts render (if data exists)
- [ ] "Create Tool" CTA visible

### 2.2 Navigation
- [ ] All sidebar links work:
  - [ ] Dashboard
  - [ ] Tools (My Tools)
  - [ ] Analytics
  - [ ] Payouts
  - [ ] Webhooks
  - [ ] API Keys
  - [ ] Settings
  - [ ] Docs

---

## Phase 3: Tool Management

### 3.1 Create Tool
- [ ] Navigate to Tools → "Create Tool"
- [ ] Fill in:
  - Name: "AI Text Summarizer"
  - Description: "Summarize documents using AI"
  - Category: "AI/ML"
  - Pricing: $0.01 per invocation
- [ ] Submit → tool appears in "My Tools" list

### 3.2 Tool Details
- [ ] Click on created tool
- [ ] Details page shows: name, description, pricing, status
- [ ] "Publish" button available (draft → published)
- [ ] SDK integration code snippet shown

### 3.3 Tool Configuration
- [ ] Edit tool name/description → changes saved
- [ ] Update pricing → new price reflected
- [ ] Add health check endpoint → saved

### 3.4 Tool Changelog
- [ ] Add changelog entry (version, description)
- [ ] Entry appears in changelog list

---

## Phase 4: SDK Integration

### 4.1 Install SDK
```bash
npm install @settlegrid/mcp
```

### 4.2 Initialize SDK
```typescript
import { SettleGrid } from '@settlegrid/mcp';

const sg = SettleGrid.init({
  apiKey: 'your-api-key',
  toolId: 'your-tool-id',
});
```

### 4.3 Wrap Tool Function
```typescript
const summarize = sg.wrap('summarize', async (text: string) => {
  // Your AI logic here
  return { summary: "..." };
});

// Each call automatically deducts credits
const result = await summarize("Long document text...");
```

### 4.4 Validate Key
```bash
curl -s https://settlegrid.ai/api/sdk/validate-key \
  -X POST -H "Content-Type: application/json" \
  -d '{"apiKey":"sg_...","toolId":"tool-uuid"}' | jq .
```
- [ ] Valid key → `{ valid: true, consumerId: "..." }`
- [ ] Invalid key → `{ valid: false, reason: "..." }`

### 4.5 Meter Usage
```bash
curl -s https://settlegrid.ai/api/sdk/meter \
  -X POST -H "Content-Type: application/json" \
  -d '{"apiKey":"sg_...","toolId":"tool-uuid","method":"summarize"}' | jq .
```
- [ ] Sufficient balance → `{ allowed: true, remaining: N }`
- [ ] Insufficient balance → `{ allowed: false, reason: "INSUFFICIENT_BALANCE" }`

---

## Phase 5: Consumer Experience

### 5.1 Tool Marketplace
- [ ] Visit `/tools` → marketplace page loads
- [ ] Published tools listed with name, description, pricing
- [ ] Search/filter functionality works
- [ ] Early access waitlist form collects emails

### 5.2 Tool Storefront
- [ ] Click on a tool → storefront page loads
- [ ] Shows: description, pricing, reviews, changelog
- [ ] "Get API Key" or "Purchase Credits" CTA visible

### 5.3 Purchase Credits
- [ ] Click "Purchase Credits"
- [ ] Select credit amount
- [ ] Redirected to Stripe Checkout (or test page)
- [ ] After payment: balance updated in consumer dashboard

### 5.4 Consumer API Keys
- [ ] Generate API key for a tool
- [ ] Key shown once → copy it
- [ ] Key appears in consumer API keys list
- [ ] Key works with SDK validate-key endpoint

---

## Phase 6: Billing & Payouts

### 6.1 Stripe Connect (Developer)
- [ ] Navigate to Settings → "Connect Stripe"
- [ ] Redirected to Stripe Connect onboarding
- [ ] After connecting: status shows "Active"

### 6.2 Revenue Dashboard
- [ ] Analytics page shows revenue chart
- [ ] Per-tool revenue breakdown
- [ ] Revenue share percentage displayed (enterprise: 90%)

### 6.3 Payouts
- [ ] Navigate to Payouts
- [ ] Payout history table renders
- [ ] Pending payout amount shown
- [ ] "Request Payout" button (if above minimum threshold $25)

### 6.4 Consumer Billing
- [ ] Consumer dashboard shows balance per tool
- [ ] Purchase history table renders
- [ ] Auto-refill configuration available (if enabled)

---

## Phase 7: Webhooks & Events

### 7.1 Create Webhook Endpoint
- [ ] Navigate to Webhooks → "Add Endpoint"
- [ ] Enter HTTPS URL
- [ ] Select event types (invocation.completed, purchase.completed, etc.)
- [ ] Submit → endpoint listed

### 7.2 SSRF Protection
- [ ] Try `https://localhost` → rejected
- [ ] Try `https://10.0.0.1` → rejected
- [ ] Try `https://169.254.169.254` → rejected (AWS metadata)
- [ ] Valid external HTTPS URL → accepted

### 7.3 Webhook Delivery
- [ ] Trigger an event (purchase, invocation)
- [ ] Webhook delivery logged in deliveries table
- [ ] HMAC-SHA256 signature in `x-settlegrid-signature` header
- [ ] Retry logic for failed deliveries

### 7.4 Test Webhook
- [ ] Click "Send Test" on endpoint → test payload delivered
- [ ] Verify delivery status (success/failure)

---

## Phase 8: Health Checks

### 8.1 Tool Health Monitoring
- [ ] Add health endpoint URL to tool configuration
- [ ] Health check cron runs (every 5 minutes)
- [ ] Status: "Healthy" (green) / "Degraded" (amber) / "Down" (red)
- [ ] Response time tracked

### 8.2 Health Dashboard
- [ ] Analytics shows uptime percentage
- [ ] Health check history graph

---

## Phase 9: Developer Profiles & Reviews

### 9.1 Public Profile
- [ ] Enable public profile in Settings
- [ ] Add bio and avatar URL
- [ ] Profile page accessible at `/developers/[id]`

### 9.2 Tool Reviews
- [ ] As consumer: leave review on tool (1-5 stars, comment)
- [ ] Review appears on tool storefront
- [ ] Developer reputation score updates

---

## Phase 10: Alerts & Notifications

### 10.1 Consumer Alerts
- [ ] Configure low balance alert threshold
- [ ] When balance drops below threshold → alert email sent
- [ ] Alert visible in consumer dashboard

### 10.2 Budget Controls
- [ ] Set spending limit on consumer-tool balance
- [ ] Exceed budget → `BUDGET_EXCEEDED` response on meter calls
- [ ] Budget period resets correctly

---

## Phase 11: Audit Log

### 11.1 View Audit Trail
- [ ] Navigate to Audit Log (developer dashboard)
- [ ] Actions logged: tool creation, key generation, webhook config
- [ ] Each entry: timestamp, action, resource type, details

### 11.2 Export
- [ ] Export audit log as CSV
- [ ] CSV contains all columns, properly escaped

---

## Phase 12: Documentation

### 12.1 Docs Page
- [ ] Visit `/docs` → documentation page loads
- [ ] SDK installation instructions
- [ ] Code examples for init, wrap, validate-key, meter
- [ ] API reference with endpoint descriptions

---

## Phase 13: Settings & Configuration

### 13.1 Developer Settings
- [ ] Update name → saved
- [ ] Update email → saved (unique constraint enforced)
- [ ] Change password → saved (bcrypt rehash)

### 13.2 Sandbox Mode
- [ ] Enable sandbox mode for a tool
- [ ] SDK calls in sandbox don't deduct real credits
- [ ] Sandbox invocations logged separately

---

## Phase 14: Error Handling & Edge Cases

### 14.1 Invalid Input
- [ ] Submit empty tool creation form → validation errors
- [ ] Invalid email format → Zod error
- [ ] Short password (< 8 chars) → validation error

### 14.2 Rate Limiting
- [ ] Rapidly submit login 6+ times → 429 response
- [ ] SDK rate limits per tier enforced (free: 100/min, enterprise: 10,000/min)

### 14.3 Unauthorized Access
- [ ] Clear cookies → visit `/dashboard` → redirected to login
- [ ] Consumer tries developer endpoint → 403
- [ ] Invalid API key → 401

### 14.4 Error Pages
- [ ] Visit `/nonexistent` → 404 page
- [ ] Error boundaries show friendly messages (no stack traces)

---

## Phase 15: Performance & UX

### 15.1 Page Load
- [ ] Dashboard loads in < 2 seconds
- [ ] Skeleton loaders visible during data fetch
- [ ] No layout shift

### 15.2 Responsive Design
- [ ] Mobile width → sidebar collapses to hamburger
- [ ] Tables scroll horizontally
- [ ] Forms usable on mobile

### 15.3 Accessibility
- [ ] Tab navigation works on all interactive elements
- [ ] Focus indicators visible
- [ ] Form labels present (visible or sr-only)
- [ ] WCAG AA contrast ratios met

### 15.4 Brand Consistency
- [ ] SettleGrid logo (Emerald Green #10B981) in sidebar
- [ ] Outfit typeface throughout
- [ ] Consistent button/card styling

---

## Phase 16: API Direct Testing

### 16.1 Developer Auth
```bash
# Login
TOKEN=$(curl -s https://settlegrid.ai/api/auth/developer/login \
  -X POST -H "Content-Type: application/json" \
  -d '{"email":"lexwhiting@gmail.com","password":"You@r3enough!"}' \
  | jq -r '.data.token')

# Get profile
curl -s https://settlegrid.ai/api/auth/developer/me \
  -H "Cookie: sg-token=$TOKEN" | jq .
```

### 16.2 Tool CRUD
```bash
# Create tool
curl -s https://settlegrid.ai/api/tools \
  -X POST -H "Cookie: sg-token=$TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Tool","description":"A test","category":"AI/ML","priceCentsPerCall":1}' | jq .

# List tools
curl -s https://settlegrid.ai/api/tools \
  -H "Cookie: sg-token=$TOKEN" | jq .
```

### 16.3 Health Check
```bash
curl -s https://settlegrid.ai/api/health | jq .
# Expected: { "data": { "status": "ok" } }
```

---

## Verification Checklist Summary

| Category | Tests | Status |
|----------|-------|--------|
| Authentication | 6 | |
| Developer Dashboard | 2 | |
| Tool Management | 4 | |
| SDK Integration | 5 | |
| Consumer Experience | 4 | |
| Billing & Payouts | 4 | |
| Webhooks & Events | 4 | |
| Health Checks | 2 | |
| Profiles & Reviews | 2 | |
| Alerts & Notifications | 2 | |
| Audit Log | 2 | |
| Documentation | 1 | |
| Settings | 2 | |
| Error Handling | 4 | |
| Performance & UX | 4 | |
| API Direct Testing | 3 | |
| **Total** | **51** | |
