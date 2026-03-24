# settlegrid-thingspeak

ThingSpeak IoT Data MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-thingspeak)

Read IoT channel data and field feeds from ThingSpeak. Free API key for public and private channels.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_channel(id, results?)` | Get channel feed data | 1¢ |
| `get_field(channel_id, field, results?)` | Get specific field data from a channel | 1¢ |
| `list_public(tag?)` | List public channels by tag | 1¢ |

## Parameters

### get_channel
- `id` (number, required) — ThingSpeak channel ID
- `results` (number) — Number of results to return (default: 10, max: 8000)

### get_field
- `channel_id` (number, required) — ThingSpeak channel ID
- `field` (number, required) — Field number (1-8)
- `results` (number) — Number of results to return (default: 10)

### list_public
- `tag` (string) — Tag to filter public channels

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `THINGSPEAK_API_KEY` | No | ThingSpeak API key from [https://thingspeak.com](https://thingspeak.com) |

## Upstream API

- **Provider**: ThingSpeak
- **Base URL**: https://api.thingspeak.com
- **Auth**: API key required
- **Docs**: https://www.mathworks.com/help/thingspeak/

## Deploy

### Docker

```bash
docker build -t settlegrid-thingspeak .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-thingspeak
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
