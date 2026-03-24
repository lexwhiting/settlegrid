# settlegrid-brazil-ibge

Brazil IBGE MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-brazil-ibge)

Brazilian Institute of Geography and Statistics data and demographics

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_states()` | Get list of Brazilian states | 1¢ |
| `get_news()` | Get latest IBGE news/statistics | 1¢ |

## Parameters

### get_states

### get_news
- `qtd` (number, optional) — Number of results (default: 10)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream Brazil IBGE API.

## Upstream API

- **Provider**: Brazil IBGE
- **Base URL**: https://servicodados.ibge.gov.br/api/v1
- **Auth**: None required
- **Docs**: https://servicodados.ibge.gov.br/api/docs

## Deploy

### Docker

```bash
docker build -t settlegrid-brazil-ibge .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-brazil-ibge
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
