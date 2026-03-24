# settlegrid-dog-ceo

Dog CEO MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-dog-ceo)

Get random dog images and browse breeds from the Dog CEO API.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_random_image(count)` | Get a random dog image URL | 1¢ |
| `get_breed_image(breed)` | Get a random image of a specific breed | 1¢ |
| `list_breeds()` | List all dog breeds | 1¢ |

## Parameters

### get_random_image
- `count` (number, optional) — Number of images (1-50, default 1)

### get_breed_image
- `breed` (string, required) — Dog breed (e.g. "labrador", "poodle")

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |


## Upstream API

- **Provider**: Dog CEO
- **Base URL**: https://dog.ceo/api
- **Auth**: None required
- **Rate Limits**: Unlimited
- **Docs**: https://dog.ceo/dog-api/

## Deploy

### Docker

```bash
docker build -t settlegrid-dog-ceo .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-dog-ceo
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
