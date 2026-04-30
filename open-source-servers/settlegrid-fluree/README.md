# settlegrid-fluree

Fluree MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-fluree)

Create and query Fluree semantic ledgers with full transaction, history, and SPARQL support.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `create_ledger(ledger: string)` | Create a new Fluree ledger | 3¢ |
| `list_ledgers()` | List all available Fluree ledgers | 1¢ |
| `query_ledger(ledger: string, query: string)` | Submit a FlureeQL query against a ledger | 2¢ |
| `transact_ledger(ledger: string, transaction: string)` | Submit a transaction to a Fluree ledger | 4¢ |
| `query_history(ledger: string, query: string)` | Query the history of a Fluree ledger | 2¢ |
| `query_sparql(ledger: string, sparql: string)` | Submit a SPARQL query against a Fluree ledger | 2¢ |
| `delete_ledger(ledger: string)` | Delete an existing Fluree ledger | 5¢ |

## Parameters

### create_ledger
- `ledger` (string, required) — Ledger name/identifier to create (e.g. 'my/ledger')

### list_ledgers

### query_ledger
- `ledger` (string, required) — Ledger name/identifier to query
- `query` (string, required) — FlureeQL query as a JSON string (e.g. '{"select":{"?s":["*"]},"where":[["?s","rdf:type","schema:Person"]]}')

### transact_ledger
- `ledger` (string, required) — Ledger name/identifier to transact against
- `transaction` (string, required) — Transaction body as a JSON string (array of assertions/retractions)

### query_history
- `ledger` (string, required) — Ledger name/identifier to get history from
- `query` (string, required) — History query as a JSON string specifying subject/predicate history to retrieve

### query_sparql
- `ledger` (string, required) — Ledger name/identifier to query
- `sparql` (string, required) — SPARQL query string (e.g. 'SELECT ?s ?p ?o WHERE { ?s ?p ?o } LIMIT 10')

### delete_ledger
- `ledger` (string, required) — Ledger name/identifier to delete

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `FLUREE_API_KEY` | Yes | Fluree API key from [https://data.flur.ee/](https://data.flur.ee/) |

## Upstream API

- **Provider**: Fluree
- **Base URL**: https://data.flur.ee
- **Auth**: API key required
- **Docs**: https://developers.flur.ee/docs/reference/http-api/

## Deploy

### Docker

```bash
docker build -t settlegrid-fluree .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-fluree
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
