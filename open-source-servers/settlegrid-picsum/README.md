# settlegrid-picsum

Lorem Picsum MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-picsum)

Random placeholder images for design and development

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `list_images()` | Get list of available images | 1¢ |
| `get_image_info(id)` | Get image details by ID | 1¢ |

## Parameters

### list_images
- `page` (number, optional) — Page number (default: 1)
- `limit` (number, optional) — Results per page (default: 20)

### get_image_info
- `id` (number, required) — Image ID

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream Lorem Picsum API.

## Upstream API

- **Provider**: Lorem Picsum
- **Base URL**: https://picsum.photos
- **Auth**: None required
- **Docs**: https://picsum.photos/

## Deploy

### Docker

```bash
docker build -t settlegrid-picsum .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-picsum
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
