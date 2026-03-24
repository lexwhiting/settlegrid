# settlegrid-bgp-data

BGP Routing Data MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-bgp-data)

BGP routing information, ASN details, and prefix announcements via RIPE Stat.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_prefixes(asn)` | Get announced prefixes for an ASN | 1¢ |
| `get_routing_status(prefix)` | Get routing status for a prefix | 1¢ |
| `get_asn_info(asn)` | Get ASN holder and registration info | 1¢ |

## Parameters

### get_prefixes
- `asn` (string, required) — Autonomous System Number (e.g. AS13335)

### get_routing_status
- `prefix` (string, required) — IP prefix (e.g. 1.0.0.0/24)

### get_asn_info
- `asn` (string, required) — Autonomous System Number (e.g. AS13335)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream RIPE Stat API — it is completely free.

## Upstream API

- **Provider**: RIPE Stat
- **Base URL**: https://stat.ripe.net/data
- **Auth**: None required
- **Docs**: https://stat.ripe.net/docs/data_api

## Deploy

### Docker

```bash
docker build -t settlegrid-bgp-data .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-bgp-data
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
