# settlegrid-cat-facts

Cat Facts MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-cat-facts)

Random cat facts and cat breed data from CatFact API.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_cat_fact()` | Get a random cat fact | 1¢ |
| `list_cat_breeds(limit?)` | List cat breeds | 1¢ |

## Parameters

### get_cat_fact

### list_cat_breeds
- `limit` (number) — Max results (default 20)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream CatFact.ninja API — it is completely free.

## Upstream API

- **Provider**: CatFact.ninja
- **Base URL**: https://catfact.ninja
- **Auth**: None required
- **Docs**: https://catfact.ninja/

## Deploy

### Docker

```bash
docker build -t settlegrid-cat-facts .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-cat-facts
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
