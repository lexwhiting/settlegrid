/**
 * @settlegrid/discovery — Programmatic API
 *
 * Re-exports the server instance so consumers can embed the discovery
 * server inside a larger MCP gateway or test harness without spawning
 * a separate process.
 *
 * For standalone usage run the server directly:
 *   npx @settlegrid/discovery
 */

export { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
export { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
