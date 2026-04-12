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

## What it does

When activated, this skill instructs the agent to:

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
