# settlegrid-country-flag-api

Country Flags API MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-country-flag-api)

Country flag images and emoji flags from Flagcdn.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_flag_url(country_code, size?)` | Get country flag URL | 1¢ |

## Parameters

### get_flag_url
- `country_code` (string, required) — ISO 3166-1 alpha-2 code (e.g. US, GB, JP)
- `size` (number) — Width in pixels (default 256)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream Flagcdn API — it is completely free.

## Upstream API

- **Provider**: Flagcdn
- **Base URL**: https://flagcdn.com
- **Auth**: None required
- **Docs**: https://flagcdn.com/

## Deploy

### Docker

```bash
docker build -t settlegrid-country-flag-api .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-country-flag-api
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
