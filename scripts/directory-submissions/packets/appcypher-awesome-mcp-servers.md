# Submission Packet — awesome-mcp-servers (appcypher)

**Directory:** https://github.com/appcypher/awesome-mcp-servers
**Submission type:** `pr`
**Submission status:** `verified` (verified upstream 2026-04-20)
**Submission entry URL:** https://github.com/appcypher/awesome-mcp-servers/compare

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

## 3. Exact PR diff

Place the following bullet in `README.md`.
Suggested category: **💰 Finance & Payments (suggested — confirm section exists; if not, propose adding it in the PR)**. If the category does not exist, the PR effectively proposes adding it — justify in the PR description.

```diff
+[![](https://raw.githubusercontent.com/lexwhiting/settlegrid/main/apps/web/public/favicon-32.png)](https://settlegrid.ai) [SettleGrid](https://github.com/lexwhiting/settlegrid) - Settlement layer for AI tools. Per-call billing, Stripe payouts, and multi-protocol payments for MCP tools, APIs, and agents.
```

Commit message:
```
Add SettleGrid (the settlement layer for the ai economy)
```

## 4. Step-by-step submission

1. Fork `https://github.com/appcypher/awesome-mcp-servers`.
2. Check the README's table of contents for a finance/payments/monetization section. If one exists, add the entry there. If not, the PR may propose a new section; justify it in the PR description.
3. Use the entry template (see `prFormat.entryTemplate`). The icon URL should be a direct link to the 32×32 or 64×64 PNG in this repo (`apps/web/public/favicon-32.png`). GitHub serves raw assets at `https://raw.githubusercontent.com/lexwhiting/settlegrid/main/apps/web/public/favicon-32.png`.
4. Commit with a descriptive message (e.g., `Add SettleGrid (settlement layer for AI tools)`).
5. Open a PR against `main`. Reference the CONTRIBUTING.md if the list has merge-style expectations.

## 5. Fields & limits

**Required fields (known at scaffold time):**

- `name`
- `repoUrl`
- `description`
- `category`

**Character limits:**

| Field | Max | Source |
|-------|-----|--------|
| `description` | 140 | awesome-list convention; README entries observed at 80-140 chars |

## 6. Notes

appcypher list uses emoji-prefixed category headers (e.g., 📂 File Systems, 🔄 Version Control). A 'Finance & Payments' or 'Monetization' section may not exist yet — if not, the PR is effectively proposing a new category, which has a lower merge rate. Fallback: file under '💬 Communication' if it relates to agent orchestration, or '🤖 AI & ML' if a more specific bucket isn't available.

## 7. Founder checklist

- [ ] Directory is confirmed live and legitimate (especially if `submissionStatus != verified`)
- [ ] Required fields populated from section 1
- [ ] Description pasted verbatim (no silent rewrites that inflate scope)
- [ ] Submission sent
- [ ] Confirmation / review URL captured
- [ ] Status updated in `packets/README.md`

