# Cursor Rule: SettleGrid Monetization

This directory contains a `.cursorrules` file that teaches Cursor IDE's agent how to wrap any MCP server with SettleGrid billing.

## Usage

1. Copy `.cursorrules` to the root of your project:
   ```bash
   cp node_modules/@settlegrid/skill/cursor/.cursorrules .cursorrules
   ```

2. Restart Cursor (or reload the window) so it picks up the new rule file.

3. Open your MCP server file (e.g. `src/server.ts`) and ask Cursor:
   > @settlegrid monetize this

   Cursor will read the rules and walk you through the 12-step playbook — installing the SDK, wrapping handlers, adding pricing, and testing the integration.

## How it differs from the Anthropic Skill

| | Anthropic Skill (`SKILL.md`) | Cursor Rule (`.cursorrules`) |
|---|---|---|
| Format | YAML frontmatter + markdown | Plain markdown, no metadata |
| Examples | Separate files in `examples/` | Inlined in the rule file |
| Activation | Automatic via `when_to_use` | User invokes via `@settlegrid` |
| Context limit | None (streamed) | ~3500 words recommended |

The playbook steps and anti-patterns are identical in both files. If you find a discrepancy, the `SKILL.md` is the source of truth.

## License

MIT
