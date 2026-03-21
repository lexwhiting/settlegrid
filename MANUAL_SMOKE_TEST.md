# SettleGrid Manual Smoke Test Guide

> Step-by-step browser tests for everything that automated unit tests cannot verify.
> Run these after every deploy to production (`https://settlegrid.ai`) or locally (`http://localhost:3005`).
>
> **What this covers**: Visual rendering, user interactions, real auth flows, Stripe redirects, dark mode, responsive layout, and end-to-end workflows that require a real browser.
>
> **What this skips**: Module exports, file existence, function signatures, schema definitions, and SDK internals -- all covered by the 832+ automated tests.
>
> **Time estimate**: 45-60 minutes for a full pass.

Replace `BASE` below with your target:
- Production: `https://settlegrid.ai`
- Local dev: `http://localhost:3005`

---

## 1. Marketing Pages (Visual Verification)

### Test 1.1: Homepage Hero Section
**URL**: `BASE/`
**Steps**:
1. Open the homepage
2. Look at the top of the page -- there should be a dark indigo hero section with a gradient mesh background
3. Read the headline -- it should say "The Settlement Layer for the AI Economy"
4. Check for a "Now in Public Beta" badge with a pulsing green dot
5. Verify two buttons are visible: "Start Building" (green) and "Read Docs" (outlined white)
6. Below the buttons, confirm three trust items: "Free tier", "No credit card", "Any AI protocol"
7. Confirm two badges: "Open Source SDK" (GitHub icon) and "@settlegrid/mcp" (npm icon)
8. On the right side, verify a code snippet is visible with a typewriter animation typing out code
**Expected**: Hero renders with gradient background, all text is readable, green dot pulses, code animates
**Status**: [ ] Pass / Fail

### Test 1.2: Homepage Code Snippet Copy Button
**URL**: `BASE/`
**Steps**:
1. Wait for the typewriter animation to finish (about 5 seconds)
2. Click the "Copy" button in the top-right corner of the code snippet
3. Open a text editor and paste
**Expected**: Button text changes to "Copied!" with a checkmark. Pasted text matches the code shown.
**Status**: [ ] Pass / Fail

### Test 1.3: Homepage Scroll Sections
**URL**: `BASE/`
**Steps**:
1. Scroll down slowly through the entire page
2. Verify each section fades in as you scroll to it (scroll reveal animation)
3. Check the following sections appear in order:
   - Protocol logo bar: "One SDK. Every protocol." with 6 protocol names (MCP, x402, AP2, Visa TAP, Stripe, REST)
   - How It Works: 3 numbered steps (Wrap, Buy Credits, Revenue Flows)
   - Core Platform: 6 cards in a grid (Real-Time Metering, Protocol-Agnostic, Multi-Hop Settlement, Agent Identity, Outcome-Based Billing, Enterprise Ready)
   - Built for the AI Economy: 4 code highlight blocks
   - Developer Experience: 18-item checklist in 3 columns
   - Enterprise section: dark indigo background with 8 checkmarks and 4 security badges
   - Comparison Table: 15 rows comparing SettleGrid vs Stripe, Nevermined, Paid.ai
   - Pricing: 4 tiers (Free $0, Builder $29, Scale $99, Platform $299) -- Scale has "Most Popular" badge
   - Final CTA: "Ready to monetize your AI services?"
4. Hover over a Core Platform card -- border should highlight green and shadow should appear
**Expected**: All 10 sections render. Scroll animations fire. Card hover state works.
**Status**: [ ] Pass / Fail

### Test 1.4: Homepage Header and Footer
**URL**: `BASE/`
**Steps**:
1. In the header, verify: SettleGrid logo (left), Marketplace link, Docs link, theme toggle (sun/moon icon), "Log in" link, "Get Started" button (green)
2. Click "Marketplace" -- should go to `/tools`
3. Go back, click "Docs" -- should go to `/docs`
4. Scroll to the footer at the bottom
5. Verify: SettleGrid logo, Marketplace link, Documentation link, Privacy link, Terms link, copyright with current year (2026)
**Expected**: All links work. Copyright says 2026.
**Status**: [ ] Pass / Fail

