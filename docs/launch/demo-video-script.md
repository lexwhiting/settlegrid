<!--
  ============================================================
  FOUNDER RECORDING REQUIRED — DO NOT EDIT WITHOUT PRE-FLIGHT
  ============================================================

  This is the shot-by-shot script for the 60-second hero demo
  video that lands on Twitter/X, Product Hunt, and the blog
  embed. The 5-8 minute deep-dive is in
  loom-walkthrough-script.md; the pre-flight is in
  recording-checklist.md.

  Critical pre-record decisions (≤30 min before shooting):

  1. PICK THE COMMAND
     The script as written uses `npx create-settlegrid-tool`
     (interactive, 8 prompts). This is the show-the-magic
     command but the prompts must finish inside Shot 3's
     17-second window — which means rehearsed keystrokes,
     no thinking pauses. If you can't hit the timing in 3
     dry runs, switch to `npx settlegrid add github:<repo>
     --dry-run` (non-interactive, deterministic, but the
     "new project gets created" beat collapses to "codemod
     summary scrolls"). Either is on-spec; pick the one
     you can actually hit in 60 seconds on the day.

  2. PRE-FLIGHT EVERYTHING
     Read recording-checklist.md before you start. Clean
     terminal history, Do Not Disturb on, browser at
     1920×1080 / 125% zoom, all other tabs closed. The
     biggest source of "we have to re-shoot" is a Slack
     ping at 0:42.

  3. RECORD VIDEO + AUDIO SEPARATELY
     Screen capture in OBS / Quicktime, voice-over
     re-recorded against the silent timeline. Lets you
     re-do narration without re-doing visuals. Saves at
     least one re-shoot.

  4. PUBLISH TARGETS
     - Twitter/X: max 60s, 1080p, MP4 H.264, <512MB
     - Product Hunt: 60s recommended, MP4 same encoding
     - Blog embed: same MP4, served via /public + a tiny
       <video> tag, no YouTube embed (loads slow + tracks)
     YouTube unlisted upload first as a QA pass.

  Voice rules: first-person singular. No "platform,"
  "ecosystem," "scale," "unlock," "leverage," "revolutionary,"
  "game-changing." Speak the lines aloud during dry-runs;
  the ones that catch in your throat are the ones to rewrite.
-->

# 60-Second Demo Video — Shot-by-Shot

## Total runtime target

60 seconds, single take on the visual track, separately
recorded voice-over. Aim for 56-58s of visual + a 2-4s
breathing pad at the end for the URL fade.

Voice-over budget: approximately 100-115 words at 150 wpm.
Per-shot word allocation below.

---

## Shot 1 — Gallery hero (0:00-0:08, 8 seconds)

**On screen:**
- Browser at `https://settlegrid.ai/templates`, scrolled to
  the top, hero copy visible.
- Cursor is OFF-screen at frame open.
- At 0:02, cursor enters from the right and lands on a
  featured template card. Pick one with a short, real name
  from the live registry (e.g., "Airbyte", "API Football",
  "Browserbase" — verify the exact name before recording
  via apps/web/public/registry.json). Avoid templates with
  long names that wrap at 1080p.
- At 0:06, cursor hovers; the card lifts (existing CSS
  hover state) showing the per-call price.
- At 0:08, cursor clicks; transition out.

**Voice-over (~14 words):**
> "Every template in this gallery has billing pre-wired.
> Pick one, run one command, and the next call charges."

**Why these visual beats:** the gallery is the launch's
hero surface, so it has to be the first thing the viewer sees.
The hover-and-click sequence telegraphs that the price IS
the spec; viewers internalize "this is monetized" before
the terminal even opens.

---

## Shot 2 — Terminal (0:08-0:18, 10 seconds)

**On screen:**
- Cut to a clean terminal at 1080p, prompt visible at the
  top of the frame.
- At 0:08, the command `npx create-settlegrid-tool
  my-search-api` types in live (use a typing-script tool or
  hand-type. DO NOT paste; pasting reads as fake).
- At 0:13, the command lands; banner prints; first prompt
  appears.
- At 0:14-0:18, the founder answers prompts at high
  velocity. With 8 prompts and ~5 seconds, that's
  ~0.5s/prompt, only achievable with rehearsed keystrokes.

**Voice-over (~17 words):**
> "I run create-settlegrid-tool and walk the prompts.
> Pricing model and per-call rate baked in: five cents."

**Failure mode:** if the prompts take longer than 5 seconds
in your dry run, this shot blows the budget. **Mitigation:**
fall back to `npx settlegrid add github:<a-pinned-repo>
--dry-run` — non-interactive, deterministic timing, the
codemod summary does the visual work. Update the voice-over
line to match: "I run settlegrid add against my existing
repo, dry-run first. The codemod wraps every handler."

---

## Shot 3 — Install output + cd (0:18-0:35, 17 seconds)

**On screen:**
- 0:18-0:22: Scaffolder writes files (this is fast — file
  copy only; create-settlegrid-tool does NOT run npm
  install for you, it prints the next-step instructions
  in a banner).
- 0:22-0:23: success banner appears with three next-step
  commands: `cd my-search-api`, `npm install`,
  `npm run dev`.
- 0:23-0:25: founder types `cd my-search-api && npm
  install` and hits enter.
- 0:25-0:33: npm install runs. On a pre-warmed cache this
  is ~8 seconds; on a cold machine it's 30+ seconds (which
  blows the budget — see Failure mode below).
