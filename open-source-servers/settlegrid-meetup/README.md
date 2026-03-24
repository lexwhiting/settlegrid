# settlegrid-meetup

Meetup MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-meetup)

Find upcoming Meetup events by topic and location.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key + MEETUP_TOKEN
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `find_events(query, lat, lon)` | Find upcoming events by topic | 2¢ |
| `get_group(urlname)` | Get Meetup group details by URL name | 2¢ |

## Parameters

### find_events
- `query` (string, required)
- `lat` (string, optional)
- `lon` (string, optional)

### get_group
- `urlname` (string, required)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `MEETUP_TOKEN` | Yes | OAuth token from meetup.com/api |


## Upstream API

- **Provider**: Meetup
- **Base URL**: https://api.meetup.com
- **Auth**: Free API key required
- **Rate Limits**: 200 req/hr
- **Docs**: https://www.meetup.com/api/schema/

## Deploy

### Docker

```bash
docker build -t settlegrid-meetup .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -e MEETUP_TOKEN=xxx -p 3000:3000 settlegrid-meetup
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
