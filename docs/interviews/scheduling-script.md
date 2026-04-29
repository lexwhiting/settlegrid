# Customer Interview Scheduling — End-to-End Script

**Use:** the manual flow for converting Phase-4 signups into 20-minute
JTBD interviews. Designed for solo founder operating during launch week
without hiring out scheduling. Goal: 10 interviews in 14 days.

**Why manual:** every step that *could* be automated (email-send, status
tracking, reminder pings) is intentionally not. The signal we're after
is whether someone responds to a personal email from a stranger founder
asking for 20 minutes — automation muddies that signal.

---

## End-to-end flow

```
signup_completed event fires
  → /admin/launch-dashboard surfaces the signup
  → /admin/signup-followup lists it as "not_sent"
  → founder copies + edits + sends interview-request email (≤24h)
  → mark "sent" in /admin/signup-followup
  → recipient clicks Calendly, picks a slot
  → mark "scheduled"
  → night before: send Loom pre-read (P4.4)
  → on the call: run docs/interviews/template.md
  → upload recording to Otter.ai
  → save transcript to docs/interviews/transcripts/YYYY-MM-DD-<login>.md
  → mark "interviewed" with Otter link in Notes
```

---

## Step-by-step

### 1. Trigger: a signup happens

`signup_completed` event fires (P4.1 telemetry). The launch dashboard
shows the new entry within 30 seconds (P4.7 dashboard, 30s revalidate).

The signup-followup endpoint at `/admin/signup-followup` lists every
developer signup from the last 30 days, oldest "not_sent" first.

### 2. Founder triages: who to interview

We don't email *every* signup. Within 24h of signup, prioritize:

- **Hot:** they came from a P4.6 outreach email (referral header) or HN
  comment (read the email field — often `<github-handle>@gmail.com`).
- **Warm:** their GitHub login resolves to an MCP-server contributor
  (cross-check `mcp_shadow_index` for the developer's owner/repo).
- **Cold:** generic signup with no obvious signal — skip, or batch
  these into a "second pass" after the hot/warm pipeline is exhausted.

The 24h SLA matters: signup → email response rate falls off a cliff
after 48h. Don't let "tomorrow" become "next week."

### 3. Compose the email

Render the template via `interviewRequestEmail()` from
`apps/web/src/lib/email/templates/interview-request.ts`:

```ts
import { interviewRequestEmail } from '@/lib/email/templates/interview-request'

const { subject, body } = interviewRequestEmail({
  recipientName: 'Jane Doe',
  recipientLogin: 'jane-dev',
  founderName: 'Lex',
  founderPhone: '+1-555-0100',
  calendlyUrl: 'https://calendly.com/lex-settlegrid/interview-20min',
})
```

Or — and this is the workflow we actually use day-to-day — copy the
template directly out of `interview-request.ts` and edit by hand. The
function exists for the test surface and for when this becomes
semi-automated post-launch; the day-to-day is paste-into-Gmail.

**Rules:**

- Edit the subject line per recipient. Don't send the same subject to
  10 people in the same hour or Gmail will throttle it.
- Add ONE personalization sentence in the gap between "Thanks for
  signing up" and the ask. Reference their bio, their PR title, the
  template they forked, anything specific. (P4.6 outreach generator
  produces this kind of line; you can reuse the cached output.)
- Send from the founder's personal address (gmail), not from the
  product mailer. Personal address gets read; product mailer gets
  filtered to Promotions.

### 4. Mark "sent"

In `/admin/signup-followup`, click the row, change status to **sent**,
add a 1-line note ("emailed at HH:MM, customized P3 about
async-pdf-toolkit OOM PR"). The note matters when you re-read the
list two days later wondering why you skipped someone.

### 5. They click Calendly

Calendly event type: **20-min user research interview**.

- Slots: 3 per day, spread across morning/afternoon to catch different
  time zones. Adjust as you see scheduling patterns.
- Buffer: 15 min before each slot for pre-read review, 15 min after
  for note dump.
- Custom fields on the booking form: GitHub login (so we can match
  to signup), 1-sentence "what are you building?" (warm-up).
- Auto-reminder: 1 hour before, with the Loom link from P4.4 attached.

When confirmation lands in your inbox, open `/admin/signup-followup`
and mark **scheduled** with the booking time in Notes.

### 6. Pre-read the night before

The night before the call:

- Re-read their GitHub profile (recent repos, last 5 PRs/issues).
- Skim the template they forked, if any (registry → repo).
- Reply-all to the Calendly confirmation with the Loom link
  ("Pre-read so we can use the 20 min for your questions, not the
  product tour: <P4.4 Loom URL>"). About 30% will watch.

### 7. Run the call

Open `docs/interviews/template.md`. Copy to
`docs/interviews/transcripts/YYYY-MM-DD-<login>.md` before the call
starts so you can take notes inline. Open Otter.ai recording.

Open settlegrid.ai/templates in a browser tab — Section 4 of the
template needs the gallery on screen, but you wait until the
interviewee opens it on their end first. The point is to see what
*they* click.

### 8. Post-call (within 1 hour)

- Save Otter transcript to the same `docs/interviews/transcripts/...`
  file under a "Transcript" heading.
- Fill in the template's "Post-call" section while it's fresh.
- In `/admin/signup-followup`, mark **interviewed** with Notes
  containing the Otter link + 1-line summary.

### 9. Follow-up (24 hours later)

Send a 2-line thank-you email — no upsell, just specific:

> Thanks for the time yesterday. The thing you said about [specific
> quote from Section 3] is going on the wall — that's the kind of
> thing I'm trying to design around. I'll email you in 6 weeks with
> what I've learned from this batch of calls.

The 6-week follow-up is what builds the moat. Most founders don't do
it; the ones who do compound trust.

---

## Calendly setup checklist (one-time)

- [ ] Create event type "User research interview — 20 min"
- [ ] Description includes: "20 minutes, recorded for my own notes
      (Otter.ai), no pitch — I'm trying to learn what people actually
      need from MCP monetization. Bring a real example you're working
      on."
- [ ] Buffer: 15 min before, 15 min after
- [ ] Working hours: 9-12, 14-17 in founder's timezone — adjust as
      you see incoming demand from non-US time zones
- [ ] Custom questions:
      1. GitHub login (required, used to match to your signup)
      2. What are you building? 1-2 sentences
      3. Time zone (free text — Calendly's TZ detection mis-guesses
         frequently)
- [ ] Confirmation email: includes Loom URL placeholder so you don't
      forget to send it the night before
- [ ] Cancellation policy: 2 hours notice; otherwise the slot's gone
      and we re-book later

---

## Otter.ai setup checklist (one-time)

- [ ] Otter Pro subscription (free tier caps at 30 min/month — not
      enough for 10 interviews)
- [ ] Default folder: `SettleGrid Phase 4 Interviews`
- [ ] Sharing setting: private by default. Don't auto-share with
      anyone — these contain candid product reviews.
- [ ] Speaker labels: turn on; saves 10 min of cleanup per transcript.

---

## When to deviate from this script

- **They want to talk longer:** the 20-min budget is a contract with
  the *interviewee*, not with you. If they have time and the call is
  productive, keep going. Just don't *plan* a 60-min call from the
  start.
- **They cancel/no-show:** one polite re-schedule offer, no second.
  Their not-showing is itself signal.
- **They say "I have a question for you":** answer briefly, redirect
  to their context. Their question is a window into their JTBD.
- **They start pitching themselves:** common — they think this is a
  partnership call. Redirect: "Let me park that — I want to make sure
  I understand your day-to-day first."
