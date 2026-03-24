# settlegrid-ncbi-gene

NCBI Gene Information MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-ncbi-gene)

Access NCBI Gene database via E-utilities. Search genes, get gene details, and retrieve functional summaries.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_genes(query, limit?)` | Search gene database | 1¢ |
| `get_gene(id)` | Get gene details by ID | 1¢ |
| `get_gene_summary(id)` | Get gene functional summary | 2¢ |

## Parameters

### search_genes
- `query` (string, required) — Gene name or keyword (e.g. "TP53", "BRCA1 human")
- `limit` (number) — Max results (default 10, max 100)

### get_gene
- `id` (string, required) — NCBI Gene ID (e.g. 7157 for TP53)

### get_gene_summary
- `id` (string, required) — NCBI Gene ID

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream NCBI E-utilities (Gene) API — it is completely free.

## Upstream API

- **Provider**: NCBI E-utilities (Gene)
- **Base URL**: https://eutils.ncbi.nlm.nih.gov/entrez/eutils
- **Auth**: None required
- **Docs**: https://www.ncbi.nlm.nih.gov/books/NBK25501/

## Deploy

### Docker

```bash
docker build -t settlegrid-ncbi-gene .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-ncbi-gene
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
