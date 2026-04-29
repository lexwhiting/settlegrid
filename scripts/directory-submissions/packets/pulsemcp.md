# Submission Packet — PulseMCP

**Directory:** https://www.pulsemcp.com
**Submission type:** `hybrid`
**Submission status:** `verified` (verified upstream 2026-04-20)
**Submission entry URL:** https://www.pulsemcp.com/submit

## 1. Paste-ready values

### Name
```
SettleGrid
```

### Tagline
```
The Settlement Layer for the AI Economy
```

### Description (medium variant, 125 chars)
```
Settlement layer for AI tools. Per-call billing, Stripe payouts, and multi-protocol payments for MCP tools, APIs, and agents.
```

### Tags (CSV)
```
mcp, settlement, billing, monetization, payments, stripe, ai-agents, per-call-billing, x402, api-gateway
```

### Tags (hashtag format)
```
#mcp #settlement #billing #monetization #payments #stripe #ai-agents #per-call-billing #x402 #api-gateway
```

### Links
- Homepage: https://settlegrid.ai
- GitHub: https://github.com/lexwhiting/settlegrid
- NPM package: https://www.npmjs.com/package/@settlegrid/mcp
- Docs: https://settlegrid.ai/docs
- Demo: _not yet published — leave blank or use the homepage if the form requires a value_

### Contact
- Author: Lex Whiting (@lexwhiting)
- Email: lex@settlegrid.ai

## 2. Assets

No specific logo format declared by this directory; the SVG logos below are typically accepted.

- `apps/web/public/logos/icon-color.svg` (svg, Square icon mark (color, theme-agnostic background))
  Raw URL: https://raw.githubusercontent.com/lexwhiting/settlegrid/main/apps/web/public/logos/icon-color.svg
- `apps/web/public/logos/logo-color-light.svg` (svg, Horizontal wordmark for light backgrounds)
  Raw URL: https://raw.githubusercontent.com/lexwhiting/settlegrid/main/apps/web/public/logos/logo-color-light.svg
- `apps/web/public/logos/logo-color-dark.svg` (svg, Horizontal wordmark for dark backgrounds)
  Raw URL: https://raw.githubusercontent.com/lexwhiting/settlegrid/main/apps/web/public/logos/logo-color-dark.svg
- `apps/web/public/favicon-32.png` (png, 32×32 favicon (fallback PNG — directories needing 400×400 PNG require a conversion step noted in the packet))
  Raw URL: https://raw.githubusercontent.com/lexwhiting/settlegrid/main/apps/web/public/favicon-32.png

### Screenshots

The following screenshots are in the repo and can be attached directly or linked via the raw URL:

- `apps/web/public/screenshots/Dashboard 1.jpg`
  Raw URL: https://raw.githubusercontent.com/lexwhiting/settlegrid/main/apps/web/public/screenshots/Dashboard%201.jpg
- `apps/web/public/screenshots/Dashboard 2.jpg`
  Raw URL: https://raw.githubusercontent.com/lexwhiting/settlegrid/main/apps/web/public/screenshots/Dashboard%202.jpg
- `apps/web/public/screenshots/Analytics 1.jpg`
  Raw URL: https://raw.githubusercontent.com/lexwhiting/settlegrid/main/apps/web/public/screenshots/Analytics%201.jpg
- `apps/web/public/screenshots/Discovery 1.jpg`
  Raw URL: https://raw.githubusercontent.com/lexwhiting/settlegrid/main/apps/web/public/screenshots/Discovery%201.jpg
- `apps/web/public/screenshots/Home Page Protocol.jpg`
  Raw URL: https://raw.githubusercontent.com/lexwhiting/settlegrid/main/apps/web/public/screenshots/Home%20Page%20Protocol.jpg

## 3. Step-by-step submission

PulseMCP does not have a direct web form. Their flow is: publish to the Official MCP Registry first, then PulseMCP ingests daily and processes weekly.

1. **Publish to the Official MCP Registry.** This is the upstream source. See https://github.com/modelcontextprotocol/registry for the current registry publication flow (JSON entry in a specific repo location, or via the registry API).
2. Wait ~1 week after the registry entry is live. PulseMCP's ingest runs daily, their processing runs weekly.
3. If after a week the listing hasn't appeared on pulsemcp.com, go to `https://www.pulsemcp.com/submit` and send an email via the address listed on that page with:
   - The URL (GitHub repo, subfolder, or standalone site)
   - A short note explaining the listing
   - Any adjustments requested to an existing listing
4. No separate form submission — email is the only direct channel.

## 4. Fields & limits

**Required fields (known at scaffold time):**

- `mcpRegistryPublication`
- `serverUrl`

## 5. Notes

PulseMCP is explicit: they ingest from the Official MCP Registry. Submitting to them without first publishing to the registry is a waste of effort. Treat Registry publication as a prerequisite, not a parallel task.

## 6. Founder checklist

- [ ] Directory is confirmed live and legitimate (especially if `submissionStatus != verified`)
- [ ] Required fields populated from section 1
- [ ] Description pasted verbatim (no silent rewrites that inflate scope)
- [ ] Submission sent
- [ ] Confirmation / review URL captured
- [ ] Status updated in `packets/README.md`

