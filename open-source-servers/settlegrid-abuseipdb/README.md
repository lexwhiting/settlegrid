# settlegrid-abuseipdb

AbuseIPDB MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-abuseipdb)

Check and report abusive IP addresses via the AbuseIPDB API.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key + ABUSEIPDB_API_KEY
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `check_ip(ip)` | Check abuse reports for an IP | 1¢ |
| `get_blacklist(limit)` | Get blacklisted IPs | 2¢ |
| `check_cidr(network)` | Check abuse for CIDR range | 2¢ |
| `get_categories()` | List abuse categories | 1¢ |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key |
| `ABUSEIPDB_API_KEY` | Yes | AbuseIPDB API key from [abuseipdb.com](https://www.abuseipdb.com/account/api) |

## Upstream API

- **Provider**: AbuseIPDB
- **Base URL**: https://api.abuseipdb.com/api/v2
- **Auth**: API key (header)
- **Docs**: https://docs.abuseipdb.com/

## Deploy

### Docker

```bash
docker build -t settlegrid-abuseipdb .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -e ABUSEIPDB_API_KEY=xxx -p 3000:3000 settlegrid-abuseipdb
```

### Vercel

```bash
npm run build
vercel --prod
```

## License

MIT - see [LICENSE](LICENSE)

---

Built with [SettleGrid](https://settlegrid.ai) --- The Settlement Layer for the AI Economy
