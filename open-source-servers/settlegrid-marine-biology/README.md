# settlegrid-marine-biology

Marine Species Data MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-marine-biology)

Access marine species data via WoRMS (World Register of Marine Species). Search species, get details, and view classification.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_species(query, limit?)` | Search marine species | 1¢ |
| `get_species(aphiaId)` | Get species by AphiaID | 1¢ |
| `get_classification(aphiaId)` | Get taxonomic classification | 2¢ |

## Parameters

### search_species
- `query` (string, required) — Species name (e.g. "Carcharodon", "dolphin")
- `limit` (number) — Max results (default 10, max 50)

### get_species
- `aphiaId` (string, required) — WoRMS AphiaID (e.g. 105838)

### get_classification
- `aphiaId` (string, required) — WoRMS AphiaID

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream WoRMS REST API API — it is completely free.

## Upstream API

- **Provider**: WoRMS REST API
- **Base URL**: https://www.marinespecies.org/rest
- **Auth**: None required
- **Docs**: https://www.marinespecies.org/rest/

## Deploy

### Docker

```bash
docker build -t settlegrid-marine-biology .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-marine-biology
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