### Test 1.5: Documentation Page
**URL**: `BASE/docs`
**Steps**:
1. Open the docs page
2. Verify the page loads with documentation content
3. Check that code blocks have syntax highlighting (green keywords, amber strings, gray comments)
4. Scroll through to verify all sections render without broken layout
**Expected**: Page loads, code blocks are syntax-highlighted, no layout breaks
**Status**: [ ] Pass / Fail

### Test 1.6: Privacy Policy Page
**URL**: `BASE/privacy`
**Steps**:
1. Open the privacy page
2. Verify text content renders
3. Scroll to the bottom to confirm the full page loaded
**Expected**: Privacy policy text renders completely
**Status**: [ ] Pass / Fail

### Test 1.7: Terms of Service Page
**URL**: `BASE/terms`
**Steps**:
1. Open the terms page
2. Verify text content renders
3. Scroll to the bottom to confirm the full page loaded
**Expected**: Terms of service text renders completely
**Status**: [ ] Pass / Fail

### Test 1.8: Marketplace / Tools Directory
**URL**: `BASE/tools`
**Steps**:
1. Open the tools page
2. Verify a listing of available tools renders (or an empty state if no tools exist yet)
3. If tools are listed, click on one to go to its detail page (`/tools/[slug]`)
4. On the detail page, verify tool name, description, and pricing information appear
**Expected**: Tools directory loads. Detail page shows tool info.
**Status**: [ ] Pass / Fail

---

## 2. Authentication Flow

