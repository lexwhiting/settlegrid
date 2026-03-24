# settlegrid-walk-score

Walk Score MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-walk-score)

Walkability, transit, and bike scores for any address.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key + WALKSCORE_API_KEY
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_score(address, lat, lon)` | Get walk, transit, and bike scores for an address | 2¢ |

## Parameters

### get_score
- `address` (string, required)
- `lat` (number, required)
- `lon` (number, required)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `WALKSCORE_API_KEY` | Yes | Free key from walkscore.com/professional/api.php |


## Upstream API

- **Provider**: Walk Score
- **Base URL**: https://api.walkscore.com
- **Auth**: Free API key required
- **Rate Limits**: 5000 req/day (free)
- **Docs**: https://www.walkscore.com/professional/api.php

## Deploy

### Docker

```bash
docker build -t settlegrid-walk-score .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -e WALKSCORE_API_KEY=xxx -p 3000:3000 settlegrid-walk-score
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
