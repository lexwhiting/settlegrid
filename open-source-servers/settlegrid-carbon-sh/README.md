# settlegrid-carbon-sh

Carbonara Code Screenshots MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-carbon-sh)

Generate beautiful code screenshots via Carbonara (Carbon.sh alternative).

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `create_screenshot(code, language, theme)` | Generate a code screenshot image (returns PNG URL) | 1¢ |
| `create_styled(code, language, backgroundColor)` | Generate a styled code screenshot with custom background | 1¢ |

## Parameters

### create_screenshot
- `code` (string, required)
- `language` (string, optional)
- `theme` (string, optional)

### create_styled
- `code` (string, required)
- `language` (string, optional)
- `backgroundColor` (string, optional)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |


## Upstream API

- **Provider**: Carbonara
- **Base URL**: https://carbonara.solopov.dev
- **Auth**: None required
- **Rate Limits**: No published limit (open source)
- **Docs**: https://github.com/petersolopov/carbonara

## Deploy

### Docker

```bash
docker build -t settlegrid-carbon-sh .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-carbon-sh
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
