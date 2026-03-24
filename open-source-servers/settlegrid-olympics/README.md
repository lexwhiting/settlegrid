# settlegrid-olympics

Olympic Games Data MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-olympics)

Olympic Games events, athletes, and medal data.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_events()` | Get Olympic events/disciplines | 1¢ |
| `get_countries()` | Get participating countries and medals | 1¢ |

## Parameters



## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |


## Upstream API

- **Provider**: Codante Olympic API
- **Base URL**: https://apis.codante.io/olympic-games
- **Auth**: None required
- **Rate Limits**: Reasonable use
- **Docs**: https://apis.codante.io/olympic-games

## Deploy

### Docker

```bash
docker build -t settlegrid-olympics .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-olympics
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
