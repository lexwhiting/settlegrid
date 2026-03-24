#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const BASE_URL =
  process.env.SETTLEGRID_API_URL?.replace(/\/+$/, "") ||
  "https://settlegrid.ai";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function apiFetch<T>(path: string): Promise<T> {
  const url = `${BASE_URL}${path}`;

  let res: Response;
  try {
    res = await fetch(url);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unknown network error";
    throw new Error(
      `Failed to reach SettleGrid API at ${url} — ${message}. ` +
        `Check your network connection or set SETTLEGRID_API_URL to a reachable endpoint.`
    );
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `SettleGrid API returned ${res.status} ${res.statusText} for ${path}` +
        (body ? `: ${body.slice(0, 200)}` : "")
    );
  }

  return res.json() as Promise<T>;
}

function errorContent(err: unknown): {
  content: [{ type: "text"; text: string }];
  isError: true;
} {
  const message = err instanceof Error ? err.message : String(err);
  return {
    content: [{ type: "text" as const, text: `Error: ${message}` }],
    isError: true,
  };
}

function jsonContent(data: unknown): {
  content: [{ type: "text"; text: string }];
} {
  return {
    content: [
      { type: "text" as const, text: JSON.stringify(data, null, 2) },
    ],
  };
}

// ---------------------------------------------------------------------------
// Server setup
// ---------------------------------------------------------------------------

const server = new McpServer({
  name: "SettleGrid Discovery",
  version: "1.0.0",
});

// ---------------------------------------------------------------------------
// Tool: search_tools
// ---------------------------------------------------------------------------

interface DiscoverTool {
  name: string;
  slug: string;
  description: string;
  category: string;
  pricing: Record<string, unknown>;
  version: string;
  url: string;
}

server.tool(
  "search_tools",
  "Search for monetized AI tools on the SettleGrid marketplace",
  {
    query: z.string().optional().describe("Free-text search query"),
    category: z
      .string()
      .optional()
      .describe("Filter by tool category (e.g. finance, weather, ai)"),
    limit: z
      .number()
      .int()
      .min(1)
      .max(100)
      .default(20)
      .describe("Maximum number of results to return (1-100, default 20)"),
  },
  async ({ query, category, limit }) => {
    try {
      const params = new URLSearchParams();
      if (query) params.set("q", query);
      if (category) params.set("category", category);
      params.set("limit", String(limit));

      const qs = params.toString();
      const data = await apiFetch<DiscoverTool[]>(
        `/api/v1/discover${qs ? `?${qs}` : ""}`
      );
      return jsonContent(data);
    } catch (err) {
      return errorContent(err);
    }
  }
);

// ---------------------------------------------------------------------------
// Tool: get_tool
// ---------------------------------------------------------------------------

interface ToolDetail {
  name: string;
  slug: string;
  description: string;
  category: string;
  pricing: Record<string, unknown>;
  version: string;
  methods: Record<string, unknown>[];
  quickStart: string;
  url: string;
}

server.tool(
  "get_tool",
  "Get full details for a specific tool on SettleGrid by its slug",
  {
    slug: z
      .string()
      .describe("The unique slug of the tool (e.g. settlegrid-weather-api)"),
  },
  async ({ slug }) => {
    try {
      const data = await apiFetch<ToolDetail>(
        `/api/v1/discover/${encodeURIComponent(slug)}`
      );
      return jsonContent(data);
    } catch (err) {
      return errorContent(err);
    }
  }
);

// ---------------------------------------------------------------------------
// Tool: list_categories
// ---------------------------------------------------------------------------

interface Category {
  name: string;
  count: number;
}

server.tool(
  "list_categories",
  "List all available tool categories on the SettleGrid marketplace",
  {},
  async () => {
    try {
      const data = await apiFetch<Category[]>(
        "/api/v1/discover/categories"
      );
      return jsonContent(data);
    } catch (err) {
      return errorContent(err);
    }
  }
);

// ---------------------------------------------------------------------------
// Tool: get_developer
// ---------------------------------------------------------------------------

interface DeveloperProfile {
  name: string;
  bio: string;
  tools: DiscoverTool[];
  reputation: Record<string, unknown>;
}

server.tool(
  "get_developer",
  "Get a developer's public profile and published tools on SettleGrid",
  {
    slug: z
      .string()
      .describe("The developer's unique profile slug"),
  },
  async ({ slug }) => {
    try {
      const data = await apiFetch<DeveloperProfile>(
        `/api/v1/discover/developers/${encodeURIComponent(slug)}`
      );
      return jsonContent(data);
    } catch (err) {
      return errorContent(err);
    }
  }
);

// ---------------------------------------------------------------------------
// Smithery sandbox export (for server capability scanning)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error: unknown) => {
  console.error("SettleGrid Discovery Server error:", error);
  process.exit(1);
});
