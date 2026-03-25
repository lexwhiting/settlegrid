# SettleGrid Review Content Policy & Moderation System: Implementation Plan

Research synthesis from 8 market-dominating platforms — Apple App Store, Google Play, Amazon, Trustpilot, Shopify App Store, Yelp, G2/Capterra, and WordPress Plugin Directory — distilled into an actionable plan for SettleGrid.

---

## Part 1: Cross-Platform Research Findings

### 1. Apple App Store

**Content policy:**
- Two-tier review: automated scan + human review before publication.
- Apps with user-generated content must provide: objectionable material filter, reporting mechanism, user blocking, and published support contact.
- Content must not be offensive, insensitive, upsetting, or in poor taste.
- Five focus areas: Safety, Performance, Business, Design, Legal.

**Moderation process:**
- Pre-publication automated + human review for all apps and updates.
- Post-publication monitoring with ability to take down non-compliant content.
- As of 2025-2026: AI transparency requirements, enhanced privacy labels, age restriction mechanisms.

**Enforcement:**
- App removal from store.
- No granular user-review moderation exposed to developers (Apple controls it end-to-end).

**Key takeaway for SettleGrid:** Apple's dual-layer approach (automated first, human second) is the gold standard. Their requirement that platforms hosting UGC must provide filtering + reporting + blocking is a minimum bar.

---

### 2. Google Play Store

**Content policy:**
- Explicit comment posting policy prohibiting: fake reviews, duplicate reviews, reviews from multiple accounts, misleading/manipulative reviews, off-topic content, offensive content.
- Both positive and negative review manipulation is prohibited.

**Automated moderation:**
- Combination of automated + human review deployed since 2018.
- ML system detects unusual review patterns, spammy content, coordinated manipulation.
- Install manipulation (boosting placement) detected and filtered.

**Appeals process:**
- Email notification when review is removed, including reason.
- One appeal per removal decision.
- Clear, finite appeal structure (not indefinite back-and-forth).

**Enforcement:**
- Review removal.
- Repeated/egregious violators lose ability to post.
- Installs from manipulation campaigns filtered from counts.

**Key takeaway for SettleGrid:** Google's "one appeal" model is operationally efficient. Their email notification with reason is good transparency. The reviewer ban for repeat offenders is essential.

---

### 3. Amazon

**Content policy:**
- 100% of reviews analyzed before publication (pre-moderation).
- Uses LLMs, NLP, and deep graph neural networks.
- Detects incentivized reviews (gift cards, free products, reimbursements).
- Graph analysis maps relationships between accounts to detect review rings.

**Verified Purchase badge:**
- Reviewer must have bought the item on Amazon.
- Must have paid a price available to most shoppers (no deep-discount manipulation).
- Badge displayed prominently on the review.

**Vine program:**
- Trusted reviewers ("Vine Voices") receive products for review.
- Reviews badged as "Vine Review" for transparency.
- Counterpart to organic reviews, not a replacement.

**Scale:**
- Hundreds of millions of suspected fake reviews blocked before customers see them.
- Proactive (pre-publication) rather than reactive (post-publication cleanup).

**Key takeaway for SettleGrid:** Amazon's "Verified Purchase" concept maps directly to SettleGrid's existing invocation-gating (consumer must have used the tool). The graph neural network approach to detecting review rings is overkill at our scale, but the concept of checking account relationships matters.

---

### 4. Trustpilot

**Content policy:**
- ~200,000 reviews/day scanned by automated detection before becoming visible.
- ML, neural networks, graph-based models analyze ~200 data points per review.
- Signals: IP addresses, device characteristics, location, language patterns, review spikes, timing anomalies.

**Detection performance:**
- 90%+ of fake reviews removed automatically (no human needed).
- 4.5 million fake reviews removed in 2024.
- Dedicated detection software for purchased reviews.

**Moderation structure:**
- Automated AI first pass.
- Generative AI for guideline violation detection (added 2024).
- Content Integrity Team (human moderators) for complex/flagged cases.
- Fraud & Investigations team for organized manipulation.

**Dispute process:**
- Both consumers and businesses can report reviews.
- Content Integrity team reviews reports and takes action.
- Transparent: annual Trust Report publishes removal statistics.

**Key takeaway for SettleGrid:** Trustpilot's transparency report model builds trust. Their 90% automation rate shows that a well-tuned system can handle the vast majority without human intervention. Their layered approach (automated -> gen AI -> human) is the target architecture.

---

### 5. Shopify App Store

**Content policy (specific prohibited content):**
- Fake or misleading reviews.
- Reviews used for commercial gain.
- Reviews exchanged for financial or other compensation.
- Duplicate reviews (same account or multiple accounts).
- Reviews misleading about reviewer's identity or connection to the app.
- Content linking to prohibited or illegal content.
- Swearing, slurs, threats.
- Personal information (phone, email, address) -- but first name or first name + last initial is allowed.
- Conflict of interest: developers reviewing own app or competitor apps.

