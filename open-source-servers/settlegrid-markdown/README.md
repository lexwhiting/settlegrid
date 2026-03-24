# settlegrid-markdown

Markdown Renderer MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-markdown)

Convert Markdown to HTML via the GitHub Markdown API.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `render(text)` | Render Markdown text to HTML | 1¢ |
| `render_raw(text)` | Render raw Markdown to HTML | 1¢ |

## Parameters

### render
- `text` (string, required)

### render_raw
- `text` (string, required)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |


## Upstream API

- **Provider**: GitHub
- **Base URL**: https://api.github.com/markdown
- **Auth**: None required
- **Rate Limits**: 60 req/hr (unauth)
- **Docs**: https://docs.github.com/en/rest/markdown

## Deploy

### Docker

```bash
docker build -t settlegrid-markdown .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-markdown
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
