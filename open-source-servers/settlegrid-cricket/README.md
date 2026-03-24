# settlegrid-cricket

Cricket Data MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-cricket)

Cricket match data, scores, and series information from CricAPI.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key + CRICAPI_KEY
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_matches()` | Get current/recent cricket matches | 2¢ |
| `get_series()` | Get cricket series list | 2¢ |

## Parameters



## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `CRICAPI_KEY` | Yes | CricAPI key (free at cricapi.com) |


## Upstream API

- **Provider**: CricAPI
- **Base URL**: https://api.cricapi.com/v1
- **Auth**: API key (query param)
- **Rate Limits**: 100 req/day (free)
- **Docs**: https://cricapi.com/

## Deploy

### Docker

```bash
docker build -t settlegrid-cricket .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -e CRICAPI_KEY=xxx -p 3000:3000 settlegrid-cricket
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
