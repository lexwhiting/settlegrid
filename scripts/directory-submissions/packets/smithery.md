# Submission Packet — Smithery

**Directory:** https://smithery.ai
**Submission type:** `cli`
**Submission status:** `verified` (verified upstream 2026-04-20)
**Submission entry URL:** https://smithery.ai/new

## 1. Paste-ready values

### Name
```
SettleGrid
```

### Tagline
```
The Settlement Layer for the AI Economy
```

### Description (long variant, 468 chars)
```
SettleGrid is the settlement layer for the AI economy. Monetize MCP tools, REST APIs, and AI agents with per-call billing, automated Stripe payouts, and a unified gateway across 9+ agent payment protocols (MCP, x402, Stripe MPP, AP2, ACP, UCP, TAP, Verifiable Intent, Circle Nanopayments). Install `@settlegrid/mcp`, wrap your handler with `sg.wrap()` — every call is metered, billed, and settled. Free forever for most devs: 50K ops/mo, progressive take rate from 0%.
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

Smithery has two publication paths:

**Path A — Web UI**:
1. Go to `https://smithery.ai/new`.
2. Enter your server's public HTTPS URL (e.g., `https://mcp.settlegrid.ai/<server-slug>`).
3. Set the namespace + name (e.g., `@settlegrid/settlegrid-mcp`).
4. Submit.

**Path B — CLI**:
1. Run: `npx smithery mcp publish "https://mcp.settlegrid.ai/<server-slug>" -n @settlegrid/settlegrid-mcp`
2. Follow the auth prompts.

**Optional server-card.json**: For richer metadata (logo, description, categories, pricing), host a static file at `<server-url>/.well-known/mcp/server-card.json`. Smithery reads this on ingest. Use the long description (see `descriptionLong` in project metadata) as the `description` field.

## 4. Fields & limits

**Required fields (known at scaffold time):**

- `publicHttpsUrl`
- `namespaceAndName`

## 5. Notes

Smithery is 'bring your own hosting' — SettleGrid must have a deployed MCP server URL before this submission works. As of the SettleGrid v0.2.0 SDK, the public MCP server URL is TBD — the founder needs to deploy a reference server before this packet is actionable.

## 6. Founder checklist

- [ ] Directory is confirmed live and legitimate (especially if `submissionStatus != verified`)
- [ ] Required fields populated from section 1
- [ ] Description pasted verbatim (no silent rewrites that inflate scope)
- [ ] Submission sent
- [ ] Confirmation / review URL captured
- [ ] Status updated in `packets/README.md`