**Developer dispute process:**
- Reply directly to removal notification email with evidence.
- Partner Governance team reviews and responds.
- Clear, email-based flow (no complex portal).

**Enforcement actions (graduated):**
- Edit or unpublish reviews.
- Remove apps from promotional surfaces.
- Remove apps from merchants' stores.
- Revoke API access.
- Restrict search visibility.
- Delist apps (temporary or permanent).
- Terminate Partner Account (severe cases).

**Key takeaway for SettleGrid:** Shopify's specific prohibited content list is the closest model for SettleGrid's review policy. Their graduated enforcement (from editing to termination) is well-designed. The "conflict of interest" rule (developers can't review competitors) is important for marketplace integrity.

---

### 6. Yelp

**Recommendation engine:**
- ~25% of all reviews are "not recommended" (hidden but accessible).
- Algorithm evaluates: reviewer activity level, profile completeness, review patterns, content quality.
- Filters both positive and negative suspicious reviews (sentiment-neutral).

**Detection signals:**
- Reviewer account age and activity history.
- Sudden review spikes within short periods.
- Short/vague/overly promotional content.
- Accounts with minimal activity, incomplete profiles.
- Coordinated review campaigns.

**Transparency approach:**
- "Not recommended" reviews are still accessible via a separate link (not permanently deleted).
- No notification to reviewer when filtered.
- Algorithm details kept opaque to prevent gaming.

**Key takeaway for SettleGrid:** Yelp's "not recommended" model (hidden but not deleted) is a strong pattern. It avoids the legal/ethical issues of deletion while keeping the public-facing ratings clean. The sentiment-neutral filtering (both positive and negative) prevents developer self-review gaming.

---

### 7. G2 / Capterra (B2B Review Platforms)

**Reviewer verification:**
- G2: LinkedIn, business email, or personal email + screenshot required.
- Capterra: Human moderators verify reviewers are real people with genuine experiences.
- Every review manually verified (Capterra has 2.5M+ verified reviews).

**Content policy:**
- Must come from real people with genuine, first-hand experiences.
- Must be truthful and verifiable.
- AI-generated content must be reviewed/edited for accuracy and alignment with personal experience.
- No fake reviews, misinformation, or deceptive activity.
- No attempts to identify/contact reviewers to influence, coerce, or pressure changes.
- No conditioning incentives on positive sentiment.
- No discouraging negative reviews.

**Anti-fraud:**
- Advanced third-party content detection tools.
- Sophisticated algorithms + in-house human moderators.
- AI-generated content detection (plagiarism + generative AI detection).
- All fraud reports actively investigated.

**Enforcement:**
- Fraudulent reviews removed.
- Reviewer banned from future reviews and outreach campaigns.

**Key takeaway for SettleGrid:** G2's anti-coercion rule (developers can't pressure reviewers to change reviews) is critical. Their AI-generated content detection is forward-looking. The LinkedIn/business email verification maps to SettleGrid's existing consumer authentication.

---

### 8. WordPress Plugin Directory

**Moderation process:**
- All reports checked by human (no automated moderation for reviews).
- Vulnerability reports must be tested.
- Community-driven reporting.

**Enforcement:**
- Plugins archived (removed from public view but record kept).
- Plugin data (including reviews) may not be restored depending on violation severity.
- Spam completely removed (only exception to archive-not-delete).

**Anti-gaming:**
- Crackdown on incentivized reviews (no official guideline, but enforced).
- Developer-to-developer review manipulation investigated.

**Key takeaway for SettleGrid:** WordPress's archive-not-delete approach preserves audit trail. Their distinction between spam (hard delete) and policy violations (soft archive) is pragmatic.

---

## Part 2: Profanity/Toxicity Detection Libraries for Node.js/TypeScript

### Recommended: `obscenity`

| Feature | obscenity | bad-words | @2toad/profanity | glin-profanity |
|---|---|---|---|---|
| TypeScript native | Yes | No | Yes | Yes |
| Leetspeak detection | Partial (transformer-based) | No | No | Full |
| Bundle size | 8KB | Larger | Medium | Large (TensorFlow.js) |
| Extensibility | Excellent (add/remove patterns, whitelists) | Basic | Good | Good |
| Maintained | Yes (v0.4.5, 2 months ago) | Stale (2+ years) | Yes | Yes |
| False positive control | Whitelisted phrases, word boundaries | Poor | Moderate | Good |

**Why `obscenity`:**
- Transformer-based design matches variants (fuuuuck, f_u_c_k, etc.) without explicit rules for each.
- Excellent false-positive control via whitelists and word boundary settings.
- Tiny bundle (8KB), no ML model download needed.
- Native TypeScript, active maintenance.
- No external API dependency (runs entirely in-process).

