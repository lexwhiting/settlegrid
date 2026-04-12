---
name: monetize-this-mcp
description: >-
  Wraps a user's existing MCP server with the SettleGrid SDK to enable
  pay-per-call billing in under 60 seconds.
when_to_use: >-
  User asks to "monetize", "add billing to", "charge for", or "add payment to"
  their MCP server, or shows an MCP server file and asks how to make money
  from it.
version: 0.1.0
inputs:
  - name: server_file_path
    description: Path to the MCP server entry file (usually src/server.ts or index.ts)
    required: true
  - name: pricing_cents
    description: Default price per call in cents
    required: false
    default: 1
---

<!-- P1.8 will fill this in with the full skill instructions, code transforms,
     validation steps, and example before/after diffs. The frontmatter above
     is the complete Anthropic Skills v1 metadata that agents use to decide
     when to load this skill. -->
