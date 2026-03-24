# settlegrid-ensembl

Ensembl Genome Browser MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-ensembl)

Access Ensembl genome browser data via REST API. Look up genes, retrieve sequences, and search across species.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `lookup_gene(symbol, species?)` | Look up gene by symbol and species | 1¢ |
| `get_sequence(id)` | Get sequence by stable Ensembl ID | 2¢ |
| `search(query, species?)` | Search Ensembl for genes/transcripts | 1¢ |

## Parameters

### lookup_gene
- `symbol` (string, required) — Gene symbol (e.g. BRCA2, TP53)
- `species` (string) — Species (default: homo_sapiens)

### get_sequence
- `id` (string, required) — Ensembl stable ID (e.g. ENSG00000139618)

### search
- `query` (string, required) — Search query
- `species` (string) — Species filter (default: homo_sapiens)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream Ensembl REST API API — it is completely free.

## Upstream API

- **Provider**: Ensembl REST API
- **Base URL**: https://rest.ensembl.org
- **Auth**: None required
- **Docs**: https://rest.ensembl.org/documentation

## Deploy

### Docker

```bash
docker build -t settlegrid-ensembl .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-ensembl
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