### Test 2.1: Register with Email/Password
**URL**: `BASE/register`
**Steps**:
1. Open the register page
2. Verify you see: SettleGrid logo, "Create your account" heading, three trust badges (Free tier, No credit card, 1K ops/month)
3. Verify two OAuth buttons at top: "Continue with Google" and "Continue with GitHub"
4. Below the "or continue with email" divider, enter:
   - Email: `smoketest-YYYYMMDD@example.com` (use today's date)
   - Password: `TestPass123!`
5. Click "Create account"
**Expected**: Page shows "Check your email" confirmation screen with the email address displayed. It tells you to click the confirmation link.
**Status**: [ ] Pass / Fail

### Test 2.2: Register Page Link to Login
**URL**: `BASE/register`
**Steps**:
1. At the bottom of the register form, find "Already have an account? Sign in"
2. Click "Sign in"
**Expected**: Navigates to `/login`
**Status**: [ ] Pass / Fail

### Test 2.3: Login with Email/Password
**URL**: `BASE/login`
**Steps**:
1. Open the login page
2. Verify you see: SettleGrid logo, "Sign in to SettleGrid" heading, "Welcome back" subtitle
3. Verify two OAuth buttons: "Continue with Google" and "Continue with GitHub"
4. Below the "or continue with email" divider, enter your registered email and password
5. Click "Sign in"
**Expected**: Redirects to `/dashboard`. If credentials are wrong, a red error banner appears.
**Status**: [ ] Pass / Fail

### Test 2.4: Login with Google OAuth
**URL**: `BASE/login`
**Steps**:
1. Click "Continue with Google"
**Expected**: Browser redirects to Google's OAuth consent screen. After granting access, you are redirected back to `/auth/callback` and then to `/dashboard`.
**Status**: [ ] Pass / Fail

### Test 2.5: Login with GitHub OAuth
**URL**: `BASE/login`
**Steps**:
1. Click "Continue with GitHub"
**Expected**: Browser redirects to GitHub's OAuth authorization page. After granting access, you are redirected back to `/auth/callback` and then to `/dashboard`.
**Status**: [ ] Pass / Fail

### Test 2.6: Forgot Password Flow
**URL**: `BASE/login`
**Steps**:
1. Enter your email address in the email field
2. Click "Forgot password?" (small link to the right of the Password label)
**Expected**: A green banner appears saying "Password reset link sent to [your email]. Check your inbox." The link text briefly shows "Sending..." while processing.
**Status**: [ ] Pass / Fail

### Test 2.7: Sign Out
**URL**: `BASE/dashboard` (must be logged in)
**Steps**:
1. In the sidebar at the bottom-left, find your user avatar (circle with your first initial)
2. Click the avatar -- a dropdown menu appears showing your email
3. Click "Sign out"
**Expected**: You are redirected to `/login`. Visiting `/dashboard` now redirects you back to `/login`.
**Status**: [ ] Pass / Fail

### Test 2.8: Protected Route Redirect
**URL**: `BASE/dashboard` (must be logged out)
**Steps**:
1. Make sure you are logged out (clear cookies or use incognito)
2. Try to visit `BASE/dashboard` directly
**Expected**: You are redirected to `/login?redirect=/dashboard`
**Status**: [ ] Pass / Fail

### Test 2.9: Logged-In User Redirect from Auth Pages
**URL**: `BASE/login` (must be logged in)
**Steps**:
1. Log in successfully
2. Try to visit `BASE/login` directly
3. Try to visit `BASE/register` directly
**Expected**: Both redirect you to `/dashboard` automatically
**Status**: [ ] Pass / Fail

---

## 3. Dashboard (Developer)

### Test 3.1: Dashboard Overview Page
**URL**: `BASE/dashboard` (must be logged in)
**Steps**:
1. Verify the page loads with "Dashboard" heading
2. Check for a green pulsing live indicator next to the heading
3. Verify 4 stat cards: Total Revenue, Total Invocations, Active Tools, Revenue (24h)
4. Check the period selector buttons (7d / 30d / 90d) in the top-right -- click each one
5. If you have data: verify the "Invocations (Last 24 Hours)" bar chart renders
6. If you have data: verify the "Revenue Trend (Last 30 Days)" area chart renders
7. If you have NO tools: verify an onboarding prompt appears with "Welcome! Create your first tool" and a "Create Tool" button
**Expected**: Page loads with stat cards and charts. Period selector changes the active button. Onboarding shows for new accounts.
**Status**: [ ] Pass / Fail

### Test 3.2: Create a Tool
**URL**: `BASE/dashboard/tools` (must be logged in)
**Steps**:
1. Navigate to Tools in the sidebar
2. Verify breadcrumbs show "Dashboard > Tools"
3. Click "New Tool" button (top-right)
4. A creation form appears. Fill in:
   - Name: `Smoke Test Tool`
   - Slug: `smoke-test-tool` (lowercase letters, numbers, hyphens only)
   - Description: `A test tool created during smoke testing`
   - Default Cost (cents): `5`
5. Click "Create Tool"
**Expected**: Form disappears. The new tool appears in the tools list with status "draft", showing its name, slug, 0 invocations, and $0.05/call pricing.
**Status**: [ ] Pass / Fail

### Test 3.3: Activate and Deactivate a Tool
**URL**: `BASE/dashboard/tools` (must have at least one tool)
**Steps**:
1. Find your tool in the list
2. Click "Activate" button on the right
3. Verify the status badge changes from "draft" to "active" (green)
4. Click "Deactivate" button
5. Verify the status badge changes back to "draft"
**Expected**: Status toggles between active and draft each time you click
**Status**: [ ] Pass / Fail

### Test 3.4: View Tool in Marketplace
**URL**: `BASE/dashboard/tools` (must have an active tool)
**Steps**:
1. Find your tool in the list
2. Click "View" button
**Expected**: Navigates to `/tools/[your-tool-slug]` showing the public tool page
**Status**: [ ] Pass / Fail

### Test 3.5: Analytics Page
**URL**: `BASE/dashboard/analytics` (must be logged in)
**Steps**:
1. Click "Analytics" in the sidebar
2. Verify the page loads with a time range selector (7d / 30d / 90d)
3. If you have usage data: verify charts and summary tables render
4. If no data: verify an appropriate empty state or "no data" message appears
**Expected**: Page loads without errors. Time range buttons are interactive.
**Status**: [ ] Pass / Fail

### Test 3.6: Settings Page and Profile
**URL**: `BASE/dashboard/settings` (must be logged in)
**Steps**:
1. Click "Settings" in the sidebar
2. Verify breadcrumbs show "Dashboard > Settings"
3. Verify the "Profile" card shows: Name, Email, Balance, Payout Schedule, Payout Minimum, Member Since
4. Verify the "Stripe Connect" card shows a connection status badge
**Expected**: Profile information displays correctly. Stripe status shows "Not Connected", "Pending", or "Connected".
**Status**: [ ] Pass / Fail

### Test 3.7: Stripe Connect Button
**URL**: `BASE/dashboard/settings` (Stripe must NOT be connected yet)
**Steps**:
1. On the Settings page, find the "Stripe Connect" card
2. Click "Connect Stripe"
**Expected**: Browser redirects to Stripe's Connect onboarding flow. (You do NOT need to complete Stripe onboarding -- just verify the redirect works.)
**Status**: [ ] Pass / Fail

### Test 3.8: Webhooks -- Create Endpoint
**URL**: `BASE/dashboard/webhooks` (must be logged in)
**Steps**:
1. Click "Webhooks" in the sidebar
2. If no endpoints exist, verify the empty state with "No webhook endpoints" message
3. Click "Add Endpoint"
4. In the form:
   - Endpoint URL: `https://httpbin.org/post`
   - Check at least 2 events: `invocation.completed` and `credit.purchased`
5. Click "Create Endpoint"
**Expected**: Form closes. The new endpoint appears in the list showing the URL, a green "active" badge, and the selected event badges.
**Status**: [ ] Pass / Fail

### Test 3.9: Webhooks -- View Deliveries
**URL**: `BASE/dashboard/webhooks` (must have at least one endpoint)
**Steps**:
1. Find your webhook endpoint in the list
2. Click "Deliveries" button
3. A panel expands below showing "Recent Deliveries"
4. Click "Hide" to collapse it
**Expected**: Delivery panel toggles open/closed. Shows deliveries if any exist, or "No deliveries yet."
**Status**: [ ] Pass / Fail

### Test 3.10: Webhooks -- Delete Endpoint
**URL**: `BASE/dashboard/webhooks` (must have at least one endpoint)
**Steps**:
1. Find your test webhook endpoint
2. Click "Delete" (red button)
**Expected**: Endpoint disappears from the list
**Status**: [ ] Pass / Fail

### Test 3.11: Referrals -- Create Referral Link
**URL**: `BASE/dashboard/referrals` (must be logged in, must have at least one active tool)
**Steps**:
1. Click "Referrals" in the sidebar
2. Verify 4 stat cards: Total Referrals, Active Referrals, Total Earnings, This Month
3. Click "New Referral"
4. Select a tool from the dropdown
5. Set commission to `10` percent
6. Click "Create Referral"
**Expected**: A new referral appears in the table with a unique referral code, the tool name, 10% commission, $0.00 earned, and "active" status.
**Status**: [ ] Pass / Fail

### Test 3.12: Referrals -- Copy Code
**URL**: `BASE/dashboard/referrals` (must have at least one referral)
**Steps**:
1. In the referrals table, find the "Copy" button in the Actions column
2. Click "Copy"
**Expected**: Button text briefly changes to "Copied!". Pasting into a text editor shows the referral code.
**Status**: [ ] Pass / Fail

### Test 3.13: Payouts Page
**URL**: `BASE/dashboard/payouts` (must be logged in)
**Steps**:
1. Click "Payouts" in the sidebar
2. Verify the "Request Payout" button is visible in the top-right
3. If no payouts exist: verify the empty state message about $25 minimum threshold
4. If payouts exist: verify the table shows Date, Period, Amount, Platform Fee, Status columns
**Expected**: Page loads with either payout history table or empty state
**Status**: [ ] Pass / Fail

### Test 3.14: Audit Log Page with Filters
**URL**: `BASE/dashboard/audit-log` (must be logged in)
**Steps**:
1. Click "Audit Log" in the sidebar
2. Verify filter dropdowns appear for Action Type and Resource Type
3. Change the Action Type filter to something specific (e.g., "tool.created")
4. Change the Resource Type filter (e.g., "tool")
5. Look for a "CSV Export" button
**Expected**: Page loads with audit entries (or empty state). Filters change the displayed entries. Export button is present.
**Status**: [ ] Pass / Fail

### Test 3.15: Health Page
**URL**: `BASE/dashboard/health` (must be logged in)
**Steps**:
1. Click "Health" in the sidebar
2. Verify the page loads showing tool health status information
**Expected**: Page loads without errors, showing health data or empty state
**Status**: [ ] Pass / Fail

### Test 3.16: Fraud Page
**URL**: `BASE/dashboard/fraud` (must be logged in)
**Steps**:
1. Click "Fraud" in the sidebar (shield icon)
2. Verify the page loads showing fraud detection information
**Expected**: Page loads without errors
**Status**: [ ] Pass / Fail

### Test 3.17: Reputation Page
**URL**: `BASE/dashboard/reputation` (must be logged in)
**Steps**:
1. Click "Reputation" in the sidebar (star icon)
2. Verify the page loads showing your developer reputation score or breakdown
**Expected**: Page loads without errors
**Status**: [ ] Pass / Fail

---

## 4. Consumer Dashboard

### Test 4.1: Consumer Dashboard Overview
**URL**: `BASE/consumer` (must be logged in)
**Steps**:
1. Navigate to the consumer dashboard (via command palette or direct URL)
2. Verify "Consumer Dashboard" heading appears
3. Check for three card sections: Credit Balances, Budget Controls, API Keys
4. If no data: verify appropriate empty messages in each section
**Expected**: Page loads with three main sections
**Status**: [ ] Pass / Fail

### Test 4.2: API Key Management
**URL**: `BASE/consumer` (must have at least one API key)
**Steps**:
1. In the "API Keys" section, find a key showing its prefix (e.g., `sk_live_abc...`)
2. Verify the status badge shows "active" (green)
3. Verify "Last used" and "Created" dates are shown
4. Click "Revoke" (red button) on the key
**Expected**: Key disappears from the list (or status changes to revoked)
**Status**: [ ] Pass / Fail

### Test 4.3: Budget Controls
**URL**: `BASE/consumer` (must have budgets configured)
**Steps**:
1. In the "Budget Controls" section, find a tool with a budget limit
2. Verify you see: Limit amount, Period (daily/weekly/monthly), Alert threshold (%), Current Spend
3. Verify a progress bar shows below the budget details
4. Click "Edit" to modify the budget
5. Change the spending limit to a new value
6. Click "Save Budget"
**Expected**: Edit form expands with three fields (Limit, Period, Alert %). After saving, the new values display.
**Status**: [ ] Pass / Fail

### Test 4.4: IP Restriction Management
**URL**: `BASE/consumer` (must have at least one active API key)
**Steps**:
1. In the "API Keys" section, find an active key
2. Below the key details, find the "IP Allowlist" section
3. Click "+ Add IP"
4. Enter: `192.168.1.0/24`
5. Click "Add"
6. Verify the IP appears as a tag/chip
7. Click the X button on the IP tag to remove it
**Expected**: IP is added as a rounded tag. Clicking X removes it. "No IP restrictions" text appears when empty.
**Status**: [ ] Pass / Fail

---

## 5. Interactive Features

### Test 5.1: Dark Mode Toggle
**URL**: `BASE/`
**Steps**:
1. On the homepage, find the theme toggle in the header (sun/moon icon)
2. Click it to switch to dark mode
3. Verify: background becomes dark, text becomes light, header/footer adapt, hero section stays dark
4. Click it again to switch back to light mode
5. Navigate to `/dashboard` -- verify the dashboard also respects the chosen theme
6. In the dashboard, find the theme toggle in the top bar (desktop) or sidebar (mobile)
**Expected**: Theme switches instantly everywhere. No white flash on page load in dark mode. All text remains readable.
**Status**: [ ] Pass / Fail

### Test 5.2: Command Palette
**URL**: `BASE/dashboard` (must be logged in)
**Steps**:
1. Press `Cmd+K` (Mac) or `Ctrl+K` (Windows/Linux)
2. Verify a modal appears with a search input and two groups: "Navigation" and "Actions"
3. Type "tools" in the search box
4. Verify the results filter to show "Tools" under Navigation and "Create Tool" under Actions
5. Click "Tools" or press Enter
6. Verify you navigate to `/dashboard/tools`
7. Open the palette again, press `Escape`
**Expected**: Palette opens with keyboard shortcut, filters results as you type, navigates on selection, closes on Escape
**Status**: [ ] Pass / Fail

### Test 5.3: Command Palette from Desktop Top Bar
**URL**: `BASE/dashboard` (must be logged in, desktop width)
**Steps**:
1. In the top bar of the dashboard, find the "Search..." button with the keyboard shortcut hint
2. Click it
**Expected**: Command palette opens (same as Cmd+K)
**Status**: [ ] Pass / Fail

### Test 5.4: Sidebar Collapse/Expand
**URL**: `BASE/dashboard` (must be logged in, desktop width)
**Steps**:
1. At the bottom of the sidebar (just above your user avatar), find the chevron arrow
2. Click it to collapse the sidebar
3. Verify: sidebar shrinks to icon-only width, text labels disappear, only icons remain
4. Hover over an icon -- verify a tooltip shows the page name
5. Click the chevron again to expand
6. Refresh the page -- verify the sidebar remembers its collapsed/expanded state
**Expected**: Sidebar toggles between full and icon-only. State persists across page refreshes (stored in cookie).
**Status**: [ ] Pass / Fail

### Test 5.5: Help Chat Widget
**URL**: `BASE/dashboard` (must be logged in)
**Steps**:
1. In the bottom-right corner, find the green floating chat bubble (speech bubble icon)
2. Click it -- a chat panel slides up
3. Verify the header says "SettleGrid Help" with "AI-powered support"
4. Verify context-aware suggestions appear (the suggestions change based on which dashboard page you are on)
5. Click one of the suggestion buttons (e.g., "How do I create my first tool?")
6. Verify an AI response starts streaming in
7. Type a custom question in the input box and press Enter or click the send button
8. Press Escape to close the chat
9. Click the floating button again to reopen -- verify your conversation history is still there
**Expected**: Chat opens/closes smoothly. Suggestions are clickable. AI responds with relevant text. History persists within the session.
**Status**: [ ] Pass / Fail

### Test 5.6: Help Chat -- Email Support Form
**URL**: `BASE/dashboard` (with help chat open)
**Steps**:
1. Open the help chat widget
2. At the bottom of the chat panel, click "Prefer email? Contact our support team"
3. Verify a contact form appears with fields: Name, Email, Subject, Message
4. Click "Back to chat" at the top to return to the chat view
5. Go back to the contact form, fill in:
   - Name: `Smoke Tester`
   - Email: `smoketest@example.com`
   - Subject: `Smoke test`
   - Message: `This is a smoke test of the contact form.`
6. Click "Send Message"
**Expected**: Form submits and shows "Message sent!" confirmation with "We'll respond within 24 hours." A "Back to chat" link appears.
**Status**: [ ] Pass / Fail

### Test 5.7: Sidebar Active Page Highlight
**URL**: `BASE/dashboard` (must be logged in)
**Steps**:
1. Click through several sidebar items: Overview, Tools, Analytics, Settings
2. For each page, verify the current page's sidebar item is highlighted (white text with lighter background) while others are dimmed
**Expected**: Active sidebar item is visually distinct on every page
**Status**: [ ] Pass / Fail

### Test 5.8: Homepage Typewriter Effect
**URL**: `BASE/`
**Steps**:
1. Open the homepage in a fresh browser tab (or hard refresh)
2. Watch the code snippet in the hero section
3. Verify code types out character by character with a pulsing green cursor
4. Wait for the animation to complete -- the cursor should disappear and full syntax highlighting should apply
**Expected**: Characters appear progressively. Cursor blinks during typing and disappears when done. Colors appear on keywords after completion.
**Status**: [ ] Pass / Fail

---

## 6. Responsive Design

### Test 6.1: Homepage on Mobile (375px)
**URL**: `BASE/`
**Steps**:
1. Open browser DevTools (F12) and toggle device toolbar
2. Set width to 375px (iPhone SE)
3. Verify:
   - Hero content stacks vertically (text above, code snippet below)
   - Header hides "Marketplace" and "Docs" links but keeps "Get Started" button
   - Protocol logo bar wraps to multiple lines
   - How It Works cards stack to single column
   - Core Platform cards stack to single column
   - Pricing cards stack vertically
   - Comparison table scrolls horizontally (swipe left/right)
   - Footer links wrap gracefully
**Expected**: All content is readable. Nothing overflows. Horizontal scroll only on the comparison table.
**Status**: [ ] Pass / Fail

### Test 6.2: Dashboard on Mobile (375px)
**URL**: `BASE/dashboard` (must be logged in)
**Steps**:
1. Set browser width to 375px
2. Verify the sidebar is hidden and a hamburger menu icon appears at the top
3. Tap the hamburger icon -- sidebar slides in from the left
4. Verify a dark overlay covers the main content
5. Tap a menu item -- sidebar closes and page navigates
6. Tap the overlay -- sidebar closes
7. Verify stat cards stack vertically
8. Verify tables scroll horizontally
**Expected**: Mobile sidebar works as a slide-out drawer. Content stacks vertically. Tables don't break the layout.
**Status**: [ ] Pass / Fail

### Test 6.3: Login/Register on Mobile (375px)
**URL**: `BASE/login`
**Steps**:
1. Set browser width to 375px
2. Open `/login` -- verify the form is centered and fully visible
3. Verify OAuth buttons are full-width
4. Verify input fields and submit button are not cut off
5. Check `/register` -- same verification
**Expected**: Auth forms are fully usable on mobile without horizontal scrolling
**Status**: [ ] Pass / Fail

---

## 7. Email Delivery

### Test 7.1: Contact Form Email
**URL**: `BASE/dashboard` (help chat widget)
**Steps**:
1. Open the help chat widget
2. Click "Prefer email? Contact our support team"
3. Fill in the form with a real email address you can check
4. Click "Send Message"
5. Check the support inbox (`support@settlegrid.ai`) for the incoming message
6. Check your own email for any auto-response
**Expected**: Email arrives at the support address with the submitted details. (Auto-response depends on whether Resend is configured to send one.)
**Status**: [ ] Pass / Fail

### Test 7.2: Password Reset Email
**URL**: `BASE/login`
**Steps**:
1. Enter a real registered email address
2. Click "Forgot password?"
3. Check your email inbox for the reset link
4. Click the link in the email
**Expected**: Reset email arrives within 1-2 minutes. Link redirects to the app to complete the password reset.
**Status**: [ ] Pass / Fail

---

## 8. API Endpoints (Browser/cURL)

### Test 8.1: Health Endpoint
**URL**: `BASE/api/health`
**Steps**:
1. Open this URL in your browser (or run: `curl BASE/api/health`)
**Expected**: JSON response with `"status": "healthy"` (or "degraded"), a `timestamp`, and `components` showing database and redis status with latency in milliseconds
**Status**: [ ] Pass / Fail

### Test 8.2: x402 Supported Endpoint
**URL**: `BASE/api/x402/supported`
**Steps**:
1. Open this URL in your browser
**Expected**: JSON response with facilitator information for the x402 payment protocol
**Status**: [ ] Pass / Fail

### Test 8.3: AP2 Agent Card
**URL**: `BASE/api/a2a`
**Steps**:
1. Open this URL in your browser
**Expected**: JSON response with an AP2 agent card containing agent identity and capability information
**Status**: [ ] Pass / Fail

### Test 8.4: OpenAPI Specification
**URL**: `BASE/api/openapi.json`
**Steps**:
1. Open this URL in your browser
**Expected**: JSON response with a valid OpenAPI 3.x specification document describing all SettleGrid API endpoints
**Status**: [ ] Pass / Fail

---

## 9. Security

### Test 9.1: Dashboard Requires Auth
**URL**: `BASE/dashboard` (must be logged out)
**Steps**:
1. Open an incognito/private browser window
2. Navigate to `BASE/dashboard`
**Expected**: Redirects to `/login?redirect=/dashboard` -- you are NOT shown the dashboard content
**Status**: [ ] Pass / Fail

### Test 9.2: API Requires Auth
**Steps**:
1. Run in terminal: `curl -s BASE/api/tools`
2. Run in terminal: `curl -s BASE/api/dashboard/developer/stats`
**Expected**: Both return a 401 response with an error message (not tool data)
**Status**: [ ] Pass / Fail

### Test 9.3: Cron Requires Secret
**Steps**:
1. Run in terminal: `curl -s -X POST BASE/api/cron/health-checks`
**Expected**: Returns 401 (Unauthorized) because no `CRON_SECRET` header was provided
**Status**: [ ] Pass / Fail

### Test 9.4: Security Headers Present
**Steps**:
1. Run in terminal: `curl -sI BASE/`
2. Check the response headers
**Expected**: The following headers are present:
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- `Content-Security-Policy` (contains `default-src 'self'`)
- `Strict-Transport-Security: max-age=31536000; includeSubDomains`
**Status**: [ ] Pass / Fail

### Test 9.5: 404 Page
**URL**: `BASE/this-page-does-not-exist`
**Steps**:
1. Navigate to a URL that does not exist
**Expected**: A custom 404 page renders (not a browser default error). Page includes SettleGrid branding.
**Status**: [ ] Pass / Fail

---

## Results Summary

| Section | Tests | Pass | Fail |
|---------|-------|------|------|
| 1. Marketing Pages | 8 | | |
| 2. Authentication | 9 | | |
| 3. Dashboard (Developer) | 17 | | |
| 4. Consumer Dashboard | 4 | | |
| 5. Interactive Features | 8 | | |
| 6. Responsive Design | 3 | | |
| 7. Email Delivery | 2 | | |
| 8. API Endpoints | 4 | | |
| 9. Security | 5 | | |
| **Total** | **60** | | |

**Tested by**: _______________
**Date**: _______________
**Environment**: [ ] Production (`settlegrid.ai`) / [ ] Local (`localhost:3005`)
**Browser**: _______________
**Notes**:

---

## Appendix: Quick Reference

### Sidebar Navigation Items (11 total)
1. Overview (`/dashboard`)
2. Tools (`/dashboard/tools`)
3. Analytics (`/dashboard/analytics`)
4. Health (`/dashboard/health`)
5. Payouts (`/dashboard/payouts`)
6. Referrals (`/dashboard/referrals`)
7. Fraud (`/dashboard/fraud`)
8. Reputation (`/dashboard/reputation`)
9. Webhooks (`/dashboard/webhooks`)
10. Audit Log (`/dashboard/audit-log`)
11. Settings (`/dashboard/settings`)

### Command Palette Items (18 total)
**Navigation**: Dashboard, Tools, Analytics, Health, Payouts, Referrals, Fraud Detection, Reputation, Webhooks, Audit Log, Settings, Consumer Dashboard, Marketplace, Documentation
**Actions**: Create Tool, Add Webhook, Export Audit Log, Request Payout

### Webhook Event Types (10 total)
`invocation.completed`, `invocation.failed`, `credit.purchased`, `credit.depleted`, `payout.completed`, `payout.failed`, `tool.activated`, `tool.deactivated`, `key.created`, `key.revoked`
