# Submission Packet — Cline MCP Marketplace

**Directory:** https://github.com/cline/mcp-marketplace
**Submission type:** `issue`
**Submission status:** `verified` (verified upstream 2026-04-20)
**Submission entry URL:** https://github.com/cline/mcp-marketplace/issues/new?template=mcp-server-submission.yml

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

This directory requires a **400×400 PNG** logo. None of the on-disk logo files match that exact spec, so you'll need to convert:

- Source SVG: `apps/web/public/logos/icon-color.svg`
- Conversion (using `sharp-cli`):
  ```sh
  npx sharp-cli -i apps/web/public/logos/icon-color.svg -o /tmp/settlegrid-400.png resize 400 400
  ```
- Alternative: use an online SVG→PNG converter and upload `/tmp/settlegrid-<size>.png` to the submission form.

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

1. Confirm an `llms-install.md` exists at the SettleGrid MCP server repo root (or that the README contains everything Cline needs to set up the server from a blank slate). This is a Cline review requirement.
2. Test the install path: open Cline, point it at the repo's README.md (or llms-install.md), and verify Cline can bring the server up without manual steps.
3. Convert a logo to 400×400 PNG. Starting from `apps/web/public/logos/icon-color.svg`: `npx sharp-cli -i apps/web/public/logos/icon-color.svg -o /tmp/settlegrid-400.png resize 400 400` (or use an online SVG→PNG tool).
4. Open the submission issue using the template URL (see `submissionUrl`). Paste the long description. Attach the 400×400 PNG.
5. Check the two confirmation boxes: install-test confirmation and stability confirmation.
6. Submit. Review by Cline team evaluates community adoption, developer credibility, project maturity, and security.

## 4. Fields & limits

**Required fields (known at scaffold time):**

- `repoUrl`
- `logoPng400`
- `installTestConfirmation`
- `stabilityConfirmation`
- `descriptionLong`

## 5. Notes

Cline reviews gate on security audit quality — be prepared to answer questions about the SDK's code execution surface. Use the SDK's existing sandbox notes (see packages/mcp/README.md).

## 6. Founder checklist

- [ ] Directory is confirmed live and legitimate (especially if `submissionStatus != verified`)
- [ ] Logo converted to 400×400 png
- [ ] Required fields populated from section 1
- [ ] Description pasted verbatim (no silent rewrites that inflate scope)
- [ ] Submission sent
- [ ] Confirmation / review URL captured
- [ ] Status updated in `packets/README.md`

