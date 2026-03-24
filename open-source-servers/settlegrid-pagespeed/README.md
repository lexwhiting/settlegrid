# settlegrid-pagespeed

Google PageSpeed Insights MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-pagespeed)

Website performance analysis via Google PageSpeed Insights.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key + GOOGLE_API_KEY
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `analyze_url(url)` | Run PageSpeed analysis on a URL (mobile) | 2¢ |
| `analyze_desktop(url)` | Run PageSpeed analysis on a URL (desktop) | 2¢ |

## Parameters

### analyze_url
- `url` (string, required)

### analyze_desktop
- `url` (string, required)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `GOOGLE_API_KEY` | Yes | Free key from console.cloud.google.com/apis |


## Upstream API

- **Provider**: Google
- **Base URL**: https://developers.google.com/speed/docs/insights/v5/get-started
- **Auth**: Free API key required
- **Rate Limits**: 25,000 queries/day (free)
- **Docs**: https://developers.google.com/speed/docs/insights/v5/reference

## Deploy

### Docker

```bash
docker build -t settlegrid-pagespeed .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -e GOOGLE_API_KEY=xxx -p 3000:3000 settlegrid-pagespeed
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
