# settlegrid-bluesky

Bluesky MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-bluesky)

Bluesky AT Protocol social network posts and profiles

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_profile(actor)` | Get a user profile | 1¢ |
| `get_feed(actor)` | Get a user's post feed | 1¢ |

## Parameters

### get_profile
- `actor` (string, required) — Handle or DID (e.g. user.bsky.social)

### get_feed
- `actor` (string, required) — Handle or DID
- `limit` (number, optional) — Number of posts (default: 20)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream Bluesky API.

## Upstream API

- **Provider**: Bluesky
- **Base URL**: https://public.api.bsky.app/xrpc
- **Auth**: None required
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
