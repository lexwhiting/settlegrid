# settlegrid-kegg

KEGG Pathway Database MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-kegg)

Access KEGG pathway and genome database via REST API. Search metabolic pathways, get pathway details, and list organisms.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_pathways(query)` | Search KEGG pathways | 1¢ |
| `get_pathway(id)` | Get pathway details by ID | 2¢ |
| `list_organisms()` | List KEGG organisms | 1¢ |

## Parameters

### search_pathways
- `query` (string, required) — Pathway keyword (e.g. "glycolysis", "apoptosis")

### get_pathway
- `id` (string, required) — KEGG pathway ID (e.g. hsa00010, map00010)

### list_organisms

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream KEGG REST API API — it is completely free.

## Upstream API

- **Provider**: KEGG REST API
- **Base URL**: https://rest.kegg.jp
- **Auth**: None required
- **Docs**: https://www.kegg.jp/kegg/rest/keggapi.html

## Deploy

### Docker

```bash
docker build -t settlegrid-kegg .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-kegg
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
