<!--
  ============================================================
  PRE-FLIGHT CHECKLIST — DO NOT SKIP STEPS
  ============================================================

  This checklist is the difference between "shot it once,
  done" and "shot it eight times because Slack pinged
  during take 4." Run it in order on a calm morning, with
  no meetings until the recording is done.

  The checklist is for both the 60-second hero
  (demo-video-script.md) and the 8-minute Loom
  (loom-walkthrough-script.md). Items that apply to only
  one are marked [HERO] or [LOOM]; everything else is for
  both.
-->

# Recording Checklist

## 1. Hardware + environment (30 minutes before)

- [ ] **Plug in laptop.** Battery saver throttles CPU,
      which makes scaffolds slow.
- [ ] **External mic plugged in and tested.** Built-in
      mics on a 2024+ MacBook are good but pick up
      keyboard noise during typing shots. A USB mic on a
      stand 12 inches off-axis works.
- [ ] **Webcam tested at 1080p.** [LOOM only] If using
      Loom's built-in webcam, click the gear and confirm
      the resolution.
- [ ] **Background.** Plain wall, plain bookshelf, or a
      blurred backdrop. No "look at my Funko Pop
      collection" framing.
- [ ] **Lighting from camera-side.** Window or ring light
      between you and the camera, not behind. Backlight =
      silhouette.

## 2. Operating system + notifications (15 minutes before)

- [ ] **macOS Do Not Disturb ON** (Focus → Do Not
      Disturb, schedule until end-of-day to be safe).
- [ ] **Slack quit, not minimized.** Quit the app entirely
      — minimized Slack still triggers macOS notifications.
- [ ] **Discord quit.**
- [ ] **Email client quit.**
- [ ] **Calendar reminders silenced.** Open Calendar →
      Settings → uncheck "Show as alert" for the next 4
      hours.
- [ ] **System sounds OFF.** System Settings → Sound →
      Alert sound: None. (You'll hear a clack if a
      notification slips through; better to not.)
- [ ] **iMessage muted on Mac.** Right-click any thread
      → Hide Alerts.

## 3. Browser setup (10 minutes before)

- [ ] **Quit and relaunch Chrome / your demo browser.**
      Wipes any zombie tabs.
- [ ] **One window, three tabs only:**
      - tab 1: `https://settlegrid.ai/templates`
      - tab 2: `https://settlegrid.ai/mcp` (Loom only)
      - tab 3: Stripe Connect dashboard for the
        sandbox account
- [ ] **Resolution: 1920×1080.** System Settings → Displays
      → Resolution. If recording on a Retina screen, use
      "Looks like 1920×1080" — the recording captures the
      logical resolution.
- [ ] **Browser zoom: 125%.** Cmd-+ twice from default.
      Makes UI text legible at the export resolution.
- [ ] **Hide the bookmarks bar.** Cmd-Shift-B.
- [ ] **Incognito mode is NOT helpful** — extensions
      disabled lose your auth state. Use a clean profile
      if you need a known-good environment.

## 4. Terminal setup (10 minutes before)

- [ ] **Clear terminal history:**
      ```
      history -c && history -w
      ```
      Or open a fresh terminal session.
- [ ] **Terminal font: 16pt minimum.** 18pt for the hero
      video. Default 12pt is unreadable at 1080p.
- [ ] **Terminal width: 120 columns.** Resize the window
      so `tput cols` reports 120 (the COLUMNS env var alone
      doesn't resize anything; the window has to physically
      match). At 1920×1080, 120 cols at 16pt is roughly
      half the screen width.
- [ ] **Color scheme: high contrast.** Avoid Solarized's
      muted palette for video — viewers' phones can't
      render the contrast. Built-in macOS Terminal
      "Pro" theme works.
- [ ] **Prompt: short.** A long Powerline prompt eats
      half the line. Use `PS1='$ '` for the recording or
      a minimal Starship config.
- [ ] **Pre-warm the npm cache** [HERO]:
      `create-settlegrid-tool` does not auto-install
      dependencies — Shot 3 of the demo runs `npm install`
      after the scaffold. Pre-warm the cache so it lands
      under 10 seconds:
      ```
      mkdir -p /tmp/_sg_warm && cd /tmp/_sg_warm \
        && npm init -y >/dev/null 2>&1 \
        && npm install @settlegrid/mcp@latest \
          @settlegrid/cli@latest >/dev/null 2>&1 \
        && cd / && rm -rf /tmp/_sg_warm
      ```
      This populates the npm cache with the SDK + CLI
      packages so the on-camera install hits the cache.
      Run it 5-10 minutes before the take; npm cache TTL
      is per-process but the registry tarballs persist.

