# settlegrid-lancedb

LanceDB MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-lancedb)

Manage tables, insert records, and perform vector similarity search on LanceDB cloud databases.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `list_tables()` | List all tables in the database | 1¢ |
| `describe_table(table_name: string)` | Describe the schema and metadata of a table | 1¢ |
| `search_vectors(table_name: string, vector: number[], limit?: number, filter?: string)` | Perform vector similarity search on a table | 3¢ |
| `query_table(table_name: string, filter?: string, limit?: number)` | Query records from a table with optional filter | 2¢ |
| `insert_records(table_name: string, records: object[])` | Insert records into a table | 3¢ |
| `update_records(table_name: string, filter: string, updates: object)` | Update records in a table matching a filter | 3¢ |
| `delete_records(table_name: string, filter: string)` | Delete records from a table matching a filter | 3¢ |
| `list_indexes(table_name: string)` | List all indexes on a table | 1¢ |

## Parameters

### list_tables

### describe_table
- `table_name` (string, required) — Name of the table to describe

### search_vectors
- `table_name` (string, required) — Name of the table to search
- `vector` (number[], required) — Query vector for similarity search
- `limit` (number) — Maximum number of results to return (default 10, max 100)
- `filter` (string) — SQL-style filter expression to apply during search

### query_table
- `table_name` (string, required) — Name of the table to query
- `filter` (string) — SQL-style WHERE filter expression
- `limit` (number) — Maximum number of records to return (default 20, max 100)

### insert_records
- `table_name` (string, required) — Name of the table to insert into
- `records` (object[], required) — Array of record objects to insert

### update_records
- `table_name` (string, required) — Name of the table to update
- `filter` (string, required) — SQL-style WHERE filter to select records to update
- `updates` (object, required) — Key-value pairs of columns to update

### delete_records
- `table_name` (string, required) — Name of the table to delete from
- `filter` (string, required) — SQL-style WHERE filter to select records to delete

### list_indexes
- `table_name` (string, required) — Name of the table whose indexes to list

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `LANCEDB_API_KEY` | Yes | LanceDB API key from [https://cloud.lancedb.com](https://cloud.lancedb.com) |

## Upstream API

- **Provider**: LanceDB
- **Base URL**: https://api.lancedb.com
- **Auth**: API key required
- **Docs**: https://docs.lancedb.com/api-reference/rest

## Deploy

### Docker

```bash
docker build -t settlegrid-lancedb .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-lancedb
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
