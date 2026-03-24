# settlegrid-audiodb

AudioDB MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-audiodb)

Music artist info, album art, and discographies from TheAudioDB.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_audio_artist(name)` | Search for music artist | 1¢ |
| `get_artist_albums(artist_id)` | Get albums by artist ID | 1¢ |

## Parameters

### search_audio_artist
- `name` (string, required) — Artist name

### get_artist_albums
- `artist_id` (string, required) — TheAudioDB artist ID

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream TheAudioDB API — it is completely free.

## Upstream API

- **Provider**: TheAudioDB
- **Base URL**: https://theaudiodb.com/api/v1/json/2
- **Auth**: None required
- **Docs**: https://www.theaudiodb.com/api_guide.php

## Deploy

### Docker

```bash
docker build -t settlegrid-audiodb .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-audiodb
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
