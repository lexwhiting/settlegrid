<!--
  ===========================================================================
  P4.6 SAMPLE OUTPUT — RE-GENERATE WITH THE SCRIPT BEFORE SENDING
  ===========================================================================

  This file is a COMMITTED FORMAT REFERENCE — not the actual generated
  output. The real run produces 100 per-recipient draft emails containing
  real names and email addresses; that file is written to a gitignored
  location (`scripts/.outreach/batch-2.md` by default) so PII never lands
  in version control.

  TO RE-GENERATE:

    cd /Users/lex/settlegrid
    GITHUB_TOKEN=ghp_...                         \
    ANTHROPIC_API_KEY=sk-ant-...                 \
    DATABASE_URL=postgres://...                  \
    FOUNDER_NAME=Lex                             \
    FOUNDER_ROLE=Founder                         \
    COMPANY_NAME="SettleGrid (Alerterra, LLC)"   \
    PHYSICAL_ADDRESS="<your street address>"     \
    BLOG_URL=https://settlegrid.ai/learn/blog/settlegrid-templates-launch \
    GALLERY_URL=https://settlegrid.ai/templates  \
    AWESOME_MCP_LISTS=punkpeye/awesome-mcp-servers,<other-list-1>,<other-list-2> \
      npx tsx scripts/build-outreach-batch.ts

  Output is written to scripts/.outreach/batch-2.md by default. Override
  with `--out <path>` if needed; the script prints a "DO NOT COMMIT" warning
  and the .gitignore entry covers the default path. Verify any custom path
  with `git check-ignore <path>` before staging.

  Optional flags:
    --dry-run            Plan the batch (counts per tier) without calling
                         Claude. Use this first to verify rate-limit budget.
    --no-cache           Force fresh GitHub + Claude calls (ignore .cache).
    --skip-personalize   Render with placeholders; founder hand-writes.
    --limit N            Cap total drafts at N (default 100).
    --hot-limit / --warm-limit / --cold-limit N
    --out <path>         Override the default output location.

  Optional env vars:
    GALLERY_URL          Defaults to https://settlegrid.ai/templates.
    AWESOME_MCP_LISTS    Comma-separated `owner/repo` of awesome-list repos
                         to source warm contributors from. Defaults to
                         `punkpeye/awesome-mcp-servers`.
    UNSUBSCRIBE_URL      Set only for transactional sends; reply-STOP
                         is best practice for personal email.

  CAN-SPAM CHECKLIST (the script asserts these, but double-check before you
  start sending):

    [ ] Physical postal address in every footer.
    [ ] Identity disclosure: founder name + role + company in every footer.
    [ ] Reply-STOP opt-out language present in every footer.
    [ ] Subject does not start with "Re:" (renderer asserts; spec literal).
    [ ] You have a verified sending domain configured on the founder's
        personal email account, OR you're sending from a domain you own.

  IDEMPOTENCY:
  Re-running the script writes this file deterministically. Cached
  personalization lines stay stable across runs. Use `--no-cache` to
  re-run Claude on every target.
-->

# Outreach Batch 2 — SAMPLE STUB

This file is a placeholder showing the per-email block format. Run the
script (see comment block above) to populate it with real drafts.

The format below is what each of the 100 entries will look like in the
real generated output. Note the per-tier opening context — "I emailed you
6 weeks ago" is FACTUALLY TRUE for hot Phase-2 contacts, hedged for warm
contributors, and explicitly absent for cold targets (who weren't in
Phase 2).

---

## Email 001 — HOT — Example Maintainer (@example-maintainer)

- Recipient: example-maintainer@example.com
- Subject: SettleGrid is live — thought you'd want to see it
- Sent: [ ]

Hey Example,

The streaming-parser switch in async-pdf-toolkit (the OOM-on-500MB PR) is the kind of detail I notice.

I emailed you about SettleGrid 6 weeks ago. We're live today: per-call billing for any MCP server, one command to wrap an existing repo. Launch post: https://settlegrid.ai/learn/blog/settlegrid-templates-launch.

30 seconds — click the gallery and tell me what's broken: https://settlegrid.ai/templates. Or, since you forked settlegrid/settlegrid-airbyte, run `npx settlegrid add github:your-fork --dry-run` and tell me what the codemod did.

Or reply with a time if you want a 15-minute walkthrough.

— Lex

---
Lex, Founder, SettleGrid (Alerterra, LLC) · 123 Example St, San Francisco, CA 94110
Reply STOP and I won't email you again.

---

## Email 002 — WARM — Example Contributor (@example-contributor)

- Recipient: (email missing — resolve before sending)
- Subject: SettleGrid is live — thought you'd want to see it
- Sent: [ ]

Hey Example,

Saw mcp-stripe-tool — agent payment tools is exactly the wedge I keep running into.

I sent some MCP-server outreach 6 weeks ago and you may have seen it. We're live today: per-call billing for any MCP server, one command to wrap an existing repo. Launch post: https://settlegrid.ai/learn/blog/settlegrid-templates-launch.

30 seconds — click the gallery and tell me what's broken: https://settlegrid.ai/templates. Or, if you maintain a list or registry of MCP servers, I'd value 60 seconds of "this would land better if…" feedback.

Or reply with a time if you want a 15-minute walkthrough.

— Lex

---
Lex, Founder, SettleGrid (Alerterra, LLC) · 123 Example St, San Francisco, CA 94110
Reply STOP and I won't email you again.

---

## Email 003 — COLD — Example Author (@example-author)

- Recipient: example-author@example.com
- Subject: SettleGrid is live — thought you'd want to see it
- Sent: [ ]

Hey Example,

The HS-6 / EU TARIC harmonization issue on geo-tariff-classifier is unusually careful work for a side project.

We launched this week. I'm reaching out cold because your repo surfaced in our public-MCP crawl — feel free to ignore. SettleGrid adds per-call billing to any MCP server in one command. Launch post: https://settlegrid.ai/learn/blog/settlegrid-templates-launch.

30 seconds — click the gallery and tell me what's broken: https://settlegrid.ai/templates. 

Or reply with a time if you want a 15-minute walkthrough.

— Lex

---
Lex, Founder, SettleGrid (Alerterra, LLC) · 123 Example St, San Francisco, CA 94110
Reply STOP and I won't email you again.

---

(In the real generated output, 97 more entries follow.)
