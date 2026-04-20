# Submission Packet — awesome-mcp-servers (PipedreamHQ)

**Directory:** https://github.com/PipedreamHQ/awesome-mcp-servers
**Submission type:** `pr`
**Submission status:** `partial` (verified upstream 2026-04-20)
**Submission entry URL:** https://github.com/PipedreamHQ/awesome-mcp-servers/compare

> ⚠️ **Partial verification.** Some fields below are best-effort — verify the live form schema at submission time and update this packet.

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
Suggested category: **No clear category section for third-party servers**. If the category does not exist, the PR effectively proposes adding it — justify in the PR description.

```diff
+- [SettleGrid](https://github.com/lexwhiting/settlegrid) - Settlement layer for AI tools. Per-call billing, Stripe payouts, and multi-protocol payments for MCP tools, APIs, and agents.
```

Commit message:
```
Add SettleGrid (the settlement layer for the ai economy)
```

## 4. Step-by-step submission

**Before submitting: verify this directory accepts third-party MCP servers.** Observed during scaffold research (2026-04-20): every entry in PipedreamHQ's list links to `https://mcp.pipedream.com/app/{slug}` — suggesting this is a list of Pipedream's own MCP app integrations, not a general-purpose awesome-list. No `CONTRIBUTING.md` was found.

If the list does accept third-party servers:
1. Fork `https://github.com/PipedreamHQ/awesome-mcp-servers`.
2. Check the README for category structure.
3. Add the bullet using the entry template.
4. Open a PR with a clear justification for adding a non-Pipedream-hosted server.

If the list is Pipedream-internal only: skip this directory. The founder can pursue a Pipedream app listing separately (unrelated to this packet).

## 5. Fields & limits

**Required fields (known at scaffold time):**

- `name`
- `repoUrl`
- `description`

**Character limits:**

| Field | Max | Source |
|-------|-----|--------|
| `description` | 200 | awesome-list convention; PipedreamHQ entries observed at 100-200 chars |

## 6. Notes

Partial verification: repo exists but README is Pipedream-app-centric. A direct PR without prior confirmation of external-server acceptance has a high rejection probability.

## 7. Founder checklist

- [ ] Directory is confirmed live and legitimate (especially if `submissionStatus != verified`)
- [ ] Required fields populated from section 1
- [ ] Description pasted verbatim (no silent rewrites that inflate scope)
- [ ] Submission sent
- [ ] Confirmation / review URL captured
- [ ] Status updated in `packets/README.md`

