# settlegrid-json-validator

JSON Validator MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-json-validator)

Validate, format, and minify JSON — local processing.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `validate_json(json)` | Validate and format JSON | 1¢ |
| `minify_json(json)` | Minify JSON | 1¢ |

## Parameters

### validate_json
- `json` (string, required) — JSON string to validate

### minify_json
- `json` (string, required) — JSON string to minify

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream Local Processing API — it is completely free.

## Upstream API

- **Provider**: Local Processing
- **Base URL**: https://local
- **Auth**: None required
- **Docs**: https://json.org/

## Deploy

### Docker

```bash
docker build -t settlegrid-json-validator .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-json-validator
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
