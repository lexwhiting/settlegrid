# settlegrid-uniprot

UniProt Protein Data MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-uniprot)

Access UniProt protein sequence and functional information. Search proteins, retrieve entries, and get feature annotations.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_proteins(query, limit?)` | Search protein entries | 1¢ |
| `get_protein(accession)` | Get protein entry by accession | 1¢ |
| `get_features(accession)` | Get protein feature annotations | 2¢ |

## Parameters

### search_proteins
- `query` (string, required) — Search query (e.g. "insulin human", "P53")
- `limit` (number) — Max results (default 10, max 50)

### get_protein
- `accession` (string, required) — UniProt accession (e.g. P04637, Q9Y6K1)

### get_features
- `accession` (string, required) — UniProt accession (e.g. P04637)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream UniProt REST API API — it is completely free.

## Upstream API

- **Provider**: UniProt REST API
- **Base URL**: https://rest.uniprot.org
- **Auth**: None required
- **Docs**: https://www.uniprot.org/help/api

## Deploy

### Docker

```bash
docker build -t settlegrid-uniprot .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-uniprot
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
