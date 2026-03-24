# settlegrid-codepoint

Unicode Codepoint Lookup MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-codepoint)

Look up Unicode character information and properties.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `lookup_codepoint(codepoint)` | Get information about a Unicode codepoint (e.g. "U+0041" or hex "0041") | 1¢ |
| `search_characters(query)` | Search Unicode characters by name | 1¢ |

## Parameters

### lookup_codepoint
- `codepoint` (string, required)

### search_characters
- `query` (string, required)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |


## Upstream API

- **Provider**: codepoints.net
- **Base URL**: https://codepoints.net
- **Auth**: None required
- **Rate Limits**: Fair use (no key)
- **Docs**: https://codepoints.net/about#api

## Deploy

### Docker

```bash
docker build -t settlegrid-codepoint .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-codepoint
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