**Google Perspective API -- NOT recommended:**
- Free but sunsetting after 2026 (quota increase requests no longer accepted as of Feb 2026).
- External API dependency adds latency and a single point of failure.
- Rate limited to 1 QPS by default.
- Good for sentiment/toxicity scoring but overkill for a developer platform at SettleGrid's scale.

### Recommendation

Use `obscenity` for synchronous profanity/slur blocking (hard block on submission). Consider a lightweight custom heuristic layer on top for spam signals (link density, repeated characters, ALL CAPS ratio) rather than an external API.

---

## Part 3: Legal Considerations

### US: CDA Section 230

- Section 230(c)(1) immunizes platforms from liability for hosting third-party content (reviews).
- Section 230(c)(2) provides "Good Samaritan" protection for good-faith content moderation decisions.
- **Practical meaning:** SettleGrid can moderate, remove, or hide reviews without becoming liable for the remaining content. Removing a bad review does not make SettleGrid the "publisher" of the good ones.
- **Risk:** Over-censoring legitimate negative reviews could invite FTC scrutiny for deceptive practices (suppressing authentic feedback to inflate ratings).

### EU: Digital Services Act (DSA)

- Platforms must provide a "statement of reasons" for content moderation decisions (Article 17).
- Non-liability only until the platform has awareness of illegal content, then must act.
- Transparency reporting requirements (harmonized reports due beginning of 2026).
- **Practical meaning:** If SettleGrid serves EU users, every review removal must be logged with a reason, and the reviewer must be notified.

### Best Practice: Transparency Without Exposure

- **Do:** Log every moderation action with reason, notify the reviewer, offer an appeal.
- **Do:** Publish aggregate moderation statistics (Trustpilot model).
- **Don't:** Silently delete reviews with no audit trail.
- **Don't:** Allow developers to unilaterally remove negative reviews.
- **Don't:** Over-reveal detection methods (Yelp's opacity is intentional).

---

## Part 4: Should SettleGrid Show Removed Reviews?

### Recommendation: Soft-hide with audit trail, never hard-delete

| Approach | Used by | Pros | Cons |
|---|---|---|---|
| Silent deletion | Google (mostly) | Clean UX | No transparency, legal risk under DSA |
| "Not recommended" (hidden but accessible) | Yelp | Transparency, avoids censorship claims | Extra UI complexity |
| Removal + notification to reviewer | Google Play, Shopify | Clear process, appeals possible | Reviewer may feel targeted |
| Removal + public transparency report | Trustpilot | Builds trust, DSA compliant | Requires ongoing reporting |

**SettleGrid approach:**
1. Flagged reviews are hidden from public view but stored in DB with `status` field.
2. Reviewer receives notification that their review was hidden, with the reason and appeal instructions.
3. Developer sees a count of "X reviews hidden by moderation" but not the content.
4. Admin dashboard shows all reviews with full audit trail.
5. Quarterly transparency stats on the /trust page (total reviews, % moderated, reasons breakdown).

---

## Part 5: Published Review Policy

The following is the actual text to display at `/legal/review-policy` and link from the review form:

---

### SettleGrid Review Policy

**Last updated: [DATE]**

Reviews on SettleGrid help developers and consumers make informed decisions about MCP tools. To maintain a trustworthy marketplace, all reviews must follow these guidelines.

#### Who Can Review

- You must have an active SettleGrid consumer account.
- You must have used the tool at least once (verified by invocation history).
- You may submit one review per tool. To change your review, edit your existing one.

#### What's Allowed

- Honest feedback about your experience using the tool -- positive or negative.
- Specific details about reliability, performance, pricing, documentation, or support.
- Constructive criticism, including identifying bugs or limitations.
- Comparisons with other tools, when based on your direct experience.

#### What's Prohibited

- **Profanity, slurs, hate speech, or threats** -- reviews containing abusive language will be automatically blocked.
- **Personal information** -- do not include email addresses, phone numbers, physical addresses, or full names of individuals.
- **Spam or promotional content** -- reviews must reflect genuine experience, not advertise products or services.
- **Fake or misleading reviews** -- reviews must be based on your actual use of the tool. Fabricated experiences are prohibited.
- **Incentivized reviews** -- reviews written in exchange for payment, credits, free access, or other compensation are prohibited, whether positive or negative.
- **Conflict of interest** -- developers may not review their own tools or competitors' tools. Reviews by employees or affiliates of the tool developer are prohibited.
- **AI-generated reviews** -- reviews must be written by you. Submitting AI-generated content without substantial personal editing is prohibited.
- **Review manipulation** -- coordinating review campaigns, using multiple accounts, or any form of rating manipulation is prohibited.
- **Off-topic content** -- reviews must relate to the tool being reviewed. Grievances about SettleGrid policies, unrelated products, or personal disputes belong in support tickets, not reviews.
- **Illegal content** -- reviews must not contain or link to content that violates applicable law.

