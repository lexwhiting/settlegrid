# settlegrid-mastodon

Mastodon MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-mastodon)

Fetch public Mastodon timelines and search posts via mastodon.social API with SettleGrid billing.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_public_timeline(limit)` | Get public timeline posts | 1¢ |
| `search(query, type)` | Search accounts, hashtags, and statuses | 1¢ |

## Parameters

### get_public_timeline
- `limit` (number, optional) — Max posts (1-20, default 10)

### search
- `query` (string, required) — Search query
- `type` (string, optional) — Filter: accounts, hashtags, or statuses

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |


## Upstream API

- **Provider**: Mastodon
- **Base URL**: https://mastodon.social/api/v1
- **Auth**: None required
- **Rate Limits**: 300 req/5min
- **Docs**: https://docs.joinmastodon.org/api/

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
