# settlegrid-threat-feeds

Threat Feeds MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-threat-feeds)

Aggregate open-source threat intelligence from multiple feeds.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_emerging_threats()` | Get emerging threat rules | 1¢ |
| `get_tor_exits()` | Get Tor exit node IPs | 1¢ |
| `get_feodo_botnet()` | Get Feodo botnet C&C IPs | 1¢ |
| `get_ssl_blacklist()` | Get SSL certificate blacklist | 1¢ |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key |

## Upstream API

- **Provider**: Various Open Sources
- **Base URL**: Multiple
- **Auth**: None (open data)
- **Docs**: https://github.com/hslatman/awesome-threat-intelligence

## Deploy

### Docker

```bash
docker build -t settlegrid-threat-feeds .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-threat-feeds
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
