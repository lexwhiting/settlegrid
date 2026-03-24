# settlegrid-math-js

Math.js MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-math-js)

Evaluate mathematical expressions, perform unit conversions, and compute formulas via the Math.js API.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `evaluate(expression)` | Evaluate a mathematical expression | 1¢ |
| `evaluate_batch(expressions)` | Evaluate multiple expressions at once | 2¢ |

## Parameters

### evaluate
- `expression` (string, required) — Math expression (e.g. "2 * (3 + 4)", "sqrt(16)", "5 cm to inch")

### evaluate_batch
- `expressions` (string[], required) — Array of math expressions

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |


## Upstream API

- **Provider**: Math.js
- **Base URL**: https://api.mathjs.org/v4
- **Auth**: None required
- **Rate Limits**: No published limit
- **Docs**: https://api.mathjs.org/

## Deploy

### Docker

```bash
docker build -t settlegrid-math-js .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-math-js
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
