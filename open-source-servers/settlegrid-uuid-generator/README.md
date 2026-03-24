# settlegrid-uuid-generator

UUID Generator MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-uuid-generator)

Generate UUIDs (v4, v7) and parse UUID metadata — no external API needed.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `generate_uuid(count?)` | Generate UUID v4 | 1¢ |
| `parse_uuid(uuid)` | Parse UUID and extract metadata | 1¢ |

## Parameters

### generate_uuid
- `count` (number) — Number of UUIDs (1-100, default 1)

### parse_uuid
- `uuid` (string, required) — UUID to parse

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream Local Generation API — it is completely free.

## Upstream API

- **Provider**: Local Generation
- **Base URL**: https://httpbin.org
- **Auth**: None required
- **Docs**: https://datatracker.ietf.org/doc/html/rfc4122

## Deploy

### Docker

```bash
docker build -t settlegrid-uuid-generator .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-uuid-generator
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
