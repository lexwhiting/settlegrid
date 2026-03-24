# settlegrid-picsum-photos

Lorem Picsum Photos MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-picsum-photos)

Random placeholder photos with configurable dimensions from Lorem Picsum.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_random_photo(width?, height?)` | Get random photo URL | 1¢ |
| `list_photos(page?, limit?)` | List available photos | 1¢ |
| `get_photo_info(id)` | Get photo details by ID | 1¢ |

## Parameters

### get_random_photo
- `width` (number) — Image width (default 800)
- `height` (number) — Image height (default 600)

### list_photos
- `page` (number) — Page number (default 1)
- `limit` (number) — Results per page (default 20)

### get_photo_info
- `id` (string, required) — Photo ID

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream Lorem Picsum API — it is completely free.

## Upstream API

- **Provider**: Lorem Picsum
- **Base URL**: https://picsum.photos
- **Auth**: None required
- **Docs**: https://picsum.photos/

## Deploy

### Docker

```bash
docker build -t settlegrid-picsum-photos .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-picsum-photos
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
