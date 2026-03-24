# settlegrid-yoga-api

Yoga API MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-yoga-api)

Yoga pose database with categories, descriptions, and benefits.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `list_categories()` | List all yoga pose categories | 1¢ |
| `get_category_poses(category_id)` | Get yoga poses by category ID | 1¢ |
| `list_poses()` | List all yoga poses | 1¢ |

## Parameters

### get_category_poses
- `category_id` (number, required)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |


## Upstream API

- **Provider**: Yoga API
- **Base URL**: https://yoga-api-nzy4.onrender.com
- **Auth**: None required
- **Rate Limits**: No published limit
- **Docs**: https://github.com/alexcumplido/yoga-api

## Deploy

### Docker

```bash
docker build -t settlegrid-yoga-api .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-yoga-api
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
