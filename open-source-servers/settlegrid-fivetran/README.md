# settlegrid-fivetran

Fivetran MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-fivetran)

Manage Fivetran data pipeline connections, trigger syncs, and inspect schema metadata via the Fivetran REST API.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `list_connections(limit?: number)` | List all Fivetran connections | 1¢ |
| `get_connection(connectionId: string)` | Retrieve details for a specific connection | 1¢ |
| `trigger_sync(connectionId: string)` | Trigger a sync for a connection | 3¢ |
| `trigger_resync(connectionId: string)` | Re-sync all data for a connection | 5¢ |
| `get_connection_schemas(connectionId: string)` | Retrieve schema metadata for a connection | 1¢ |
| `get_schema_details(connectionId: string, schemaName: string)` | Retrieve details for a specific schema in a connection | 1¢ |
| `get_table_details(connectionId: string, schemaName: string, tableName: string)` | Retrieve details for a specific table in a connection schema | 1¢ |
| `delete_connection(connectionId: string)` | Delete a Fivetran connection | 5¢ |

## Parameters

### list_connections
- `limit` (number) — Maximum number of connections to return (default 20, max 50)

### get_connection
- `connectionId` (string, required) — The unique identifier for the Fivetran connection

### trigger_sync
- `connectionId` (string, required) — The unique identifier for the Fivetran connection to sync

### trigger_resync
- `connectionId` (string, required) — The unique identifier for the Fivetran connection to re-sync

### get_connection_schemas
- `connectionId` (string, required) — The unique identifier for the Fivetran connection

### get_schema_details
- `connectionId` (string, required) — The unique identifier for the Fivetran connection
- `schemaName` (string, required) — The name of the schema to retrieve

### get_table_details
- `connectionId` (string, required) — The unique identifier for the Fivetran connection
- `schemaName` (string, required) — The name of the schema containing the table
- `tableName` (string, required) — The name of the table to retrieve

### delete_connection
- `connectionId` (string, required) — The unique identifier for the Fivetran connection to delete

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `FIVETRAN_API_KEY` | Yes | Fivetran API key from [https://fivetran.com/docs/rest-api/getting-started](https://fivetran.com/docs/rest-api/getting-started) |

## Upstream API

- **Provider**: Fivetran
- **Base URL**: https://api.fivetran.com
- **Auth**: API key required
- **Docs**: https://fivetran.com/docs/rest-api/api-reference/connections

## Deploy

### Docker

```bash
docker build -t settlegrid-fivetran .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-fivetran
```

### Vercel

Click the "Deploy with Vercel" button above, or:

```bash
npm run build
vercel --prod
```

## License

MIT - see [LICENSE](LICENSE)

---

Built with [SettleGrid](https://settlegrid.ai) — The Settlement Layer for the AI Economy
