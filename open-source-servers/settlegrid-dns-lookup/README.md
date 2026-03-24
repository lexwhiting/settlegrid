# settlegrid-dns-lookup

DNS Lookup MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-dns-lookup)

DNS resolution via Google DNS-over-HTTPS — A, AAAA, MX, TXT, CNAME, NS records and DNSSEC validation.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `resolve(domain, type?)` | Resolve a domain to IP addresses | 1¢ |
| `get_records(domain)` | Get all DNS records for a domain | 2¢ |
| `check_dnssec(domain)` | Check DNSSEC validation status for a domain | 1¢ |

## Parameters

### resolve
- `domain` (string, required) — Domain name to resolve
- `type` (string) — Record type: A, AAAA, MX, TXT, CNAME, NS, SOA (default A)

### get_records
- `domain` (string, required) — Domain name

### check_dnssec
- `domain` (string, required) — Domain name to check

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream Google DNS-over-HTTPS API — it is completely free.

## Upstream API

- **Provider**: Google DNS-over-HTTPS
- **Base URL**: https://dns.google/resolve
- **Auth**: None required
- **Docs**: https://developers.google.com/speed/public-dns/docs/doh/json

## Deploy

### Docker

```bash
docker build -t settlegrid-dns-lookup .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-dns-lookup
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
