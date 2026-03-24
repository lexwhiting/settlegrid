# settlegrid-pdf-gen

PDF Generator MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-pdf-gen)

Generate PDFs from HTML or URLs via html2pdf.app.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `from_url(url)` | Generate PDF from a URL | 1¢ |
| `from_html(html)` | Generate PDF from HTML string | 1¢ |

## Parameters

### from_url
- `url` (string, required)

### from_html
- `html` (string, required)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |


## Upstream API

- **Provider**: html2pdf.app
- **Base URL**: https://api.html2pdf.app/v1/generate
- **Auth**: None required
- **Rate Limits**: 100 req/day (free)
- **Docs**: https://html2pdf.app/documentation/

## Deploy

### Docker

```bash
docker build -t settlegrid-pdf-gen .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-pdf-gen
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
