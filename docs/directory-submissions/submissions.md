# MCP Directory Submission Templates

Pre-written submission content for 7 community MCP directories. Copy-paste the relevant section into each directory's submission form or issue template.

---

## 1. mcp.so

**Submission method:** GitHub issue at the mcp.so repository

**Issue title:** Add SettleGrid Discovery

**Issue body:**

```
### Server name
SettleGrid Discovery

### Description
MCP server for discovering and invoking monetized AI tools. Agents connect to search the SettleGrid marketplace by keyword or category, inspect tool details and pricing, and call any tool — all through the Model Context Protocol. Supports per-call billing via Stripe Connect.

### Server URL / Endpoint
https://settlegrid.ai/api/mcp

### npm package
@settlegrid/discovery

### GitHub repository
https://github.com/lexwhiting/settlegrid

### Install command
npx @settlegrid/discovery

### Categories
Developer Tools, Marketplace, Search

### Transport
stdio, Streamable HTTP

### Tools provided
- search_tools — Search marketplace tools by keyword, category, or rating
- get_tool — Get full details for a tool by slug
- list_categories — List all tool categories with counts
- get_developer — Get a developer profile and published tools
- list_marketplace_tools — Browse popular tools with pricing info
- call_tool — Invoke any marketplace tool by slug

### Author
Alerterra, LLC

### License
MIT
```

---

## 2. PulseMCP

**Submission method:** Submit button on pulsemcp.com

**Form fields:**

- **Server name:** SettleGrid Discovery
- **Short description:** Discover and invoke monetized AI tools on the SettleGrid marketplace. Search by keyword, browse categories, inspect pricing, and call any tool — all through MCP.
- **GitHub URL:** https://github.com/lexwhiting/settlegrid
- **npm package:** @settlegrid/discovery
- **Website:** https://settlegrid.ai
- **Category:** Developer Tools
- **Tags:** marketplace, billing, monetization, tool-discovery, search
- **Install command:** `npx @settlegrid/discovery`
- **Transport:** stdio
- **Author:** Alerterra, LLC
- **License:** MIT

---

## 3. Smithery

**Submission method:** CLI publish (`npx @smithery/cli publish`) or Smithery dashboard

**CLI steps:**

```bash
cd packages/discovery-server
npx @smithery/cli publish
```

The `server.json` file is already in place at `packages/discovery-server/server.json` and follows the Smithery schema.

**If using the dashboard, provide:**

