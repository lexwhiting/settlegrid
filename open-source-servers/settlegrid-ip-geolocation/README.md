# settlegrid-ip-geolocation

IP Geolocation MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-ip-geolocation)

Geolocate any IP address with city, region, country, ISP, coordinates, and timezone. Supports single lookups and batch requests up to 100 IPs.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `lookup(ip)` | Geolocate a single IP address | 1¢ |
| `lookup_batch(ips)` | Geolocate up to 100 IPs at once | 1¢/ip |

## Parameters

### lookup
- `ip` (string, required) — IPv4 or IPv6 address (e.g. "8.8.8.8")

### lookup_batch
- `ips` (string[], required) — Array of IP addresses (max 100)

## Response Fields

Each lookup returns: ip, country, countryCode, region, regionCode, city, zip, coordinates (lat/lon), timezone, isp, organization, asn.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream ip-api.com service.

## Upstream API

- **Provider**: ip-api.com
- **Auth**: None required (free tier)
- **Rate Limits**: 45 requests/minute (free tier)
- **Docs**: https://ip-api.com/docs

## License

MIT - see [LICENSE](LICENSE)

---

Built with [SettleGrid](https://settlegrid.ai) — The Settlement Layer for the AI Economy
