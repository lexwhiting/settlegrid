# Customer Interview Template — SettleGrid Phase 4

**Use:** copy this file to `docs/interviews/transcripts/YYYY-MM-DD-<github_username>.md`
on the morning of each interview. Fill in the metadata block, run the call,
type sparse notes inline; clean up the transcript from the Otter recording
afterwards. Aim for 10 transcripts before any Phase 5 product decision.

**Why JTBD framing:** the goal is *not* to validate SettleGrid. The goal is
to understand the **job** the prospect is hiring an MCP monetization tool to
do, surfaced in their own words. If a section reads like "they liked the
product," you let yourself off the hook — go back and re-listen for the
moment they wanted something we don't have yet.

**Total budget:** 20 minutes hard cap. Every section's `[Nm]` is the time
budget. Don't skip the budget — if you blow Section 3 by 4 minutes,
Section 4 (the load-bearing one) gets squeezed.

---

## Metadata

- **Interviewee:** <Name> (<github_username>)
- **Date:** YYYY-MM-DD
- **Length:** XX minutes
- **Recording:** Otter.ai link
- **How they found us:** signup source (HN / Show HN / direct / outreach)
- **Their stack:** language, framework, what they ship
- **Pre-call read:** did they watch the Loom? (founder confirms via reply)

---

## Section 1 — Context (2 min)

**Goal:** what they're building, who pays them, where this fits.
**DO NOT** describe SettleGrid yet. That comes in Section 4.

Script questions (pick 3 of 5; cut as time runs):

1. Tell me what you're working on right now — paint me a picture.
2. Who's the user/customer? Are they paying yet, or is this still side-of-desk?
3. How long have you been on it?
4. What's the single hardest problem you've solved on it so far?
5. Where does an MCP server fit in this picture (or does it)?

**Notes:**

>
>
>

---

## Section 2 — Current state (5 min)

**Goal:** how they handle "the problem SettleGrid solves" today. Cast wide:
billing, usage tracking, rate limiting, sharing access with collaborators,
selling to a customer.

**DO NOT** ask "have you tried X tool?" — that biases their answer.
**DO** ask them to walk you through a real example. Concrete > abstract.

Script questions (pick 4 of 5; cut as time runs):

1. Walk me through what happens today when someone wants to use your tool.
   Like, the actual sequence — pretend I'm watching over your shoulder.
2. How do you decide what to charge, if anything?
3. How do you handle access? API keys, OAuth, just-trust-the-user?
4. When someone hits a limit (rate, usage, quota) what's the experience?
5. Last time you had to invoice or settle with a customer — what did you do?

**Notes:**

>
>
>

---

## Section 3 — Pain points (4 min)

**Goal:** where their current setup breaks. Not what they wish were better
in the abstract — what actually broke last week.

**DO NOT** pitch SettleGrid. Even if they describe a problem we solve
literally word-for-word, do not say "yeah, we do that." Just write it down.
You'll come back to it in Section 4 when they see the gallery.

**DO NOT** ask leading questions ("don't you wish billing was easier?").
**DO** ask "what was the last thing that frustrated you about [topic]?"

Script questions:

1. What's the last thing that broke or felt clumsy about [topic from Section 2]?
2. If you imagine the version of this that just works — what's different?
3. What have you tried that didn't work? (other tools, building it yourself)
4. What's stopping you from building it yourself today?
5. Who else on your team feels the same pain? Who feels different?

**Notes:**

>
>
>

---

## Section 4 — SettleGrid reaction (5 min)

**Goal:** discover what they look at, click, and ignore on the gallery.
This is the only section where SettleGrid enters the conversation.

**Setup:** "Want me to show you what I'm building? Open settlegrid.ai/templates
on your end, and tell me what catches your eye."

**DO NOT** narrate the product. Stay silent for the first 30 seconds. Let
them click around. The most important data is what they click first.

**DO** notice: which template do they hover over? Do they go to the docs?
Do they look at pricing? Do they ignore the gallery and go to the homepage?

Script questions (after they've clicked around 30s):

1. What's the first thing you noticed?
2. Open one of the templates — pick whichever — and tell me what you see.
3. Show me the part you'd skip.
4. What did you expect to see that wasn't there?
5. If you tried `npx settlegrid add --github <your-repo>` right now, what
   do you think would happen?

**Notes — what they clicked, in order:**

>
>
>

**Notes — confusion or "what is this":**

>
>
>

---

## Section 5 — Willingness to pay (2 min)

**Goal:** strength of the demand signal. Not actual purchase intent — that
takes a second call. We want to hear "if this worked, I'd care" or
"I'd consider it" — anything stronger or weaker is informative.

**DO NOT** name a price first. Let them anchor.
**DO NOT** treat "yes" as a sale — they're being polite.

Script questions:

1. If this worked exactly as advertised — billing, scaffolding, all of it —
   would you pay for it?
2. What would feel fair? Per-call? Subscription? Cut of revenue?
3. What would you pay nothing for? What would you pay $50/month for?
4. (If they hesitate) What's the dealbreaker?

**Notes:**

>
>
>

---

## Section 6 — Close (2 min)

**Goal:** referrals + permission to follow up.

**DO NOT** ask for a testimonial or "intro to your CTO" — too soon.
**DO** ask for one specific person.

Script questions:

1. Who else is building MCP servers in your orbit? One name is enough.
2. Can I email you in 6 weeks with what I've learned from these calls?
3. Anything I should have asked but didn't?

**Notes:**

>
>
>

---

## Post-call (founder fills in within 1 hour)

- **Top 3 quotes** (verbatim, even if rough):
  -
  -
  -
- **Job they're hiring this for** (1 sentence, JTBD style: "When [trigger],
  I want to [job], so that [outcome]"):

  >

- **Strongest feature reaction** (positive or negative):

  >

- **Open questions** to test in next interview:

  >

- **Status update:** mark this signup `interviewed` in
  `/admin/signup-followup` (Notes field: 1-line summary + Otter link).