- **Name:** settlegrid-discovery
- **Display name:** SettleGrid Discovery
- **Description:** MCP server for the SettleGrid AI tool marketplace. Search, browse, and invoke monetized tools with per-call billing. Supports 6 tools: search, detail, categories, developer profiles, popular listings, and direct invocation.
- **Repository:** https://github.com/lexwhiting/settlegrid
- **Subfolder:** packages/discovery-server
- **npm package:** @settlegrid/discovery
- **Version:** 1.0.1
- **Transport:** stdio
- **Environment variables:**
  - `SETTLEGRID_API_URL` (optional, default: https://settlegrid.ai)

---

## 4. Cline Marketplace

**Submission method:** GitHub issue at github.com/cline/mcp-marketplace

**Issue title:** [New Server] SettleGrid Discovery

**Issue body:**

```
### Server Name
SettleGrid Discovery

### Description
Search, browse, and invoke monetized AI tools on the SettleGrid marketplace through MCP. Supports keyword search, category filtering, developer profiles, pricing inspection, and direct tool invocation with per-call billing.

### npm Package
@settlegrid/discovery

### GitHub Repository
https://github.com/lexwhiting/settlegrid

### Install Command
npx @settlegrid/discovery

### Configuration
```json
{
  "settlegrid-discovery": {
    "command": "npx",
    "args": ["-y", "@settlegrid/discovery"]
  }
}
```

### Transport
stdio

### Number of Tools
6

### Tool Names
search_tools, get_tool, list_categories, get_developer, list_marketplace_tools, call_tool

### Categories
Developer Tools, Marketplace, Search

### Author
Alerterra, LLC (support@settlegrid.ai)

### License
MIT

### Website
https://settlegrid.ai
```

---

## 5. Glama.ai

**Submission method:** GitHub login to claim on glama.ai

**Profile fields:**

- **Server name:** SettleGrid Discovery
- **Description:** MCP server for discovering and invoking monetized AI tools. Agents search the SettleGrid marketplace by keyword or category, inspect tool details and pricing, and call any tool through MCP. Supports per-call billing via Stripe Connect.
- **GitHub URL:** https://github.com/lexwhiting/settlegrid
- **npm package:** @settlegrid/discovery
- **Website URL:** https://settlegrid.ai
- **Category:** Developer Tools
- **Subcategory:** Marketplace / Search
- **Install:** `npx @settlegrid/discovery`
- **Transport:** stdio
- **Author:** Alerterra, LLC
- **License:** MIT
- **Tools count:** 6
- **Keywords:** mcp, ai-tools, marketplace, billing, monetization, tool-discovery

---

## 6. MCPMarket

**Submission method:** Community submission form

**Form fields:**

- **Name:** SettleGrid Discovery
- **Slug:** settlegrid-discovery
- **Description:** Discover monetized AI tools on the SettleGrid marketplace. Search by keyword or category, get tool details and pricing, view developer profiles, and invoke any tool directly — all through the Model Context Protocol. Free tools work without an API key; paid tools use per-call billing through Stripe Connect.
- **GitHub:** https://github.com/lexwhiting/settlegrid
- **npm:** @settlegrid/discovery
- **Website:** https://settlegrid.ai
- **Install command:** `npx @settlegrid/discovery`
- **Category:** Developer Tools
- **Tags:** marketplace, search, billing, monetization, ai-tools, mcp-server
- **Transport:** stdio, Streamable HTTP
- **Author:** Alerterra, LLC
- **License:** MIT
- **Number of tools:** 6
- **Tool list:**
  - `search_tools` — Search marketplace tools
  - `get_tool` — Get full tool details
  - `list_categories` — List categories with counts
  - `get_developer` — Developer profile and tools
  - `list_marketplace_tools` — Popular tools with pricing
  - `call_tool` — Invoke any tool by slug

---

## 7. cursor.directory

**Submission method:** Community submission on cursor.directory

**Form fields:**

- **Name:** SettleGrid Discovery
- **Slug:** settlegrid-discovery
- **Description:** MCP server for the SettleGrid AI tool marketplace. Search, browse, and invoke monetized tools with per-call billing. Exposes 6 tools: keyword search, tool details, category browsing, developer profiles, popular listings, and direct tool invocation.
- **Install command:** `npx -y settlegrid-cursor`
- **Alternative install:** `npx -y @settlegrid/discovery`
- **Configuration (mcp.json):**

```json
{
  "mcpServers": {
    "settlegrid-discovery": {
      "command": "npx",
      "args": ["-y", "settlegrid-cursor"]
    }
  }
}
```

- **GitHub:** https://github.com/lexwhiting/settlegrid
- **npm:** settlegrid-cursor (Cursor-specific) / @settlegrid/discovery (generic)
- **Website:** https://settlegrid.ai
- **Category:** Developer Tools
- **Tags:** marketplace, search, billing, monetization, ai-tools
- **Author:** Alerterra, LLC
- **License:** MIT

---

## Notes

- All submissions reference the same MCP server with 6 tools
- The npm package `@settlegrid/discovery` is the primary distribution; `settlegrid-cursor` is the Cursor-specific wrapper
- The Streamable HTTP endpoint at `https://settlegrid.ai/api/mcp` is available for web-based MCP clients
- No API key is required for discovery tools; `SETTLEGRID_API_KEY` is only needed for invoking paid tools via `call_tool`
