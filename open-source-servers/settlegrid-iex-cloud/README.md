# settlegrid-iex-cloud

IEX Cloud MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-iex-cloud)

Stock data, company info, and market statistics via IEX Cloud.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_quote(symbol)` | Real-time stock quote | 2¢ |
| `get_company(symbol)` | Company information | 2¢ |
| `get_stats(symbol)` | Key financial statistics | 2¢ |

## Parameters

### get_quote
- `symbol` (string, required) — Stock ticker (e.g. AAPL)

### get_company
- `symbol` (string, required) — Stock ticker

### get_stats
- `symbol` (string, required) — Stock ticker

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `IEX_TOKEN` | Yes | IEX Cloud API key from [https://iexcloud.io/cloud-login#/register](https://iexcloud.io/cloud-login#/register) |

## Upstream API

- **Provider**: IEX Cloud
- **Base URL**: https://cloud.iexapis.com/stable
- **Auth**: API key required
- **Docs**: https://iexcloud.io/docs/api/

## Deploy

### Docker

```bash
docker build -t settlegrid-iex-cloud .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-iex-cloud
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
