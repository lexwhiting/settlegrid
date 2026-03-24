# settlegrid-bored-api

Bored Activity MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-bored-api)

Random activity suggestions when bored from Bored API.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_activity(type?, participants?)` | Get a random activity suggestion | 1¢ |

## Parameters

### get_activity
- `type` (string) — Type: education, recreational, social, diy, charity, cooking, relaxation, music, busywork
- `participants` (number) — Number of participants

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream Bored API API — it is completely free.

## Upstream API

- **Provider**: Bored API
- **Base URL**: https://bored-api.appbrewery.com/api
- **Auth**: None required
- **Docs**: https://bored-api.appbrewery.com/

## Deploy

### Docker

```bash
docker build -t settlegrid-bored-api .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-bored-api
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
