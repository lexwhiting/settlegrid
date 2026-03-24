# settlegrid-mexico-inegi

Mexico INEGI MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-mexico-inegi)

Mexican National Institute of Statistics data and indicators

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_indicator(indicatorId, token)` | Get economic indicator data | 2¢ |

## Parameters

### get_indicator
- `indicatorId` (string, required) — INEGI indicator ID
- `token` (string, required) — INEGI API token

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream Mexico INEGI API.

## Upstream API

- **Provider**: Mexico INEGI
- **Base URL**: https://www.inegi.org.mx/app/api/indicadores/desarrolladores/jsonxml/INDICATOR
- **Auth**: None required
- **Docs**: https://www.inegi.org.mx/servicios/api_indicadores.html

## Deploy

### Docker

```bash
docker build -t settlegrid-mexico-inegi .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-mexico-inegi
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
