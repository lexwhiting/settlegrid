# settlegrid-forest-data

Global Forest Watch MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-forest-data)

Deforestation and forest cover data from Global Forest Watch.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_datasets()` | List available forest datasets | 1¢ |
| `get_tree_cover_loss(iso)` | Get tree cover loss statistics by ISO country | 1¢ |

## Parameters

### get_tree_cover_loss
- `iso` (string, required)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |


## Upstream API

- **Provider**: Global Forest Watch
- **Base URL**: https://data-api.globalforestwatch.org
- **Auth**: None required
- **Rate Limits**: Reasonable use
- **Docs**: https://data-api.globalforestwatch.org/

## Deploy

### Docker

```bash
docker build -t settlegrid-forest-data .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-forest-data
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
