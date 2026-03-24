# settlegrid-abuse-ch

abuse.ch MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-abuse-ch)

Access abuse.ch threat intelligence feeds for botnets, malware URLs, and threats.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_urlhaus_recent()` | Recent malware URLs | 1¢ |
| `check_url(url)` | Check URL in URLhaus | 1¢ |
| `get_threatfox_iocs(days)` | Get recent IOCs | 2¢ |
| `get_feodo_trackers()` | Active Feodo C&C servers | 1¢ |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key |

## Upstream API

- **Provider**: abuse.ch
- **Base URL**: https://urlhaus-api.abuse.ch/v1/
- **Auth**: None (public)
- **Docs**: https://urlhaus.abuse.ch/api/

## Deploy

### Docker

```bash
docker build -t settlegrid-abuse-ch .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-abuse-ch
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
