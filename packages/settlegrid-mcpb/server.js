#!/usr/bin/env node

/**
 * SettleGrid Discovery MCP Server (.mcpb entry point)
 *
 * This is a thin wrapper that delegates to the published @settlegrid/discovery
 * npm package. When installed as a .mcpb extension in Claude Desktop, this file
 * is the entry point that starts the stdio MCP server.
 *
 * If @settlegrid/discovery is not installed, it falls back to an inline
 * implementation that connects directly to the SettleGrid API.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const BASE_URL =
  process.env.SETTLEGRID_API_URL?.replace(/\/+$/, "") ||
  "https://settlegrid.ai";

const API_KEY = process.env.SETTLEGRID_API_KEY || null;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function apiFetch(path) {
  const url = `${BASE_URL}${path}`;
  const headers = {};
  if (API_KEY) headers["x-api-key"] = API_KEY;

  const res = await fetch(url, { headers });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `SettleGrid API ${res.status} for ${path}${body ? `: ${body.slice(0, 200)}` : ""}`
    );
  }
  return res.json();
}

function jsonContent(data) {
  return {
    content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
  };
}

function errorContent(err) {
  const message = err instanceof Error ? err.message : String(err);
  return {
    content: [{ type: "text", text: `Error: ${message}` }],
    isError: true,
  };
}

// ---------------------------------------------------------------------------
// Server
// ---------------------------------------------------------------------------

const server = new McpServer({
  name: "SettleGrid Discovery",
  version: "1.0.0",
});

// -- search_tools
server.tool(
  "search_tools",
  "Search the SettleGrid marketplace for AI tools by keyword, category, price, or rating.",
  {
    query: z.string().optional().describe("Free-text search query"),
    category: z.string().optional().describe("Filter by tool category"),
    limit: z
      .number()
      .int()
      .min(1)
      .max(100)
      .default(20)
      .describe("Max results (1-100, default 20)"),
  },
  async ({ query, category, limit }) => {
    try {
      const params = new URLSearchParams();
      if (query) params.set("q", query);
      if (category) params.set("category", category);
      params.set("limit", String(limit));
      const qs = params.toString();
      const data = await apiFetch(`/api/v1/discover${qs ? `?${qs}` : ""}`);
      return jsonContent(data);
    } catch (err) {
      return errorContent(err);
    }
  }
);

// -- get_tool
server.tool(
  "get_tool",
  "Retrieve full details for a specific tool by its slug.",
  {
    slug: z.string().min(1).max(128).describe("Tool slug"),
  },
  async ({ slug }) => {
    try {
      const data = await apiFetch(
        `/api/v1/discover/${encodeURIComponent(slug)}`
      );
      return jsonContent(data);
    } catch (err) {
      return errorContent(err);
    }
  }
);

// -- list_categories
server.tool(
  "list_categories",
  "List all tool categories with counts.",
  {},
  async () => {
    try {
      const data = await apiFetch("/api/v1/discover/categories");
      return jsonContent(data);
    } catch (err) {
      return errorContent(err);
    }
  }
);

// -- get_developer
server.tool(
  "get_developer",
  "Get a developer's public profile and published tools.",
  {
    slug: z.string().min(1).max(128).describe("Developer slug"),
  },
  async ({ slug }) => {
    try {
      const data = await apiFetch(
        `/api/v1/discover/developers/${encodeURIComponent(slug)}`
      );
      return jsonContent(data);
    } catch (err) {
      return errorContent(err);
    }
  }
);

// -- list_marketplace_tools
server.tool(
  "list_marketplace_tools",
  "Browse popular tools with pricing and availability info.",
  {
    category: z.string().optional().describe("Filter by category"),
    limit: z
      .number()
      .int()
      .min(1)
      .max(50)
      .default(20)
      .describe("Max tools (1-50, default 20)"),
  },
  async ({ category, limit }) => {
    try {
      const params = new URLSearchParams();
      if (category) params.set("category", category);
      params.set("limit", String(limit));
      params.set("sort", "popular");
      const data = await apiFetch(`/api/v1/discover?${params}`);
      return jsonContent(data);
    } catch (err) {
      return errorContent(err);
    }
  }
);

// -- call_tool
const SAFE_SLUG = /^[a-z0-9][a-z0-9._-]{0,127}$/;

server.tool(
  "call_tool",
  "Invoke any marketplace tool by slug. Free tools work without a key; paid tools require SETTLEGRID_API_KEY.",
  {
    slug: z.string().min(1).max(128).describe("Tool slug"),
    method: z.string().max(64).optional().describe("Method or action"),
    args: z
      .record(z.unknown())
      .optional()
      .describe("Arguments as JSON object"),
  },
  async ({ slug, method, args }) => {
    if (!SAFE_SLUG.test(slug)) {
      return errorContent(new Error("Invalid tool slug format."));
    }

    const payload = { ...args };
    if (method) payload.method = method;

    try {
      const res = await fetch(
        `${BASE_URL}/api/tools/serve/${encodeURIComponent(slug)}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(API_KEY ? { "x-api-key": API_KEY } : {}),
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(15000),
        }
      );
      const data = await res.json();
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
        ...(res.ok ? {} : { isError: true }),
      };
    } catch (err) {
      return errorContent(err);
    }
  }
);

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("SettleGrid Discovery Server error:", error);
  process.exit(1);
});
