# settlegrid-ip-lookup

IP Address Lookup MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-ip-lookup)

IP geolocation, ASN, and network info from ip-api.com.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `lookup_ip(ip)` | Look up IP address geolocation | 1¢ |
| `batch_lookup(ips)` | Batch IP lookup (up to 100) | 2¢ |

## Parameters

### lookup_ip
- `ip` (string, required) — IP address to look up

### batch_lookup
- `ips` (string[], required) — Array of IP addresses

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream ip-api.com API — it is completely free.

## Upstream API

- **Provider**: ip-api.com
- **Base URL**: http://ip-api.com/json
- **Auth**: None required
- **Docs**: https://ip-api.com/docs

## Deploy

### Docker

```bash
docker build -t settlegrid-ip-lookup .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-ip-lookup
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
