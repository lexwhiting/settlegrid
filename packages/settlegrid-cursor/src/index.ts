#!/usr/bin/env node

/**
 * settlegrid-cursor — Cursor-compatible MCP plugin for SettleGrid Discovery
 *
 * Wraps the SettleGrid Discovery MCP server so that Cursor users can search,
 * browse, and invoke monetized AI tools directly from the Cursor IDE.
 *
 * Cursor accepts MCP servers that communicate over stdio. This plugin
 * exposes the same 6 tools as the @settlegrid/discovery server:
 *
 *   1. search_tools          — keyword/category search across the marketplace
 *   2. get_tool              — full detail for a single tool by slug
 *   3. list_categories       — enumerate available categories with counts
 *   4. get_developer         — developer profile and published tools
 *   5. list_marketplace_tools — popular tools with pricing & availability
 *   6. call_tool             — invoke any marketplace tool by slug
 *
 * Environment variables:
 *   SETTLEGRID_API_URL  — base URL (default: https://settlegrid.ai)
 *   SETTLEGRID_API_KEY  — optional API key for paid tool invocations
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const BASE_URL: string =
  process.env.SETTLEGRID_API_URL?.replace(/\/+$/, "") ||
  "https://settlegrid.ai";

const API_KEY: string | null = process.env.SETTLEGRID_API_KEY ?? null;

const SAFE_SLUG_RE = /^[a-z0-9][a-z0-9._-]{0,127}$/;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface ApiError {
  code?: string;
  [key: string]: unknown;
}

async function apiFetch<T>(path: string): Promise<T> {
  const url = `${BASE_URL}${path}`;
  const headers: Record<string, string> = {};
  if (API_KEY) {
    headers["x-api-key"] = API_KEY;
  }

  let res: Response;
  try {
    res = await fetch(url, { headers });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unknown network error";
    throw new Error(
      `Failed to reach SettleGrid API at ${url} — ${message}. ` +
        `Check your network connection or set SETTLEGRID_API_URL.`
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
// Tool 1: search_tools
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
  "Search the SettleGrid marketplace for AI tools by keyword, category, price, or rating. Returns tool names, slugs, descriptions, pricing, and developer info.",
  {
    query: z
      .string()
      .optional()
      .describe(
        "Free-text search query (e.g. 'weather', 'translate', 'sentiment')"
      ),
    category: z
      .string()
      .optional()
      .describe(
        "Filter by tool category (e.g. finance, weather, ai). Use list_categories to see all options."
      ),
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
// Tool 2: get_tool
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
  "Retrieve full details for a specific tool by its slug, including description, pricing, developer info, reviews, and quick-start code snippets.",
  {
    slug: z
      .string()
      .min(1)
      .max(128)
      .describe(
        "The unique slug of the tool (e.g. 'wikipedia', 'forex-rates', 'dad-jokes')"
      ),
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
// Tool 3: list_categories
// ---------------------------------------------------------------------------

interface Category {
  name: string;
  count: number;
}

server.tool(
  "list_categories",
  "List all available tool categories on the SettleGrid marketplace with the number of tools in each category.",
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
// Tool 4: get_developer
// ---------------------------------------------------------------------------

interface DeveloperProfile {
  name: string;
  bio: string;
  tools: DiscoverTool[];
  reputation: Record<string, unknown>;
}

server.tool(
  "get_developer",
  "Get a developer's public profile, bio, reputation score, and their published tools on SettleGrid.",
  {
    slug: z
      .string()
      .min(1)
      .max(128)
      .describe(
        "The developer's unique profile slug (returned by search_tools and get_tool)"
      ),
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
// Tool 5: list_marketplace_tools
// ---------------------------------------------------------------------------

interface MarketplaceTool {
  slug: string;
  name: string;
  category: string;
  description: string;
  pricingConfig: Record<string, unknown>;
  proxyEndpoint: string | null;
  totalInvocations: number;
}

interface MarketplaceResponse {
  tools?: MarketplaceTool[];
}

server.tool(
  "list_marketplace_tools",
  "Browse popular tools on the SettleGrid marketplace with pricing and availability info. Each result includes cost-per-call, invocation count, and whether the tool requires an API key.",
  {
    category: z
      .string()
      .optional()
      .describe(
        "Filter by category slug (e.g. 'data', 'nlp', 'search', 'finance')"
      ),
    limit: z
      .number()
      .int()
      .min(1)
      .max(50)
      .default(20)
      .describe("Maximum number of tools to return (1-50, default 20)"),
  },
  async ({ category, limit }) => {
    try {
      const params = new URLSearchParams();
      if (category) params.set("category", category);
      params.set("limit", String(limit));
      params.set("sort", "popular");

      const data = await apiFetch<MarketplaceResponse>(
        `/api/v1/discover?${params}`
      );

      const tools = (data.tools ?? []).map((tool) => {
        const config = tool.pricingConfig ?? {};
        const costCents =
          typeof config.defaultCostCents === "number"
            ? config.defaultCostCents
            : 0;
        return {
          slug: tool.slug,
          name: tool.name,
          category: tool.category,
          description: tool.description,
          costPerCall:
            costCents === 0 ? "Free" : `$${(costCents / 100).toFixed(2)}`,
          costCents,
          hasProxyEndpoint: !!tool.proxyEndpoint,
          totalInvocations: tool.totalInvocations,
          callableVia: tool.proxyEndpoint
            ? "proxy (API key required)"
            : "serve (free)",
        };
      });

      return jsonContent({
        tools,
        total: tools.length,
        hint: "Use call_tool with the slug to invoke a tool. Proxy tools require an API key.",
      });
    } catch (err) {
      return errorContent(err);
    }
  }
);

// ---------------------------------------------------------------------------
// Tool 6: call_tool
// ---------------------------------------------------------------------------

server.tool(
  "call_tool",
  "Invoke any marketplace tool by slug. Free tools work without an API key; paid tools require SETTLEGRID_API_KEY.",
  {
    slug: z
      .string()
      .min(1)
      .max(128)
      .describe("Tool slug (e.g. 'wikipedia', 'dad-jokes', 'forex-rates')"),
    method: z
      .string()
      .max(64)
      .optional()
      .describe(
        "Specific method or action to call on the tool (e.g. 'search', 'get_random')"
      ),
    args: z
      .record(z.unknown())
      .optional()
      .describe(
        "Arguments to pass to the tool as a JSON object (e.g. { \"query\": \"Einstein\" })"
      ),
  },
  async ({ slug, method, args }) => {
    if (!SAFE_SLUG_RE.test(slug)) {
      return errorContent(new Error("Invalid tool slug format."));
    }

    const payload: Record<string, unknown> = { ...args };
    if (method) {
      payload.method = method;
    }

    // If we have an API key, try the Smart Proxy first (supports billing)
    if (API_KEY) {
      try {
        const proxyUrl = `${BASE_URL}/api/proxy/${encodeURIComponent(slug)}`;
        const proxyRes = await fetch(proxyUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": API_KEY,
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(30_000),
        });

        if (proxyRes.ok || proxyRes.status === 402) {
          const data: unknown = await proxyRes.json();
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(data, null, 2),
              },
            ],
            ...(proxyRes.status === 402 ? { isError: true } : {}),
          };
        }

        const errorData = (await proxyRes
          .json()
          .catch(() => ({}))) as ApiError;
        if (
          errorData.code !== "NO_PROXY_ENDPOINT" &&
          errorData.code !== "TOOL_MISMATCH"
        ) {
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(errorData, null, 2),
              },
            ],
            isError: true,
          };
        }
        // Fall through to serve endpoint
      } catch (err) {
        const errorMsg =
          err instanceof Error ? err.message : "Unknown error";
        if (
          errorMsg.includes("AbortError") ||
          errorMsg.includes("timeout")
        ) {
          return errorContent(
            new Error("Tool call timed out after 30 seconds.")
          );
        }
        // Fall through to serve endpoint
      }
    }

    // Fallback: try the serve endpoint (free showcase tools)
    try {
      const serveUrl = `${BASE_URL}/api/tools/serve/${encodeURIComponent(slug)}`;
      const serveRes = await fetch(serveUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(15_000),
      });

      const data: unknown = await serveRes.json();
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(data, null, 2),
          },
        ],
        ...(serveRes.ok ? {} : { isError: true }),
      };
    } catch {
      return errorContent(
        new Error(
          `Tool "${slug}" is not available. Use search_tools to find available tools.`
        )
      );
    }
  }
);

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error: unknown) => {
  console.error("SettleGrid Cursor Plugin error:", error);
  process.exit(1);
});
