# settlegrid-dog-api

Dog CEO API MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-dog-api)

Random dog images and breed information

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_random()` | Get a random dog image | 1¢ |
| `list_breeds()` | List all dog breeds | 1¢ |
| `get_breed_images(breed)` | Get images for a specific breed | 1¢ |

## Parameters

### get_random

### list_breeds

### get_breed_images
- `breed` (string, required) — Breed name (e.g. labrador, poodle)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream Dog CEO API API.

## Upstream API

- **Provider**: Dog CEO API
- **Base URL**: https://dog.ceo/api
- **Auth**: None required
- **Docs**: https://dog.ceo/dog-api/

## Deploy

### Docker

```bash
docker build -t settlegrid-dog-api .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-dog-api
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
