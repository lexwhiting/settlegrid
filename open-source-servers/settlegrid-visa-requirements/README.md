# settlegrid-visa-requirements

Visa Requirements MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-visa-requirements)

Passport and visa requirement data via Passport Index API.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `check_visa(from, to)` | Check visa requirement between countries | 1¢ |

## Parameters

### check_visa
- `from` (string, required) — Passport country code (ISO 3166-1 alpha-2)
- `to` (string, required) — Destination country code

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream Passport Index API API — it is completely free.

## Upstream API

- **Provider**: Passport Index API
- **Base URL**: https://rough-sun-2523.fly.dev
- **Auth**: None required
- **Docs**: https://github.com/ilyankou/passport-index-dataset

## Deploy

### Docker

```bash
docker build -t settlegrid-visa-requirements .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-visa-requirements
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
