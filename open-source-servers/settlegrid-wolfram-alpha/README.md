# settlegrid-wolfram-alpha

Wolfram Alpha MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-wolfram-alpha)

Computational knowledge engine — math, science, data.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key + WOLFRAM_APP_ID
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `query(input)` | Ask Wolfram Alpha a computational question (short answer) | 3¢ |
| `full_query(input)` | Ask Wolfram Alpha with full structured results | 3¢ |

## Parameters

### query
- `input` (string, required)

### full_query
- `input` (string, required)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `WOLFRAM_APP_ID` | Yes | Free AppID from developer.wolframalpha.com |


## Upstream API

- **Provider**: Wolfram Alpha
- **Base URL**: https://www.wolframalpha.com
- **Auth**: Free API key required
- **Rate Limits**: 2,000 calls/month (free)
- **Docs**: https://products.wolframalpha.com/api/documentation

## Deploy

### Docker

```bash
docker build -t settlegrid-wolfram-alpha .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -e WOLFRAM_APP_ID=xxx -p 3000:3000 settlegrid-wolfram-alpha
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
