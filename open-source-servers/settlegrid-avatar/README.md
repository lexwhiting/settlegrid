# settlegrid-avatar

DiceBear Avatars MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-avatar)

Generate avatar images via the DiceBear API.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `generate(seed, style)` | Generate an avatar by seed and style | 1¢ |
| `get_styles()` | List available avatar styles | 1¢ |

## Parameters

### generate
- `seed` (string, required)
- `style` (string, optional)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |


## Upstream API

- **Provider**: DiceBear
- **Base URL**: https://api.dicebear.com/7.x
- **Auth**: None required
- **Rate Limits**: Unlimited
- **Docs**: https://www.dicebear.com/how-to-use/http-api/

## Deploy

### Docker

```bash
docker build -t settlegrid-avatar .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-avatar
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
