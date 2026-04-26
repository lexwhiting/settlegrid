# Submission Packet — cursor.directory

**Directory:** https://cursor.directory
**Submission entry:** https://cursor.directory/generate (web form) **or** PR
to https://github.com/pontusab/cursor.directory (the canonical source-of-truth
repo for the directory's `src/data/rules/`).
**Submission type:** `form` (or `pr` if the rule is non-trivial — pick one,
not both).
**Verification status:** `partial` — the cursor.directory submission flow
is currently a hosted form on the site itself; the public PR-based path
exists in the source repo but its CONTRIBUTING file says "use the form
when possible." Verify both paths at submission time.
**Listed under:** Rules → category `mcp` (request the category if it is
not visible on the form; cursor.directory has been adding categories on
demand as the rule corpus grows).

## 1. Paste-ready values

### Rule title
```
SettleGrid MCP Monetization
```

### Rule slug (URL-safe identifier)
```
settlegrid-mcp-monetization
```

### Short description (≤ 160 chars — for the directory listing card)
```
Wrap MCP server handlers with @settlegrid/mcp for per-call billing — fires only on files that import @modelcontextprotocol/sdk or fastmcp.
```
*Length check: 145 chars.*

### Author / source
```
Lex Whiting (@lexwhiting)
```

### Source repository
```
https://github.com/lexwhiting/settlegrid
```

### Project homepage
```
https://settlegrid.ai
```

### Tags (CSV, paste into the form's tag field — cursor.directory accepts free-form tags)
```
mcp, monetization, billing, typescript, payments
```

### Categories (if the form requires picking from a closed list)
```
- mcp
- typescript (secondary)
```

### Rule body
The full MDC source lives at `mdc-rule.md` in this packet directory.
Paste the **entire contents** of that file (including the YAML
frontmatter) into the form's "Rule" field. Do NOT trim the
frontmatter — cursor.directory's parser uses the `globs` and
`description` fields to render the listing.

## 2. Assets

- **Screenshot:** `screenshot.png` in this packet directory. Founder
  captures this manually — see "Screenshot capture" section below for
  the exact frame to capture.
- **Logo (if requested):** `apps/web/public/logos/icon-color.svg`
  Raw URL: `https://raw.githubusercontent.com/lexwhiting/settlegrid/main/apps/web/public/logos/icon-color.svg`
  PNG fallback: `apps/web/public/favicon-32.png`
  Raw URL: `https://raw.githubusercontent.com/lexwhiting/settlegrid/main/apps/web/public/favicon-32.png`

### Screenshot capture (founder, manual)

cursor.directory typically attaches one screenshot to each rule. Capture
**in Cursor itself**, on a real MCP server file, with the rule active —
this proves the rule actually fires and is not just marketing copy.

Recommended frame:
1. Clone an example MCP server (e.g. https://github.com/lexwhiting/settlegrid → `examples/mcp-quickstart` or similar).
2. Open the MCP server entry file in Cursor.
3. Trigger the rule (e.g. type "monetize this" in the chat panel, or open
   the rule from the rules palette).
4. Capture the chat panel showing the rule's first 3 suggested edits
   (install, init, wrap) — landscape, ~1280×800, dark theme preferred to
   match the cursor.directory listing style.
5. Save as `screenshot.png` in this packet directory, replacing the
   placeholder.

## 3. Step-by-step submission

### Path A — hosted form (preferred)

1. Open https://cursor.directory in a browser. Click the "Submit a Rule"
   or "Generate" link in the top navigation.
2. Sign in via GitHub if prompted (cursor.directory uses GitHub auth for
   attribution).
3. Paste the values from section 1 into the form fields:
   - **Title** → `SettleGrid MCP Monetization`
   - **Description** → the short description above
   - **Tags / Categories** → the CSV from section 1
   - **Author** → your GitHub handle (auto-populated post-login)
   - **Rule body** → the full contents of `mdc-rule.md` (frontmatter + body)
   - **Screenshot** → upload `screenshot.png`
   - **Source URL** (optional) → `https://github.com/lexwhiting/settlegrid`
4. Submit. cursor.directory typically lists rules within 24–72 hours
   after a maintainer review (the project is small; reviews are
   founder-driven, not automated).
5. Capture the resulting public URL (e.g.
   `https://cursor.directory/rules/settlegrid-mcp-monetization`) and
   record it in `README.md` Status table under "Result URL".

### Path B — GitHub PR (fallback if the form is offline)

1. Fork https://github.com/pontusab/cursor.directory.
2. Add a new file at `src/data/rules/<category>/settlegrid-mcp-monetization.tsx`
   following the existing rule modules' pattern. The module exports a
   `Rule` object with `title`, `description`, `tags`, `author`, `slug`,
   and `content` (markdown, can be an imported `.md` file). Use the
   contents of `mdc-rule.md` for the `content` field.
3. Open a PR titled "Add SettleGrid MCP Monetization rule"; the body
   should mirror this packet's section 1 (paste-ready values) so the
   reviewer can spot-check the metadata against the rule body.
4. Reference any pre-existing MCP-category rules for layout precedent
   (the maintainer rejects rules that drift from the established
   structure).

## 4. Fields & limits

| Field | Max | Notes |
|-------|-----|-------|
| `title` | ~80 | Soft cap from rule-card layout; longer titles wrap. |
| `description` | 160 | Hard cap on the listing card. |
| `tags` | 8 | More than 8 tags get truncated in the card UI. |
| `content` | ~32 KB | No documented hard cap; very long rules become hard to scroll. The MDC body in this packet is ~3 KB. |

## 5. Notes

- The rule body is **not** generic developer marketing. It defines
  trigger heuristics that scope activation to files actually importing
  `@modelcontextprotocol/sdk` / `fastmcp` or calling
  `server.tool` / `setRequestHandler`. The hostile-review checklist for
  this packet (`README.md` § "Hostile review") requires that the rule
  fire only on those triggers; if the maintainer asks for a tighter
  scope, add globs / activation gates rather than removing trigger
  conditions.
- The "Source of truth" section of the MDC rule points back to
  `packages/settlegrid-skill/cursor/.cursorrules` in the SettleGrid repo.
  Keep that file in sync (or treat the cursor.directory copy as the
  excerpt and the in-repo copy as the canonical playbook). Drift between
  the two will break the rule's framework-specific examples.

## 6. Founder checklist

- [ ] cursor.directory submission flow is live (form OR PR path verified).
- [ ] `screenshot.png` captured in a real Cursor session showing the
      rule firing on an MCP server file.
- [ ] `mdc-rule.md` matches the in-repo
      `packages/settlegrid-skill/cursor/.cursorrules` source-of-truth.
- [ ] Submitted via the chosen path; the resulting URL captured in
      `README.md`.
- [ ] Status updated in `README.md` from `not-sent` to `sent`.
- [ ] Once accepted, `README.md` Status updated to `accepted` and the
      public listing URL recorded.
