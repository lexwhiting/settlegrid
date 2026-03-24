# settlegrid-fossil-data

Fossil Record Data MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-fossil-data)

Access fossil record data via the Paleobiology Database (PBDB). Search fossils, get occurrences, and look up taxa.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_fossils(query, limit?)` | Search fossil occurrences | 1¢ |
| `get_occurrence(id)` | Get fossil occurrence details | 1¢ |
| `get_taxa(name)` | Get taxonomic information | 2¢ |

## Parameters

### search_fossils
- `query` (string, required) — Taxon name (e.g. "Tyrannosaurus", "Trilobita")
- `limit` (number) — Max results (default 20, max 100)

### get_occurrence
- `id` (string, required) — Occurrence ID (e.g. occ:12345)

### get_taxa
- `name` (string, required) — Taxon name (e.g. "Dinosauria", "Mammalia")

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream Paleobiology Database API — it is completely free.

## Upstream API

- **Provider**: Paleobiology Database
- **Base URL**: https://paleobiodb.org/data1.2
- **Auth**: None required
- **Docs**: https://paleobiodb.org/data1.2/

## Deploy

### Docker

```bash
docker build -t settlegrid-fossil-data .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-fossil-data
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
