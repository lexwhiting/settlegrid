# settlegrid-protein-data

Protein Data Bank MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-protein-data)

Search protein structures from RCSB PDB with SettleGrid billing.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_structures(query, rows)` | Search PDB for protein structures | 1¢ |
| `get_entry(pdb_id)` | Get PDB entry details by ID | 1¢ |

## Parameters

### search_structures
- `query` (string, required) — Search query (e.g. "insulin")
- `rows` (number, optional) — Max results (1-20, default 10)

### get_entry
- `pdb_id` (string, required) — PDB ID (e.g. "4HHB")

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |


## Upstream API

- **Provider**: RCSB PDB
- **Base URL**: https://data.rcsb.org/rest/v1
- **Auth**: None required
- **Rate Limits**: Reasonable use
- **Docs**: https://data.rcsb.org/index.html

## Deploy

### Docker

```bash
docker build -t settlegrid-protein-data .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-protein-data
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
