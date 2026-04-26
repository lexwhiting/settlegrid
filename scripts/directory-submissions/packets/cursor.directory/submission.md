# Submission Packet — cursor.directory

**Directory:** https://cursor.directory
**Submission entry:** https://cursor.directory/plugins/new
**Submission type:** `form` (web only — there is no PR path; cursor.directory's repo
README states "all content is submitted through the website — no pull requests
needed for data").
**Verification status:** `verified` against
https://github.com/pontusab/cursor.directory's submission docs (2026-04-26).
**Spec the directory follows:** [Open Plugins specification](https://open-plugins.com/plugin-builders/specification).
A "plugin" is a self-contained directory bundling skills, agents, **rules**,
hooks, MCP servers, and/or LSP servers. cursor.directory auto-discovers
the components in a submitted plugin repo — it does NOT accept rule
content pasted directly into a textarea.

## 1. What cursor.directory actually wants

Submission flow (per `cursor.directory/plugins/new` and the
`pontusab/cursor.directory` repo README):

1. Sign in via GitHub **or** Google.
2. Paste **one** GitHub repository URL pointing at a plugin repo that
   conforms to the Open Plugins spec.
3. cursor.directory's auto-detector reads `plugin.json` at the repo
   root and walks the `rules/` directory; each `*.mdc` file in there
   becomes a separate rule listing on the directory.
4. Submit. The directory's maintainers review the listing within 24-72
   hours.

There is **no per-field form** for the rule's title, tags, or screenshot.
All metadata comes from the plugin repo itself (frontmatter on each
`.mdc` file + the `plugin.json` manifest). The pre-existing packets in
`scripts/directory-submissions/packets/*.md` use form-based
"paste-ready values" sections; this packet doesn't, because the form
doesn't exist.

## 2. The plugin repo the founder needs

cursor.directory needs to point at a GitHub repo that has at least:

```
<plugin-root>/
  plugin.json                                      # Open Plugins manifest
  rules/
    settlegrid-mcp-monetization.mdc                # the rule body — same content as `mdc-rule.md` in this packet
```

### Two ways to ship that

**Option A (preferred — least churn): create `settlegrid-cursor-plugin` as a separate repo.**

A small public repo like `github.com/lexwhiting/settlegrid-cursor-plugin`
keeps the cursor.directory submission decoupled from the SettleGrid
monorepo's release cycle. The plugin repo's only job is to host the
`plugin.json` + `rules/*.mdc` for cursor.directory's crawler. When the
canonical playbook in
`packages/settlegrid-skill/cursor/.cursorrules` changes, mirror the
update into the plugin repo's `rules/*.mdc`.

**Option B (lower friction, more coupling): add `plugin.json` + `rules/` to the existing SettleGrid repo root.**

cursor.directory will scan the entire SettleGrid repo every time it
re-crawls, which is fine but means churn in unrelated parts of the
monorepo can trigger spurious re-listings. Pick Option A unless the
founder specifically wants the cursor.directory listing to track the
main repo's commit cadence.

### `plugin.json` (canonical)

The Open Plugins spec requires only the `name` field; everything else
is optional. The minimum viable manifest:

```json
{
  "name": "settlegrid-mcp-monetization"
}
```

The richer recommended manifest (still spec-compliant):

```json
{
  "name": "settlegrid-mcp-monetization",
  "version": "0.1.0",
  "description": "Wrap MCP server handlers with @settlegrid/mcp for per-call billing — fires only on files that import @modelcontextprotocol/sdk or fastmcp.",
  "author": "Lex Whiting <lex@settlegrid.ai>",
  "homepage": "https://settlegrid.ai",
  "license": "MIT"
}
```

Constraints on `name`: `1-64 chars`, lowercase alphanumeric, hyphens,
and periods (`a-z`, `0-9`, `-`, `.`). The slug
`settlegrid-mcp-monetization` is 30 chars and conforms.

### `rules/settlegrid-mcp-monetization.mdc`

Copy the **entire contents** of `mdc-rule.md` from this packet
(frontmatter + body) into the plugin repo at
`rules/settlegrid-mcp-monetization.mdc`. The file extension changes
from `.md` to `.mdc` — Cursor's MDC parser keys on the extension —
but the contents are byte-identical.

## 3. Step-by-step submission

1. **Create the plugin repo** (Option A) or commit `plugin.json` + `rules/` to
   the SettleGrid repo root (Option B).
2. **Push** the plugin repo to GitHub. Make sure it is **public**;
   cursor.directory's crawler can't see private repos.
3. **Take a screenshot** for marketing reuse (Twitter / launch posts /
   Show HN). cursor.directory's auto-detector currently does not consume
   a screenshot, but the founder will want one anyway when announcing the
   listing — see `screenshot.png` placeholder in this packet and the
   "Screenshot capture" section below.
4. **Open** https://cursor.directory/plugins/new in a browser.
5. **Sign in** via GitHub (preferred — cursor.directory's auth maps GitHub
   identity to the rule's author field) or Google.
6. **Paste** the plugin repo's GitHub URL into the form's repo field
   (e.g. `https://github.com/lexwhiting/settlegrid-cursor-plugin`).
7. **Submit.** cursor.directory's crawler will walk the repo, parse
   `plugin.json`, enumerate `rules/*.mdc`, and create a draft listing.
   Maintainer review usually lands within 24-72 hours.
8. **Capture the resulting public URL** (e.g.
   `https://cursor.directory/rules/settlegrid-mcp-monetization`) and
   record it in `README.md` Status table under "Result URL".

### Screenshot capture (founder, manual — for marketing, not the directory itself)

Optional for cursor.directory's listing but useful for launch
announcements:

1. Clone an example MCP server (e.g.
   `https://github.com/lexwhiting/settlegrid` → `examples/mcp-quickstart`
   or any quickstart that imports `@modelcontextprotocol/sdk`).
2. Open the MCP server entry file in Cursor.
3. Trigger the rule (type "monetize this" in the chat panel, or open the
   rule from the rules palette).
4. Capture the chat panel showing the rule's first 3 suggested edits
   (install, init, wrap) — landscape, ~1280×800, dark theme preferred.
5. Save as `screenshot.png` in this packet directory, replacing the
   placeholder.

## 4. Fields & limits

These come from the **MDC rule's frontmatter** + the **plugin.json
manifest**, NOT a form on cursor.directory.

### MDC frontmatter (one rule per `.mdc` file)

| Frontmatter key | Required | Notes |
|-----------------|----------|-------|
| `description` | yes | Cursor's auto-rule-selection AI uses this string verbatim. Keep it specific, not vague — see `mdc-rule.md` for the canonical text. |
| `globs`     | no   | YAML array of glob patterns. Cursor's MDC parser accepts both array and comma-separated string forms; this packet uses the array form for readability. |
| `alwaysApply` | no | `false` for SettleGrid (the rule should NOT auto-apply on every TS file — it activates via the description match + body trigger heuristics). |

### `plugin.json` (Open Plugins manifest)

| Field | Required | Notes |
|-------|----------|-------|
| `name` | yes | 1-64 chars, lowercase alphanumeric + hyphens/periods. SettleGrid uses `settlegrid-mcp-monetization`. |
| `version` | no | SemVer. Bump when the rule body changes materially. |
| `description` | no | One-sentence summary; surfaced on the cursor.directory plugin card. |
| `author` | no | Free-form name + email; cursor.directory may auto-link to a GitHub profile. |
| `homepage` | no | Use https://settlegrid.ai. |
| `license` | no | SettleGrid uses `MIT` for the cursor plugin. |

## 5. Notes

- **Common deviation pitfall.** Earlier versions of this packet
  described a "paste-each-field" form at `cursor.directory/generate`
  and a GitHub-PR fallback against `pontusab/cursor.directory`. Both
  were wrong: the canonical submission is a single repo URL paste at
  `cursor.directory/plugins/new`, and the maintainers explicitly do
  not accept content PRs. If the form ever changes shape, the
  authoritative source is the
  [`pontusab/cursor.directory` README](https://github.com/pontusab/cursor.directory)
  and the [Open Plugins specification](https://open-plugins.com/plugin-builders/specification).
- The rule body is **not** generic developer marketing. Trigger
  heuristics scope activation to files actually importing
  `@modelcontextprotocol/sdk` / `fastmcp` or calling
  `server.tool` / `setRequestHandler`. The hostile-review checklist in
  `README.md` requires a negative-test (open a non-MCP file → confirm
  the rule does not fire) before the founder submits.
- The "Source of truth" section of the MDC rule points back to
  `packages/settlegrid-skill/cursor/.cursorrules`. Keep the plugin
  repo's `rules/settlegrid-mcp-monetization.mdc` in sync with that
  canonical playbook (or have the playbook treat the plugin's `.mdc`
  as the excerpt and the in-repo `.cursorrules` as canonical). Drift
  between the two will silently break the rule's framework-specific
  examples.

## 6. Founder checklist

- [ ] Plugin repo decision made (Option A new repo vs. Option B in-monorepo).
- [ ] `plugin.json` written, `name` field is 1-64 lowercase / hyphens / periods.
- [ ] `rules/settlegrid-mcp-monetization.mdc` matches `mdc-rule.md` in this
      packet **and** the canonical
      `packages/settlegrid-skill/cursor/.cursorrules`.
- [ ] Plugin repo is public on GitHub.
- [ ] Submitted via https://cursor.directory/plugins/new with the
      plugin repo URL.
- [ ] `screenshot.png` captured in a real Cursor session (for launch
      announcements; cursor.directory itself does not currently
      consume screenshots).
- [ ] Resulting cursor.directory listing URL captured in `README.md`.
- [ ] `README.md` Status updated from `not-sent` to `sent`, then to
      `accepted` once the listing is live.
