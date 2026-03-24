# settlegrid-protein-data-bank

Protein Data Bank MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-protein-data-bank)

3D structural data for proteins and nucleic acids from RCSB PDB

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_entry(entryId)` | Get PDB entry details by ID | 1¢ |

## Parameters

### get_entry
- `entryId` (string, required) — PDB entry ID (e.g. 4HHB)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream Protein Data Bank API.

## Upstream API

- **Provider**: Protein Data Bank
- **Base URL**: https://data.rcsb.org/rest/v1/core
- **Auth**: None required
- **Docs**: https://data.rcsb.org/

## Deploy

### Docker

```bash
docker build -t settlegrid-protein-data-bank .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-protein-data-bank
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
