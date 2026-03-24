# settlegrid-meme-gen

Meme Generator MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-meme-gen)

Generate memes from popular templates via Imgflip.

## Quick Start

```bash
npm install
cp .env.example .env
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_meme_templates()` | Get popular templates | 1¢ |
| `generate_meme(template_id, text0, text1)` | Generate a meme | 2¢ |

## Parameters

### get_meme_templates
No parameters.
### generate_meme
- `template_id` (string, required) — Template ID from get_meme_templates
- `text0` (string, required) — Top text
- `text1` (string, optional) — Bottom text

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `IMGFLIP_USERNAME` | Yes | Free from imgflip.com |
| `IMGFLIP_PASSWORD` | Yes | Free from imgflip.com |

## Upstream API

- **Provider**: Imgflip
- **Auth**: Free account
- **Docs**: https://imgflip.com/api

## Deploy

### Docker
```bash
docker build -t settlegrid-meme-gen .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-meme-gen
```

### Vercel
```bash
npm run build
vercel --prod
```

## License
MIT - see [LICENSE](LICENSE)

---
Built with [SettleGrid](https://settlegrid.ai) — The Settlement Layer for the AI Economy
