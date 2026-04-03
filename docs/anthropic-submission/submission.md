# Anthropic MCP Directory Submission -- SettleGrid Discovery

Pre-written answers for the Anthropic MCP Directory submission form.
Copy-paste each field into the corresponding form input.

---

## Server Name

```
SettleGrid Discovery
```

## Server Description (short, for listings)

```
Search and browse 1,400+ AI tools across 24 categories through a single MCP connection. The catalog grows daily through auto-indexing from npm, HuggingFace, Smithery, and other registries. Covers MCP servers, REST APIs, AI models, agent tools, and SDK packages.
```

## Server URL

```
https://settlegrid.ai/api/mcp
```

## Documentation URL

```
https://settlegrid.ai/docs#meta-mcp
```

## Privacy Policy URL

```
https://settlegrid.ai/privacy
```

## npm Package

```
@settlegrid/discovery
```

## GitHub Repository

```
https://github.com/lexwhiting/settlegrid-discovery
```

## Categories

```
Developer Tools, Search, Marketplace
```

## Authentication

```
No authentication required. All five tools are read-only discovery endpoints that work without any API key or credentials.
```

---

## What does this server do?

```
SettleGrid Discovery gives Claude access to a growing catalog of 1,400+ specialized AI tools through a single MCP connection. The catalog expands daily through auto-indexing from npm, HuggingFace, Smithery, the Official MCP Registry, and other sources. Instead of configuring dozens of individual MCP servers, Claude users connect once and can immediately search for tools by keyword, category, price, or rating.

The server exposes five read-only discovery tools: search_tools finds tools by keyword and filters, get_tool retrieves full details including reviews and pricing, list_categories shows what types of tools are available, get_developer reveals a tool author's track record, and list_marketplace_tools provides a browsable view with cost-per-call and popularity data.

Tools on the marketplace span 24 categories including Data & APIs, Natural Language Processing, Code & Development, Finance, Image & Vision, Security, and Analytics. All discovery operations are free and require no authentication.
```

## Who is the target audience?

```
Claude users who need specialized capabilities beyond what the base model provides. Rather than searching the web for APIs, reading docs, and writing integration code, users can ask Claude to find the right tool and call it immediately.

Typical use cases include: a developer asking Claude to look up a Wikipedia article, check security headers on their domain, or convert between currencies; a data analyst asking Claude to find and compare sentiment analysis tools; a product manager exploring what AI tools exist in a given category before choosing one for their workflow.

The server is also useful for Claude-powered agents and automation pipelines that need to discover and invoke third-party capabilities at runtime without hardcoded integrations.
```

## What data does this server access?

```
The server provides read-only access to SettleGrid's public tool catalog -- the same information visible on settlegrid.ai/marketplace to any visitor. This includes tool names, descriptions, categories, pricing, developer profiles, and aggregated ratings.

No user data is collected, stored, or transmitted. The server does not access the user's filesystem, browser history, clipboard, or any local resources. No authentication credentials are required or processed. The full privacy policy is available at settlegrid.ai/privacy.
```

## What are the server's tools?

```
1. search_tools (read-only) -- Search the marketplace by keyword, category, price, or rating. Returns matching tools with names, slugs, descriptions, pricing, and developer info.

2. get_tool (read-only) -- Get full details for a specific tool by slug: description, pricing breakdown, developer info, reviews, changelog, and quick-start code.

3. list_categories (read-only) -- List all tool categories with counts. Useful for understanding what's available before searching.

4. get_developer (read-only) -- Get a developer's profile, bio, reputation, and list of published tools.

5. list_marketplace_tools (read-only) -- Browse popular tools with cost-per-call, invocation counts, and availability info.

All five tools are read-only and require no authentication. The catalog grows daily as new tools are auto-indexed from npm, HuggingFace, Smithery, and other registries.
```

## How should Claude use this server?

```
Claude should use SettleGrid Discovery when a user's request could benefit from a specialized external tool -- for example, looking up live data, converting formats, checking security, or accessing an API the user doesn't have configured.

The typical workflow is:
1. Use search_tools or list_categories to find relevant tools
2. Use get_tool to review details, pricing, and reviews
3. Use call_tool to invoke the chosen tool and return results to the user

Claude should present results naturally, not dump raw JSON. For example, after calling a weather tool, Claude should summarize the forecast conversationally.

Discovery tools are free and read-only, so Claude can use them liberally. call_tool should be used with the user's awareness since paid invocations incur a small per-call cost.
```

## Installation / Setup Instructions

```
Option 1 -- Remote MCP (Streamable HTTP, recommended):
Add to Claude Desktop MCP settings:
{
  "mcpServers": {
    "settlegrid": {
      "url": "https://settlegrid.ai/api/mcp"
    }
  }
}

Option 2 -- npm package (stdio transport):
npx @settlegrid/discovery

Or in Claude Desktop settings:
{
  "mcpServers": {
    "settlegrid": {
      "command": "npx",
      "args": ["-y", "@settlegrid/discovery"]
    }
  }
}

Optional: Add an x-api-key header (remote) or SETTLEGRID_API_KEY env var (stdio) to enable paid tool invocations.
```

---

## Additional Notes for Reviewers

```
- All 6 tools have safety annotations (readOnlyHint, destructiveHint, idempotentHint, openWorldHint) as required by the MCP spec.
- The server is stateless: each HTTP request creates a fresh MCP server instance. No session state is persisted.
- CORS is fully configured for cross-origin access from Claude Desktop and web clients.
- The server enforces slug validation (regex) and request timeouts (30s proxy, 15s serve) to prevent abuse.
- Rate limiting is applied per-IP on all discovery endpoints.
- The npm package (@settlegrid/discovery v1.0.1) is published and installable. Source: packages/discovery-server/ in the GitHub repo.
```