## 5. Stripe sandbox (15 minutes before)

- [ ] **Stripe sandbox account exists** — `sk_test_*`
      key in the local `.env`, separate from any
      production key.
- [ ] **Stripe Connect Express test account** linked to
      the sandbox via the SettleGrid onboarding flow.
- [ ] **One test invocation pre-fired** so the dashboard
      isn't empty.
- [ ] **Pre-record a 5-second screen capture** of the
      Stripe dashboard with a fresh invocation event
      landing — used as the PiP overlay in the hero
      video's Shot 5. (Record this BEFORE the main take.)

## 6. Recording software

- [ ] **Hero video** [HERO]: OBS Studio or QuickTime,
      capture-source = display 1, audio source = none
      (record voice-over separately). Start
      recording before the take, count down 3-2-1
      silently, hit the first action.
- [ ] **Loom walkthrough** [LOOM]: Loom desktop client.
      Webcam: upper-right. Audio: external mic. Start
      recording, count down silently, begin.
- [ ] **Test recording.** Record 30 seconds of
      Section 1, play it back, check audio levels (peak
      around -12 to -6 dB), check video (no compression
      artifacts at 1080p).

## 7. Voice-over (post-recording, hero only)

- [ ] **Quiet room.** No HVAC, no fridge hum.
- [ ] **Re-record the voice-over against the silent
      timeline.** This is faster than re-shooting visuals
      when audio fails.
- [ ] **One pass per shot** with a visible stopwatch.
      Trim if a shot's narration runs over the visual
      window.
- [ ] **Don't compress the audio yourself.** Export raw
      WAV; let the editor's normalize-loudness pass do
      the work.

## 8. Export + publish

- [ ] **Hero video MP4** [HERO]:
      - Codec: H.264
      - Resolution: 1920×1080
      - Frame rate: 30fps (60fps doesn't help; doubles
        file size)
      - Bitrate: 5-8 Mbps target
      - Container: MP4
      - Final size: ideally <10MB for Twitter inline
        playback (10MB is the soft limit before
        recompression kicks in)
      - Audio: AAC, 192kbps stereo
- [ ] **YouTube unlisted** [HERO + LOOM]: upload first
      as unlisted, send the URL to one person you trust
      for QA, fix issues, then make public.
- [ ] **Twitter/X**: max 2:20 for video; the 60-second
      hero fits comfortably. Upload native, don't link
      to YouTube.
- [ ] **Product Hunt**: 60-second hero embedded as the
      lead asset. PH prefers MP4 over YouTube embeds.
- [ ] **Blog embed**: serve the MP4 from `/public/`
      with a `<video>` tag, native controls, no autoplay.
      Don't embed YouTube — adds 200KB of player JS and
      tracks viewers.

## 9. Post-publish

- [ ] **Post the Show HN** (per
      `docs/launch/show-hn.md`).
- [ ] **Have the response kit open**
      (`docs/launch/show-hn-response-kit.md`).
- [ ] **First comment (technical deep-dive) within 60
      seconds of submission.**
- [ ] **DO NOT close the laptop.** The first 90 minutes
      are when the launch lives or dies.

---

## What to do if something fails on take

| Failure | Recovery |
|---|---|
| Notification pops mid-take | Re-shoot from the start. Don't try to edit it out. |
| Terminal command misfires | If <0:18, restart. If later, splice from a re-shot segment. |
| npm install >15s | Stop, kill the process, pre-warm again, re-shoot. |
| Stripe dashboard doesn't update | Use the pre-recorded PiP overlay. Don't try to retry the live capture. |
| Voice clips on a word | Re-record JUST the voice-over; visual stays. |
| Total catastrophe | Take a 10-minute walk. Start over fresh. Recording while frustrated is the #1 source of bad takes. |

---

## What success looks like

- One take per video that you'd watch start-to-end without
  cringing.
- Voice-over re-recorded as a second pass, clean.
- Exported MP4 < 10MB for Twitter inline playback.
- YouTube unlisted upload reviewed by one trusted person
  before public.
- Linked from the launch blog post + Show HN first comment
  + Twitter thread + Product Hunt asset.

If any of those is missing, don't post. The launch costs
more than a re-shoot.