#### Developer Responses

- Tool developers may post one public response to each review.
- Developer responses must be professional and constructive.
- Developers may not threaten, coerce, or pressure reviewers to change or remove reviews.
- Developers may not condition service quality, support access, or pricing on review content.

#### How We Moderate

- **Automated filtering:** Reviews are scanned for profanity, spam signals, and policy violations before publication. Reviews that clearly violate our policy are blocked automatically.
- **Flagging for manual review:** Borderline content is queued for human review by the SettleGrid team.
- **Community reporting:** Both consumers and developers can report reviews they believe violate this policy.
- **Verified usage badge:** Reviews from consumers with verified tool invocations display a "Verified User" badge.

#### Enforcement Actions

We take the following actions based on the severity and frequency of violations:

1. **Block:** Review is prevented from being published (automated filter).
2. **Hide:** Review is removed from public view. The reviewer is notified with the reason and may appeal.
3. **Warn:** Reviewer receives a warning for borderline violations.
4. **Restrict:** Repeat violators lose the ability to post reviews for 30/90 days.
5. **Ban:** Egregious or persistent violators permanently lose review privileges.

#### Appeals

If your review was hidden or blocked, you may appeal by responding to the notification email within 14 days. Appeals are reviewed by a member of the SettleGrid team (not automated). You will receive a decision within 5 business days. Each review action may be appealed once.

#### Anti-Gaming Protections

- **Review velocity monitoring:** Abnormal spikes in reviews for a single tool trigger automatic investigation.
- **Account age requirements:** New accounts have a 24-hour waiting period before posting reviews.
- **Cross-account detection:** Reviews from accounts sharing IP addresses, devices, or behavioral patterns may be flagged for investigation.
- **Rating manipulation detection:** Statistical anomalies in rating distributions are monitored.

#### Transparency

We publish quarterly moderation statistics on our Trust page, including total reviews submitted, percentage moderated, and breakdown by reason. We believe transparency builds trust.

---

## Part 6: Implementation Plan

### Phase 1: Schema & Data Model Changes

**File:** `apps/web/src/lib/db/schema.ts`

Add new columns to `toolReviews`:

```
status: text('status').notNull().default('published')
  // 'pending' | 'published' | 'hidden' | 'blocked' | 'appealed'
moderationReason: text('moderation_reason')
  // null | 'profanity' | 'spam' | 'personal_info' | 'fake' | 'incentivized'
  // | 'conflict_of_interest' | 'ai_generated' | 'manipulation' | 'off_topic'
  // | 'illegal' | 'reported' | 'manual'
moderatedAt: timestamp('moderated_at', { withTimezone: true })
moderatedBy: text('moderated_by')
  // 'auto' | 'admin:<email>' | 'appeal:<email>'
appealStatus: text('appeal_status')
  // null | 'pending' | 'approved' | 'denied'
appealReason: text('appeal_reason')
appealedAt: timestamp('appealed_at', { withTimezone: true })
appealResolvedAt: timestamp('appeal_resolved_at', { withTimezone: true })
reportCount: integer('report_count').notNull().default(0)
isVerifiedUser: boolean('is_verified_user').notNull().default(false)
  // true if consumer had 3+ invocations at time of review
```

Add new table `reviewReports`:

```sql
CREATE TABLE review_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID NOT NULL REFERENCES tool_reviews(id) ON DELETE CASCADE,
  reporter_id UUID NOT NULL,           -- consumer or developer UUID
  reporter_type TEXT NOT NULL,          -- 'consumer' | 'developer'
  reason TEXT NOT NULL,                 -- 'spam' | 'profanity' | 'fake' | 'personal_info'
                                        -- | 'off_topic' | 'conflict_of_interest' | 'other'
  details TEXT,                         -- free-text explanation (max 500 chars)
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'reviewed' | 'actioned' | 'dismissed'
  reviewed_at TIMESTAMP WITH TIME ZONE,
  reviewed_by TEXT,                     -- 'admin:<email>'
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
CREATE INDEX review_reports_review_id_idx ON review_reports(review_id);
CREATE INDEX review_reports_status_idx ON review_reports(status);
```

Add new table `reviewModerationLog` (immutable audit trail):

```sql
CREATE TABLE review_moderation_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID NOT NULL REFERENCES tool_reviews(id) ON DELETE CASCADE,
  action TEXT NOT NULL,                  -- 'auto_blocked' | 'auto_flagged' | 'hidden' | 'published'
                                         -- | 'appealed' | 'appeal_approved' | 'appeal_denied'
                                         -- | 'reported' | 'warned' | 'restricted' | 'banned'
  reason TEXT NOT NULL,
  performed_by TEXT NOT NULL,            -- 'system' | 'admin:<email>' | 'consumer:<id>' | 'developer:<id>'
  details JSONB,                         -- additional context
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
CREATE INDEX review_mod_log_review_id_idx ON review_moderation_log(review_id);
CREATE INDEX review_mod_log_created_at_idx ON review_moderation_log(created_at);
```

