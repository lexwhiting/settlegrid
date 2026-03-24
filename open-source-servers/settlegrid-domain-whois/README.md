# settlegrid-domain-whois

Domain WHOIS MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-domain-whois)

Domain WHOIS lookups, DNS records, and availability checks.

## Quick Start

```bash
npm install
cp .env.example .env
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `whois_lookup(domain)` | WHOIS lookup | 1¢ |
| `dns_lookup(domain, type)` | DNS records | 1¢ |
| `check_availability(domain)` | Check availability | 1¢ |

## Parameters

### whois_lookup / check_availability
- `domain` (string, required) — Domain name
### dns_lookup
- `domain` (string, required) — Domain name
- `type` (string, optional) — Record type (A, AAAA, MX, NS, TXT, CNAME)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |


## Upstream API

- **Provider**: RDAP + Google DNS
- **Auth**: None required

## Deploy

### Docker
```bash
docker build -t settlegrid-domain-whois .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-domain-whois
```

### Vercel
```bash
npm run build
vercel --prod
```

## License
MIT - see [LICENSE](LICENSE)

---
Built with [SettleGrid](https://settlegrid.ai) — The Settlement Layer for the AI Economy
