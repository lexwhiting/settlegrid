# settlegrid-dalle

DALL-E Image Generation MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-dalle)

Generate images from text prompts via OpenAI DALL-E.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key + OPENAI_API_KEY
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `generate_image(prompt, size)` | Generate an image from a text prompt | 5¢ |
| `create_variation(image_url, size)` | Create a variation of an existing image | 5¢ |

## Parameters

### generate_image
- `prompt` (string, required)
- `size` (string, optional)

### create_variation
- `image_url` (string, required)
- `size` (string, optional)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `OPENAI_API_KEY` | Yes | API key from platform.openai.com/api-keys |


## Upstream API

- **Provider**: OpenAI
- **Base URL**: https://api.openai.com
- **Auth**: Free API key required
- **Rate Limits**: Tier-based (see OpenAI docs)
- **Docs**: https://platform.openai.com/docs/api-reference/images

## Deploy

### Docker

```bash
docker build -t settlegrid-dalle .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -e OPENAI_API_KEY=xxx -p 3000:3000 settlegrid-dalle
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
