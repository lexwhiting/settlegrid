# @settlegrid/skill

Anthropic Skill for monetizing any MCP server with [SettleGrid](https://settlegrid.ai).

## What is a Skill?

An [Anthropic Skill](https://docs.anthropic.com/en/docs/agents-and-tools/skills) is a portable instruction set that LLM agents can load at runtime to acquire new capabilities. Skills are defined by a `SKILL.md` file with YAML frontmatter describing when the skill should activate and what inputs it needs.

## Install

```bash
npm install @settlegrid/skill
```

The package is a content-only artifact — no runtime code, no dependencies. It ships a `SKILL.md` that agents read directly.

## Loading in Claude Desktop

1. Install the package in your project (or globally).
2. Point Claude Desktop at the `SKILL.md` file:
   - Open Claude Desktop settings
   - Under **Skills**, add the path to `node_modules/@settlegrid/skill/SKILL.md`
3. Ask Claude to "monetize this MCP server" while viewing your `src/server.ts`.

Claude will read the skill instructions and walk you through wrapping your server with the SettleGrid SDK.

## Using with Cursor

The same playbook ships as a [`.cursorrules`](https://github.com/lexwhiting/settlegrid/tree/main/packages/settlegrid-skill/cursor) file for Cursor IDE — you don't need a separate extension. Per [ADR-004](https://github.com/lexwhiting/settlegrid/blob/main/docs/decisions/ADR-004-cursor-extension.md), the Skill + Cursor rule combination is the supported integration for every AI-coding surface (Claude Desktop, Claude Code, Cursor, Windsurf via MCP).

```bash
# From the root of your project:
npm install @settlegrid/skill

# If you DO NOT already have a .cursorrules file:
cp node_modules/@settlegrid/skill/cursor/.cursorrules .

# If you DO already have a .cursorrules file, append rather than overwrite:
cat node_modules/@settlegrid/skill/cursor/.cursorrules >> .cursorrules

# Then in Cursor, open your MCP server file and ask:
#   @settlegrid monetize this
```

Cursor reads `.cursorrules` automatically — no marketplace install, no IDE restart required (a window reload picks it up). The 12-step playbook is byte-for-byte identical to the one the Anthropic Skill runs.

If you find a discrepancy between `SKILL.md` and `cursor/.cursorrules`, the SKILL.md is canonical — file an issue and the next release will sync the two.

## What it does

When activated, this skill (or the Cursor rule) instructs the agent to:

1. Detect the user's MCP server entry file
2. Install `@settlegrid/mcp` as a dependency
3. Wrap each tool handler with `settlegrid.init()` + `sg.wrap()`
4. Add pricing configuration
5. Verify the result compiles

## Files

| File | Purpose |
|------|---------|
| `SKILL.md` | Anthropic Skills v1 metadata + instructions |
| `examples/` | Before/after code samples (populated by P1.8) |
| `cursor/` | Cursor IDE variant (populated by P1.9) |
| `README.md` | This file |

## License

MIT
