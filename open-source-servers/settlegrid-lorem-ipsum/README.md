# settlegrid-lorem-ipsum

Lorem Ipsum MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-lorem-ipsum)

Generate placeholder text in paragraphs, sentences, or words

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `generate()` | Generate lorem ipsum text | 1¢ |

## Parameters

### generate
- `paragraphs` (number, optional) — Number of paragraphs (default: 3)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream Lorem Ipsum API.

## Upstream API

- **Provider**: Lorem Ipsum
- **Base URL**: https://loripsum.net/api
- **Auth**: None required
- **Docs**: https://loripsum.net/

## Deploy

### Docker

```bash
docker build -t settlegrid-lorem-ipsum .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-lorem-ipsum
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
