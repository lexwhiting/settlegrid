# settlegrid-bluesky

Bluesky MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-bluesky)

Fetch Bluesky posts and profiles from the AT Protocol public API with SettleGrid billing.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_profile(handle)` | Get a Bluesky user profile | 1¢ |
| `get_author_feed(handle, limit)` | Get recent posts by a user | 1¢ |

## Parameters

### get_profile
- `handle` (string, required) — Bluesky handle (e.g. "user.bsky.social")

### get_author_feed
- `handle` (string, required) — Bluesky handle
- `limit` (number, optional) — Max posts (1-20, default 10)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |


## Upstream API

- **Provider**: Bluesky
- **Base URL**: https://public.api.bsky.app/xrpc
- **Auth**: None required
- **Rate Limits**: 3000 req/5min
- **Docs**: https://docs.bsky.app/

## Deploy

### Docker

```bash
docker build -t settlegrid-bluesky .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-bluesky
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
