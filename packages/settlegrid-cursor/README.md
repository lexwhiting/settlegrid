# settlegrid-cursor

A Cursor-compatible MCP plugin that connects to the [SettleGrid](https://settlegrid.ai) marketplace. Search, browse, and invoke monetized AI tools directly from the Cursor IDE.

This plugin wraps the `@settlegrid/discovery` MCP server and exposes the same 6 tools over stdio, which is the transport Cursor uses for MCP servers.

## Installation

### Option 1: Add via Cursor Settings (recommended)

1. Open Cursor Settings (`Cmd+,` / `Ctrl+,`)
2. Navigate to **Features > MCP Servers**
3. Click **Add new MCP server**
4. Enter the following:

| Field     | Value                                         |
| --------- | --------------------------------------------- |
| Name      | `settlegrid-discovery`                        |
| Type      | `command`                                     |
| Command   | `npx -y settlegrid-cursor`                    |

Cursor will start the server automatically when you open a project.

### Option 2: Edit `~/.cursor/mcp.json` manually

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

### Option 3: Project-level config (`.cursor/mcp.json`)

Add to your project root so all team members get the same tools:

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

## Configuration

| Variable              | Default                 | Description                                       |
| --------------------- | ----------------------- | ------------------------------------------------- |
| `SETTLEGRID_API_URL`  | `https://settlegrid.ai` | Base URL of the SettleGrid API                    |
| `SETTLEGRID_API_KEY`  | *(none)*                | API key for invoking paid marketplace tools       |

To pass environment variables in Cursor, add an `env` block:

```json
{
  "mcpServers": {
    "settlegrid-discovery": {
      "command": "npx",
      "args": ["-y", "settlegrid-cursor"],
      "env": {
        "SETTLEGRID_API_KEY": "sg_live_your_key_here"
      }
    }
  }
}
```

## Available tools

### `search_tools`

Search the SettleGrid marketplace for AI tools by keyword, category, or rating.

| Parameter  | Type   | Required | Description                        |
| ---------- | ------ | -------- | ---------------------------------- |
| `query`    | string | no       | Free-text search query             |
| `category` | string | no       | Filter by category                 |
| `limit`    | number | no       | Max results, 1-100 (default 20)    |

### `get_tool`

Get full details for a specific tool by slug.

| Parameter | Type   | Required | Description          |
| --------- | ------ | -------- | -------------------- |
| `slug`    | string | yes      | Tool slug identifier |

### `list_categories`

List every tool category with counts. No parameters.

### `get_developer`

Get a developer's public profile and their published tools.

| Parameter | Type   | Required | Description            |
| --------- | ------ | -------- | ---------------------- |
| `slug`    | string | yes      | Developer profile slug |

### `list_marketplace_tools`

Browse popular tools with pricing and availability info.

| Parameter  | Type   | Required | Description                     |
| ---------- | ------ | -------- | ------------------------------- |
| `category` | string | no       | Filter by category              |
| `limit`    | number | no       | Max results, 1-50 (default 20)  |

### `call_tool`

Invoke any marketplace tool by slug. Free tools work without an API key; paid tools require `SETTLEGRID_API_KEY`.

| Parameter | Type   | Required | Description                        |
| --------- | ------ | -------- | ---------------------------------- |
| `slug`    | string | yes      | Tool slug                          |
| `method`  | string | no       | Method or action to call           |
| `args`    | object | no       | Arguments as a JSON object         |

## How it works

1. Cursor starts this plugin as a child process over stdio
2. The plugin registers 6 MCP tools with the Cursor MCP runtime
3. When you (or Cursor's agent) call a tool, the plugin makes HTTPS requests to the SettleGrid API
4. Results are returned as structured JSON through the MCP protocol

## Related packages

- [`@settlegrid/discovery`](https://www.npmjs.com/package/@settlegrid/discovery) - The standalone MCP server (works with Claude Desktop, Windsurf, and any stdio MCP client)
- [`@settlegrid/mcp`](https://www.npmjs.com/package/@settlegrid/mcp) - The billing SDK for tool developers

## License

MIT
