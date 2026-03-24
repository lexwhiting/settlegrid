# settlegrid-mastodon

Mastodon MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-mastodon)

Mastodon federated social network timelines, search, and instance info

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_public_timeline()` | Get public timeline posts | 1¢ |
| `search(q)` | Search for accounts, statuses, or hashtags | 1¢ |

## Parameters

### get_public_timeline
- `limit` (number, optional) — Number of posts (default: 20)

### search
- `q` (string, required) — Search query
- `type` (string, optional) — Filter: accounts, hashtags, statuses

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream Mastodon API.

## Upstream API

- **Provider**: Mastodon
- **Base URL**: https://mastodon.social/api/v1
- **Auth**: None required
- **Docs**: https://docs.joinmastodon.org/methods/

## Deploy

### Docker

```bash
docker build -t settlegrid-mastodon .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-mastodon
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
