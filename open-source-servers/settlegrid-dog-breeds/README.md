# settlegrid-dog-breeds

Dog Breeds MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-dog-breeds)

Dog breed information and random images from Dog CEO API.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `list_dog_breeds()` | List all dog breeds | 1¢ |
| `get_breed_image(breed)` | Get random image for breed | 1¢ |
| `get_random_dog()` | Get a random dog image | 1¢ |

## Parameters

### list_dog_breeds

### get_breed_image
- `breed` (string, required) — Dog breed name (e.g. labrador, poodle)

### get_random_dog

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream Dog CEO API — it is completely free.

## Upstream API

- **Provider**: Dog CEO
- **Base URL**: https://dog.ceo/api
- **Auth**: None required
- **Docs**: https://dog.ceo/dog-api/documentation/

## Deploy

### Docker

```bash
docker build -t settlegrid-dog-breeds .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-dog-breeds
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