Add `reviewBanStatus` to `consumers` table:

```
reviewBanStatus: text('review_ban_status')
  // null | 'warned' | 'restricted_30' | 'restricted_90' | 'banned'
reviewBanExpiresAt: timestamp('review_ban_expires_at', { withTimezone: true })
reviewBanReason: text('review_ban_reason')
```

---

### Phase 2: Content Filtering Engine

**New file:** `apps/web/src/lib/review-moderation.ts`

```
Dependencies: obscenity (npm install obscenity)
```

**Moderation pipeline (synchronous, runs on POST):**

1. **Profanity check** (`obscenity` library)
   - Hard block: review contains slurs, hate speech, severe profanity.
   - Soft flag: review contains mild profanity (queue for human review).
   - Configure with SettleGrid-specific whitelist (e.g., "damn" in "the API was damn fast" is not actionable).

2. **Personal information detection** (regex-based)
   - Email pattern: `/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/`
   - Phone pattern: `/(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/`
   - Hard block if detected. Return user-friendly error: "Reviews cannot contain email addresses or phone numbers."

3. **Spam heuristics** (custom, no external dependency)
   - Link density: >1 URL in a review -> flag for review.
   - ALL CAPS ratio: >50% uppercase characters -> flag.
   - Repeated character sequences: 4+ of same char ("goooood") -> flag (but don't block; legitimate enthusiasm).
   - Extremely short reviews: <10 characters with a 1-star rating -> flag (potential drive-by negativity).
   - Duplicate content: hash the review text, check against recent reviews for the same tool -> block if duplicate.

4. **Conflict of interest check** (database query)
   - Check if the reviewer's consumer email matches the tool developer's email -> hard block.
   - Check if the reviewer has reviewed 5+ tools in the last 24 hours -> flag for review (possible review campaign).

5. **Review velocity check** (Redis counter)
   - Track reviews per tool per hour. If >10 reviews for a single tool in 1 hour -> flag all new reviews for that tool for manual review.
   - Track reviews per consumer per day. If >3 reviews per consumer per day -> flag for review.

**Return value:** `{ status: 'published' | 'blocked' | 'pending_review', reason?: string }`

---

### Phase 3: API Route Changes

**File:** `apps/web/src/app/api/tools/by-slug/[slug]/reviews/route.ts`

**GET changes:**
- Only return reviews where `status = 'published'`.
- Include `isVerifiedUser` badge in response.
- Include `developerResponse` and `developerRespondedAt` in response.
- Add `include_hidden` query param for admin requests (authenticated, admin role only).

**POST changes:**
- Add account age check: reject if consumer account < 24 hours old.
- Add review ban check: reject if consumer has active ban/restriction.
- Run content filtering pipeline before insert.
- If `blocked`: return 422 with user-friendly reason (not the raw moderation reason).
- If `pending_review`: insert with `status = 'pending'`, return 201 with message "Your review is being reviewed and will appear shortly."
- If `published`: insert with `status = 'published'`, return 201 as current.
- Set `isVerifiedUser = true` if consumer has 3+ invocations on the tool.
- Log moderation action to `reviewModerationLog`.

**New routes:**

`POST /api/tools/by-slug/[slug]/reviews/[reviewId]/report`
- Auth: consumer or developer.
- Body: `{ reason: string, details?: string }`
- Creates a `reviewReport` record.
- If `reportCount >= 3`: auto-hide the review and queue for admin review.
- Rate limit: 5 reports per consumer per day.

`POST /api/tools/by-slug/[slug]/reviews/[reviewId]/respond` (developer response)
- Auth: developer who owns the tool.
- Body: `{ response: string }` (max 1000 chars)
- Updates `developerResponse` and `developerRespondedAt`.
- Run same profanity + PII filter on developer response.
- One response per review (409 if already responded).

`POST /api/tools/by-slug/[slug]/reviews/[reviewId]/appeal`
- Auth: consumer who wrote the review.
- Body: `{ reason: string }` (max 500 chars)
- Only allowed if review `status = 'hidden'` or `status = 'blocked'`.
- Only allowed once per review (`appealStatus` must be null).
- Sets `appealStatus = 'pending'`, `appealedAt = now()`.
- Sends notification email to admin.

---

### Phase 4: Admin Moderation Tools

**New page:** `apps/web/src/app/admin/reviews/page.tsx`

**Admin review queue:**
- Tab 1: **Pending Review** -- reviews with `status = 'pending'` (auto-flagged by content filter).
- Tab 2: **Reported** -- reviews with `reportCount >= 1`, ordered by report count desc.
- Tab 3: **Appeals** -- reviews with `appealStatus = 'pending'`.
- Tab 4: **All Reviews** -- full list with search, filter by status/tool/date.

**Per-review admin actions:**
- **Publish:** Set `status = 'published'`, log action.
- **Hide:** Set `status = 'hidden'`, select reason from dropdown, log action, notify reviewer via email.
- **Approve appeal:** Set `status = 'published'`, `appealStatus = 'approved'`, log action, notify reviewer.
- **Deny appeal:** Set `appealStatus = 'denied'`, log action, notify reviewer with brief explanation.
- **Warn reviewer:** Set consumer `reviewBanStatus = 'warned'`, send warning email.
- **Restrict reviewer:** Set consumer `reviewBanStatus = 'restricted_30'` or `restricted_90'`, send notification.
- **Ban reviewer:** Set consumer `reviewBanStatus = 'banned'`, send notification.

**Admin API routes:**

`GET /api/admin/reviews` -- list reviews with filters (status, tool, date range, has_reports, has_appeals).
`PATCH /api/admin/reviews/[id]` -- update review status (publish, hide).
`POST /api/admin/reviews/[id]/resolve-appeal` -- approve or deny appeal.
`POST /api/admin/reviews/[id]/warn` -- warn reviewer.
`POST /api/admin/reviews/[id]/restrict` -- restrict reviewer (30 or 90 days).
`POST /api/admin/reviews/[id]/ban` -- ban reviewer.
`GET /api/admin/reviews/stats` -- moderation statistics for transparency page.

**Admin dashboard widgets:**
- Reviews pending moderation (count + oldest age).
- Open appeals (count + oldest age).
- Reviews reported this week.
- Moderation actions this week (breakdown by type).
- Top-reported tools (potential quality issues).

---

### Phase 5: Developer Dispute Flow

**New page:** `apps/web/src/app/dashboard/reviews/page.tsx` (already exists as a route, needs content)

**Developer review management:**
- List all reviews for their tools (published + hidden counts).
- Filter by tool, rating, date, has developer response.
- "Respond" button to write a public response (max 1000 chars).
- "Report" button to flag a review for admin investigation.
- Developer cannot see hidden review content (only "1 review hidden by moderation").
- Developer cannot directly remove, edit, or hide reviews.

**Developer report flow:**
1. Developer clicks "Report" on a review.
2. Selects reason: `spam | fake | conflict_of_interest | personal_info | off_topic | other`.
3. Optionally provides details (max 500 chars).
4. Report submitted to admin queue.
5. Developer sees "Reported" badge on the review until resolved.
6. Admin reviews, takes action (or dismisses), developer notified of outcome.

**Developer notifications (email):**
- New review received (already implemented).
- Review report resolved (new).
- Low rating alert (already implemented).

---

### Phase 6: Anti-Gaming Measures

**6a. Review Velocity Monitoring**

Redis keys:
- `review:velocity:tool:{toolId}:hourly` -- TTL 1h, increment on each new review.
- `review:velocity:consumer:{consumerId}:daily` -- TTL 24h, increment on each new review.
- `review:velocity:tool:{toolId}:daily` -- TTL 24h, for daily trend detection.

Thresholds:
- >10 reviews/hour for a single tool: flag all new reviews for that tool for manual review.
- >3 reviews/day from a single consumer: flag new reviews from that consumer.
- >20 reviews/day for a single tool: alert admin (possible review bombing or viral moment).

**6b. Account Age Gate**

- Consumer accounts less than 24 hours old cannot post reviews.
- Error message: "Your account must be at least 24 hours old to post reviews."

**6c. Cross-Account Detection**

- On review submission, log IP address (already captured via `x-forwarded-for`).
- If 3+ reviews for the same tool come from the same IP within 7 days: flag all for review.
- Store IP hash (not raw IP) in `reviewModerationLog.details` for GDPR compliance.

**6d. Statistical Anomaly Detection (Cron)**

- Daily cron job checks each tool's rating distribution.
- Flag tools where >80% of reviews in the last 7 days are 1-star (possible review bombing).
- Flag tools where >80% of reviews in the last 7 days are 5-star from accounts <30 days old (possible self-review campaign).
- Alert admin via email with tool name and stats.

**6e. Verified User Badge Criteria**

A review displays the "Verified User" badge when:
- Consumer has 3+ successful (non-test) invocations on the tool.
- Consumer account is older than 7 days.
- Consumer has a verified email address.

Badge is computed at review creation time and stored as `isVerifiedUser` boolean.

---

### Phase 7: Email Notifications

**New email templates (add to `apps/web/src/lib/email.ts`):**

1. `reviewHiddenNotification` -- sent to reviewer when their review is hidden.
   - Includes: tool name, reason, appeal instructions, link to appeal.

2. `reviewBlockedNotification` -- sent to reviewer when their review is auto-blocked.
   - Includes: reason (user-friendly), suggestion to edit and resubmit.

3. `reviewAppealReceivedNotification` -- sent to reviewer confirming appeal received.
   - Includes: expected response time (5 business days).

4. `reviewAppealResolvedNotification` -- sent to reviewer with appeal outcome.
   - Includes: outcome (approved/denied), brief explanation.

5. `reviewerWarningNotification` -- sent to reviewer being warned.
   - Includes: which review violated policy, specific policy cited, warning that continued violations lead to restriction.

6. `reviewerRestrictionNotification` -- sent to reviewer being restricted.
   - Includes: duration (30 or 90 days), reason, when restriction lifts.

7. `developerReportResolvedNotification` -- sent to developer when their report is resolved.
   - Includes: outcome (review hidden, report dismissed), brief explanation.

8. `adminReviewAlert` -- sent to admin for velocity anomalies and appeal queue.

---

### Phase 8: Frontend Changes

**Review display (`review-form.tsx` and storefront):**
- Show "Verified User" badge next to verified reviews.
- Show developer response below reviews (indented, different background).
- Show "Report" link on each review (for logged-in consumers/developers).
- Add link to Review Policy near the form.
- Show "Your review is pending moderation" state if status is `pending`.

**Review form updates:**
- Character counter already exists (1000 max).
- Add note below form: "By submitting, you agree to our [Review Policy](/legal/review-policy)."
- Client-side profanity pre-check (optional, improves UX by catching obvious issues before server round-trip).
- Show specific error messages for blocked reviews: "Reviews cannot contain profanity" / "Reviews cannot contain personal information."

---

## Part 7: Implementation Priority & Effort Estimates

| Phase | Effort | Priority | Dependencies |
|---|---|---|---|
| Phase 1: Schema changes | 2h | P0 | None |
| Phase 2: Content filtering engine | 4h | P0 | Phase 1, `obscenity` package |
| Phase 3: API route changes | 4h | P0 | Phase 1, Phase 2 |
| Phase 5: Published review policy | 1h | P0 | None (static page) |
| Phase 4: Admin moderation tools | 6h | P1 | Phase 1, Phase 3 |
| Phase 6: Anti-gaming measures | 4h | P1 | Phase 1, Redis |
| Phase 7: Email notifications | 3h | P1 | Phase 3 |
| Phase 8: Frontend changes | 3h | P2 | Phase 3 |
| **Total** | **~27h** | | |

**P0 (launch blockers):** Schema, content filter, API changes, published policy.
**P1 (week 1 post-launch):** Admin tools, anti-gaming, email notifications.
**P2 (week 2 post-launch):** Frontend polish, verified badges, developer responses.

---

## Part 8: Testing Strategy

**Unit tests (Phase 2):**
- Profanity detection: test with known slurs, leetspeak variants, false positives (e.g., "Scunthorpe").
- PII detection: test email/phone regex with valid and invalid patterns.
- Spam heuristics: ALL CAPS, link density, repeated characters, short reviews.
- Velocity checks: mock Redis counters, test threshold crossing.

**Integration tests (Phase 3):**
- POST review with profanity -> 422.
- POST review with PII -> 422.
- POST review from new account (<24h) -> 403.
- POST review from banned consumer -> 403.
- POST review passing all checks -> 201 with status `published`.
- POST review flagged by spam heuristic -> 201 with status `pending`.
- Report a review -> 201, verify reportCount incremented.
- Report a review 3 times -> review auto-hidden.
- Developer respond to review -> 200.
- Appeal a hidden review -> 200.

**Admin tests (Phase 4):**
- Admin publish pending review -> status changes.
- Admin hide review -> reviewer notified.
- Admin approve appeal -> status changes to published.
- Admin deny appeal -> status changes, reviewer notified.
- Admin ban reviewer -> consumer record updated.

---

## Appendix A: Moderation Reason Codes

| Code | Description | Auto/Manual | Action |
|---|---|---|---|
| `profanity` | Contains slurs, hate speech, severe profanity | Auto | Block |
| `profanity_mild` | Contains mild profanity | Auto | Flag for review |
| `personal_info` | Contains email, phone, or address | Auto | Block |
| `spam` | Promotional content, excessive links | Auto | Flag for review |
| `duplicate` | Identical text to another review | Auto | Block |
| `fake` | Fabricated experience | Manual | Hide |
| `incentivized` | Written in exchange for compensation | Manual | Hide |
| `conflict_of_interest` | Developer/affiliate reviewing own or competitor tool | Auto/Manual | Block/Hide |
| `ai_generated` | Entirely AI-generated without personal editing | Manual | Hide |
| `manipulation` | Part of coordinated review campaign | Manual | Hide |
| `off_topic` | Not related to the tool | Manual | Hide |
| `illegal` | Contains or links to illegal content | Manual | Hide + escalate |
| `velocity_flag` | Part of abnormal review spike | Auto | Flag for review |
| `account_age` | Account too new | Auto | Block |
| `reported` | Flagged by community reports | Auto (3+ reports) | Flag for review |

---

## Appendix B: Platform Comparison Summary

| Feature | Apple | Google Play | Amazon | Trustpilot | Shopify | Yelp | G2/Capterra | WordPress | **SettleGrid Plan** |
|---|---|---|---|---|---|---|---|---|---|
| Pre-publication screening | Yes | Yes | Yes (100%) | Yes | Yes | No (post-filter) | Yes | No | **Yes** |
| Automated profanity filter | Yes | Yes | Yes | Yes | Yes | Yes | Yes | No | **Yes (obscenity)** |
| Verified purchase/usage | N/A | N/A | Yes | No | Yes (merchant) | No | Yes (LinkedIn) | No | **Yes (invocations)** |
| Developer dispute | No | No | No | Yes | Yes (email) | No | Yes | Email | **Yes (report flow)** |
| Appeal process | No | Yes (1 appeal) | Limited | Yes | Yes (email) | No | No | Email | **Yes (1 appeal)** |
| Review bombing detection | No | Yes | Yes | Yes | No | Yes | No | No | **Yes (velocity)** |
| Transparency report | Yes (DSA) | No | Yes | Yes (annual) | No | No | No | No | **Yes (quarterly)** |
| Graduated enforcement | N/A | Yes | Yes | Yes | Yes | Yes | Yes | Yes | **Yes (5 levels)** |

---

## Sources

- [Apple App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [Apple DSA Transparency Report](https://www.apple.com/legal/dsa/transparency/eu/app-store/2508/)
- [Google Play Comment Posting Policy](https://play.google/comment-posting-policy/)
- [Google Play - In Reviews We Trust (2018)](https://android-developers.googleblog.com/2018/12/in-reviews-we-trust-making-google-play.html)
- [Google Play Managing Policy Violations and Appeals](https://support.google.com/googleplay/android-developer/answer/9899142?hl=en)
- [Amazon - How Amazon Maintains Trusted Reviews](https://trustworthyshopping.aboutamazon.com/how-amazon-maintains-a-trusted-review-experience)
- [Amazon - How AI Spots Fake Reviews](https://www.aboutamazon.com/news/policy-news-views/how-ai-spots-fake-reviews-amazon)
- [Trustpilot Trust Report 2025](https://corporate.trustpilot.com/trust/trust-report-2025)
- [Trustpilot Automated Detection Technology](https://help.trustpilot.com/s/article/Trustpilots-fraud-detection-software?language=en_US)
- [Trustpilot Use of AI](https://corporate.trustpilot.com/trust/trustpilot-use-of-ai)
- [Shopify Review Policies](https://help.shopify.com/en/partners/help-support/faq/reviews)
- [Shopify App Store Policy Violations](https://shopify.dev/docs/apps/launch/app-store-review/policy-violations)
- [Shopify Manage App Reviews](https://shopify.dev/docs/apps/launch/marketing/manage-app-reviews)
- [Yelp Review Filter Explained](https://optimizeup.com/yelp-review-filter-guide/)
- [G2 Community Guidelines](https://legal.g2.com/community-guidelines)
- [G2 Review Validity](https://sell.g2.com/review-validity)
- [Capterra FAQs for Review Verification](https://www.capterra.com/faq/faqs-verification/)
- [WordPress Plugin Guidelines](https://developer.wordpress.org/plugins/wordpress-org/detailed-plugin-guidelines/)
- [WordPress Handling Bad Reviews](https://make.wordpress.org/plugins/2016/05/03/handling-bad-reviews/)
- [obscenity - npm](https://www.npmjs.com/package/obscenity)
- [obscenity - GitHub](https://github.com/jo3-l/obscenity)
- [@2toad/profanity - GitHub](https://github.com/2Toad/Profanity)
- [Google Perspective API](https://perspectiveapi.com/how-it-works/)
- [Perspective API Pricing](https://www.lassomoderation.com/blog/Perspective-api-pricing/)
- [EU Digital Services Act](https://digital-strategy.ec.europa.eu/en/policies/digital-services-act)
- [DSA vs Section 230 Comparative Analysis](https://cjil.uchicago.edu/print-archive/digital-services-act-and-brussels-effect-platform-content-moderation)
- [Marketplace Content Moderation Guide](https://getstream.io/blog/marketplace-content-moderation/)
- [Content Moderation for Marketplaces](https://meetmarkko.com/knowledge/content-moderation-for-marketplaces-basics/)
- [Review Bombing - Wikipedia](https://en.wikipedia.org/wiki/Review_bomb)
- [Steam Review Bombing Response](https://steamcommunity.com/discussions/forum/10/734784298132102941/)
