# @settlegrid/discovery

An MCP (Model Context Protocol) server that lets AI agents discover monetized tools on the SettleGrid marketplace. Instead of hard-coding tool URLs or relying on third-party directories, agents connect to this server and search, browse, and inspect tools programmatically — making SettleGrid the canonical discovery layer for the AI economy.

## Quick start

### With npx (no install)

```bash
npx @settlegrid/discovery
```

### Install globally

```bash
npm install -g @settlegrid/discovery
settlegrid-discovery
```

### From source (this repo)

```bash
cd packages/discovery-server
npm install
npm run dev    # tsx, auto-reloads
npm run build  # compile to dist/
npm start      # run compiled output
```

## Configuration

| Variable              | Default                  | Description                      |
| --------------------- | ------------------------ | -------------------------------- |
| `SETTLEGRID_API_URL`  | `https://settlegrid.ai`  | Base URL of the SettleGrid API   |

## Available tools

### `search_tools`

Search for monetized AI tools on the marketplace.

| Parameter  | Type     | Required | Description                          |
| ---------- | -------- | -------- | ------------------------------------ |
| `query`    | string   | no       | Free-text search query               |
| `category` | string   | no       | Filter by category                   |
| `limit`    | number   | no       | Max results, 1-100 (default 20)      |

Returns an array of `{ name, slug, description, category, pricing, version, url }`.

### `get_tool`

Get full details for a specific tool by slug.

| Parameter | Type   | Required | Description              |
| --------- | ------ | -------- | ------------------------ |
| `slug`    | string | yes      | Tool slug identifier     |

Returns `{ name, slug, description, category, pricing, version, methods, quickStart, url }`.

### `list_categories`

List every tool category with counts. No parameters.

Returns an array of `{ name, count }`.

### `get_developer`

Get a developer's public profile and their published tools.

| Parameter | Type   | Required | Description                |
| --------- | ------ | -------- | -------------------------- |
| `slug`    | string | yes      | Developer profile slug     |

Returns `{ name, bio, tools[], reputation }`.

## Add to Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "settlegrid-discovery": {
      "command": "npx",
      "args": ["-y", "@settlegrid/discovery"]
    }
  }
}
```

To point at a local or staging API:

```json
{
  "mcpServers": {
    "settlegrid-discovery": {
      "command": "npx",
      "args": ["-y", "@settlegrid/discovery"],
      "env": {
        "SETTLEGRID_API_URL": "http://localhost:3005"
      }
    }
  }
}
```

## License

MIT
