# settlegrid-shodan

Shodan MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-shodan)

Search internet-connected devices, banners, and vulnerabilities via the Shodan API.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key + SHODAN_API_KEY
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_host(ip)` | Get host information by IP | 1¢ |
| `search_query(query)` | Search Shodan with query | 2¢ |
| `get_ports(ip)` | List open ports for an IP | 1¢ |
| `get_vuln(ip)` | Get known vulnerabilities for IP | 2¢ |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key |
| `SHODAN_API_KEY` | Yes | Shodan API key from [account.shodan.io](https://account.shodan.io/) |

## Upstream API

- **Provider**: Shodan
- **Base URL**: https://api.shodan.io
- **Auth**: API key (query param)
- **Docs**: https://developer.shodan.io/api

## Deploy

### Docker

```bash
docker build -t settlegrid-shodan .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -e SHODAN_API_KEY=xxx -p 3000:3000 settlegrid-shodan
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
