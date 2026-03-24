# settlegrid-shodan-host

Shodan Host Lookup MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-shodan-host)

Internet-connected device search and host reconnaissance via Shodan.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `lookup_host(ip)` | Lookup host by IP | 3¢ |
| `shodan_search(query)` | Search Shodan | 3¢ |

## Parameters

### lookup_host
- `ip` (string, required) — IP address to lookup

### shodan_search
- `query` (string, required) — Shodan search query

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `SHODAN_API_KEY` | Yes | Shodan API key from [https://account.shodan.io/](https://account.shodan.io/) |

## Upstream API

- **Provider**: Shodan
- **Base URL**: https://api.shodan.io
- **Auth**: API key required
- **Docs**: https://developer.shodan.io/api

## Deploy

### Docker

```bash
docker build -t settlegrid-shodan-host .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-shodan-host
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
