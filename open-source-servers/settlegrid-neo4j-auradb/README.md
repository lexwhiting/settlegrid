# settlegrid-neo4j-auradb

Neo4j AuraDB Query API MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-neo4j-auradb)

Execute Cypher queries against a Neo4j AuraDB instance using the Neo4j Query API.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `run_cypher_query(cypher: string, parameters?: Record<string, unknown>, database?: string)` | Run a Cypher query against the Neo4j AuraDB instance | 3¢ |
| `run_read_query(cypher: string, parameters?: Record<string, unknown>, database?: string)` | Run a read-only Cypher query (MATCH/RETURN) against the Neo4j AuraDB instance | 2¢ |

## Parameters

### run_cypher_query
- `cypher` (string, required) — The Cypher query string to execute
- `parameters` (object) — Optional key-value map of query parameters to bind
- `database` (string) — Target database name (default: 'neo4j')

### run_read_query
- `cypher` (string, required) — A read-only Cypher query (e.g. MATCH ... RETURN ...)
- `parameters` (object) — Optional key-value map of query parameters to bind
- `database` (string) — Target database name (default: 'neo4j')

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `NEO4J_BEARER_TOKEN` | Yes | Neo4j AuraDB API key from [https://console.neo4j.io/](https://console.neo4j.io/) |

## Upstream API

- **Provider**: Neo4j AuraDB
- **Base URL**: https://neo4j.com/docs/query-api/current
- **Auth**: API key required
- **Docs**: https://neo4j.com/docs/query-api/current/query/

## Deploy

### Docker

```bash
docker build -t settlegrid-neo4j-auradb .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-neo4j-auradb
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