- 0:33-0:35: founder types `code .` (or window-swaps to
  the editor); editor opens in fade.

**Voice-over (~18 words):**
> "Scaffolds the files, prints the next steps. I run
> npm install: SDK and Stripe wiring land in eight seconds."

**Failure mode:** create-settlegrid-tool emits a banner but
does not auto-run `npm install` — that's a deliberate
choice (some users prefer pnpm/bun/yarn) but it means the
Shot 3 budget includes a real npm-install round-trip.
**Mitigation:** pre-warm the npm cache by running a
throwaway `npm install @settlegrid/mcp@latest` into
`/tmp/_warm` BEFORE recording. Cache hits keep the real
install under 8 seconds. Document the warm-up command in
recording-checklist.md §4.

---

## Shot 4 — Editor highlights the wrap (0:35-0:45, 10 seconds)

**On screen:**
- Editor open on `src/index.ts` (or whatever the template
  emits as the entry file).
- At 0:36, cursor scrolls to the `sg.wrap()` line.
- At 0:38, the line is selected / highlighted (use editor's
  select-line shortcut or a CSS-style overlay in post).
- 0:38-0:45: viewer reads the highlighted snippet.

**Voice-over (~18 words):**
> "Here's the entire integration. One line. sg.wrap wraps
> the handler, meters every call, settles to Stripe."

**Failure mode:** editor cold-start can take 3-5 seconds.
**Mitigation:** open the editor in the background BEFORE
the take starts and switch to it via window-management,
not via the `code .` command. The `code .` line in Shot 3
becomes a visual cue, not a real invocation.

---

## Shot 5 — Test call + Stripe ping (0:45-0:55, 10 seconds)

**On screen:**
- Cut back to terminal in a second pane (or window swap).
- At 0:45, founder runs a curl against the local dev server.
  The exact path depends on the chosen template; use what
  the scaffold actually generated (the success banner from
  Shot 3 includes the dev URL).
- At 0:48, response prints. The body is whatever the handler
  returns; the SDK does not add charge headers to the
  response, so the visual proof of metering lives on the
  dashboard, not in the curl output.
- At 0:50, picture-in-picture (PiP) overlay of the
  SettleGrid publisher dashboard fades in, showing the
  invocation event landing in the ledger (NOT the Stripe
  Connect dashboard — Stripe shows transfers, which happen
  on a rolling schedule, not per-call).
- At 0:55, both panes settle.

**Voice-over (~17 words):**
> "I make a test call. Handler runs, five cents records in
> the ledger, consumer balance ticks down."

**Failure mode:** the SettleGrid dashboard refresh isn't
synchronous with the curl response (~1-3s lag depending on
metering-pipeline state). **Mitigation:** record the
dashboard step SEPARATELY (3-5 seconds of landed-event UI),
composite as a PiP overlay in post. Do not try to capture
the live metering on the same take. It is the failure mode
that costs the most reshoots.

---

## Shot 6 — End card (0:55-1:00, 5 seconds)

**On screen:**
- Fade to a static end card on a dark background (the
  brand's deep indigo from /pricing's hero gradient is
  fine).
- Center: SettleGrid wordmark or logomark.
- Below: `settlegrid.ai` in monospace.
- Below that, smaller: "Free tier · 50,000 ops/month".
- Hold for 5 seconds; cut to black.

**Voice-over (~15 words):**
> "Free tier is fifty thousand calls a month, zero take
> rate to start. Settlegrid dot ai."

**Failure mode:** end card looks AI-generated if it's
template-y. **Mitigation:** use the same typeface +
spacing as the actual marketing site. Build the end card
in Figma, export as a 1080p PNG, hold static — don't
animate.

---

## Voice-over total

Rough word count across the 6 shots: 14 + 22 + 30 + 18 + 20
+ 9 = **113 words**. At 150 wpm that's about 45 seconds of
speech, leaving ~15 seconds of silent visuals (Shots 1, 3
install scroll, 5 dashboard ping). Within the 60-second
envelope.

Read the voice-over aloud with a stopwatch during each
dry-run. If it consistently runs over 50 seconds, trim
Shot 3's narration first — the install-scroll visual
carries that beat without needing many words.

---

## Things that will go wrong (consolidated)

The per-shot mitigations above are the load-bearing ones.
Here's the consolidated risk register so you can scan it
during the pre-record check:

- **CLI prompts blow the timing budget.** Shot 2-3.
  Mitigation: rehearse 3 dry runs OR fall back to
  `settlegrid add` non-interactive command.
- **npm install slow on cold cache.** Shot 3.
  Mitigation: pre-warm the npm cache with `npx
  create-settlegrid-tool throwaway-warm-up` before the
  real take.
- **Editor cold-start.** Shot 4. Mitigation: editor open
  in background, swap windows, don't actually invoke
  `code .` at runtime.
- **Stripe webhook delay.** Shot 5. Mitigation: record
  Stripe dashboard separately, composite as PiP overlay.
- **Notification interrupt mid-take.** Any shot.
  Mitigation: Do Not Disturb everywhere (Slack, Discord,
  email, calendar reminders). Recording-checklist.md
  enumerates.
- **Microphone clipping on excited delivery.** Voice-over
  re-record. Mitigation: voice-over recorded SEPARATELY
  in a quiet pass; visuals don't need re-shoot if audio
  clips.
