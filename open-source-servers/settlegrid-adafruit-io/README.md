# settlegrid-adafruit-io

Adafruit IO Feeds MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-adafruit-io)

Access Adafruit IO data feeds, dashboards, and IoT data streams. Free API key required.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_feed(username, feed)` | Get feed details and metadata | 1¢ |
| `get_data(username, feed, limit?)` | Get data points from a feed | 1¢ |
| `list_feeds(username)` | List all feeds for a user | 1¢ |

## Parameters

### get_feed
- `username` (string, required) — Adafruit IO username
- `feed` (string, required) — Feed key or name

### get_data
- `username` (string, required) — Adafruit IO username
- `feed` (string, required) — Feed key or name
- `limit` (number) — Number of data points to return (default: 10)

### list_feeds
- `username` (string, required) — Adafruit IO username

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `ADAFRUIT_IO_KEY` | Yes | Adafruit IO API key from [https://io.adafruit.com](https://io.adafruit.com) |

## Upstream API

- **Provider**: Adafruit IO
- **Base URL**: https://io.adafruit.com/api/v2
- **Auth**: API key required
- **Docs**: https://io.adafruit.com/api/docs/

## Deploy

### Docker

```bash
docker build -t settlegrid-adafruit-io .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-adafruit-io
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
